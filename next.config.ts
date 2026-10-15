import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O dev server trata 127.0.0.1 como outra origem e recusa o HMR.
  // Sem isso a página fica presa em "Carregando música…".
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
