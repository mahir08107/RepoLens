'use client';
import React from "react";
import { X, FileCode2, ArrowUpRight, ArrowDownLeft, MessageSquareCode, Copy, Check, Focus } from "lucide-react";
import type { CanvasNode, NodeRegistry } from "@/lib/node-registry";

interface NodeInspectorProps {
  node: CanvasNode;
  registry: NodeRegistry;
  zoneColor?: string;
  onClose: () => void;
  onFocusNode: (id: string) => void;
  onHighlightGroup?: (ids: string[]) => void;
  onOpenCopilot?: () => void;
  isNeighborhoodFocused?: boolean;
  onToggleNeighborhoodFocus?: () => void;
}

/**
 * Floating GitHub-Style Node Inspector Card
 * Anchored at bottom-left of the architecture canvas.
 */
const NodeInspector: React.FC<NodeInspectorProps> = ({
  node,
  registry,
  zoneColor = "#0969da",
  onClose,
  onFocusNode,
  onHighlightGroup,
  onOpenCopilot,
  isNeighborhoodFocused = false,
  onToggleNeighborhoodFocus,
}) => {
  const [copied, setCopied] = React.useState(false);
  const outgoing = registry.outgoing(node.id);
  const incoming = registry.incoming(node.id);

  const handleCopyPath = () => {
    if (node.filePath && typeof navigator !== "undefined") {
      navigator.clipboard.writeText(node.filePath);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleHighlightIncoming = () => {
    if (onHighlightGroup && incoming.length > 0) {
      onHighlightGroup(incoming.map((e) => e.source));
    }
  };

  const handleHighlightOutgoing = () => {
    if (onHighlightGroup && outgoing.length > 0) {
      onHighlightGroup(outgoing.map((e) => e.target));
    }
  };

  return (
    <div className="absolute bottom-4 left-4 z-20 w-[350px] max-w-sm bg-white border border-[#d0d7de] rounded-xl shadow-lg p-3.5 text-xs animate-in fade-in slide-in-from-bottom-2 select-text">
      {/* 1. Header: Zone Badge + Monospace filePath + Close Button */}
      <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-[#d0d7de]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-1.5 mb-1">
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
              style={{
                backgroundColor: `${zoneColor}15`,
                borderColor: `${zoneColor}40`,
                color: zoneColor,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: zoneColor }} />
              {node.zone || "Module"}
            </span>
            <span className="font-semibold text-[#1f2328] text-xs truncate">{node.label}</span>
          </div>

          <div className="flex items-center space-x-1 group">
            <FileCode2 className="w-3.5 h-3.5 text-[#656d76] shrink-0" />
            <span
              className="font-mono text-[11px] text-[#57606a] truncate"
              title={node.filePath || node.label}
            >
              {node.filePath || node.label}
            </span>
            {node.filePath && (
              <button
                type="button"
                onClick={handleCopyPath}
                title="Copy file path"
                className="opacity-0 group-hover:opacity-100 p-0.5 text-[#656d76] hover:text-[#1f2328] transition-opacity cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-[#1a7f37]" /> : <Copy className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Close Inspector"
          className="p-1 rounded-md text-[#656d76] hover:text-[#1f2328] hover:bg-[#f6f8fa] transition-colors cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Summary: Clear 2-3 sentence AI architectural explanation */}
      <p className="text-[#24292f] text-[11.5px] leading-relaxed mb-3">
        {node.summary || "Structural AST module parsed from repository tree."}
      </p>

      {/* 3. Dependency Metrics Pill Bar: Incoming & Outgoing */}
      <div className="flex items-center gap-1.5 mb-3">
        <button
          type="button"
          onClick={handleHighlightIncoming}
          disabled={incoming.length === 0}
          title={`Highlight ${incoming.length} dependent caller modules`}
          className="flex-1 flex items-center justify-center space-x-1 px-2 py-1 rounded-lg bg-[#fff8c5] hover:bg-[#fff0a8] border border-[#d0d7de] text-[#7d4e00] font-mono text-[10.5px] transition-colors disabled:opacity-50 disabled:hover:bg-[#fff8c5] cursor-pointer"
        >
          <ArrowDownLeft className="w-3 h-3 text-[#bf8700]" />
          <span>{incoming.length} Incoming</span>
        </button>

        <button
          type="button"
          onClick={handleHighlightOutgoing}
          disabled={outgoing.length === 0}
          title={`Highlight ${outgoing.length} imported dependency modules`}
          className="flex-1 flex items-center justify-center space-x-1 px-2 py-1 rounded-lg bg-[#ddf4ff] hover:bg-[#cbeaff] border border-[#d0d7de] text-[#0969da] font-mono text-[10.5px] transition-colors disabled:opacity-50 disabled:hover:bg-[#ddf4ff] cursor-pointer"
        >
          <ArrowUpRight className="w-3 h-3 text-[#0969da]" />
          <span>{outgoing.length} Outgoing</span>
        </button>
      </div>

      {/* Focus Neighborhood (1-Hop) Toggle Pill */}
      {onToggleNeighborhoodFocus && (
        <button
          type="button"
          onClick={onToggleNeighborhoodFocus}
          className={`w-full mb-2 flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
            isNeighborhoodFocused
              ? "bg-[#ddf4ff] border-[#0969da] text-[#0969da] font-semibold"
              : "bg-[#f6f8fa] hover:bg-[#eaeef2] border-[#d0d7de] text-[#1f2328] font-medium"
          }`}
        >
          <Focus className="w-3.5 h-3.5 shrink-0" />
          <span>
            {isNeighborhoodFocused
              ? "✓ Focusing 1-Hop Neighborhood (Click to Show All)"
              : "Focus Neighborhood (1-Hop)"}
          </span>
        </button>
      )}

      {/* 4. Primary CTA Button: GitHub-styled "Ask Copilot about this file" */}
      <button
        type="button"
        onClick={onOpenCopilot}
        className="w-full flex items-center justify-center space-x-2 px-3 py-1.5 rounded-lg bg-[#1f2328] hover:bg-[#24292f] active:bg-[#0f1114] text-white text-xs font-medium transition-all shadow-xs cursor-pointer"
      >
        <MessageSquareCode className="w-3.5 h-3.5 text-[#79c0ff]" />
        <span>Ask Copilot about this file →</span>
      </button>
    </div>
  );
};

export default NodeInspector;
