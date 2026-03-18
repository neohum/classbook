package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

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
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// LaunchPenTool launches the external edulinker pen executable
func (a *App) LaunchPenTool() error {
	possiblePaths := []string{
		filepath.Join(os.Getenv("ProgramFiles"), "edulinker-pen", "edulinker-pen.exe"),
		filepath.Join(os.Getenv("ProgramFiles(x86)"), "edulinker-pen", "edulinker-pen.exe"),
		filepath.Join(os.Getenv("LOCALAPPDATA"), "edulinker-pen", "edulinker-pen.exe"),
		"edulinker-pen.exe", // Fallback to PATH
	}

	var penPath string
	for _, p := range possiblePaths {
		if _, err := os.Stat(p); err == nil {
			penPath = p
			break
		}
	}

	if penPath == "" {
		return fmt.Errorf("pen tool executable not found")
	}

	cmd := exec.Command(penPath)
	if filepath.IsAbs(penPath) {
		cmd.Dir = filepath.Dir(penPath)
	}

	// Start the command in the background
	err := cmd.Start()
	if err != nil {
		return fmt.Errorf("failed to start pen tool: %w", err)
	}

	// We intentionally do not wait for the command to finish so we don't block
	return nil
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
