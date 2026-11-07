import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
// Load local server configuration without embedding secrets into browser bundles.
const localEnv = loadEnv(
  process.env.NODE_ENV === "production" ? "production" : "development",
  process.cwd(),
  "",
);
for (const [key, value] of Object.entries(localEnv)) {
  if (process.env[key] === undefined) process.env[key] = value;
}
const isVercel = process.env.VERCEL === "1" || process.env.NITRO_PRESET === "vercel";

export default defineConfig({
  vite: { envPrefix: "VITE_" },
  nitro: {
    preset: isVercel ? "vercel" : "node-server",
    ...(isVercel
      ? {
          vercel: { functions: { maxDuration: 120 } },
          output: {
            dir: ".vercel/output",
            serverDir: ".vercel/output/functions/__server.func",
            publicDir: ".vercel/output/static",
          },
        }
      : { output: { dir: ".output", serverDir: ".output/server", publicDir: ".output/public" } }),
  },
  tanstackStart: { server: { entry: "server" } },
});
