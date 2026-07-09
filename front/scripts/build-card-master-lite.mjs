#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const inputDir = process.argv[2] || "/private/tmp/pokemon-card-master-current";
const outputPath = process.argv[3] || path.resolve(process.cwd(), "public/card-master-lite.json");

const inputStat = fs.statSync(inputDir);
const sourceCards = inputStat.isFile()
  ? Object.values(JSON.parse(fs.readFileSync(inputDir, "utf8")).cards || {})
  : fs.readdirSync(inputDir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => JSON.parse(fs.readFileSync(path.join(inputDir, file), "utf8")));
const cards = {};
let profiledCount = 0;

for (const card of sourceCards) {
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
  const effectText = stripRuleBoilerplate(ruleText);

  if (!isTrainerCard(card)) {
    return null;
  }

  const drawMatch = effectText.match(/山札を(\d+)枚引/);
  if (drawMatch) {
    const discardRemainingHand = /手札をすべてトラッシュ|手札をすべて山札にもど/.test(effectText);
    return {
      label: buildActionLabel(ruleText, `山札を${drawMatch[1]}枚引く`),
      actions: [{ type: "draw_cards", count: Number(drawMatch[1]), discardRemainingHand }],
    };
  }

  const deckSearch = buildDeckSearchAction(effectText);
  if (deckSearch) {
    return {
      label: buildActionLabel(ruleText, deckSearch.label),
      costs: buildDiscardHandCosts(effectText),
      actions: [deckSearch.action],
    };
  }

  const trashRecovery = buildTrashRecoveryAction(effectText);
  if (trashRecovery) {
    return {
      label: buildActionLabel(ruleText, trashRecovery.label),
      actions: [trashRecovery.action],
    };
  }

  if (/自分の場の.*ポケモンの数と同じ枚数になるように、?山札を引/.test(effectText)) {
    return {
      label: buildActionLabel(ruleText, "場のポケモンの数と同じ枚数になるまで山札を引く"),
      costs: buildDiscardHandCosts(effectText),
      actions: [{ type: "draw_until_board_count" }],
    };
  }

  if (effectText.includes("自分のバトルポケモン") && effectText.includes("ベンチポケモンと入れ替える")) {
    return {
      label: buildActionLabel(ruleText, "自分のバトルポケモンをベンチポケモンと入れ替える"),
      actions: [{ type: "switch_active" }],
    };
  }
  if (effectText.includes("相手のベンチポケモン") && effectText.includes("バトルポケモンと入れ替える")) {
    return autoResolvedProfile(buildActionLabel(ruleText, "相手のベンチポケモンをバトル場と入れ替える"));
  }
  if (
    (effectText.includes("ダメージカウンター") && (effectText.includes("とる") || effectText.includes("回復"))) ||
    /HPを「?\d+」?回復/.test(effectText)
  ) {
    return {
      label: buildActionLabel(ruleText, "自分のポケモンのダメージを回復する"),
      actions: [{ type: "heal_pokemon", note: "ダメージ管理は手動で調整してください。" }],
    };
  }
  if (effectText.includes("エネルギー") && effectText.includes("つけ替える")) {
    return autoResolvedProfile(buildActionLabel(ruleText, "エネルギーをつけ替える"));
  }
  if (effectText.includes("ポケモンのどうぐ") && effectText.includes("トラッシュ")) {
    return {
      label: "ポケモンのどうぐをトラッシュする",
      actions: [{ type: "discard_tool", note: "自分の場についているどうぐを選んでトラッシュします。" }],
    };
  }
  if (effectText.includes("スタジアム") && effectText.includes("トラッシュ")) {
    return {
      label: "スタジアムをトラッシュする",
      actions: [{ type: "discard_stadium", note: "場のスタジアムをトラッシュします。" }],
    };
  }
  if (effectText.includes("相手のポケモンについているエネルギー") && effectText.includes("トラッシュ")) {
    return autoResolvedProfile(buildActionLabel(ruleText, "相手のポケモンについているエネルギーをトラッシュする"));
  }
  if (/手札を1枚選び、?山札の上にもど/.test(effectText)) {
    return {
      label: buildActionLabel(ruleText, "手札を1枚山札の上にもどす"),
      actions: [{ type: "topdeck_setup", count: 1 }],
    };
  }
  if (/効果は、?すべてなくなる|ワザのダメージを受けない|ダメージは「?[+-]?\d+」?/.test(effectText)) {
    return {
      label: buildActionLabel(ruleText, "継続効果"),
      actions: [{ type: "continuous_effect", note: buildActionLabel(ruleText, "継続効果") }],
    };
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
  const ruleText = stripRuleBoilerplate(card.ruleText);
  if (!ruleText) {
    return `${subKind}の効果を自動解決済みにする`;
  }
  const clipped = ruleText.length > 64 ? `${ruleText.slice(0, 64)}...` : ruleText;
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
    .replace(/スタジアムは、自分の番に1枚だけ、バトル場の横に出せる。?/g, "")
    .replace(/別のスタジアムが場に出たなら、このカードをトラッシュする。?/g, "")
    .replace(/別の名前のスタジアムが場に出たなら、このカードをトラッシュする。?/g, "")
    .replace(/同じ名前のスタジアムは場に出せない。?/g, "")
    .trim();
}

function buildDiscardHandCosts(ruleText) {
  const match = ruleText.match(/手札(?:から|を)(?:[^。]*?)(\d+)枚(?:まで)?トラッシュ/);
  if (!match) return undefined;
  return [{ type: "discard_from_hand", count: Number(match[1]) }];
}

function buildDeckSearchAction(ruleText) {
  if (!/(自分の山札(?:から|の|にある|を上から|を下から|の下から)|相手の山札を上から)/.test(ruleText)) return null;
  if (!/(手札に加え|ベンチに出|場に出|つける|進化させ)/.test(ruleText)) return null;

  const target = inferSearchTarget(ruleText);
  const destination = /つける/.test(ruleText)
    ? "attach_energy"
    : /進化させ/.test(ruleText)
      ? "hand"
    : /ベンチに出|場に出/.test(ruleText)
      ? "bench"
      : "hand";
  const count = extractCardCount(ruleText) || 1;
  const look = extractDeckLook(ruleText);
  const remainingDestination = /残りのカードはトラッシュ/.test(ruleText) ? "discard" : "deck";
  const destinationLabel = destination === "attach_energy"
    ? "場のポケモンにつける"
    : destination === "bench"
      ? "ベンチに出す"
      : "手札に加える";
  return {
    label: `山札から${describeSearchTarget(target)}を${count}枚${destinationLabel}`,
    action: {
      type: "search_deck",
      target,
      count,
      destination,
      ...(look ? { look } : {}),
      ...(look ? { remainingDestination } : {}),
    },
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
  if (/進化する1進化ポケモン|1進化ポケモン/.test(text)) return "evolution_pokemon";
  if (/ルールを持つポケモン/.test(text)) return "rule_box_pokemon";
  if (/「マリィのポケモン」|マリィのポケモン/.test(text)) return "marnie_pokemon";
  if (/HP(?:が)?「?70」?以下|HP70以下/.test(text) && text.includes("たねポケモン")) return "pokemon_hp_70_or_less";
  if (/ポケモンex|「ポケモンex」/.test(text)) return "pokemon_ex";
  if (text.includes("メガシンカ") || text.includes("メガ進化")) return "mega_evolution_pokemon";
  if (text.includes("テラスタル")) return "terastal_pokemon";
  if (text.includes("ポケモンのどうぐ") || text.includes("どうぐ")) return "tool";
  if (text.includes("グッズ")) return "item";
  if (text.includes("サポート") || text.includes("サポーター")) return "supporter";
  if (text.includes("スタジアム")) return "stadium";
  if (/ポケモン.*基本\s*エネルギー|基本\s*エネルギー.*ポケモン/.test(text)) return "pokemon_or_basic_energy";
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
    rule_box_pokemon: "ルールを持つポケモン",
    marnie_pokemon: "マリィのポケモン",
    evolution_pokemon: "進化ポケモン",
    pokemon_ex: "ポケモンex",
    item: "グッズ",
    supporter: "サポート",
    tool: "ポケモンのどうぐ",
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

function extractDeckLook(text) {
  const top = text.match(/山札を上から(\d+)枚|山札の上から(\d+)枚/);
  if (top) {
    return { from: "top", count: Number(top[1] || top[2]) };
  }
  const bottom = text.match(/山札を下から(\d+)枚|山札の下から(?:カードを)?(\d+)枚/);
  if (bottom) {
    return { from: "bottom", count: Number(bottom[1] || bottom[2]) };
  }
  const opponentTop = text.match(/相手の山札を上から(\d+)枚/);
  if (opponentTop) {
    return { from: "top", count: Number(opponentTop[1]), opponent: true };
  }
  return null;
}
