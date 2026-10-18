package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	_ "modernc.org/sqlite"
)

// WeeklyPlanDB manages SQLite persistence for parsed and customized weekly lesson plans.
// It ensures original HWP/HWPX files are never altered while allowing teachers to flexibly
// customize, swap, and reorder class periods with automatic persistence.
type WeeklyPlanDB struct {
	db     *sql.DB
	dbPath string
	mu     sync.RWMutex
}

func initWeeklyPlanDB() (*WeeklyPlanDB, error) {
	appDir := getAppDir()
	dbDir := appDir

	// Test if directory is writable (e.g. outside Program Files), otherwise fallback to UserConfigDir
	testFile := filepath.Join(dbDir, ".db_write_test")
	if err := os.WriteFile(testFile, []byte("1"), 0644); err != nil {
		if appData, errData := os.UserConfigDir(); errData == nil {
			dbDir = filepath.Join(appData, "neohum", "Classbook")
			_ = os.MkdirAll(dbDir, 0755)
		}
	} else {
		_ = os.Remove(testFile)
	}

	dbPath := filepath.Join(dbDir, "classbook_plans.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("SQLite 데이터베이스 열기 실패 (%s): %w", dbPath, err)
	}

	// Performance and reliability pragmas
	_, _ = db.Exec("PRAGMA journal_mode=WAL;")
	_, _ = db.Exec("PRAGMA busy_timeout=5000;")
	_, _ = db.Exec("PRAGMA foreign_keys=ON;")

	createTablesSQL := `
	CREATE TABLE IF NOT EXISTS weekly_plans (
		file_path TEXT PRIMARY KEY,
		title TEXT,
		start_date TEXT,
		end_date TEXT,
		week_range TEXT,
		week_dates_json TEXT,
		schedule_json TEXT,
		is_customized INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS weekly_plan_items (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		file_path TEXT,
		day TEXT,
		period INTEGER,
		subject TEXT,
		matched_book_id TEXT,
		topic TEXT,
		page_str TEXT,
		start_page INTEGER,
		end_page INTEGER,
		raw TEXT,
		FOREIGN KEY (file_path) REFERENCES weekly_plans(file_path) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_plan_items_slot ON weekly_plan_items(file_path, day, period);
	`

	if _, err := db.Exec(createTablesSQL); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("SQLite 테이블 생성 실패: %w", err)
	}

	return &WeeklyPlanDB{
		db:     db,
		dbPath: dbPath,
	}, nil
}

// Close closes the underlying SQLite database connection
func (p *WeeklyPlanDB) Close() error {
	if p == nil || p.db == nil {
		return nil
	}
	return p.db.Close()
}

// SavePlan writes or updates a weekly plan into SQLite
func (p *WeeklyPlanDB) SavePlan(plan *WeeklyPlanResult, isCustomized bool) error {
	if p == nil || p.db == nil || plan == nil {
		return fmt.Errorf("database or plan is nil")
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	weekDatesJSON, _ := json.Marshal(plan.WeekDates)
	scheduleJSON, _ := json.Marshal(plan.Schedule)

	customVal := 0
	if isCustomized || plan.IsCustomized {
		customVal = 1
	}

	tx, err := p.db.Begin()
	if err != nil {
		return fmt.Errorf("transaction begin failed: %w", err)
	}
	defer tx.Rollback()

	upsertPlanSQL := `
	INSERT INTO weekly_plans (file_path, title, start_date, end_date, week_range, week_dates_json, schedule_json, is_customized, updated_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
	ON CONFLICT(file_path) DO UPDATE SET
		title = excluded.title,
		start_date = excluded.start_date,
		end_date = excluded.end_date,
		week_range = excluded.week_range,
		week_dates_json = excluded.week_dates_json,
		schedule_json = excluded.schedule_json,
		is_customized = excluded.is_customized,
		updated_at = CURRENT_TIMESTAMP;
	`

	_, err = tx.Exec(upsertPlanSQL,
		plan.FilePath,
		plan.Title,
		plan.StartDate,
		plan.EndDate,
		plan.WeekRange,
		string(weekDatesJSON),
		string(scheduleJSON),
		customVal,
	)
	if err != nil {
		return fmt.Errorf("failed to save weekly_plan row: %w", err)
	}

	// Delete existing items and re-insert normalized rows
	_, err = tx.Exec("DELETE FROM weekly_plan_items WHERE file_path = ?", plan.FilePath)
	if err != nil {
		return fmt.Errorf("failed to clear weekly_plan_items: %w", err)
	}

	insertItemSQL := `
	INSERT INTO weekly_plan_items (file_path, day, period, subject, matched_book_id, topic, page_str, start_page, end_page, raw)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
	`
	stmt, err := tx.Prepare(insertItemSQL)
	if err != nil {
		return fmt.Errorf("failed to prepare item insert: %w", err)
	}
	defer stmt.Close()

	for day, items := range plan.Schedule {
		for _, it := range items {
			_, err = stmt.Exec(
				plan.FilePath,
				day,
				it.Period,
				it.Subject,
				it.MatchedBookId,
				it.Topic,
				it.PageStr,
				it.StartPage,
				it.EndPage,
				it.Raw,
			)
			if err != nil {
				return fmt.Errorf("failed to insert item for %s period %d: %w", day, it.Period, err)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	plan.IsCustomized = (customVal == 1)
	return nil
}

// GetPlan retrieves a plan by file path from SQLite
func (p *WeeklyPlanDB) GetPlan(filePath string) (*WeeklyPlanResult, bool, error) {
	if p == nil || p.db == nil || filePath == "" {
		return nil, false, nil
	}

	p.mu.RLock()
	defer p.mu.RUnlock()

	row := p.db.QueryRow(`
		SELECT file_path, title, start_date, end_date, week_range, week_dates_json, schedule_json, is_customized
		FROM weekly_plans
		WHERE file_path = ?
	`, filePath)

	var (
		fp, title, startDate, endDate, weekRange, weekDatesJSON, scheduleJSON string
		isCustomizedInt                                                       int
	)

	err := row.Scan(&fp, &title, &startDate, &endDate, &weekRange, &weekDatesJSON, &scheduleJSON, &isCustomizedInt)
	if err == sql.ErrNoRows {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("failed to scan weekly plan: %w", err)
	}

	var weekDates map[string]string
	if weekDatesJSON != "" {
		_ = json.Unmarshal([]byte(weekDatesJSON), &weekDates)
	}

	var schedule map[string][]WeeklyPlanItem
	if scheduleJSON != "" {
		_ = json.Unmarshal([]byte(scheduleJSON), &schedule)
	}
	if schedule == nil {
		schedule = make(map[string][]WeeklyPlanItem)
	}

	plan := &WeeklyPlanResult{
		Success:      true,
		Title:        title,
		FilePath:     fp,
		StartDate:    startDate,
		EndDate:      endDate,
		WeekRange:    weekRange,
		WeekDates:    weekDates,
		Schedule:     schedule,
		IsCustomized: isCustomizedInt == 1,
	}

	return plan, true, nil
}

// SwapSlots exchanges the lessons between two periods/days in SQLite
func (p *WeeklyPlanDB) SwapSlots(plan *WeeklyPlanResult, dayA string, periodA int, dayB string, periodB int) (*WeeklyPlanResult, error) {
	if plan == nil {
		return nil, fmt.Errorf("plan is nil")
	}
	if plan.Schedule == nil {
		plan.Schedule = make(map[string][]WeeklyPlanItem)
	}

	// Locate item in slot A
	itemsA := plan.Schedule[dayA]
	var itemA *WeeklyPlanItem
	idxA := -1
	for i, it := range itemsA {
		if it.Period == periodA {
			itemA = &itemsA[i]
			idxA = i
			break
		}
	}

	// Locate item in slot B
	itemsB := plan.Schedule[dayB]
	var itemB *WeeklyPlanItem
	idxB := -1
	for i, it := range itemsB {
		if it.Period == periodB {
			itemB = &itemsB[i]
			idxB = i
			break
		}
	}

	// Clone items to avoid reference collision
	var copyA, copyB *WeeklyPlanItem
	if itemA != nil {
		cA := *itemA
		copyA = &cA
	}
	if itemB != nil {
		cB := *itemB
		copyB = &cB
	}

	// Perform the swap:
	// slot A gets copyB (with period set to periodA)
	// slot B gets copyA (with period set to periodB)

	if dayA == dayB {
		// Same day swap
		newDayItems := make([]WeeklyPlanItem, 0, len(itemsA))
		for _, it := range itemsA {
			if it.Period == periodA {
				if copyB != nil {
					copyB.Period = periodA
					newDayItems = append(newDayItems, *copyB)
				}
			} else if it.Period == periodB {
				if copyA != nil {
					copyA.Period = periodB
					newDayItems = append(newDayItems, *copyA)
				}
			} else {
				newDayItems = append(newDayItems, it)
			}
		}
		// If one of the slots was completely empty, add the moved item
		if idxA == -1 && copyB != nil {
			copyB.Period = periodA
			newDayItems = append(newDayItems, *copyB)
		}
		if idxB == -1 && copyA != nil {
			copyA.Period = periodB
			newDayItems = append(newDayItems, *copyA)
		}
		plan.Schedule[dayA] = newDayItems
	} else {
		// Cross-day swap
		// Update dayA
		newItemsA := make([]WeeklyPlanItem, 0, len(itemsA))
		for _, it := range itemsA {
			if it.Period != periodA {
				newItemsA = append(newItemsA, it)
			}
		}
		if copyB != nil {
			copyB.Period = periodA
			newItemsA = append(newItemsA, *copyB)
		}
		plan.Schedule[dayA] = newItemsA

		// Update dayB
		newItemsB := make([]WeeklyPlanItem, 0, len(itemsB))
		for _, it := range itemsB {
			if it.Period != periodB {
				newItemsB = append(newItemsB, it)
			}
		}
		if copyA != nil {
			copyA.Period = periodB
			newItemsB = append(newItemsB, *copyA)
		}
		plan.Schedule[dayB] = newItemsB
	}

	plan.IsCustomized = true

	// Persist to SQLite
	if err := p.SavePlan(plan, true); err != nil {
		return nil, fmt.Errorf("시간표 교환 결과 SQLite 저장 실패: %w", err)
	}

	return plan, nil
}
