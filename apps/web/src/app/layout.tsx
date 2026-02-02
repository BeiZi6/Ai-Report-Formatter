import type { Metadata } from "next";
import { Alegreya, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const display = Alegreya({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ui = IBM_Plex_Sans({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AI 报告排版助手",
  description: "把 Markdown 转换为专业 Word 文档的排版助手。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${display.variable} ${ui.variable}`}>
        {children}
      </body>
    </html>
  );
}
