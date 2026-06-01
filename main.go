package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

/* =========================
   モデル
========================= */

type Card struct {
	CardID       string `json:"cardId"`
	Name         string `json:"name"`
	Regulation   string `json:"regulation,omitempty"`
	CardType     string `json:"cardType,omitempty"`
	Illustration string `json:"illustration,omitempty"`
}

type DeckCard struct {
	CardID       string `json:"cardId"`
	CardName     string `json:"cardName,omitempty"`
	Illustration string `json:"illustration,omitempty"`
	Count        int    `json:"count"`
}

type Deck struct {
	DeckID    string     `json:"deckId"`
	OwnerID   string     `json:"ownerId"`
	Name      string     `json:"name"`
	Cards     []DeckCard `json:"cards"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
}

type App struct {
	db     *pgxpool.Pool
	groq   string
	gemini string
}

// pokemon-card.com API レスポンス用
type pokemonAPIResponse struct {
	Result   int              `json:"result"`
	CardList []pokemonAPICard `json:"cardList"`
	MaxPage  int              `json:"maxPage"`
}

type pokemonAPICard struct {
	CardID           string `json:"cardID"`
	CardThumbFile    string `json:"cardThumbFile"`
	CardNameViewText string `json:"cardNameViewText"`
}

/* =========================
   エントリーポイント
========================= */

func main() {
	port := getenv("PORT", "8080")
	databaseURL := mustGetenv("DATABASE_URL")

	ctx := context.Background()

	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("DBへの接続に失敗しました: %v", err)
	}
	defer pool.Close()

	log.Printf("DB接続先を確認します: %s", safeDatabaseURL(databaseURL))
	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("DBへの疎通確認に失敗しました: %T: %v", err, err)
	}

	groqKey := os.Getenv("GROQ_API_KEY")
	geminiKey := os.Getenv("GEMINI_API_KEY")
	if groqKey == "" && geminiKey == "" {
		log.Fatal("環境変数 GROQ_API_KEY または GEMINI_API_KEY のどちらかを設定してください")
	}
	app := &App{db: pool, groq: groqKey, gemini: geminiKey}

	r := chi.NewRouter()
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   strings.Split(getenv("ALLOWED_ORIGINS", "http://localhost:3000"), ","),
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	frontend := serveFrontend("front/out")
	r.Get("/", frontend)
	r.Get("/decks/new", frontend)
	r.Get("/decks/view", frontend)
	r.Get("/_next/*", frontend)
	r.Get("/favicon.ico", frontend)

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"ok": "true"})
	})
	r.Get("/readyz", app.handleReadiness)

	// Cards（pokemon-card.com にプロキシ）
	r.Get("/cards", app.handleSearchCards) // ?name=...&pg=1

	// Decks
	r.Post("/decks", app.handleCreateDeck)
	r.Post("/decks/generate", app.handleGenerateDeck)
	r.Get("/decks/{deckId}", app.handleGetDeck)
	r.Put("/decks/{deckId}", app.handleUpdateDeck)
	r.Delete("/decks/{deckId}", app.handleDeleteDeck)
	r.NotFound(frontend)

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("サーバーを起動しました: :%s\n", port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("サーバーが異常終了しました: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("サーバーのシャットダウンに失敗しました: %v", err)
	}
}

/* =========================
   ハンドラ - Cards
========================= */

func (a *App) handleSearchCards(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	pg := r.URL.Query().Get("pg")
	if pg == "" {
		pg = "1"
	}

	cards, err := searchCardsFromOfficial(name, pg)
	if err != nil {
		writeError(w, http.StatusBadGateway, "カード検索に失敗しました")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": cards})
}

func (a *App) handleReadiness(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	if err := a.db.Ping(ctx); err != nil {
		writeError(w, http.StatusServiceUnavailable, "DBへの疎通確認に失敗しました")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"ok": "true"})
}

func searchCardsFromOfficial(name, pg string) ([]Card, error) {
	apiURL := fmt.Sprintf(
		"https://www.pokemon-card.com/card-search/resultAPI.php?keyword=%s&regulation_sidebar_form=XY&pg=&illust=&sm_and_keyword=true",
		url.QueryEscape(name),
	)
	_ = pg // ページネーションは将来対応

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
	req.Header.Set("Referer", "https://www.pokemon-card.com/card-search/")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var apiResp pokemonAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, err
	}

	cards := make([]Card, 0, len(apiResp.CardList))
	for _, c := range apiResp.CardList {
		cards = append(cards, Card{
			CardID:       c.CardID,
			Name:         c.CardNameViewText,
			Regulation:   "H",
			CardType:     extractCardType(c.CardThumbFile),
			Illustration: "https://www.pokemon-card.com" + c.CardThumbFile,
		})
	}
	return cards, nil
}

// カード画像ファイル名からカード種別を判定（_P_=ポケモン, _T_=トレーナーズ, _E_=エネルギー）
func extractCardType(thumbFile string) string {
	switch {
	case strings.Contains(thumbFile, "_P_"):
		return "ポケモン"
	case strings.Contains(thumbFile, "_T_"):
		return "トレーナーズ"
	case strings.Contains(thumbFile, "_E_"):
		return "エネルギー"
	default:
		return ""
	}
}

/* =========================
   ハンドラ - Decks
========================= */

type deckRequest struct {
	OwnerID string     `json:"ownerId"`
	Name    string     `json:"name"`
	Cards   []DeckCard `json:"cards"`
}

func (a *App) handleCreateDeck(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	var req deckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "JSONが不正です")
		return
	}

	req.OwnerID = strings.TrimSpace(req.OwnerID)
	req.Name = strings.TrimSpace(req.Name)

	if req.OwnerID == "" || req.Name == "" {
		writeError(w, http.StatusBadRequest, "ownerId と name は必須です")
		return
	}
	if err := validateDeckCards(req.Cards); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	deck := Deck{
		DeckID:  uuid.NewString(),
		OwnerID: req.OwnerID,
		Name:    req.Name,
		Cards:   normalizeCards(req.Cards),
	}

	if err := a.createDeck(ctx, deck); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, deck)
}

func (a *App) handleGetDeck(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	deckID := chi.URLParam(r, "deckId")

	deck, err := a.getDeck(ctx, deckID)
	if err != nil {
		if errors.Is(err, errNotFound) {
			writeError(w, http.StatusNotFound, "デッキが見つかりません")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, deck)
}

func (a *App) handleUpdateDeck(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	deckID := chi.URLParam(r, "deckId")

	existing, err := a.getDeck(ctx, deckID)
	if err != nil {
		if errors.Is(err, errNotFound) {
			writeError(w, http.StatusNotFound, "デッキが見つかりません")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	var req struct {
		Name  *string    `json:"name,omitempty"`
		Cards []DeckCard `json:"cards,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "JSONが不正です")
		return
	}

	if req.Name != nil {
		n := strings.TrimSpace(*req.Name)
		if n == "" {
			writeError(w, http.StatusBadRequest, "name は空にできません")
			return
		}
		existing.Name = n
	}
	if req.Cards != nil {
		if err := validateDeckCards(req.Cards); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		existing.Cards = normalizeCards(req.Cards)
	}

	if err := a.updateDeck(ctx, existing); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, existing)
}

func (a *App) handleDeleteDeck(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	deckID := chi.URLParam(r, "deckId")

	deleted, err := a.deleteDeck(ctx, deckID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if !deleted {
		writeError(w, http.StatusNotFound, "デッキが見つかりません")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

/* =========================
   DB アクセス - Decks
========================= */

var errNotFound = errors.New("not found")

func (a *App) getDeck(ctx context.Context, deckID string) (Deck, error) {
	var d Deck
	err := a.db.QueryRow(ctx,
		`SELECT deck_id, owner_id, name, created_at, updated_at FROM decks WHERE deck_id = $1`, deckID,
	).Scan(&d.DeckID, &d.OwnerID, &d.Name, &d.CreatedAt, &d.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Deck{}, errNotFound
	}
	if err != nil {
		return Deck{}, err
	}

	rows, err := a.db.Query(ctx,
		`SELECT card_id, card_name, illustration, count FROM deck_cards WHERE deck_id = $1 ORDER BY card_id`, deckID,
	)
	if err != nil {
		return Deck{}, err
	}
	defer rows.Close()

	d.Cards = []DeckCard{}
	for rows.Next() {
		var dc DeckCard
		if err := rows.Scan(&dc.CardID, &dc.CardName, &dc.Illustration, &dc.Count); err != nil {
			return Deck{}, err
		}
		d.Cards = append(d.Cards, dc)
	}
	return d, rows.Err()
}

func (a *App) createDeck(ctx context.Context, deck Deck) error {
	tx, err := a.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	err = tx.QueryRow(ctx,
		`INSERT INTO decks (deck_id, owner_id, name) VALUES ($1, $2, $3)
		 RETURNING created_at, updated_at`,
		deck.DeckID, deck.OwnerID, deck.Name,
	).Scan(&deck.CreatedAt, &deck.UpdatedAt)
	if err != nil {
		return err
	}

	if err := insertDeckCards(ctx, tx, deck.DeckID, deck.Cards); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (a *App) updateDeck(ctx context.Context, deck Deck) error {
	tx, err := a.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	err = tx.QueryRow(ctx,
		`UPDATE decks SET name = $1, updated_at = NOW() WHERE deck_id = $2
		 RETURNING updated_at`,
		deck.Name, deck.DeckID,
	).Scan(&deck.UpdatedAt)
	if err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `DELETE FROM deck_cards WHERE deck_id = $1`, deck.DeckID); err != nil {
		return err
	}
	if err := insertDeckCards(ctx, tx, deck.DeckID, deck.Cards); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (a *App) deleteDeck(ctx context.Context, deckID string) (bool, error) {
	tag, err := a.db.Exec(ctx, `DELETE FROM decks WHERE deck_id = $1`, deckID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func insertDeckCards(ctx context.Context, tx pgx.Tx, deckID string, cards []DeckCard) error {
	for _, c := range cards {
		_, err := tx.Exec(ctx,
			`INSERT INTO deck_cards (deck_id, card_id, card_name, illustration, count) VALUES ($1, $2, $3, $4, $5)`,
			deckID, c.CardID, c.CardName, c.Illustration, c.Count,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

/* =========================
   バリデーション・ヘルパー
========================= */

func validateDeckCards(cards []DeckCard) error {
	total := 0
	for _, c := range cards {
		if strings.TrimSpace(c.CardID) == "" {
			return errors.New("cardId は必須です")
		}
		if c.Count <= 0 {
			return errors.New("count は 1 以上で指定してください")
		}
		if c.Count > 4 && !isBasicEnergyName(c.CardName) {
			return errors.New("基本エネルギー以外の count は 1〜4 の範囲で指定してください")
		}
		total += c.Count
	}
	if total > 60 {
		return errors.New("デッキの合計枚数は60枚以下にしてください")
	}
	return nil
}

func normalizeCards(cards []DeckCard) []DeckCard {
	type cardKey struct{ id, name, illustration string }
	m := map[cardKey]int{}
	for _, c := range cards {
		id := strings.TrimSpace(c.CardID)
		if id == "" {
			continue
		}
		k := cardKey{id: id, name: c.CardName, illustration: c.Illustration}
		m[k] += c.Count
		if m[k] > 4 && !isBasicEnergyName(c.CardName) {
			m[k] = 4
		}
	}
	out := make([]DeckCard, 0, len(m))
	for k, cnt := range m {
		out = append(out, DeckCard{CardID: k.id, CardName: k.name, Illustration: k.illustration, Count: cnt})
	}
	return out
}

/* =========================
   ハンドラ - デッキ自動生成
========================= */

type generateDeckRequest struct {
	Theme        string     `json:"theme"`
	ExistingDeck []DeckCard `json:"existingDeck,omitempty"`
}

type suggestedCard struct {
	CardName string `json:"cardName"`
	Count    int    `json:"count"`
}

type generateDeckWarning struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

func (a *App) handleGenerateDeck(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	var req generateDeckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "JSONが不正です")
		return
	}
	req.Theme = strings.TrimSpace(req.Theme)
	if req.Theme == "" {
		writeError(w, http.StatusBadRequest, "theme は必須です")
		return
	}

	cards, err := a.generateDeckWithAI(ctx, req.Theme, req.ExistingDeck)
	if err != nil {
		log.Printf("AI deck generation error: %v", err)
		writeError(w, http.StatusInternalServerError, "デッキ生成に失敗しました")
		return
	}

	deckCards, warnings, err := resolveGeneratedDeck(cards, req.Theme)
	if err != nil {
		log.Printf("generated deck validation error: %v", err)
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"cards":    deckCards,
		"warnings": warnings,
	})
}

func (a *App) generateDeckWithAI(ctx context.Context, theme string, existing []DeckCard) ([]suggestedCard, error) {
	prompt := buildDeckGenerationPrompt(theme, existing)
	if a.groq != "" {
		return a.generateDeckWithGroq(ctx, prompt)
	}
	if a.gemini != "" {
		return a.generateDeckWithGemini(ctx, prompt)
	}
	return nil, errors.New("AI APIキーが設定されていません")
}

func buildDeckGenerationPrompt(theme string, existing []DeckCard) string {
	var prompt string
	deckRules := `
【デッキ構成の鉄則】
- 合計枚数: 必ず60枚（厳守）
- 同名カード: 最大4枚まで（エネルギーは除く）
- ポケモン: 12〜20枚が目安
  - メインアタッカーは3〜4枚
  - 進化ポケモンの場合は進化前も必ず入れる（例: たねポケモン4枚 + 進化後3枚）
  - サブアタッカーやシステムポケモンも2〜3枚入れると安定
- トレーナーズ: 28〜35枚が目安
  - サポート（必須）: 博士の研究×4、ナンジャモ×3〜4、ボスの指令×2〜3
  - グッズ（必須）: ネストボール×4、ハイパーボール×3〜4、なかよしポフィン×4（たねポケモン多めなら）
  - グッズ（推奨）: カウンターキャッチャー×2、ポケモンいれかえ×2〜3、キャプチャーアロマ×2
  - スタジアム: 2〜4枚（テーマに合ったものを選ぶ）
- エネルギー: 8〜15枚が目安
  - メインアタッカーのタイプに合わせた基本エネルギーを最低5枚以上入れること
  - 特殊エネルギー（ダブルターボエネルギーなど）も活用する
- 進化ラインの注意:
  - タネポケモンと一進化・二進化の枚数を必ず揃えること（例: タネ4枚→一進化3枚→二進化2〜3枚）
  - 進化前と進化後が途切れないよう枚数バランスを意識すること

【カード名の注意】
- 日本語の正式名称で記載すること
- exポケモンは「〇〇ex」、VMAXは「〇〇VMAX」のように正確に記載`

	if len(existing) == 0 {
		prompt = fmt.Sprintf(`以下のテーマで競技レベルの60枚デッキを構築してください。

テーマ: %s
%s

必ず以下のJSONオブジェクト形式のみで返してください:
{"cards": [{"cardName": "カード名", "count": 枚数}, ...]}`, theme, deckRules)
	} else {
		existingJSON, _ := json.Marshal(existing)
		prompt = fmt.Sprintf(`以下のデッキを分析し、競技レベルに改善してください。

テーマ・強化方針: %s

現在のデッキ:
%s
%s

必ず以下のJSONオブジェクト形式のみで返してください:
{"cards": [{"cardName": "カード名", "count": 枚数}, ...]}`, theme, string(existingJSON), deckRules)
	}
	return prompt
}

func (a *App) generateDeckWithGroq(ctx context.Context, prompt string) ([]suggestedCard, error) {
	// Groq API を呼び出す（OpenAI互換フォーマット）
	reqBody := map[string]any{
		"model": "llama-3.3-70b-versatile",
		"messages": []map[string]any{
			{"role": "system", "content": "あなたはポケモンカードゲームの専門家です。指示に厳密に従い、必ずJSON配列形式のみで返答してください。説明文・コメント・コードブロックは一切不要です。"},
			{"role": "user", "content": prompt},
		},
		"response_format": map[string]any{"type": "json_object"},
		"max_tokens":      2048,
		"temperature":     0.3,
	}
	reqJSON, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		"https://api.groq.com/openai/v1/chat/completions",
		strings.NewReader(string(reqJSON)),
	)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+a.groq)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Groq API error: status=%d body=%s", resp.StatusCode, string(bodyBytes))
	}

	var groqResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(bodyBytes, &groqResp); err != nil {
		return nil, err
	}
	if len(groqResp.Choices) == 0 {
		return nil, fmt.Errorf("Groq からの応答が空です")
	}

	text := groqResp.Choices[0].Message.Content

	// {"cards": [...]} 形式でパース
	var wrapper struct {
		Cards []suggestedCard `json:"cards"`
	}
	if err := json.Unmarshal([]byte(text), &wrapper); err != nil {
		return nil, fmt.Errorf("JSONパースエラー: %v / 応答: %s", err, text)
	}
	if len(wrapper.Cards) == 0 {
		return nil, fmt.Errorf("カードリストが空です / 応答: %s", text)
	}
	return wrapper.Cards, nil
}

func (a *App) generateDeckWithGemini(ctx context.Context, prompt string) ([]suggestedCard, error) {
	reqBody := map[string]any{
		"systemInstruction": map[string]any{
			"parts": []map[string]any{
				{"text": "あなたはポケモンカードゲームの専門家です。指示に厳密に従い、必ずJSONオブジェクトのみで返答してください。説明文・コメント・コードブロックは一切不要です。"},
			},
		},
		"contents": []map[string]any{
			{
				"role": "user",
				"parts": []map[string]any{
					{"text": prompt},
				},
			},
		},
		"generationConfig": map[string]any{
			"temperature":      0.3,
			"maxOutputTokens":  2048,
			"responseMimeType": "application/json",
		},
	}
	reqJSON, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
		strings.NewReader(string(reqJSON)),
	)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-goog-api-key", a.gemini)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Gemini API error: status=%d body=%s", resp.StatusCode, string(bodyBytes))
	}

	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(bodyBytes, &geminiResp); err != nil {
		return nil, err
	}
	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("Gemini からの応答が空です")
	}

	text := geminiResp.Candidates[0].Content.Parts[0].Text
	var wrapper struct {
		Cards []suggestedCard `json:"cards"`
	}
	if err := json.Unmarshal([]byte(text), &wrapper); err != nil {
		return nil, fmt.Errorf("JSONパースエラー: %v / 応答: %s", err, text)
	}
	if len(wrapper.Cards) == 0 {
		return nil, fmt.Errorf("カードリストが空です / 応答: %s", text)
	}
	return wrapper.Cards, nil
}

func resolveGeneratedDeck(suggestions []suggestedCard, theme string) ([]DeckCard, []generateDeckWarning, error) {
	deckCards := make([]DeckCard, 0, len(suggestions))
	warnings := []generateDeckWarning{}

	for _, sc := range suggestions {
		name := strings.TrimSpace(sc.CardName)
		if name == "" || sc.Count <= 0 {
			warnings = append(warnings, generateDeckWarning{
				Type:    "invalid_suggestion",
				Message: fmt.Sprintf("不正な候補を除外しました: %q x%d", sc.CardName, sc.Count),
			})
			continue
		}

		results, err := searchCardsFromOfficial(name, "1")
		if err != nil {
			warnings = append(warnings, generateDeckWarning{
				Type:    "card_search_failed",
				Message: fmt.Sprintf("%s の検索に失敗しました", name),
			})
			continue
		}
		if len(results) == 0 {
			warnings = append(warnings, generateDeckWarning{
				Type:    "card_not_found",
				Message: fmt.Sprintf("%s が公式カード検索で見つかりませんでした", name),
			})
			continue
		}

		found := chooseBestCardMatch(name, results)
		deckCards = append(deckCards, DeckCard{
			CardID:       found.CardID,
			CardName:     found.Name,
			Illustration: found.Illustration,
			Count:        sc.Count,
		})
	}

	deckCards = normalizeCards(deckCards)
	deckCards, warnings = enforceGeneratedDeckSize(deckCards, theme, warnings)
	if err := validateGeneratedDeckCards(deckCards); err != nil {
		return nil, warnings, err
	}
	return deckCards, warnings, nil
}

func chooseBestCardMatch(query string, results []Card) Card {
	normalizedQuery := normalizeCardName(query)
	for _, card := range results {
		if normalizeCardName(card.Name) == normalizedQuery {
			return card
		}
	}
	for _, card := range results {
		if strings.Contains(normalizeCardName(card.Name), normalizedQuery) {
			return card
		}
	}
	return results[0]
}

func enforceGeneratedDeckSize(cards []DeckCard, theme string, warnings []generateDeckWarning) ([]DeckCard, []generateDeckWarning) {
	total := totalDeckCount(cards)
	if total > 60 {
		cards, total = trimDeckToSize(cards, 60)
		warnings = append(warnings, generateDeckWarning{
			Type:    "trimmed_to_60",
			Message: "AIの候補が60枚を超えたため、末尾のカードから枚数を減らしました",
		})
	}
	if total < 60 {
		deficit := 60 - total
		filled, addedName := addBasicEnergy(cards, theme, deficit)
		if totalDeckCount(filled) > total {
			cards = filled
			warnings = append(warnings, generateDeckWarning{
				Type:    "filled_to_60",
				Message: fmt.Sprintf("不足していた%d枚を%sで補完しました", deficit, addedName),
			})
		}
	}
	return cards, warnings
}

func trimDeckToSize(cards []DeckCard, size int) ([]DeckCard, int) {
	total := totalDeckCount(cards)
	for i := len(cards) - 1; i >= 0 && total > size; i-- {
		remove := total - size
		if cards[i].Count < remove {
			remove = cards[i].Count
		}
		cards[i].Count -= remove
		total -= remove
	}
	out := cards[:0]
	for _, card := range cards {
		if card.Count > 0 {
			out = append(out, card)
		}
	}
	return out, total
}

func addBasicEnergy(cards []DeckCard, theme string, count int) ([]DeckCard, string) {
	if count <= 0 {
		return cards, ""
	}
	for i, card := range cards {
		if isBasicEnergyName(card.CardName) {
			cards[i].Count += count
			return cards, card.CardName
		}
	}

	energyName := guessBasicEnergyName(theme)
	results, err := searchCardsFromOfficial(energyName, "1")
	if err != nil || len(results) == 0 {
		return cards, ""
	}
	found := chooseBestCardMatch(energyName, results)
	return append(cards, DeckCard{
		CardID:       found.CardID,
		CardName:     found.Name,
		Illustration: found.Illustration,
		Count:        count,
	}), found.Name
}

func guessBasicEnergyName(theme string) string {
	switch {
	case strings.Contains(theme, "炎"):
		return "基本炎エネルギー"
	case strings.Contains(theme, "水"):
		return "基本水エネルギー"
	case strings.Contains(theme, "草"):
		return "基本草エネルギー"
	case strings.Contains(theme, "雷"), strings.Contains(theme, "ピカチュウ"):
		return "基本雷エネルギー"
	case strings.Contains(theme, "超"):
		return "基本超エネルギー"
	case strings.Contains(theme, "闘"):
		return "基本闘エネルギー"
	case strings.Contains(theme, "悪"):
		return "基本悪エネルギー"
	case strings.Contains(theme, "鋼"):
		return "基本鋼エネルギー"
	default:
		return "基本雷エネルギー"
	}
}

func validateGeneratedDeckCards(cards []DeckCard) error {
	if err := validateDeckCards(cards); err != nil {
		return err
	}
	if total := totalDeckCount(cards); total != 60 {
		return fmt.Errorf("AI生成デッキの合計枚数が60枚ではありません（現在%d枚）", total)
	}
	return nil
}

func totalDeckCount(cards []DeckCard) int {
	total := 0
	for _, card := range cards {
		total += card.Count
	}
	return total
}

func isBasicEnergyName(name string) bool {
	normalized := normalizeCardName(name)
	return strings.Contains(normalized, "基本") && strings.Contains(normalized, "エネルギー")
}

func normalizeCardName(name string) string {
	replacer := strings.NewReplacer(" ", "", "　", "", "・", "", "-", "", "－", "")
	return strings.ToLower(replacer.Replace(strings.TrimSpace(name)))
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("JSONエンコードエラー: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func serveFrontend(root string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			writeError(w, http.StatusNotFound, "not found")
			return
		}

		requestPath := filepath.Clean(r.URL.Path)
		if strings.HasPrefix(requestPath, "..") {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		if requestPath == "." || requestPath == "/" {
			http.ServeFile(w, r, filepath.Join(root, "index.html"))
			return
		}

		relativePath := strings.TrimPrefix(requestPath, "/")
		candidates := []string{relativePath}
		if filepath.Ext(relativePath) == "" {
			candidates = append(candidates, filepath.Join(relativePath, "index.html"), relativePath+".html")
		}

		for _, candidate := range candidates {
			fullPath := filepath.Join(root, candidate)
			info, err := os.Stat(fullPath)
			if err == nil && !info.IsDir() {
				http.ServeFile(w, r, fullPath)
				return
			}
		}

		http.ServeFile(w, r, filepath.Join(root, "index.html"))
	}
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func safeDatabaseURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return "(DATABASE_URLのパースに失敗)"
	}
	if u.User != nil {
		username := u.User.Username()
		u.User = url.UserPassword(username, "xxxxx")
	}
	return u.String()
}

func mustGetenv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("環境変数が設定されていません: %s", key)
	}
	return v
}
