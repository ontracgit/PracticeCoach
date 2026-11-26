import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@elevenlabs/react": path.resolve(__dirname, "test/mock-elevenlabs.tsx") } },
  build: { outDir: "dist-test" },
});
