type DevLocalhostEnv = {
  NODE_ENV?: string;
  DEV_LOCALHOST?: string;
};

/**
 * Login desligado nesta máquina. Ignorado em produção, para um deploy com a
 * variável esquecida não abrir o app sem sessão.
 */
export function isDevLocalhost(env: DevLocalhostEnv = process.env): boolean {
  if (env.NODE_ENV === "production") {
    return false;
  }
  return env.DEV_LOCALHOST === "true";
}
