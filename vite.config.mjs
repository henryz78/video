import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { handleProviderRequest } from "./providers/runtime.js";

function providerDevApi() {
  return {
    name: "provider-dev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/provider-api/")) return next();
        const requestUrl = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
        const response = await handleProviderRequest(requestUrl);
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await response.arrayBuffer()));
      });
    },
  };
}

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [providerDevApi(), react()],
});
