package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall" // Added syscall import

	// Added unsafe import
	"github.com/hashicorp/go-version"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const AppVersion = "1.4.0"

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	go func() {
		status := a.CheckForUpdate()
		if status != nil && status.HasUpdate {
			runtime.EventsEmit(a.ctx, "update-available", status)
		}
	}()
}

type GitHubRelease struct {
	TagName string `json:"tag_name"`
	Assets  []struct {
		Name               string `json:"name"`
		BrowserDownloadUrl string `json:"browser_download_url"`
	} `json:"assets"`
}

type UpdateStatus struct {
	HasUpdate   bool   `json:"hasUpdate"`
	LatestVer   string `json:"latestVer"`
	DownloadUrl string `json:"downloadUrl"`
	Error       string `json:"error"`
}

func (a *App) CheckForUpdate() *UpdateStatus {
	resp, err := http.Get("https://api.github.com/repos/neohum/classbook/releases/latest")
	if err != nil {
		fmt.Println("Error checking for update:", err)
		return &UpdateStatus{Error: "업데이트 서버에 연결할 수 없습니다. " + err.Error()}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Println("GitHub API responded with status:", resp.StatusCode)
		return &UpdateStatus{Error: fmt.Sprintf("서버 응답 오류 (상태 코드: %d)", resp.StatusCode)}
	}

	var release GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		fmt.Println("Error decoding release JSON:", err)
		return &UpdateStatus{Error: "업데이트 정보를 해석하는 데 실패했습니다."}
	}

	latestVersionStr := strings.TrimPrefix(release.TagName, "v")
	currentVersionStr := strings.TrimPrefix(AppVersion, "v")

	latestVer, errStr1 := version.NewVersion(latestVersionStr)
	currentVer, errStr2 := version.NewVersion(currentVersionStr)

	if errStr1 != nil || errStr2 != nil {
		fmt.Println("Error parsing versions:", errStr1, errStr2)
		return &UpdateStatus{Error: "버전 정보를 비교하는 중 오류가 발생했습니다."}
	}

	if latestVer.GreaterThan(currentVer) {
		var downloadUrl string
		for _, asset := range release.Assets {
			if strings.HasSuffix(asset.Name, ".exe") {
				downloadUrl = asset.BrowserDownloadUrl
				break
			}
		}

		if downloadUrl != "" {
			return &UpdateStatus{
				HasUpdate:   true,
				LatestVer:   release.TagName,
				DownloadUrl: downloadUrl,
			}
		}
	}

	return &UpdateStatus{
		HasUpdate: false,
		LatestVer: release.TagName,
	}
}

func (a *App) DownloadAndInstallUpdate(downloadUrl, tagName string) {
	// Show a small popup that it's downloading
	// A simple indeteriminate dialog or just log... there's no native progress dialog in Wails,
	// so we simply fetch it and launch it.

	tempDir := os.TempDir()
	installerPath := filepath.Join(tempDir, fmt.Sprintf("classbook-setup-%s.exe", tagName))

	out, err := os.Create(installerPath)
	if err != nil {
		fmt.Println("Failed to create temp installer file:", err)
		return
	}
	defer out.Close()

	resp, err := http.Get(downloadUrl)
	if err != nil {
		fmt.Println("Failed to download installer:", err)
		return
	}
	defer resp.Body.Close()

	_, err = io.Copy(out, resp.Body)
	if err != nil {
		fmt.Println("Failed to save installer:", err)
		return
	}

	out.Close() // Ensure it's closed before executing

	// Launch the installer
	cmd := exec.Command(installerPath)
	err = cmd.Start()
	if err != nil {
		fmt.Println("Failed to start installer:", err)
		return
	}

	// Exit the current application so the installer can overwrite files
	os.Exit(0)
}

// GetAppVersion returns the current version string
func (a *App) GetAppVersion() string {
	return AppVersion
}

var (
	user32                  = syscall.NewLazyDLL("user32.dll")
	procReleaseCapture      = user32.NewProc("ReleaseCapture")
	procSendMessageW        = user32.NewProc("SendMessageW")
	procGetForegroundWindow = user32.NewProc("GetForegroundWindow")
)

const (
	WM_NCLBUTTONDOWN = 0x00A1
	HTCAPTION        = 2
)

// StartDrag initiates the native window drag using Windows APIs
func (a *App) StartDrag() {
	hwnd, _, _ := procGetForegroundWindow.Call()
	if hwnd != 0 {
		procReleaseCapture.Call()
		procSendMessageW.Call(hwnd, uintptr(WM_NCLBUTTONDOWN), uintptr(HTCAPTION), 0)
	}
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// Textbook represents a book available in the viewer
type Textbook struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Color string `json:"color"`
}

var colors = []string{"bg-orange-500", "bg-orange-400", "bg-blue-500", "bg-blue-400", "bg-green-500", "bg-rose-500", "bg-purple-500"}

// GetTextbooks scans the book/images directory and returns available textbooks
func (a *App) GetTextbooks() ([]Textbook, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return nil, err
	}

	imagesDir := filepath.Join(cwd, "book", "images")
	entries, err := os.ReadDir(imagesDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []Textbook{}, nil
		}
		return nil, err
	}

	var books []Textbook
	colorIdx := 0
	for _, entry := range entries {
		if entry.IsDir() {
			title := entry.Name()
			// Generate a color pseudo-randomly based on name length or use sequence
			color := colors[colorIdx%len(colors)]
			colorIdx++
			books = append(books, Textbook{
				ID:    title,
				Title: title, // Using directory name as title
				Color: color,
			})
		}
	}
	return books, nil
}

type Metadata struct {
	NumPages int `json:"numPages"`
}

// SelectPdfDialog opens a file dialog to pick a PDF. It returns the absolute path.
func (a *App) SelectPdfDialog() (string, error) {
	filename, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "교과서 PDF 선택",
		Filters: []runtime.FileFilter{
			{DisplayName: "PDF Files", Pattern: "*.pdf"},
		},
	})
	return filename, err
}

// ReadFileBase64 reads a local file and returns its content as a base64 string
// so the frontend PDF.js worker can parse it directly from memory
func (a *App) ReadFileBase64(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(data), nil
}

// EnsureBookDir creates the book directory and generates metadata if needed
func (a *App) EnsureBookDir(title string, numPages int) error {
	cwd, err := os.Getwd()
	if err != nil {
		return err
	}
	bookDir := filepath.Join(cwd, "book", "images", title)
	if err := os.MkdirAll(bookDir, 0755); err != nil {
		return err
	}

	meta := Metadata{NumPages: numPages}
	metaBytes, _ := json.Marshal(meta)
	return os.WriteFile(filepath.Join(bookDir, "metadata.json"), metaBytes, 0644)
}

// SavePageImage saves a base64 encoded jpeg into the book's image directory
func (a *App) SavePageImage(title string, pageNum int, base64Data string) error {
	cwd, err := os.Getwd()
	if err != nil {
		return err
	}
	bookDir := filepath.Join(cwd, "book", "images", title)

	// Trim the data URL prefix if it exists
	idx := strings.Index(base64Data, ";base64,")
	if idx != -1 {
		base64Data = base64Data[idx+8:]
	}

	data, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return err
	}

	imgFile := filepath.Join(bookDir, fmt.Sprintf("page_%d.jpg", pageNum))
	return os.WriteFile(imgFile, data, 0644)
}

// DeleteBook removes a book directory completely from disk
func (a *App) DeleteBook(title string) error {
	cwd, err := os.Getwd()
	if err != nil {
		return err
	}
	bookDir := filepath.Join(cwd, "book", "images", title)

	// Simple security check to avoid deleting outside of books directory
	if !strings.HasPrefix(bookDir, filepath.Join(cwd, "book", "images")) {
		return fmt.Errorf("invalid book directory")
	}

	return os.RemoveAll(bookDir)
}
