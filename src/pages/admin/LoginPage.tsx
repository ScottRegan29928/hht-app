import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Building2, Eye, EyeOff } from "lucide-react";

export function AdminLoginPage() {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const currentUser = useQuery(api.admin.currentUser);
  const setupAdmin = useMutation(api.admin.setupAdmin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");

  // If already logged in as admin, redirect
  const adminRoles = ["admin", "admin_rental", "admin_sales"];
  if (currentUser?.profile?.role && adminRoles.includes(currentUser.profile.role)) {
    navigate("/management");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      await signIn("password", {
        email,
        password,
        flow: mode,
      });

      // If signing up, bootstrap as admin
      if (mode === "signUp") {
        // Small delay to let auth settle
        await new Promise((r) => setTimeout(r, 500));
        try {
          await setupAdmin();
        } catch (err: any) {
          setError(err.message || "Failed to set up admin");
          setIsLoading(false);
          return;
        }
      }

      navigate("/management");
    } catch (err: any) {
      setError(
        mode === "signIn"
          ? "Invalid email or password"
          : err.message || "Sign up failed"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="bg-background rounded-2xl shadow-lg border p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">HHT Admin Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signIn" ? "Sign in to manage listings" : "Create admin account"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="admin@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 pr-10"
                placeholder="••••••••"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
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
            {isLoading ? "Please wait…" : mode === "signIn" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setMode(mode === "signIn" ? "signUp" : "signIn");
              setError("");
            }}
            className="text-sm text-primary hover:underline"
          >
            {mode === "signIn"
              ? "First time? Create admin account"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
