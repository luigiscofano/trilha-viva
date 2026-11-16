import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import {
  importTextLink,
  resolvePublicTarget,
  parseAllowedHosts,
  isPublicIPv4,
} from "../server/link-import.mjs";
import { createStudyServer, readConfig } from "../server/study-server.mjs";
const hosts = ["example.org"];
const resolver = async () => [{ address: "93.184.216.34", family: 4 }];
const body = { url: "https://example.org/material.txt", consent: true };
function mockResponse({
  status = 200,
  type = "text/plain; charset=utf-8",
  encoding,
  body = "Material fictício.",
  length,
} = {}) {
  return (url, options, callback) => {
    assert.equal(url.hostname, "example.org");
    assert.equal(options.agent, false);
    assert.equal(options.headers.Authorization, undefined);
    options.lookup(url.hostname, {}, (_error, ip, family) => {
      assert.equal(ip, "93.184.216.34");
      assert.equal(family, 4);
    });
    options.lookup(url.hostname, { all: true }, (_error, addresses) =>
      assert.equal(addresses[0].address, "93.184.216.34"),
    );
    const req = new EventEmitter();
    req.end = () =>
      queueMicrotask(() => {
        const res = Readable.from([Buffer.from(body)]);
        res.statusCode = status;
        res.headers = {
          "content-type": type,
          "content-encoding": encoding,
          "content-length": length,
        };
        callback(res);
      });
    return req;
  };
}
const options = { allowedHosts: hosts, resolver };
test("allowlist exacta não aceita curingas, IPs ou URLs", () => {
  assert.deepEqual(parseAllowedHosts("example.org,example.org"), hosts);
  for (const value of [
    "*.example.org",
    "https://example.org",
    "127.0.0.1",
    "foo.local",
    "example.org:443",
  ])
    assert.throws(() => parseAllowedHosts(value));
});
test("bloqueia redes privadas, reservadas, IPv6 e representações ambíguas", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "192.0.0.9",
    "192.0.2.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "255.255.255.255",
    "0.0.0.0",
    "::1",
    "::ffff:93.184.216.34",
    "2130706433",
  ])
    assert.equal(isPublicIPv4(ip), false, ip);
  assert.equal(isPublicIPv4("93.184.216.34"), true);
});
test("valida URL antes de DNS e recusa todos endereços quando um deles for privado", async () => {
  for (const url of [
    "http://example.org/a",
    "https://user:pass@example.org/a",
    "https://example.org:8443/a",
    "https://example.org/a?token=x",
    "https://example.org/a#x",
    "https://sub.example.org/a",
    "https://127.1/a",
    "https://example.org.evil.com/a",
  ])
    await assert.rejects(
      resolvePublicTarget(url, hosts, () =>
        assert.fail("DNS não deve ocorrer"),
      ),
    );
  await assert.rejects(
    resolvePublicTarget(body.url, hosts, async () => [
      ...(await resolver()),
      { address: "127.0.0.1", family: 4 },
    ]),
    { code: "UNSAFE_ADDRESS" },
  );
});
test("texto UTF-8 com origem verificável, sem página inventada e IP fixado", async () => {
  const result = await importTextLink(body, {
    ...options,
    requestImpl: mockResponse(),
  });
  assert.equal(result.text, "Material fictício.");
  assert.equal(result.page, null);
  assert.equal(result.sourceUrl, body.url);
  assert.equal(result.requiresReview, true);
});
test("desabilitado e falta de consentimento nunca fazem requisição", async () => {
  await assert.rejects(importTextLink(body), { code: "LINK_IMPORT_DISABLED" });
  await assert.rejects(
    importTextLink(
      { url: body.url },
      { ...options, resolver: () => assert.fail() },
    ),
    { code: "LINK_CONSENT_REQUIRED" },
  );
});
test("não segue redirects nem processa HTML, compressão, corpos grandes ou binários", async () => {
  for (const [response, code] of [
    [{ status: 302 }, "LINK_HTTP_ERROR"],
    [{ type: "text/html" }, "LINK_UNSUPPORTED_TYPE"],
    [{ encoding: "gzip" }, "LINK_UNSUPPORTED_TYPE"],
    [{ body: "a".repeat(300001) }, "LINK_TOO_LARGE"],
    [{ length: 300001 }, "LINK_TOO_LARGE"],
    [{ body: "\x00" }, "LINK_INVALID_TEXT"],
    [{ body: Buffer.from([0xff]) }, "LINK_INVALID_TEXT"],
  ])
    await assert.rejects(
      importTextLink(body, { ...options, requestImpl: mockResponse(response) }),
      { code },
    );
});
test("timeout cobre DNS; resposta atrasada não inicia download", async () => {
  await assert.rejects(
    importTextLink(body, {
      ...options,
      timeoutMs: 5,
      resolver: () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve([{ address: "93.184.216.34", family: 4 }]),
            15,
          ),
        ),
      requestImpl: () => assert.fail("não deve conectar após timeout"),
    }),
    { code: "LINK_TIMEOUT" },
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
});
test("API import-link independente de IA exige token e origem", async () => {
  assert.throws(() => readConfig({ TRILHA_IMPORT_HOSTS: "example.org" }));
  const token = "x".repeat(40);
  let calls = 0;
  const config = readConfig({
    TRILHA_IMPORT_HOSTS: "example.org",
    TRILHA_ACCESS_TOKEN: token,
  });
  const server = createStudyServer({
    config,
    importLink: async (input, opts) => {
      calls++;
      assert.deepEqual(input, body);
      assert.deepEqual(opts.allowedHosts, hosts);
      return { text: "ok" };
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/import-link`;
  try {
    const status = await fetch(url.replace("/api/import-link", "/api/status"));
    assert.deepEqual(await status.json(), {
      configured: false,
      importLinksConfigured: true,
      provider: "unconfigured",
      requiresAuthentication: true,
    });
    assert.equal(
      (
        await fetch(url, {
          method: "POST",
          headers: {
            Origin: config.allowedOrigin,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        })
      ).status,
      401,
    );
    assert.equal(calls, 0);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Origin: config.allowedOrigin,
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).text, "ok");
    assert.equal(calls, 1);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("DNS com falha retorna erro genérico sem vazar detalhes", async () => {
  await assert.rejects(
    importTextLink(body, {
      ...options,
      resolver: () => {
        throw Error("private resolver details");
      },
    }),
    (error) =>
      error.code === "LINK_UNAVAILABLE" && !error.message.includes("private"),
  );
});
test("timeout aborta download pendente e MIME malformado não passa", async () => {
  let aborted = false;
  await assert.rejects(
    importTextLink(body, {
      ...options,
      timeoutMs: 5,
      requestImpl: (_url, opts) => {
        const req = new EventEmitter();
        req.end = () => {};
        opts.signal.addEventListener(
          "abort",
          () => {
            aborted = true;
            req.emit("error", Error("aborted"));
          },
          { once: true },
        );
        return req;
      },
    }),
    { code: "LINK_TIMEOUT" },
  );
  assert.equal(aborted, true);
  await assert.rejects(
    importTextLink(body, {
      ...options,
      requestImpl: mockResponse({ type: 'text/plain; charset="utf-8' }),
    }),
    { code: "LINK_UNSUPPORTED_TYPE" },
  );
});
