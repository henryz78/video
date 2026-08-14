import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import worker from "../worker/index.js";
import { handleProviderRequest, parseOxaxStreamPage } from "../providers/runtime.js";

test("reconstructs the signed oxax stream from its public Playerjs page", () => {
  const html = `<script>
    var kodk="1/index.m3u8?k=1786548345p181i022i12i43S";var kos="3b63af3";
    var player = new Playerjs("#FeyJpZCI6InBsX29rIiwiZmlsZSI6Imh0dHBzOi8vcy5veGF4LnR2L3t2MX03MTcze3YyfTA1NWViZjgxM2M3MzQ4ZjE5YTI2OCBvciBodHRwczovL3FNTU2RzNEUQ==IucG9rYXoubWUve3YxfTcxNzN7djJ9MDU1ZWJmODEzYzczNDhmMTlhMjY4IFNTU2RzNEUTE=n0=");
  </script>`;
  assert.equal(
    parseOxaxStreamPage(html),
    "https://s.oxax.tv/1/index.m3u8?k=1786548345p181i022i12i43S71733b63af3055ebf813c7348f19a268",
  );
});

test("handles an oxax marker injected inside the primary stream template", () => {
  const html = `<script>
    var kodk="45/index.m3u8?k=1786549063p181i022i12i43S";var kos="3b6cdd";
    var player = new Playerjs("#FeyJpZCI6InBsX29rIiwiZmlsZSI6Imh0dHBzOi8vcy5veGF4LnR2L3t2MX1hN2YFNTU2RzM=wNTkxe3YyfTc4OGYwNzczYzFhZjJiNjI5N2Igb3IgaHR0cHM6Ly9yFNTU2RzNEUTFWLnBva2F6Lm1lL3t2MX1hN2YwNTkxe3YyfTc4OGYwNzczYzFhZjJiNjI5N2IifQ==");
  </script>`;
  assert.equal(
    parseOxaxStreamPage(html),
    "https://s.oxax.tv/45/index.m3u8?k=1786549063p181i022i12i43Sa7f05913b6cdd788f0773c1af2b6297b",
  );
});

test("removes multiple oxax marker chunks without truncating the player JSON", () => {
  const html = `<script>
    var kodk="55/index.m3u8?k=1786640202p912i56i43i381S";var kos="d8cd68048b";
    var player = new Playerjs("#FeyJpZCI6InBsXFNTU2RzNEUTE=29rIiwiZmlsZSI6Imh0FNTU2RzNEUTFWdHBzOi8vcy5veGF4LnR2L3t2MX05ZjIwe3YyfWMxNzI2ZGI0NGUzZWZkZjJlZmMzYyBvciBodHRwczovL3IucG9rYXoubWUve3YxfTlmMjB7djJ9YzE3MjZkYjQ0ZTNlZmRmMmVmYzNjIn0=");
  </script>`;
  assert.equal(
    parseOxaxStreamPage(html),
    "https://s.oxax.tv/55/index.m3u8?k=1786640202p912i56i43i381S9f20d8cd68048bc1726db44e3efdf2efc3c",
  );
});

test("rewrites oxax manifests through the allowlisted same-origin proxy", { concurrency: false }, async (t) => {
  const originalFetch = globalThis.fetch;
  const upstreamUrl = "https://s.oxax.tv/live/channel/index.m3u8?k=signed";
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), upstreamUrl);
    assert.equal(init.headers.referer, "http://oxax.tv/oh-ah.html");
    return new Response([
      "#EXTM3U",
      '#EXT-X-KEY:METHOD=AES-128,URI="keys/key.bin"',
      "variants/low.m3u8",
      "segments/0001.ts?token=abc",
      "",
    ].join("\n"), {
      headers: { "content-type": "application/vnd.apple.mpegurl" },
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const requestUrl = new URL("https://app.example/provider-api/adulttv");
  requestUrl.searchParams.set("action", "media");
  requestUrl.searchParams.set("type", "manifest");
  requestUrl.searchParams.set("id", "oh-ah");
  requestUrl.searchParams.set("url", upstreamUrl);
  const response = await handleProviderRequest(requestUrl);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/vnd.apple.mpegurl; charset=utf-8");

  const manifest = await response.text();
  const keyProxy = new URL(manifest.match(/URI="([^"]+)"/)?.[1]);
  const mediaLines = manifest.split("\n").filter((line) => line && !line.startsWith("#")).map((line) => new URL(line));
  const [variantProxy, segmentProxy] = mediaLines;
  for (const proxy of [keyProxy, variantProxy, segmentProxy]) {
    assert.equal(proxy.origin, "https://app.example");
    assert.equal(proxy.pathname, "/provider-api/adulttv");
    assert.equal(proxy.searchParams.get("action"), "media");
    assert.equal(proxy.searchParams.get("id"), "oh-ah");
  }
  assert.equal(keyProxy.searchParams.get("type"), "segment");
  assert.equal(keyProxy.searchParams.get("url"), "https://s.oxax.tv/live/channel/keys/key.bin");
  assert.equal(variantProxy.searchParams.get("type"), "manifest");
  assert.equal(variantProxy.searchParams.get("url"), "https://s.oxax.tv/live/channel/variants/low.m3u8");
  assert.equal(segmentProxy.searchParams.get("type"), "segment");
  assert.equal(segmentProxy.searchParams.get("url"), "https://s.oxax.tv/live/channel/segments/0001.ts?token=abc");
});

test("rejects non-oxax media proxy targets", async () => {
  const requestUrl = new URL("https://app.example/provider-api/adulttv");
  requestUrl.searchParams.set("action", "media");
  requestUrl.searchParams.set("type", "segment");
  requestUrl.searchParams.set("id", "oh-ah");
  requestUrl.searchParams.set("url", "https://example.com/not-allowed.ts");
  const response = await handleProviderRequest(requestUrl);
  assert.equal(response.status, 400);
  assert.match(await response.text(), /invalid media source/);
});

test("serves existing static assets without a fallback", async () => {
  const calls = [];
  const response = await worker.fetch(new Request("https://example.test/assets/app.js"), {
    ASSETS: {
      fetch: async (request) => {
        calls.push(new URL(request.url).pathname);
        return new Response("asset", { status: 200 });
      },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/assets/app.js"]);
});

test("falls back to index.html for an unknown app route", async () => {
  const calls = [];
  const response = await worker.fetch(
    new Request("https://example.test/flow/step-two?source=share", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          const url = new URL(request.url);
          calls.push(url.pathname + url.search);
          return new Response(url.pathname === "/index.html" ? "app" : "missing", {
            status: url.pathname === "/index.html" ? 200 : 404,
          });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/flow/step-two?source=share", "/index.html"]);
});

test("does not turn missing API or write requests into the app shell", async () => {
  for (const request of [
    new Request("https://example.test/api/missing", { headers: { accept: "application/json" } }),
    new Request("https://example.test/flow", { method: "POST", headers: { accept: "text/html" } }),
  ]) {
    let calls = 0;
    const response = await worker.fetch(request, {
      ASSETS: {
        fetch: async () => {
          calls += 1;
          return new Response("missing", { status: 404 });
        },
      },
    });

    assert.equal(response.status, 404);
    assert.equal(calls, 1);
  }
});

test("emits the files required by Sites packaging", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url));
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
});
