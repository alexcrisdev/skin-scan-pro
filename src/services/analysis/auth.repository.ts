import { getSupabaseAdminClient } from "@/lib/supabase.server";
import { UnauthorizedError } from "./errors";
export type AuthenticatedUser = { authUserId: string; email?: string };
export async function authenticateRequest(request: Request): Promise<AuthenticatedUser> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new UnauthorizedError("Falta el token de autenticación.");
  return authenticateToken(token);
}
export async function authenticateToken(token: string): Promise<AuthenticatedUser> {
  const client = await getSupabaseAdminClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new UnauthorizedError("Sesión inválida o expirada.");
  return { authUserId: data.user.id, email: data.user.email };
}
