import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Node.js polyfills
      buffer: 'buffer',
      stream: 'stream-browserify',
      util: 'util',
      process: 'process/browser',
      events: 'events',
      url: 'url',
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    },
    include: [
      'buffer',
      'process',
      'util',
      'events',
      'url',
      'stream',
    ],
  },
  define: {
    'process.env': process.env,
    global: 'globalThis',
  },
});
