import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { ArchitectureMap, FileSkeleton, MapEdge, MapNode, RepoSkeleton } from '../../../shared/types.js';
import { LabeledModule } from './gemmaLabeler.js';

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

/**
 * Uses Gemini Flash Lite to infer architectural dependency edges between classified modules.
 * Strictly takes structural skeletons (imports, exports, functionSignatures) - never raw function bodies.
 */
export async function buildArchitectureMap(
  skeleton: RepoSkeleton,
  labeledModules: LabeledModule[]
): Promise<ArchitectureMap> {
  // 1. Assign clean deterministic node IDs (node-0, node-1, ...) mapped to each filePath
  const filePathToIdMap = new Map<string, string>();
  const nodes: MapNode[] = labeledModules.map((mod, index) => {
    const id = `node-${index}`;
    filePathToIdMap.set(mod.filePath, id);
    return {
      id,
      label: mod.label,
      filePath: mod.filePath,
      zone: mod.zone,
      summary: mod.summary,
    };
  });

  const validNodeIds = new Set(nodes.map((n) => n.id));

  // Prepare structural context for Gemini
  const nodeContext = nodes.map((node) => {
    const fileSkeleton = skeleton.files.find((f) => f.filePath === node.filePath);
    return {
      id: node.id,
      filePath: node.filePath,
      label: node.label,
      zone: node.zone,
      imports: fileSkeleton?.imports || [],
      exports: fileSkeleton?.exports || [],
      functionSignatures: fileSkeleton?.functionSignatures || [],
    };
  });

  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey: apiKey || '' });

  // Priority model sequence with gemini-3.5-flash-lite first
  const configuredModel = process.env.GEMINI_FLASH_MODEL || 'gemini-3.5-flash-lite';
  const candidateModels = Array.from(
    new Set([
      'gemini-3.5-flash-lite',
      configuredModel,
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
    ])
  );

  const systemPrompt = `You are a software architecture analysis engine.
You are given a list of architectural nodes from a repository with deterministic IDs (node-0, node-1, etc.).
Each node includes its assigned zone (Auth, Database, Payments, Interface, Services), imports, exports, and function signatures.
Note: Raw function implementation bodies are omitted for privacy.

Your task is to infer architectural dependency edges between the nodes based on:
1. Direct import paths and references
2. Exported symbols used by other files
3. Natural architectural flow (e.g., Interface calling Services, Services calling Database or Payments, Auth verifying access for Services/Interface)

Requirements for edges:
- ONLY output dependencies between the provided node IDs.
- "id": "edge-0", "edge-1", etc.
- "source": valid source node ID (the caller or dependent node)
- "target": valid target node ID (the dependency or called module)
- "relation": a short explanation of the relationship (e.g. "imports auth middleware", "calls payment service", "queries database schema")
- Do NOT create self-loops (source === target).
- Do NOT invent or hallucinate node IDs that do not exist in the input list.

Return ONLY a valid JSON array of MapEdge objects matching this schema:
[
  {
    "id": string,
    "source": string,
    "target": string,
    "relation": string
  }
]
Do NOT include markdown fences, code backticks, or any explanatory text. Pure JSON only.`;

  const userPrompt = `${systemPrompt}\n\nNodes to analyze:\n${JSON.stringify(nodeContext, null, 2)}`;

  let edges: MapEdge[] = [];

  try {
    let rawText = '';
    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: userPrompt,
          config: {
            temperature: 0.1,
          },
        });
        rawText = response.text || '';
        if (rawText) break;
      } catch (err: any) {
        console.warn(`[geminiArchitect] Model '${model}' failed: ${err?.message || err}. Trying next...`);
      }
    }
    const cleaned = cleanJsonOutput(rawText);
    let parsedJson: any = null;
    try {
      parsedJson = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          parsedJson = JSON.parse(match[0]);
        } catch {}
      }
    }

    const candidateEdges = Array.isArray(parsedJson)
      ? parsedJson
      : parsedJson?.edges || parsedJson?.architectureMap?.edges || [];

    if (Array.isArray(candidateEdges)) {
      edges = candidateEdges
        .filter((edge: any) => {
          const isValidSource = edge && typeof edge.source === 'string' && validNodeIds.has(edge.source);
          const isValidTarget = edge && typeof edge.target === 'string' && validNodeIds.has(edge.target);
          const isNotSelfLoop = edge.source !== edge.target;
          return isValidSource && isValidTarget && isNotSelfLoop;
        })
        .map((edge: any, idx: number) => ({
          id: typeof edge.id === 'string' && edge.id ? edge.id : `edge-${idx}`,
          source: edge.source,
          target: edge.target,
          relation: typeof edge.relation === 'string' ? edge.relation.replace(/"/g, "'") : 'depends on',
        }));
    }
  } catch (err) {
    console.warn('[geminiArchitect] Edge generation encountered error, applying heuristic fallback:', err);
    // Heuristic fallback for edges based on import file paths
    let edgeIdx = 0;
    for (const sourceNode of nodes) {
      const srcFile = skeleton.files.find((f) => f.filePath === sourceNode.filePath);
      if (!srcFile) continue;

      for (const targetNode of nodes) {
        if (sourceNode.id === targetNode.id) continue;
        const targetBaseName = targetNode.filePath.split('/').pop()?.replace(/\.[^/.]+$/, '');
        if (targetBaseName && srcFile.imports.some((imp) => imp.includes(targetBaseName))) {
          edges.push({
            id: `edge-${edgeIdx++}`,
            source: sourceNode.id,
            target: targetNode.id,
            relation: `imports ${targetNode.label.replace(/"/g, "'")}`,
          });
        }
      }
    }
  }

  return {
    repoUrl: skeleton.repoUrl,
    commitSha: skeleton.commitSha,
    nodes,
    edges,
  };
}
