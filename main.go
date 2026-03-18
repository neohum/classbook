package main

import (
	"embed"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

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

	// If the request starts with "book/", serve it from the local filesystem
	if strings.HasPrefix(requestedFilename, "book/") {
		cwd, err := os.Getwd()
		if err != nil {
			res.WriteHeader(http.StatusInternalServerError)
			res.Write([]byte(err.Error()))
			return
		}

		filePath := filepath.Join(cwd, requestedFilename)

		// Clean the path to prevent directory traversal attacks
		filePath = filepath.Clean(filePath)
		if !strings.HasPrefix(filePath, filepath.Join(cwd, "book")) {
			res.WriteHeader(http.StatusForbidden)
			res.Write([]byte("Access Denied"))
			return
		}

		fileData, err := os.ReadFile(filePath)
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
	// Create an instance of the app structure
	app := NewApp()

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
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
