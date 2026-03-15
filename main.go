package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"strconv"
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
	CardID string `json:"cardId"`
	Count  int    `json:"count"`
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
	db *pgxpool.Pool
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

	app := &App{db: pool}

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

	// Cards
	r.Get("/cards", app.handleSearchCards)       // ?name=...&reg=H&limit=50
	r.Get("/cards/{cardId}", app.handleGetCard)

	// Decks
	r.Post("/decks", app.handleCreateDeck)
	r.Get("/decks/{deckId}", app.handleGetDeck)
	r.Put("/decks/{deckId}", app.handleUpdateDeck)
	r.Delete("/decks/{deckId}", app.handleDeleteDeck)

	log.Printf("サーバーを起動しました: :%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

/* =========================
   ハンドラ - Cards
========================= */

func (a *App) handleGetCard(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	cardID := chi.URLParam(r, "cardId")

	card, err := a.getCard(ctx, cardID)
	if err != nil {
		if errors.Is(err, errNotFound) {
			writeError(w, http.StatusNotFound, "カードが見つかりません")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, card)
}

func (a *App) handleSearchCards(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	name := strings.TrimSpace(r.URL.Query().Get("name"))
	reg := strings.TrimSpace(r.URL.Query().Get("reg"))

	limit := 50
	if s := r.URL.Query().Get("limit"); s != "" {
		if v, err := strconv.Atoi(s); err == nil && v > 0 && v <= 200 {
			limit = v
		}
	}

	cards, err := a.searchCards(ctx, name, reg, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": cards})
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

	// 存在確認
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
   DB アクセス - Cards
========================= */

var errNotFound = errors.New("not found")

func (a *App) getCard(ctx context.Context, cardID string) (Card, error) {
	var c Card
	err := a.db.QueryRow(ctx,
		`SELECT card_id, name, COALESCE(regulation,''), COALESCE(card_type,''), COALESCE(illustration,'')
		 FROM cards WHERE card_id = $1`, cardID,
	).Scan(&c.CardID, &c.Name, &c.Regulation, &c.CardType, &c.Illustration)
	if errors.Is(err, pgx.ErrNoRows) {
		return Card{}, errNotFound
	}
	return c, err
}

func (a *App) searchCards(ctx context.Context, name, reg string, limit int) ([]Card, error) {
	query := `SELECT card_id, name, COALESCE(regulation,''), COALESCE(card_type,''), COALESCE(illustration,'')
	          FROM cards WHERE 1=1`
	args := []any{}
	i := 1

	if name != "" {
		query += ` AND name ILIKE $` + strconv.Itoa(i)
		args = append(args, "%"+name+"%")
		i++
	}
	if reg != "" {
		query += ` AND regulation = $` + strconv.Itoa(i)
		args = append(args, reg)
		i++
	}
	query += ` ORDER BY name LIMIT $` + strconv.Itoa(i)
	args = append(args, limit)

	rows, err := a.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cards []Card
	for rows.Next() {
		var c Card
		if err := rows.Scan(&c.CardID, &c.Name, &c.Regulation, &c.CardType, &c.Illustration); err != nil {
			return nil, err
		}
		cards = append(cards, c)
	}
	if cards == nil {
		cards = []Card{}
	}
	return cards, rows.Err()
}

/* =========================
   DB アクセス - Decks
========================= */

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
		`SELECT card_id, count FROM deck_cards WHERE deck_id = $1 ORDER BY card_id`, deckID,
	)
	if err != nil {
		return Deck{}, err
	}
	defer rows.Close()

	d.Cards = []DeckCard{}
	for rows.Next() {
		var dc DeckCard
		if err := rows.Scan(&dc.CardID, &dc.Count); err != nil {
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
			`INSERT INTO deck_cards (deck_id, card_id, count) VALUES ($1, $2, $3)`,
			deckID, c.CardID, c.Count,
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
	m := map[string]int{}
	for _, c := range cards {
		id := strings.TrimSpace(c.CardID)
		if id == "" {
			continue
		}
		m[id] += c.Count
		if m[id] > 4 {
			m[id] = 4
		}
	}
	out := make([]DeckCard, 0, len(m))
	for id, cnt := range m {
		out = append(out, DeckCard{CardID: id, Count: cnt})
	}
	return out
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
