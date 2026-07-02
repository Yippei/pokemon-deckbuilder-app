"use client";

import { useSyncExternalStore } from "react";
import { isAuthConfigured, isLoggedIn, login } from "@/lib/auth";

type Props = {
  children: React.ReactNode;
};

export default function AuthGate({ children }: Props) {
  const configured = isAuthConfigured();
  const loggedIn = useSyncExternalStore(subscribeAuth, isLoggedIn, () => false);

  if (!configured) {
    return <>{children}</>;
  }

  if (!loggedIn) {
    return (
      <main className="home-type-bg min-h-screen">
        <div className="home-content mx-auto flex min-h-screen max-w-md items-center p-6">
          <div className="w-full rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
            <h1 className="mb-3 text-xl font-bold text-slate-950">ログインが必要です</h1>
            <p className="mb-5 text-sm text-slate-600">デッキの作成・保存・閲覧にはログインしてください。</p>
            <button
              type="button"
              onClick={() => login()}
              className="w-full rounded bg-blue-500 px-4 py-3 text-sm font-bold text-white hover:bg-blue-600"
            >
              ログイン
            </button>
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}

function subscribeAuth(onStoreChange: () => void) {
  window.addEventListener("auth-changed", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("auth-changed", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}
