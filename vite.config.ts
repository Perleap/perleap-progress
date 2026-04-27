import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { ghostmark } from "ghostmark";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    watch: {
      // OneDrive / tooling can touch many paths; ignoring churn reduces HMR storms and console spam.
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/debug-*.log",
        "**/~$*",
        // Office/OneDrive temp & sync noise (Windows)
        "**/~$*.*",
        "**/*.lnk",
        "**/desktop.ini",
      ],
    },
    fs: {
      // Allow importing from repo parent only — never the whole user profile (causes massive watch noise).
      allow: [path.resolve(__dirname, "..")],
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
