"use client";

import { useEffect, useState } from "react";
import { isAuthConfigured, isLoggedIn, login, logout, signup } from "@/lib/auth";

type Props = {
  compact?: boolean;
};

export default function AuthStatus({ compact = false }: Props) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [configured, setConfigured] = useState(false);

  const handleLogin = () => {
    void login().catch((error) => {
      console.error(error);
      window.alert(error instanceof Error ? error.message : "ログインページを開けませんでした");
    });
  };

  const handleSignup = () => {
    void signup().catch((error) => {
      console.error(error);
      window.alert(error instanceof Error ? error.message : "登録ページを開けませんでした");
    });
  };

  useEffect(() => {
    const update = () => {
      setConfigured(isAuthConfigured());
      setLoggedIn(isLoggedIn());
    };
    update();
    window.addEventListener("auth-changed", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("auth-changed", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  if (!configured) {
    return null;
  }

  if (loggedIn) {
    return (
      <button
        type="button"
        onClick={logout}
        className={compact ? "cursor-pointer rounded border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" : "cursor-pointer rounded border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"}
      >
        ログアウト
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleLogin}
        className={compact ? "cursor-pointer rounded border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" : "cursor-pointer rounded border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"}
      >
        ログイン
      </button>
      <button
        type="button"
        onClick={handleSignup}
        className={compact ? "cursor-pointer rounded bg-blue-500 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600" : "cursor-pointer rounded bg-blue-500 px-4 py-2 text-sm font-bold text-white hover:bg-blue-600"}
      >
        登録
      </button>
    </div>
  );
}
