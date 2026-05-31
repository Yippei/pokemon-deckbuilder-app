package main

import "testing"

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
