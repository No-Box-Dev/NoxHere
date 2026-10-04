import assert from "node:assert/strict";
import test from "node:test";
import { normalizedSession, pollLogin, startLogin } from "../lib/auth.mjs";

function response(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

test("login uses the account-wide NoxConnect CLI identity", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return response({ device_code: "noxid_1", user_code: "ABCD", verification_uri: "https://github.com/login/device" });
  };
  await startLogin({ baseURL: "https://example.test", fetchImpl });
  assert.equal(calls[0].url, "https://example.test/api/v1/auth/native/device/start");
  assert.deepEqual(calls[0].body, { client: "noxconnect-cli" });
});

test("poll returns every organization from one login", async () => {
  const fetchImpl = async () => response({
    access_token: "nox_at_test",
    refresh_token: "nox_rt_test",
    user: { login: "jasper" },
    organizations: [{ login: "one" }, { login: "two" }],
  });
  const result = await pollLogin("noxid_1", { baseURL: "https://example.test", fetchImpl });
  assert.deepEqual(result.organizations.map((org) => org.login), ["one", "two"]);
});

test("poll keeps waiting when the API returns a 202 OAuth pending response", async () => {
  const fetchImpl = async () => response({
    error: "authorization_pending",
    error_description: "Approve the code in GitHub",
  }, 202, { "retry-after": "5" });
  await assert.rejects(
    pollLogin("noxid_1", { baseURL: "https://example.test", fetchImpl }),
    (error) => error.code === "authorization_pending" && error.retryAfter === 5,
  );
});

test("a session cannot be stored without both native credentials", () => {
  assert.throws(
    () => normalizedSession({ error: "authorization_pending" }),
    /without valid NoxConnect session credentials/,
  );
});
