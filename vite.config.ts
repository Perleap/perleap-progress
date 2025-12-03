import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { ghostmark } from "ghostmark";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    fs: {
      // Allow serving files from node_modules (fallback for development)
      // Note: KaTeX fonts are now copied to public/fonts/katex/ for production compatibility
      allow: [
        '..',
        'C:/Users/dor24',
      ],
    },
  },
  plugins: [react(), mode === "development" && ghostmark()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ['katex'],
  },
}));
