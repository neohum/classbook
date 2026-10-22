package main

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	_ "modernc.org/sqlite"
)

func TestWeeklyPlanDBSaveAndSwap(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "classbook_db_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	dbPath := filepath.Join(tempDir, "test_plans.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("failed to open sqlite: %v", err)
	}
	defer db.Close()

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
	`
	if _, err := db.Exec(createTablesSQL); err != nil {
		t.Fatalf("failed to create tables: %v", err)
	}

	planDB := &WeeklyPlanDB{db: db, dbPath: dbPath}

	initialPlan := &WeeklyPlanResult{
		Success:   true,
		Title:     "테스트_주학습안내",
		FilePath:  "D:\\test\\sample.hwpx",
		StartDate: "2026-03-23",
		EndDate:   "2026-03-27",
		Schedule: map[string][]WeeklyPlanItem{
			"월": {
				{Period: 1, Subject: "국어", Topic: "글자의 짜임", StartPage: 34, EndPage: 37},
				{Period: 2, Subject: "수학", Topic: "순서를 알아봐요", StartPage: 24, EndPage: 27},
			},
			"화": {
				{Period: 1, Subject: "수학", Topic: "몇 개일까요", StartPage: 20, EndPage: 23},
				{Period: 2, Subject: "국어", Topic: "바르게 읽기", StartPage: 38, EndPage: 41},
			},
		},
	}

	// 1. Save original parsed plan
	if err := planDB.SavePlan(initialPlan, false); err != nil {
		t.Fatalf("SavePlan failed: %v", err)
	}

	// 2. Retrieve plan
	loaded, exists, err := planDB.GetPlan("D:\\test\\sample.hwpx")
	if err != nil || !exists || loaded == nil {
		t.Fatalf("GetPlan failed: exists=%v, err=%v", exists, err)
	}
	if loaded.IsCustomized {
		t.Errorf("expected IsCustomized to be false initially, got true")
	}
	if len(loaded.Schedule["월"]) != 2 {
		t.Fatalf("expected 2 items for Monday, got %d", len(loaded.Schedule["월"]))
	}

	// 3. Test Same-Day Swap (Monday 1교시 국어 <-> Monday 2교시 수학)
	swapped, err := planDB.SwapSlots(loaded, "월", 1, "월", 2)
	if err != nil {
		t.Fatalf("SwapSlots same-day failed: %v", err)
	}
	if !swapped.IsCustomized {
		t.Errorf("expected IsCustomized to be true after swap")
	}

	var monP1, monP2 *WeeklyPlanItem
	for _, it := range swapped.Schedule["월"] {
		if it.Period == 1 {
			monP1 = &it
		} else if it.Period == 2 {
			monP2 = &it
		}
	}
	if monP1 == nil || monP1.Subject != "수학" {
		t.Errorf("expected Monday 1교시 to be 수학, got %v", monP1)
	}
	if monP2 == nil || monP2.Subject != "국어" {
		t.Errorf("expected Monday 2교시 to be 국어, got %v", monP2)
	}

	// 4. Test Cross-Day Swap (Monday 1교시 수학 <-> Tuesday 2교시 국어)
	swappedCross, err := planDB.SwapSlots(swapped, "월", 1, "화", 2)
	if err != nil {
		t.Fatalf("SwapSlots cross-day failed: %v", err)
	}

	var newMonP1, newTueP2 *WeeklyPlanItem
	for _, it := range swappedCross.Schedule["월"] {
		if it.Period == 1 {
			newMonP1 = &it
		}
	}
	for _, it := range swappedCross.Schedule["화"] {
		if it.Period == 2 {
			newTueP2 = &it
		}
	}
	if newMonP1 == nil || newMonP1.Subject != "국어" || newMonP1.Topic != "바르게 읽기" {
		t.Errorf("expected Monday 1교시 to be swapped to Tuesday's 국어, got %v", newMonP1)
	}
	if newTueP2 == nil || newTueP2.Subject != "수학" || newTueP2.Topic != "순서를 알아봐요" {
		t.Errorf("expected Tuesday 2교시 to be swapped to Monday's 수학, got %v", newTueP2)
	}

	// 5. Verify persistence in DB
	reloaded, exists2, err := planDB.GetPlan("D:\\test\\sample.hwpx")
	if err != nil || !exists2 || reloaded == nil {
		t.Fatalf("Reload after swaps failed")
	}
	if !reloaded.IsCustomized {
		t.Errorf("expected reloaded plan to have IsCustomized=true")
	}
}

func TestPeriodMaterials(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "classbook_period_materials_test_*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	dbPath := filepath.Join(tempDir, "test_period_materials.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("failed to open sqlite: %v", err)
	}
	defer db.Close()

	planDB := &WeeklyPlanDB{db: db, dbPath: dbPath}

	sampleFilePath := "D:\\test\\weekly_plan_2026.hwpx"
	sampleJSON := `{"월_1":{"day":"월","period":1,"subject":"국어","topic":"글자의 짜임","materials":[{"id":"mkt-kor-dictation-01","title":"AI 받아쓰기 활동지","type":"market_artifact","subject":"국어","keywords":["받아쓰기"],"urlOrPath":"market://all-market/artifacts/kor-dictation-01"}],"updatedAt":"2026-10-22T09:00:00Z"}}`

	if err := planDB.SavePeriodMaterialBindings(sampleFilePath, sampleJSON); err != nil {
		t.Fatalf("SavePeriodMaterialBindings failed: %v", err)
	}

	loadedJSON, err := planDB.GetPeriodMaterialBindings(sampleFilePath)
	if err != nil {
		t.Fatalf("GetPeriodMaterialBindings failed: %v", err)
	}
	if loadedJSON != sampleJSON {
		t.Errorf("expected loadedJSON to match sampleJSON, got: %s", loadedJSON)
	}

	// Verify invalid JSON is rejected
	if err := planDB.SavePeriodMaterialBindings(sampleFilePath, "{broken_json"); err == nil {
		t.Errorf("expected invalid JSON to return error")
	}
}

