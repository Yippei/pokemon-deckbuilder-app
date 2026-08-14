import type { Metadata, Viewport } from "next";
import "./globals.css";

const appName = "PKS Studio";
const shortAppName = "PKS";

export const metadata: Metadata = {
  applicationName: appName,
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  description: "カードデッキの作成・練習・イベント情報確認をまとめて扱うスタジオ",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: shortAppName,
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/pks-icon.svg", type: "image/svg+xml" },
      { url: "/icons/pks-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/pks-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#111827",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
