import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ポケカデッキメーカー",
  description: "ポケモンカードのデッキを作成・編集するアプリ",
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
