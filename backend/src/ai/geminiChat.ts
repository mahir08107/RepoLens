import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { ArchitectureMap, ChatRequest, ChatResponse, MapNode } from '../../../shared/types';

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

interface RawChatResponse {
  answer?: string;
  highlightedNodeIds?: string[];
}

/**
 * Generates contextual architectural answers and identifies relevant node IDs to highlight.
 * Works with or without a cached ArchitectureMap.
 */
export async function answerArchitectureQuestion(
  req: ChatRequest,
  cachedMap?: ArchitectureMap | null
): Promise<ChatResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[geminiChat] Warning: GEMINI_API_KEY is not set in environment.');
  }

  const ai = new GoogleGenAI({ apiKey: apiKey || '' });
  const modelName = process.env.GEMINI_FLASH_MODEL || 'gemini-2.5-flash-lite';

  // 1. Identify and resolve selected node context if available
  let selectedNodeContext = 'None';
  let availableNodes: MapNode[] = [];

  if (cachedMap && Array.isArray(cachedMap.nodes) && cachedMap.nodes.length > 0) {
    availableNodes = cachedMap.nodes;
    if (req.selectedNodeId) {
      const match = cachedMap.nodes.find((n) => n.id === req.selectedNodeId);
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
2. If a selected node is specified, focus specifically on its role, relationships, or what depends on/is used by it.
3. Return "highlightedNodeIds": an array of node IDs ("node-0", "node-1", etc.) directly relevant to the answer or dependency chain.
4. If cached architecture nodes are provided, ONLY include node IDs that exist in the architecture nodes list.
5. If no cached nodes are provided, infer reasonable node IDs if applicable or return an empty array [].

Respond ONLY with valid JSON matching the exact schema:
{
  "answer": "Concise 2-4 sentence explanation...",
  "highlightedNodeIds": ["node-X", "node-Y"]
}
Do NOT include markdown fences, conversational prefix/suffix, or code blocks. Pure JSON only.`;

  const userPrompt = `${systemPrompt}\n\nContext:\n${JSON.stringify(architecturalContext, null, 2)}\n\nUser Question:\n"${req.question}"`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: userPrompt,
      config: {
        temperature: 0.2,
      },
    });

    const rawText = response.text || '';
    const cleanedText = cleanJsonOutput(rawText);

    let parsed: RawChatResponse;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.error('[geminiChat] Failed to parse model output as JSON. Raw text was:\n', rawText);
      throw new Error(`JSON parse error from Gemini Chat: ${(parseErr as Error).message}`);
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
    console.error('[geminiChat] Error generating answer:', error);
    // Graceful fallback response
    return {
      answer: `Unable to complete chat request at this time: ${(error as Error).message}`,
      highlightedNodeIds: req.selectedNodeId ? [req.selectedNodeId] : [],
    };
  }
}

