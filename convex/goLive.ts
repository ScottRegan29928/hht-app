/**
 * Outbound email gate for the pre-launch period.
 *
 * Scott, 2026-09-15: "Yes, hold." — all four sites are dev hosts, but
 * RESEND_API_KEY is live, so every form submission was really mailing staff at
 * The Club Group (asutton@cglhhi.com) and, via match alerts, real owners.
 * Until launch, notification mail is recorded in Convex and NOT sent.
 *
 * Heritage-only launch, 2026-11-13: inquiry notifications and replies are
 * released only for the exact Heritage site slug. Other sites and marketplace
 * matches remain held. GO_LIVE stays false; do not use a global flip for a
 * single-site launch. All senders must consult this central gate.
 *
 * ⚠ Auth mail is deliberately EXEMPT (see ALWAYS_SEND). Owner invites and
 * password resets are the only way into the portals; holding them would lock
 * Scott and the client out of their own demo.
 */

/** Global release remains off while the other sites are pre-launch. */
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
export function isEmailHeld(kind: EmailKind, siteSlug?: string): boolean {
  if (GO_LIVE || ALWAYS_SEND.has(kind)) return false;
  // A site launch must not email owners in the shared marketplace or release
  // notifications for another tenant, an unscoped legacy row, or an unknown site.
  if (siteSlug === "heritage" && (kind === "inquiry" || kind === "inquiry_reply")) {
    return false;
  }
  return true;
}

/** Uniform server log line, so a held send is visible instead of silent. */
export function heldEmailNote(kind: EmailKind, to: string): string {
  return `[held:pre-go-live] ${kind} -> ${to} (recorded, not sent; see convex/goLive.ts)`;
}

/**
 * HostAway reservation writes from the rental checkout [scott, 2026-09-07:
 * "We will not write to HostAway until we are ready to go live."].
 * Separate from GO_LIVE on purpose: the first real test booking on each
 * Stripe account flips this alone, before mail goes out to the client.
 * Even when true, a TEST-mode Stripe key never writes to HostAway.
 */
export const HOSTAWAY_WRITES_ENABLED = true;
