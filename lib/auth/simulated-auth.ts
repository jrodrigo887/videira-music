type SimulatedAuthEnv = {
  NODE_ENV?: string;
  VIDEIRA_SIMULATED_USER_ID?: string;
};

/**
 * Usuário simulado até existir autenticação real. Nunca é aceito em produção,
 * para que um deploy com a variável esquecida não entregue acesso a ninguém.
 */
export function resolveSimulatedUserId(env: SimulatedAuthEnv = process.env): string | undefined {
  if (env.NODE_ENV === "production") {
    return undefined;
  }
  const userId = env.VIDEIRA_SIMULATED_USER_ID?.trim();
  return userId ? userId : undefined;
}
