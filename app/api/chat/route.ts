// app/api/chat/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Chat, RepoSkeleton } from "@/shared/types";
import { GoogleGenAI } from "@google/genai";

export async function POST(request: NextRequest) {
  try {
    const chat: Chat = await request.json();
    if (!chat || !Array.isArray(chat.messages) || chat.messages.length === 0) {
      return NextResponse.json({ error: "Invalid chat payload" }, { status: 400 });
    }

    const lastUserMsg = chat.messages[chat.messages.length - 1];
    const question = lastUserMsg?.content || "";
    const selectedId = chat.selectedId;
    const skeleton = chat.repoSkeleton;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    let assistantReply = "";

    // 1. Try Cloud Run Live Backend Copilot endpoint
    const backendUrl =
      process.env.VITE_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "https://repolens-backend-499932337342.asia-south1.run.app";

    try {
      const backendRes = await fetch(`${backendUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          commitSha: skeleton?.commitSha || "latest",
          selectedNodeId: selectedId,
          skeleton: skeleton || { repoUrl: "", commitSha: "latest", files: [] },
        }),
      });

      if (backendRes.ok) {
        const data = await backendRes.json();
        if (data.answer) {
          assistantReply = data.answer;
        }
      }
    } catch (backendErr: any) {
      console.warn("Cloud Run backend /api/chat notice:", backendErr.message);
    }

    // 2. If Gemini API key is available locally, generate response with Gemini 2.5 Pro / Flash
    if (geminiApiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        const relevantFiles = skeleton?.files?.slice(0, 15).map(
          (f) =>
            `File: ${f.filePath}\nImports: ${f.imports?.join(", ") || "none"}\nExports: ${f.exports?.join(", ") || "none"}\nSignatures: ${f.functionSignatures?.join("; ") || "none"}`
        ).join("\n\n") || "No structural files available.";

        const systemPrompt = `You are RepoLens Copilot, an expert AI software architect.
Repository: ${skeleton?.repoUrl || "Unknown"}
Currently selected node / module: ${selectedId || "None"}

Here is the privacy-sanitized structural skeleton (imports, exports, signatures with bodies stripped):
${relevantFiles}

Answer the user's question clearly, explaining architectural relationships, dependencies, and responsibilities.`;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-pro",
          contents: `${systemPrompt}\n\nUser Question: ${question}`,
        });

        assistantReply = response.text?.trim() || "";
      } catch (err: any) {
        console.warn("Gemini chat fallback:", err.message);
      }
    }

    // 2. Context-aware fallback if Gemini is not configured or failed
    if (!assistantReply) {
      const matchingFile = skeleton?.files?.find(
        (f) => selectedId && (f.filePath.includes(selectedId) || selectedId.includes(f.filePath.replace(/[^a-zA-Z0-9_]/g, "_")))
      );

      if (matchingFile) {
        const funcs = matchingFile.functionSignatures?.length
          ? `\n- Key methods: \`${matchingFile.functionSignatures.slice(0, 3).join("`, `")}\``
          : "";
        const imports = matchingFile.imports?.length
          ? `\n- Dependencies imported: \`${matchingFile.imports.slice(0, 4).join("`, `")}\``
          : "";
        const exports = matchingFile.exports?.length
          ? `\n- Exported interfaces: \`${matchingFile.exports.slice(0, 4).join("`, `")}\``
          : "";

        assistantReply = `**Analysis for \`${matchingFile.filePath}\`:**\nThis module is part of the repository's core structure.${imports}${exports}${funcs}\n\nIt interacts with connected components in its functional zone based on inferred dependency edges.`;
      } else {
        assistantReply = `Analyzing **${skeleton?.repoUrl || "this repository"}**: The architecture consists of ${skeleton?.files?.length || 0} parsed source files grouped into modular subgraphs. Select any specific node to inspect its call chains and exports.`;
      }
    }

    const updatedChat: Chat = {
      ...chat,
      messages: [
        ...chat.messages,
        {
          role: "assistant",
          content: assistantReply,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ],
    };

    return NextResponse.json(updatedChat);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
