// The three equipment slots. Each item can be minted+equipped once (the Move `equip_*`
// aborts on a second attach) and then unequipped. Equipping attaches a dynamic object
// field to the Hero; the resolved Display and the composite sprite update from that.
import { ITEMS, SLOTS, type Slot } from '../items';
import { primaryButton } from '../styles';

interface ArmoryProps {
  equipped: Set<Slot>;
  busySlot: Slot | null;
  onEquip: (slot: Slot) => void;
  onUnequip: (slot: Slot) => void;
  disabled: boolean;
}

export function Armory({ equipped, busySlot, onEquip, onUnequip, disabled }: ArmoryProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
      {SLOTS.map((slot) => {
        const item = ITEMS[slot];
        const on = equipped.has(slot);
        const busy = busySlot === slot;
        const bonus = slot === 'sword' ? `+${item.attack} ATK` : slot === 'shield' ? `+${item.defense} DEF` : `+${item.defense} DEF / +${item.attack} ATK`;
        return (
          <div key={slot} style={{ border: '1px solid #e2e2e2', borderRadius: 10, padding: 12, textAlign: 'center', background: on ? '#f0fdf4' : '#fff' }}>
            <img src={item.sprite} alt={item.name} style={{ width: 72, height: 72, objectFit: 'contain', imageRendering: 'pixelated' }} />
            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: 4 }}>{item.name}</div>
            <div style={{ fontSize: '0.72rem', color: '#0f766e', marginBottom: 8 }}>{bonus}</div>
            {on ? (
              <button
                type="button"
                onClick={() => onUnequip(slot)}
                disabled={disabled || busy}
                style={{ width: '100%', padding: '5px 0', fontSize: '0.78rem', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: disabled || busy ? 'wait' : 'pointer' }}
              >
                {busy ? '…' : 'Unequip'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onEquip(slot)}
                disabled={disabled || busy}
                style={{ ...primaryButton, width: '100%', padding: '5px 0', fontSize: '0.78rem', borderRadius: 6, fontWeight: 600, cursor: disabled || busy ? 'wait' : 'pointer' }}
              >
                {busy ? 'Forging…' : 'Mint & equip'}
              </button>
            )}
            <div style={{ fontSize: '0.66rem', color: '#9ca3af', marginTop: 6 }}>
              DOF key <code>{slot}</code>
            </div>
          </div>
        );
      })}
    </div>
  );
}
