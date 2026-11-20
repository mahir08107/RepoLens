// lib/ast-parser.ts
/**
 * Client‑side AST parser using web‑tree‑sitter. It runs in a Web Worker to avoid
 * blocking the UI. The parser extracts a lightweight structural skeleton from a
 * set of source files: file path, imports, exports, classes, function signatures
 * and the resulting dependency edges.
 *
 * **Privacy‑by‑Design** – only this structural metadata is ever sent to the
 * backend; the raw source code remains in the browser.
 */

export interface FileSkeleton {
  path: string;
  imports: string[]; // relative paths imported by this file
  exports: string[]; // exported identifiers
  classes: string[]; // class names defined in the file
  functions: string[]; // function signatures (name + params)
}

export interface RepoSkeleton {
  repoUrl: string;
  commitSha: string;
  files: FileSkeleton[];
  edges: { from: string; to: string }[]; // dependency edges (import source -> current file)
}

// The worker script (src/lib/ast-worker.ts) loads tree‑sitter and language
// grammars, parses each file and returns the skeleton.

export async function parseFiles(
  repoUrl: string,
  commitSha: string,
  fileMap: Record<string, string>
): Promise<RepoSkeleton> {
  // Dynamically import the worker – this works in Next.js because the worker
  // file is compiled to a separate bundle.
  const WorkerCtor = (await import("./ast-worker"))
    .default as typeof Worker;
  const worker = new WorkerCtor(new URL("./ast-worker.ts", import.meta.url), {
    type: "module",
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("AST parsing timed out"));
    }, 30_000);

    worker.onmessage = (e: MessageEvent) => {
      clearTimeout(timeout);
      const data = e.data as RepoSkeleton;
      resolve(data);
    };
    worker.onerror = (err) => {
      clearTimeout(timeout);
      reject(err);
    };
    worker.postMessage({ repoUrl, commitSha, fileMap });
  });
}
