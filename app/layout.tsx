import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PURR-RUN — Cat Side-Scroller",
  description: "A cat side-scroller where you jump over evil mice and crouch under dogs.",
  openGraph: {
    title: "PURR-RUN",
    description: "The cat side-scroller. Jump, double-jump, and crouch your way to glory.",
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
      <body className="bg-[#06040f] text-white antialiased">{children}</body>
    </html>
  );
}
