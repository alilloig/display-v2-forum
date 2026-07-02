// The code lab: a single-column stack of the snippets relevant to the dapp's current
// state (see dapp/GOAL.md). Each snippet names once the V1→V2 difference it showcases
// — the label doubles as a link to that section of the guide — and pairs real V1 code
// with its V2 equivalent as independent side-by-side cards (stacking when narrow).
import type { ReactNode } from 'react';
import { DIFFS, SNIPPETS, guideLink, type AppState, type Snippet } from '../snippets';

// Minimal token colouring, GitHub-dark palette: comments, strings, keywords,
// capitalized types, numbers. Order matters — comments swallow backticks etc.
const TOKEN_SRC = [
  /\/\/[^\n]*/.source,
  /b?"(?:[^"\\]|\\[\s\S])*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/.source,
  /\b(?:public|fun|let|mut|entry|struct|vector|const|await|async|use|module)\b/.source,
  /\b[A-Z][A-Za-z0-9_]*\b/.source,
  /\b\d+\b/.source,
].map((s) => `(${s})`).join('|');
const TOKEN_COLORS = ['#8b949e', '#a5d6ff', '#ff7b72', '#ffa657', '#79c0ea'];

function highlight(code: string): ReactNode[] {
  const re = new RegExp(TOKEN_SRC, 'g');
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (let m = re.exec(code); m; m = re.exec(code)) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const group = m.slice(1).findIndex((g) => g !== undefined);
    out.push(
      <span key={key++} style={{ color: TOKEN_COLORS[group] }}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

function VersionCard({ version, code }: { version: 'v1' | 'v2'; code: string }) {
  const accent = version === 'v1' ? '#f87171' : '#4ade80';
  const tint = version === 'v1' ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)';
  return (
    <div
      style={{
        flex: '1 1 300px', minWidth: 0, borderRadius: 8, overflow: 'hidden',
        border: '1px solid #21262d', background: '#0d1117',
      }}
    >
      <div
        style={{
          padding: '4px 10px', fontSize: '0.66rem', fontWeight: 700, letterSpacing: 0.8,
          color: accent, background: tint, borderBottom: '1px solid #21262d',
        }}
      >
        {version === 'v1' ? 'DISPLAY V1' : 'DISPLAY V2'}
      </div>
      <pre
        style={{
          margin: 0, padding: '10px 12px', fontSize: '0.76rem', lineHeight: 1.55,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          color: '#e6edf3', fontFamily: 'ui-monospace, monospace',
        }}
      >
        {highlight(code)}
      </pre>
    </div>
  );
}

function SnippetCard({ snippet }: { snippet: Snippet }) {
  const { title } = DIFFS[snippet.diff];
  return (
    <article style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          padding: '7px 12px', background: '#fafafa', borderBottom: '1px solid #f0f0f0',
        }}
      >
        <a
          href={guideLink(snippet.diff)}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4f46e5', textDecoration: 'none' }}
        >
          {title} ↗
        </a>
        <span
          style={{
            fontSize: '0.66rem', fontWeight: 700, letterSpacing: 0.4, color: '#6b7280',
            fontFamily: 'ui-monospace, monospace', flexShrink: 0,
          }}
        >
          {snippet.kind === 'move' ? 'MOVE' : 'TS'}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 10 }}>
        <VersionCard version="v1" code={snippet.v1} />
        <VersionCard version="v2" code={snippet.v2} />
      </div>
    </article>
  );
}

export function CodeLab({ state }: { state: AppState }) {
  return (
    <section style={{ marginTop: '2.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '1.1rem' }}>
      <div
        style={{
          fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.2, color: '#9ca3af',
          textTransform: 'uppercase', marginBottom: 10,
        }}
      >
        Code lab
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {SNIPPETS[state].map((s, i) => (
          <SnippetCard key={`${state}-${s.diff}-${i}`} snippet={s} />
        ))}
      </div>
    </section>
  );
}
