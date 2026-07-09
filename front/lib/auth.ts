const COGNITO_DOMAIN = process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "";
const COGNITO_CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "";
const REDIRECT_PATH = "/auth/callback";
const TOKEN_KEY = "authTokens";
const PKCE_KEY = "authPkce";

type StoredTokens = {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};

type StoredPKCE = {
  codeVerifier: string;
  state: string;
  returnTo: string;
};

export function isAuthConfigured(): boolean {
  return Boolean(COGNITO_DOMAIN && COGNITO_CLIENT_ID);
}

export async function login(returnTo?: string) {
  return startAuth(returnTo);
}

export async function signup(returnTo?: string) {
  return startAuth(returnTo, "signup");
}

async function startAuth(returnTo?: string, screenHint?: "signup") {
  if (!isAuthConfigured()) {
    throw new Error("Cognito設定がありません");
  }

  const codeVerifier = randomString(64);
  const state = randomString(32);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const redirectUri = getRedirectUri();
  const safeReturnTo = returnTo || `${window.location.pathname}${window.location.search}`;

  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ codeVerifier, state, returnTo: safeReturnTo }));

  const params = new URLSearchParams({
    client_id: COGNITO_CLIENT_ID,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: redirectUri,
    state,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    lang: "ja",
  });
  if (screenHint) {
    params.set("screen_hint", screenHint);
  }

  window.location.href = `${COGNITO_DOMAIN}/oauth2/authorize?${params.toString()}`;
}

export async function handleAuthCallback(code: string, state: string): Promise<string> {
  const raw = sessionStorage.getItem(PKCE_KEY);
  if (!raw) throw new Error("ログイン状態を確認できません");

  const pkce = JSON.parse(raw) as StoredPKCE;
  if (pkce.state !== state) throw new Error("ログイン状態が一致しません");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: COGNITO_CLIENT_ID,
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: pkce.codeVerifier,
  });

  const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error("ログインに失敗しました");

  const data = await res.json();
  storeTokens({
    idToken: data.id_token,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Math.max(0, Number(data.expires_in || 3600) - 60) * 1000,
  });
  sessionStorage.removeItem(PKCE_KEY);
  return pkce.returnTo || "/";
}

export function logout() {
  clearTokens();
  if (!isAuthConfigured()) {
    window.location.href = "/";
    return;
  }

  const params = new URLSearchParams({
    client_id: COGNITO_CLIENT_ID,
    logout_uri: window.location.origin + "/",
  });
  window.location.href = `${COGNITO_DOMAIN}/logout?${params.toString()}`;
}

export function getStoredTokens(): StoredTokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const tokens = JSON.parse(raw) as StoredTokens;
    if (!tokens.idToken || tokens.expiresAt <= Date.now()) {
      clearTokens();
      return null;
    }
    return tokens;
  } catch {
    clearTokens();
    return null;
  }
}

export function getIdToken(): string | null {
  return getStoredTokens()?.idToken || null;
}

export function isLoggedIn(): boolean {
  return Boolean(getStoredTokens());
}

function storeTokens(tokens: StoredTokens) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  window.dispatchEvent(new Event("auth-changed"));
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("auth-changed"));
}

function getRedirectUri() {
  return `${window.location.origin}${REDIRECT_PATH}`;
}

function randomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256Base64Url(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
