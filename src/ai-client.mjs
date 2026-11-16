import { createStudyRequest, validateStudyResponse } from "./ai-contract.mjs";

export async function readIntegrationStatus(fetcher = fetch) {
  try {
    const response = await fetcher("./api/status", {
      credentials: "omit",
      cache: "no-store",
    });
    if (!response.ok) return { configured: false, provider: "unconfigured" };
    const data = await response.json();
    return {
      configured: data.configured === true,
      provider: ["n8n", "openai"].includes(data.provider)
        ? data.provider
        : "unconfigured",
    };
  } catch {
    return { configured: false, provider: "unconfigured" };
  }
}

export async function requestSuggestions(
  material,
  materials,
  token,
  fetcher = fetch,
) {
  if (!token.trim())
    throw new Error(
      "Informe o token de acesso desta sessão em Dados e integrações.",
    );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetcher("./api/study", {
      method: "POST",
      credentials: "omit",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(createStudyRequest(material)),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data?.error?.message || "O serviço de IA não conseguiu responder.",
      );
    return validateStudyResponse(data, materials, material.id);
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error("A geração demorou demais. Tente novamente mais tarde.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
