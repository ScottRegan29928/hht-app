import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ResendPasswordReset } from "./passwordReset";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password({
      reset: ResendPasswordReset,
      // Minimum bar only; the portals nudge for something stronger.
      validatePasswordRequirements: (password: string) => {
        if (password.length < 10) {
          throw new Error("Password must be at least 10 characters.");
        }
      },
    }),
  ],
});
