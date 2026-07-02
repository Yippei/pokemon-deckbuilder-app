"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Deck, deleteDeck, listDecks, removeDeckId } from "@/lib/api";
import { isAuthConfigured, isLoggedIn } from "@/lib/auth";
import AuthStatus from "@/components/AuthStatus";

const deckTypes = [
  { type: "all", label: "全て", color: "#3b82f6", light: "#bfdbfe", keywords: [] },
  { type: "normal", label: "無", color: "#9ca3af", light: "#d1d5db", keywords: ["無", "無色", "ノーマル", "ダブルターボ"] },
  { type: "fire", label: "炎", color: "#ef4444", light: "#fb923c", keywords: ["炎", "ほのお", "基本炎エネルギー"] },
  { type: "water", label: "水", color: "#2563eb", light: "#38bdf8", keywords: ["水", "みず", "基本水エネルギー"] },
  { type: "grass", label: "草", color: "#16a34a", light: "#86efac", keywords: ["草", "くさ", "基本草エネルギー"] },
  { type: "fighting", label: "闘", color: "#c2410c", light: "#fb923c", keywords: ["闘", "とう", "基本闘エネルギー"] },
  { type: "psychic", label: "超", color: "#db2777", light: "#f9a8d4", keywords: ["超", "ちょう", "基本超エネルギー"] },
  { type: "dark", label: "悪", color: "#1f2937", light: "#64748b", keywords: ["悪", "あく", "基本悪エネルギー"] },
  { type: "dragon", label: "ドラゴン", color: "#d97706", light: "#fde68a", keywords: ["ドラゴン", "竜"] },
  { type: "electric", label: "雷", color: "#facc15", light: "#fef08a", keywords: ["雷", "かみなり", "基本雷エネルギー", "ピカチュウ"] },
];

const typeMarks = [
  { type: "normal", size: "74px", rotate: "-14deg", top: "6%", left: "4%", opacity: 0.18 },
  { type: "fire", size: "94px", rotate: "18deg", top: "11%", right: "13%", opacity: 0.16 },
  { type: "water", size: "66px", rotate: "-28deg", top: "28%", left: "16%", opacity: 0.14 },
  { type: "grass", size: "72px", rotate: "31deg", top: "54%", right: "9%", opacity: 0.15 },
  { type: "fighting", size: "54px", rotate: "15deg", top: "6%", left: "40%", opacity: 0.13 },
  { type: "psychic", size: "58px", rotate: "9deg", top: "21%", right: "34%", opacity: 0.14 },
  { type: "dark", size: "62px", rotate: "-25deg", top: "41%", left: "36%", opacity: 0.14 },
  { type: "dragon", size: "100px", rotate: "22deg", bottom: "-22px", left: "42%", opacity: 0.18 },
  { type: "electric", size: "112px", rotate: "8deg", top: "44%", left: "-28px", opacity: 0.2 },
  { type: "ice", size: "66px", rotate: "-10deg", top: "68%", left: "10%", opacity: 0.12 },
  { type: "poison", size: "58px", rotate: "16deg", top: "72%", right: "18%", opacity: 0.12 },
  { type: "ground", size: "62px", rotate: "-20deg", top: "18%", left: "56%", opacity: 0.11 },
  { type: "flying", size: "54px", rotate: "26deg", top: "17%", left: "72%", opacity: 0.12 },
  { type: "bug", size: "62px", rotate: "12deg", top: "34%", right: "3%", opacity: 0.12 },
  { type: "rock", size: "58px", rotate: "-16deg", top: "82%", left: "32%", opacity: 0.12 },
  { type: "ghost", size: "60px", rotate: "7deg", top: "78%", right: "34%", opacity: 0.11 },
  { type: "steel", size: "70px", rotate: "-8deg", top: "2%", right: "46%", opacity: 0.12 },
  { type: "fairy", size: "56px", rotate: "20deg", top: "61%", left: "48%", opacity: 0.13 },
];

const starterRules = [
  "カードを大切に扱う",
  "シャッフルはしっかり行なってから相手にカットしてもらう",
  "対戦相手へのリスペクトを忘れない",
  "ワザやカードの効果をしっかり宣言する",
  "カードの効果がわからないときはジャッジもしくはQ&Aを確認",
  "ダメージ計算を正確に行う",
  "楽しむ心を忘れない！！",
];

type CardGym = {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  officialUrl?: string;
};

type CardGymMaster = {
  gyms?: CardGym[];
};

type UserLocation = {
  lat: number;
  lng: number;
};

function getInitialSelectedType() {
  if (typeof window === "undefined") return "all";
  const type = new URLSearchParams(window.location.search).get("type");
  return type && deckTypes.some((deckType) => deckType.type === type) ? type : "all";
}

function getDistanceKm(from: UserLocation, to: Pick<CardGym, "lat" | "lng">) {
  const earthRadiusKm = 6371;
  const toRadians = (degree: number) => (degree * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number) {
  if (!Number.isFinite(km)) return "-";
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(km < 10 ? 1 : 0)}km`;
}

function buildMapsSearchUrl(location?: UserLocation | null) {
  const query = location
    ? `ポケモンカードジム ${location.lat.toFixed(5)},${location.lng.toFixed(5)}`
    : "ポケモンカードジム";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function buildMapsDirectionsUrl(gym: CardGym, location?: UserLocation | null) {
  const params = new URLSearchParams({
    api: "1",
    destination: `${gym.lat},${gym.lng}`,
    travelmode: "transit",
  });
  if (location) {
    params.set("origin", `${location.lat},${location.lng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export default function Home() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedType, setSelectedType] = useState(getInitialSelectedType);
  const [playTipsOpen, setPlayTipsOpen] = useState(false);
  const [deletingDeckId, setDeletingDeckId] = useState<string | null>(null);
  const [cardGyms, setCardGyms] = useState<CardGym[]>([]);
  const [gymMasterLoading, setGymMasterLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState("");

  useEffect(() => {
    const fetchDecks = async () => {
      if (isAuthConfigured() && !isLoggedIn()) {
        setDecks([]);
        setLoading(false);
        return;
      }

      try {
        setDecks(await listDecks());
      } catch {
        setDecks([]);
        setLoadError("デッキ一覧を取得できませんでした。");
      } finally {
        setLoading(false);
      }
    };
    fetchDecks();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadGyms = async () => {
      setGymMasterLoading(true);
      try {
        const res = await fetch("/card-gyms.json", { cache: "force-cache" });
        if (!res.ok) throw new Error("card-gyms.json を取得できませんでした");
        const data = (await res.json()) as CardGymMaster;
        if (!cancelled) {
          setCardGyms(Array.isArray(data.gyms) ? data.gyms : []);
        }
      } catch {
        if (!cancelled) {
          setCardGyms([]);
        }
      } finally {
        if (!cancelled) {
          setGymMasterLoading(false);
        }
      }
    };
    loadGyms();
    return () => {
      cancelled = true;
    };
  }, []);

  const inferDeckType = (deck: Deck) => {
    const text = [deck.name, ...deck.cards.map((card) => card.cardName || "")]
      .join(" ")
      .toLowerCase();
    return deckTypes.find((deckType) =>
      deckType.type !== "all" && deckType.keywords.some((keyword) => text.includes(keyword.toLowerCase()))
    )?.type;
  };

  const selectType = (type: string) => {
    setSelectedType(type);
    const url = type === "all" ? "/" : `/?type=${type}`;
    window.history.replaceState(null, "", url);
  };

  const visibleDecks = selectedType === "all"
    ? decks
    : decks.filter((deck) => inferDeckType(deck) === selectedType);
  const selectedTypeLabel = deckTypes.find((deckType) => deckType.type === selectedType)?.label || "全て";
  const listTitle = selectedType === "all" ? "作成した全てのデッキ" : `${selectedTypeLabel}タイプのデッキ`;
  const getTypeDeckCount = (type: string) => (
    type === "all" ? decks.length : decks.filter((deck) => inferDeckType(deck) === type).length
  );
  const totalCards = decks.reduce((sum, deck) => (
    sum + deck.cards.reduce((cardSum, card) => cardSum + card.count, 0)
  ), 0);
  const nearestGyms = useMemo(() => {
    if (!userLocation) {
      return cardGyms.slice(0, 5).map((gym) => ({ gym, distanceKm: null as number | null }));
    }
    return cardGyms
      .map((gym) => ({ gym, distanceKm: getDistanceKm(userLocation, gym) }))
      .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0))
      .slice(0, 5);
  }, [cardGyms, userLocation]);

  const locateUser = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationStatus("このブラウザでは現在地を取得できません。");
      return;
    }
    setLocationStatus("現在地を取得しています。");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus("現在地を取得しました。");
      },
      () => {
        setLocationStatus("現在地の取得が許可されませんでした。Googleマップ検索は利用できます。");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  const handleDeleteDeck = async (deck: Deck) => {
    const ok = window.confirm(`「${deck.name}」を削除しますか？`);
    if (!ok) return;

    setLoadError("");
    setDeletingDeckId(deck.deckId);
    try {
      await deleteDeck(deck.deckId);
      removeDeckId(deck.deckId);
      setDecks((currentDecks) => currentDecks.filter((currentDeck) => currentDeck.deckId !== deck.deckId));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "デッキの削除に失敗しました。");
    } finally {
      setDeletingDeckId(null);
    }
  };

  return (
    <main className="home-type-bg min-h-screen">
      <div className="type-mark-field" aria-hidden="true">
        {typeMarks.map((mark) => (
          <span
            key={mark.type}
            className={`type-mark type-mark-${mark.type}`}
            style={{
              "--type-size": mark.size,
              "--type-rotation": mark.rotate,
              opacity: mark.opacity,
              top: mark.top,
              right: mark.right,
              bottom: mark.bottom,
              left: mark.left,
            } as CSSProperties}
          />
        ))}
      </div>
      <div className="home-content mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="home-hero mb-6 overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/78 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <div className="home-hero__grid">
            <div className="home-hero__copy">
              <div className="home-kicker">POKEMON CARD WORKSHOP</div>
              <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                ポケカデッキメーカー
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-700 sm:text-base">
                事故りにくい構成を基準に、タイプやポケモン指定に合わせてデッキを作成します。
                そのまま使える形に寄せつつ、編集もすぐに始められます。
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/decks/new"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-bold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  新規デッキを作成
                </Link>
                <a
                  href="#deck-list"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5 hover:border-slate-400"
                >
                  デッキ一覧を見る
                </a>
                <AuthStatus compact />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="home-metric">
                  <span className="home-metric__label">デッキ</span>
                  <span className="home-metric__value">{decks.length}</span>
                </div>
                <div className="home-metric">
                  <span className="home-metric__label">合計枚数</span>
                  <span className="home-metric__value">{totalCards}</span>
                </div>
                <div className="home-metric">
                  <span className="home-metric__label">表示中</span>
                  <span className="home-metric__value">{visibleDecks.length}</span>
                </div>
              </div>
            </div>

            <div className="home-hero__visual">
              <div className="home-hero__orb home-hero__orb--top" />
              <div className="home-hero__orb home-hero__orb--middle" />
              <div className="home-hero__orb home-hero__orb--bottom" />
              <div className="home-hero__card">
                <div className="home-hero__card-top">
                  <span>CARD GYM</span>
                  <span>{userLocation ? "NEARBY" : "LOCATION"}</span>
                </div>
                <div className="home-hero__card-center home-hero__card-center--gyms">
                  <div className="home-gym-panel" id="card-gym-finder">
                    <div className="home-gym-panel__header">
                      <div className="home-gym-panel__ball" aria-hidden="true">
                        <span className="home-hero__pokeball-core" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base font-black text-slate-950">近くのポケモンカードジム</h2>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {userLocation ? "現在地から近い順に表示" : "現在地を取得すると近い順に並びます"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={locateUser}
                        className="inline-flex h-9 items-center justify-center rounded-full bg-slate-950 px-3 text-xs font-bold text-white transition hover:bg-slate-800"
                      >
                        現在地を取得
                      </button>
                      <a
                        href={buildMapsSearchUrl(userLocation)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 transition hover:bg-slate-50"
                      >
                        Mapsで探す
                      </a>
                    </div>

                    {locationStatus ? (
                      <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                        {locationStatus}
                      </p>
                    ) : null}

                    <div className="mt-3 grid gap-2">
                      {gymMasterLoading ? (
                        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                          店舗データを読み込み中です。
                        </p>
                      ) : nearestGyms.length > 0 ? (
                        nearestGyms.map(({ gym, distanceKm }, index) => (
                          <div key={gym.id} className="home-gym-panel__row">
                            <div className="home-gym-panel__rank">{index + 1}</div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-black text-slate-950">{gym.name}</p>
                              <p className="mt-0.5 text-[11px] font-bold text-emerald-700">
                                {distanceKm === null ? "距離未取得" : `約${formatDistance(distanceKm)}`}
                              </p>
                            </div>
                            <a
                              href={buildMapsDirectionsUrl(gym, userLocation)}
                              target="_blank"
                              rel="noreferrer"
                              className="home-gym-panel__guide"
                            >
                              案内
                            </a>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                          <p className="text-xs font-bold text-slate-800">店舗マスター未投入</p>
                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            `card-gyms.json` に店舗の緯度経度を入れると、この場所に近い順で表示されます。
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="home-hero__card-bottom">
                  <span>GOOGLE MAPS</span>
                  <span>FREE URL</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-[24px] border border-slate-200/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
            <h2 className="text-lg font-black text-slate-950">ポケモンカードの心得</h2>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              対戦前に押さえると、プレイ全体が安定します。
            </p>
            <ul className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              {starterRules.map((rule) => (
                <li
                  key={rule}
                  className="rounded-2xl border border-slate-200/80 bg-slate-50 px-3 py-2.5"
                >
                  {rule}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-[24px] border border-slate-200/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">プレイラボ</h2>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  AI対戦と一人回しをまとめた、練習用の入口です。
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-3xl border border-slate-200/80 bg-slate-50/90 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Link
                  href="/ai-battle-room?mode=ai"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-bold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  AI対戦を始める
                </Link>
                <Link
                  href="/ai-battle-room?mode=solo"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5 hover:border-slate-400"
                >
                  一人回しを始める
                </Link>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                AIとの練習と一人回しを切り替えて、動きの確認や調整を行えます。
              </p>
            </div>
          </section>
        </div>

        <section className="mb-6 rounded-[24px] border border-slate-200/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">プレイワンポイント</h2>
              <p className="mt-1 text-sm leading-6 text-slate-700">
                構築とプレイの基準を合わせると、デッキの再現性が上がります。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPlayTipsOpen((open) => !open)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
              aria-expanded={playTipsOpen}
              aria-controls="play-tips-panel"
              aria-label={playTipsOpen ? "プレイワンポイントを閉じる" : "プレイワンポイントを開く"}
            >
              {playTipsOpen ? "−" : "+"}
            </button>
          </div>
          <div
            id="play-tips-panel"
            className={`overflow-hidden transition-all duration-300 ${
              playTipsOpen ? "mt-4 max-h-80 opacity-100" : "max-h-0 opacity-0"
            }`}
            aria-hidden={!playTipsOpen}
          >
            <ul className="space-y-2 text-sm leading-6 text-slate-800">
              <li>デッキテーマをしっかり決め、それに沿って構築やプレイを行う</li>
              <li>たねポケモンはベンチいっぱいまで置かず、1体置ける余裕をもつ</li>
              <li>エネルギーを過剰に入れない</li>
              <li>たねポケモンを呼ぶカードは最低8枚入れる</li>
              <li>できる限り最大パフォーマンスをし、次のターンに余力を残すことは基本考えない</li>
              <li>最後まで思考を諦めず、突破口を見落とさない</li>
            </ul>
          </div>
        </section>

        <div className="mb-4 flex flex-wrap gap-2" aria-label="タイプ別デッキ一覧">
          {deckTypes.map((deckType) => (
            <button
              key={deckType.type}
              type="button"
              onClick={() => selectType(deckType.type)}
              className={`type-action-button type-action-${deckType.type} flex h-11 w-[122px] shrink-0 items-center justify-center gap-2 rounded-full border px-3 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 ${
                selectedType === deckType.type ? "bg-white text-gray-950" : "bg-white/82 text-slate-700"
              } ${selectedType === deckType.type ? "type-filter-active" : ""}`}
              style={{
                borderColor: selectedType === deckType.type ? deckType.color : "rgba(148, 163, 184, 0.45)",
                boxShadow: selectedType === deckType.type ? `0 0 0 2px ${deckType.light}` : undefined,
              }}
            >
              <span
                className="h-3.5 w-3.5 rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${deckType.light}, ${deckType.color})`,
                  boxShadow: "inset 0 0 0 1px rgba(15, 23, 42, 0.18)",
                }}
                aria-hidden="true"
              />
              <span>{deckType.label}</span>
              <span className="text-[11px] font-semibold text-slate-500">
                {loading ? "-" : getTypeDeckCount(deckType.type)}
              </span>
            </button>
          ))}
        </div>

        {loadError && <p className="mb-4 text-sm text-amber-600">{loadError}</p>}

        <section id="deck-list" className="rounded-[28px] border border-slate-200/80 bg-white/78 p-5 shadow-sm backdrop-blur-xl">
          {!loading && decks.length > 0 && (
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700">{listTitle}</h2>
              <span className="text-xs text-slate-500">{visibleDecks.length}件</span>
            </div>
          )}

          {loading ? (
            <p className="text-gray-500">読み込み中...</p>
          ) : decks.length === 0 ? (
            <p className="text-gray-500">デッキがまだありません。新規作成してみましょう！</p>
          ) : visibleDecks.length === 0 ? (
            <p className="text-slate-700">{selectedTypeLabel}タイプのデッキはまだありません。</p>
          ) : (
            <ul className="space-y-3">
              {visibleDecks.map((deck) => (
                <li key={deck.deckId}>
                  <div className="group rounded-[22px] border border-slate-200/80 bg-white/90 p-4 text-slate-950 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <Link
                        href={`/decks/view?id=${encodeURIComponent(deck.deckId)}`}
                        className="min-w-0 flex-1"
                      >
                        <div className="text-lg font-semibold text-slate-950 group-hover:text-slate-900">{deck.name}</div>
                        <div className="mt-1 text-sm font-medium text-slate-700">
                          {deck.cards.reduce((sum, c) => sum + c.count, 0)} 枚
                        </div>
                      </Link>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/decks/view?id=${encodeURIComponent(deck.deckId)}`}
                          className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                        >
                          OPEN
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteDeck(deck)}
                          disabled={deletingDeckId === deck.deckId}
                          className="inline-flex h-8 items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingDeckId === deck.deckId ? "削除中" : "削除"}
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
