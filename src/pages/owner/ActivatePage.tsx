import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";
import { useSiteBrand } from "@/lib/siteContext";
import { KeyRound, ShieldCheck } from "lucide-react";

/**
 * Owner activation from an emailed invitation.
 *
 * This is how a pre-registered owner first gets a password. Self-registration
 * stays off [scott, 2026-09-08]: without an invite token this page offers
 * nothing but a link to sign in.
 */

const MIN_LENGTH = 10;

export function OwnerActivatePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const brand = useSiteBrand();
  const navigate = useNavigate();
  const { signIn } = useAuthActions();
  const accept = useMutation(api.ownerInvites.accept);

  const invite = useQuery(
    api.ownerInvites.lookup,
    token ? { token } : "skip"
  );

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Choose a password of at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }
    if (!invite || !invite.valid) return;

    setBusy(true);
    try {
      await signIn("password", {
        email: invite.email,
        password,
        flow: "signUp",
      });

      // Burn the token and link the pre-registered ownership record.
      // The auth token is attached to the Convex client asynchronously after
      // signIn resolves, so calling accept() immediately can land as
      // "Not authenticated" and silently leave the invite reusable. Retry
      // briefly instead of assuming the first attempt sticks.
      let accepted = false;
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 8 && !accepted; attempt++) {
        try {
          await accept({ token });
          accepted = true;
        } catch (err) {
          lastErr = err;
          if (!/not authenticated/i.test(String((err as any)?.message ?? err))) {
            throw err;
          }
          await new Promise((r) => setTimeout(r, 400));
        }
      }
      if (!accepted) throw lastErr ?? new Error("Could not complete activation");

      navigate("/owner", { replace: true });
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      setError(
        /already|exists/i.test(msg)
          ? "An account already exists for this email. Use Sign in, or reset your password."
          : "We could not finish setting up your access. Please try again or ask The Club Group for a fresh invitation."
      );
      setBusy(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold">{brand.wordmarkTop ?? "Owner Portal"}</h1>
        </div>
        <div className="bg-background border rounded-xl p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );

  if (!token) {
    return shell(
      <div className="text-center space-y-3">
        <KeyRound className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="text-sm">
          Owner accounts are set up by The Club Group. If you have an invitation
          email, open the link in it to choose your password.
        </p>
        <Link to="/ownerlogin" className="text-sm text-primary hover:underline">
          Already have access? Sign in
        </Link>
      </div>
    );
  }

  if (invite === undefined) {
    return shell(
      <p className="text-sm text-center text-muted-foreground animate-pulse">
        Checking your invitation…
      </p>
    );
  }

  if (!invite.valid) {
    const reason =
      invite.reason === "expired"
        ? "That invitation has expired."
        : invite.reason === "used"
          ? "That invitation has already been used."
          : invite.reason === "revoked"
            ? "That invitation was withdrawn."
            : "That invitation link is not valid.";
    return shell(
      <div className="text-center space-y-3">
        <p className="text-sm font-medium">{reason}</p>
        <p className="text-sm text-muted-foreground">
          Ask The Club Group to send a new invitation, or sign in if you already
          set a password.
        </p>
        <Link to="/ownerlogin" className="text-sm text-primary hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  return shell(
    <>
      <h2 className="font-semibold text-lg">Set up your portal access</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        Choose a password for <strong>{invite.email}</strong>.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full px-3 py-2 border rounded-lg bg-background"
          />
          <p className="text-xs text-muted-foreground mt-1">
            At least {MIN_LENGTH} characters. A short phrase you will remember
            beats a short password.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Confirm password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="w-full px-3 py-2 border rounded-lg bg-background"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
        >
          {busy ? "Setting up…" : "Create my access"}
        </button>
      </form>

      <p className="flex items-center gap-2 text-xs text-muted-foreground mt-5">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        Owner listings, documents and contact details are visible only to
        signed-in owners.
      </p>
    </>
  );
}
