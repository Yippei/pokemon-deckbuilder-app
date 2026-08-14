#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const inputPath = process.argv[2] || path.resolve(process.cwd(), "public/card-master-lite.json");
const outputPath = process.argv[3] || path.resolve(process.cwd(), "public/card-generation-index.json");

const cardMaster = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const cards = Object.values(cardMaster.cards || {}).filter((card) => card?.cardId && card?.name);

const pokemonByName = {};
const pokemonByType = {};
const pokemonByStage = {};
const pokemonByEvolutionFamily = {};
const pokemonWithAbility = [];
const pokemonByAttackEnergy = {};
const trainerBySubkind = {};
const trainerByRole = {};
const energyByType = {};
const specialEnergyByType = {};
const aceSpec = [];
const typeSpecificCards = {};
const characterThemeLockedCards = {};
const genericStaples = [];
const deckPlanCards = {
  stable: [],
  speed: [],
  disruption: [],
  lo: [],
  tank: [],
  combo: [],
};
const knownAceSpecCardNames = new Set([
  "プライムキャッチャー",
  "アンフェアスタンプ",
  "マキシマムベルト",
  "ヒーローマント",
  "ハイパーアロマ",
  "サバイブギプス",
  "レガシーエネルギー",
  "ネオアッパーエネルギー",
  "リブートポッド",
  "ポケモン回収サイクロン",
  "シークレットボックス",
  "ニュートラルセンター",
  "デラックスボム",
  "プレシャスキャリー",
  "偉大な大樹",
  "きらめく結晶",
  "パーフェクトミキサー",
  "エネルギー転送PRO",
  "メガシグナル",
]);
const knownGenericSystemPokemonNames = new Set([
  "キチキギスex",
]);

for (const card of cards) {
  const summary = summarizeCard(card);

  if (card.cardKind === "pokemon") {
    addToIndex(pokemonByName, normalizeName(card.name), summary);
    for (const type of card.types || []) {
      addToIndex(pokemonByType, type, summary);
    }
    addToIndex(pokemonByStage, card.stageCategory || "unknown", summary);
    if (card.familyId) {
      addToIndex(pokemonByEvolutionFamily, normalizeName(card.familyId), summary);
    }
    if ((card.abilities || []).length > 0) {
      pokemonWithAbility.push({
        ...summary,
        abilityNames: (card.abilities || []).map((ability) => ability.name).filter(Boolean),
        systemRoles: inferSystemPokemonRoles(card),
        offTypeAllowed: isGenericSystemPokemon(card),
      });
    }
    for (const type of inferAttackEnergyTypes(card)) {
      addToIndex(pokemonByAttackEnergy, type, summary);
    }
    const ownerTheme = inferCharacterThemeLock(card);
    if (ownerTheme) {
      addToIndex(characterThemeLockedCards, ownerTheme, {
        ...summary,
        roles: inferSystemPokemonRoles(card),
      });
    }
    continue;
  }

  if (card.cardKind === "trainer") {
    addToIndex(trainerBySubkind, card.subKind || "unknown", summary);
    const roles = inferTrainerRoles(card);
    for (const role of roles) {
      addToIndex(trainerByRole, role, summary);
    }
    addToDeckPlanIndexes(deckPlanCards, summary, roles, card);
  }

  if (card.cardKind === "energy") {
    const energyType = inferEnergyType(card);
    if (isBasicEnergy(card)) {
      if (energyType) energyByType[energyType] = summary;
    } else {
      if (energyType) addToIndex(specialEnergyByType, energyType, summary);
    }
  }

  if (isAceSpecCard(card)) {
    aceSpec.push({
      ...summary,
      roles: inferTrainerRoles(card),
      energyType: inferEnergyType(card),
    });
  }

  for (const type of inferTypeSpecificTypes(card)) {
    addToIndex(typeSpecificCards, type, {
      ...summary,
      roles: card.cardKind === "trainer" ? inferTrainerRoles(card) : [],
      energyType: card.cardKind === "energy" ? inferEnergyType(card) : undefined,
    });
  }

  const ownerTheme = inferCharacterThemeLock(card);
  if (ownerTheme) {
    addToIndex(characterThemeLockedCards, ownerTheme, {
      ...summary,
      roles: card.cardKind === "trainer" ? inferTrainerRoles(card) : inferSystemPokemonRoles(card),
    });
  }

  if (isGenericStaple(card)) {
    genericStaples.push({
      ...summary,
      roles: card.cardKind === "trainer" ? inferTrainerRoles(card) : inferSystemPokemonRoles(card),
      preferredCount: inferPreferredCount(card),
    });
  }
}

sortIndex(pokemonByName, comparePokemonCandidate);
sortIndex(pokemonByType, comparePokemonCandidate);
sortIndex(pokemonByStage, comparePokemonCandidate);
sortIndex(pokemonByEvolutionFamily, comparePokemonCandidate);
sortIndex(pokemonByAttackEnergy, compareCardSummary);
sortIndex(trainerBySubkind, compareCardSummary);
sortIndex(trainerByRole, compareCardSummary);
sortIndex(specialEnergyByType, compareCardSummary);
sortIndex(typeSpecificCards, compareCardSummary);
sortIndex(characterThemeLockedCards, compareCardSummary);
sortIndex(deckPlanCards, compareCardSummary);
pokemonWithAbility.sort(compareCardSummary);
aceSpec.sort(compareCardSummary);
genericStaples.sort((a, b) => (b.preferredCount || 0) - (a.preferredCount || 0) || compareCardSummary(a, b));

const payload = {
  generatedAt: new Date().toISOString(),
  source: {
    inputPath,
    masterGeneratedAt: cardMaster.generatedAt || null,
    totalCards: cards.length,
    assumption: "カードマスター内のカードはすべてスタンダードレギュレーション対象として扱う",
  },
  policy: {
    candidateMode: "strict",
    energyBudget: {
      defaultMin: 8,
      defaultMax: 11,
      exceptionMax: 12,
      forceFixAt: 13,
      hardRejectAt: 15,
    },
    offTypeSystemPokemon: {
      allowed: true,
      maxCopiesPerName: 2,
      energyCostIgnoredForBasicEnergyBudget: true,
    },
    characterThemeCards: {
      mode: "manual_lock_list_first",
      allowOnlyWhenThemeMatches: true,
    },
  },
  counts: {
    pokemonByName: countIndexEntries(pokemonByName),
    pokemonByType: countIndexEntries(pokemonByType),
    pokemonByStage: countIndexEntries(pokemonByStage),
    pokemonByEvolutionFamily: countIndexEntries(pokemonByEvolutionFamily),
    pokemonWithAbility: pokemonWithAbility.length,
    pokemonByAttackEnergy: countIndexEntries(pokemonByAttackEnergy),
    trainerBySubkind: countIndexEntries(trainerBySubkind),
    trainerByRole: countIndexEntries(trainerByRole),
    energyByType: Object.keys(energyByType).length,
    specialEnergyByType: countIndexEntries(specialEnergyByType),
    aceSpec: aceSpec.length,
    typeSpecificCards: countIndexEntries(typeSpecificCards),
    characterThemeLockedCards: countIndexEntries(characterThemeLockedCards),
    genericStaples: genericStaples.length,
    deckPlanCards: countIndexEntries(deckPlanCards),
  },
  uniqueNameCounts: {
    pokemonByName: Object.keys(pokemonByName).length,
    pokemonByType: countUniqueIndexNames(pokemonByType),
    pokemonByStage: countUniqueIndexNames(pokemonByStage),
    pokemonByEvolutionFamily: countUniqueIndexNames(pokemonByEvolutionFamily),
    pokemonWithAbility: uniqueByName(pokemonWithAbility).length,
    pokemonByAttackEnergy: countUniqueIndexNames(pokemonByAttackEnergy),
    trainerBySubkind: countUniqueIndexNames(trainerBySubkind),
    trainerByRole: countUniqueIndexNames(trainerByRole),
    energyByType: Object.keys(energyByType).length,
    specialEnergyByType: countUniqueIndexNames(specialEnergyByType),
    aceSpec: uniqueByName(aceSpec).length,
    typeSpecificCards: countUniqueIndexNames(typeSpecificCards),
    characterThemeLockedCards: countUniqueIndexNames(characterThemeLockedCards),
    genericStaples: uniqueByName(genericStaples).length,
    deckPlanCards: countUniqueIndexNames(deckPlanCards),
  },
  samples: {
    trainerByRole: sampleIndex(trainerByRole),
    typeSpecificCards: sampleIndex(typeSpecificCards),
    characterThemeLockedCards: sampleIndex(characterThemeLockedCards),
    deckPlanCards: sampleIndex(deckPlanCards),
    genericStaples: uniqueByName(genericStaples).slice(0, 20).map((card) => card.name),
    offTypeSystemPokemon: uniqueByName(pokemonWithAbility
      .filter((card) => card.offTypeAllowed)
    )
      .slice(0, 20)
      .map((card) => card.name),
  },
  indexes: {
    pokemonByName,
    pokemonByType,
    pokemonByStage,
    pokemonByEvolutionFamily,
    pokemonWithAbility,
    pokemonByAttackEnergy,
    trainerBySubkind,
    trainerByRole,
    energyByType,
    specialEnergyByType,
    aceSpec,
    typeSpecificCards,
    characterThemeLockedCards,
    genericStaples,
    deckPlanCards,
  },
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload)}\n`, "utf8");
console.log(JSON.stringify({
  ok: true,
  outputPath,
  totalCards: payload.source.totalCards,
  counts: payload.counts,
}, null, 2));

function summarizeCard(card) {
  return {
    cardId: card.cardId,
    name: card.name,
    cardKind: card.cardKind,
    subKind: card.subKind,
    stageCategory: card.stageCategory,
    stageOrder: Number(card.stageOrder || 0),
    evolvesFrom: card.evolvesFrom || "",
    familyId: card.familyId || "",
    hp: Number(card.hp || 0),
    types: Array.isArray(card.types) ? card.types : [],
    imageUrl: card.imageUrl || "",
  };
}

function addToIndex(index, key, value) {
  const normalizedKey = String(key || "unknown").trim() || "unknown";
  if (!index[normalizedKey]) index[normalizedKey] = [];
  if (!index[normalizedKey].some((item) => item.cardId === value.cardId)) {
    index[normalizedKey].push(value);
  }
}

function sortIndex(index, compare) {
  for (const key of Object.keys(index)) {
    index[key].sort(compare);
  }
}

function sampleIndex(index, limit = 10) {
  return Object.fromEntries(
    Object.entries(index).map(([key, values]) => [key, uniqueByName(values).slice(0, limit).map((card) => card.name)])
  );
}

function uniqueByName(values) {
  const seen = new Set();
  return values.filter((card) => {
    const key = normalizeName(card.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countIndexEntries(index) {
  return Object.values(index).reduce((sum, values) => sum + values.length, 0);
}

function countUniqueIndexNames(index) {
  const names = new Set();
  for (const values of Object.values(index)) {
    for (const card of values) {
      names.add(normalizeName(card.name));
    }
  }
  return names.size;
}

function comparePokemonCandidate(a, b) {
  return a.stageOrder - b.stageOrder ||
    String(a.name).localeCompare(String(b.name), "ja") ||
    Number(a.cardId || 0) - Number(b.cardId || 0);
}

function compareCardSummary(a, b) {
  return String(a.subKind || "").localeCompare(String(b.subKind || ""), "ja") ||
    String(a.name || "").localeCompare(String(b.name || ""), "ja") ||
    Number(a.cardId || 0) - Number(b.cardId || 0);
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[ぁ-ん]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60))
    .replace(/[ 　・･\-－]/g, "")
    .toLowerCase();
}

function normalizedText(card) {
  return [
    card.name,
    card.ruleText,
    ...(card.abilities || []).map((ability) => `${ability.name || ""} ${ability.text || ""}`),
    ...(card.attacks || []).map((attack) => `${attack.name || ""} ${attack.cost || ""} ${attack.text || ""}`),
  ].join(" ").replace(/\s+/g, "");
}

function inferTrainerRoles(card) {
  const text = normalizedText(card);
  const roles = new Set();
  if (/山札.*ポケモン|ポケモン.*山札/.test(text)) roles.add("pokemon_search");
  if (/たねポケモン/.test(text)) roles.add("basic_pokemon_search");
  if (/進化ポケモン|1進化|2進化|進化させ/.test(text)) roles.add("evolution_search");
  if (/HP.*(以下|まで).*ポケモン|ポケモン.*HP.*(以下|まで)/.test(text)) roles.add("hp_limited_pokemon_search");
  if (/山札.*エネルギー|エネルギー.*山札/.test(text)) roles.add("energy_search");
  if (/基本.*エネルギー|基本エネルギー/.test(text)) roles.add("basic_energy_search");
  if (/特殊.*エネルギー|特殊エネルギー/.test(text)) roles.add("special_energy_search");
  if (/山札.*引|カードを.*引|手札.*引/.test(text)) roles.add("draw");
  if (/手札.*山札.*引|山札にもどして.*引|山札に戻して.*引/.test(text)) roles.add("hand_refresh");
  if (/相手.*手札|おたがい.*手札/.test(text)) roles.add("opponent_hand_disruption");
  if (/自分のバトルポケモン.*ベンチ|バトルポケモン.*入れ替|ポケモンいれかえ/.test(text)) roles.add("switch");
  if (/相手.*ベンチ.*バトル場|相手.*ベンチポケモン.*入れ替|ボスの指令|ポケモンキャッチャー/.test(text)) roles.add("gust");
  if (/トラッシュ.*手札|トラッシュ.*山札|回収/.test(text)) roles.add("recovery");
  if (/HP.*回復|ダメージカウンター.*とる|きずぐすり/.test(text)) roles.add("heal");
  if (/エネルギー.*つけ|エネルギー.*加速|トラッシュ.*エネルギー.*つけ/.test(text)) roles.add("energy_acceleration");
  if (/エネルギー.*つけ替|エネルギー.*移し替/.test(text)) roles.add("energy_move");
  if (/エネルギー.*トラッシュ/.test(text)) roles.add("energy_discard");
  if (/山札.*上|山札の上/.test(text)) roles.add("topdeck_setup");
  if (/ポケモンのどうぐ/.test(text) || card.subKind === "ポケモンのどうぐ") roles.add("tool");
  if (/スタジアム/.test(text) || card.subKind === "スタジアム") roles.add("stadium");
  if (/スタジアム.*トラッシュ/.test(text)) roles.add("stadium_discard");
  if (/どうぐ.*トラッシュ|ポケモンのどうぐ.*トラッシュ/.test(text)) roles.add("tool_discard");
  if (isAceSpecCard(card)) roles.add("ace_spec");
  if (roles.size === 0 && card.cardKind === "trainer") roles.add("misc_trainer");
  return [...roles];
}

function inferSystemPokemonRoles(card) {
  const text = normalizedText(card);
  const roles = new Set();
  if (/山札.*引|カードを.*引/.test(text)) roles.add("ability_draw");
  if (/山札.*ポケモン|ポケモン.*山札/.test(text)) roles.add("ability_pokemon_search");
  if (/山札.*エネルギー|エネルギー.*山札/.test(text)) roles.add("ability_energy_search");
  if (/エネルギー.*つけ|エネルギー.*加速/.test(text)) roles.add("ability_energy_acceleration");
  if (/トラッシュ.*手札|トラッシュ.*山札|回収/.test(text)) roles.add("ability_recovery");
  if (/ベンチ.*バトル場|バトルポケモン.*入れ替/.test(text)) roles.add("ability_switch");
  if (/相手.*ベンチ.*バトル場/.test(text)) roles.add("ability_gust");
  if (/ダメカン|ダメージカウンター/.test(text)) roles.add("ability_damage_counter");
  if (roles.size === 0) roles.add("ability_misc");
  return [...roles];
}

function inferAttackEnergyTypes(card) {
  const types = new Set();
  for (const attack of card.attacks || []) {
    for (const cost of attack.cost || []) {
      const type = normalizeEnergyType(cost);
      if (type) types.add(type);
    }
  }
  return [...types];
}

function normalizeEnergyType(value) {
  const text = String(value || "").replace(/[ 　・\-－]/g, "");
  if (!text || /無|無色|Colorless/i.test(text)) return "";
  for (const type of ["草", "炎", "水", "雷", "超", "闘", "悪", "鋼"]) {
    if (text.includes(type)) return type;
  }
  return "";
}

function inferEnergyType(card) {
  const text = normalizedText(card);
  for (const type of ["草", "炎", "水", "雷", "超", "闘", "悪", "鋼"]) {
    if (card.name === `基本${type}エネルギー`) return type;
    if (text.includes(`${type}エネルギー`) || text.includes(`${type}ポケモン`) || text.includes(`${type}タイプ`)) return type;
  }
  return "";
}

function inferTypeSpecificTypes(card) {
  if (card.cardKind === "pokemon") return [];
  if (isBasicEnergy(card)) return [];
  const text = normalizedText(card);
  return ["草", "炎", "水", "雷", "超", "闘", "悪", "鋼"].filter((type) => (
    text.includes(`${type}エネルギー`) ||
    text.includes(`${type}ポケモン`) ||
    text.includes(`${type}タイプ`)
  ));
}

function inferCharacterThemeLock(card) {
  const normalizedName = normalizeName(card.name);
  const normalized = normalizeName(normalizedText(card));
  const themeNames = ["カスミ", "ヒビキ", "ロケット団", "N", "リーリエ", "マリィ"];
  for (const theme of themeNames) {
    const key = normalizeName(theme);
    if (normalizedName.includes(key) && /の/.test(card.name)) return theme;
    if (normalized.includes(`${key}ノポケモン`) || normalized.includes(`${key}ノ`)) return theme;
  }
  return "";
}

function isAceSpecCard(card) {
  const text = normalizedText(card);
  return knownAceSpecCardNames.has(card.name || "") || /ACESPEC|ACE|エーススペック/i.test(text);
}

function isBasicEnergy(card) {
  return card.cardKind === "energy" && (
    card.subKind === "基本エネルギー" ||
    /^基本(草|炎|水|雷|超|闘|悪|鋼)エネルギー$/.test(card.name || "")
  );
}

function isGenericSystemPokemon(card) {
  if (card.cardKind !== "pokemon") return false;
  return knownGenericSystemPokemonNames.has(card.name || "");
}

function isGenericStaple(card) {
  const name = card.name || "";
  const genericNames = new Set([
    "ネストボール",
    "ハイパーボール",
    "なかよしポフィン",
    "ポフィン",
    "大地の器",
    "ポケギア3.0",
    "ポケモンいれかえ",
    "夜のタンカ",
    "ふしぎなアメ",
    "ボスの指令",
    "ナンジャモ",
    "博士の研究",
    "ジャッジマン",
    "すごいつりざお",
    "カウンターキャッチャー",
    "プライムキャッチャー",
    "ポケパッド",
  ]);
  return genericNames.has(name);
}

function inferPreferredCount(card) {
  const roles = card.cardKind === "trainer" ? inferTrainerRoles(card) : inferSystemPokemonRoles(card);
  if (isAceSpecCard(card)) return 1;
  if (roles.includes("pokemon_search") && card.subKind === "グッズ") return 4;
  if (roles.includes("hand_refresh")) return 2;
  if (roles.includes("draw")) return 2;
  if (roles.includes("switch")) return 1;
  if (roles.includes("gust")) return 1;
  return 1;
}

function addToDeckPlanIndexes(index, summary, roles, card) {
  if (roles.includes("pokemon_search") || roles.includes("draw") || roles.includes("hand_refresh")) {
    index.stable.push(summary);
  }
  if (roles.includes("pokemon_search") || roles.includes("energy_acceleration") || roles.includes("switch")) {
    index.speed.push(summary);
  }
  if (roles.includes("hand_refresh") || roles.includes("opponent_hand_disruption") || roles.includes("gust")) {
    index.disruption.push(summary);
  }
  if (roles.includes("recovery") || roles.includes("stadium_discard") || roles.includes("opponent_hand_disruption")) {
    index.lo.push(summary);
  }
  if (roles.includes("heal") || roles.includes("recovery") || roles.includes("tool") || card.subKind === "スタジアム") {
    index.tank.push(summary);
  }
  if (roles.includes("pokemon_search") || roles.includes("energy_search") || roles.includes("draw") || roles.includes("topdeck_setup") || roles.includes("recovery")) {
    index.combo.push(summary);
  }
}
