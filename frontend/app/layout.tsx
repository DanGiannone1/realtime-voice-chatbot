import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebRTC Voice Assistant",
  description: "Realtime voice chatbot using WebRTC",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}