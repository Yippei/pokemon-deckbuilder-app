import type { DeckCard } from "@/lib/api";
import {
  buildCardDetailNameIndex,
  getAllowedPreEvolutionNames,
  getCardDetailForDeckCard,
  getCardPlacementType,
  getStageOrder,
} from "./card-rules";
import type { SoloCard, StaticCardDetail } from "./types";

export function expandDeck(cards: DeckCard[], cardDetails: Record<string, StaticCardDetail> = {}): SoloCard[] {
  const detailNameIndex = buildCardDetailNameIndex(cardDetails);
  return cards.flatMap((card) =>
    Array.from({ length: card.count }, (_, copyIndex) => {
      const detail = getCardDetailForDeckCard(card, cardDetails, detailNameIndex);
      return {
      soloInstanceId: `${card.cardId}-${copyIndex}-${Math.random().toString(36).slice(2, 10)}`,
      cardId: card.cardId,
      cardName: card.cardName,
      illustration: card.illustration,
      count: 1,
      name: detail?.name || card.cardName,
      cardKind: detail?.cardKind || "unknown",
      subKind: detail?.subKind || "",
      regulation: detail?.regulation,
      setCode: detail?.setCode,
      setName: detail?.setName,
      evolvesFrom: detail?.evolvesFrom,
      familyId: detail?.familyId,
      allowedPreEvolutionNames: getAllowedPreEvolutionNames(detail, cardDetails),
      types: detail?.types || [],
      stage: detail?.stage || "",
      stageCategory: detail?.stageCategory || "unknown",
      stageOrder: detail?.stageOrder,
      hp: detail?.hp,
      attacks: detail?.attacks || [],
      abilities: detail?.abilities || [],
      ruleText: detail?.ruleText,
      searchTokens: detail?.searchTokens || [],
      effectProfile: detail?.effectProfile || null,
    };
    })
  );
}

export function takeRandomCards(pile: SoloCard[], count: number) {
  const nextPile = [...pile];
  const drawn: SoloCard[] = [];
  const drawCount = Math.max(0, Math.min(count, nextPile.length));

  for (let i = 0; i < drawCount; i += 1) {
    const index = Math.floor(Math.random() * nextPile.length);
    const [card] = nextPile.splice(index, 1);
    if (card) {
      drawn.push(card);
    }
  }

  return { drawn, rest: nextPile };
}

export function hasBasicPokemon(cards: SoloCard[]) {
  return cards.some((card) => getCardPlacementType(card) === "pokemon" && getStageOrder(card) === 0);
}

export function getNoBasicOpeningProbability(totalCards: number, basicPokemonCount: number, handSize = 7) {
  if (totalCards <= 0 || basicPokemonCount <= 0 || handSize <= 0) return 1;
  if (basicPokemonCount >= totalCards) return 0;
  const drawCount = Math.min(handSize, totalCards);
  let probability = 1;
  for (let index = 0; index < drawCount; index += 1) {
    probability *= Math.max(0, totalCards - basicPokemonCount - index) / Math.max(1, totalCards - index);
  }
  return probability;
}
