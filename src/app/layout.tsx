import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import ErrorBoundary from "@/components/ErrorBoundary";
import "./globals.css";

export const metadata: Metadata = {
  title: "OTTODOT Trial Booking System",
  description:
    "Book trial classes for Ottodot's live online science and math classes. Game-based learning for Primary 1-6.",
  keywords: ["trial class", "booking", "math", "science", "education", "kids"],
  authors: [{ name: "OTTODOT" }],
  openGraph: {
    title: "OTTODOT Trial Booking System",
    description: "Book trial classes for Ottodot's live online science and math classes.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        {/* Skip link for keyboard navigation */}
        <a
          href="#main-content"
          className="skip-link"
        >
          Skip to main content
        </a>
        
        <Header />
        
        <main 
          id="main-content"
          className="flex-grow"
          role="main"
        >
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
        
        <Footer />
      </body>
    </html>
  );
}
