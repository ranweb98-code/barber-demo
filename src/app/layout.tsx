import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Kaushan_Script, Rubik } from "next/font/google";
import { BottomNav, Header } from "@/components/Header";
import { InstallPrompt } from "@/components/InstallPrompt";
import { NotificationPermissionGate } from "@/components/NotificationPermissionGate";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { getThemeFromCookie } from "@/lib/theme";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const migdal = localFont({
  src: "../../public/fonts/migdal-haemek.woff",
  variable: "--font-migdal",
  weight: "400",
  display: "swap",
});

const brand = Kaushan_Script({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["400"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ??
  "https://aviel-naim.ranweb98.workers.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Aviel Naim | קביעת תורים",
  description: "מספרת יוקרה — קביעת תורים online",
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "he_IL",
    url: "/",
    siteName: "Aviel Naim",
    title: "Aviel Naim | קביעת תורים",
    description: "מספרת יוקרה — קביעת תורים online",
    images: [
      {
        url: "/og-share.jpg",
        width: 1024,
        height: 682,
        alt: "Aviel Naim — מספרת יוקרה",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aviel Naim | קביעת תורים",
    description: "מספרת יוקרה — קביעת תורים online",
    images: ["/og-share.jpg"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Aviel Naim",
  },
};

export const dynamic = "force-dynamic";

export async function generateViewport(): Promise<Viewport> {
  const theme = await getThemeFromCookie();
  return {
    themeColor: theme === "light" ? "#ffffff" : "#000000",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await getThemeFromCookie();

  return (
    <html lang="he" dir="rtl" data-theme={theme}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={`${rubik.variable} ${migdal.variable} ${brand.variable} antialiased`}>
        <Header />
        <main className="page-shell">{children}</main>
        <BottomNav />
        <InstallPrompt />
        <ServiceWorkerRegister />
        <NotificationPermissionGate />
      </body>
    </html>
  );
}
