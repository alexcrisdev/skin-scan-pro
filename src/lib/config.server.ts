// Server configuration is read at runtime. Never prefix secrets with VITE_.
export function getServerConfig() {
  return { nodeEnv: process.env.NODE_ENV, mode: process.env.NODE_ENV };
}
