import { adminAuth, adminDb } from "./server";

export interface DecodedAuth {
  uid: string;
  role: "admin" | "employee";
  email?: string;
  name?: string;
}

/**
 * Thrown for every authentication/authorization failure. Never leaks whether a
 * uid exists — callers surface the message straight to the user.
 */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Verifies a Firebase ID token and resolves the caller's CRM role.
 *
 * Role comes from the `role` custom claim (set only by the Admin SDK). The
 * `users/{uid}` document is a fallback for accounts created before claims were
 * issued — Security Rules make that document admin-writable only, so it is not
 * a self-service escalation path.
 *
 * `checkRevoked` is on deliberately: FR-3 requires that disabling an employee
 * blocks them immediately, not whenever their hour-long token happens to expire.
 */
export async function verifyAuth(token: string): Promise<DecodedAuth> {
  if (!token) {
    throw new AuthError("Not signed in.");
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token, true);
  } catch {
    throw new AuthError("Your session is invalid or has expired. Please sign in again.");
  }

  const snap = await adminDb.collection("users").doc(decoded.uid).get();
  if (!snap.exists) {
    throw new AuthError("This account has no CRM profile. Ask an administrator to add you.");
  }

  const profile = snap.data() ?? {};
  if (profile.status === "DISABLED") {
    throw new AuthError("This account has been disabled.");
  }

  const role = (decoded.role as string | undefined) ?? profile.role;
  if (role !== "admin" && role !== "employee") {
    throw new AuthError("This account has no role assigned. Ask an administrator to set one.");
  }

  return {
    uid: decoded.uid,
    role,
    email: decoded.email ?? profile.email,
    name: profile.name,
  };
}

/** Verifies the caller and rejects anyone who is not an admin. */
export async function requireAdmin(token: string): Promise<DecodedAuth> {
  const auth = await verifyAuth(token);
  if (auth.role !== "admin") {
    throw new AuthError("Only an administrator can do this.");
  }
  return auth;
}
