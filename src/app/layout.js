import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  metadataBase: new URL('https://xiaohei-video-station.vercel.app'),
  title: {
    default: "小黑搜影 - 免费在线影视搜索平台 | 电影电视剧动漫综艺在线观看",
    template: "%s | 小黑搜影"
  },
  description: "小黑搜影提供免费在线影视搜索服务，聚合量子高清、飞飞资源、红牛专线、索尼资源等多个高清视频源，支持电影、电视剧、动漫、综艺在线观看。无需下载，即点即播，海量资源免费看。",
  keywords: [
    "小黑搜影", "免费电影", "在线观看", "电视剧", "动漫", "综艺",
    "影视搜索", "免费影视", "高清电影", "在线视频", "影视大全",
    "追剧网站", "电影网站", "免费看剧", "在线播放", "影视资源",
    "量子高清", "飞飞资源", "红牛专线", "索尼资源",
    "最新电影", "热门电视剧", "日本动漫", "国产剧", "美剧", "韩剧",
    "免费追剧", "高清在线", "无广告", "免VIP", "影视聚合",
    "电影在线免费看", "电视剧在线免费看", "动漫在线免费看"
  ].join(","),
  authors: [{ name: "小黑搜影" }],
  creator: "小黑搜影",
  publisher: "小黑搜影",

  // Open Graph 配置
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "https://xiaohei-video-station.vercel.app",
    siteName: "小黑搜影",
    title: "小黑搜影 - 免费在线影视搜索平台",
    description: "聚合量子高清、飞飞资源、红牛专线、索尼资源等多个高清视频源，免费在线观看电影、电视剧、动漫、综艺。无需下载，即点即播，海量资源免费看。",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "小黑搜影 - 免费在线影视搜索平台"
      }
    ]
  },

  // Twitter Card 配置
  twitter: {
    card: "summary_large_image",
    title: "小黑搜影 - 免费在线影视搜索平台",
    description: "聚合多个高清视频源，免费在线观看电影、电视剧、动漫、综艺",
    images: ["/og-image.png"],
    creator: "@xiaoheisoying"
  },

  // 搜索引擎爬虫配置
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // 网站图标配置
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },

  // 其他元数据
  alternates: {
    canonical: "https://xiaohei-video-station.vercel.app",
  },

  // 分类标签
  category: "entertainment",

  // 其他SEO标签
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'format-detection': 'telephone=no',
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
