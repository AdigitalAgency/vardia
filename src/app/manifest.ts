import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vardia — Πρόγραμμα βαρδιών",
    short_name: "Vardia",
    description: "Το εβδομαδιαίο πρόγραμμα του μαγαζιού σου, online.",
    start_url: "/app",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafafa",
    theme_color: "#4f46e5",
    lang: "el",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
