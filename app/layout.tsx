import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { LoadingState, SiteFooter, SiteHeader } from "@/src/components";
import { AuthContextProvider } from "@/src/components/auth/auth-context";
import { RouteGuard } from "@/src/components/auth/route-guard";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Family Pot",
  description:
    "Track money sent home, its costs, and how it compares with other routes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:outline-2 focus:outline-offset-2 focus:outline-foreground"
        >
          Skip to content
        </a>
        <AuthContextProvider>
          <SiteHeader />
          <main id="main-content" className="flex flex-1 flex-col">
            {/* useSearchParams (in the guard) needs a Suspense boundary. */}
            <Suspense fallback={<LoadingState />}>
              <RouteGuard>{children}</RouteGuard>
            </Suspense>
          </main>
        </AuthContextProvider>
        <SiteFooter />
      </body>
    </html>
  );
}
