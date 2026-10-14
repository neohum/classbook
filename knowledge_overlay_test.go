package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSaveAndLoadKnowledgeAnnotations(t *testing.T) {
	app := NewApp()
	bookId := "test_book_overlay_unit"
	imagesDir := getImagesDir()
	bookDir := filepath.Join(imagesDir, sanitizeBookFilename(bookId))
	defer os.RemoveAll(bookDir)

	sampleBundle := `{"schemaVersion":1,"bookId":"test_book_overlay_unit","annotations":[{"id":"a1","term":"광합성"}]}`
	if err := app.SaveKnowledgeAnnotations(bookId, sampleBundle); err != nil {
		t.Fatalf("SaveKnowledgeAnnotations failed: %v", err)
	}

	loaded, err := app.LoadKnowledgeAnnotations(bookId)
	if err != nil {
		t.Fatalf("LoadKnowledgeAnnotations failed: %v", err)
	}
	if !strings.Contains(loaded, "광합성") {
		t.Fatalf("expected loaded bundle to contain 광합성, got: %s", loaded)
	}
}
