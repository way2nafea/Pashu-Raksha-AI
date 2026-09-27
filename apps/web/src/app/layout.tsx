import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "PASHU-RAKSHAK AI — Livestock Disease Surveillance",
  description: "Detect Early • Respond Faster • Protect Livestock — SIH 2026, PS 26128",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pashu-Rakshak",
  },
};

export const viewport: Viewport = {
  themeColor: "#1F3823",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <I18nProvider>
          <AuthProvider>{children}</AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
