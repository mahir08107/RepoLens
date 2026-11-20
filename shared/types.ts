export type ZoneCategory = 'Auth' | 'Database' | 'Payments' | 'Interface' | 'Services';

export interface FileSkeleton {
  filePath: string;
  imports: string[];
  exports: string[];
  functionSignatures: string[]; // Body stripped in browser
}

export interface RepoSkeleton {
  repoUrl: string;
  commitSha: string;
  files: FileSkeleton[];
}

export interface MapNode {
  id: string;
  label: string;
  filePath: string;
  zone: ZoneCategory;
  summary: string;
}

export interface MapEdge {
  id: string;
  source: string;
  target: string;
  relation?: string;
}

export interface ArchitectureMap {
  repoUrl: string;
  commitSha: string;
  nodes: MapNode[];
  edges: MapEdge[];
  mermaidDefinition?: string;
}

export interface ChatRequest {
  commitSha: string;
  selectedNodeId?: string;
  question: string;
  skeleton: RepoSkeleton;
}

export interface ChatResponse {
  answer: string;
  highlightedNodeIds: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Chat {
  conversationId: string;
  repoSkeleton?: RepoSkeleton | null;
  architectureMap?: ArchitectureMap | null;
  messages: ChatMessage[];
  selectedId?: string | null;
}

declare global {
  interface Window {
    __REPO_SKELETON__?: RepoSkeleton;
  }
}
