'use client';
import React, { useEffect, useRef, useState, useCallback } from "react";
import mermaid from "mermaid";
import { ZoomIn, ZoomOut, RotateCcw, Download, Maximize2, MousePointerClick } from "lucide-react";

interface MermaidCanvasProps {
  definition: string;
  highlightedIds?: string[];
  selectedId?: string | null;
  onNodeSelect: (id: string) => void;
}

const MermaidCanvas: React.FC<MermaidCanvasProps> = ({
  definition,
  highlightedIds = [],
  selectedId = null,
  onNodeSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Initialize mermaid configuration
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'loose',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      flowchart: {
        curve: 'basis',
        useMaxWidth: false,
        htmlLabels: true,
      },
    });
  }, []);

  // Render diagram whenever definition changes
  useEffect(() => {
    if (!definition || !containerRef.current) return;
    let isCancelled = false;

    const render = async () => {
      setIsRendering(true);
      setRenderError(null);
      const uniqueId = `mermaid-canvas-${Date.now()}`;
      try {
        const { svg } = await mermaid.render(uniqueId, definition);
        if (!isCancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          attachHandlers();
          applyHighlights();
        }
      } catch (err: any) {
        console.error("Mermaid Render Error:", err);
        if (!isCancelled) {
          setRenderError(err?.message || "Syntax error parsing architecture diagram.");
        }
      } finally {
        if (!isCancelled) setIsRendering(false);
      }
    };

    render();

    return () => {
      isCancelled = true;
    };
  }, [definition]);

  // Apply highlight styles to selected and referenced nodes
  const applyHighlights = useCallback(() => {
    if (!containerRef.current) return;
    const svg = containerRef.current.querySelector('svg');
    if (!svg) return;

    // Reset previous highlights
    svg.querySelectorAll('.highlighted-node').forEach((el) => el.classList.remove('highlighted-node'));
    svg.querySelectorAll('.active-selected').forEach((el) => {
      el.classList.remove('active-selected');
      (el as HTMLElement).style.filter = '';
    });

    const targetIds = new Set<string>();
    if (selectedId) targetIds.add(selectedId);
    highlightedIds.forEach((id) => targetIds.add(id));

    targetIds.forEach((id) => {
      // Search nodes matching id or partial id
      const matches = svg.querySelectorAll(`[id*="${id}"], [id*="${id}"] rect, [id*="${id}"] circle, [id*="${id}"] polygon`);
      matches.forEach((node) => {
        const g = node.closest('g.node') || node;
        g.classList.add('highlighted-node');
        (g as HTMLElement).style.filter = 'drop-shadow(0 0 10px rgba(245, 158, 11, 0.9))';
      });
    });
  }, [selectedId, highlightedIds]);

  useEffect(() => {
    applyHighlights();
  }, [applyHighlights]);

  // Attach click listeners to diagram nodes
  const attachHandlers = () => {
    if (!containerRef.current) return;
    const svg = containerRef.current.querySelector('svg');
    if (!svg) return;

    const nodes = svg.querySelectorAll('g.node, g.cluster');
    nodes.forEach((node) => {
      (node as HTMLElement).style.cursor = 'pointer';
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = node.id || node.getAttribute('id') || '';
        const cleanId = id.replace(/^flowchart-/, '').split('-')[0];
        if (cleanId) {
          onNodeSelect(cleanId);
        }
      });
    });
  };

  // Zoom and Pan Handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setScale((prev) => Math.min(Math.max(prev * zoomFactor, 0.3), 3.5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const exportSvg = () => {
    if (!containerRef.current) return;
    const svg = containerRef.current.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repolens-architecture-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      ref={wrapperRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`relative w-full h-full min-h-[550px] bg-slate-50/50 rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Canvas Grid Background pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Floating Toolbar Controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center bg-white/90 backdrop-blur-md border border-slate-200 rounded-xl shadow-sm p-1 space-x-1">
        <button
          onClick={() => setScale((s) => Math.min(s * 1.2, 3.5))}
          title="Zoom In"
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setScale((s) => Math.max(s * 0.8, 0.3))}
          title="Zoom Out"
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-4 bg-slate-200 mx-0.5" />
        <button
          onClick={resetView}
          title="Reset View"
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={exportSvg}
          title="Export as Vector SVG"
          className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export SVG</span>
        </button>
      </div>

      {/* Hint Badge */}
      <div className="absolute bottom-4 left-4 z-20 hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-xl text-[11px] text-slate-500 shadow-2xs pointer-events-none">
        <MousePointerClick className="w-3.5 h-3.5 text-indigo-500" />
        <span>Click any node to inspect & ask copilot • Drag to pan • Scroll to zoom</span>
      </div>

      {/* Zoom scale indicator */}
      <div className="absolute bottom-4 right-4 z-20 px-2 py-1 bg-white/80 backdrop-blur-xs border border-slate-200 rounded-md text-[10px] font-mono text-slate-500 pointer-events-none">
        {Math.round(scale * 100)}%
      </div>

      {/* Render Error Alert */}
      {renderError && (
        <div className="absolute inset-4 z-30 flex items-center justify-center p-6">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl max-w-md text-xs">
            <h4 className="font-semibold mb-1">Failed to Render Diagram</h4>
            <p className="font-mono">{renderError}</p>
          </div>
        </div>
      )}

      {/* Transforming Diagram Container */}
      <div
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.15s ease-out',
        }}
        className="mermaid-wrapper p-8"
        ref={containerRef}
      />
    </div>
  );
};

export default MermaidCanvas;
