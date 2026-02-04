import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TabScreenshotter",
  description: "Capture screenshots from your USB connected device",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased bg-neutral-950 text-white"
      >
        {children}
      </body>
    </html>
  );
}
