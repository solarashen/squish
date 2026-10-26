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
    // The jSquash codecs load their .wasm files by URL, which pre-bundling would break.
    exclude: ["@jsquash/jpeg","@jsquash/oxipng","@jsquash/avif"],
  },
  // Workers use ES modules, so they can load the WebAssembly encoders on demand.
  worker: { format: "es" },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
})
