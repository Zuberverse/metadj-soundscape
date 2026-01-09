import type { Metadata } from "next";
import { Cinzel, Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: true,
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "MetaDJ Soundscape - Audio-Reactive AI Video Generation",
  description: "Transform music into mesmerizing AI-generated visuals in real-time. Built for the Daydream Scope Track.",
  keywords: ["AI", "video generation", "StreamDiffusion", "audio reactive", "Daydream Scope", "MetaDJ", "Soundscape"],
  authors: [{ name: "MetaDJ", url: "https://metadj.ai" }],
  openGraph: {
    title: "MetaDJ Soundscape - Audio-Reactive AI Video Generation",
    description: "Transform music into mesmerizing AI-generated visuals in real-time.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins.variable} ${cinzel.variable} antialiased bg-scope-bg text-white min-h-screen`}
      >
        {/* Skip link for keyboard accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-scope-purple focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-scope-cyan"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
