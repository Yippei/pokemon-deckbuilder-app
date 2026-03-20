package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
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
	db   *pgxpool.Pool
	groq string // Groq API key
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

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("DBへの疎通確認に失敗しました: %v", err)
	}

	groqKey := mustGetenv("GROQ_API_KEY")
	app := &App{db: pool, groq: groqKey}

	r := chi.NewRouter()
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   strings.Split(getenv("ALLOWED_ORIGINS", "http://localhost:3000"), ","),
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"ok": "true"})
	})

	// Cards（pokemon-card.com にプロキシ）
	r.Get("/cards", app.handleSearchCards) // ?name=...&pg=1

	// Decks
	r.Post("/decks", app.handleCreateDeck)
	r.Post("/decks/generate", app.handleGenerateDeck)
	r.Get("/decks/{deckId}", app.handleGetDeck)
	r.Put("/decks/{deckId}", app.handleUpdateDeck)
	r.Delete("/decks/{deckId}", app.handleDeleteDeck)

	log.Printf("サーバーを起動しました: :%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
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

func searchCardsFromOfficial(name, pg string) ([]Card, error) {
	apiURL := fmt.Sprintf(
		"https://www.pokemon-card.com/card-search/resultAPI.php?keyword=%s&regulation_sidebar_form=XY&pg=&illust=&sm_and_keyword=true",
		name,
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
		if c.Count <= 0 || c.Count > 4 {
			return errors.New("count は 1〜4 の範囲で指定してください")
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
		if m[k] > 4 {
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

	// Claude にデッキ構成を依頼
	cards, err := a.generateDeckWithClaude(ctx, req.Theme, req.ExistingDeck)
	if err != nil {
		log.Printf("Claude API error: %v", err)
		writeError(w, http.StatusInternalServerError, "デッキ生成に失敗しました")
		return
	}

	// 各カード名で pokemon-card.com を検索して実際のカードデータを取得
	deckCards := make([]DeckCard, 0, len(cards))
	for _, sc := range cards {
		results, err := searchCardsFromOfficial(sc.CardName, "1")
		if err != nil || len(results) == 0 {
			// 見つからなければカード名のみでスキップ
			continue
		}
		found := results[0]
		deckCards = append(deckCards, DeckCard{
			CardID:       found.CardID,
			CardName:     found.Name,
			Illustration: found.Illustration,
			Count:        sc.Count,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{"cards": deckCards})
}

func (a *App) generateDeckWithClaude(ctx context.Context, theme string, existing []DeckCard) ([]suggestedCard, error) {
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

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func mustGetenv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("環境変数が設定されていません: %s", key)
	}
	return v
}
