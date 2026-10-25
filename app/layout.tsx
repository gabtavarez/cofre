import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/sora";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mymony",
  description: "Mymony — seu dinheiro, do seu jeito.",
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Mymony", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a0f1e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
