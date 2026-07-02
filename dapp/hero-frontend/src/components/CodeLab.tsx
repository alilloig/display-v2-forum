// The code lab: a single-column stack of the snippets relevant to the dapp's current
// state (see ../../GOAL.md). Each card states once which V1→V2 difference it showcases
// — the label doubles as a link to that section of the guide — and nothing else.
import { DIFFS, SNIPPETS, guideLink, type AppState, type Snippet } from '../snippets';

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
          Difference {snippet.diff} — {title} ↗
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
      <pre
        style={{
          margin: 0, padding: '10px 12px', fontSize: '0.78rem', lineHeight: 1.55,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          background: '#0d1117', color: '#e6edf3', fontFamily: 'ui-monospace, monospace',
        }}
      >
        {snippet.code}
      </pre>
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
