package main

import (
	"context"
	"embed"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

var (
	kernel32DLL = syscall.NewLazyDLL("kernel32.dll")
	user32DLL   = syscall.NewLazyDLL("user32.dll")

	procCreateMutexW        = kernel32DLL.NewProc("CreateMutexW")
	procCloseHandle         = kernel32DLL.NewProc("CloseHandle")
	procFindWindowW         = user32DLL.NewProc("FindWindowW")
	procShowWindow          = user32DLL.NewProc("ShowWindow")
	procSetForegroundWindow = user32DLL.NewProc("SetForegroundWindow")
)

func checkSingleInstance() (uintptr, bool) {
	mutexName, _ := syscall.UTF16PtrFromString("Local\\ClassbookSingleInstanceMutex_v1")
	hMutex, _, errMutex := procCreateMutexW.Call(0, 0, uintptr(unsafe.Pointer(mutexName)))
	const ERROR_ALREADY_EXISTS = 183
	if errMutex == syscall.Errno(ERROR_ALREADY_EXISTS) {
		logToFile("Another instance is already running.")
		className, _ := syscall.UTF16PtrFromString("ClassbookMainWindow")
		hwnd, _, _ := procFindWindowW.Call(uintptr(unsafe.Pointer(className)), 0)
		if hwnd == 0 {
			winTitle, _ := syscall.UTF16PtrFromString("Classbook Viewer")
			hwnd, _, _ = procFindWindowW.Call(0, uintptr(unsafe.Pointer(winTitle)))
		}
		if hwnd != 0 {
			procShowWindow.Call(hwnd, 9) // SW_RESTORE
			procSetForegroundWindow.Call(hwnd)
		}
		if hMutex != 0 {
			procCloseHandle.Call(hMutex)
		}
		return 0, false
	}
	return hMutex, true
}

func logToFile(format string, args ...interface{}) {
	logPath := filepath.Join(os.TempDir(), "classbook_runtime.log")
	f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err == nil {
		defer f.Close()
		timestamp := time.Now().Format("2006-01-02 15:04:05.000")
		msg := fmt.Sprintf(format, args...)
		f.WriteString(fmt.Sprintf("[%s] %s\r\n", timestamp, msg))
	}
}

//go:embed all:viewer/dist
var assets embed.FS

// FileLoader struct to handle loading local files
type FileLoader struct {
	http.Handler
}

// NewFileLoader creates a new FileLoader
func NewFileLoader() *FileLoader {
	return &FileLoader{}
}

// ServeHTTP handles requests for local files, particularly in the book directory
func (h *FileLoader) ServeHTTP(res http.ResponseWriter, req *http.Request) {
	requestedFilename := strings.TrimPrefix(req.URL.Path, "/")

	// Decode URL
	decodedFilename, err := url.QueryUnescape(requestedFilename)
	if err == nil {
		requestedFilename = decodedFilename
	}

	// Print logging for debug
	println("Request for:", requestedFilename)

	// Set CORS headers so Vite dev server can fetch
	res.Header().Set("Access-Control-Allow-Origin", "*")
	res.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	res.Header().Set("Access-Control-Allow-Headers", "*")

	// If it's a preflight request, return OK
	if req.Method == "OPTIONS" {
		res.WriteHeader(http.StatusOK)
		return
	}

	// Serve streaming local PDF without loading entire file into memory/base64
	if strings.HasPrefix(requestedFilename, "local_pdf") {
		targetPdf := req.URL.Query().Get("path")
		if targetPdf != "" && strings.EqualFold(filepath.Ext(targetPdf), ".pdf") {
			if _, errStat := os.Stat(targetPdf); errStat == nil {
				res.Header().Set("Content-Type", "application/pdf")
				res.Header().Set("Accept-Ranges", "bytes")
				http.ServeFile(res, req, targetPdf)
				return
			}
		}
		res.WriteHeader(http.StatusNotFound)
		return
	}

	// If the request starts with "book/", serve it from the local filesystem
	if strings.HasPrefix(requestedFilename, "book/") {
		appDir := getAppDir()
		filePath := filepath.Join(appDir, requestedFilename)

		// Clean the path to prevent directory traversal attacks
		filePath = filepath.Clean(filePath)
		if !strings.HasPrefix(filePath, filepath.Join(appDir, "book")) {
			// Check cwd if different
			cwd, errCwd := os.Getwd()
			if errCwd == nil && cwd != appDir {
				altPath := filepath.Clean(filepath.Join(cwd, requestedFilename))
				if strings.HasPrefix(altPath, filepath.Join(cwd, "book")) {
					filePath = altPath
				}
			}
		}

		fileData, err := os.ReadFile(filePath)
		if err != nil {
			// Fallback to cwd if file not found in appDir
			cwd, errCwd := os.Getwd()
			if errCwd == nil && cwd != appDir {
				altPath := filepath.Clean(filepath.Join(cwd, requestedFilename))
				if strings.HasPrefix(altPath, filepath.Join(cwd, "book")) {
					if altData, errAlt := os.ReadFile(altPath); errAlt == nil {
						fileData = altData
						filePath = altPath
						err = nil
					}
				}
			}
		}

		if err != nil {
			res.WriteHeader(http.StatusNotFound)
			res.Write([]byte(err.Error()))
			return
		}

		// Set content type for PDF, JPG, and JSON
		ext := strings.ToLower(filepath.Ext(filePath))
		switch ext {
		case ".pdf":
			res.Header().Set("Content-Type", "application/pdf")
		case ".jpg", ".jpeg":
			res.Header().Set("Content-Type", "image/jpeg")
		case ".png":
			res.Header().Set("Content-Type", "image/png")
		case ".json":
			res.Header().Set("Content-Type", "application/json")
		}

		res.Write(fileData)
		return
	}

	// For anything else, return 404 and let the assetserver handle it
	res.WriteHeader(http.StatusNotFound)
}

func main() {
	logToFile("Classbook application starting: PID=%d, Args=%v", os.Getpid(), os.Args)

	hMutex, isFirst := checkSingleInstance()
	logToFile("checkSingleInstance returned: isFirst=%v, hMutex=%v", isFirst, hMutex)
	if !isFirst {
		logToFile("Exiting because another instance is already running and was activated")
		return
	}
	if hMutex != 0 {
		defer procCloseHandle.Call(hMutex)
	}

	// Create an instance of the app structure
	app := NewApp()

	logToFile("Calling wails.Run...")
	// Create application with options
	err := wails.Run(&options.App{
		Title:     "Classbook Viewer",
		Width:     1280,
		Height:    800,
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets:  assets,
			Handler: NewFileLoader(),
		},
		BackgroundColour: &options.RGBA{R: 255, G: 255, B: 255, A: 1},
		OnStartup: func(ctx context.Context) {
			logToFile("wails OnStartup called")
			app.startup(ctx)
		},
		OnDomReady: func(ctx context.Context) {
			logToFile("wails OnDomReady called")
		},
		OnShutdown: func(ctx context.Context) {
			logToFile("Classbook OnShutdown called")
		},
		OnBeforeClose: func(ctx context.Context) bool {
			logToFile("Classbook OnBeforeClose called")
			return false
		},
		Windows: &windows.Options{
			WindowClassName:                     "ClassbookMainWindow",
			WebviewDisableRendererCodeIntegrity: true,
		},
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		logToFile("Classbook wails.Run error: %v", err)
		println("Error:", err.Error())
	} else {
		logToFile("Classbook wails.Run exited normally")
	}
}
