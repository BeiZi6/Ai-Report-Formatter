import type { Metadata } from "next";

import { ThemeProvider } from "@/components/theme/ThemeProvider";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI 报告排版助手",
  description: "把 Markdown 转换为专业 Word 文档的排版助手。",
  icons: {
    icon: "/ai-report-icon.svg",
    shortcut: "/ai-report-icon.svg",
    apple: "/ai-report-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-theme="dopamine">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
