import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `
      export { AnalysisController } from "./src/services/analysis/analysis.controller.ts";
      export { AnalysisService } from "./src/services/analysis/analysis.service.ts";
      export { AnalysisRepository } from "./src/services/analysis/analysis.repository.ts";
      export { AnalysisError } from "./src/services/analysis/errors.ts";
    `,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { AnalysisController, AnalysisService, AnalysisRepository, AnalysisError } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
const id = "4bdce508-5fb7-4c36-b8a6-fd42aff283a0";
const client = { id: "owner-profile", auth_user_id: "owner-auth" };
const origin = "https://test-project.supabase.co";
const image = `${origin}/storage/v1/object/sign/analysis-images/owner-auth/image.png?token=expired`;

function fixture(overrides = {}) {
  const calls = [];
  const repository = {
    getAnalysisById: async () => ({ id, client_id: client.id, patient_id: null, image_url: image }),
    removeAnalysisImage: async (path) => calls.push(["image", path]),
    deleteAnalysis: async (...args) => {
      calls.push(["row", ...args]);
      return true;
    },
    ...overrides,
  };
  const service = new AnalysisService(repository);
  const controller = new AnalysisController(service, repository);
  return { repository, service, controller, calls };
}

test("DELETE requires a session, a valid ID and ownership before any mutation", async (t) => {
  const originalError = console.error;
  console.error = () => {};
  t.after(() => {
    console.error = originalError;
  });
  const { controller, repository, calls } = fixture();
  const context = { params: { analysisId: id } };
  assert.equal((await controller.delete(context)).status, 401);
  controller.currentClient = async () => client;
  assert.equal((await controller.delete({ params: { analysisId: "invalid" } })).status, 400);
  repository.getAnalysisById = async () => ({ client_id: "someone-else", patient_id: null });
  assert.equal((await controller.delete(context)).status, 403);
  repository.getAnalysisById = async () => ({ client_id: client.id, patient_id: "historical" });
  assert.equal((await controller.delete(context)).status, 404);
  repository.getAnalysisById = async () => null;
  assert.equal((await controller.delete(context)).status, 404);
  assert.deepEqual(calls, []);
});

test("owner DELETE removes the private image before the scoped database row", async (t) => {
  const previous = process.env.SUPABASE_URL;
  process.env.SUPABASE_URL = origin;
  t.after(() => {
    previous === undefined
      ? delete process.env.SUPABASE_URL
      : (process.env.SUPABASE_URL = previous);
  });
  const { controller, calls } = fixture();
  controller.currentClient = async () => client;
  const response = await controller.delete({ params: { analysisId: id } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "success" });
  assert.deepEqual(calls, [
    ["image", "owner-auth/image.png"],
    ["row", id, client.id],
  ]);
});

test("deleting an owned record never removes foreign or malformed storage paths", async (t) => {
  const previous = process.env.SUPABASE_URL;
  process.env.SUPABASE_URL = origin;
  t.after(() => {
    previous === undefined
      ? delete process.env.SUPABASE_URL
      : (process.env.SUPABASE_URL = previous);
  });
  for (const image_url of [
    image.replace("owner-auth", "other-auth"),
    image.replace(origin, "https://other-project.supabase.co"),
    image.replace("owner-auth/image", "owner-auth%2fother/image"),
    image.replace("image.png", "%5cimage.png"),
    image.replace("image.png", "%00image.png"),
    image.replace("image.png", "%zz"),
    "not-a-url",
    null,
  ]) {
    const { service, calls } = fixture({
      getAnalysisById: async () => ({ client_id: client.id, patient_id: null, image_url }),
    });
    await service.deleteAnalysis(id, client);
    assert.deepEqual(calls, [["row", id, client.id]]);
  }
});

test("cleanup failures retain the row and database failures never report success", async (t) => {
  const previous = process.env.SUPABASE_URL;
  process.env.SUPABASE_URL = origin;
  t.after(() => {
    previous === undefined
      ? delete process.env.SUPABASE_URL
      : (process.env.SUPABASE_URL = previous);
  });
  const { service, calls } = fixture({
    removeAnalysisImage: async () => {
      throw new AnalysisError("Storage unavailable", 503);
    },
  });
  await assert.rejects(
    () => service.deleteAnalysis(id, client),
    (error) => error.statusCode === 503,
  );
  assert.deepEqual(calls, []);
  const absent = fixture({ deleteAnalysis: async () => false });
  await assert.rejects(
    () => absent.service.deleteAnalysis(id, client),
    (error) => error.statusCode === 404,
  );
  const failed = fixture({
    deleteAnalysis: async () => {
      throw new AnalysisError("Database unavailable");
    },
  });
  await assert.rejects(
    () => failed.service.deleteAnalysis(id, client),
    (error) => error.statusCode === 500,
  );
});

test("repository DELETE filters the ID, owner and personal records and detects no-op/errors", async () => {
  const calls = [];
  let result = { data: { id }, error: null };
  const query = {
    delete() {
      calls.push(["delete"]);
      return this;
    },
    eq(...args) {
      calls.push(["eq", ...args]);
      return this;
    },
    is(...args) {
      calls.push(["is", ...args]);
      return this;
    },
    select(...args) {
      calls.push(["select", ...args]);
      return this;
    },
    async maybeSingle() {
      return result;
    },
  };
  const repository = new AnalysisRepository({
    from(table) {
      assert.equal(table, "analyses");
      return query;
    },
  });
  assert.equal(await repository.deleteAnalysis(id, client.id), true);
  assert.deepEqual(calls, [
    ["delete"],
    ["eq", "id", id],
    ["eq", "client_id", client.id],
    ["is", "patient_id", null],
    ["select", "id"],
  ]);
  result = { data: null, error: null };
  assert.equal(await repository.deleteAnalysis(id, client.id), false);
  result = { data: null, error: { message: "private database detail" } };
  await assert.rejects(
    () => repository.deleteAnalysis(id, client.id),
    (error) => error.statusCode === 500 && !error.message.includes("private database detail"),
  );
});
