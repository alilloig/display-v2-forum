// The Hero "card": composite sprite for the current equipment set, the immutable base
// stats, the frontend-computed effective total, and — the headline — the `inventory`
// string resolved on-chain by the Display template projecting live over attached DOFs.
import { effectiveStats, HERO_BASE } from '../items';
import { spriteFor } from '../sprites';
import type { HeroView } from '../chain';

function StatRow({ label, base, effective }: { label: string; base: number; effective: number }) {
  const boosted = effective > base;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: '0.95rem' }}>
      <span style={{ width: 72, color: '#555' }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: '1.3rem', color: boosted ? '#047857' : '#111' }}>{effective}</span>
      {boosted && <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>(base {base} +{effective - base})</span>}
    </div>
  );
}

export function HeroStage({ hero }: { hero: HeroView }) {
  const eff = effectiveStats(hero.equipped);
  const sprite = spriteFor(hero.equipped);
  const inventory = hero.display['inventory'] ?? '';
  const equippedList = [...hero.equipped];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>
      <div style={{ border: '1px solid #e2e2e2', borderRadius: 12, padding: 10, background: '#fafafa', textAlign: 'center' }}>
        <img src={sprite} alt="hero" style={{ width: '100%', borderRadius: 8, imageRendering: 'pixelated' }} />
        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 4 }}>
          composite sprite · {equippedList.length ? equippedList.sort().join(' + ') : 'unarmed'}
        </div>
      </div>

      <div>
        <h2 style={{ margin: '0 0 2px' }}>{String(hero.fields['name'] ?? HERO_BASE.name)}</h2>
        <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontFamily: 'monospace', marginBottom: 12, wordBreak: 'break-all' }}>{hero.heroId}</div>

        <div style={{ display: 'flex', gap: 28, marginBottom: 14 }}>
          <StatRow label="Attack" base={HERO_BASE.baseAttack} effective={eff.attack} />
          <StatRow label="Defense" base={HERO_BASE.baseDefense} effective={eff.defense} />
        </div>

        <div style={{ background: '#0d1117', color: '#e6edf3', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: '0.68rem', color: '#8b949e', marginBottom: 4, letterSpacing: 0.4 }}>
            RESOLVED DISPLAY · <code>inventory</code> — projected live from attached dynamic object fields
          </div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem', minHeight: 20 }}>
            {inventory ? inventory : <span style={{ color: '#6e7681' }}>(empty — no items attached)</span>}
          </div>
          {hero.displayError && <div style={{ color: '#f85149', fontSize: '0.75rem', marginTop: 4 }}>Display error: {hero.displayError}</div>}
        </div>

        <p style={{ fontSize: '0.74rem', color: '#777', marginTop: 10 }}>
          The Hero's <code>base_attack</code>/<code>base_defense</code> on-chain fields never change. Equipping an item attaches a
          dynamic object field — the <code>inventory</code> above is the Display template resolving <code>{'{$self=>[\'sword\'].summary}'}</code>
          {' '}over whatever is currently attached. The effective total is summed client-side (templates can't do arithmetic).
        </p>
      </div>
    </div>
  );
}
