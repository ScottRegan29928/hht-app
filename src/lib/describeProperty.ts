/**
 * Parse a HostAway property description into renderable blocks
 * [scott, 2026-09-15].
 *
 * The descriptions arrive as one long text field that mixes real prose with
 * bulleted lists under headings, and the page rendered all of it as identical
 * grey paragraphs — so "Villa Features:" and its thirteen bullets came out as
 * an undifferentiated wall.
 *
 * Scott pointed at Ketch Court's "Villa Features" and "Sleeping Arrangements",
 * but only 2 of 82 properties use those two headings. 42 have bullet lists and
 * 39 have a heading line, across at least a dozen different names (Highlights,
 * Living Space, Nearby Attractions, Please note…). So this parses the SHAPE —
 * heading line followed by bullets — instead of matching those two names, and
 * the other 40 properties get the same treatment for free.
 */

export type DescBlock =
  | { kind: "prose"; text: string }
  | { kind: "list"; heading: string | null; items: DescItem[] };

/** A bullet, split into label and value when it reads "Bedroom 1: King bed". */
export interface DescItem {
  label: string | null;
  text: string;
}

const BULLET_RE = /^\s*[•▪●\-\*]\s+(.*)$/;
/**
 * A heading line: short, ends in a colon, and carries no sentence punctuation.
 * The length cap and punctuation test keep ordinary prose that happens to end
 * in a colon ("…offers the following:") from being promoted to a heading only
 * when it is genuinely introducing a list — which the caller confirms by
 * checking that bullets follow.
 */
const HEADING_RE = /^\s*([A-Z][^.!?]{1,60}):\s*$/;
/**
 * Sentences also end in a colon before a list ("The villa comfortably sleeps
 * up to 8 guests:"). Those read badly as a section title, so anything longer
 * than this stays prose and the list below it renders untitled.
 */
const HEADING_MAX_WORDS = 7;
/** "Bedroom 1: King bed with ensuite" -> label "Bedroom 1". */
const LABELLED_RE = /^([A-Z][A-Za-z0-9 &'/]{1,28}):\s+(\S.*)$/;

function toItem(raw: string): DescItem {
  const m = LABELLED_RE.exec(raw.trim());
  if (m) return { label: m[1].trim(), text: m[2].trim() };
  return { label: null, text: raw.trim() };
}

export function parseDescription(description: string): DescBlock[] {
  const lines = description.split(/\r?\n/);
  const blocks: DescBlock[] = [];

  // Buffers for the paragraph currently being accumulated. Prose wraps across
  // single newlines in some descriptions, so consecutive non-blank, non-bullet
  // lines join into one paragraph.
  let prose: string[] = [];
  let pendingHeading: string | null = null;

  const flushProse = () => {
    const text = prose.join(" ").trim();
    if (text) blocks.push({ kind: "prose", text });
    prose = [];
  };

  /**
   * A heading only becomes a heading if bullets actually follow it. Otherwise
   * it is prose that happened to end in a colon, and demoting it here keeps
   * the text from vanishing.
   */
  const demotePendingHeading = () => {
    if (pendingHeading !== null) {
      prose.push(`${pendingHeading}:`);
      pendingHeading = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bullet = BULLET_RE.exec(line);

    if (bullet) {
      // Start (or continue) a list. Any prose before it closes off first.
      const heading = pendingHeading;
      pendingHeading = null;
      flushProse();

      const items: DescItem[] = [toItem(bullet[1])];
      let j = i + 1;
      for (; j < lines.length; j++) {
        const next = BULLET_RE.exec(lines[j]);
        if (next) {
          items.push(toItem(next[1]));
          continue;
        }
        // Blank lines inside a list are tolerated; anything else ends it.
        if (lines[j].trim() === "") {
          // Peek past the blank run: if bullets resume, keep the same list.
          let k = j + 1;
          while (k < lines.length && lines[k].trim() === "") k++;
          if (k < lines.length && BULLET_RE.test(lines[k])) {
            j = k - 1;
            continue;
          }
        }
        break;
      }
      blocks.push({ kind: "list", heading, items });
      i = j - 1;
      continue;
    }

    if (line.trim() === "") {
      demotePendingHeading();
      flushProse();
      continue;
    }

    const headingMatch = HEADING_RE.exec(line);
    if (headingMatch) {
      // Hold it until we know whether bullets follow.
      demotePendingHeading();
      flushProse();
      const candidate = headingMatch[1].trim();
      if (candidate.split(/\s+/).length > HEADING_MAX_WORDS) {
        prose.push(`${candidate}:`);
      } else {
        pendingHeading = candidate;
      }
      continue;
    }

    demotePendingHeading();
    prose.push(line.trim());
  }

  demotePendingHeading();
  flushProse();
  return blocks;
}
