// The bottom "learning" panel. The dapp cycle is 9 steps (connect → the forge →
// mint → equip ×3 → unequip ×3); at each step the panel shows ONLY the V1→V2
// difference cards that step demonstrates — the others stay hidden until their
// step in the cycle. A step strip on top keeps the 9-step narrative visible.
import { LESSONS, FLOW, CYCLE_STEPS, type Lesson, type Phase } from '../lessons';

function Card({ lesson }: { lesson: Lesson }) {
  return (
    <div style={{ border: '1px solid #e2e2e2', borderRadius: 10, padding: '0.85rem', background: '#fff' }}>
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

/** The 9-step cycle strip: where the user is, and that each step has its lesson. */
function StepStrip({ pos }: { pos: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0 0 14px' }}>
      {CYCLE_STEPS.map((label, i) => {
        const n = i + 1;
        const current = n === pos;
        const done = n < pos;
        return (
          <span
            key={label}
            style={{
              fontSize: '0.7rem', padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
              border: current ? '2px solid #4f46e5' : '1px solid #ddd',
              background: current ? '#eef2ff' : done ? '#f4f4f5' : '#fff',
              color: current ? '#4f46e5' : done ? '#a1a1aa' : '#666',
              fontWeight: current ? 700 : 500,
            }}
          >
            {n} · {label}
          </span>
        );
      })}
    </div>
  );
}

export function LessonPanel({ phase, pos }: { phase: Phase; pos: number }) {
  const active = FLOW[phase];
  const cards = active
    .map((n) => LESSONS.find((l) => l.n === n))
    .filter((l): l is Lesson => !!l);
  const hidden = LESSONS.length - cards.length;

  return (
    <section style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '2px dashed #ddd' }}>
      <h2 style={{ fontSize: '1rem', margin: '0 0 4px' }}>
        Step {pos} of 9 — what this step changes from Display V1 to V2
      </h2>
      <p style={{ fontSize: '0.8rem', color: '#777', margin: '0 0 10px' }}>
        Only the difference{cards.length > 1 ? 's' : ''} this step demonstrates {cards.length > 1 ? 'are' : 'is'} shown
        ({hidden} more surface at other steps — nine in total, plus the transport note). Source:{' '}
        <code style={{ fontSize: '0.75rem' }}>learning/display-v2-guide.md</code>.
      </p>
      <StepStrip pos={pos} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
        {cards.map((l) => (
          <Card key={String(l.n)} lesson={l} />
        ))}
      </div>
    </section>
  );
}
