// app/api/chat/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Chat, ArchitectureMap, RepoSkeleton } from "@/shared/types";

/**
 * Placeholder Gemini chat call – in a real implementation this would forward the
 * `Chat` payload (including repo skeleton and architecture map) to the Gemini
 * 2.5‑pro model via the `@google/genai` client.
 */
async function callGeminiChat(payload: any): Promise<string> {
  // For now we synthesize a deterministic response.
  const lastUser = payload.contents?.[payload.contents.length - 1];
  const question = lastUser?.parts?.[0]?.text?.trim() ?? "";
  if (!question) return "I need a question to answer.";
  return `Here is a quick answer to your question: "${question}". (This is a placeholder response.)`;
}

export async function POST(request: NextRequest) {
  try {
    const chat: Chat = await request.json();
    if (!chat || !Array.isArray(chat.messages) || chat.messages.length === 0) {
      return NextResponse.json({ error: "Invalid chat payload" }, { status: 400 });
    }

    // Build a simple Gemini payload – we only send the latest user message.
    const userMsg = chat.messages[chat.messages.length - 1];
    const payload = {
      contents: [{ role: "user", parts: [{ text: userMsg.content }] }],
      generationConfig: { maxOutputTokens: 1024 },
    };

    const reply = await callGeminiChat(payload);
    const updatedChat: Chat = {
      ...chat,
      messages: [...chat.messages, { role: "assistant", content: reply, timestamp: new Date().toISOString() }],
    };
    return NextResponse.json(updatedChat);
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
