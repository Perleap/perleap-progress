import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { cpSync, mkdirSync } from "fs";
import { ghostmark } from "ghostmark";

const FFMPEG_PACKAGE_VERSION = "0.12.15";
const FFMPEG_WORKER_FILES = ["worker.js", "const.js", "errors.js"] as const;

/** Copy @ffmpeg/ffmpeg ESM worker + deps to public/ so prod serves them same-origin (COOP/COEP). */
function ffmpegWorkerStaticAssets(): Plugin {
  const copyWorkerAssets = () => {
    const srcDir = path.resolve(
      __dirname,
      "node_modules/@ffmpeg/ffmpeg/dist/esm"
    );
    const destDir = path.resolve(
      __dirname,
      `public/ffmpeg/${FFMPEG_PACKAGE_VERSION}`
    );
    mkdirSync(destDir, { recursive: true });
    for (const file of FFMPEG_WORKER_FILES) {
      cpSync(path.join(srcDir, file), path.join(destDir, file));
    }
  };

  return {
    name: "ffmpeg-worker-static-assets",
    buildStart: copyWorkerAssets,
    configureServer() {
      copyWorkerAssets();
    },
  };
}

/** COOP/COEP for ffmpeg.wasm; CORP so Vite dev assets (incl. worker.js) are not blocked. */
function crossOriginIsolationHeaders(): Plugin {
  return {
    name: "cross-origin-isolation-headers",
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((_req, res, next) => {
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  assetsInclude: ["**/*.wasm"],
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
  plugins: [
    react(),
    ffmpegWorkerStaticAssets(),
    crossOriginIsolationHeaders(),
    mode === "development" && ghostmark(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ['katex'],
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
}));
