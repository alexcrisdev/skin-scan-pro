import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: ["./src/services/analysis/inference.repository.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { DermatologyInferenceClient } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

const controllerBundle = await build({
  entryPoints: ["./src/services/analysis/analysis.controller.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { AnalysisController } = await import(
  `data:text/javascript;base64,${Buffer.from(controllerBundle.outputFiles[0].text).toString("base64")}`
);

const serviceBundle = await build({
  stdin: {
    contents:
      'export { AnalysisService } from "./src/services/analysis/analysis.service.ts"; export { createAnalysisRequestSchema } from "./src/services/analysis/dtos.ts";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { AnalysisService, createAnalysisRequestSchema } = await import(
  `data:text/javascript;base64,${Buffer.from(serviceBundle.outputFiles[0].text).toString("base64")}`
);

test("personal analyses belong to the signed-in account and exclude historical patient records", async () => {
  let created = 0;
  let inferenceCalls = 0;
  let createdFor;
  const repository = {
    findClientByAuthUserId: async () => ({ id: "owner" }),
    assertClientFound: (client) => assert.ok(client),
    getAnalysisById: async () => ({
      id: "old",
      patient_id: "historical-patient",
      client_id: "owner",
    }),
    findLesionTypeByName: async () => ({ id: "lesion", name: "nv", description: "Nevus" }),
    createAnalysis: async (input) => {
      created++;
      createdFor = input;
      return {
        id: "analysis",
        client_id: input.clientId,
        patient_id: null,
        lesion_type_id: input.lesionTypeId,
        image_url: input.imageUrl,
        confidence: input.confidence,
        prediction_details: input.predictionDetails,
        ai_interpretation: input.aiInterpretation,
        analyzed_at: input.analyzedAt,
      };
    },
  };
  const inference = {
    predict: async () => {
      inferenceCalls++;
      return {
        status: "success",
        confianza_porcentajes: { nv: 80, mel: 20 },
        interpretacion_ia: "CNN",
      };
    },
  };
  const service = new AnalysisService(repository, inference);
  const request = {
    mime: "image/jpeg",
    image: "aW1hZ2U=",
    image_url: "https://example.com/image.jpg",
  };
  const result = await service.createAnalysis("user", request);
  assert.equal(createAnalysisRequestSchema.safeParse(request).success, true);
  assert.equal(
    createAnalysisRequestSchema.safeParse({
      ...request,
      patient_id: "4bdce508-5fb7-4c36-b8a6-fd42aff283a0",
    }).success,
    false,
  );
  assert.equal(result.status, "success");
  assert.equal(created, 1);
  assert.equal(createdFor.clientId, "owner");
  assert.equal(result.data.patient_id, null);
  assert.equal("patientId" in createdFor, false);
  await assert.rejects(
    () => service.getAnalysisById("old"),
    (error) => error.statusCode === 404,
  );
  assert.equal(inferenceCalls, 1);
});

test("analysis reads enforce ownership and scope history to the caller", async (t) => {
  const originalError = console.error;
  console.error = () => {};
  t.after(() => {
    console.error = originalError;
  });
  const id = "4bdce508-5fb7-4c36-b8a6-fd42aff283a0";
  const other = "2ef06e35-4ea8-4677-b805-7eb851e41a65";
  let captured;
  const service = {
    getAnalysisById: async () => ({ status: "success", data: { client_id: other } }),
    getHistory: async (query) => {
      captured = query;
      return { status: "success", data: [] };
    },
  };
  const controller = new AnalysisController(service, {});
  const unauthenticated = await controller.getById({ params: { analysisId: id } });
  assert.equal(unauthenticated.status, 401);
  controller.currentClient = async () => ({ id });
  assert.equal((await controller.getById({ params: { analysisId: id } })).status, 403);
  const request = new Request("http://localhost/api/analyses/history");
  assert.equal((await controller.getHistory({ request })).status, 200);
  assert.equal(captured.client_id, id);
  const spoofed = new Request(`http://localhost/api/analyses/history?client_id=${other}`);
  assert.equal((await controller.getHistory({ request: spoofed })).status, 403);
});
const input = { mime: "image/jpeg", image: "aW1hZ2U=", image_url: "https://example.com/image.jpg" };

test("CNN HTTP adapter validates configuration, credentials, response and failures", async (t) => {
  const originalFetch = globalThis.fetch;
  const keys = [
    "SKINSCAN_INFERENCE_URL",
    "SKINSCAN_INFERENCE_API_KEY",
    "SKINSCAN_INFERENCE_TIMEOUT_MS",
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const key of keys)
      previous[key] === undefined ? delete process.env[key] : (process.env[key] = previous[key]);
  });
  const client = new DermatologyInferenceClient();
  delete process.env.SKINSCAN_INFERENCE_URL;
  await assert.rejects(
    () => client.predict(input),
    (error) => error.statusCode === 503,
  );
  process.env.SKINSCAN_INFERENCE_URL = "https://cnn.example/predict";
  process.env.SKINSCAN_INFERENCE_API_KEY = "test-secret";
  process.env.SKINSCAN_INFERENCE_TIMEOUT_MS = "1000";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, process.env.SKINSCAN_INFERENCE_URL);
    assert.equal(options.headers.Authorization, "Bearer test-secret");
    assert.deepEqual(JSON.parse(options.body), { mime: input.mime, image: input.image });
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ status: "success", confianza_porcentajes: { nv: 80, mel: 20 } });
  };
  const result = await client.predict(input);
  assert.equal(result.status, "success");
  assert.match(result.interpretacion_ia, /CNN/);
  for (const predictions of [{ nv: 101 }, { nv: -1 }, { unknown: 99 }, {}, { nv: "90" }]) {
    globalThis.fetch = async () =>
      Response.json({ status: "success", confianza_porcentajes: predictions });
    await assert.rejects(
      () => client.predict(input),
      (error) => error.statusCode === 502,
    );
  }
  globalThis.fetch = async () => Response.json({ status: "error", message: "Imagen rechazada" });
  assert.equal((await client.predict(input)).status, "error");
  globalThis.fetch = async () => new Response("Unavailable", { status: 503 });
  await assert.rejects(
    () => client.predict(input),
    (error) => error.statusCode === 502,
  );
  globalThis.fetch = async () => {
    throw new DOMException("Timed out", "TimeoutError");
  };
  await assert.rejects(
    () => client.predict(input),
    (error) => error.statusCode === 503,
  );
  process.env.SKINSCAN_INFERENCE_TIMEOUT_MS = "-1";
  await assert.rejects(() => client.predict(input), /inválido/);
});
