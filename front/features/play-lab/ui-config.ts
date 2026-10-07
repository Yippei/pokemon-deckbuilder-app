import type { AiStyle, PracticeMode } from "./types";

export const modeOptions: Array<{ value: PracticeMode; label: string; description: string }> = [
  { value: "ai", label: "AI対戦", description: "相手の動きを読みながら、次の一手を確認する" },
  { value: "solo", label: "一人回し", description: "自分の動きだけを整理して、再現性を詰める" },
];

export const aiStyles: Array<{ value: AiStyle; label: string; description: string }> = [
  { value: "speed", label: "速攻", description: "初動と打点を優先" },
  { value: "control", label: "妨害", description: "相手の手札と盤面を崩す" },
  { value: "stability", label: "安定", description: "事故を減らして丁寧に進める" },
  { value: "random", label: "ランダム", description: "試行ごとに動きを変える" },
];

export const typeHints = [
  { type: "all", label: "全て", keywords: [] },
  { type: "normal", label: "無", keywords: ["無", "無色", "ノーマル", "ダブルターボ"] },
  { type: "fire", label: "炎", keywords: ["炎", "ほのお", "リザードン", "ヒトカゲ"] },
  { type: "water", label: "水", keywords: ["水", "みず", "カイオーガ", "ゲッコウガ"] },
  { type: "grass", label: "草", keywords: ["草", "くさ", "フシギ", "ジュナイパー"] },
  { type: "fighting", label: "闘", keywords: ["闘", "とう", "ルカリオ", "ガチグマ"] },
  { type: "psychic", label: "超", keywords: ["超", "ちょう", "サーナイト", "ミュウ"] },
  { type: "dark", label: "悪", keywords: ["悪", "あく", "ブラッキー", "ゲッコウガ"] },
  { type: "dragon", label: "ドラゴン", keywords: ["ドラゴン", "竜"] },
  { type: "electric", label: "雷", keywords: ["雷", "かみなり", "ピカチュウ", "ミライドン"] },
];

export const roomMarks: Array<{
  type: string;
  size: string;
  rotate: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  opacity: number;
}> = [
  { type: "electric", size: "108px", rotate: "12deg", top: "12%", left: "6%", opacity: 0.18 },
  { type: "water", size: "72px", rotate: "-18deg", top: "68%", right: "14%", opacity: 0.12 },
  { type: "fire", size: "84px", rotate: "22deg", top: "16%", right: "6%", opacity: 0.12 },
  { type: "grass", size: "64px", rotate: "-16deg", top: "48%", left: "10%", opacity: 0.1 },
];

