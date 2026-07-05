import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ポケカ総合センター",
  description: "ポケモンカードのデッキ作成・練習・カードジム探しをまとめて扱うアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
