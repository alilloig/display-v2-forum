// The bottom "learning" panel: every one of the 9 Display V1→V2 differences (plus the
// transport note) as a side-by-side v1/v2 card. The card(s) most relevant to the user's
// last action are highlighted, so the lesson tracks the flow.
import { LESSONS, FLOW, type Lesson } from '../lessons';

function Card({ lesson, active }: { lesson: Lesson; active: boolean }) {
  return (
    <div
      style={{
        border: active ? '2px solid #4f46e5' : '1px solid #e2e2e2',
        borderRadius: 10,
        padding: '0.85rem',
        background: active ? '#f5f6ff' : '#fff',
        boxShadow: active ? '0 2px 10px rgba(79,70,229,0.15)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            fontSize: '0.7rem', fontWeight: 700, color: '#fff', background: lesson.kind === 'move' ? '#0f766e' : '#7c3aed',
            borderRadius: 999, padding: '2px 8px',
          }}
        >
          {lesson.n === 'T' ? 'SDK' : `#${lesson.n}`} · {lesson.kind === 'move' ? 'Move' : 'TS SDK'}
        </span>
        <strong style={{ fontSize: '0.9rem' }}>{lesson.title}</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {(['v1', 'v2'] as const).map((v) => (
          <div key={v}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: v === 'v1' ? '#b91c1c' : '#047857', marginBottom: 3, letterSpacing: 0.4 }}>
              {v === 'v1' ? 'DISPLAY V1' : 'DISPLAY V2'}
            </div>
            <pre
              style={{
                margin: 0, fontSize: '0.68rem', lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: '#0d1117', color: '#e6edf3', borderRadius: 6, padding: '7px 9px', fontFamily: 'ui-monospace, monospace',
              }}
            >
              {lesson[v]}
            </pre>
          </div>
        ))}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: '0.76rem', color: '#555' }}>{lesson.note}</p>
    </div>
  );
}

export function LessonPanel({ step }: { step: string }) {
  const activeSet = new Set(FLOW[step] ?? []);
  // Show highlighted lessons first, in the order they light up for this step.
  const ordered = [...LESSONS].sort((a, b) => Number(activeSet.has(b.n)) - Number(activeSet.has(a.n)));

  return (
    <section style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '2px dashed #ddd' }}>
      <h2 style={{ fontSize: '1rem', margin: '0 0 4px' }}>How this step differs: Display V1 → V2</h2>
      <p style={{ fontSize: '0.8rem', color: '#777', margin: '0 0 1rem' }}>
        The nine canonical differences, highlighted as you go. Source:{' '}
        <code style={{ fontSize: '0.75rem' }}>learning/display-v2-guide.md</code>.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
        {ordered.map((l) => (
          <Card key={String(l.n)} lesson={l} active={activeSet.has(l.n)} />
        ))}
      </div>
    </section>
  );
}
