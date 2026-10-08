import { useRouter } from "expo-router";
import { useAuth } from "./auth-context";
import { confirm } from "../ui/dialog";

/**
 * Wraps transactional actions. Guests are prompted to create a free account;
 * the server independently enforces the same rule.
 */
export function useRequireAccount() {
  const { status } = useAuth();
  const router = useRouter();

  return (run: () => void, message = "Create a free Fighter account to use this feature.") => {
    if (status === "authenticated") {
      run();
      return;
    }
    if (status === "guest" || status === "signed_out") {
      confirm("Create an account", message, () => router.push("/(auth)/signup"), {
        confirmLabel: "Sign up",
      });
      return;
    }
  };
}
