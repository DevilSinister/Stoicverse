/** Shared between the signup form and the server action so the requirement the
 *  UI advertises is the requirement that is actually enforced. */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * The one thing signup ever says back.
 *
 * Uniform on purpose, so the response cannot be used to test whether an address
 * is already registered - the registered and unregistered cases take the same
 * exit and land on the same screen.
 *
 * It lives here rather than beside the action because `auth/actions.ts` is a
 * "use server" module, and such a module may only export async functions: a
 * string export there fails the whole file at build time, with every import of
 * every action in it reported as missing.
 */
export const SIGNUP_ACK =
  "If that email is not already registered, a confirmation link is on its way. Open it to verify your account, then log in.";
