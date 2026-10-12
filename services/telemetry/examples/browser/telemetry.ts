import { createTelemetry } from "@noxhere/sdk/telemetry/browser";

const telemetry = createTelemetry({
  key: "nox_pub_replace_with_your_browser_key",
  environment: "production",
  release: "my-app@1.0.0",
});

export async function observeSignup<T>(operation: () => T | Promise<T>): Promise<T> {
  return telemetry.auth.signup(operation);
}
