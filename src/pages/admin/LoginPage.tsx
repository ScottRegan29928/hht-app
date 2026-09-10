import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Eye, EyeOff } from "lucide-react";

/**
 * Admin sign-in. There is deliberately no self-registration: admin accounts
 * are created from inside the portal by a super admin [scott, 2026-09-10].
 * Lost passwords go through the emailed reset code instead.
 */
type Mode = "signIn" | "reset" | "resetVerify";

export function AdminLoginPage() {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const currentUser = useQuery(api.admin.currentUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<Mode>("signIn");

  // If already logged in as admin, redirect
  const adminRoles = ["admin", "admin_user", "admin_rental", "admin_sales"];
  if (currentUser?.profile?.role && adminRoles.includes(currentUser.profile.role)) {
    navigate("/management");
    return null;
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setNotice("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setNotice("");

    try {
      if (mode === "signIn") {
        await signIn("password", { email, password, flow: "signIn" });
        navigate("/management");
        return;
      }

      if (mode === "reset") {
        await signIn("password", { email, flow: "reset" });
        setMode("resetVerify");
        setNotice(`We sent a reset code to ${email}. It expires in 20 minutes.`);
        return;
      }

      // resetVerify
      await signIn("password", {
        email,
        code,
        newPassword,
        flow: "reset-verification",
      });
      navigate("/management");
    } catch (err: any) {
      if (mode === "signIn") {
        setError("Invalid email or password");
      } else if (mode === "reset") {
        // Deliberately generic: don't reveal whether an account exists.
        setMode("resetVerify");
        setNotice(`If an account exists for ${email}, a reset code is on its way.`);
      } else {
        setError(
          err?.message?.includes("at least 10")
            ? "Password must be at least 10 characters."
            : "That code was incorrect or has expired. Request a new one."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="bg-background rounded-2xl shadow-lg border p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <img
            src="/brand/cgl/logo-color.png"
            alt="The Club Group"
            className="h-[72px] w-auto mx-auto"
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="admin@example.com"
              required
              autoComplete="username"
            />
          </div>

          {mode === "signIn" && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass} pr-10`}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
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
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`${inputClass} pr-10`}
                    placeholder="At least 10 characters"
                    required
                    minLength={10}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {notice && (
            <div className="text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 rounded-lg">
              {notice}
            </div>
          )}

          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isLoading
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
              onClick={() => switchMode("reset")}
              className="text-sm text-primary hover:underline"
            >
              Forgot your password?
            </button>
          ) : (
            <button
              onClick={() => switchMode("signIn")}
              className="text-sm text-primary hover:underline"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
