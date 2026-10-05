import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { createHmac } from "node:crypto";
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

const localAssertionSecret = process.env.NOXHERE_INTERNAL_SECRET ?? "noxhere-local-development-only-secret";

/**
 * The identity the dev server claims when it signs proxied API requests.
 *
 * Defaults reproduce a No-Box-Dev admin, which is what local work normally
 * wants. Override the environment variables to reproduce another org or a
 * non-admin, e.g. `NOX_DEV_ORG_ID=1 NOX_DEV_ORG_LOGIN=n1healthcare
 * NOX_DEV_IS_ADMIN=false npm run dev`. Both the `/api/auth/profile` stub and
 * the signed assertion read from here so they can never disagree.
 */
function devIdentity() {
  return {
    userLogin: process.env.NOX_DEV_USER_LOGIN ?? "JasperNoBoxDev",
    userEmail: process.env.NOX_DEV_USER_EMAIL ?? "jasper@noboxdev.com",
    userId: Number(process.env.NOX_DEV_USER_ID ?? 196446605),
    orgId: Number(process.env.NOX_DEV_ORG_ID ?? 2),
    orgLogin: process.env.NOX_DEV_ORG_LOGIN ?? "No-Box-Dev",
    isAdmin: (process.env.NOX_DEV_IS_ADMIN ?? "true") !== "false",
  };
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function localAuthProfile() {
  return {
    name: "noxhere-local-auth-profile",
    configureServer(server: { middlewares: { use(path: string, handler: (_request: unknown, response: { statusCode: number; setHeader(name: string, value: string): void; end(body: string): void }) => void): void } }) {
      const identity = devIdentity();
      // Only worth announcing when it has been overridden; the default is assumed.
      if (Object.keys(process.env).some((name) => name.startsWith("NOX_DEV_"))) {
        console.info(`[noxhere] dev identity: ${identity.userLogin} in ${identity.orgLogin} (org ${identity.orgId}), admin=${identity.isAdmin}`);
      }
      server.middlewares.use("/api/auth/profile", (_request, response) => {
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json");
        response.setHeader("Cache-Control", "no-store");
        response.end(JSON.stringify({
          user: { login: identity.userLogin, email: identity.userEmail },
          orgs: [{ login: identity.orgLogin, role: identity.isAdmin ? "admin" : "member" }],
        }));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localAuthProfile(), {
    name: "noxhere-openapi-contract",
    closeBundle() {
      copyFileSync(resolve("public/openapi.json"), resolve("dist/openapi.json"));
    },
  }],
  server: {
    port: 4180,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.NOX_API_ORIGIN ?? "http://127.0.0.1:8788",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", (proxyRequest, request) => {
            const identity = devIdentity();
            const now = Math.floor(Date.now() / 1000);
            const projectHeader = request.headers["x-project-id"];
            const projectId = Array.isArray(projectHeader) ? projectHeader[0] : projectHeader ?? null;
            const assertion = {
              version: 1,
              issuer: "noxhere",
              audience: "noxconnect",
              issuedAt: now,
              expiresAt: now + 30,
              method: request.method?.toUpperCase() ?? "GET",
              path: request.url ?? "/",
              auth: {
                credentialType: "session",
                credentialId: "local-noxhere-session",
                principalId: "local-user",
                userLogin: identity.userLogin,
                userId: identity.userId,
                orgId: identity.orgId,
                orgLogin: identity.orgLogin,
                isAdmin: identity.isAdmin,
                projectId,
                scopes: [],
                connectionId: null,
                accessLevel: "member",
              },
            };
            const payload = base64Url(JSON.stringify(assertion));
            const signature = createHmac("sha256", localAssertionSecret).update(payload).digest("base64url");
            proxyRequest.setHeader("X-NoxHere-Internal-Assertion", payload);
            proxyRequest.setHeader("X-NoxHere-Internal-Signature", signature);
          });
        },
      },
    },
  },
  preview: { port: 4180, strictPort: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
