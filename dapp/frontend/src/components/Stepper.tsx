// Horizontal 4-step nav. A step is clickable only when `canGoTo(index)` allows it
// (e.g. Publish needs a wallet; Mint/Display need a deployment).
interface StepperProps {
  steps: string[];
  current: number;
  canGoTo: (index: number) => boolean;
  onSelect: (index: number) => void;
}

export function Stepper({ steps, current, canGoTo, onSelect }: StepperProps) {
  return (
    <nav style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
      {steps.map((label, i) => {
        const active = i === current;
        const enabled = canGoTo(i);
        return (
          <button
            key={label}
            type="button"
            disabled={!enabled}
            onClick={() => onSelect(i)}
            style={{
              flex: '1 1 0',
              minWidth: 120,
              padding: '8px 10px',
              textAlign: 'left',
              border: active ? '2px solid #4f46e5' : '1px solid #ddd',
              borderRadius: 8,
              background: active ? '#eef2ff' : enabled ? '#fff' : '#f6f6f6',
              color: enabled ? '#222' : '#aaa',
              cursor: enabled ? 'pointer' : 'not-allowed',
              fontWeight: active ? 700 : 500,
              fontSize: '0.85rem',
            }}
          >
            <span style={{ color: active ? '#4f46e5' : '#999', marginRight: 6 }}>{i + 1}</span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}
