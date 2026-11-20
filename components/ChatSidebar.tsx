'use client';
import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Send, X, AlertTriangle, FileCode2 } from "lucide-react";
import type { ChatRequest, ChatResponse, RepoSkeleton } from "@/shared/types";
import type { CanvasNode, NodeRegistry } from "@/lib/node-registry";
import { API_BASE_URL } from "@/lib/api-config";
import MarkdownMessage from "@/components/MarkdownMessage";

export interface ChatMessageItem {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  highlightedNodeIds?: string[];
  isError?: boolean;
}

interface ChatSidebarProps {
  repoSkeleton: RepoSkeleton | null;
  repoUrl: string | null;
  commitSha: string | null;
  selectedNode: CanvasNode | null;
  registry: NodeRegistry;
  onSelectionClear: () => void;
  onHighlightNodes: (nodeIds: string[]) => void;
  onFocusNode: (nodeId: string, highlightIds?: string[]) => void;
  onClose?: () => void;
}

const QUICK_PROMPTS = ["Explain module purpose", "Show dependent files", "Identify entry point"];

const formatTime = () =>
  typeof window !== "undefined"
    ? new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  repoSkeleton,
  repoUrl,
  commitSha,
  selectedNode,
  registry,
  onSelectionClear,
  onHighlightNodes,
  onFocusNode,
  onClose,
}) => {
  // Use a stable, static initial state to avoid server/client hydration mismatch
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      role: "assistant",
      content:
        "👋 Hi! I'm your **RepoLens Architecture Copilot**. I analyze the repository structure from its privacy-sanitized AST skeleton.\n\nClick any node on the left diagram or ask me about architecture, module boundaries, or call chains!",
      timestamp: "",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Set the initial message timestamp after mounting on client to guarantee 0 hydration mismatch
  useEffect(() => {
    setMessages((prev) =>
      prev.map((m, idx) => (idx === 0 && !m.timestamp ? { ...m, timestamp: formatTime() } : m))
    );
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const pushMessage = (msg: ChatMessageItem) => setMessages((prev) => [...prev, msg]);

  const handleSend = async (questionText?: string) => {
    const question = (questionText ?? input).trim();
    if (!question || loading) return;

    pushMessage({ role: "user", content: question, timestamp: formatTime() });
    setInput("");

    if (!commitSha || !repoSkeleton || !repoSkeleton.files?.length) {
      pushMessage({
        role: "assistant",
        content:
          "No architecture map is loaded yet. Paste a GitHub repository URL above and click **Generate** first, then ask me again.",
        timestamp: formatTime(),
        isError: true,
      });
      return;
    }

    setLoading(true);

    // Backend-native node ID (e.g. `node-3`) when the map came from Cloud Run.
    const backendNodeId = selectedNode ? registry.toBackendId(selectedNode.id) : undefined;
    // If the backend has no cached map for this node, give it the file path as extra context.
    const contextualQuestion =
      selectedNode && !selectedNode.archId && selectedNode.filePath
        ? `${question}\n\n(Selected module: ${selectedNode.label} — \`${selectedNode.filePath}\`)`
        : question;

    const payload: ChatRequest & { repoUrl: string } = {
      repoUrl: repoUrl || repoSkeleton.repoUrl,
      commitSha,
      question: contextualQuestion,
      selectedNodeId: backendNodeId,
      skeleton: repoSkeleton,
    };

    try {
      // 1. Send request with an active 12-second timeout guard
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      let res: Response;
      const apiBase =
        (typeof process !== "undefined" &&
          (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.VITE_API_BASE_URL)) ||
        API_BASE_URL ||
        "";
      const targetUrl = apiBase ? `${apiBase.replace(/\/+$/, "")}/api/chat` : "/api/chat";

      try {
        res = await fetch(targetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || data?.details || `Chat request failed (HTTP ${res.status})`);
      }

      const response = data as ChatResponse;
      const answer = response?.answer?.trim() || "The copilot returned an empty answer.";
      const mapped = Array.from(
        new Set(
          (response?.highlightedNodeIds || [])
            .map((id) => registry.resolve(id))
            .filter((id): id is string => Boolean(id))
        )
      );
      const highlightIds = mapped.length > 0 ? mapped : registry.findMentioned(answer);

      pushMessage({ role: "assistant", content: answer, timestamp: formatTime(), highlightedNodeIds: highlightIds });
      if (highlightIds.length > 0) onHighlightNodes(highlightIds);
    } catch (err: any) {
      pushMessage({
        role: "assistant",
        content: `Couldn't reach the RepoLens backend at \`${API_BASE_URL}/api/chat\`.\n\n${err?.message || "Unknown error"}`,
        timestamp: formatTime(),
        isError: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    const target = selectedNode ? `: ${selectedNode.label} (${selectedNode.filePath || selectedNode.id})` : "";
    handleSend(`${prompt}${target}`);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-[#d0d7de] shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-[#d0d7de] flex items-center justify-between gap-2 bg-[#f6f8fa]">
        <div className="flex items-center space-x-2 shrink-0">
          <div className="w-6 h-6 rounded-md bg-[#1f2328] text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#79c0ff]" />
          </div>
          <div>
            <h3 className="font-semibold text-xs text-[#1f2328] tracking-tight">Copilot</h3>
            <p className="text-[10px] text-[#656d76]">Repository Architecture AI</p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 min-w-0">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Collapse Copilot (⌘I)"
              className="p-1 rounded-md text-[#656d76] hover:text-[#1f2328] hover:bg-[#eaeef2] transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Prominent Sticky Active Context Bar */}
      {selectedNode ? (
        <div className="px-3 py-1.5 bg-[#ddf4ff] border-b border-[#54aeff]/30 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center space-x-1.5 min-w-0">
            <FileCode2 className="w-3.5 h-3.5 text-[#0969da] shrink-0" />
            <span className="font-semibold text-[11px] text-[#1f2328]">Active:</span>
            <span
              className="font-mono text-[11px] text-[#0969da] font-medium truncate"
              title={selectedNode.filePath || selectedNode.label}
            >
              {selectedNode.filePath || selectedNode.label}
            </span>
            {selectedNode.zone && (
              <span className="px-1.5 py-0.2 rounded bg-white text-[10px] text-[#0969da] border border-[#54aeff]/40 font-medium shrink-0">
                {selectedNode.zone}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onSelectionClear}
            className="text-[#0969da] hover:text-[#0550ae] p-1 rounded-md hover:bg-blue-100/50 cursor-pointer shrink-0"
            title="Switch back to Entire Repository mode"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="px-3.5 py-1.5 bg-[#f6f8fa] border-b border-[#d0d7de] flex items-center justify-between text-[11px] text-[#656d76]">
          <span>Context: Entire Repository</span>
          <span className="text-[10px] text-[#8c959f]">Click node to scope</span>
        </div>
      )}

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#FFFFFF]">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#09090B] text-white rounded-br-xs"
                  : msg.isError
                    ? "bg-red-50 text-red-800 border border-red-200 rounded-bl-xs"
                    : "bg-[#F4F4F5] text-[#09090B] border border-[#E4E4E7] rounded-bl-xs"
              }`}
            >
              {msg.role === "user" ? (
                <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
              ) : (
                <div className="flex gap-1.5">
                  {msg.isError && <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-500" />}
                  <MarkdownMessage content={msg.content} />
                </div>
              )}

              {msg.highlightedNodeIds && msg.highlightedNodeIds.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1">
                  <span className="text-[10px] text-slate-400 font-medium">Highlighted:</span>
                  {msg.highlightedNodeIds.map((id) => {
                    const node = registry.byId.get(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onFocusNode(id, msg.highlightedNodeIds)}
                        title={node ? `${node.filePath || node.label} (${id})` : id}
                        className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-[10px] font-mono cursor-pointer transition-colors"
                      >
                        {node?.label || id}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {msg.timestamp && (
              <span className="text-[9px] text-slate-400 mt-1 px-1" suppressHydrationWarning>
                {msg.timestamp}
              </span>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center space-x-2 text-xs text-slate-500 bg-white border border-slate-200 px-3 py-2.5 rounded-2xl rounded-bl-xs w-fit shadow-2xs">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" />
            </span>
            <span>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestion Chips */}
      <div className="px-4 py-1.5 bg-slate-50/80 border-t border-slate-100 flex items-center space-x-1.5 overflow-x-auto text-[11px]">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={loading}
            onClick={() => handleQuickPrompt(prompt)}
            className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 shrink-0 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 border-t border-[#d0d7de] bg-white"
      >
        {selectedNode && (
          <div className="mb-2 px-2.5 py-1.5 bg-[#09090B] text-white rounded-md flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center space-x-1.5 min-w-0">
              <FileCode2 className="w-3.5 h-3.5 text-[#A1A1AA] shrink-0" />
              <span className="font-medium text-[11px] text-[#A1A1AA]">Scoped:</span>
              <span
                className="font-mono text-[11px] text-white font-medium truncate"
                title={selectedNode.filePath || selectedNode.label}
              >
                {selectedNode.filePath || selectedNode.label}
              </span>
              {selectedNode.zone && (
                <span className="px-1.5 py-0.2 rounded bg-[#27272A] text-[10px] text-[#E4E4E7] border border-[#3F3F46] shrink-0">
                  {selectedNode.zone}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onSelectionClear}
              title="Clear file context (Entire Repository mode)"
              className="text-[#A1A1AA] hover:text-white p-0.5 rounded cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="relative flex items-center">
          <input
            type="text"
            placeholder={
              selectedNode
                ? `Ask about ${selectedNode.label} (e.g., "What breaks if I change this?")...`
                : "Ask anything about this repository..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full pl-3 pr-10 py-2 text-xs bg-[#f6f8fa] border border-[#d0d7de] rounded-md focus:outline-none focus:ring-2 focus:ring-[#0969da] focus:bg-white text-[#1f2328] placeholder-[#656d76] transition-all shadow-2xs font-sans"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-1.5 p-1 bg-[#1f2328] hover:bg-[#24292f] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatSidebar;
