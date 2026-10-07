package main

import (
	"bufio"
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
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"github.com/hashicorp/go-version"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/text/encoding/korean"
	"golang.org/x/text/transform"
)

//go:embed parse_weekly_plan.py
var embeddedWeeklyPlanScript []byte

//go:embed convert_pdf.py
var embeddedConvertPdfScript []byte

const AppVersion = "1.2.25"
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
	logToFile("app.startup called")

	// Load settings from application directory
	appDir := getAppDir()
	logToFile("app.startup: appDir = %s", appDir)
	a.settingsPath = filepath.Join(appDir, "settings.json")
	a.loadSettings()
	logToFile("app.startup: settings loaded (PlanWatchFolder=%s)", a.settings.PlanWatchFolder)

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
	logToFile("app.startup: loadLatestPlan completed")

	// Start folder watcher
	go a.startPlanFolderWatcher()
	logToFile("app.startup: folder watcher started")

	// Immediate check for updates after frontend is ready
	go func() {
		time.Sleep(2 * time.Second)
		logToFile("app.startup: running 2-second update check")
		status := a.CheckForUpdate()
		logToFile("app.startup: update check result: hasUpdate=%v, latest=%s", status != nil && status.HasUpdate, func() string { if status != nil { return status.LatestVer }; return "none" }())
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
	logToFile("DownloadAndInstallUpdate starting: url=%s, tag=%s", downloadUrl, tagName)
	tempDir := os.TempDir()
	cleanTag := strings.TrimPrefix(tagName, "v")
	installerPath := filepath.Join(tempDir, fmt.Sprintf("classbook-setup-v%s.exe", cleanTag))

	// Clean up previous temp installer
	os.Remove(installerPath)

	out, err := os.Create(installerPath)
	if err != nil {
		logToFile("Failed to create temp installer file: %v", err)
		return
	}
	defer out.Close()

	resp, err := http.Get(downloadUrl)
	if err != nil {
		logToFile("Failed to download installer: %v", err)
		return
	}
	defer resp.Body.Close()

	written, err := io.Copy(out, resp.Body)
	if err != nil {
		logToFile("Failed to save installer: %v", err)
		return
	}
	out.Close()
	logToFile("Installer downloaded successfully (%d bytes): %s", written, installerPath)

	// Launch installer silently (/S) with administrator privileges via PowerShell Start-Process
	// -Verb RunAs provides required UAC elevation without CreateProcess error 740
	// /S executes NSIS in silent mode without user intervention
	logToFile("Launching installer silently with RunAs: %s", installerPath)
	cmd := exec.Command("powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command",
		fmt.Sprintf("Start-Process -FilePath '%s' -ArgumentList '/S' -Verb RunAs", installerPath))
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP | 0x08000000, // CREATE_NO_WINDOW
	}
	err = cmd.Start()
	if err != nil {
		logToFile("Failed to start installer via PowerShell: %v", err)
		// Direct execution fallback with /S
		fallbackCmd := exec.Command(installerPath, "/S")
		fallbackCmd.SysProcAttr = &syscall.SysProcAttr{
			CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP,
		}
		fallbackCmd.Start()
	}

	// Grace period before current process exits so the installer can take over
	time.Sleep(1000 * time.Millisecond)
	logToFile("Exiting current process for installer takeover")
	os.Exit(0)
}

// GetAppVersion returns the current version string
func (a *App) GetAppVersion() string {
	return AppVersion
}

var (
	user32                     = syscall.NewLazyDLL("user32.dll")
	procReleaseCapture         = user32.NewProc("ReleaseCapture")
	procSendMessageW           = user32.NewProc("SendMessageW")
	procGetForegroundWindow    = user32.NewProc("GetForegroundWindow")
	kernel32                   = syscall.NewLazyDLL("kernel32.dll")
	procGetLogicalDrives       = kernel32.NewProc("GetLogicalDrives")
	procGetDriveTypeW          = kernel32.NewProc("GetDriveTypeW")
	procGetVolumeInformationW  = kernel32.NewProc("GetVolumeInformationW")
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

// DeleteMultipleBooks removes multiple books in batch
func (a *App) DeleteMultipleBooks(titles []string) error {
	imagesDir := getImagesDir()
	cleanImagesDir := filepath.Clean(imagesDir)

	for _, title := range titles {
		title = strings.TrimSpace(title)
		if title == "" {
			continue
		}
		bookDir := filepath.Clean(filepath.Join(cleanImagesDir, title))
		if strings.HasPrefix(bookDir, cleanImagesDir) && bookDir != cleanImagesDir {
			_ = os.RemoveAll(bookDir)
		}
	}
	return nil
}

// ==========================================
// USB & Textbook Auto-Discovery Features
// ==========================================

type UsbTextbookCandidate struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	Drive         string `json:"drive"`
	Type          string `json:"type"` // "image_folder" or "pdf"
	SourcePath    string `json:"sourcePath"`
	PageCount     int    `json:"pageCount"`
	FileSize      int64  `json:"fileSize"`
	FileSizeStr   string `json:"fileSizeStr"`
	Description   string `json:"description"`
	IsRecommended bool   `json:"isRecommended"`
}

var pageFilenameRegex = regexp.MustCompile(`^(?:p(?:age)?[-_]?)?0*(\d+)\.(?:jpg|jpeg|png|webp)$`)

func isPageFilename(name string) bool {
	return pageFilenameRegex.MatchString(strings.ToLower(name))
}

func decodeCP949(b []byte) string {
	r := transform.NewReader(bytes.NewReader(b), korean.EUCKR.NewDecoder())
	d, err := io.ReadAll(r)
	if err == nil {
		return string(d)
	}
	return string(b)
}

func formatCandidateFileSize(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}

func naturalSortFiles(files []string) {
	re := regexp.MustCompile(`\d+`)
	sort.Slice(files, func(i, j int) bool {
		a, b := files[i], files[j]
		numA := re.FindString(a)
		numB := re.FindString(b)
		if numA != "" && numB != "" && numA != numB {
			vA, errA := strconv.Atoi(numA)
			vB, errB := strconv.Atoi(numB)
			if errA == nil && errB == nil && vA != vB {
				return vA < vB
			}
		}
		return a < b
	})
}

func getVolumeLabel(root string) string {
	rootPtr, err := syscall.UTF16PtrFromString(root)
	if err != nil {
		return ""
	}
	var volNameBuf [260]uint16
	r, _, _ := procGetVolumeInformationW.Call(
		uintptr(unsafe.Pointer(rootPtr)),
		uintptr(unsafe.Pointer(&volNameBuf[0])),
		uintptr(len(volNameBuf)),
		0, 0, 0, 0, 0,
	)
	if r != 0 {
		return syscall.UTF16ToString(volNameBuf[:])
	}
	return ""
}

func scanFolderForCandidates(rootPath string, driveLabel string) []UsbTextbookCandidate {
	var candidates []UsbTextbookCandidate

	driveHint := ""
	autorunPath := filepath.Join(rootPath, "autorun.inf")
	if rawBytes, err := os.ReadFile(autorunPath); err == nil {
		decoded := decodeCP949(rawBytes)
		lines := strings.Split(decoded, "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(strings.ToUpper(line), "LABEL=") {
				driveHint = strings.TrimSpace(line[6:])
			}
		}
	}
	if driveHint == "" {
		if entries, err := os.ReadDir(rootPath); err == nil {
			for _, e := range entries {
				if !e.IsDir() && strings.EqualFold(filepath.Ext(e.Name()), ".exe") {
					name := strings.TrimSuffix(e.Name(), filepath.Ext(e.Name()))
					name = strings.ReplaceAll(name, "_전자저작물", "")
					name = strings.ReplaceAll(name, "_DVD", "")
					name = strings.ReplaceAll(name, "_", " ")
					driveHint = strings.TrimSpace(name)
					break
				}
			}
		}
	}

	_ = filepath.Walk(rootPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		rel, _ := filepath.Rel(rootPath, path)
		depth := strings.Count(rel, string(os.PathSeparator))
		if depth > 6 {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		nameLower := strings.ToLower(info.Name())
		pathLower := strings.ToLower(path)

		if info.IsDir() {
			if strings.HasPrefix(nameLower, "$") || nameLower == "system volume information" ||
				nameLower == "node_modules" || strings.HasPrefix(nameLower, "jre") ||
				nameLower == "fonts" || strings.Contains(pathLower, "popup") ||
				strings.Contains(pathLower, "quiz") || strings.Contains(pathLower, "media") ||
				strings.Contains(pathLower, "chapters") || strings.Contains(pathLower, "assets") ||
				strings.Contains(pathLower, "common\\images") || strings.Contains(pathLower, "common/images") ||
				strings.Contains(pathLower, "libs") {
				return filepath.SkipDir
			}

			entries, errRead := os.ReadDir(path)
			if errRead == nil {
				var imgFiles []string
				pageLikeCount := 0
				for _, e := range entries {
					if !e.IsDir() {
						ext := strings.ToLower(filepath.Ext(e.Name()))
						if ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".webp" {
							imgFiles = append(imgFiles, e.Name())
							if isPageFilename(e.Name()) {
								pageLikeCount++
							}
						}
					}
				}

				if len(imgFiles) >= 20 && float64(pageLikeCount)/float64(len(imgFiles)) >= 0.7 {
					if !strings.Contains(nameLower, "btn") && !strings.Contains(nameLower, "icon") &&
						!strings.Contains(nameLower, "thumb") {
						naturalSortFiles(imgFiles)

						title := info.Name()
						isRecommended := false
						if strings.EqualFold(title, "pp_print") || strings.EqualFold(title, "print") {
							title = "교과서 (인쇄용 원본)"
							if driveHint != "" {
								title = fmt.Sprintf("%s (인쇄용 교과서)", driveHint)
							}
							isRecommended = true
						} else if strings.EqualFold(title, "pp_bg") || strings.EqualFold(title, "bg") {
							title = "교과서 (전자책 배경)"
							if driveHint != "" {
								title = fmt.Sprintf("%s (전자책 배경)", driveHint)
							}
						} else if driveHint != "" {
							title = fmt.Sprintf("%s (%s)", driveHint, title)
						}

						desc := fmt.Sprintf("%s ~ %s (%d장)", imgFiles[0], imgFiles[len(imgFiles)-1], len(imgFiles))
						if isRecommended {
							desc += " [추천: 고화질 인쇄 원본]"
						}

						candidates = append(candidates, UsbTextbookCandidate{
							ID:            fmt.Sprintf("img_%s", filepath.Base(path)),
							Title:         title,
							Drive:         driveLabel,
							Type:          "image_folder",
							SourcePath:    path,
							PageCount:     len(imgFiles),
							FileSize:      0,
							FileSizeStr:   fmt.Sprintf("%d 쪽", len(imgFiles)),
							Description:   desc,
							IsRecommended: isRecommended,
						})
					}
				}
			}
			return nil
		}

		if strings.EqualFold(filepath.Ext(path), ".pdf") {
			if strings.Contains(pathLower, "popup") || strings.Contains(nameLower, "사용설명서") ||
				strings.Contains(nameLower, "license") || strings.Contains(nameLower, "매뉴얼") ||
				strings.Contains(nameLower, "출처") || strings.Contains(nameLower, "연간지도계획") {
				return nil
			}
			isTextbookName := strings.Contains(nameLower, "교과서") || strings.Contains(nameLower, "지도서") ||
				strings.Contains(nameLower, "익힘") || strings.Contains(nameLower, "활동") || strings.Contains(nameLower, "수익")

			if info.Size() > 15*1024*1024 || isTextbookName {
				cleanTitle := strings.TrimSuffix(info.Name(), filepath.Ext(info.Name()))
				candidates = append(candidates, UsbTextbookCandidate{
					ID:            fmt.Sprintf("pdf_%s", cleanTitle),
					Title:         cleanTitle,
					Drive:         driveLabel,
					Type:          "pdf",
					SourcePath:    path,
					PageCount:     0,
					FileSize:      info.Size(),
					FileSizeStr:   formatCandidateFileSize(info.Size()),
					Description:   fmt.Sprintf("교과서 PDF 파일 (%s)", formatCandidateFileSize(info.Size())),
					IsRecommended: false,
				})
			}
		}
		return nil
	})

	return candidates
}

// ScanUsbTextbooks automatically detects connected USB drives and scans for textbook materials
func (a *App) ScanUsbTextbooks() ([]UsbTextbookCandidate, error) {
	mask, _, _ := procGetLogicalDrives.Call()
	var allCandidates []UsbTextbookCandidate

	for i := 0; i < 26; i++ {
		if (mask & (1 << i)) != 0 {
			letter := string(rune('A' + i))
			root := letter + ":\\"

			rootPtr, err := syscall.UTF16PtrFromString(root)
			if err != nil {
				continue
			}
			dt, _, _ := procGetDriveTypeW.Call(uintptr(unsafe.Pointer(rootPtr)))

			// Check if Removable (2) or CD-ROM (5)
			if dt == 2 || dt == 5 {
				vol := strings.ToUpper(getVolumeLabel(root))
				// Skip cloud virtual mounted drives
				if strings.Contains(vol, "MYBOX") || strings.Contains(vol, "GOOGLE") ||
					strings.Contains(vol, "ONEDRIVE") || strings.Contains(vol, "DROPBOX") ||
					strings.Contains(vol, "ICLOUD") {
					continue
				}

				driveLabel := fmt.Sprintf("%s (%s)", root, vol)
				if vol == "" {
					driveLabel = root
				}

				found := scanFolderForCandidates(root, driveLabel)
				allCandidates = append(allCandidates, found...)
			}
		}
	}

	// Sort candidates: recommended first, then image_folder, then pdf
	sort.SliceStable(allCandidates, func(i, j int) bool {
		if allCandidates[i].IsRecommended != allCandidates[j].IsRecommended {
			return allCandidates[i].IsRecommended
		}
		if allCandidates[i].Type != allCandidates[j].Type {
			return allCandidates[i].Type == "image_folder"
		}
		return allCandidates[i].Title < allCandidates[j].Title
	})

	return allCandidates, nil
}

// ScanFolderForTextbooks scans a specific user-selected folder or drive
func (a *App) ScanFolderForTextbooks(folderPath string) ([]UsbTextbookCandidate, error) {
	if strings.TrimSpace(folderPath) == "" {
		return nil, fmt.Errorf("폴더 경로가 비어있습니다")
	}
	candidates := scanFolderForCandidates(folderPath, folderPath)
	return candidates, nil
}

// SelectDirectoryDialog opens a native folder selection dialog
func (a *App) SelectDirectoryDialog(title string) (string, error) {
	if title == "" {
		title = "폴더 선택"
	}
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: title,
	})
}

// ImportBookFromImageFolder imports sequential page images from a folder directly into textbook storage
func (a *App) ImportBookFromImageFolder(title string, folderPath string, pageOffset int) error {
	title = strings.TrimSpace(title)
	if title == "" {
		return fmt.Errorf("교과서 제목이 비어있습니다")
	}
	// Sanitize title for valid directory name
	reg := regexp.MustCompile(`[\\/:*?"<>|]`)
	title = reg.ReplaceAllString(title, "_")

	imagesDir := getImagesDir()
	bookDir := filepath.Join(imagesDir, title)
	if err := os.MkdirAll(bookDir, 0755); err != nil {
		return fmt.Errorf("교과서 폴더 생성 실패: %w", err)
	}

	entries, err := os.ReadDir(folderPath)
	if err != nil {
		return fmt.Errorf("폴더 읽기 실패: %w", err)
	}

	var imgFiles []string
	for _, e := range entries {
		if !e.IsDir() {
			ext := strings.ToLower(filepath.Ext(e.Name()))
			if ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".webp" {
				imgFiles = append(imgFiles, e.Name())
			}
		}
	}

	if len(imgFiles) == 0 {
		return fmt.Errorf("폴더 내에 이미지 파일이 없습니다")
	}

	naturalSortFiles(imgFiles)

	for idx, imgName := range imgFiles {
		srcPath := filepath.Join(folderPath, imgName)
		dstPath := filepath.Join(bookDir, fmt.Sprintf("page_%d.jpg", idx+1))

		srcFile, err := os.Open(srcPath)
		if err != nil {
			return fmt.Errorf("이미지 읽기 실패 (%s): %w", imgName, err)
		}
		dstFile, err := os.Create(dstPath)
		if err != nil {
			srcFile.Close()
			return fmt.Errorf("이미지 저장 실패 (%s): %w", dstPath, err)
		}
		_, err = io.Copy(dstFile, srcFile)
		srcFile.Close()
		dstFile.Close()
		if err != nil {
			return fmt.Errorf("이미지 복사 실패: %w", err)
		}

		pct := int(float64(idx+1) / float64(len(imgFiles)) * 100)
		runtime.EventsEmit(a.ctx, "convert-progress", map[string]interface{}{
			"current":        idx + 1,
			"total":          len(imgFiles),
			"percent":        pct,
			"title":          title,
			"statusText":     fmt.Sprintf("페이지 복사 중 (%d/%d쪽)", idx+1, len(imgFiles)),
			"detectedOffset": "",
		})
	}

	return a.EnsureBookDirWithOffset(title, len(imgFiles), pageOffset)
}

type PdfConvertResult struct {
	Success        bool   `json:"success"`
	Title          string `json:"title"`
	NumPages       int    `json:"numPages"`
	DetectedOffset int    `json:"detectedOffset"`
	Error          string `json:"error,omitempty"`
}

// ConvertPdfToBook uses python/fitz to extract PDF pages with live progress events
func (a *App) ConvertPdfToBook(title string, pdfPath string) (*PdfConvertResult, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return nil, fmt.Errorf("교과서 제목이 비어있습니다")
	}
	reg := regexp.MustCompile(`[\\/:*?"<>|]`)
	title = reg.ReplaceAllString(title, "_")

	imagesDir := getImagesDir()
	bookDir := filepath.Join(imagesDir, title)
	if err := os.MkdirAll(bookDir, 0755); err != nil {
		return nil, fmt.Errorf("교과서 폴더 생성 실패: %w", err)
	}

	// Prepare convert_pdf.py script
	appDir := getAppDir()
	scriptPath := filepath.Join(appDir, "convert_pdf.py")
	if _, err := os.Stat(scriptPath); err != nil || len(embeddedConvertPdfScript) > 0 {
		_ = os.WriteFile(scriptPath, embeddedConvertPdfScript, 0644)
	}

	// Find python executable with fitz
	pyCandidates := []string{"python", "py", "python3"}
	chosenCmd := ""
	for _, cmdName := range pyCandidates {
		testCmd := exec.Command(cmdName, "-c", "import fitz; print('OK')")
		testCmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000} // CREATE_NO_WINDOW
		out, err := testCmd.Output()
		if err == nil && strings.Contains(string(out), "OK") {
			chosenCmd = cmdName
			break
		}
	}

	if chosenCmd == "" {
		return nil, fmt.Errorf("PyMuPDF (fitz) 지원 Python이 감지되지 않았습니다")
	}

	cmd := exec.Command(chosenCmd, scriptPath, pdfPath, bookDir, title)
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000} // CREATE_NO_WINDOW

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("프로세스 파이프 생성 실패: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("PDF 변환 프로세스 시작 실패: %w", err)
	}

	total := 1
	finalOffset := 0
	scanner := bufio.NewScanner(stdoutPipe)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "INIT:") {
			parts := strings.Split(line, ":")
			if len(parts) >= 2 {
				if t, err := strconv.Atoi(parts[1]); err == nil && t > 0 {
					total = t
				}
			}
		} else if strings.HasPrefix(line, "PROGRESS:") {
			parts := strings.Split(line, ":")
			if len(parts) >= 4 {
				curr, _ := strconv.Atoi(parts[1])
				tot, _ := strconv.Atoi(parts[2])
				pct, _ := strconv.Atoi(parts[3])
				offsetStr := ""
				if len(parts) >= 5 {
					offsetStr = parts[4]
				}
				status := fmt.Sprintf("페이지 이미지 추출 중 (%d/%d쪽)", curr, tot)
				if offsetStr != "" {
					status = fmt.Sprintf("페이지 추출 중 (%d/%d쪽, 오프셋 감지: %s)", curr, tot, offsetStr)
				}
				runtime.EventsEmit(a.ctx, "convert-progress", map[string]interface{}{
					"current":        curr,
					"total":          tot,
					"percent":        pct,
					"title":          title,
					"statusText":     status,
					"detectedOffset": offsetStr,
				})
			}
		} else if strings.HasPrefix(line, "DONE:") {
			parts := strings.Split(line, ":")
			if len(parts) >= 3 {
				t, _ := strconv.Atoi(parts[1])
				off, _ := strconv.Atoi(parts[2])
				if t > 0 {
					total = t
				}
				finalOffset = off
			}
		}
	}

	if err := cmd.Wait(); err != nil {
		return nil, fmt.Errorf("PDF 변환 실패: %w", err)
	}

	_ = a.EnsureBookDirWithOffset(title, total, finalOffset)

	return &PdfConvertResult{
		Success:        true,
		Title:          title,
		NumPages:       total,
		DetectedOffset: finalOffset,
	}, nil
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
	Success   bool                        `json:"success"`
	Title     string                      `json:"title"`
	FilePath  string                      `json:"filePath"`
	StartDate string                      `json:"startDate,omitempty"`
	EndDate   string                      `json:"endDate,omitempty"`
	WeekRange string                      `json:"weekRange,omitempty"`
	WeekDates map[string]string           `json:"weekDates,omitempty"`
	Schedule  map[string][]WeeklyPlanItem `json:"schedule"`
	Error     string                      `json:"error,omitempty"`
}

type WeeklyPlanSummary struct {
	FilePath  string `json:"filePath"`
	Title     string `json:"title"`
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
	WeekRange string `json:"weekRange"`
	IsCurrent bool   `json:"isCurrent"`
}

var (
	hwpDateRegex1 = regexp.MustCompile(`(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\.?\s*[~∼\-]\s*(?:(\d{4})[.\-/])?(\d{1,2})[.\-/](\d{1,2})\.?`)
	hwpDateRegex2 = regexp.MustCompile(`(\d{1,2})[월.\-/](\d{1,2})일?\.?\s*[~∼\-]\s*(\d{1,2})[월.\-/](\d{1,2})일?\.?`)
)

func parseDateRangeFromFilename(name string) (startDate, endDate, weekRange string) {
	m1 := hwpDateRegex1.FindStringSubmatch(name)
	if len(m1) >= 7 {
		y1, m1Val, d1 := m1[1], m1[2], m1[3]
		y2 := m1[4]
		if y2 == "" {
			y2 = y1
		}
		m2Val, d2 := m1[5], m1[6]
		y1Int, _ := strconv.Atoi(y1)
		m1Int, _ := strconv.Atoi(m1Val)
		d1Int, _ := strconv.Atoi(d1)
		y2Int, _ := strconv.Atoi(y2)
		m2Int, _ := strconv.Atoi(m2Val)
		d2Int, _ := strconv.Atoi(d2)

		startDate = fmt.Sprintf("%04d-%02d-%02d", y1Int, m1Int, d1Int)
		endDate = fmt.Sprintf("%04d-%02d-%02d", y2Int, m2Int, d2Int)
		weekRange = fmt.Sprintf("%04d.%02d.%02d. ~ %04d.%02d.%02d.", y1Int, m1Int, d1Int, y2Int, m2Int, d2Int)
		return
	}
	m2 := hwpDateRegex2.FindStringSubmatch(name)
	if len(m2) >= 5 {
		currYear := time.Now().Year()
		m1Int, _ := strconv.Atoi(m2[1])
		d1Int, _ := strconv.Atoi(m2[2])
		m2Int, _ := strconv.Atoi(m2[3])
		d2Int, _ := strconv.Atoi(m2[4])
		startDate = fmt.Sprintf("%04d-%02d-%02d", currYear, m1Int, d1Int)
		endDate = fmt.Sprintf("%04d-%02d-%02d", currYear, m2Int, d2Int)
		weekRange = fmt.Sprintf("%04d.%02d.%02d. ~ %04d.%02d.%02d.", currYear, m1Int, d1Int, currYear, m2Int, d2Int)
		return
	}
	return "", "", ""
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

// GetWeeklyPlanList returns all available weekly plans in the watch folder, sorted chronologically with isCurrent marked
func (a *App) GetWeeklyPlanList() ([]WeeklyPlanSummary, error) {
	watchFolder := a.settings.PlanWatchFolder
	var foldersToScan []string
	if watchFolder != "" {
		foldersToScan = append(foldersToScan, watchFolder)
	}
	appDir := getAppDir()
	defaultFolder := filepath.Join(appDir, "weekly_plans")
	if defaultFolder != watchFolder {
		foldersToScan = append(foldersToScan, defaultFolder)
	}
	fallbackCloud := `N:\개인\daumcloud\2026년\05 주학습계획안`
	if fallbackCloud != watchFolder {
		if _, err := os.Stat(fallbackCloud); err == nil {
			foldersToScan = append(foldersToScan, fallbackCloud)
		}
	}

	seenPaths := make(map[string]bool)
	var list []WeeklyPlanSummary

	today := time.Now()
	todayStr := today.Format("2006-01-02")

	for _, folder := range foldersToScan {
		entries, err := os.ReadDir(folder)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			ext := strings.ToLower(filepath.Ext(e.Name()))
			if ext != ".hwp" && ext != ".hwpx" {
				continue
			}
			fullPath := filepath.Join(folder, e.Name())
			if seenPaths[fullPath] {
				continue
			}
			seenPaths[fullPath] = true

			title := strings.TrimSuffix(e.Name(), filepath.Ext(e.Name()))
			startDate, endDate, weekRange := parseDateRangeFromFilename(e.Name())

			isCurrent := false
			if startDate != "" && endDate != "" {
				isCurrent = (todayStr >= startDate && todayStr <= endDate)
			}

			list = append(list, WeeklyPlanSummary{
				FilePath:  fullPath,
				Title:     title,
				StartDate: startDate,
				EndDate:   endDate,
				WeekRange: weekRange,
				IsCurrent: isCurrent,
			})
		}
		// If we found files in the primary watch folder, prefer it
		if len(list) > 0 && folder == watchFolder {
			break
		}
	}

	// Sort chronologically by StartDate ascending, fallback to title
	sort.Slice(list, func(i, j int) bool {
		if list[i].StartDate != "" && list[j].StartDate != "" {
			if list[i].StartDate != list[j].StartDate {
				return list[i].StartDate < list[j].StartDate
			}
		} else if list[i].StartDate != "" {
			return true
		} else if list[j].StartDate != "" {
			return false
		}
		return list[i].Title < list[j].Title
	})

	// If no plan matches today exactly (e.g. weekend or date formatting edge cases),
	// check if any plan covers the current Monday
	hasCurrent := false
	for _, p := range list {
		if p.IsCurrent {
			hasCurrent = true
			break
		}
	}
	if !hasCurrent && len(list) > 0 {
		weekday := int(today.Weekday()) // 0 Sun, 1 Mon ...
		offset := (weekday + 6) % 7
		thisMonday := today.AddDate(0, 0, -offset).Format("2006-01-02")
		for idx := range list {
			if list[idx].StartDate != "" && list[idx].StartDate <= thisMonday && list[idx].EndDate >= thisMonday {
				list[idx].IsCurrent = true
				hasCurrent = true
				break
			}
		}
		// If still none, check closest past plan
		if !hasCurrent {
			for idx := range list {
				if list[idx].StartDate != "" && list[idx].StartDate <= todayStr {
					list[idx].IsCurrent = true
					break
				}
			}
		}
	}

	return list, nil
}

// GetWeeklyPlanByPath parses and loads a specific weekly plan file
func (a *App) GetWeeklyPlanByPath(filePath string) (*WeeklyPlanResult, error) {
	if filePath == "" {
		return nil, fmt.Errorf("file path is empty")
	}
	res, err := a.ParseWeeklyPlanFile(filePath)
	if err != nil {
		return nil, err
	}
	a.currentPlan = res
	a.settings.LastPlanFile = filePath
	if info, err := os.Stat(filePath); err == nil {
		a.settings.LastPlanModTime = info.ModTime()
	}
	a.saveSettings()
	a.saveCurrentPlan()
	return res, nil
}

// ReanalyzeWeeklyPlan forces re-parsing the current weekly plan file or date-based plan
func (a *App) ReanalyzeWeeklyPlan() (*WeeklyPlanResult, error) {
	if a.currentPlan != nil && a.currentPlan.FilePath != "" {
		if _, err := os.Stat(a.currentPlan.FilePath); err == nil {
			return a.GetWeeklyPlanByPath(a.currentPlan.FilePath)
		}
	}
	return a.GetLatestWeeklyPlan()
}

// GetLatestWeeklyPlan returns the plan matching TODAY'S DATE (date-based), or current in-memory plan
func (a *App) GetLatestWeeklyPlan() (*WeeklyPlanResult, error) {
	todayStr := time.Now().Format("2006-01-02")

	// 1. If in-memory currentPlan already matches today's date range, return it
	if a.currentPlan != nil && a.currentPlan.Success {
		if a.currentPlan.StartDate != "" && a.currentPlan.EndDate != "" {
			if todayStr >= a.currentPlan.StartDate && todayStr <= a.currentPlan.EndDate {
				return a.currentPlan, nil
			}
		}
	}

	// 2. Date-based: Scan watch folder for the plan matching today's date!
	plans, err := a.GetWeeklyPlanList()
	if err == nil && len(plans) > 0 {
		for _, p := range plans {
			if p.IsCurrent {
				res, errParse := a.ParseWeeklyPlanFile(p.FilePath)
				if errParse == nil && res.Success {
					a.currentPlan = res
					a.settings.LastPlanFile = p.FilePath
					if info, errStat := os.Stat(p.FilePath); errStat == nil {
						a.settings.LastPlanModTime = info.ModTime()
					}
					a.saveSettings()
					a.saveCurrentPlan()
					return res, nil
				}
			}
		}
	}

	// 3. Fallback: if in-memory currentPlan exists, return it
	if a.currentPlan != nil {
		return a.currentPlan, nil
	}

	// 4. Fallback: cached latest_weekly_plan.json
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

	var lastFolderSig string

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

			var b strings.Builder
			for _, entry := range entries {
				if entry.IsDir() {
					continue
				}
				ext := strings.ToLower(filepath.Ext(entry.Name()))
				if ext == ".hwp" || ext == ".hwpx" {
					if info, err := entry.Info(); err == nil {
						b.WriteString(fmt.Sprintf("%s:%d;", entry.Name(), info.ModTime().UnixNano()))
					}
				}
			}

			sig := b.String()
			if sig != "" && sig != lastFolderSig {
				isInitial := (lastFolderSig == "")
				lastFolderSig = sig

				if !isInitial {
					fmt.Printf("[FolderWatcher] Watch folder changed: %s\n", watchFolder)
					// Allow file copying to complete
					time.Sleep(300 * time.Millisecond)

					// Date-based: Load the plan matching today's date!
					result, err := a.GetLatestWeeklyPlan()
					if err == nil && result != nil && result.Success {
						runtime.EventsEmit(a.ctx, "weekly-plan-updated", result)
					}
					runtime.EventsEmit(a.ctx, "weekly-plans-list-changed", true)
				}
			}
		}
	}
}
