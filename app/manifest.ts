import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mymony",
    short_name: "Mymony",
    description: "Mymony — seu dinheiro, do seu jeito.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0f1e",
    theme_color: "#0a0f1e",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
