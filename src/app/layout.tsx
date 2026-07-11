import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="dark">
      <body className="bg-[var(--color-surface-container-lowest)] text-[var(--color-on-surface)] font-body-md antialiased min-h-screen selection:bg-[var(--color-primary-container)] selection:text-[var(--color-on-primary-fixed)]">
        {children}
      </body>
    </html>
  );
}
