/**
 * Outbound email gate for the pre-launch period.
 *
 * Scott, 2026-09-15: "Yes, hold." — all four sites are dev hosts, but
 * RESEND_API_KEY is live, so every form submission was really mailing staff at
 * The Club Group (asutton@cglhhi.com) and, via match alerts, real owners.
 * Until launch, notification mail is recorded in Convex and NOT sent.
 *
 * ⚠ TO GO LIVE: flip GO_LIVE to true and redeploy Convex. That is the whole
 * change. Do not remove individual guards — they all read this one flag, which
 * is why there is no way to half-launch.
 *
 * ⚠ Auth mail is deliberately EXEMPT (see ALWAYS_SEND). Owner invites and
 * password resets are the only way into the portals; holding them would lock
 * Scott and the client out of their own demo.
 */

/** Flip to `true` at launch. */
export const GO_LIVE = false;

/**
 * Every kind of outbound mail the app can send. Adding a new sender means
 * adding it here, which forces the send/hold decision to be explicit.
 */
export type EmailKind =
  // Notification mail to staff/owners — held until go-live.
  | "inquiry"
  | "inquiry_reply"
  | "marketplace_match"
  // Auth/transactional mail — always sent, pre-launch included.
  | "owner_invite"
  | "password_reset";

/**
 * Mail that must work before launch because it grants portal access.
 * These go to a single person who just asked for them, never to the client.
 */
const ALWAYS_SEND: ReadonlySet<EmailKind> = new Set<EmailKind>([
  "owner_invite",
  "password_reset",
]);

/**
 * True when this kind of mail must not leave the building yet.
 * Callers should record the row/attempt as usual and skip only the send.
 */
export function isEmailHeld(kind: EmailKind): boolean {
  if (GO_LIVE) return false;
  return !ALWAYS_SEND.has(kind);
}

/** Uniform server log line, so a held send is visible instead of silent. */
export function heldEmailNote(kind: EmailKind, to: string): string {
  return `[held:pre-go-live] ${kind} -> ${to} (recorded, not sent; see convex/goLive.ts)`;
}
