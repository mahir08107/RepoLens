import express, { Request, Response } from 'express';
import { ArchitectureMap, FileSkeleton, MapEdge, MapNode, RepoSkeleton, ZoneCategory } from '../../../shared/types.js';
import { getCachedMap, saveCachedMap } from '../db/firestoreCache.js';
import { labelModulesWithGemma } from '../ai/gemmaLabeler.js';
import { buildArchitectureMap } from '../ai/geminiArchitect.js';

export const mapRouter = express.Router();

/**
 * Heuristic zone inference from file path for non-AST / small repos or model fallbacks.
 */
function inferZoneFromPath(filePath: string): ZoneCategory {
  const lower = filePath.toLowerCase();
  if (
    lower.includes('auth') ||
    lower.includes('login') ||
    lower.includes('token') ||
    lower.includes('session') ||
    lower.includes('security') ||
    lower.includes('oauth') ||
    lower.includes('jwt')
  ) {
    return 'Auth';
  }
  if (
    lower.includes('db') ||
    lower.includes('database') ||
    lower.includes('sql') ||
    lower.includes('model') ||
    lower.includes('schema') ||
    lower.includes('entity') ||
    lower.includes('repository') ||
    lower.includes('migration') ||
    lower.includes('prisma')
  ) {
    return 'Database';
  }
  if (
    lower.includes('pay') ||
    lower.includes('billing') ||
    lower.includes('stripe') ||
    lower.includes('invoice') ||
    lower.includes('checkout') ||
    lower.includes('pricing') ||
    lower.includes('cart')
  ) {
    return 'Payments';
  }
  if (
    lower.includes('ui') ||
    lower.includes('view') ||
    lower.includes('page') ||
    lower.includes('component') ||
    lower.includes('screen') ||
    lower.includes('layout') ||
    lower.includes('frontend') ||
    lower.includes('client') ||
    lower.includes('controller') ||
    lower.includes('route') ||
    lower.endsWith('.html') ||
    lower.endsWith('.css') ||
    lower.endsWith('.jsx') ||
    lower.endsWith('.tsx') ||
    lower.endsWith('.xaml') ||
    lower.endsWith('.xml')
  ) {
    return 'Interface';
  }
  return 'Services';
}

/**
 * Deterministically constructs a valid ArchitectureMap grouped by top-level folders / file types.
 * Guaranteed to return valid nodes and edges even if Tree-sitter extracts 0 AST functions or Gemini fails.
 */
export function buildDeterministicArchitectureMap(skeleton: RepoSkeleton): ArchitectureMap {
  const files =
    skeleton.files && skeleton.files.length > 0
      ? skeleton.files
      : [{ filePath: 'main', imports: [], exports: [], functionSignatures: [] }];

  const nodes: MapNode[] = files.slice(0, 30).map((file, idx) => {
    const fileName = file.filePath.split('/').pop() || `module-${idx}`;
    const baseName = fileName.replace(/\.[^/.]+$/, '') || fileName;
    const zone = inferZoneFromPath(file.filePath);
    return {
      id: `node-${idx}`,
      label: baseName,
      filePath: file.filePath,
      zone,
      summary: `Repository component ${baseName} (${file.filePath}).`,
    };
  });

  const edges: MapEdge[] = [];
  let edgeIdx = 0;

  // 1. Try matching imports to node filenames
  for (const sourceNode of nodes) {
    const srcFile = files.find((f) => f.filePath === sourceNode.filePath);
    if (!srcFile || !Array.isArray(srcFile.imports)) continue;

    for (const targetNode of nodes) {
      if (sourceNode.id === targetNode.id) continue;
      const targetBase = targetNode.filePath.split('/').pop()?.replace(/\.[^/.]+$/, '');
      if (targetBase && srcFile.imports.some((imp) => imp.includes(targetBase))) {
        edges.push({
          id: `edge-${edgeIdx++}`,
          source: sourceNode.id,
          target: targetNode.id,
          relation: `imports ${targetNode.label}`,
        });
      }
    }
  }

  // 2. If 0 edges were inferred from imports, establish natural layered flow (Interface -> Services -> Database)
  if (edges.length === 0 && nodes.length > 1) {
    const interfaceNodes = nodes.filter((n) => n.zone === 'Interface');
    const serviceNodes = nodes.filter((n) => n.zone === 'Services');
    const dbNodes = nodes.filter((n) => n.zone === 'Database');

    for (const iface of interfaceNodes) {
      for (const srv of serviceNodes.slice(0, 2)) {
        edges.push({
          id: `edge-${edgeIdx++}`,
          source: iface.id,
          target: srv.id,
          relation: 'invokes business logic',
        });
      }
    }

    for (const srv of serviceNodes) {
      for (const db of dbNodes.slice(0, 2)) {
        edges.push({
          id: `edge-${edgeIdx++}`,
          source: srv.id,
          target: db.id,
          relation: 'queries database schema',
        });
      }
    }

    // Sequential connection if still 0 edges
    if (edges.length === 0) {
      for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({
          id: `edge-${edgeIdx++}`,
          source: nodes[i].id,
          target: nodes[i + 1].id,
          relation: 'connects to',
        });
      }
    }
  }

  return {
    repoUrl: skeleton.repoUrl,
    commitSha: skeleton.commitSha,
    nodes,
    edges,
  };
}

/**
 * POST /api/generate-map and POST /api/diagram
 * Generates or retrieves an ArchitectureMap for a RepoSkeleton.
 * Defensively accepts:
 * 1. { repoUrl, commitSha, skeleton: { files, ... } }
 * 2. { repoUrl, commitSha, files: [...] } (direct RepoSkeleton or string array)
 * 3. { fileTree: [...] }
 * 4. { skeleton: RepoSkeleton }
 */
mapRouter.post(['/generate-map', '/diagram'], async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Missing or invalid request body' });
      return;
    }

    // Defensive parsing of input format
    const candidateSkeleton: RepoSkeleton = body.skeleton || body;
    const repoUrl = body.repoUrl || candidateSkeleton.repoUrl || 'https://github.com/unknown/repo';
    const commitSha = body.commitSha || candidateSkeleton.commitSha || 'latest';

    // Accept files, fileTree, or empty array (e.g. C#, Java, Go, non-AST repositories)
    let rawFiles = candidateSkeleton.files || body.files || body.fileTree || [];
    if (!Array.isArray(rawFiles) && typeof rawFiles === 'object') {
      rawFiles = Object.keys(rawFiles).map((p) => ({ filePath: p, imports: [], exports: [], functionSignatures: [] }));
    }

    // Normalize each file into a clean FileSkeleton structure
    let files: FileSkeleton[] = (Array.isArray(rawFiles) ? rawFiles : []).map((f: any, idx: number) => {
      if (typeof f === 'string') {
        return { filePath: f, imports: [], exports: [], functionSignatures: [] };
      }
      return {
        filePath: f.filePath || f.path || `file-${idx}`,
        imports: Array.isArray(f.imports) ? f.imports : [],
        exports: Array.isArray(f.exports) ? f.exports : [],
        functionSignatures: Array.isArray(f.functionSignatures) ? f.functionSignatures : [],
      };
    });

    // If client sent 0 files (e.g. client AST timeout or network glitch), attempt direct server-side tree fetch
    if (files.length === 0 && repoUrl && repoUrl.includes('github.com')) {
      try {
        const cleanUrl = repoUrl.trim().replace(/\.git$/, '');
        const parsedUrl = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`);
        const segments = parsedUrl.pathname.split('/').filter(Boolean);
        if (segments.length >= 2) {
          const owner = segments[0];
          const repo = segments[1];
          const ghHeaders: Record<string, string> = {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'RepoLens-Backend',
          };
          if (process.env.GITHUB_TOKEN) {
            ghHeaders['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
          }

          let targetSha = commitSha;
          if (!targetSha || targetSha === 'latest' || targetSha === 'unknown') {
            const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/HEAD`, {
              headers: ghHeaders,
            });
            if (commitRes.ok) {
              const cData: any = await commitRes.json().catch(() => null);
              if (cData?.sha) targetSha = cData.sha;
            }
          }

          if (targetSha && targetSha !== 'latest' && targetSha !== 'unknown') {
            const treeRes = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/git/trees/${targetSha}?recursive=1`,
              { headers: ghHeaders }
            );
            if (treeRes.ok) {
              const tData: any = await treeRes.json().catch(() => null);
              if (Array.isArray(tData?.tree)) {
                for (const item of tData.tree) {
                  if (item.type === 'blob' && typeof item.path === 'string') {
                    const lower = item.path.toLowerCase();
                    const excluded = ['node_modules/', '.git/', 'dist/', 'build/'].some((s) => lower.includes(s));
                    if (!excluded) {
                      files.push({
                        filePath: item.path,
                        imports: [],
                        exports: [],
                        functionSignatures: [],
                      });
                      if (files.length >= 35) break;
                    }
                  }
                }
              }
            }
          }
        }
      } catch (ghFetchErr: any) {
        console.warn('[mapRoute] Server GitHub tree fallback notice:', ghFetchErr?.message);
      }
    }

    const skeleton: RepoSkeleton = {
      repoUrl,
      commitSha,
      files,
    };

    // Step 1: Check cache by commitSha
    if (commitSha && commitSha !== 'latest' && commitSha !== 'unknown') {
      try {
        const cachedMap = await getCachedMap(commitSha);
        if (cachedMap && Array.isArray(cachedMap.nodes) && cachedMap.nodes.length > 0) {
          console.log(`[mapRoute] Cache hit for commitSha: ${commitSha}`);
          res.status(200).json({
            ...cachedMap,
            architectureMap: cachedMap,
            cached: true,
          });
          return;
        }
      } catch (cacheErr) {
        console.warn(`[mapRoute] Cache read notice:`, cacheErr);
      }
    }

    console.log(`[mapRoute] Analyzing architecture for ${repoUrl} (${skeleton.files.length} files)...`);

    // Step 2: Try AI-based classification and edge inference
    let architectureMap: ArchitectureMap | null = null;
    if (skeleton.files.length > 0) {
      try {
        const labeledModules = await labelModulesWithGemma(skeleton.files);
        if (labeledModules && labeledModules.length > 0) {
          architectureMap = await buildArchitectureMap(skeleton, labeledModules);
        }
      } catch (aiErr: any) {
        console.warn('[mapRoute] AI analysis pipeline notice:', aiErr?.message);
      }
    }

    // Step 3: Deterministic fallback if AI produced null, empty, or failed
    if (!architectureMap || !Array.isArray(architectureMap.nodes) || architectureMap.nodes.length === 0) {
      console.log('[mapRoute] Generating deterministic file-tree architecture map fallback...');
      architectureMap = buildDeterministicArchitectureMap(skeleton);
    }

    // Step 4: Save result to cache (Firestore / in-memory fallback)
    if (commitSha && commitSha !== 'latest') {
      try {
        await saveCachedMap(commitSha, architectureMap);
      } catch (saveErr) {
        console.warn('[mapRoute] Cache save notice:', saveErr);
      }
    }

    // Step 5: Always return complete ArchitectureMap JSON containing both root properties and explicit architectureMap
    res.status(200).json({
      ...architectureMap,
      architectureMap,
      cached: false,
    });
  } catch (error: any) {
    console.error('[mapRoute] Unhandled error during architecture generation:', error);
    // Return a safe deterministic map on unhandled exceptions so the client never crashes
    const fallbackMap = buildDeterministicArchitectureMap({
      repoUrl: 'https://github.com/unknown/repo',
      commitSha: 'latest',
      files: [{ filePath: 'src/main', imports: [], exports: [], functionSignatures: [] }],
    });
    res.status(200).json({
      ...fallbackMap,
      architectureMap: fallbackMap,
      cached: false,
    });
  }
});

export default mapRouter;
