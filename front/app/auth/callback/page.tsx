"use client";

import { useEffect, useState } from "react";
import { handleAuthCallback } from "@/lib/auth";

export default function AuthCallbackPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    const completeLogin = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const errorDescription = params.get("error_description") || params.get("error");

      if (errorDescription) {
        throw new Error(errorDescription);
      }
      if (!code || !state) {
        throw new Error("ログイン情報が不足しています");
      }

      const returnTo = await handleAuthCallback(code, state);
      window.location.replace(returnTo);
    };

    completeLogin().catch((err) => {
        setError(err instanceof Error ? err.message : "ログインに失敗しました");
    });
  }, []);

  return (
    <main className="home-type-bg flex min-h-screen items-center justify-center p-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        {error ? (
          <>
            <h1 className="mb-3 text-xl font-bold text-slate-950">ログインに失敗しました</h1>
            <p className="text-sm text-red-500">{error}</p>
          </>
        ) : (
          <>
            <h1 className="mb-3 text-xl font-bold text-slate-950">ログインしています</h1>
            <p className="text-sm text-slate-600">しばらくお待ちください。</p>
          </>
        )}
      </div>
    </main>
  );
}
