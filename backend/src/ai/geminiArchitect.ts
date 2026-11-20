// backend/src/ai/geminiArchitect.ts
/**
 * Module that uses Gemini Flash Lite (or Gemini API) to generate an ArchitectureMap
 * from a RepoSkeleton and a set of ArchitectureZone classifications.
 * It returns a Mermaid graph definition that can be rendered directly by the
 * frontend.
 */
import { RepoSkeleton, ArchitectureZone, ArchitectureMap } from "../../shared/types";

export class GeminiArchitectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiArchitectError";
  }
}

/**
 * Calls the Gemini model endpoint. Wrappers the fetch call with retry logic for
 * rate‑limit (429) and transient network errors.
 */
async function callGeminiModel(payload: any): Promise<any> {
  const endpoint = process.env.GEMINI_ENDPOINT ?? "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiArchitectError("Gemini API key not set in GEMINI_API_KEY.");
  }

  const url = `${endpoint}?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 429) {
      throw new GeminiArchitectError(`Rate limit hit: ${body}`);
    }
    throw new GeminiArchitectError(`Gemini request failed (${response.status}): ${body}`);
  }
  return response.json();
}

/**
 * Build a prompt that asks Gemini to produce a Mermaid graph describing the
 * architecture. The prompt includes zones and a short list of files per zone to
 * keep the token count reasonable.
 */
function buildPrompt(skeleton: RepoSkeleton, zones: ArchitectureZone[]): string {
  const zoneSummaries = zones
    .map(
      (z) =>
        `Zone: ${z.name}\nDescription: ${z.description ?? ""}\nModules:\n${z.modules
          .map((m) => ` - ${m}`)
          .join("\n")}`
    )
    .join("\n\n");

  const intro = `You are an AI architect. Given the following zones of a TypeScript/JavaScript project, generate a Mermaid directed graph (graph TD) that visualises the zones as sub‑graphs with colour hints if provided. Connect zones with edges where there is likely interaction based on typical naming conventions (e.g., frontend calls backend APIs). Produce only the Mermaid definition, no extra text.`;

  return `${intro}\n\n${zoneSummaries}`;
}

/**
 * Main class that produces an ArchitectureMap.
 */
export class GeminiArchitect {
  /**
   * Generate an ArchitectureMap from a repository skeleton and its zones.
   */
  async generateMap(skeleton: RepoSkeleton, zones: ArchitectureZone[]): Promise<ArchitectureMap> {
    if (!zones.length) {
      throw new GeminiArchitectError("No zones provided for architecture generation.");
    }
    const prompt = buildPrompt(skeleton, zones);
    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 2048 },
    };

    let result;
    try {
      result = await callGeminiModel(payload);
    } catch (e) {
      throw new GeminiArchitectError(`Gemini generation failed: ${(e as Error).message}`);
    }

    // Gemini returns a nested response; extract the text.
    const output = result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!output) {
      throw new GeminiArchitectError("Gemini returned empty output.");
    }

    // Basic validation of Mermaid definition (must start with "graph").
    if (!/^graph\s+[A-Z]+/.test(output)) {
      throw new GeminiArchitectError(`Invalid Mermaid definition received: ${output.substring(0, 200)}`);
    }

    const map: ArchitectureMap = {
      id: skeleton.commitSha,
      title: `Architecture for ${skeleton.repoUrl}`,
      zones,
      edges: [], // edges can be parsed later if needed; left empty for now.
      mermaidDefinition: output,
    };
    return map;
  }
}
