import { Fragment, type ReactNode } from "react";

/**
 * A deliberately small renderer for the subset the generated document uses:
 * headings, bullet lists, paragraphs and bold. Building React elements rather
 * than injecting HTML means model output can never carry markup into the page.
 */

function inline(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((piece) => piece !== "")
    .map((piece, index) => {
      const key = `${keyPrefix}-${index}`;
      if (piece.startsWith("**") && piece.endsWith("**")) {
        return <strong key={key}>{piece.slice(2, -2)}</strong>;
      }
      return <Fragment key={key}>{piece}</Fragment>;
    });
}

export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  const lines = source.split("\n");
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`ul-${blocks.length}`}>
        {items.map((item, index) => (
          <li key={index}>{inline(item, `li-${blocks.length}-${index}`)}</li>
        ))}
      </ul>,
    );
  };

  lines.forEach((rawLine, lineIndex) => {
    const text = rawLine.trim();
    const key = `b-${lineIndex}`;

    if (!text) {
      flushBullets();
      return;
    }

    if (/^[-*]\s+/.test(text)) {
      bullets.push(text.replace(/^[-*]\s+/, ""));
      return;
    }

    flushBullets();

    if (text.startsWith("#### ")) {
      blocks.push(<h4 key={key}>{inline(text.slice(5), key)}</h4>);
    } else if (text.startsWith("### ")) {
      blocks.push(<h3 key={key}>{inline(text.slice(4), key)}</h3>);
    } else if (text.startsWith("## ")) {
      blocks.push(<h2 key={key}>{inline(text.slice(3), key)}</h2>);
    } else if (text.startsWith("# ")) {
      blocks.push(<h2 key={key}>{inline(text.slice(2), key)}</h2>);
    } else {
      blocks.push(<p key={key}>{inline(text, key)}</p>);
    }
  });

  flushBullets();

  return <div className="prose-doc">{blocks}</div>;
}
