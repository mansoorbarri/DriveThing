import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Geist } from "next/font/google";
import { Providers } from "~/components/providers";
import { PwaRegistration } from "~/components/pwa-registration";

export const metadata: Metadata = {
  title: "DriveThing",
  description: "Simple file storage for your family",
  applicationName: "DriveThing",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DriveThing",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0a0b",
  colorScheme: "dark",
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="font-sans antialiased">
        <PwaRegistration />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
