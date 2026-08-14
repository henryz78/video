import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { onRequest } from "../functions/provider-api/[[path]].js";

test("routes only provider API requests through Pages Functions", async () => {
  const routes = JSON.parse(await readFile(new URL("../public/_routes.json", import.meta.url), "utf8"));
  assert.deepEqual(routes, {
    version: 1,
    include: ["/provider-api/*"],
    exclude: [],
  });
});

test("Cloudflare Pages adapter delegates GET provider requests", async () => {
  const response = await onRequest({
    request: new Request("https://example.pages.dev/provider-api/not-a-provider"),
  });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: "unknown provider" });
});

test("Cloudflare Pages adapter rejects write methods", async () => {
  const response = await onRequest({
    request: new Request("https://example.pages.dev/provider-api/gdlsp", { method: "POST" }),
  });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "GET");
  assert.deepEqual(await response.json(), { message: "method not allowed" });
});

test("Cloudflare build contains the function invocation routes", async () => {
  const routes = JSON.parse(await readFile(new URL("../dist/client/_routes.json", import.meta.url), "utf8"));
  assert.deepEqual(routes.include, ["/provider-api/*"]);
});
