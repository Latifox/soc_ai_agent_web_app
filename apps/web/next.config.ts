import path from "node:path";

import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Single source of truth: load the monorepo-root `.env` so the web app shares the exact
// same env file as the API and agents (no duplicated apps/web/.env). Root values fill in
// without overriding anything already set in the environment (e.g. Railway service vars).
loadEnvConfig(path.resolve(process.cwd(), "../.."), process.env.NODE_ENV !== "production");

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
