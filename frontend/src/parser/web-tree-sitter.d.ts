declare module 'web-tree-sitter' {
  namespace TreeSitter {
    class Parser {
      setLanguage(language: any): void;
      parse(input: string): any;
    }
    class Language {
      static load(input: string | Uint8Array): Promise<Language>;
    }
    function init(options?: any): Promise<void>;
  }
  const TreeSitter: {
    init(options?: any): Promise<void>;
    Parser: typeof TreeSitter.Parser;
    Language: typeof TreeSitter.Language;
  };
  export = TreeSitter;
}
