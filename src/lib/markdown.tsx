import React from "react";

// ── Minimal markdown renderer ──
//
// Deliberately dependency-free and, more importantly, it renders to React
// elements rather than an HTML string. There is no dangerouslySetInnerHTML
// anywhere in this file, so admin-authored content cannot inject script or
// event handlers into the page and no sanitizer is needed.
//
// Supported: ATX headings, paragraphs, unordered/ordered lists, blockquotes,
// horizontal rules, fenced code blocks, images, and inline bold, italic,
// inline code and links. Anything else renders as literal text, which is the
// safe failure mode for a content editor.

type Inline = string | React.ReactElement;

/** Only http(s), mailto, tel and site-relative links are allowed through. */
function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^(https?:|mailto:|tel:)/i.test(h)) return h;
  if (h.startsWith("/") || h.startsWith("#")) return h;
  // Blocks javascript:, data: and any other scheme.
  return null;
}

/**
 * Parse inline markers within one block of text.
 *
 * Handled in precedence order: inline code first (its contents are literal),
 * then images, links, bold and italic.
 */
function parseInline(text: string, keyPrefix: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  let k = 0;

  const PATTERN =
    /(`[^`]+`)|(!\[([^\]]*)\]\(([^)\s]+)\))|(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(__([^_]+)__)|(_([^_]+)_)/;

  while (rest.length > 0) {
    const m = PATTERN.exec(rest);
    if (!m || m.index === undefined) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const key = `${keyPrefix}-i${k++}`;

    if (m[1]) {
      out.push(
        <code
          key={key}
          className="px-1.5 py-0.5 rounded bg-muted text-[0.9em] font-mono"
        >
          {m[1].slice(1, -1)}
        </code>
      );
    } else if (m[2]) {
      const src = safeHref(m[4]);
      if (src) {
        out.push(
          <img
            key={key}
            src={src}
            alt={m[3] ?? ""}
            loading="lazy"
            className="rounded-lg my-4 max-w-full h-auto"
          />
        );
      } else {
        out.push(m[3] ?? "");
      }
    } else if (m[5]) {
      const href = safeHref(m[7]);
      const label = m[6];
      if (href) {
        const external = /^https?:/i.test(href);
        out.push(
          <a
            key={key}
            href={href}
            className="text-primary underline underline-offset-2 hover:no-underline"
            {...(external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            {label}
          </a>
        );
      } else {
        // Unsafe scheme — keep the words, drop the link.
        out.push(label);
      }
    } else if (m[8]) {
      out.push(<strong key={key}>{m[9]}</strong>);
    } else if (m[10]) {
      out.push(<em key={key}>{m[11]}</em>);
    } else if (m[12]) {
      out.push(<strong key={key}>{m[13]}</strong>);
    } else if (m[14]) {
      out.push(<em key={key}>{m[15]}</em>);
    }

    rest = rest.slice(m.index + m[0].length);
  }

  return out;
}

const HEADING_CLASS: Record<number, string> = {
  1: "text-3xl md:text-4xl font-bold mt-8 mb-4 tracking-tight",
  2: "text-2xl md:text-3xl font-bold mt-8 mb-3 tracking-tight",
  3: "text-xl md:text-2xl font-semibold mt-6 mb-2",
  4: "text-lg font-semibold mt-5 mb-2",
  5: "text-base font-semibold mt-4 mb-1",
  6: "text-sm font-semibold uppercase tracking-wide mt-4 mb-1",
};

export function renderMarkdown(source: string): React.ReactElement[] {
  const lines = (source ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactElement[] = [];
  let i = 0;
  let b = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced code block
    if (/^```/.test(line.trim())) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        buf.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push(
        <pre
          key={`b${b++}`}
          className="my-4 p-4 rounded-lg bg-muted overflow-x-auto text-sm font-mono"
        >
          <code>{buf.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Horizontal rule
    if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
      blocks.push(<hr key={`b${b++}`} className="my-8 border-border" />);
      i++;
      continue;
    }

    // Heading
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const Tag = `h${level}` as "h1";
      blocks.push(
        <Tag key={`b${b++}`} className={HEADING_CLASS[level]}>
          {parseInline(h[2], `b${b}`)}
        </Tag>
      );
      i++;
      continue;
    }

    // Blockquote — consumes consecutive "> " lines
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={`b${b++}`}
          className="my-4 pl-4 border-l-4 border-primary/30 italic text-muted-foreground"
        >
          {parseInline(buf.join(" "), `b${b}`)}
        </blockquote>
      );
      continue;
    }

    // Lists — unordered or ordered
    const isUl = (s: string) => /^\s*[-*+]\s+/.test(s);
    const isOl = (s: string) => /^\s*\d+[.)]\s+/.test(s);
    if (isUl(line) || isOl(line)) {
      const ordered = isOl(line);
      const items: string[] = [];
      while (
        i < lines.length &&
        (ordered ? isOl(lines[i]) : isUl(lines[i]))
      ) {
        items.push(
          lines[i].replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/, "")
        );
        i++;
      }
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag
          key={`b${b++}`}
          className={
            (ordered ? "list-decimal" : "list-disc") +
            " pl-6 my-4 space-y-1.5 text-muted-foreground"
          }
        >
          {items.map((it, n) => (
            <li key={n}>{parseInline(it, `b${b}-${n}`)}</li>
          ))}
        </ListTag>
      );
      continue;
    }

    // Paragraph — consumes until a blank line or the start of another block
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|>|```)/.test(lines[i]) &&
      !isUl(lines[i]) &&
      !isOl(lines[i]) &&
      !/^(\s*[-*_]){3,}\s*$/.test(lines[i])
    ) {
      buf.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p key={`b${b++}`} className="my-4 leading-relaxed text-muted-foreground">
        {parseInline(buf.join(" "), `b${b}`)}
      </p>
    );
  }

  return blocks;
}

/** Renders admin-authored markdown as sanitized React elements. */
export function Markdown({ source }: { source: string }) {
  return <div className="max-w-none">{renderMarkdown(source)}</div>;
}
