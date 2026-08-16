"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const issueBaseUrl = "https://github.com/Yippei/pokemon-deckbuilder-app/issues/new";

function buildReportBody(values: {
  category: string;
  title: string;
  pageUrl: string;
  environment: string;
  steps: string;
  expected: string;
  actual: string;
  note: string;
}) {
  return [
    "## 種別",
    values.category || "未選択",
    "",
    "## 発生した画面・URL",
    values.pageUrl || "未入力",
    "",
    "## 利用環境",
    values.environment || "未入力",
    "",
    "## 再現手順",
    values.steps || "未入力",
    "",
    "## 期待した動き",
    values.expected || "未入力",
    "",
    "## 実際の動き",
    values.actual || "未入力",
    "",
    "## 補足",
    values.note || "なし",
  ].join("\n");
}

export default function FeedbackPage() {
  const [category, setCategory] = useState("不具合");
  const [title, setTitle] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [environment, setEnvironment] = useState("");
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [note, setNote] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const reportBody = useMemo(
    () =>
      buildReportBody({
        category,
        title,
        pageUrl,
        environment,
        steps,
        expected,
        actual,
        note,
      }),
    [actual, category, environment, expected, note, pageUrl, steps, title]
  );

  const issueUrl = useMemo(() => {
    const params = new URLSearchParams({
      title: title ? `[${category}] ${title}` : `[${category}] 報告`,
      body: reportBody,
    });
    return `${issueBaseUrl}?${params.toString()}`;
  }, [category, reportBody, title]);

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(`タイトル: ${title || `[${category}] 報告`}\n\n${reportBody}`);
      setCopyStatus("コピーしました。");
    } catch {
      setCopyStatus("コピーできませんでした。本文を選択してコピーしてください。");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black tracking-[0.18em] text-emerald-600">FEEDBACK</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">不具合報告フォーム</h1>
            </div>
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              ホームへ戻る
            </Link>
          </div>
          <p className="mt-4 text-sm leading-7 text-slate-700">
            入力内容はこの画面内でGitHub Issue用の本文に変換されます。サーバーには保存されません。
          </p>
        </header>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-black text-slate-600">種別</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none transition focus:border-emerald-400"
              >
                <option value="不具合">不具合</option>
                <option value="カード情報の誤り">カード情報の誤り</option>
                <option value="改善要望">改善要望</option>
                <option value="質問">質問</option>
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-black text-slate-600">タイトル</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="例: AI対戦でサイド取得後に進行が止まる"
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-black text-slate-600">発生した画面・URL</span>
              <input
                value={pageUrl}
                onChange={(event) => setPageUrl(event.target.value)}
                placeholder="例: /ai-battle-room?mode=ai"
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-black text-slate-600">利用環境</span>
              <input
                value={environment}
                onChange={(event) => setEnvironment(event.target.value)}
                placeholder="例: iPhone Safari / Mac Chrome など"
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-black text-slate-600">再現手順</span>
              <textarea
                value={steps}
                onChange={(event) => setSteps(event.target.value)}
                rows={4}
                placeholder="例: 1. AI対戦を開始 2. 番終了 3. AIが攻撃する"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-black text-slate-600">期待した動き</span>
                <textarea
                  value={expected}
                  onChange={(event) => setExpected(event.target.value)}
                  rows={4}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-black text-slate-600">実際の動き</span>
                <textarea
                  value={actual}
                  onChange={(event) => setActual(event.target.value)}
                  rows={4}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400"
                />
              </label>
            </div>

            <label className="grid gap-1.5">
              <span className="text-xs font-black text-slate-600">補足</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="スクリーンショットの有無、カード名、デッキ名など"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400"
              />
            </label>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black">送信内容</h2>
          <pre className="mt-3 max-h-[360px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
            {reportBody}
          </pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={issueUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              GitHub Issueで報告
            </a>
            <button
              type="button"
              onClick={copyReport}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              本文をコピー
            </button>
          </div>
          {copyStatus ? <p className="mt-3 text-sm font-bold text-emerald-700">{copyStatus}</p> : null}
          <p className="mt-3 text-xs leading-5 text-slate-500">
            GitHubにログインしていない場合は、Issue画面でログインを求められることがあります。
          </p>
        </section>
      </div>
    </main>
  );
}
