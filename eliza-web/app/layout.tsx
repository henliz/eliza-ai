import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ELIZA — University AI Portal",
  description: "Institutional AI Assistant · MOSAIC University",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
