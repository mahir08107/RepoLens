'use client';
import React from "react";

/**
 * Lightweight, XSS-safe Markdown renderer for Copilot answers.
 * Supports paragraphs, **bold**, *italic*, `inline code`, bullet / numbered lists,
 * headings and fenced code blocks — all rendered as React elements (no innerHTML).
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let i = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;
    if (token.startsWith("**")) {
      out.push(
        <strong key={key} className="font-semibold text-slate-900">
          {renderInline(token.slice(2, -2), key)}
        </strong>
      );
    } else if (token.startsWith("`")) {
      out.push(
        <code
          key={key}
          className="px-1 py-0.5 rounded bg-slate-100 text-indigo-700 font-mono text-[11px] border border-slate-200/70 break-all"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else {
      out.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BULLET = /^\s*[-*•]\s+/;
const ORDERED = /^\s*\d+[.)]\s+/;
const HEADING = /^\s*#{1,6}\s+/;
const FENCE = /^\s*```/;

const MarkdownMessage: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let k = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (FENCE.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) buf.push(lines[i++]);
      i++;
      blocks.push(
        <pre
          key={k++}
          className="bg-slate-900 text-slate-100 rounded-lg p-2.5 text-[11px] font-mono overflow-x-auto"
        >
          {buf.join("\n")}
        </pre>
      );
      continue;
    }

    if (BULLET.test(line) || ORDERED.test(line)) {
      const ordered = ORDERED.test(line);
      const pattern = ordered ? ORDERED : BULLET;
      const items: string[] = [];
      while (i < lines.length && pattern.test(lines[i])) items.push(lines[i++].replace(pattern, ""));
      const listKey = k++;
      const children = items.map((item, j) => <li key={j}>{renderInline(item, `${listKey}-${j}`)}</li>);
      blocks.push(
        ordered ? (
          <ol key={listKey} className="list-decimal pl-4 space-y-0.5">{children}</ol>
        ) : (
          <ul key={listKey} className="list-disc pl-4 space-y-0.5">{children}</ul>
        )
      );
      continue;
    }

    if (HEADING.test(line)) {
      const key = k++;
      blocks.push(
        <p key={key} className="font-semibold text-slate-900">
          {renderInline(line.replace(HEADING, ""), `${key}`)}
        </p>
      );
      i++;
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !FENCE.test(lines[i]) &&
      !BULLET.test(lines[i]) &&
      !ORDERED.test(lines[i]) &&
      !HEADING.test(lines[i])
    ) {
      para.push(lines[i++]);
    }
    const key = k++;
    blocks.push(
      <p key={key}>
        {para.map((p, j) => (
          <React.Fragment key={j}>
            {j > 0 && <br />}
            {renderInline(p, `${key}-${j}`)}
          </React.Fragment>
        ))}
      </p>
    );
  }

  return <div className="space-y-1.5 break-words">{blocks}</div>;
};

export default MarkdownMessage;

