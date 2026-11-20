// components/ChatSidebar.tsx
import React, { useState, useEffect, FormEvent } from "react";
import { Chat, ChatMessage, RepoSkeleton, ArchitectureMap } from "@/shared/types";

interface ChatSidebarProps {
  repoSkeleton: RepoSkeleton | null;
  selectedId: string | null;
  onSelectionClear: () => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ repoSkeleton, selectedId, onSelectionClear }) => {
  const [chat, setChat] = useState<Chat>({
    conversationId: crypto.randomUUID(),
    messages: [],
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When a node is selected, prepend a system hint into chat context.
  useEffect(() => {
    if (selectedId) {
      const hint: ChatMessage = {
        role: "assistant",
        content: `User selected node/group: ${selectedId}`,
        timestamp: new Date().toISOString(),
      };
      setChat((c) => ({ ...c, messages: [...c.messages, hint] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg: ChatMessage = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    const updatedChat = { ...chat, messages: [...chat.messages, userMsg] };
    setChat(updatedChat);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...updatedChat, repoSkeleton, architectureMap: null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Chat failed");
      setChat(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Chat Copilot</h2>
        {selectedId && (
          <div className="flex items-center space-x-1 text-sm bg-indigo-100 rounded px-2 py-1">
            <span className="font-medium">Selected:</span>
            <span>{selectedId}</span>
            <button onClick={onSelectionClear} className="ml-1 text-red-500">✕</button>
          </div>
        )}
      </header>
      <div className="flex-1 overflow-y-auto space-y-4 mb-2">
        {chat.messages.map((msg, idx) => (
          <div key={idx} className={msg.role === "user" ? "text-right" : "text-left"}>
            <div
              className={
                msg.role === "user"
                  ? "inline-block bg-indigo-800 text-white rounded px-3 py-2"
                  : "inline-block bg-gray-100 border border-gray-300 rounded px-3 py-2"
              }
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && <p className="text-gray-500">Thinking…</p>}
        {error && <p className="text-red-600">{error}</p>}
      </div>
      <form onSubmit={handleSubmit} className="flex space-x-2">
        <input
          type="text"
          placeholder="Ask about this node…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-800 text-white rounded px-4 py-2 hover:bg-indigo-900 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatSidebar;
