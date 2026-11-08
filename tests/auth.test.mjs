import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

const storage = new Map();
globalThis.localStorage = { setItem: (key, value) => storage.set(key, value) };

const bundle = await build({
  stdin: {
    contents: `export { loginUser, LoginError } from "./src/services/auth/login.ts";
      export { registerUser } from "./src/services/auth/register.ts";`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  plugins: [
    {
      name: "mock-auth-transport",
      setup(build) {
        build.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({
          path: "supabase",
          namespace: "auth-test",
        }));
        build.onLoad({ filter: /.*/, namespace: "auth-test" }, () => ({
          contents:
            "export function getSupabaseClient() { return globalThis.__skinscanTestClient; }",
        }));
      },
    },
  ],
});
const { loginUser, LoginError, registerUser } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

test("login distinguishes unavailable accounts, bad credentials, rate limits and unavailable Auth", async () => {
  for (const [code, status, expected] of [
    ["email_not_confirmed", 400, /cuenta aún no está habilitada/],
    ["invalid_credentials", 400, /correo o la contraseña/],
    ["over_request_rate_limit", 429, /límite/],
    ["unexpected_failure", 503, /no está disponible/],
  ]) {
    globalThis.__skinscanTestClient = {
      auth: {
        signInWithPassword: async () => ({
          data: {},
          error: { code, status, message: "Internal provider detail" },
        }),
      },
    };
    await assert.rejects(
      loginUser({ email: "person@example.com", password: "test password", rememberSession: true }),
      (error) => {
        assert.ok(error instanceof LoginError);
        assert.equal(error.code, code);
        assert.match(error.message, expected);
        assert.ok(!error.message.includes("Internal provider detail"));
        return true;
      },
    );
  }
});

test("successful login keeps the selected persistence and trims only the email", async () => {
  const user = { id: "test-user" };
  let received;
  globalThis.__skinscanTestClient = {
    auth: {
      signInWithPassword: async (values) => {
        received = values;
        return { data: { user }, error: null };
      },
    },
  };
  assert.equal(
    await loginUser({
      email: " person@example.com ",
      password: " password with spaces ",
      rememberSession: false,
    }),
    user,
  );
  assert.deepEqual(received, { email: "person@example.com", password: " password with spaces " });
  assert.equal(storage.get("skinscan-remember"), "false");
});

test("registration preserves the immediate session and profile metadata", async () => {
  const registered = { user: { id: "new-user" }, session: { access_token: "test-session" } };
  let received;
  globalThis.__skinscanTestClient = {
    auth: {
      signUp: async (values) => {
        received = values;
        return { data: registered, error: null };
      },
    },
  };
  assert.equal(
    await registerUser({
      email: "person@example.com",
      password: "test password",
      name: "Test person",
    }),
    registered,
  );
  assert.equal(received.options.data.name, "Test person");
  assert.equal(registered.session.access_token, "test-session");
});
