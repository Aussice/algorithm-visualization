import type { Metadata } from "next";
import "./globals.css";
import {LanguageProvider,LanguageToggle} from "./language-provider";

export const metadata: Metadata = {
  title: "算法可视化实验室",
  description: "通过可交互实验观察演化博弈、多机器人协作与组合优化算法。",
  other: {
    "codex-preview": "development",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body><LanguageProvider><LanguageToggle/>{children}</LanguageProvider></body>
    </html>
  );
}
