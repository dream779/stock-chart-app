import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '自选基金看板',
  description: '查看自选基金净值、估算涨跌幅与历史走势',
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
