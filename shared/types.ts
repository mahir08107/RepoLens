// shared/types.ts
/**
 * Types shared between frontend and backend for RepoLens.
 */

/**
 * Represents a stripped source file in a repository.
 * The body of functions has been removed to keep the skeleton lightweight.
 */
export interface FileSkeleton {
  /** Relative path from the repository root */
  path: string;
  /** The file content with function bodies stripped (optional). */
  strippedContent: string;
}

/**
 * RepoSkeleton is a compact representation of a repository used for analysis.
 */
export interface RepoSkeleton {
  /** GitHub repository URL (e.g., https://github.com/user/repo) */
  repoUrl: string;
  /** The commit SHA that the skeleton corresponds to */
  commitSha: string;
  /** List of stripped source files */
  files: FileSkeleton[];
  /** Optional metadata such as repository size (in bytes) */
  sizeBytes?: number;
}

/**
 * A zone groups related modules inside a repository architecture map.
 */
export interface ArchitectureZone {
  /** Human‑readable name of the zone */
  name: string;
  /** Description of the purpose of the zone */
  description?: string;
  /** List of module identifiers that belong to this zone */
  modules: string[];
  /** Colour used for rendering; any CSS colour string */
  colour?: string;
}

/**
 * Represents a directed edge between two modules.
 */
export interface ArchitectureEdge {
  /** Source module identifier */
  from: string;
  /** Destination module identifier */
  to: string;
  /** Optional label (e.g., "calls", "imports") */
  label?: string;
}

/**
 * ArchitectureMap is the result of AI analysis that can be visualised with Mermaid.
 */
export interface ArchitectureMap {
  /** Unique identifier (often the commit SHA) */
  id: string;
  /** Human‑readable title */
  title: string;
  /** Zones that group modules */
  zones: ArchitectureZone[];
  /** Edges describing relationships between modules */
  edges: ArchitectureEdge[];
  /** Mermaid graph definition (graph TD …) */
  mermaidDefinition: string;
}

/**
 * ChatMessage represents a single message in the copilot chat.
 */
export interface ChatMessage {
  /** "user" | "assistant" */
  role: "user" | "assistant";
  /** Message content */
  content: string;
  /** ISO timestamp */
  timestamp: string;
}

/**
 * Chat context that is sent to the backend for Q&A.
 */
export interface Chat {
  /** Identifier of the conversation (e.g., UUID) */
  conversationId: string;
  /** Associated repository skeleton or architecture map */
  repoSkeleton?: RepoSkeleton;
  /** Architecture map that provides context for the assistant */
  architectureMap?: ArchitectureMap;
  /** Message history */
  messages: ChatMessage[];
}
