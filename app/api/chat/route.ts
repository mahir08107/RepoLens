// app/api/chat/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { ChatRequest, ChatResponse } from "@/shared/types";
import { API_BASE_URL } from "@/lib/api-config";
import { GoogleGenAI } from "@google/genai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || !body.question) {
      return NextResponse.json({ error: "Invalid chat payload: question is required" }, { status: 400 });
    }

    const { repoUrl, commitSha, question, selectedNodeId, skeleton } = body;

    // 0. Instant greeting check without slow network calls
    const cleanQ = question.toLowerCase().replace(/[!?.,]+$/, "").trim();
    const GREETINGS = new Set(["hi", "hello", "hey", "hola", "yo", "sup", "greetings", "good morning", "good afternoon", "good evening", "howdy", "hi there", "hello there", "hey there", "who are you", "what are you", "what can you do", "help"]);
    if (GREETINGS.has(cleanQ)) {
      return NextResponse.json({
        answer: "👋 Hello! I am your **RepoLens Architecture Copilot**. Ask me anything about this repository's structure, module boundaries, or select a block on the diagram to inspect its dependencies.",
        highlightedNodeIds: [],
      });
    }

    const backendUrl = API_BASE_URL;

    // 1. Try remote or local Express backend (/api/chat)
    if (backendUrl) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const backendRes = await fetch(`${backendUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repoUrl,
            commitSha: commitSha || "latest",
            question,
            selectedNodeId,
            skeleton: skeleton || { repoUrl: repoUrl || "", commitSha: commitSha || "latest", files: [] },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (backendRes.ok) {
          const data = await backendRes.json();
          return NextResponse.json(data);
        }
      } catch (backendErr: any) {
        console.warn(`Backend chat at ${backendUrl}/api/chat notice:`, backendErr?.message);
      }
    }

    // 2. Direct Gemini / Gemma generation with model fallback
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      const candidates = ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });

      const relevantFiles =
        skeleton?.files?.slice(0, 25).map(
          (f: any) =>
            `- Path: ${f.filePath}\n  Imports: ${f.imports?.slice(0, 5).join(", ") || "none"}\n  Exports: ${f.exports?.slice(0, 5).join(", ") || "none"}\n  Signatures: ${f.functionSignatures?.slice(0, 5).join("; ") || "none"}`
        ).join("\n") || "No structural files available.";

      const prompt = `You are RepoLens AI Copilot, an expert repository architecture navigator.
Repository: ${repoUrl || skeleton?.repoUrl || "Unknown"}
Commit: ${commitSha || skeleton?.commitSha || "latest"}
Currently selected node: ${selectedNodeId || "None"}

Structural skeleton:
${relevantFiles}

User Question: "${question}"

Instructions:
1. Answer concisely in 2–4 sentences, referencing specific module labels and file paths.
2. Return "highlightedNodeIds": array of relevant node IDs or file paths mentioned.
3. If the user's question is a greeting or pleasantry, greet them briefly and invite them to ask about repository architecture. Return "highlightedNodeIds": [].
4. If the question is completely irrelevant to software architecture, coding, or this codebase (e.g. general trivia, jokes, weather, recipes, chit-chat), politely decline: "I am specialized in analyzing software repository architecture and codebase dependencies. Please ask a question related to this repository's structure, modules, or call chains." Return "highlightedNodeIds": [].
Output strictly JSON matching:
{
  "answer": "Concise answer...",
  "highlightedNodeIds": ["node-X"]
}`;

      for (const model of candidates) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
          });

          const raw = response.text?.trim() || "";
          const cleaned = raw.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
          try {
            const parsed = JSON.parse(cleaned);
            return NextResponse.json({
              answer: parsed.answer || "Analyzed architecture module context.",
              highlightedNodeIds: Array.isArray(parsed.highlightedNodeIds) ? parsed.highlightedNodeIds : [],
            });
          } catch {
            return NextResponse.json({
              answer: cleaned,
              highlightedNodeIds: selectedNodeId ? [selectedNodeId] : [],
            });
          }
        } catch (mErr: any) {
          console.warn(`Direct model ${model} error:`, mErr?.message?.slice(0, 80));
        }
      }
    }

    // 3. Smart local heuristic fallback
    const matchingFile = skeleton?.files?.find(
      (f: any) =>
        selectedNodeId &&
        (f.filePath.includes(selectedNodeId) ||
          selectedNodeId.includes(f.filePath.replace(/[^a-zA-Z0-9_]/g, "_")))
    );

    let fallbackAnswer = "";
    if (matchingFile) {
      fallbackAnswer = `**Analysis for \`${matchingFile.filePath}\`:**\nThis module orchestrates key operations within its functional zone. It declares exports [${matchingFile.exports?.slice(0, 4).join(", ") || "default"}] and interacts with neighboring modules via direct dependency imports.`;
    } else {
      fallbackAnswer = `Analyzing **${repoUrl || "this repository"}**: The architecture consists of ${skeleton?.files?.length || 0} parsed source files grouped into modular subgraphs. Select any specific node to inspect its call chains and exports.`;
    }

    return NextResponse.json({
      answer: fallbackAnswer,
      highlightedNodeIds: selectedNodeId ? [selectedNodeId] : [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process chat" }, { status: 500 });
  }
}
