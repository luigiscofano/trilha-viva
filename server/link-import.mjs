import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class LinkImportError extends Error {
  constructor(status, code, message) {
    super(message);
    Object.assign(this, { status, code });
  }
}
const fail = (code, message, status = 400) =>
  new LinkImportError(status, code, message);

/** Lista exata configurada pelo operador, nunca recebida do navegador. Sem curingas. */
export function parseAllowedHosts(value = "") {
  if (!value.trim()) return [];
  return [
    ...new Set(
      value.split(",").map((part) => {
        const host = part.trim().toLowerCase();
        if (
          !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
            host,
          ) ||
          host.endsWith(".localhost") ||
          host.endsWith(".local")
        )
          throw new Error(
            "TRILHA_IMPORT_HOSTS exige nomes públicos exatos, sem esquema, porta ou curingas.",
          );
        return host;
      }),
    ),
  ];
}

/** Escopo conservador IPv4. IPv6 é recusado, inclusive endereços IPv4 mapeados. */
export function isPublicIPv4(address) {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

export async function resolvePublicTarget(
  input,
  allowedHosts,
  resolver = lookup,
) {
  if (typeof input !== "string" || input.length > 2048)
    throw fail("INVALID_LINK", "Link inválido.");
  let url;
  try {
    url = new URL(input);
  } catch {
    throw fail("INVALID_LINK", "Link inválido.");
  }
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    !allowedHosts.includes(url.hostname)
  )
    throw fail(
      "LINK_NOT_ALLOWED",
      "Use HTTPS em um domínio autorizado, sem credenciais, parâmetros ou fragmentos.",
    );
  const addresses = await resolver(url.hostname, { all: true, verbatim: true });
  if (
    !addresses.length ||
    addresses.some((item) => item.family !== 4 || !isPublicIPv4(item.address))
  )
    throw fail("UNSAFE_ADDRESS", "Destino de rede não autorizado.");
  return { url, address: addresses[0].address };
}

/** Não usa fetch: fixa o IP já verificado, preservando hostname/SNI e validação TLS. */
function downloadText({ url, address }, signal, requestImpl) {
  return new Promise((resolve, reject) => {
    const request = requestImpl(
      url,
      {
        method: "GET",
        agent: false,
        signal,
        lookup: (_host, options, callback) =>
          options.all
            ? callback(null, [{ address, family: 4 }])
            : callback(null, address, 4),
        headers: {
          Accept: "text/plain",
          "Accept-Encoding": "identity",
          "User-Agent": "TrilhaViva-AuthorizedTextImport/1.0",
        },
      },
      (response) => {
        const refuse = (error) => {
          response.destroy();
          reject(error);
        };
        if (response.statusCode !== 200)
          return refuse(
            fail(
              "LINK_HTTP_ERROR",
              "A fonte não respondeu com texto público disponível. Redirecionamentos não são seguidos.",
              502,
            ),
          );
        if (
          !/^text\/plain(?:\s*;\s*charset\s*=\s*"?utf-8"?)?\s*$/i.test(
            response.headers["content-type"] || "",
          ) ||
          (response.headers["content-encoding"] &&
            response.headers["content-encoding"] !== "identity")
        )
          return refuse(
            fail(
              "LINK_UNSUPPORTED_TYPE",
              "Somente text/plain UTF-8 sem compressão é aceito.",
              415,
            ),
          );
        const maximum = 300_000;
        if (Number(response.headers["content-length"]) > maximum)
          return refuse(fail("LINK_TOO_LARGE", "Fonte excede 300 KB.", 413));
        const parts = [];
        let size = 0;
        response.on("data", (part) => {
          size += part.length;
          if (size > maximum)
            return refuse(fail("LINK_TOO_LARGE", "Fonte excede 300 KB.", 413));
          parts.push(Buffer.from(part));
        });
        response.on("error", reject);
        response.on("end", () => {
          try {
            const text = new TextDecoder("utf-8", { fatal: true })
              .decode(Buffer.concat(parts))
              .trim();
            if (!text || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))
              throw Error("not text");
            resolve({
              schemaVersion: 1,
              sourceUrl: url.href,
              text,
              page: null,
              requiresReview: true,
            });
          } catch {
            reject(
              fail(
                "LINK_INVALID_TEXT",
                "Fonte vazia ou codificação não suportada.",
                422,
              ),
            );
          }
        });
      },
    );
    request.on("error", reject);
    request.end();
  });
}

export async function importTextLink(
  input,
  {
    allowedHosts = [],
    timeoutMs = 10000,
    resolver = lookup,
    requestImpl = https.request,
  } = {},
) {
  if (!allowedHosts.length)
    throw fail(
      "LINK_IMPORT_DISABLED",
      "Importação por link não configurada.",
      503,
    );
  if (input?.consent !== true)
    throw fail(
      "LINK_CONSENT_REQUIRED",
      "Confirme o direito de acessar o material e o envio da URL ao servidor.",
    );
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(fail("LINK_TIMEOUT", "A fonte demorou demais.", 504));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      timeout,
      (async () => {
        const target = await resolvePublicTarget(
          input.url,
          allowedHosts,
          resolver,
        );
        if (controller.signal.aborted)
          throw fail("LINK_TIMEOUT", "A fonte demorou demais.", 504);
        return downloadText(target, controller.signal, requestImpl);
      })(),
    ]);
  } catch (error) {
    if (controller.signal.aborted)
      throw fail("LINK_TIMEOUT", "A fonte demorou demais.", 504);
    if (error instanceof LinkImportError) throw error;
    throw fail(
      "LINK_UNAVAILABLE",
      "Não foi possível obter a fonte com segurança.",
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}
