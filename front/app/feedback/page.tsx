"use client";

import { useEffect } from "react";
import Link from "next/link";

const feedbackFormUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLScqz0Lkdw1x02kiSQOL3UYU14k1MKM7BbOWFtXpTfIETwe8Yg/viewform?usp=header";

export default function FeedbackPage() {
  useEffect(() => {
    window.location.replace(feedbackFormUrl);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[11px] font-black tracking-[0.18em] text-emerald-600">FEEDBACK</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">不具合報告フォームを開きます</h1>
        <p className="mt-4 text-sm leading-7 text-slate-700">
          自動でGoogleフォームへ移動しない場合は、下のボタンから開いてください。
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href={feedbackFormUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            不具合報告フォームを開く
          </a>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            ホームへ戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
