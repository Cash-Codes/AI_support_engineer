export interface DocChunk {
  docTitle: string;
  heading: string;
  text: string;
}

/**
 * Splits a markdown document into heading-scoped chunks. Each chunk owns
 * everything between its heading and the next heading of equal-or-higher
 * level. The first chunk (before the first heading) is dropped if empty.
 *
 * Chunks that exceed `softCharLimit` are split further at paragraph
 * boundaries so a single massive heading doesn't produce one giant chunk.
 */
export function chunkMarkdown(
  source: string,
  opts: { docTitle: string; softCharLimit?: number } = { docTitle: "untitled" },
): DocChunk[] {
  const softCharLimit = opts.softCharLimit ?? 1600;
  const lines = source.split("\n");

  type Section = { heading: string; bodyLines: string[] };
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const line of lines) {
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (m) {
      const heading = m[2].trim();
      current = { heading, bodyLines: [] };
      sections.push(current);
    } else if (current) {
      current.bodyLines.push(line);
    }
  }

  const chunks: DocChunk[] = [];
  for (const s of sections) {
    const body = s.bodyLines.join("\n").trim();
    if (body.length === 0) continue;
    if (body.length <= softCharLimit) {
      chunks.push({
        docTitle: opts.docTitle,
        heading: s.heading,
        text: `${s.heading}\n\n${body}`,
      });
      continue;
    }
    // Split by double-newline paragraph groups, greedily packing up to limit.
    const paragraphs = body.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    let buf = "";
    for (const p of paragraphs) {
      if (buf.length + p.length + 2 > softCharLimit && buf.length > 0) {
        chunks.push({
          docTitle: opts.docTitle,
          heading: s.heading,
          text: `${s.heading}\n\n${buf.trim()}`,
        });
        buf = p;
      } else {
        buf = buf.length === 0 ? p : `${buf}\n\n${p}`;
      }
    }
    if (buf.length > 0) {
      chunks.push({
        docTitle: opts.docTitle,
        heading: s.heading,
        text: `${s.heading}\n\n${buf.trim()}`,
      });
    }
  }
  return chunks;
}
