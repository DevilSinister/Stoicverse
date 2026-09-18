import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { ToastProvider } from "@/components/ui/toast";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
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

/*
  viewportFit: "cover" is what makes env(safe-area-inset-*) resolve to anything
  other than 0px. Without it the four surfaces that already read those insets -
  MemberModalShell, MemberDetailModal, AuthForm, CheckoutScreen - were silently
  no-ops on every notched device, and the safe-* utilities would be too.
*/
export const viewport: Viewport = {
  themeColor: "#0A0A0B",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${geist.variable} ${jetbrainsMono.variable}`}>
      {/*
        The background, colour and selection styles used to live here as inline
        arbitrary values, which silently overrode the `body` rule in globals.css
        @layer base - so that rule had never applied. They are tokens now, in one
        place, and this element carries only what is genuinely layout.
      */}
      <body className="min-h-screen antialiased">
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
