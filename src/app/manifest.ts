import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NIHONGO.GO",
    short_name: "NIHONGO.GO",
    description: "Pixel-perfect Japanese travel phrase PWA.",
    start_url: "/",
    display: "standalone",
    background_color: "#e8e4d0",
    theme_color: "#e8e4d0",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
