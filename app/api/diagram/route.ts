// app/api/diagram/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { RepoSkeleton } from "@/shared/types";
import {
  parseGitHubRepoUrl,
  fetchLatestCommitSha,
  fetchFilteredFileTree,
  fetchFileContents,
  parseFiles,
} from "@/lib/ast-parser";
import { generateMermaidDiagram, convertArchitectureMapToMermaid } from "@/lib/diagram-generator";
import { GoogleGenAI } from "@google/genai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repoUrl, skeleton: clientSkeleton } = body;

    if (!repoUrl) {
      return NextResponse.json({ error: "repoUrl is required" }, { status: 400 });
    }

    const { owner, repo } = parseGitHubRepoUrl(repoUrl);
    const githubToken = process.env.GITHUB_TOKEN;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    let skeleton: RepoSkeleton;

    // Use client-provided skeleton if it has files, otherwise fetch directly
    if (clientSkeleton && Array.isArray(clientSkeleton.files) && clientSkeleton.files.length > 0) {
      skeleton = clientSkeleton;
    } else {
      let commitSha = "unknown";
      try {
        commitSha = await fetchLatestCommitSha(owner, repo, githubToken);
      } catch {
        commitSha = "HEAD";
      }

      const filePaths = await fetchFilteredFileTree(owner, repo, commitSha, githubToken);
      const fileMap = await fetchFileContents(owner, repo, commitSha, filePaths);
      skeleton = await parseFiles(repoUrl, commitSha, fileMap);
    }

    // Step 1: Generate dynamic algorithmic diagram from actual files & imports
    const algorithmicResult = generateMermaidDiagram(skeleton);
    let mermaidDefinition = algorithmicResult.mermaidDefinition;
    let groupColors = algorithmicResult.groupColors;
    let entryNodeId = algorithmicResult.entryNodeId;

    // Step 2: Try Cloud Run Backend (Gemma 4B + Gemini Flash Lite + Firestore caching)
    const backendUrl =
      process.env.VITE_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "https://repolens-backend-499932337342.asia-south1.run.app";

    try {
      const backendRes = await fetch(`${backendUrl}/api/generate-map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: skeleton.repoUrl,
          commitSha: skeleton.commitSha,
          skeleton,
          files: skeleton.files,
        }),
      });

      if (backendRes.ok) {
        const backendMap = await backendRes.json();
        // If Cloud Run returned AI-classified nodes and edges, convert them to Mermaid
        if (Array.isArray(backendMap?.nodes) && backendMap.nodes.length > 0) {
          const converted = convertArchitectureMapToMermaid(backendMap, skeleton);
          if (converted.mermaidDefinition) {
            mermaidDefinition = converted.mermaidDefinition;
            groupColors = converted.groupColors;
            if (converted.entryNodeId) entryNodeId = converted.entryNodeId;
          }
        } else if (
          backendMap?.mermaidDefinition &&
          typeof backendMap.mermaidDefinition === "string" &&
          backendMap.mermaidDefinition.startsWith("flowchart") &&
          !backendMap.mermaidDefinition.includes("--> types")
        ) {
          mermaidDefinition = backendMap.mermaidDefinition;
        }
      }
    } catch (backendErr: any) {
      console.warn("Cloud Run backend /api/generate-map notice:", backendErr.message);
    }

    // Step 3: If GEMINI_API_KEY is available locally, use Gemini 2.5 Flash for enhanced architecture modeling
    if (geminiApiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        const skeletonSummary = skeleton.files
          .slice(0, 30)
          .map(
            (f) =>
              `- Path: ${f.filePath}\n  Imports: ${f.imports?.slice(0, 5).join(", ") || "none"}\n  Exports: ${f.exports?.slice(0, 5).join(", ") || "none"}`
          )
          .join("\n");

        const prompt = `You are an expert software architect analyzing this GitHub repository:
Repository: ${skeleton.repoUrl}
Commit: ${skeleton.commitSha}

Below is the repository's structural skeleton:
${skeletonSummary}

Generate a clear, detailed, folder-centric architectural Mermaid.js diagram (starting with "flowchart LR").
CRITICAL REQUIREMENTS FOR DETAILED FOLDER REPRESENTATION:
1. The top-level diagram must be horizontal ("flowchart LR").
2. Group files strictly by their actual repository directories / folders into subgraphs with "direction TB" inside each:
   - folder_app ["<b>📁 app/ • App Shell & Pages</b><br/><small><i>Root views, workspace & TopBar</i></small>"]
   - folder_components ["<b>📁 components/ • Visual Canvas & Copilot</b><br/><small><i>MermaidCanvas, ChatSidebar & UI panels</i></small>"]
   - folder_lib ["<b>📁 lib/ • AST Engine & Parsers</b><br/><small><i>Tree-sitter WASM parser & diagram builders</i></small>"]
   - folder_frontend ["<b>📁 frontend/ • Client Services</b><br/><small><i>API client adapter & mock data</i></small>"]
   - folder_backend ["<b>📁 backend/ • Cloud Run Server & AI Engine</b><br/><small><i>API routers, Gemma 4B & Gemini models</i></small>"]
   - folder_shared ["<b>📁 shared/ • Type Contracts</b><br/><small><i>RepoSkeleton & ArchitectureMap schemas</i></small>"]
3. Inside each folder subgraph, render DETAILED cards for the files so users immediately understand what is inside:
   Format: node_id["<b>📄 filename.ext</b><br/><small>Clear purpose & responsibility</small><br/><small>⚡ <code>Exports / Key functions</code></small>"]
4. Connect folders with clean, high-level horizontal conduits (NOT file-to-file spaghetti!):
   folder_app ==>|"renders UI"| folder_components
   folder_app ==>|"client AST parsing"| folder_lib
   folder_frontend ==>|"HTTP REST API"| folder_backend
   folder_backend ==>|"persists state"| folder_db
   folder_backend -.->|"type contracts"| folder_shared
   folder_lib -.->|"type contracts"| folder_shared
5. NEVER draw criss-crossing diagonal arrows from every individual file to shared/types.ts.
6. Output ONLY raw Mermaid syntax starting with "flowchart LR" without markdown fences.`;

        const geminiResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });

        const text = geminiResponse.text?.trim() || "";
        const cleanMermaid = text
          .replace(/^```mermaid\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/, "")
          .trim();

        // Check if Gemini generated a clean, folder-centric diagram
        if (
          (cleanMermaid.startsWith("flowchart LR") || cleanMermaid.startsWith("flowchart")) &&
          !cleanMermaid.includes("--> types")
        ) {
          mermaidDefinition = cleanMermaid;
        }
      } catch (geminiError: any) {
        console.warn("Gemini diagram generation notice (using algorithmic fallback):", geminiError?.message);
      }
    }

    return NextResponse.json({
      mermaidDefinition,
      groupColors,
      skeleton,
      entryNodeId,
    });
  } catch (e: any) {
    console.error("Diagram route error:", e);
    return NextResponse.json({ error: e.message || "Failed to generate architecture diagram" }, { status: 500 });
  }
}
