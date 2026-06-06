package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
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

func TestValidateGeneratedDeckCardsRejectsEnergyOverEleven(t *testing.T) {
	cards := []DeckCard{
		{CardID: "basic-fire", CardName: "基本炎エネルギー", Count: 12},
		{CardID: "nest-ball", CardName: "ネストボール", Count: 4},
		{CardID: "ultra-ball", CardName: "ハイパーボール", Count: 4},
		{CardID: "research", CardName: "博士の研究", Count: 4},
		{CardID: "iono", CardName: "ナンジャモ", Count: 4},
		{CardID: "boss", CardName: "ボスの指令", Count: 3},
		{CardID: "switch", CardName: "ポケモンいれかえ", Count: 4},
		{CardID: "counter", CardName: "カウンターキャッチャー", Count: 4},
		{CardID: "poffin", CardName: "なかよしポフィン", Count: 4},
		{CardID: "rare-candy", CardName: "ふしぎなアメ", Count: 4},
		{CardID: "pokemon-a", CardName: "たねポケモンA", Count: 4},
		{CardID: "pokemon-b", CardName: "たねポケモンB", Count: 4},
		{CardID: "pokemon-c", CardName: "たねポケモンC", Count: 3},
	}

	if err := validateGeneratedDeckCards(cards); err == nil {
		t.Fatal("validateGeneratedDeckCards returned nil; want error")
	}
}

func TestEnforceGeneratedEnergyLimitTrimsEnergyToEleven(t *testing.T) {
	cards := []DeckCard{
		{CardID: "basic-fire", CardName: "基本炎エネルギー", Count: 10},
		{CardID: "special-energy", CardName: "ダブルターボエネルギー", Count: 4},
		{CardID: "nest-ball", CardName: "ネストボール", Count: 4},
	}

	trimmed, warnings := enforceGeneratedEnergyLimit(cards, nil)
	if total := totalEnergyCount(trimmed); total != maxGeneratedEnergyCards {
		t.Fatalf("energy total = %d; want %d", total, maxGeneratedEnergyCards)
	}
	if len(warnings) != 1 || warnings[0].Type != "trimmed_energy_to_11" {
		t.Fatalf("warnings = %#v; want trimmed_energy_to_11", warnings)
	}
}

func TestBuildDeckGenerationPromptIncludesDetailedThemeRules(t *testing.T) {
	prompt := buildDeckGenerationPrompt("炎デッキ", nil)

	required := []string{
		"エネルギー全体の合計枚数は、基本エネルギーと特殊エネルギーを合わせて必ず11枚以下",
		"60枚に満たない場合は、デッキの軸を崩さない範囲で必要なカードを追加",
		"合計が60枚になるまでカード追加を続けること",
		"スタンダードレギュレーションのティア表・入賞デッキ傾向を参考",
		"入力キーワードにタイプ（炎・水・草・雷・超・闘・悪・鋼など）が含まれる場合、そのタイプと関係ないタイプのポケモンは構築に入れない",
		"入力キーワードに特定のポケモン名が含まれる場合は、そのポケモンを最優先で採用",
		"ポケモンを山札から呼び出すグッズカード",
		"必ず2種類以上入れること",
		"トラッシュからポケモンまたはエネルギーカードを手札または山札に戻すグッズカード",
		"0〜2種類までに抑えること",
		"手札をリセットするサポートカード",
		"必ず合計4枚入れること",
		"山札を引いて手札を増やす効果",
		"相手のベンチポケモンをバトル場に呼び出す効果",
		"バトルポケモンを入れ替える効果",
	}

	for _, want := range required {
		if !strings.Contains(prompt, want) {
			t.Fatalf("prompt does not contain %q\nprompt:\n%s", want, prompt)
		}
	}

	forbidden := []string{
		"博士の研究",
		"ナンジャモ",
		"ボスの指令",
		"ネストボール",
		"ハイパーボール",
		"なかよしポフィン",
		"キャプチャーアロマ",
		"すごいつりざお",
		"夜のタンカ",
		"カウンターキャッチャー",
		"ポケモンいれかえ",
		"ダブルターボエネルギー",
	}

	for _, name := range forbidden {
		if strings.Contains(prompt, name) {
			t.Fatalf("prompt contains forbidden card name %q\nprompt:\n%s", name, prompt)
		}
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
