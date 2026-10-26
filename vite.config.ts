import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { offline } from "./offline"

export default defineConfig({
  plugins: [react(), tailwindcss(), offline()],
  // Pre-bundle the lazily imported media libraries, so the dev server never reloads mid-session.
  optimizeDeps: {
    include: ["mediabunny", "@mediabunny/mp3-encoder","@mediabunny/flac-encoder"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
})
