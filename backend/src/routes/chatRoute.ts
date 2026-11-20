// backend/src/routes/chatRoute.ts
/**
 * Express route for the copilot chat.
 * POST /api/chat expects a JSON body with the current Chat context.
 * It forwards the conversation (including repository skeleton and architecture
 * map) to Gemini Flash Lite to generate a response.
 */
import express, { Request, Response } from "express";
import { Chat, ArchitectureMap, RepoSkeleton } from "../../shared/types";
import { GeminiArchitectError } from "../ai/geminiArchitect"; // reuse error class for consistency

/**
 * Calls Gemini Flash Lite model for a chat turn.
 */
async function callGeminiChat(payload: any): Promise<string> {
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
  const json = await response.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new GeminiArchitectError("Gemini returned empty chat response.");
  }
  return text;
}

/**
 * Build a prompt that includes the repo skeleton, architecture map (if any), and
 * the chat history. The most recent user message is expected to be the last in
 * the messages array.
 */
function buildChatPrompt(chat: Chat): string {
  const { repoSkeleton, architectureMap, messages } = chat;
  const repoInfo = repoSkeleton
    ? `Repository: ${repoSkeleton.repoUrl}\nCommit: ${repoSkeleton.commitSha}\nNumber of files: ${repoSkeleton.files.length}`
    : "";
  const mapInfo = architectureMap ? `\nArchitecture Map (Mermaid):\n${architectureMap.mermaidDefinition}` : "";

  const history = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  return `You are an AI assistant helping a developer understand a repository. Use the provided repository information and architecture map to answer the latest question. If you need more context, ask the user.\n\n${repoInfo}${mapInfo}\n\nChat history:\n${history}`;
}

const router = express.Router();

router.post("/chat", async (req: Request, res: Response) => {
  const chat: Chat = req.body;
  if (!chat || !Array.isArray(chat.messages) || chat.messages.length === 0) {
    return res.status(400).json({ error: "Invalid Chat payload" });
  }

  const prompt = buildChatPrompt(chat);
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 1024 },
  };

  try {
    const assistantReply = await callGeminiChat(payload);
    // Append assistant reply to chat history for client‑side persistence.
    const updatedChat: Chat = {
      ...chat,
      messages: [...chat.messages, { role: "assistant", content: assistantReply, timestamp: new Date().toISOString() }],
    };
    return res.status(200).json(updatedChat);
  } catch (e) {
    const err = e as Error;
    return res.status(502).json({ error: err.message });
  }
});

export default router;
