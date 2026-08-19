import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import worker from "../worker/index.js";
import { handleProviderRequest, parseOxaxStreamPage, hxcImageDecodeECB, hxcAes128DecryptBlock, hxcAes128Expand, hxcEncrypt, hxcDecrypt } from "../providers/runtime.js";

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

test("redirects oxax manifests to the direct signed stream (no proxy)", { concurrency: false }, async (t) => {
  const originalFetch = globalThis.fetch;
  const upstreamUrl = "https://s.oxax.tv/1/index.m3u8?k=signed";
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), upstreamUrl);
    assert.equal(init.headers.referer, "http://oxax.tv/oh-ah.html");
    return new Response("should not be fetched", { status: 404 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const requestUrl = new URL("https://app.example/provider-api/adulttv");
  requestUrl.searchParams.set("action", "media");
  requestUrl.searchParams.set("type", "manifest");
  requestUrl.searchParams.set("id", "oh-ah");
  requestUrl.searchParams.set("url", upstreamUrl);
  const response = await handleProviderRequest(requestUrl);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), upstreamUrl);
  assert.equal(await response.text(), "");
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

test("hxc AES-128-ECB decrypts a zero-padded image blob (matches FIPS-197 block vector)", async () => {
  const key = Buffer.from("000102030405060708090a0b0c0d0e0f", "hex");
  const plain = Buffer.concat([Buffer.from("00112233445566778899aabbccddeeff", "hex"), Buffer.from("74657374" + "00".repeat(12), "hex")]);
  const { createCipheriv } = await import("node:crypto");
  const cipher = createCipheriv("aes-128-ecb", key, null);
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const w = hxcAes128Expand(key);
  const decrypted = Buffer.from(hxcAes128DecryptBlock(encrypted.subarray(0, 16), w));
  assert.equal(decrypted.toString("hex"), "00112233445566778899aabbccddeeff");
  const whole = await hxcImageDecodeECB(encrypted, key.toString("utf8"));
  assert.ok(whole.equals(plain));
});

test("hxc endata round-trips through the AES-256-CBC envelope", async () => {
  const payload = JSON.stringify({ page: 1, length: 2, offset: 0, typeIds: [4], orderType: 7, payType: [3, 4], tagIds: [], subTagIds: [], subTypeIds: [] });
  assert.equal(await hxcDecrypt(await hxcEncrypt(payload)), payload);
});

test("hxc list request reaches the upstream API with the signed envelope", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (input, init) => {
    captured = { url: String(input), body: JSON.parse(init.body), headers: init.headers };
    return new Response(JSON.stringify({
      code: 0,
      data: {
        count: 9984,
        list: [{
          id: 60507,
          name: "娃娃般粉嫩女神 发骚式特写自慰",
          length: 3452,
          coverImgUrl: "https://i02p.nasuiyile.com/aes/vc/cover/video/0a74f73c43704f26b9c3fea7cb2116c1.aes",
          addTime: "2025-03-14 18:50:02",
          typeName: "裸舞诱惑",
        }],
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const requestUrl = new URL("https://app.example/provider-api/hxc?pg=2&preset=17&wd=%E5%90%8D%E5%AD%97");
    const response = await handleProviderRequest(requestUrl);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.list.length, 1);
    assert.equal(body.list[0].vod_id, 60507);
    assert.equal(body.list[0].vod_name, "娃娃般粉嫩女神 发骚式特写自慰");
    assert.equal(body.list[0].vod_remarks, "57:32");
    assert.equal(body.list[0].vod_year, 2025);
    assert.match(body.list[0].vod_pic, /^\/provider-api\/hxc\?action=img&u=/);
    assert.equal(body.total, 9984);
    assert.equal(captured.headers.source, "1");
    assert.equal(captured.headers.Did, "1");
    const payload = JSON.parse(await hxcDecrypt(captured.body.endata));
    assert.equal(payload.page, 2);
    assert.equal(payload.orderType, 7);
    assert.deepEqual(payload.typeIds, [17]);
    assert.deepEqual(payload.payType, [3, 4]);
    assert.deepEqual(payload.subTypeIds, [24, 25, 26, 27, 28]);
    assert.equal(payload.videoName, "名字");
    const ents = Number(await hxcDecrypt(captured.body.ents));
    assert.ok(Math.abs(ents - (Math.floor(Date.now() / 1000) - 28800)) < 30);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sf list parses sifangtv.cc cards and category pagination", async () => {
  const originalFetch = globalThis.fetch;
  const hits = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    hits.push(url);
    return new Response(`<!doctype html><html><head><title>分类</title></head><body>
      <a href="/index.php/vod/play/id/34312/sid/1/nid/1.html"><img class="lozad" data-src="/upload/vod/20250218/ab12cd.jpg" alt="姐姐的深夜一课"><span class="hd">HD</span></a>
      <a href="/index.php/vod/play/id/34313/sid/1/nid/1.html"><img class="lozad" data-src="/upload/vod/20250218/ef34ab.jpg" alt="邻家女孩 02"></a>
      <a href="/index.php/vod/type/id/21/page/2.html">2</a><a href="/index.php/vod/type/id/21/page/3.html">3</a>
    </body></html>`, { status: 200, headers: { "content-type": "text/html" } });
  };
  try {
    const requestUrl = new URL("https://app.example/provider-api/sf?pg=2&preset=21");
    const response = await handleProviderRequest(requestUrl);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.list.length, 2);
    assert.equal(body.list[0].vod_id, "34312");
    assert.equal(body.list[0].vod_name, "姐姐的深夜一课");
    assert.equal(body.list[0].vod_remarks, "HD");
    assert.equal(body.list[0].vod_pic, "https://www.sifangtv.cc/upload/vod/20250218/ab12cd.jpg");
    assert.equal(body.list[1].vod_id, "34313");
    assert.equal(body.list[1].vod_remarks, "可播放");
    assert.equal(body.pages, 3);
    assert.ok(hits.some((url) => url.includes("/index.php/vod/type/id/21/page/2.html")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sf detail extracts the plaintext m3u8 from player_aaaa", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (input) => {
    captured = String(input);
    return new Response(`<!doctype html><html><head></head><body>
      <h1>姐姐的深夜一课</h1>
      <script>var player_aaaa={"flag":"play","encrypt":0,"url":"https:\\/\\/v2024.sysybf.com\\/20250218\\/zwDuyDnJ\\/index.m3u8","from":"sym3u8","server":"no","vod_data":{"vod_name":"姐姐的深夜一课","vod_class":"国产情色","vod_actor":"小鱼"}};</script>
      <a href="/index.php/vod/play/id/34313/sid/1/nid/1.html"><img class="lozad" data-src="/upload/vod/20250218/ef34ab.jpg" alt="邻家女孩 02"></a>
    </body></html>`, { status: 200, headers: { "content-type": "text/html" } });
  };
  try {
    const requestUrl = new URL("https://app.example/provider-api/sf?action=detail&id=34312");
    const response = await handleProviderRequest(requestUrl);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.vod_id, "34312");
    assert.equal(body.vod_name, "姐姐的深夜一课");
    assert.equal(body.vod_play_url, "https://v2024.sysybf.com/20250218/zwDuyDnJ/index.m3u8");
    assert.equal(body.streams.length, 1);
    assert.equal(body.streams[0].url, "https://v2024.sysybf.com/20250218/zwDuyDnJ/index.m3u8");
    assert.equal(body.vod_label, "国产情色");
    assert.equal(body.vod_actor, "小鱼");
    assert.equal(body.related.length, 1);
    assert.equal(body.related[0].vod_id, "34313");
    assert.ok(captured.includes("/index.php/vod/play/id/34312/sid/1/nid/1.html"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("emits the files required by Sites packaging", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url));
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
});
