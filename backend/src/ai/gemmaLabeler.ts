// backend/src/ai/gemmaLabeler.ts
/**
 * Module that uses the Gemma 4B model to classify repository modules into zones.
 * It receives a RepoSkeleton (lightweight representation of the repo) and
 * returns an array of ArchitectureZone objects.
 */
import { RepoSkeleton, ArchitectureZone } from "../../shared/types";

/**
 * Custom error thrown when the labeling service fails.
 */
export class GemmaLabelingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GemmaLabelingError";
  }
}

/**
 * Helper to chunk a large repository skeleton into manageable payloads for the
 * model. Gemma 4B has token limits, so we split the files into groups.
 */
function chunkFiles(files: RepoSkeleton["files"], maxChunkSize: number = 2000) {
  const chunks: RepoSkeleton["files"][] = [];
  let current: typeof files = [];
  let currentSize = 0;

  for (const file of files) {
    const estimatedSize = file.path.length + file.strippedContent.length;
    if (currentSize + estimatedSize > maxChunkSize && current.length) {
      chunks.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(file);
    currentSize += estimatedSize;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/**
 * Calls the Gemma model endpoint. This is a thin wrapper around the fetch API
 * that adds standard headers and retries on transient errors (e.g., rate limits
 * or network hiccups).
 */
async function callGemmaModel(payload: any): Promise<any> {
  const endpoint = process.env.GEMMA_ENDPOINT ?? "https://api.gemma.dev/v1/predict";
  const token = process.env.GEMMA_API_KEY;
  if (!token) {
    throw new GemmaLabelingError("Gemma API key not configured in GEMMA_API_KEY environment variable.");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    // Detect GitHub‑style rate‑limit response (429) or generic 5xx.
    if (response.status === 429) {
      throw new GemmaLabelingError(`Rate limit exceeded: ${body}`);
    }
    throw new GemmaLabelingError(`Gemma request failed (${response.status}): ${body}`);
  }
  return response.json();
}

/**
 * Main class exported from this module.
 */
export class GemmaLabeler {
  /**
   * Classify modules into zones.
   * @param repo Skeleton of the repository.
   * @returns Array of ArchitectureZone objects.
   * @throws GemmaLabelingError on any failure.
   */
  async labelModules(repo: RepoSkeleton): Promise<ArchitectureZone[]> {
    if (!repo.files?.length) {
      throw new GemmaLabelingError("RepoSkeleton contains no files to label.");
    }

    const chunks = chunkFiles(repo.files);
    const zones: ArchitectureZone[] = [];

    for (const chunk of chunks) {
      const prompt = this.buildPrompt(chunk);
      const payload = { prompt, max_output_tokens: 1024 };
      let result;
      try {
        result = await callGemmaModel(payload);
      } catch (e) {
        // Propagate labeling errors with context about which chunk failed.
        throw new GemmaLabelingError(`Failed labeling chunk: ${(e as Error).message}`);
      }

      // Expect the model to return a JSON list of zones.
      try {
        const parsed = JSON.parse(result.output_text ?? "[]");
        if (Array.isArray(parsed)) {
          zones.push(...parsed);
        }
      } catch (parseErr) {
        // If parsing fails, continue with next chunk but surface a warning.
        console.warn("GemmaLabeler: Unable to parse model output", parseErr);
      }
    }

    // Deduplicate zones by name.
    const unique: Record<string, ArchitectureZone> = {};
    for (const z of zones) {
      if (!unique[z.name]) {
        unique[z.name] = { ...z, modules: [...z.modules] };
      } else {
        // Merge module lists.
        const existing = unique[z.name];
        existing.modules = Array.from(new Set([...existing.modules, ...z.modules]));
        if (z.description) existing.description ??= z.description;
        if (z.colour) existing.colour ??= z.colour;
      }
    }
    return Object.values(unique);
  }

  /**
   * Build a prompt for the Gemma model from a chunk of files.
   */
  private buildPrompt(files: RepoSkeleton["files"]): string {
    const fileSummaries = files
      .map((f) => `Path: ${f.path}\nContent:\n${f.strippedContent.slice(0, 500)}\n---`)
      .join("\n");
    return `You are an AI that groups source files of a TypeScript/JavaScript project into logical zones (e.g., "frontend", "backend", "utils").
Identify the zone name, a short description, and list the file paths belonging to each zone.
Return the result as a JSON array of objects with fields: name, description, modules, colour (optional).

Repository files (truncated to first 500 characters each):\n${fileSummaries}`;
  }
}
