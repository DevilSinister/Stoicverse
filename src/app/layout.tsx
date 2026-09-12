import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { ToastProvider } from "@/components/ui/toast";

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
        {/*
          At the root rather than inside one surface: a toast has to outlive
          the component that raised it — a dialog closing on a failed save
          would otherwise take the explanation with it.
        */}
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
