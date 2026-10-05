import { describe, expect, it } from "vitest";
import { errorIncidentKey, explicitIncidentKey, featureIncidentKey } from "../github-incidents";
import { cueFeatureResultSchema } from "../feature-health";

describe("readable incident keys", () => {
  it("builds a stable feature key from understandable components", () => {
    const event = cueFeatureResultSchema.parse({
      type: "feature.result",
      feature: "auth.signup",
      outcome: "failure",
      reason: "dependency_unavailable",
      error: {
        name: "AuthProviderError",
        message: "Provider unavailable for user 827364827364",
        code: "AUTH_503",
        status: 503,
        stack: "AuthProviderError: failed\n    at createAccount (signup.ts:42:7)",
      },
    });
    expect(featureIncidentKey(event)).toBe(
      "auth.signup/dependency_unavailable/auth/auth_503/createaccount",
    );
  });

  it("normalizes trusted explicit keys without obscuring their components", () => {
    expect(explicitIncidentKey("Checkout / Stripe API / CARD_DECLINED / order 827364827364"))
      .toBe("checkout/stripe_api/card_declined/order_dynamic");
  });

  it("derives generic error keys without timestamps, line numbers, or identifiers", () => {
    expect(errorIncidentKey({
      title: "Checkout failed for 827364827364",
      error: { name: "StripeError", code: "STRIPE_503", stack: "Error\n at chargeCard (billing.ts:81:9)" },
      data: { component: "Stripe API" },
    })).toBe("error.occurred/stripe_api/stripe_503/chargecard");
  });
});
