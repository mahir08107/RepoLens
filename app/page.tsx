'use client';
// app/page.tsx
import React, { useState, useEffect, useCallback } from "react";
import MermaidCanvas from "../components/MermaidCanvas";
import ChatSidebar from "../components/ChatSidebar";

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [skeleton, setSkeleton] = useState<any>(null);
  const [mermaidDef, setMermaidDef] = useState<string>("");
  const [legend, setLegend] = useState<Record<string, string>>({}); // group -> colour
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!repoUrl) return;
    setLoading(true);
    setError(null);
    try {
      // 1. fetch repo tree and files client‑side via GitHub raw URLs (CORS allowed)
      const response = await fetch("/api/diagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Diagram generation failed");
      setMermaidDef(data.mermaidDefinition);
      setLegend(data.groupColors);
      setSkeleton(data.skeleton);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleNodeSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-white shadow p-4 flex items-center space-x-4">
        <input
          type="url"
          placeholder="Enter public GitHub repo URL"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="bg-indigo-800 text-white rounded px-4 py-2 hover:bg-indigo-900 disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate"}
        </button>
        {error && <span className="text-red-600">{error}</span>}
      </header>

      {/* Legend bar */}
      {Object.keys(legend).length > 0 && (
        <div className="flex items-center p-2 bg-gray-100 space-x-4 overflow-x-auto">
          {Object.entries(legend).map(([group, colour]) => (
            <div key={group} className="flex items-center space-x-1">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: colour }}
              ></span>
              <span className="text-sm">{group}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main split pane */}
      <main className="flex flex-1 overflow-hidden">
        <section className="w-7/10 p-4 overflow-auto">
          {mermaidDef ? (
            <MermaidCanvas
              definition={mermaidDef}
              onNodeSelect={handleNodeSelect}
              highlightedId={selectedId}
            />
          ) : (
            <p className="text-center text-gray-500 mt-8">Enter a GitHub repo URL and click Generate.</p>
          )}
        </section>
        <section className="w-3/10 border-l border-gray-200 p-4 overflow-auto">
          <ChatSidebar
            repoSkeleton={skeleton}
            selectedId={selectedId}
            onSelectionClear={() => setSelectedId(null)}
          />
        </section>
      </main>
    </div>
  );
}
