import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Frank Murillo — Enterprise Cloud & Generative AI Architect",
  description:
    "Frank Murillo designs resilient, massive-scale cloud architectures where enterprise content, machine learning, and generative AI converge. AWS and Adobe certified.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Cormorant+Garamond:wght@500;600&family=Jost:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body bg-cloud-bg text-[#e8eaf0]">{children}</body>
    </html>
  );
}
