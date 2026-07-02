#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const inputDir = process.argv[2] || "/private/tmp/pokemon-card-master-current";
const outputPath = process.argv[3] || path.resolve(process.cwd(), "public/card-master-lite.json");

const files = fs.readdirSync(inputDir).filter((file) => file.endsWith(".json"));
const cards = {};
let profiledCount = 0;

for (const file of files) {
  const card = JSON.parse(fs.readFileSync(path.join(inputDir, file), "utf8"));
  const effectProfile = buildEffectProfile(card);
  if (effectProfile) profiledCount += 1;

  cards[card.cardId] = {
    cardId: card.cardId,
    name: card.name,
    cardKind: card.cardKind,
    subKind: card.subKind,
    regulation: card.regulation,
    setCode: card.setCode,
    setName: card.setName,
    stage: card.stage,
    stageCategory: card.stageCategory,
    evolvesFrom: card.evolvesFrom,
    familyId: card.familyId,
    stageOrder: card.stageOrder,
    hp: card.hp,
    types: card.types,
    attacks: card.attacks,
    abilities: card.abilities,
    ruleText: card.ruleText,
    searchTokens: card.searchTokens,
    officialUrl: card.officialUrl,
    imageUrl: card.imageUrl,
    effectProfile,
  };
}

const payload = {
  generatedAt: new Date().toISOString(),
  source: {
    kind: "s3-card-master-current",
    inputDir,
  },
  totalCards: Object.keys(cards).length,
  profiledCards: profiledCount,
  cards,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload)}\n`, "utf8");
console.log(JSON.stringify({
  ok: true,
  outputPath,
  totalCards: payload.totalCards,
  profiledCards: payload.profiledCards,
}, null, 2));

function buildEffectProfile(card) {
  const ruleText = normalizeRuleText(card.ruleText);

  if (!isTrainerCard(card)) {
    return null;
  }

  const drawMatch = ruleText.match(/山札を(\d+)枚引/);
  if (drawMatch) {
    const discardRemainingHand = /手札をすべてトラッシュ|手札をすべて山札にもど/.test(ruleText);
    return {
      label: buildActionLabel(ruleText, `山札を${drawMatch[1]}枚引く`),
      actions: [{ type: "draw_cards", count: Number(drawMatch[1]), discardRemainingHand }],
    };
  }

  const deckSearch = buildDeckSearchAction(ruleText);
  if (deckSearch) {
    return {
      label: buildActionLabel(ruleText, deckSearch.label),
      costs: buildDiscardHandCosts(ruleText),
      actions: [deckSearch.action],
    };
  }

  const trashRecovery = buildTrashRecoveryAction(ruleText);
  if (trashRecovery) {
    return {
      label: buildActionLabel(ruleText, trashRecovery.label),
      actions: [trashRecovery.action],
    };
  }

  if (ruleText.includes("自分のバトルポケモン") && ruleText.includes("ベンチポケモンと入れ替える")) {
    return {
      label: buildActionLabel(ruleText, "自分のバトルポケモンをベンチポケモンと入れ替える"),
      actions: [{ type: "switch_active" }],
    };
  }
  if (ruleText.includes("相手のベンチポケモン") && ruleText.includes("バトルポケモンと入れ替える")) {
    return autoResolvedProfile(buildActionLabel(ruleText, "相手のベンチポケモンをバトル場と入れ替える"));
  }
  if (ruleText.includes("ダメージカウンター") && (ruleText.includes("とる") || ruleText.includes("回復"))) {
    return {
      label: buildActionLabel(ruleText, "自分のポケモンのダメージを回復する"),
      actions: [{ type: "heal_pokemon", note: "ダメージ管理は手動で調整してください。" }],
    };
  }
  if (ruleText.includes("ポケモンのどうぐ") && ruleText.includes("トラッシュ")) {
    return {
      label: "ポケモンのどうぐをトラッシュする",
      actions: [{ type: "discard_tool", note: "自分の場についているどうぐを選んでトラッシュします。" }],
    };
  }
  if (ruleText.includes("スタジアム") && ruleText.includes("トラッシュ")) {
    return {
      label: "スタジアムをトラッシュする",
      actions: [{ type: "discard_stadium", note: "場のスタジアムをトラッシュします。" }],
    };
  }
  if (ruleText.includes("エネルギー") && ruleText.includes("つけ替える")) {
    return autoResolvedProfile(buildActionLabel(ruleText, "エネルギーをつけ替える"));
  }
  if (ruleText.includes("相手のポケモンについているエネルギー") && ruleText.includes("トラッシュ")) {
    return autoResolvedProfile(buildActionLabel(ruleText, "相手のポケモンについているエネルギーをトラッシュする"));
  }

  return autoResolvedProfile(buildAutoResolvedNote(card));
}

function autoResolvedProfile(note) {
  return {
    label: note,
    actions: [{ type: "resolve_effect", note }],
  };
}

function isTrainerCard(card) {
  const text = [card.cardKind, card.subKind, card.stage].join(" ");
  return /trainer|item|support|グッズ|サポート|サポーター|ポケモンのどうぐ|スタジアム/.test(text);
}

function buildAutoResolvedNote(card) {
  const subKind = String(card.subKind || card.stage || "トレーナーズ");
  const ruleText = normalizeRuleText(card.ruleText);
  if (!ruleText) {
    return `${subKind}の効果を自動解決済みにする`;
  }
  const mainText = ruleText
    .replace(/グッズは、自分の番に何枚でも使える。?/g, "")
    .replace(/サポートは、自分の番に1枚しか使えない。?/g, "")
    .replace(/サポーターは、自分の番に1枚しか使えない。?/g, "")
    .trim();
  const clipped = mainText.length > 64 ? `${mainText.slice(0, 64)}...` : mainText;
  return clipped || `${subKind}の効果を自動解決済みにする`;
}

function extractCountBefore(text, suffix) {
  const match = text.match(new RegExp(`(\\d+)${suffix}`));
  return match ? Number(match[1]) : null;
}

function normalizeRuleText(ruleText) {
  return String(ruleText || "").replace(/\s+/g, " ").trim();
}

function buildActionLabel(ruleText, fallback) {
  const note = stripRuleBoilerplate(ruleText);
  if (!note) return fallback;
  return note.length > 72 ? `${note.slice(0, 72)}...` : note;
}

function stripRuleBoilerplate(ruleText) {
  return normalizeRuleText(ruleText)
    .replace(/グッズは、自分の番に何枚でも使える。?/g, "")
    .replace(/サポートは、自分の番に1枚しか使えない。?/g, "")
    .replace(/サポーターは、自分の番に1枚しか使えない。?/g, "")
    .replace(/ポケモンのどうぐは、自分の番に何枚でも、自分のポケモンにつけられる。?/g, "")
    .replace(/ポケモン1匹につき1枚だけつけられ、つけたままにする。?/g, "")
    .replace(/スタジアムは、自分の番に1枚、バトル場の横に出せる。?/g, "")
    .replace(/別のスタジアムが場に出たなら、このカードをトラッシュする。?/g, "")
    .replace(/同じ名前のスタジアムは場に出せない。?/g, "")
    .trim();
}

function buildDiscardHandCosts(ruleText) {
  const match = ruleText.match(/手札(?:から|を)(?:[^。]*?)(\d+)枚(?:まで)?トラッシュ/);
  if (!match) return undefined;
  return [{ type: "discard_from_hand", count: Number(match[1]) }];
}

function buildDeckSearchAction(ruleText) {
  if (!ruleText.includes("自分の山札から")) return null;
  if (!/(手札に加える|ベンチに出|場に出)/.test(ruleText)) return null;

  const target = inferSearchTarget(ruleText);
  const destination = target === "stadium"
    ? "stadium"
    : /ベンチに出|場に出/.test(ruleText)
      ? "bench"
      : "hand";
  const count = extractCardCount(ruleText) || 1;
  const destinationLabel = destination === "bench" ? "ベンチに出す" : "手札に加える";
  return {
    label: `山札から${describeSearchTarget(target)}を${count}枚${destinationLabel}`,
    action: { type: "search_deck", target, count, destination },
  };
}

function buildTrashRecoveryAction(ruleText) {
  if (!ruleText.includes("自分のトラッシュから") || !ruleText.includes("手札に加える")) return null;
  const target = inferSearchTarget(ruleText);
  const count = extractCardCount(ruleText) || 1;
  return {
    label: `トラッシュから${describeSearchTarget(target)}を${count}枚手札に加える`,
    action: { type: "recover_from_trash", target, count, destination: "hand" },
  };
}

function inferSearchTarget(text) {
  if (/HP(?:が)?「?70」?以下|HP70以下/.test(text) && text.includes("たねポケモン")) return "pokemon_hp_70_or_less";
  if (text.includes("メガシンカ") || text.includes("メガ進化")) return "mega_evolution_pokemon";
  if (text.includes("テラスタル")) return "terastal_pokemon";
  if (text.includes("サポート") || text.includes("サポーター")) return "supporter";
  if (text.includes("スタジアム")) return "stadium";
  if (text.includes("ポケモンまたは基本エネルギー")) return "pokemon_or_basic_energy";
  if (text.includes("基本エネルギー")) return "basic_energy";
  if (text.includes("エネルギー")) return "energy";
  if (text.includes("たねポケモン")) return "basic_pokemon";
  if (text.includes("ポケモン")) return "pokemon";
  return "any_card";
}

function describeSearchTarget(target) {
  const labels = {
    any_card: "カード",
    pokemon: "ポケモン",
    basic_pokemon: "たねポケモン",
    pokemon_hp_70_or_less: "HP70以下のたねポケモン",
    pokemon_or_basic_energy: "ポケモンまたは基本エネルギー",
    supporter: "サポート",
    mega_evolution_pokemon: "メガシンカポケモン",
    terastal_pokemon: "テラスタルのポケモン",
    energy: "エネルギー",
    basic_energy: "基本エネルギー",
    stadium: "スタジアム",
  };
  return labels[target] || "カード";
}

function extractCardCount(text) {
  const direct = text.match(/(\d+)枚(?:まで)?(?:選び|選ぶ|、|を|手札|ベンチ|場)/);
  if (direct) return Number(direct[1]);
  const quoted = text.match(/「?(\d+)」?枚(?:まで)?/);
  if (quoted) return Number(quoted[1]);
  return extractCountBefore(text, "枚まで") || extractCountBefore(text, "枚選び");
}
