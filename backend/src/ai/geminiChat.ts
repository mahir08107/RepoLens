import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { ArchitectureMap, ChatRequest, ChatResponse, MapNode } from '../../../shared/types.js';

dotenv.config();

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

function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms)),
  ]);
}

export function isGreeting(q: string): boolean {
  const normalized = q.trim().toLowerCase().replace(/[!?.,]+$/, "");
  const greetings = new Set([
    "hi",
    "hello",
    "hey",
    "hola",
    "yo",
    "sup",
    "greetings",
    "good morning",
    "good afternoon",
    "good evening",
    "howdy",
    "hi there",
    "hello there",
    "hey there",
    "who are you",
    "what are you",
    "what can you do",
    "help",
  ]);
  return greetings.has(normalized);
}

interface RawChatResponse {
  answer?: string;
  highlightedNodeIds?: string[];
}

/**
 * Candidate models in order of priority:
 * 1. GEMINI_FLASH_MODEL or GEMMA_MODEL env override if provided
 * 2. gemini-2.5-flash (higher free-tier RPM & separate quota pool from flash-lite)
 * 3. gemma-4-26b-a4b-it (Gemma 4B / MoE open weights on AI Studio)
 * 4. gemini-2.5-pro
 * 5. gemini-2.5-flash-lite
 */
function getCandidateModels(): string[] {
  const configured = process.env.GEMMA_MODEL_NAME || process.env.GEMINI_FLASH_MODEL || process.env.GEMMA_MODEL;
  const list = [
    'gemini-3.5-flash-lite',
    configured,
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemma-4-26b-a4b-it',
  ].filter((m): m is string => Boolean(m && m.trim().length > 0));

  return Array.from(new Set(list));
}

/**
 * Generates contextual architectural answers and identifies relevant node IDs to highlight.
 * Works with or without a cached ArchitectureMap.
 */
export async function answerArchitectureQuestion(
  req: ChatRequest,
  cachedMap?: ArchitectureMap | null
): Promise<ChatResponse> {
  const cleanQuestion = req.question?.trim() || "";

  // 0. Instant greeting / conversational check without making slow model calls
  if (isGreeting(cleanQuestion)) {
    return {
      answer: "👋 Hello! I am your **RepoLens Architecture Copilot**. Ask me anything about this repository's structure, module boundaries, or select a block on the diagram to inspect its dependencies.",
      highlightedNodeIds: [],
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[geminiChat] Warning: GEMINI_API_KEY is not set in environment.');
  }

  const ai = new GoogleGenAI({ apiKey: apiKey || '' });

  // 1. Identify and resolve selected node context if available
  let selectedNodeContext = 'None';
  let availableNodes: MapNode[] = [];

  if (cachedMap && Array.isArray(cachedMap.nodes) && cachedMap.nodes.length > 0) {
    availableNodes = cachedMap.nodes;
    if (req.selectedNodeId) {
      const match = cachedMap.nodes.find((n: MapNode) => n.id === req.selectedNodeId);
      if (match) {
        selectedNodeContext = `Node ID: ${match.id}, Label: "${match.label}", Zone: "${match.zone}", Path: "${match.filePath}", Summary: "${match.summary}"`;
      } else {
        selectedNodeContext = `Node ID: ${req.selectedNodeId} (details not found in cached nodes)`;
      }
    }
  } else if (req.selectedNodeId) {
    selectedNodeContext = `Node ID: ${req.selectedNodeId}`;
  }

  // 2. Prepare architectural context
  const validNodeIdsSet = new Set<string>(availableNodes.map((n) => n.id));

  const architecturalContext = {
    selectedNode: selectedNodeContext,
    architectureNodes: availableNodes.map((n) => ({
      id: n.id,
      label: n.label,
      zone: n.zone,
      filePath: n.filePath,
      summary: n.summary,
    })),
    architectureEdges: cachedMap?.edges || [],
    fileSkeletons: req.skeleton?.files || [],
  };

  const systemPrompt = `You are RepoLens AI Copilot, an expert repository architecture navigator.
Analyze the repository's structural skeleton, architecture zones, nodes, and dependency edges to answer questions.
Only structural skeletons (file paths, imports, exports, signatures) are provided; raw function bodies are omitted.

Instructions:
1. Answer concisely and practically in 2–4 sentences, referencing specific module labels and file paths.
2. If a selected node is specified and the question relates to it, focus specifically on its role, relationships, or what depends on/is used by it.
3. Return "highlightedNodeIds": an array of node IDs ("node-0", "node-1", etc.) directly relevant to the answer or dependency chain.
4. If cached architecture nodes are provided, ONLY include node IDs that exist in the architecture nodes list.
5. If no cached nodes are provided, infer reasonable node IDs if applicable or return an empty array [].
6. If the question is a greeting, pleasantry, or conversational test (e.g., "hi", "hello", "hey", "how are you"), do NOT describe random modules or files. Instead, briefly greet the user, state your role as the RepoLens Architecture Copilot, and invite them to ask about this codebase's architecture or dependencies. Set "highlightedNodeIds": [].
7. If the question is completely irrelevant to software architecture, coding, or this repository (e.g., general trivia, jokes, weather, recipes, chit-chat), politely decline: "I am specialized in analyzing software repository architecture and codebase dependencies. Please ask a question related to this repository's structure, modules, or call chains." Set "highlightedNodeIds": [].

Respond ONLY with valid JSON matching the exact schema:
{
  "answer": "Concise 2-4 sentence explanation...",
  "highlightedNodeIds": ["node-X", "node-Y"]
}
Do NOT include markdown fences, conversational prefix/suffix, or code blocks. Pure JSON only.`;

  const userPrompt = `${systemPrompt}\n\nContext:\n${JSON.stringify(architecturalContext, null, 2)}\n\nUser Question:\n"${req.question}"`;

  const candidates = getCandidateModels();
  let rawText = '';
  let lastError: any = null;

  for (const model of candidates) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: userPrompt,
          config: {
            temperature: 0.2,
          },
        }),
        8000,
        `Model ${model} timed out after 8s`
      );

      if (response && response.text) {
        rawText = response.text;
        break; // Success
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[geminiChat] Model '${model}' failed (${err?.status || err?.message?.slice(0, 80)}). Trying fallback candidate...`);
    }
  }

  if (!rawText) {
    console.error('[geminiChat] All candidate models failed:', lastError?.message);
    // User-friendly smart fallback when quota is exhausted
    const selectedFile = req.skeleton?.files?.find(
      (f) => req.selectedNodeId && (f.filePath.includes(req.selectedNodeId) || req.selectedNodeId.includes(f.filePath))
    );

    let friendlyAnswer = "";
    if (selectedFile) {
      friendlyAnswer = `**${selectedFile.filePath}:** This module defines exports [${selectedFile.exports.slice(0, 3).join(", ") || "default"}] and interacts with [${selectedFile.imports.slice(0, 3).join(", ") || "core libraries"}]. (AI model quota temporarily exhausted, showing structural analysis).`;
    } else {
      friendlyAnswer = `The repository consists of ${req.skeleton?.files?.length || 0} modules. Select any node to inspect its specific imports and exports. (API quota limit reached on remote model).`;
    }

    return {
      answer: friendlyAnswer,
      highlightedNodeIds: req.selectedNodeId ? [req.selectedNodeId] : [],
    };
  }

  try {
    const cleanedText = cleanJsonOutput(rawText);

    let parsed: RawChatResponse;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.error('[geminiChat] Failed to parse model output as JSON. Raw text was:\n', rawText);
      return {
        answer: cleanedText,
        highlightedNodeIds: req.selectedNodeId ? [req.selectedNodeId] : [],
      };
    }

    const answer = typeof parsed.answer === 'string' && parsed.answer.trim().length > 0
      ? parsed.answer.trim()
      : 'No response could be generated for the given architectural question.';

    let highlightedNodeIds: string[] = [];
    if (Array.isArray(parsed.highlightedNodeIds)) {
      highlightedNodeIds = parsed.highlightedNodeIds.filter((id): id is string => typeof id === 'string');

      // If cachedMap nodes exist, strictly filter out invalid or hallucinated node IDs
      if (validNodeIdsSet.size > 0) {
        highlightedNodeIds = highlightedNodeIds.filter((id) => validNodeIdsSet.has(id));
      }
    }

    return {
      answer,
      highlightedNodeIds,
    };
  } catch (error) {
    console.error('[geminiChat] Error processing answer:', error);
    return {
      answer: `Analysis complete: ${rawText.slice(0, 300)}`,
      highlightedNodeIds: req.selectedNodeId ? [req.selectedNodeId] : [],
    };
  }
}
