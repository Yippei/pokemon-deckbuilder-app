#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const SOURCE_ORIGIN = "https://www.pokemon-card.com";
const DEFAULT_SEARCH_URL = "https://www.pokemon-card.com/card-search/index.php?keyword=&se_ta=&regulation_sidebar_form=XY&pg=&illust=&sm_and_keyword=true";
const cwd = process.cwd();
const args = parseArgs(process.argv.slice(2));
const searchUrl = args.url || DEFAULT_SEARCH_URL;
const expectedTotal = args.expectedTotal ? Number(args.expectedTotal) : null;
const masterPath = path.resolve(cwd, args.master || "public/card-master-lite.json");
const outputPath = path.resolve(cwd, args.output || "public/card-master-lite.json");
const mergedRawPath = path.resolve(cwd, args.rawOutput || "../tmp/card-master-merged-current.json");
const reportPath = path.resolve(cwd, args.report || `../docs/card-master-update-${new Date().toISOString().slice(0, 10)}.md`);

const existingMaster = JSON.parse(fs.readFileSync(masterPath, "utf8"));
const existingCards = existingMaster.cards || {};
const existingIds = new Set(Object.keys(existingCards).map(String));

const officialCards = await fetchAllOfficialCards(searchUrl);
const officialById = new Map(officialCards.map((card) => [String(card.cardID), card]));
const newSummaries = [...officialById.values()]
  .filter((card) => !existingIds.has(String(card.cardID)))
  .sort((a, b) => Number(a.cardID) - Number(b.cardID));

if (expectedTotal && officialById.size !== expectedTotal) {
  throw new Error(`公式検索の総数が想定と違います: expected=${expectedTotal}, actual=${officialById.size}`);
}

console.log(JSON.stringify({
  existingTotal: Object.keys(existingCards).length,
  officialTotal: officialById.size,
  newCount: newSummaries.length,
  firstNewId: newSummaries[0]?.cardID || null,
  lastNewId: newSummaries.at(-1)?.cardID || null,
}, null, 2));

const newCards = [];
for (let index = 0; index < newSummaries.length; index += 1) {
  const summary = newSummaries[index];
  const cardId = String(summary.cardID);
  const detailUrl = `${SOURCE_ORIGIN}/card-search/details.php/card/${encodeURIComponent(cardId)}/regu/XY`;
  const html = await fetchText(detailUrl);
  const card = parseDetailCard(html, summary, detailUrl);
  newCards.push(card);
  console.log(`[${index + 1}/${newSummaries.length}] ${card.cardId} ${card.name}`);
  await sleep(120);
}

const mergedCards = {};
for (const card of Object.values(existingCards)) {
  mergedCards[String(card.cardId)] = card;
}
for (const card of newCards) {
  mergedCards[String(card.cardId)] = card;
}

fs.mkdirSync(path.dirname(mergedRawPath), { recursive: true });
fs.writeFileSync(mergedRawPath, `${JSON.stringify({ cards: sortCardsById(mergedCards) })}\n`, "utf8");

writeReport({
  reportPath,
  searchUrl,
  existingTotal: Object.keys(existingCards).length,
  officialTotal: officialById.size,
  newCards,
  mergedRawPath,
  outputPath,
});

console.log(JSON.stringify({
  ok: true,
  mergedRawPath,
  reportPath,
  newCount: newCards.length,
}, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    parsed[key] = argv[index + 1];
    index += 1;
  }
  return parsed;
}

async function fetchAllOfficialCards(url) {
  const first = await fetchOfficialPage(url, 1);
  const maxPage = Number(first.maxPage || 1);
  const cards = [...(first.cardList || [])];
  for (let page = 2; page <= maxPage; page += 1) {
    const data = await fetchOfficialPage(url, page);
    cards.push(...(data.cardList || []));
    await sleep(80);
  }
  const unique = new Map();
  for (const card of cards) {
    if (card?.cardID) unique.set(String(card.cardID), card);
  }
  return [...unique.values()].sort((a, b) => Number(a.cardID) - Number(b.cardID));
}

async function fetchOfficialPage(inputUrl, page) {
  const url = new URL(inputUrl);
  url.pathname = "/card-search/resultAPI.php";
  url.searchParams.set("page", String(page));
  const data = await fetchJson(url.toString());
  if (!data || (data.result !== "true" && data.result !== true && data.result !== 1)) {
    throw new Error(`公式検索APIの取得に失敗しました: page=${page}, result=${JSON.stringify(data?.result)}, errMsg=${JSON.stringify(data?.errMsg)}`);
  }
  return data;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "referer": `${SOURCE_ORIGIN}/card-search/`,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "referer": `${SOURCE_ORIGIN}/card-search/`,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

function parseDetailCard(html, summary, officialUrl) {
  const cardId = String(summary.cardID);
  const name = text(match(html, /<h1 class="Heading1 mt20">([\s\S]*?)<\/h1>/)) || text(summary.cardNameViewText);
  const imagePath = attr(match(html, /<img class="fit"([\s\S]*?)\/>/), "src") || summary.cardThumbFile || "";
  const imageUrl = absoluteUrl(imagePath);
  const cardKind = inferCardKind(imageUrl);
  const setCode = attr(match(html, /<img src="\/assets\/images\/card\/regulation_logo_[^"]+" class="img-regulation"([^>]*?)>/), "alt") || inferSetCode(imageUrl);
  const setName = text(match(html, /<li class="List_item"><a [^>]*>([\s\S]*?)<\/a><\/li>/));
  const rightBox = match(html, /<div class="RightBox-inner">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="clear">/) || "";
  const stage = cardKind === "pokemon" ? text(match(rightBox, /<span class="type">([\s\S]*?)<\/span>/)) : "";
  const hp = Number(text(match(rightBox, /<span class="hp-num">([\s\S]*?)<\/span>/))) || inferHpFromText(rightBox);
  const pokemonType = cardKind === "pokemon" ? iconToType(match(rightBox, /<span class="hp-type">タイプ<\/span>\s*<span class="icon-([a-z_]+) icon"><\/span>/)) : "";
  const subKind = cardKind === "pokemon" ? "ポケモン" : inferSubKind(rightBox, cardKind);
  const attacks = cardKind === "pokemon" ? parseNamedTextSection(rightBox, "ワザ").map((item) => ({
    name: item.name,
    damage: parseDamage(item.trailing),
    cost: item.icons.map(iconToType).filter(Boolean),
    text: item.text,
  })) : [];
  const abilities = cardKind === "pokemon" ? parseNamedTextSection(rightBox, "特性").map((item) => ({
    name: item.name,
    text: item.text,
  })) : [];
  const ruleText = buildRuleText(rightBox, cardKind);
  const stageInfo = inferStageInfo(stage);
  const evolvesFrom = inferEvolvesFrom(rightBox, name);
  const familyId = buildFamilyId({ name, cardKind, evolvesFrom });
  const types = pokemonType ? [pokemonType] : [];
  const searchTokens = buildSearchTokens({
    name,
    setName,
    subKind,
    stage,
    types,
    attacks,
    abilities,
    ruleText,
  });

  return {
    cardId,
    name,
    cardKind,
    subKind,
    regulation: "XY",
    setCode,
    setName,
    stage,
    stageCategory: stageInfo.category,
    evolvesFrom,
    familyId,
    stageOrder: stageInfo.order,
    hp,
    types,
    attacks,
    abilities,
    ruleText,
    searchTokens,
    officialUrl,
    imageUrl,
  };
}

function parseNamedTextSection(html, heading) {
  const section = extractSection(html, heading);
  if (!section) return [];
  const items = [];
  const pattern = /<h4>([\s\S]*?)<\/h4>\s*<p>([\s\S]*?)<\/p>/g;
  for (const matchResult of section.matchAll(pattern)) {
    const headingHtml = matchResult[1];
    const trailing = text(match(headingHtml, /<span class="f_right Text-fjalla">([\s\S]*?)<\/span>/));
    const nameHtml = headingHtml.replace(/<span class="f_right Text-fjalla">[\s\S]*?<\/span>/g, "");
    const icons = [...nameHtml.matchAll(/icon-([a-z_]+) icon/g)].map((m) => m[1]);
    items.push({
      name: text(nameHtml.replace(/<span class="icon-[^"]+ icon"><\/span>/g, "")),
      trailing,
      icons,
      text: text(matchResult[2]),
    });
  }
  return items.filter((item) => item.name || item.text);
}

function buildRuleText(html, cardKind) {
  const blocks = [];
  const pattern = /<h2 class="mt20">([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2 class="mt20">|<table|<div class="evolution|<\/div>\s*<\/div>\s*<div class="clear">)/g;
  for (const result of html.matchAll(pattern)) {
    const heading = text(result[1]);
    if (["ワザ", "特性", "進化"].includes(heading)) continue;
    if (cardKind === "pokemon" && heading !== "特別なルール") continue;
    const paragraphs = [...result[2].matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => text(m[1])).filter(Boolean);
    blocks.push(...paragraphs);
  }
  return normalizeText(blocks.join(" "));
}

function extractSection(html, heading) {
  const pattern = new RegExp(`<h2 class="mt20">${escapeRegExp(heading)}</h2>([\\s\\S]*?)(?=<h2 class="mt20">|<table|<div class="evolution|</div>\\s*</div>\\s*<div class="clear">)`);
  return match(html, pattern);
}

function inferSubKind(html, cardKind) {
  if (cardKind === "energy") {
    const heading = firstContentHeading(html);
    return heading || "エネルギー";
  }
  return firstContentHeading(html) || "トレーナーズ";
}

function firstContentHeading(html) {
  for (const result of html.matchAll(/<h2 class="mt20">([\s\S]*?)<\/h2>/g)) {
    const heading = text(result[1]);
    if (!["ワザ", "特性", "特別なルール", "進化"].includes(heading)) return heading;
  }
  return "";
}

function inferStageInfo(stage) {
  if (/たね/.test(stage)) return { category: "basic", order: 0 };
  if (/1\s*進化|１\s*進化/.test(stage)) return { category: "evolution", order: 1 };
  if (/2\s*進化|２\s*進化/.test(stage)) return { category: "evolution", order: 2 };
  if (/進化/.test(stage)) return { category: "evolution", order: 1 };
  return { category: "unknown", order: 0 };
}

function inferEvolvesFrom(html, name) {
  const currentMatch = [...html.matchAll(/<div class="evolution in-box ev_on">[\s\S]*?<a [^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => text(m[1]))
    .find((value) => normalizeName(value) === normalizeName(name));
  if (!currentMatch) return "";
  const beforeCurrent = html.slice(0, html.indexOf("ev_on"));
  const candidates = [...beforeCurrent.matchAll(/<div class="evolution ev_off">[\s\S]*?<a [^>]*>([\s\S]*?)<\/a>/g)].map((m) => text(m[1]));
  return candidates.at(-1) || "";
}

function buildFamilyId({ name, cardKind, evolvesFrom }) {
  if (cardKind !== "pokemon") return name;
  return stripRuleSuffix(evolvesFrom || name);
}

function stripRuleSuffix(name) {
  return String(name || "").replace(/(?:ex|EX|GX|VSTAR|VMAX|V-UNION|V)$/u, "");
}

function buildSearchTokens({ name, setName, subKind, stage, types, attacks, abilities, ruleText }) {
  const tokens = [
    name,
    stage,
    setName,
    subKind,
    ...types,
    ...attacks.map((attack) => attack.name),
    ...abilities.map((ability) => ability.name),
    ...splitSentences(ruleText),
  ];
  return [...new Set(tokens.map(normalizeText).filter(Boolean))];
}

function splitSentences(value) {
  return normalizeText(value)
    .split("。")
    .map((item) => item.trim())
    .filter(Boolean);
}

function inferCardKind(imageUrl) {
  if (imageUrl.includes("_P_")) return "pokemon";
  if (imageUrl.includes("_T_")) return "trainer";
  if (imageUrl.includes("_E_")) return "energy";
  return "trainer";
}

function inferSetCode(imageUrl) {
  return match(imageUrl, /\/large\/([^/]+)\//) || "";
}

function inferHpFromText(html) {
  return Number(match(text(html), /HP\s*(\d+)/)) || 0;
}

function parseDamage(value) {
  const trimmed = normalizeText(value);
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : trimmed;
}

function iconToType(icon) {
  const table = {
    grass: "草",
    fire: "炎",
    water: "水",
    electric: "雷",
    psychic: "超",
    fighting: "闘",
    dark: "悪",
    steel: "鋼",
    dragon: "ドラゴン",
    fairy: "フェアリー",
    none: "無",
  };
  return table[String(icon || "")] || "";
}

function sortCardsById(cards) {
  return Object.fromEntries(
    Object.entries(cards).sort(([a], [b]) => Number(a) - Number(b))
  );
}

function writeReport({ reportPath, searchUrl, existingTotal, officialTotal, newCards, mergedRawPath, outputPath }) {
  const bySetName = new Map();
  for (const card of newCards) {
    const key = card.setName || "unknown";
    bySetName.set(key, (bySetName.get(key) || 0) + 1);
  }
  const rows = [...bySetName.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([setName, count]) => `| ${setName} | ${count} |`)
    .join("\n");
  const sampleRows = newCards.slice(0, 30)
    .map((card) => `| ${card.cardId} | ${card.name} | ${card.setName} | ${card.subKind} |`)
    .join("\n");
  const content = `# カードマスター差分更新レポート

- 実行日: ${new Date().toISOString()}
- 公式検索URL: ${searchUrl}
- 既存カード数: ${existingTotal}
- 公式検索総数: ${officialTotal}
- 新規追加数: ${newCards.length}
- 新規ID範囲: ${newCards[0]?.cardId || "-"} - ${newCards.at(-1)?.cardId || "-"}
- 統合元JSON: ${path.relative(process.cwd(), mergedRawPath)}
- 出力先: ${path.relative(process.cwd(), outputPath)}

## 商品別追加数

| 商品 | 追加数 |
| --- | ---: |
${rows}

## 追加カードサンプル

| cardId | name | setName | subKind |
| --- | --- | --- | --- |
${sampleRows}
`;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, content, "utf8");
}

function text(value) {
  return normalizeText(stripTags(decodeHtml(value || "")));
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripTags(value) {
  return String(value || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ");
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function attr(tagHtml, name) {
  return decodeHtml(match(tagHtml || "", new RegExp(`${name}="([^"]*)"`)) || "");
}

function absoluteUrl(value) {
  if (!value) return "";
  if (/^https?:\/\//.test(value)) return value;
  return `${SOURCE_ORIGIN}${value.startsWith("/") ? "" : "/"}${value}`;
}

function match(value, pattern) {
  const result = String(value || "").match(pattern);
  return result ? result[1] : "";
}

function normalizeName(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
