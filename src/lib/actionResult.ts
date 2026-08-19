/**
 * Result type for Server Actions.
 *
 * Next.js redacts thrown error messages in production builds, so an action that
 * signals failure by throwing gives the user "An unexpected error occurred"
 * regardless of what actually went wrong. Returning a result keeps the real
 * message — "This lead was already assigned", "Your session has expired" —
 * which is the difference between a usable app and a mysterious one.
 *
 * Unexpected errors are still logged server-side and reduced to a generic
 * message, so internals never leak to the client.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}

/**
 * Runs an action body, converting expected failures into `{ ok: false }`.
 *
 * `AuthError` and `UserFacingError` messages are written for the user and pass
 * through verbatim. Anything else is a bug or an outage: logged in full, shown
 * as a generic message.
 */
export async function runAction<T>(
  label: string,
  body: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await body() };
  } catch (error) {
    const isUserFacing =
      error instanceof UserFacingError ||
      (error instanceof Error && error.name === 'AuthError');

    if (isUserFacing) {
      return { ok: false, error: (error as Error).message };
    }

    console.error(`[action:${label}]`, error);
    return {
      ok: false,
      error: 'Something went wrong on our side. Please try again, or contact your administrator if it keeps happening.',
    };
  }
}
