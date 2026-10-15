import { isDevLocalhost } from "./dev-localhost";

type SimulatedAuthEnv = {
  NODE_ENV?: string;
  DEV_LOCALHOST?: string;
  VIDEIRA_SIMULATED_USER_ID?: string;
};

const SEEDED_ADMIN_USER_ID = "user-admin";

/**
 * Usuário simulado fora de produção. Nunca é aceito em produção.
 * `DEV_LOCALHOST=false` exige a sessão real e ignora o usuário simulado.
 * `DEV_LOCALHOST=true` sem id explícito usa o admin do seed.
 */
export function resolveSimulatedUserId(env: SimulatedAuthEnv = process.env): string | undefined {
  if (env.NODE_ENV === "production" || env.DEV_LOCALHOST === "false") {
    return undefined;
  }
  const userId = env.VIDEIRA_SIMULATED_USER_ID?.trim();
  if (userId) {
    return userId;
  }
  if (isDevLocalhost(env)) {
    return SEEDED_ADMIN_USER_ID;
  }
  return undefined;
}
