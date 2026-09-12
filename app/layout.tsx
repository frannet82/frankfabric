import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Frank Cloud Fabric — Enterprise Cloud & Generative AI Architecture",
  description:
    "Frank Cloud Fabric designs resilient, massive-scale cloud architectures where enterprise content, machine learning, and generative intelligence converge.",
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
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Cormorant+Garamond:wght@500;600&family=Jost:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body bg-cloud-bg text-[#e8eaf0]">{children}</body>
    </html>
  );
}
