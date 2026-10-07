import type { Deck } from "@/lib/api";
import { typeHints } from "./ui-config";
import type { AiStyle } from "./types";

export function formatProbability(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  const percent = Math.max(0, Math.min(100, value * 100));
  return `${percent.toFixed(percent < 1 && percent > 0 ? 2 : 1)}%`;
}

export function inferType(deck?: Deck | null): string {
  if (!deck) return "all";
  const text = [deck.name, ...deck.cards.map((card) => card.cardName || "")].join(" ").toLowerCase();
  return typeHints.find((typeHint) =>
    typeHint.type !== "all" && typeHint.keywords.some((keyword) => text.includes(keyword.toLowerCase()))
  )?.type || "all";
}

export function inferDeckLabel(deck?: Deck | null): string {
  const type = inferType(deck);
  return typeHints.find((typeHint) => typeHint.type === type)?.label || "全て";
}

export function summarizeDeck(deck?: Deck | null): string {
  if (!deck) return "デッキを選択してください。";
  const totalCards = deck.cards.reduce((sum, card) => sum + card.count, 0);
  const pokemonCards = deck.cards.filter((card) => {
    const name = (card.cardName || "").toLowerCase();
    return !name.includes("エネルギー") && !name.includes("ボール") && !name.includes("サポート");
  }).length;
  return `${totalCards}枚構成 / ${pokemonCards}種のカードを採用 / ${inferDeckLabel(deck)}寄り`;
}

export function buildAiAdvice(deck: Deck | null, style: AiStyle, turn: number): string {
  const deckText = deck ? [deck.name, ...deck.cards.map((card) => card.cardName || "")].join(" ") : "";
  const isFire = /炎|リザードン|ヒトカゲ/.test(deckText);
  const isWater = /水|みず|ゲッコウガ/.test(deckText);
  const isElectric = /雷|ピカチュウ|ミライドン/.test(deckText);
  const isControl = /ナンジャモ|ロスト|妨害|ジャミング|ハンデス/.test(deckText);

  if (style === "speed") {
    if (turn <= 1) {
      return isFire
        ? "初手はヒトカゲ系の展開を優先し、ドロー札を抱えながら次の進化を準備。"
        : isElectric
          ? "初手はたねポケモンを広げて、エネルギーとサーチを同時に整える。"
          : "初手はたねポケモン展開とサーチを優先し、次のターンの打点を作る。";
    }
    return "盤面が整っているので、攻撃を最優先してテンポを取りにいく。";
  }

  if (style === "control") {
    if (turn <= 1) {
      return isControl
        ? "手札干渉札を抱えつつ、相手の初動を崩す準備をする。"
        : "相手の行動を遅らせる札と、盤面維持のカードを優先する。";
    }
    return "相手のリソースを削りながら、自分の盤面を崩さずに進める。";
  }

  if (style === "stability") {
    if (turn <= 1) {
      return isWater
        ? "無理に攻めず、山札から必要札を揃えることを優先する。"
        : "事故を避けるため、たね・サーチ・ドローの順で整える。";
    }
    return "次のターンの余力を残しつつ、盤面の再現性を高める。";
  }

  return turn % 2 === 0
    ? "相手の動きを見てから、展開か妨害かを切り替える。"
    : "いまの情報で最大値を取りにいく。必要なら盤面の作り直しを優先する。";
}


