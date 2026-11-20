/**
 * wasmLoader.ts – Initializes web-tree-sitter and loads the required language
 * grammars (WASM binaries) from the public/wasm directory.
 *
 * The function returns a map of language extension -> TreeSitter.Language
 * which can be reused by the skeleton extractor.
 */

import * as TreeSitter from "web-tree-sitter";

// Mapping of file extensions to the corresponding grammar WASM URL (served from public/wasm)
const GRAMMAR_URLS: Record<string, string> = {
  ts: "/wasm/tree-sitter-typescript.wasm",
  tsx: "/wasm/tree-sitter-tsx.wasm",
  js: "/wasm/tree-sitter-javascript.wasm",
  jsx: "/wasm/tree-sitter-jsx.wasm",
  py: "/wasm/tree-sitter-python.wasm",
  go: "/wasm/tree-sitter-go.wasm",
  java: "/wasm/tree-sitter-java.wasm",
};

/**
 * Load all language grammars that are needed for the supported extensions.
 * Returns a map where the key is the file extension (without the dot) and the
 * value is the loaded TreeSitter.Language object.
 */
export async function loadLanguages(): Promise<Record<string, TreeSitter.Language>> {
  await TreeSitter.init();
  const languages: Record<string, TreeSitter.Language> = {};
  for (const [ext, url] of Object.entries(GRAMMAR_URLS)) {
    try {
      const language = await TreeSitter.Language.load(url);
      languages[ext] = language;
    } catch (e) {
      console.warn(`Failed to load TreeSitter grammar for .${ext} from ${url}:`, e);
    }
  }
  return languages;
}

export type LanguageMap = ReturnType<typeof loadLanguages>;
