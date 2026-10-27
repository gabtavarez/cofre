import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // navegação instantânea ao voltar/ir entre telas já visitadas (ações invalidam o cache)
  experimental: { staleTimes: { dynamic: 60, static: 300 } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
