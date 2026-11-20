import { RepoSkeleton } from '@/shared/types';

export const MOCK_REPO_SKELETON: RepoSkeleton = {
  repoUrl: 'https://github.com/mahir08107/RepoLens',
  commitSha: '60bd394a2026',
  files: [
    {
      filePath: 'app/page.tsx',
      imports: ['@/components/MermaidCanvas', '@/components/ChatSidebar', '@/lib/ast-parser'],
      exports: ['Home'],
      functionSignatures: ['Home(): JSX.Element', 'handleGenerate(url: string): Promise<void>'],
    },
    {
      filePath: 'app/layout.tsx',
      imports: ['globals.css', 'next/font/google'],
      exports: ['metadata', 'RootLayout'],
      functionSignatures: ['RootLayout(props: { children: ReactNode }): JSX.Element'],
    },
    {
      filePath: 'components/MermaidCanvas.tsx',
      imports: ['mermaid', 'lucide-react'],
      exports: ['MermaidCanvas'],
      functionSignatures: ['MermaidCanvas(props: MermaidCanvasProps): JSX.Element', 'exportSvg(): void'],
    },
    {
      filePath: 'components/ChatSidebar.tsx',
      imports: ['@/shared/types', 'lucide-react'],
      exports: ['ChatSidebar'],
      functionSignatures: ['ChatSidebar(props: ChatSidebarProps): JSX.Element', 'handleSend(): Promise<void>'],
    },
    {
      filePath: 'app/api/diagram/route.ts',
      imports: ['@/lib/ast-parser', '@/lib/diagram-generator', '@google/genai'],
      exports: ['POST'],
      functionSignatures: ['POST(request: NextRequest): Promise<NextResponse>'],
    },
    {
      filePath: 'lib/ast-parser.ts',
      imports: ['@/shared/types', './ast-worker'],
      exports: ['parseRepo', 'parseFiles', 'fetchFilteredFileTree'],
      functionSignatures: ['parseRepo(repoUrl: string): Promise<RepoSkeleton>', 'fetchLatestCommitSha(): Promise<string>'],
    },
    {
      filePath: 'lib/diagram-generator.ts',
      imports: ['@/shared/types'],
      exports: ['generateMermaidDiagram'],
      functionSignatures: ['generateMermaidDiagram(skeleton: RepoSkeleton): { mermaidDefinition: string }'],
    },
    {
      filePath: 'backend/src/routes/chatRoute.ts',
      imports: ['express', '@/shared/types'],
      exports: ['chatRouter'],
      functionSignatures: ['POST /api/chat(req: Request, res: Response): Promise<void>'],
    },
    {
      filePath: 'backend/src/routes/mapRoute.ts',
      imports: ['express', '@/shared/types'],
      exports: ['mapRouter'],
      functionSignatures: ['POST /api/generate-map(req: Request, res: Response): Promise<void>'],
    },
    {
      filePath: 'backend/src/ai/gemmaLabeler.ts',
      imports: ['@google/genai', '@/shared/types'],
      exports: ['labelModulesWithGemma'],
      functionSignatures: ['labelModulesWithGemma(files: FileSkeleton[]): Promise<LabeledModule[]>'],
    },
    {
      filePath: 'backend/src/db/firestoreCache.ts',
      imports: ['firebase-admin', '@/shared/types'],
      exports: ['getCachedMap', 'saveCachedMap'],
      functionSignatures: ['getCachedMap(commitSha: string): Promise<ArchitectureMap | null>'],
    },
    {
      filePath: 'shared/types.ts',
      imports: [],
      exports: ['RepoSkeleton', 'ArchitectureMap', 'FileSkeleton', 'Chat'],
      functionSignatures: [],
    },
  ],
};

export const MOCK_MERMAID_DEFINITION = `flowchart LR
  subgraph folder_app ["<b>📁 app/ • Application Shell & Pages</b><br/><small><i>Root views, workspace & TopBar</i></small>"]
    direction TB
    node_app_page["<b>📄 page.tsx</b><br/><small>Main visual workspace, TopBar & controls</small><br/><small>⚡ <code>Home(), handleGenerate()</code></small>"]
    node_app_layout["<b>📄 layout.tsx</b><br/><small>Root HTML layout, typography & metadata</small><br/><small>⚡ <code>RootLayout(), metadata</code></small>"]
    node_app_diagram["<b>🌐 route.ts (diagram)</b><br/><small>Next.js diagram generation API route</small><br/><small>⚡ <code>POST /api/diagram handler</code></small>"]
  end

  subgraph folder_components ["<b>📁 components/ • UI & Visual Canvas</b><br/><small><i>MermaidCanvas & Copilot sidebar</i></small>"]
    direction TB
    node_comp_canvas["<b>🎨 MermaidCanvas.tsx</b><br/><small>Interactive pan, zoom & diagram renderer</small><br/><small>⚡ <code>MermaidCanvas(), applyHighlights()</code></small>"]
    node_comp_chat["<b>💬 ChatSidebar.tsx</b><br/><small>AI architecture copilot chat panel</small><br/><small>⚡ <code>ChatSidebar(), handleSend()</code></small>"]
  end

  subgraph folder_lib ["<b>📁 lib/ • AST Engine & Privacy</b><br/><small><i>Tree-sitter WASM parser & diagram logic</i></small>"]
    direction TB
    node_lib_parser["<b>⚡ ast-parser.ts</b><br/><small>Client AST extraction & body stripper</small><br/><small>⚡ <code>parseRepo(), parseFiles()</code></small>"]
    node_lib_worker["<b>⚙️ ast-worker.ts</b><br/><small>Web Worker background Tree-sitter parser</small><br/><small>⚡ <code>Tree-sitter WASM worker</code></small>"]
    node_lib_diaggen["<b>🗺️ diagram-generator.ts</b><br/><small>Folder-centric architecture & pipeline builder</small><br/><small>⚡ <code>generateMermaidDiagram()</code></small>"]
  end

  subgraph folder_backend ["<b>📁 backend/ • Cloud Run API & AI Engine</b><br/><small><i>Express routes, Gemma 4B & Gemini models</i></small>"]
    direction TB
    node_back_map["<b>🗺️ mapRoute.ts</b><br/><small>Gemma 4B classifier & architecture map</small><br/><small>⚡ <code>POST /api/generate-map handler</code></small>"]
    node_back_chat["<b>💬 chatRoute.ts</b><br/><small>Gemini Flash architecture chat route</small><br/><small>⚡ <code>POST /api/chat handler</code></small>"]
    node_back_gemma["<b>🧠 gemmaLabeler.ts</b><br/><small>Module zone classification with Gemma 4B</small><br/><small>⚡ <code>labelModulesWithGemma()</code></small>"]
    node_back_cache["<b>💾 firestoreCache.ts</b><br/><small>Commit SHA diagram caching layer</small><br/><small>⚡ <code>getCachedMap(), saveCachedMap()</code></small>"]
  end

  subgraph folder_shared ["<b>📁 shared/ • Type Contracts</b><br/><small><i>Cross-cutting data schemas</i></small>"]
    direction TB
    node_shared_types["<b>📋 types.ts</b><br/><small>RepoSkeleton & ArchitectureMap schemas</small><br/><small>⚡ <code>RepoSkeleton, MapNode, MapEdge</code></small>"]
  end

  folder_app ==>|"renders & controls"| folder_components
  folder_app ==>|"client AST parsing"| folder_lib
  folder_app ==>|"Cloud Run REST API"| folder_backend
  folder_backend ==>|"persists state"| node_back_cache
  folder_backend -.->|"type contracts"| folder_shared
  folder_lib -.->|"type contracts"| folder_shared
  folder_app -.->|"type contracts"| folder_shared

  classDef cls_app fill:#F5F3FF,stroke:#8B5CF6,stroke-width:2px,color:#4C1D95;
  classDef cls_comp fill:#EEF2FF,stroke:#6366F1,stroke-width:2px,color:#312E81;
  classDef cls_lib fill:#FFFBEB,stroke:#F59E0B,stroke-width:2px,color:#78350F;
  classDef cls_back fill:#ECFDF5,stroke:#10B981,stroke-width:2px,color:#064E3B;
  classDef cls_shared fill:#F8FAFC,stroke:#64748B,stroke-width:2px,color:#0F172A;

  class node_app_page,node_app_layout,node_app_diagram cls_app;
  class node_comp_canvas,node_comp_chat cls_comp;
  class node_lib_parser,node_lib_worker,node_lib_diaggen cls_lib;
  class node_back_map,node_back_chat,node_back_gemma,node_back_cache cls_back;
  class node_shared_types cls_shared;
`;

export const MOCK_ZONE_COLORS: Record<string, string> = {
  'app/ (Shell & Routes)': '#8B5CF6',
  'components/ (UI & Canvas)': '#6366F1',
  'lib/ (AST Engine)': '#F59E0B',
  'backend/ (Cloud Run AI)': '#10B981',
  'shared/ (Type Contracts)': '#64748B',
};

export const MOCK_INITIAL_CHAT = [
  {
    role: 'assistant' as const,
    content: "👋 Welcome to **RepoLens**! I've loaded the architecture visualization for this repository. You can click on any folder or module card to inspect its role and dependencies, or ask me questions about what is implemented inside each directory.",
    timestamp: new Date().toISOString(),
    highlightedNodeIds: ['node_app_page', 'node_lib_parser', 'node_back_map'],
  },
];
