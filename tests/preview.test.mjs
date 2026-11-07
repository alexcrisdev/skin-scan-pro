import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: ["./src/lib/auth.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  define: {
    "import.meta.env.VITE_SUPABASE_URL": '""',
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": '""',
  },
});
const auth = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

test("preview resolves a guest session without Supabase configuration", async () => {
  let synchronous = true;
  let unsubscribe;
  const guest = await new Promise((resolve) => {
    unsubscribe = auth.onAuthStateChanged(auth.getAppAuth(), (user) => {
      assert.equal(synchronous, false);
      resolve(user);
    });
    synchronous = false;
  });
  assert.equal(guest, null);
  assert.equal(auth.getAppAuth().currentUser, null);
  unsubscribe();
  await assert.rejects(() => auth.getIdToken());
});

test("leaving the preview cancels a pending session callback", async () => {
  let called = false;
  const unsubscribe = auth.onAuthStateChanged(auth.getAppAuth(), () => {
    called = true;
  });
  unsubscribe();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(called, false);
});
