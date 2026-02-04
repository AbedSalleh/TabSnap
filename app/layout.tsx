import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TabSnap - Capture Android Screenshots Online (No App Required)",
  description: "Free online tool to take screenshots of your Android device wirelessly or via USB directly in your browser. No app installation needed. Works with Samsung, Pixel, Xiaomi, and more.",
  keywords: [
    "android screenshot to pc",
    "view android screen on pc",
    "adb screenshot online",
    "webusb adb",
    "capture android screen without root",
    "samsung screenshot tool",
    "pixel screenshot to computer",
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
