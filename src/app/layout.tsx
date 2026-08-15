import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Kaushan_Script, Rubik } from "next/font/google";
import { BottomNav, Header } from "@/components/Header";
import { InstallPrompt } from "@/components/InstallPrompt";
import { NotificationPermissionGate } from "@/components/NotificationPermissionGate";
import { SerwistRegister } from "@/components/SerwistRegister";
import { getSetting } from "@/lib/settings";
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

export const metadata: Metadata = {
  title: "Aviel Naim | קביעת תורים",
  description: "מספרת יוקרה — קביעת תורים online",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Aviel Naim | קביעת תורים",
    description: "מספרת יוקרה — קביעת תורים online",
    images: [{ url: "/screenshots/home-mobile.png", width: 390, height: 844, alt: "Aviel Naim" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Aviel Naim",
  },
};

export const dynamic = "force-dynamic";

export async function generateViewport(): Promise<Viewport> {
  const theme = await getSetting("theme", "dark");
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
  const theme = await getSetting("theme", "dark");

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
        <SerwistRegister />
        <NotificationPermissionGate />
      </body>
    </html>
  );
}
