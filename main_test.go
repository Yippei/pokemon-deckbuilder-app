package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestValidateDeckCardsAllowsBasicEnergyOverFour(t *testing.T) {
	cards := []DeckCard{
		{CardID: "basic-fire", CardName: "基本炎エネルギー", Count: 8},
		{CardID: "nest-ball", CardName: "ネストボール", Count: 4},
	}

	if err := validateDeckCards(cards); err != nil {
		t.Fatalf("validateDeckCards returned error: %v", err)
	}
}

func TestValidateDeckCardsRejectsNonBasicEnergyOverFour(t *testing.T) {
	cards := []DeckCard{
		{CardID: "nest-ball", CardName: "ネストボール", Count: 5},
	}

	if err := validateDeckCards(cards); err == nil {
		t.Fatal("validateDeckCards returned nil; want error")
	}
}

func TestValidateGeneratedDeckCardsRequiresExactlySixty(t *testing.T) {
	cards := []DeckCard{
		{CardID: "basic-fire", CardName: "基本炎エネルギー", Count: 8},
		{CardID: "nest-ball", CardName: "ネストボール", Count: 4},
	}

	if err := validateGeneratedDeckCards(cards); err == nil {
		t.Fatal("validateGeneratedDeckCards returned nil; want error")
	}
}

func TestTrimDeckToSize(t *testing.T) {
	cards := []DeckCard{
		{CardID: "basic-fire", CardName: "基本炎エネルギー", Count: 8},
		{CardID: "nest-ball", CardName: "ネストボール", Count: 4},
	}

	trimmed, total := trimDeckToSize(cards, 10)
	if total != 10 {
		t.Fatalf("total = %d; want 10", total)
	}
	if len(trimmed) != 2 {
		t.Fatalf("len(trimmed) = %d; want 2", len(trimmed))
	}
	if trimmed[1].Count != 2 {
		t.Fatalf("trimmed[1].Count = %d; want 2", trimmed[1].Count)
	}
}

func TestServeFrontendServesIndexForRoot(t *testing.T) {
	root := t.TempDir()
	writeTestFile(t, root, "index.html", "home")

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	serveFrontend(root).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; want %d", rec.Code, http.StatusOK)
	}
	if rec.Body.String() != "home" {
		t.Fatalf("body = %q; want home", rec.Body.String())
	}
}

func TestServeFrontendServesExportedHTMLRoute(t *testing.T) {
	root := t.TempDir()
	writeTestFile(t, root, "index.html", "home")
	writeTestFile(t, root, filepath.Join("decks", "new.html"), "new deck")

	req := httptest.NewRequest(http.MethodGet, "/decks/new", nil)
	rec := httptest.NewRecorder()
	serveFrontend(root).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d; want %d", rec.Code, http.StatusOK)
	}
	if rec.Body.String() != "new deck" {
		t.Fatalf("body = %q; want new deck", rec.Body.String())
	}
}

func writeTestFile(t *testing.T, root, name, body string) {
	t.Helper()
	path := filepath.Join(root, name)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("MkdirAll failed: %v", err)
	}
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatalf("WriteFile failed: %v", err)
	}
}
