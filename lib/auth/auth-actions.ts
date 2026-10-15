"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "./better-auth";
import { safeNextPath } from "./page-gate";

export async function signInWithGoogle(options?: {
  inviteCode?: string;
  next?: string;
}): Promise<void> {
  const auth = getAuth();
  if (!auth) {
    redirect("/entrar?error=unavailable");
  }

  const callbackURL = safeNextPath(options?.next);
  const result = await auth.api.signInSocial({
    body: {
      provider: "google",
      requestSignUp: Boolean(options?.inviteCode),
      callbackURL,
      errorCallbackURL: "/entrar?error=google",
      ...(options?.inviteCode
        ? { additionalData: { inviteCode: options.inviteCode } }
        : {}),
    },
    headers: await headers(),
  });

  if (result.redirect && result.url) {
    redirect(result.url);
  }
}

export async function signOut(): Promise<void> {
  const auth = getAuth();
  if (!auth) {
    redirect("/");
  }
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}
