import type { Metadata } from "next";
import { Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

// 使用支持中文的字体
const notoSansSC = Noto_Sans_SC({ 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-noto-sans-sc",
});

export const metadata: Metadata = {
  title: "GreenTrace - 碳信用NFT生态系统",
  description: "通过区块链技术记录您的环保行为，将绿色行动转化为有价值的NFT资产",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${notoSansSC.variable} antialiased`}>
      <body suppressHydrationWarning={true} className={notoSansSC.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
