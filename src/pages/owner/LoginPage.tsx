import { useAuthActions } from "@convex-dev/auth/react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Key } from "lucide-react";

/**
 * Owner sign-in. No self-registration [scott, 2026-09-08]: owner accounts are
 * created by staff in the management portal. Lost passwords are recovered with
 * an emailed reset code.
 */
type Mode = "signIn" | "reset" | "resetVerify";

export function OwnerLoginPage() {
  const { signIn, signOut } = useAuthActions();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("signIn");
  const clearedRef = useRef(false);

  // On mount, sign out any existing session (admin, etc.) so the owner
  // can authenticate fresh without session conflicts.
  useEffect(() => {
    if (!clearedRef.current) {
      clearedRef.current = true;
      signOut().catch(() => {});
    }
  }, [signOut]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setNotice("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (mode === "resetVerify") {
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (newPassword.length < 10) {
        setError("Password must be at least 10 characters.");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "signIn") {
        await signIn("password", { email, password, flow: "signIn" });
        navigate("/owner");
      } else if (mode === "reset") {
        await signIn("password", { email, flow: "reset" });
        setMode("resetVerify");
        setNotice(`We sent a reset code to ${email}. It expires in 20 minutes.`);
      } else {
        await signIn("password", {
          email,
          code,
          newPassword,
          flow: "reset-verification",
        });
        navigate("/owner");
      }
    } catch {
      if (mode === "signIn") {
        setError("Invalid email or password.");
      } else if (mode === "reset") {
        // Deliberately generic: don't reveal whether an account exists.
        setMode("resetVerify");
        setNotice(`If an account exists for ${email}, a reset code is on its way.`);
      } else {
        setError("That code was incorrect or has expired. Request a new one.");
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="bg-background rounded-2xl shadow-lg border p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Key className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Owner Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signIn"
              ? "Sign in to manage your timeshare listings"
              : "Reset your password"}
          </p>
        </div>

        {mode !== "signIn" && (
          <p className="text-sm text-muted-foreground mb-4">
            {mode === "reset"
              ? "Enter your email and we'll send a one-time code. You'll use it to choose a new password."
              : "Enter the 8-digit code from the email, then pick a new password. The code isn't your password."}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="you@example.com"
              required
              autoComplete="username"
            />
          </div>

          {mode === "signIn" && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
          )}

          {mode === "resetVerify" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Reset code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value.trim())}
                  className={`${inputClass} tracking-[0.3em]`}
                  placeholder="00000000"
                  required
                  autoComplete="one-time-code"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  New password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  placeholder="At least 10 characters"
                  required
                  minLength={10}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Confirm new password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </div>
            </>
          )}

          {notice && (
            <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
              {notice}
            </p>
          )}

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading
              ? "Please wait…"
              : mode === "signIn"
                ? "Sign In"
                : mode === "reset"
                  ? "Email me a reset code"
                  : "Set new password & sign in"}
          </button>
        </form>

        <div className="mt-6 text-center">
          {mode === "signIn" ? (
            <button
              type="button"
              onClick={() => switchMode("reset")}
              className="text-sm text-primary font-medium hover:underline"
            >
              Forgot your password?
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchMode("signIn")}
              className="text-sm text-primary font-medium hover:underline"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
