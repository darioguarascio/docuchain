import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

import icon from "astro-icon";

// https://astro.build/config
const mountPath = process.env.MOUNT_PATH || "/";
const base = mountPath.endsWith("/") ? mountPath : `${mountPath}/`;
export default defineConfig({
  base,
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      conditions: ["module", "import", "default"],
    },
  },
  compressHTML: false, // disable HTML minification
  integrations: [react(), icon()],
  output: "server",
  security: {
    // checkOrigin: false
  },
  trailingSlash: "ignore",
  server: {
    host: true,
  },
  build: {
    inlineStylesheets: "always",
  },
  adapter: node({
    mode: "middleware",
  }),
  envPrefix: ["PUBLIC_", "STL_V2_"],
});
