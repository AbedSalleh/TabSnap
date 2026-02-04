import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TabSnap - Capture & Record Android Screen Online (No No Install)",
  description: "Free online tool to take screenshots and record video of your Android device directly in your browser. No app installation needed. Supports 1080p recording.",
  keywords: [
    "android screen recorder online",
    "android screenshot to pc",
    "record android screen no root",
    "adb screenrecord online",
    "webusb adb",
    "samsung screen recorder",
    "pixel screen recording",
    "online android debugger",
    "android screen capture no app"
  ],
  openGraph: {
    title: "TabSnap - Instant Android Screenshots",
    description: "Connect your phone via USB and capture screenshots instantly in your browser. No software to install.",
    url: "https://abedsalleh.github.io/TabSnap/",
    type: "website",
    siteName: "TabSnap",
  },
  twitter: {
    card: "summary_large_image",
    title: "TabSnap - Android Screenshots Made Easy",
    description: "Capture high-quality screenshots from any Android device directly to your browser via USB.",
  },
  icons: {
    icon: "/favicon.ico",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="canonical" href="https://abedsalleh.github.io/TabSnap/" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        className="antialiased bg-neutral-950 text-white"
      >
        {children}
      </body>
    </html>
  );
}
