import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { FileSkeleton, ZoneCategory } from '../../../shared/types.js';

dotenv.config();

export interface LabeledModule {
  filePath: string;
  label: string;
  zone: ZoneCategory;
  summary: string;
}

const ALLOWED_ZONES: readonly ZoneCategory[] = [
  'Auth',
  'Database',
  'Payments',
  'Interface',
  'Services',
] as const;

function isValidZone(zone: unknown): zone is ZoneCategory {
  return typeof zone === 'string' && ALLOWED_ZONES.includes(zone as ZoneCategory);
}

/**
 * Strips markdown code blocks/fences (e.g. ```json ... ```) from model output.
 */
function cleanJsonOutput(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '');
    cleaned = cleaned.replace(/\n?```$/, '');
  }
  return cleaned.trim();
}

/**
 * Classifies repository files into zones using Google AI Studio / Gemma 4B.
 * Input files contain ONLY structural skeletons (paths, imports, exports, signatures—never raw bodies).
 */
export async function labelModulesWithGemma(files: FileSkeleton[]): Promise<LabeledModule[]> {
  if (!files || files.length === 0) {
    return [];
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[gemmaLabeler] Warning: GEMINI_API_KEY is not set in environment.');
  }

  const ai = new GoogleGenAI({ apiKey: apiKey || '' });

  // Priority model sequence:
  // Prefer 'gemini-3.5-flash-lite' for high availability and low latency.
  const configuredModel = process.env.GEMMA_MODEL_NAME || 'gemini-3.5-flash-lite';
  const candidateModels = Array.from(
    new Set([
      'gemini-3.5-flash-lite',
      configuredModel,
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
    ])
  );

  const systemInstruction = `You are an expert software architect AI.
Your task is to analyze the structural skeletons of source code files (file path, imports, exports, function signatures) and classify each file.
For privacy reasons, only structural skeletons are provided without any function implementation bodies.

You must classify each file strictly into ONE of the following 5 ZoneCategory values:
1. "Auth" (authentication, authorization, session management, tokens, user security)
2. "Database" (database connections, ORM models, schemas, repositories, migrations)
3. "Payments" (billing, checkout, payment processing, gateways, invoices)
4. "Interface" (UI components, layouts, pages, views, frontend state presentation, API controllers)
5. "Services" (business logic, background workers, external integrations, utility services, helpers)

For each file, produce:
- "filePath": exactly matches the input filePath
- "label": a clean, concise 1-2 word display label (e.g., "Login", "Checkout", "Order Schema", "Stripe Gateway", "Notification Service")
- "zone": strictly one of "Auth", "Database", "Payments", "Interface", "Services"
- "summary": a single-sentence clear summary describing the role and responsibility of the file.

Return strictly a valid JSON array of objects with the exact schema:
[
  {
    "filePath": string,
    "label": string,
    "zone": "Auth" | "Database" | "Payments" | "Interface" | "Services",
    "summary": string
  }
]
Do NOT include any markdown fences or conversational text. Output pure JSON only.`;

  const prompt = `${systemInstruction}\n\nFiles to classify:\n${JSON.stringify(files, null, 2)}`;

  let rawText = '';
  let successfulModel = '';

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.1,
        },
      });

      rawText = response.text || '';
      successfulModel = model;
      break;
    } catch (err: any) {
      console.warn(`[gemmaLabeler] Model '${model}' failed: ${err?.message || err}. Trying next fallback candidate...`);
    }
  }

  if (!rawText) {
    console.error('[gemmaLabeler] All model candidates failed to respond.');
    return files.map((file) => ({
      filePath: file.filePath,
      label: file.filePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Module',
      zone: 'Services' as ZoneCategory,
      summary: `Fallback classification for ${file.filePath}: All model endpoints were unavailable.`,
    }));
  }

  try {
    const cleanedText = cleanJsonOutput(rawText);

    let parsed: any[];
    try {
      parsed = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.error('[gemmaLabeler] Failed to parse model output as JSON. Raw output was:\n', rawText);
      throw new Error(`JSON parse error from model (${successfulModel}) output: ${(parseErr as Error).message}`);
    }

    if (!Array.isArray(parsed)) {
      throw new Error(`Model (${successfulModel}) output is not a JSON array.`);
    }

    // Defensive mapping and fallback to ensure contract adherence
    const labeledModules: LabeledModule[] = files.map((file) => {
      const match = parsed.find((item) => item?.filePath === file.filePath) || {};
      const zone: ZoneCategory = isValidZone(match.zone) ? match.zone : 'Services';
      const label = typeof match.label === 'string' && match.label.trim().length > 0
        ? match.label.trim()
        : file.filePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Module';
      const summary = typeof match.summary === 'string' && match.summary.trim().length > 0
        ? match.summary.trim()
        : `Service module handling ${label}.`;

      return {
        filePath: file.filePath,
        label,
        zone,
        summary,
      };
    });

    return labeledModules;
  } catch (error) {
    console.error('[gemmaLabeler] Error during module classification post-processing:', error);
    return files.map((file) => ({
      filePath: file.filePath,
      label: file.filePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Module',
      zone: 'Services' as ZoneCategory,
      summary: `Fallback classification for ${file.filePath} due to error: ${(error as Error).message}`,
    }));
  }
}
