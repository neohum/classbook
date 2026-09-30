package main

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/hashicorp/go-version"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed parse_weekly_plan.py
var embeddedWeeklyPlanScript []byte

const AppVersion = "1.2.19"
const GitHubRawVersionUrl = "https://raw.githubusercontent.com/neohum/classbook/main/version.json"
const GitHubReleaseApiUrl = "https://api.github.com/repos/neohum/classbook/releases/latest"
const WasabiVersionUrl = "https://s3.ap-northeast-1.wasabisys.com/edulinkermessenger/exports/classbook/version.json"

type WasabiVersionInfo struct {
	Version     string `json:"version"`
	ReleaseDate string `json:"releaseDate"`
	DownloadUrl string `json:"downloadUrl"`
	Notes       string `json:"notes"`
}

// AppSettings stores user preferences
type AppSettings struct {
	PlanWatchFolder string    `json:"planWatchFolder"`
	LastPlanFile    string    `json:"lastPlanFile"`
	LastPlanModTime time.Time `json:"lastPlanModTime"`
	BellSchedules   string    `json:"bellSchedules,omitempty"`
}

// App struct
type App struct {
	ctx             context.Context
	settings        AppSettings
	settingsPath    string
	watcherStopChan chan struct{}
	watcherMu       sync.Mutex
	currentPlan     *WeeklyPlanResult
}

// getAppDir returns the directory of the running executable or working directory
func getAppDir() string {
	cwd, errCwd := os.Getwd()
	if errCwd == nil {
		if _, err := os.Stat(filepath.Join(cwd, "book")); err == nil {
			return cwd
		}
	}
	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		if _, err := os.Stat(filepath.Join(exeDir, "book")); err == nil {
			return exeDir
		}
		if _, err := os.Stat(filepath.Join(exeDir, "settings.json")); err == nil {
			return exeDir
		}
		if _, err := os.Stat(filepath.Join(exeDir, "latest_weekly_plan.json")); err == nil {
			return exeDir
		}
		if strings.Contains(strings.ToLower(exeDir), "classbook") {
			return exeDir
		}
	}
	if errCwd == nil {
		return cwd
	}
	return "."
}

// getImagesDir returns the book/images directory reliably
func getImagesDir() string {
	appDir := getAppDir()
	imagesDir := filepath.Join(appDir, "book", "images")
	if _, err := os.Stat(imagesDir); err == nil {
		return imagesDir
	}
	if cwd, err := os.Getwd(); err == nil {
		alt := filepath.Join(cwd, "book", "images")
		if _, errAlt := os.Stat(alt); errAlt == nil {
			return alt
		}
	}
	return imagesDir
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		watcherStopChan: make(chan struct{}),
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Load settings from application directory
	appDir := getAppDir()
	a.settingsPath = filepath.Join(appDir, "settings.json")
	a.loadSettings()

	// Check and set default watch folder if empty
	if a.settings.PlanWatchFolder == "" {
		defaultFolder := filepath.Join(appDir, "weekly_plans")
		os.MkdirAll(defaultFolder, 0755)
		a.settings.PlanWatchFolder = defaultFolder
		a.saveSettings()
	} else {
		os.MkdirAll(a.settings.PlanWatchFolder, 0755)
	}

	// Load existing plan if available
	a.loadLatestPlan()

	// Start folder watcher
	go a.startPlanFolderWatcher()

	// Immediate check for updates after frontend is ready
	go func() {
		time.Sleep(2 * time.Second)
		status := a.CheckForUpdate()
		if status != nil && status.HasUpdate {
			runtime.EventsEmit(a.ctx, "update-available", status)
		}
	}()

	// Periodic unattended update check (every 30 minutes)
	go func() {
		ticker := time.NewTicker(30 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			status := a.CheckForUpdate()
			if status != nil && status.HasUpdate {
				runtime.EventsEmit(a.ctx, "update-available", status)
			}
		}
	}()
}

func (a *App) loadSettings() {
	if a.settingsPath == "" {
		return
	}
	data, err := os.ReadFile(a.settingsPath)
	if err == nil {
		_ = json.Unmarshal(data, &a.settings)
	}
}

func (a *App) saveSettings() {
	if a.settingsPath == "" {
		return
	}
	bytes, err := json.MarshalIndent(a.settings, "", "  ")
	if err == nil {
		_ = os.WriteFile(a.settingsPath, bytes, 0644)
	}
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
	currentVersionStr := strings.TrimPrefix(AppVersion, "v")
	currentVer, errCurr := version.NewVersion(currentVersionStr)

	client := &http.Client{Timeout: 5 * time.Second}

	// 1. Check GitHub raw version.json (Fastest, 100% public, no rate limits)
	rawResp, err := client.Get(GitHubRawVersionUrl)
	if err == nil && rawResp.StatusCode == http.StatusOK {
		defer rawResp.Body.Close()
		var vInfo WasabiVersionInfo
		if json.NewDecoder(rawResp.Body).Decode(&vInfo) == nil {
			vStr := strings.TrimPrefix(vInfo.Version, "v")
			vVer, errV := version.NewVersion(vStr)
			if errV == nil && errCurr == nil && vVer.GreaterThan(currentVer) {
				return &UpdateStatus{
					HasUpdate:   true,
					LatestVer:   vInfo.Version,
					DownloadUrl: vInfo.DownloadUrl,
				}
			}
		}
	}

	// 2. Check GitHub Releases API
	resp, err := client.Get(GitHubReleaseApiUrl)
	if err == nil && resp.StatusCode == http.StatusOK {
		defer resp.Body.Close()
		var release GitHubRelease
		if err := json.NewDecoder(resp.Body).Decode(&release); err == nil {
			latestVersionStr := strings.TrimPrefix(release.TagName, "v")
			latestVer, errStr1 := version.NewVersion(latestVersionStr)
			if errStr1 == nil && errCurr == nil && latestVer.GreaterThan(currentVer) {
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
		}
	}

	// 3. Check Wasabi S3 version.json
	wasabiResp, err := client.Get(WasabiVersionUrl)
	if err == nil && wasabiResp.StatusCode == http.StatusOK {
		defer wasabiResp.Body.Close()
		var wasabiInfo WasabiVersionInfo
		if json.NewDecoder(wasabiResp.Body).Decode(&wasabiInfo) == nil {
			wasabiVerStr := strings.TrimPrefix(wasabiInfo.Version, "v")
			wasabiVer, errW := version.NewVersion(wasabiVerStr)
			if errW == nil && errCurr == nil && wasabiVer.GreaterThan(currentVer) {
				return &UpdateStatus{
					HasUpdate:   true,
					LatestVer:   wasabiInfo.Version,
					DownloadUrl: wasabiInfo.DownloadUrl,
				}
			}
		}
	}

	return &UpdateStatus{
		HasUpdate: false,
		LatestVer: AppVersion,
	}
}

func (a *App) DownloadAndInstallUpdate(downloadUrl, tagName string) {
	tempDir := os.TempDir()
	installerPath := filepath.Join(tempDir, fmt.Sprintf("classbook-setup-%s.exe", tagName))

	// Clean up previous temp installer
	os.Remove(installerPath)

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

	out.Close()

	// Launch installer silently (/S) with administrator privileges via PowerShell Start-Process
	// -Verb RunAs provides required UAC elevation without CreateProcess error 740
	// /S executes NSIS in silent mode without user intervention
	cmd := exec.Command("powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command",
		fmt.Sprintf("Start-Process -FilePath '%s' -ArgumentList '/S' -Verb RunAs", installerPath))
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP | 0x08000000, // CREATE_NO_WINDOW
	}
	err = cmd.Start()
	if err != nil {
		fmt.Println("Failed to start installer via PowerShell:", err)
		// Direct execution fallback with /S
		fallbackCmd := exec.Command(installerPath, "/S")
		fallbackCmd.SysProcAttr = &syscall.SysProcAttr{
			CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP,
		}
		fallbackCmd.Start()
	}

	// Grace period before current process exits so the installer can take over
	time.Sleep(500 * time.Millisecond)
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
	ID         string `json:"id"`
	Title      string `json:"title"`
	Color      string `json:"color"`
	NumPages   int    `json:"numPages"`
	PageOffset int    `json:"pageOffset"`
}

var colors = []string{"bg-orange-500", "bg-orange-400", "bg-blue-500", "bg-blue-400", "bg-green-500", "bg-rose-500", "bg-purple-500"}

// GetTextbooks scans the book/images directory and returns available textbooks with their metadata
func (a *App) GetTextbooks() ([]Textbook, error) {
	imagesDir := getImagesDir()
	entries, err := os.ReadDir(imagesDir)
	if err != nil {
		if cwd, errCwd := os.Getwd(); errCwd == nil {
			altImages := filepath.Join(cwd, "book", "images")
			if altEntries, errAlt := os.ReadDir(altImages); errAlt == nil {
				imagesDir = altImages
				entries = altEntries
				err = nil
			}
		}
	}
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
			color := colors[colorIdx%len(colors)]
			colorIdx++

			numPages := 0
			pageOffset := 0

			metaPath := filepath.Join(imagesDir, title, "metadata.json")
			if metaBytes, err := os.ReadFile(metaPath); err == nil {
				var meta Metadata
				if json.Unmarshal(metaBytes, &meta) == nil {
					numPages = meta.NumPages
					pageOffset = meta.PageOffset
				}
			}

			books = append(books, Textbook{
				ID:         title,
				Title:      title,
				Color:      color,
				NumPages:   numPages,
				PageOffset: pageOffset,
			})
		}
	}
	return books, nil
}

type Metadata struct {
	NumPages   int `json:"numPages"`
	PageOffset int `json:"pageOffset"`
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

// SelectMultiplePdfsDialog opens a file dialog to pick multiple PDFs. It returns the absolute paths.
func (a *App) SelectMultiplePdfsDialog() ([]string, error) {
	filenames, err := runtime.OpenMultipleFilesDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "교과서 PDF 선택 (여러 개 선택 가능)",
		Filters: []runtime.FileFilter{
			{DisplayName: "PDF Files", Pattern: "*.pdf"},
		},
	})
	return filenames, err
}

// ReadFileBase64 reads a local file and returns its content as a base64 string
func (a *App) ReadFileBase64(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(data), nil
}

// EnsureBookDir creates the book directory and generates metadata with optional offset
func (a *App) EnsureBookDir(title string, numPages int) error {
	return a.EnsureBookDirWithOffset(title, numPages, 0)
}

// EnsureBookDirWithOffset creates the book directory and writes metadata with pageOffset
func (a *App) EnsureBookDirWithOffset(title string, numPages int, pageOffset int) error {
	imagesDir := getImagesDir()
	bookDir := filepath.Join(imagesDir, title)
	if err := os.MkdirAll(bookDir, 0755); err != nil {
		return err
	}

	meta := Metadata{
		NumPages:   numPages,
		PageOffset: pageOffset,
	}
	metaBytes, _ := json.MarshalIndent(meta, "", "  ")
	return os.WriteFile(filepath.Join(bookDir, "metadata.json"), metaBytes, 0644)
}

// UpdateBookOffset updates only the pageOffset in the metadata.json of the book
func (a *App) UpdateBookOffset(title string, pageOffset int) error {
	imagesDir := getImagesDir()
	metaPath := filepath.Join(imagesDir, title, "metadata.json")
	var meta Metadata
	if data, err := os.ReadFile(metaPath); err == nil {
		_ = json.Unmarshal(data, &meta)
	}
	meta.PageOffset = pageOffset

	metaBytes, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(metaPath, metaBytes, 0644)
}

// GetBookMetadata reads metadata for a specific textbook
func (a *App) GetBookMetadata(title string) (*Metadata, error) {
	imagesDir := getImagesDir()
	metaPath := filepath.Join(imagesDir, title, "metadata.json")
	data, err := os.ReadFile(metaPath)
	if err != nil {
		return nil, err
	}
	var meta Metadata
	if err := json.Unmarshal(data, &meta); err != nil {
		return nil, err
	}
	return &meta, nil
}

// SavePageImage saves a base64 encoded jpeg into the book's image directory
func (a *App) SavePageImage(title string, pageNum int, base64Data string) error {
	imagesDir := getImagesDir()
	bookDir := filepath.Join(imagesDir, title)
	_ = os.MkdirAll(bookDir, 0755)

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
	imagesDir := getImagesDir()
	bookDir := filepath.Join(imagesDir, title)

	if !strings.HasPrefix(bookDir, imagesDir) {
		return fmt.Errorf("invalid book directory")
	}

	return os.RemoveAll(bookDir)
}

// ==========================================
// Weekly Lesson Plan (주학습계획안) Features
// ==========================================

type WeeklyPlanItem struct {
	Period        int    `json:"period"`
	Subject       string `json:"subject"`
	MatchedBookId string `json:"matchedBookId"`
	Topic         string `json:"topic"`
	PageStr       string `json:"pageStr"`
	StartPage     int    `json:"startPage"`
	EndPage       int    `json:"endPage"`
	Raw           string `json:"raw"`
}

type WeeklyPlanResult struct {
	Success  bool                        `json:"success"`
	Title    string                      `json:"title"`
	FilePath string                      `json:"filePath"`
	Schedule map[string][]WeeklyPlanItem `json:"schedule"`
	Error    string                      `json:"error,omitempty"`
}

// SelectWatchFolderDialog opens directory chooser for watching weekly plans
func (a *App) SelectWatchFolderDialog() (string, error) {
	folder, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "주학습계획안 감시 폴더 선택",
	})
	if err != nil || folder == "" {
		return a.settings.PlanWatchFolder, err
	}

	a.settings.PlanWatchFolder = folder
	a.saveSettings()
	return folder, nil
}

// GetWatchFolder returns currently configured watch folder
func (a *App) GetWatchFolder() string {
	return a.settings.PlanWatchFolder
}

// SetWatchFolder sets the watch folder path directly
func (a *App) SetWatchFolder(folderPath string) error {
	if _, err := os.Stat(folderPath); err != nil {
		if err := os.MkdirAll(folderPath, 0755); err != nil {
			return err
		}
	}
	a.settings.PlanWatchFolder = folderPath
	a.saveSettings()
	return nil
}

// SaveBellSchedules stores the bell schedule JSON in settings.json
func (a *App) SaveBellSchedules(schedulesJSON string) error {
	a.settings.BellSchedules = schedulesJSON
	a.saveSettings()
	return nil
}

// GetBellSchedules retrieves the bell schedule JSON from settings.json
func (a *App) GetBellSchedules() (string, error) {
	return a.settings.BellSchedules, nil
}

// SelectWeeklyPlanFileDialog lets user pick a .hwp or .hwpx file directly
func (a *App) SelectWeeklyPlanFileDialog() (*WeeklyPlanResult, error) {
	filename, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "주학습계획안 파일 선택 (HWP, HWPX)",
		Filters: []runtime.FileFilter{
			{DisplayName: "주학습계획안 파일 (*.hwp, *.hwpx)", Pattern: "*.hwp;*.hwpx"},
		},
	})
	if err != nil || filename == "" {
		return nil, err
	}

	return a.ParseWeeklyPlanFile(filename)
}

// ParseWeeklyPlanFile executes the Python script to parse a HWP or HWPX file
func (a *App) ParseWeeklyPlanFile(filePath string) (*WeeklyPlanResult, error) {
	// Always write the latest embedded script to TempDir so that any stale or unpatched
	// script sitting in CWD / Program Files is never mistakenly executed.
	tempScript := filepath.Join(os.TempDir(), "classbook_parse_weekly_plan.py")
	scriptPath := tempScript
	if err := os.WriteFile(tempScript, embeddedWeeklyPlanScript, 0644); err != nil {
		cwd, _ := os.Getwd()
		scriptPath = filepath.Join(cwd, "parse_weekly_plan.py")
	} else {
		// Also update script in cwd if it exists and is writable
		cwd, _ := os.Getwd()
		localScript := filepath.Join(cwd, "parse_weekly_plan.py")
		if _, err := os.Stat(localScript); err == nil && cwd != "D:\\works\\classbook" {
			_ = os.WriteFile(localScript, embeddedWeeklyPlanScript, 0644)
		}
	}

	// Try finding python executable (python, py, python3)
	pyCandidates := []string{"python", "py", "python3"}
	var chosenCmd string
	var baseArgs []string
	for _, cand := range pyCandidates {
		if path, err := exec.LookPath(cand); err == nil {
			chosenCmd = path
			if cand == "py" {
				baseArgs = []string{"-3"}
			}
			break
		}
	}
	if chosenCmd == "" {
		chosenCmd = "python"
	}

	args := append(baseArgs, scriptPath, filePath)
	cmd := exec.Command(chosenCmd, args...)
	cmd.Dir = getAppDir()
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	var outBuf bytes.Buffer
	var errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf

	err := cmd.Run()
	if err != nil {
		errMsg := errBuf.String()
		if errMsg == "" {
			errMsg = err.Error()
		}
		return nil, fmt.Errorf("주학습계획안 분석 오류: %s", errMsg)
	}

	var result WeeklyPlanResult
	if err := json.Unmarshal(outBuf.Bytes(), &result); err != nil {
		return nil, fmt.Errorf("분석 결과 해석 오류: %v, 출력: %s", err, outBuf.String())
	}

	result.FilePath = filePath

	// Save to memory and cache file
	a.currentPlan = &result
	a.saveCurrentPlan()

	return &result, nil
}

// ReanalyzeWeeklyPlan forces re-parsing the current weekly plan file or the newest file in the watch folder
func (a *App) ReanalyzeWeeklyPlan() (*WeeklyPlanResult, error) {
	targetFile := ""
	if a.currentPlan != nil && a.currentPlan.FilePath != "" {
		targetFile = a.currentPlan.FilePath
	}
	if targetFile == "" && a.settings.LastPlanFile != "" {
		targetFile = a.settings.LastPlanFile
	}
	if targetFile == "" {
		watchFolder := a.settings.PlanWatchFolder
		if watchFolder != "" {
			entries, err := os.ReadDir(watchFolder)
			if err == nil {
				var latestMod time.Time
				for _, e := range entries {
					if !e.IsDir() {
						ext := strings.ToLower(filepath.Ext(e.Name()))
						if ext == ".hwp" || ext == ".hwpx" {
							if info, err := e.Info(); err == nil {
								if info.ModTime().After(latestMod) {
									latestMod = info.ModTime()
									targetFile = filepath.Join(watchFolder, e.Name())
								}
							}
						}
					}
				}
			}
		}
	}

	if targetFile == "" {
		return nil, fmt.Errorf("재인식할 주학습계획안 파일이 없습니다. [HWP / HWPX 파일 올리기]로 파일을 선택해주세요.")
	}

	result, err := a.ParseWeeklyPlanFile(targetFile)
	if err != nil {
		return nil, err
	}

	a.settings.LastPlanFile = targetFile
	if info, err := os.Stat(targetFile); err == nil {
		a.settings.LastPlanModTime = info.ModTime()
	}
	a.saveSettings()

	// Notify frontend
	runtime.EventsEmit(a.ctx, "weekly-plan-updated", result)

	return result, nil
}

// GetLatestWeeklyPlan returns the currently parsed weekly plan
func (a *App) GetLatestWeeklyPlan() (*WeeklyPlanResult, error) {
	if a.currentPlan != nil {
		return a.currentPlan, nil
	}
	return a.loadLatestPlan()
}

// GetWeeklyPlanRawBase64 reads the latest weekly plan file and returns its base64 content
func (a *App) GetWeeklyPlanRawBase64(customPath string) (string, error) {
	targetPath := customPath
	if targetPath == "" && a.currentPlan != nil && a.currentPlan.FilePath != "" {
		targetPath = a.currentPlan.FilePath
	}
	if targetPath == "" {
		targetPath = a.settings.LastPlanFile
	}
	// Verify if targetPath actually exists on disk
	if targetPath != "" {
		if _, err := os.Stat(targetPath); err != nil {
			targetPath = ""
		}
	}
	if targetPath == "" {
		// Fallback 1: Watch folder latest file
		watchFolder := a.settings.PlanWatchFolder
		if watchFolder != "" {
			entries, err := os.ReadDir(watchFolder)
			if err == nil {
				var latestFile string
				var latestMod time.Time
				for _, e := range entries {
					if !e.IsDir() {
						ext := strings.ToLower(filepath.Ext(e.Name()))
						if ext == ".hwp" || ext == ".hwpx" {
							if info, err := e.Info(); err == nil {
								if info.ModTime().After(latestMod) {
									latestMod = info.ModTime()
									latestFile = filepath.Join(watchFolder, e.Name())
								}
							}
						}
					}
				}
				if latestFile != "" {
					targetPath = latestFile
				}
			}
		}
	}

	if targetPath == "" {
		// Fallback 2: Known common cloud/backup directory
		fallbackDir := `N:\개인\daumcloud\2026년\05 주학습계획안`
		if entries, err := os.ReadDir(fallbackDir); err == nil {
			var latestFile string
			var latestMod time.Time
			for _, e := range entries {
				if !e.IsDir() {
					ext := strings.ToLower(filepath.Ext(e.Name()))
					if ext == ".hwp" || ext == ".hwpx" {
						if info, err := e.Info(); err == nil {
							if info.ModTime().After(latestMod) {
								latestMod = info.ModTime()
								latestFile = filepath.Join(fallbackDir, e.Name())
							}
						}
					}
				}
			}
			if latestFile != "" {
				targetPath = latestFile
			}
		}
	}

	if targetPath == "" {
		return "", fmt.Errorf("주학습계획안 파일(HWP/HWPX)을 찾을 수 없습니다. 파일을 등록해주세요")
	}

	if _, err := os.Stat(targetPath); err != nil {
		return "", fmt.Errorf("파일을 찾을 수 없습니다: %s", targetPath)
	}

	data, err := os.ReadFile(targetPath)
	if err != nil {
		return "", fmt.Errorf("파일 읽기 실패: %v", err)
	}

	// Update cached file path in memory & settings
	if a.currentPlan != nil && a.currentPlan.FilePath == "" {
		a.currentPlan.FilePath = targetPath
	}
	if a.settings.LastPlanFile == "" {
		a.settings.LastPlanFile = targetPath
		a.saveSettings()
	}

	return base64.StdEncoding.EncodeToString(data), nil
}

func (a *App) saveCurrentPlan() {
	if a.currentPlan == nil {
		return
	}
	data, err := json.MarshalIndent(a.currentPlan, "", "  ")
	if err != nil {
		return
	}

	appDir := getAppDir()
	_ = os.WriteFile(filepath.Join(appDir, "latest_weekly_plan.json"), data, 0644)

	cwd, errCwd := os.Getwd()
	if errCwd == nil && cwd != appDir {
		_ = os.WriteFile(filepath.Join(cwd, "latest_weekly_plan.json"), data, 0644)
	}
}

// SaveWeeklyPlan persists the weekly plan to disk (latest_weekly_plan.json) and updates memory
func (a *App) SaveWeeklyPlan(plan *WeeklyPlanResult) error {
	if plan == nil {
		return fmt.Errorf("plan is nil")
	}
	a.currentPlan = plan
	a.saveCurrentPlan()
	runtime.EventsEmit(a.ctx, "weekly-plan-updated", plan)
	return nil
}

func (a *App) loadLatestPlan() (*WeeklyPlanResult, error) {
	appDir := getAppDir()
	cacheFile := filepath.Join(appDir, "latest_weekly_plan.json")
	data, err := os.ReadFile(cacheFile)
	if err != nil {
		cwd, errCwd := os.Getwd()
		if errCwd == nil {
			cacheFile = filepath.Join(cwd, "latest_weekly_plan.json")
			data, err = os.ReadFile(cacheFile)
		}
	}
	if err != nil {
		return nil, err
	}
	var plan WeeklyPlanResult
	if err := json.Unmarshal(data, &plan); err != nil {
		return nil, err
	}
	if plan.FilePath == "" && a.settings.LastPlanFile != "" {
		plan.FilePath = a.settings.LastPlanFile
	}
	a.currentPlan = &plan
	return &plan, nil
}

// startPlanFolderWatcher monitors the designated folder for new or modified hwp/hwpx files
func (a *App) startPlanFolderWatcher() {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-a.watcherStopChan:
			return
		case <-ticker.C:
			watchFolder := a.settings.PlanWatchFolder
			if watchFolder == "" {
				continue
			}

			entries, err := os.ReadDir(watchFolder)
			if err != nil {
				continue
			}

			var latestFile string
			var latestModTime time.Time

			for _, entry := range entries {
				if entry.IsDir() {
					continue
				}
				ext := strings.ToLower(filepath.Ext(entry.Name()))
				if ext == ".hwp" || ext == ".hwpx" {
					info, err := entry.Info()
					if err != nil {
						continue
					}
					if info.ModTime().After(latestModTime) {
						latestModTime = info.ModTime()
						latestFile = filepath.Join(watchFolder, entry.Name())
					}
				}
			}

			// If a new or updated file is detected
			if latestFile != "" {
				if latestFile != a.settings.LastPlanFile || latestModTime.Unix() > a.settings.LastPlanModTime.Unix() {
					fmt.Printf("[FolderWatcher] New plan file detected: %s (mod: %v)\n", latestFile, latestModTime)

					// Allow file copying to complete
					time.Sleep(300 * time.Millisecond)

					result, err := a.ParseWeeklyPlanFile(latestFile)
					if err == nil && result.Success {
						a.settings.LastPlanFile = latestFile
						a.settings.LastPlanModTime = latestModTime
						a.saveSettings()

						// Notify frontend
						runtime.EventsEmit(a.ctx, "weekly-plan-updated", result)
					} else {
						fmt.Printf("[FolderWatcher] Failed to parse: %v\n", err)
					}
				}
			}
		}
	}
}
