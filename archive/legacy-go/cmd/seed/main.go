package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	baseURL    = "https://www.pokemon-card.com"
	searchURL  = "https://www.pokemon-card.com/card-search/index.php?keyword=&se_ta=&regulation_sidebar_form=H&pg=%d&illust=&sm_and_keyword=true"
	regulation = "H"
)

type Card struct {
	CardID       string
	Name         string
	Regulation   string
	CardType     string
	Illustration string
}

func main() {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL が設定されていません")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("DB接続失敗: %v", err)
	}
	defer pool.Close()

	log.Println("Hレギュレーションのカードを取得中...")
	cards, err := scrapeAllCards()
	if err != nil {
		log.Fatalf("スクレイピング失敗: %v", err)
	}
	log.Printf("%d 件のカードを取得しました", len(cards))

	// DBに登録
	inserted := 0
	for _, card := range cards {
		_, err := pool.Exec(ctx, `
			INSERT INTO cards (card_id, name, regulation, card_type, illustration)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (card_id) DO UPDATE
			SET name = EXCLUDED.name,
			    regulation = EXCLUDED.regulation,
			    card_type = EXCLUDED.card_type,
			    illustration = EXCLUDED.illustration
		`, card.CardID, card.Name, card.Regulation, card.CardType, card.Illustration)
		if err != nil {
			log.Printf("登録失敗 [%s]: %v", card.CardID, err)
			continue
		}
		inserted++
	}
	log.Printf("完了: %d 件登録しました", inserted)
}

func scrapeAllCards() ([]Card, error) {
	var allCards []Card

	for page := 1; ; page++ {
		log.Printf("ページ %d を取得中...", page)
		cards, hasNext, err := scrapePage(page)
		if err != nil {
			return nil, fmt.Errorf("ページ %d の取得失敗: %w", page, err)
		}
		allCards = append(allCards, cards...)
		if !hasNext {
			break
		}
		// サーバー負荷軽減のため少し待機
		time.Sleep(1 * time.Second)
	}
	return allCards, nil
}

func scrapePage(page int) ([]Card, bool, error) {
	url := fmt.Sprintf(searchURL, page)

	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, false, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")

	resp, err := client.Do(req)
	if err != nil {
		return nil, false, err
	}
	defer resp.Body.Close()

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, false, err
	}

	var cards []Card

	// カード一覧を取得
	doc.Find("li.card-list-item, .card-list li").Each(func(_ int, s *goquery.Selection) {
		card := parseCard(s)
		if card.CardID != "" && card.Name != "" {
			cards = append(cards, card)
		}
	})

	// 次のページが存在するか（カードが0件なら終了）
	hasNext := len(cards) > 0

	return cards, hasNext, nil
}

func parseCard(s *goquery.Selection) Card {
	var card Card
	card.Regulation = regulation

	// カード名
	card.Name = strings.TrimSpace(s.Find(".card-name, .name").First().Text())
	if card.Name == "" {
		card.Name = strings.TrimSpace(s.Find("h4, h3, .title").First().Text())
	}

	// カードID（詳細ページのURLから取得）
	href, exists := s.Find("a").First().Attr("href")
	if exists {
		// URLからIDを抽出（例: /card-search/details.php/id/12345 → H-12345）
		parts := strings.Split(href, "/")
		for i, p := range parts {
			if p == "id" && i+1 < len(parts) {
				card.CardID = "H-" + parts[i+1]
				break
			}
		}
		// 別パターン: ?id=12345
		if card.CardID == "" && strings.Contains(href, "id=") {
			for _, param := range strings.Split(href, "&") {
				if strings.HasPrefix(param, "id=") {
					card.CardID = "H-" + strings.TrimPrefix(param, "id=")
					break
				}
			}
		}
	}

	// カードタイプ（ポケモン/グッズ/サポート/エネルギーなど）
	card.CardType = strings.TrimSpace(s.Find(".card-type, .type").First().Text())

	// イラスト（カード画像URL）
	imgSrc, exists := s.Find("img").First().Attr("src")
	if exists {
		if strings.HasPrefix(imgSrc, "http") {
			card.Illustration = imgSrc
		} else {
			card.Illustration = baseURL + imgSrc
		}
	}

	return card
}
