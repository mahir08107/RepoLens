// components/MermaidCanvas.tsx
import React, { useEffect, useRef } from "react";
import mermaid from "mermaid";

interface MermaidCanvasProps {
  definition: string; // Mermaid graph definition
  highlightedId?: string | null; // node/subgraph id to highlight
  onNodeSelect: (id: string) => void;
}

/**
 * Renders a Mermaid diagram, adds pan/zoom via simple CSS transforms, and
 * forwards click events on diagram elements to the parent.
 */
const MermaidCanvas: React.FC<MermaidCanvasProps> = ({ definition, highlightedId, onNodeSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const panState = useRef<{ x: number; y: number; scale: number }>({ x: 0, y: 0, scale: 1 });

  // Initialise mermaid only once.
  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });
  }, []);

  // Render mermaid whenever definition changes.
  useEffect(() => {
    if (!definition || !containerRef.current) return;
    const id = `mermaid-${Date.now()}`;
    const render = async () => {
      try {
        const { svg } = await mermaid.render(id, definition);
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          // Store a reference to the generated <svg> for later transforms.
          const el = containerRef.current.querySelector("svg");
          if (el) svgRef.current = el as SVGSVGElement;
        }
        attachClickHandlers();
        applyHighlight();
      } catch (e) {
        console.error("Mermaid render error", e);
        containerRef.current!.innerHTML = `<pre class="text-red-600">Failed to render diagram.</pre>`;
      }
    };
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition]);

  // Highlight selected node/subgraph using a CSS class.
  const applyHighlight = () => {
    if (!svgRef.current) return;
    svgRef.current.querySelectorAll(".highlighted").forEach((el) => el.classList.remove("highlighted"));
    if (highlightedId) {
      const target = svgRef.current.querySelector(`#${CSS.escape(highlightedId)}`);
      if (target) target.classList.add("highlighted");
    }
  };

  // Attach click delegation – Mermaid gives each node an id attribute.
  const attachClickHandlers = () => {
    if (!svgRef.current) return;
    svgRef.current.addEventListener("click", (e) => {
      const target = (e.target as Element).closest("g[id]");
      if (target && target.id) {
        onNodeSelect(target.id);
      }
    });
  };

  // Simple pan/zoom using mouse wheel and drag.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY / 500; // adjust zoom speed
      const newScale = Math.min(Math.max(panState.current.scale + delta, 0.2), 4);
      panState.current.scale = newScale;
      updateTransform();
    };
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const initX = panState.current.x;
      const initY = panState.current.y;
      const onMove = (move: MouseEvent) => {
        panState.current.x = initX + move.clientX - startX;
        panState.current.y = initY + move.clientY - startY;
        updateTransform();
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };
    const updateTransform = () => {
      const { x, y, scale } = panState.current;
      svg.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    };
    svg.addEventListener("wheel", handleWheel, { passive: false });
    svg.addEventListener("mousedown", handleMouseDown);
    return () => {
      svg.removeEventListener("wheel", handleWheel);
      svg.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  // Apply highlight when prop changes.
  useEffect(() => {
    applyHighlight();
  }, [highlightedId]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-white">
      <div ref={containerRef} className="p-4" />
      {/* Controls overlay */}
      <div className="absolute top-2 right-2 flex space-x-2">
        <button
          onClick={() => {
            if (svgRef.current) {
              panState.current = { x: 0, y: 0, scale: 1 };
              svgRef.current.style.transform = "";
            }
          }}
          className="bg-gray-200 hover:bg-gray-300 rounded px-2 py-1 text-sm"
        >
          Reset view
        </button>
        <button
          onClick={() => {
            if (svgRef.current) {
              const svg = svgRef.current.outerHTML;
              const blob = new Blob([svg], { type: "image/svg+xml" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "architecture.svg";
              a.click();
              URL.revokeObjectURL(url);
            }
          }}
          className="bg-gray-200 hover:bg-gray-300 rounded px-2 py-1 text-sm"
        >
          Export SVG
        </button>
      </div>
      <style jsx>{`
        .highlighted {
          stroke: #F59E0B !important;
          stroke-width: 3px !important;
        }
      `}</style>
    </div>
  );
};

export default MermaidCanvas;
