import { createNoxCue } from "@noxcue/sdk/browser";

const noxcue = createNoxCue({
  key: "nox_pub_replace_with_your_browser_key",
});

export async function observeSignup<T>(operation: () => T | Promise<T>): Promise<T> {
  return noxcue.auth.signup(operation);
}
