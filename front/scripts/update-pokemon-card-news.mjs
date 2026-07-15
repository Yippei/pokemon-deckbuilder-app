import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://www.pokemon-card.com/info/";
const SOURCE_ORIGIN = "https://www.pokemon-card.com";
const OUTPUT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/pokemon-card-news.json",
);
const MAX_ITEMS = 5;

const decodeHtml = (value) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

const stripTags = (value) => value.replace(/<[^>]*>/g, " ");

const normalizeText = (value) => decodeHtml(stripTags(value)).replace(/\s+/g, " ").trim();

const normalizeUrl = (href) => {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  return new URL(href, SOURCE_ORIGIN).toString();
};

const normalizeDate = (date) => {
  const [year, month, day] = date.split(".").map((part) => Number(part));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const makeId = (url, date, index) => {
  const urlPart = url
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `official-${normalizeDate(date)}-${urlPart || index}`;
};

const extractAllNewsTab = (html) => {
  const start = html.indexOf('id="newsTab_all"');
  const end = html.indexOf('id="newsTab_pro"', start);
  if (start < 0 || end < 0) {
    throw new Error("公式ニュース一覧のタブ構造を検出できませんでした");
  }
  return html.slice(start, end);
};

const parseNewsItems = (html) => {
  const allTabHtml = extractAllNewsTab(html);
  const itemPattern =
    /<a\s+class="List_item_inner"\s+href="([^"]+)"[\s\S]*?<div\s+class="Calendar_Label[^"]*">([\s\S]*?)<\/div>([\s\S]*?)<span\s+class="Date Date-small">([\d.]+)<\/span>/g;
  const seen = new Set();
  const items = [];
  let match;

  while ((match = itemPattern.exec(allTabHtml)) !== null) {
    const [, href, rawCategory, rawTitle, date] = match;
    const url = normalizeUrl(decodeHtml(href));
    const title = normalizeText(rawTitle);
    const category = normalizeText(rawCategory);
    const key = `${url}|${date}|${title}`;

    if (!title || !category || !date || seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: makeId(url, date, items.length + 1),
      category,
      date,
      title,
      summary: title,
      url,
    });

    if (items.length >= MAX_ITEMS) break;
  }

  if (items.length === 0) {
    throw new Error("公式ニュースを1件も抽出できませんでした");
  }

  return items;
};

const main = async () => {
  const res = await fetch(SOURCE_URL, {
    headers: {
      "user-agent": "pokemon-deckbuilder-app news updater (+https://www.pokemon-card.com/info/)",
    },
  });

  if (!res.ok) {
    throw new Error(`公式ニュース一覧を取得できませんでした: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const items = parseNewsItems(html);
  const news = {
    updatedAt: normalizeDate(items[0].date),
    sourceName: "ポケモンカードゲーム公式ニュース",
    sourceUrl: SOURCE_URL,
    items,
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(news, null, 2)}\n`, "utf8");
  console.log(`Updated ${OUTPUT_PATH} with ${items.length} official news items.`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
