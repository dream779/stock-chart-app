import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "美股基金行情看板",
  description: "查看标普500、纳斯达克100及自选基金数据",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
