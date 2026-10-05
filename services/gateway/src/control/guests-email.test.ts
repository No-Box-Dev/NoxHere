import { afterEach, describe, expect, it, vi } from "vitest";
import { sendEmail, type GuestEnv } from "./guests";

const send = vi.fn(async (input: unknown) => ({
  contract: "noxconnect.transactional-email-receipt" as const,
  version: 1 as const,
  requestId: String((input as { requestId: string }).requestId),
  status: "accepted" as const,
  provider: "postmark" as const,
  messageId: "message-id",
  submittedAt: null,
}));

const env: GuestEnv = {
  email: { sendEmail: send },
  PUBLIC_APP_ORIGIN: "https://app.noxhere.com",
};

afterEach(() => vi.clearAllMocks());

describe("NoxConnect-owned guest email", () => {
  it("passes a bounded template command over the private capability binding", async () => {
    await sendEmail(env, "invite:one", "guest@example.com", "You are invited", "Join <Nox>", "https://app.noxhere.com/auth/email/callback?token=one", "Project access");

    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith({
      contract: "noxconnect.transactional-email",
      version: 1,
      requestId: "invite:one",
      recipient: "guest@example.com",
      template: "platform.guest-invitation",
      model: {
        subject: "You are invited",
        heading: "Join <Nox>",
        detail: "Project access",
        actionUrl: "https://app.noxhere.com/auth/email/callback?token=one",
      },
    });
  });

  it("fails closed when NoxConnect rejects the message", async () => {
    send.mockRejectedValueOnce(new Error("Postmark unavailable"));
    await expect(sendEmail(env, "login:one", "guest@example.com", "Sign in", "Sign in", "https://app.noxhere.com", "Expires soon"))
      .rejects.toThrow("Postmark unavailable");
  });
});
