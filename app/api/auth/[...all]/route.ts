import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth/better-auth";

const auth = getAuth();
const handler = auth ? toNextJsHandler(auth) : undefined;

export async function GET(request: Request): Promise<Response> {
  if (!handler) {
    return Response.json({ error: { code: "AUTH_UNAVAILABLE" } }, { status: 503 });
  }
  return handler.GET(request);
}

export async function POST(request: Request): Promise<Response> {
  if (!handler) {
    return Response.json({ error: { code: "AUTH_UNAVAILABLE" } }, { status: 503 });
  }
  return handler.POST(request);
}
