import Link from "next/link";

const currentFeatures = [
  "デッキ作成、編集、保存",
  "カード名検索とカード候補表示",
  "一人回し練習",
  "AI対戦の自動進行",
  "カード効果の一部自動処理",
  "スマートフォン向け画面の試験実装",
];

const knownLimits = [
  "公式ルールの完全再現を目的としたものではありません。",
  "カード効果は一部のみ対応しています。",
  "AI対戦は簡易自動実行が中心で、判断AIは今後の改善予定です。",
  "カード情報、画像、テキストの表示内容には誤りや不足が残る可能性があります。",
  "スマートフォン向け画面は段階的に改善中です。",
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black tracking-[0.18em] text-sky-600">ABOUT PKS STUDIO</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">このアプリについて</h1>
            </div>
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              ホームへ戻る
            </Link>
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            PKS Studioは、ポケモンカードのデッキ作成、一人回し、AI対戦の練習補助を目的とした個人開発アプリです。
            大会準備やデッキ調整の作業をブラウザ上で進めやすくするために開発しています。
          </p>
        </header>

        <section className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-black">現在できること</h2>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
              {currentFeatures.map((feature) => (
                <li key={feature} className="rounded-xl bg-slate-50 px-3 py-2">
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-black">現在の制限</h2>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
              {knownLimits.map((limit) => (
                <li key={limit} className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900">
                  {limit}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black">免責事項</h2>
          <div className="mt-3 grid gap-3 text-sm leading-7 text-slate-700">
            <p>
              本アプリは個人が開発・運営する非公式アプリです。株式会社ポケモン、任天堂株式会社、株式会社クリーチャーズ、
              株式会社ゲームフリーク、その他関連各社とは関係ありません。
            </p>
            <p>
              ポケモンカード、カード名、カード画像、各種テキスト、商標、ロゴ等の権利は各権利者に帰属します。
              本アプリは公式情報の代替ではありません。大会参加や正式なルール確認には、公式サイトおよび公式ルールを確認してください。
            </p>
            <p>
              掲載しているカード情報や挙動は、開発中の補助機能として提供しています。内容の正確性、完全性、継続的な提供を保証するものではありません。
            </p>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black">不具合・要望</h2>
          <p className="mt-2 text-sm leading-7 text-slate-700">
            不具合、カード情報の誤り、改善要望があればGoogleフォームから報告できます。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLScqz0Lkdw1x02kiSQOL3UYU14k1MKM7BbOWFtXpTfIETwe8Yg/viewform?usp=header"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              不具合報告フォーム
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
