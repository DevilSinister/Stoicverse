import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Stoicverse",
  description: "A disciplined community learning platform for tiered study, events, and mentorship.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-[var(--color-surface-container-lowest)] text-[var(--color-on-surface)] font-body-md antialiased min-h-screen selection:bg-[var(--color-primary-container)] selection:text-[var(--color-on-primary-fixed)]">
        {children}
      </body>
    </html>
  );
}
