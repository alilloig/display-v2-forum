import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDAppKit, useCurrentAccount, useCurrentClient } from '@mysten/dapp-kit-react';
import { Transaction } from '@mysten/sui/transactions';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { PACKAGE_ID, DISPLAY_ID, DISPLAY_CAP_ID } from '../deployment';

// ─── The 5 Hero field tokens available as drag chips ─────────────────────────
const FIELD_TOKENS = ['{name}', '{image_url}', '{species}', '{power}', '{level}'] as const;

// ─── The 7 standard Display props (drop targets) ─────────────────────────────
const DISPLAY_PROPS = [
  'name',
  'description',
  'image_url',
  'link',
  'thumbnail_url',
  'project_url',
  'creator',
] as const;
type DisplayPropKey = (typeof DISPLAY_PROPS)[number];

// ─── Draggable token chip ─────────────────────────────────────────────────────
function TokenChip({ token }: { token: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: token });
  return (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        marginRight: 4,
        marginBottom: 4,
        background: '#4f46e5',
        color: '#fff',
        borderRadius: 4,
        fontSize: '0.8rem',
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        userSelect: 'none',
      }}
    >
      {token}
    </span>
  );
}

// ─── Droppable slot row ───────────────────────────────────────────────────────
interface SlotRowProps {
  propKey: DisplayPropKey;
  value: string;
  markedForUnset: boolean;
  onChange: (v: string) => void;
  onToggleUnset: () => void;
}

function SlotRow({ propKey, value, markedForUnset, onChange, onToggleUnset }: SlotRowProps) {
  const { setNodeRef, isOver } = useDroppable({ id: propKey });
  return (
    <tr>
      <td style={{ padding: '4px 8px 4px 0', color: '#555', whiteSpace: 'nowrap', width: 110 }}>
        {propKey}
      </td>
      <td
        ref={setNodeRef}
        style={{
          padding: '2px 4px',
          background: isOver ? '#eef2ff' : 'transparent',
          borderRadius: 4,
          border: '1px dashed #ccc',
          transition: 'background 0.1s',
        }}
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={markedForUnset}
          placeholder={`drop tokens or type…`}
          style={{
            width: '100%',
            border: 'none',
            background: 'transparent',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            outline: 'none',
          }}
        />
      </td>
      <td style={{ padding: '4px 0 4px 6px', whiteSpace: 'nowrap' }}>
        <button
          type="button"
          onClick={onToggleUnset}
          title={markedForUnset ? 'Cancel unset' : 'Mark to unset (remove from Display)'}
          style={{
            fontSize: '0.75rem',
            padding: '1px 6px',
            background: markedForUnset ? '#dc2626' : '#e5e7eb',
            color: markedForUnset ? '#fff' : '#444',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          {markedForUnset ? 'cancel unset' : 'unset'}
        </button>
      </td>
    </tr>
  );
}

// ─── DisplayEditor (main export) ─────────────────────────────────────────────

export function DisplayEditor() {
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();
  const client = useCurrentClient();

  // ── Slot state ──
  const [slots, setSlots] = useState<Record<string, string>>(
    Object.fromEntries(DISPLAY_PROPS.map((k) => [k, ''])),
  );
  // Props the user explicitly wants to UNSET (only allowed for existing props).
  const [unsetKeys, setUnsetKeys] = useState<Set<string>>(new Set());

  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  // ── Sample Hero id for before/after demo ──
  const [heroId, setHeroId] = useState('');
  // Snapshot of the Hero's RESOLVED display captured at the moment of Apply, so we
  // can show a true temporal before→after of the rendered output (the raw struct
  // fields, shown separately, never change).
  const [beforeDisplay, setBeforeDisplay] = useState<Record<string, string> | null>(null);

  // ── 1. Fetch DisplayCap ownership to guard the editor ────────────────────────
  // Teaching point: only the wallet that owns the DisplayCap can edit the Display.
  const { data: capData, isLoading: capLoading } = useQuery({
    queryKey: ['display-cap-owner', DISPLAY_CAP_ID],
    queryFn: async () => {
      const res = await (client as unknown as {
        getObject: (args: {
          id: string;
          options: { showOwner?: boolean };
        }) => Promise<{
          data?: {
            owner?: { AddressOwner?: string } | string;
          };
        }>;
      }).getObject({ id: DISPLAY_CAP_ID, options: { showOwner: true } });
      return res.data?.owner;
    },
  });

  const capOwner =
    capData && typeof capData === 'object' && 'AddressOwner' in capData
      ? capData.AddressOwner
      : undefined;

  const isCapOwner = account !== null && capOwner === account.address;

  // ── 2. Current display fields (to gate which props can be unset) ──────────────
  // Teaching point: unset ABORTS if the field is absent, so we only allow unset
  // for fields that currently exist in the Display.
  const { data: currentDisplayData, refetch: refetchDisplay } = useQuery({
    queryKey: ['display-fields', DISPLAY_ID],
    queryFn: async () => {
      const res = await (client as unknown as {
        getObject: (args: {
          id: string;
          options: { showContent?: boolean };
        }) => Promise<{
          data?: {
            content?: {
              fields?: {
                fields?: { contents?: Array<{ key: string; value: string }> };
              };
            };
          };
        }>;
      }).getObject({ id: DISPLAY_ID, options: { showContent: true } });
      // The Display object's fields.fields.contents is a VecMap<String, String>
      const contents = res.data?.content?.fields?.fields?.contents ?? [];
      return Object.fromEntries(contents.map((e) => [e.key, e.value]));
    },
    enabled: isCapOwner,
  });

  // ── 3. Before/after Hero display fetch ───────────────────────────────────────
  // Teaching point: same Hero object, different resolved render after Apply.
  const {
    data: heroDisplayData,
    isLoading: heroLoading,
    refetch: refetchHero,
  } = useQuery({
    queryKey: ['hero-display', heroId],
    queryFn: async () => {
      if (!heroId.trim()) return null;
      const res = await (client as unknown as {
        getObject: (args: {
          id: string;
          options: { showDisplay?: boolean; showContent?: boolean };
        }) => Promise<{
          data?: {
            display?: { data?: Record<string, string> | null; error?: string | null };
            content?: { fields?: Record<string, unknown> };
          };
        }>;
      }).getObject({ id: heroId.trim(), options: { showDisplay: true, showContent: true } });
      return res.data;
    },
    enabled: !!heroId.trim() && isCapOwner,
  });

  // ── Drag end: append token to the target slot ─────────────────────────────────
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const token = String(active.id);
    const key = String(over.id) as DisplayPropKey;
    setSlots((prev) => ({ ...prev, [key]: prev[key] + token }));
    // If we drop a token into a slot, cancel any pending unset for that slot
    setUnsetKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function toggleUnset(key: string) {
    // Only allow marking for unset if the field actually exists in the current Display
    const existsInDisplay = currentDisplayData && key in currentDisplayData;
    setUnsetKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else if (existsInDisplay) {
        next.add(key);
        // Clear the template text when marking for unset
        setSlots((s) => ({ ...s, [key]: '' }));
      }
      return next;
    });
  }

  // ── Apply: build a single PTB with all set/unset calls ───────────────────────
  // Teaching point: all changes land in one atomic transaction.
  async function handleApply() {
    if (!account) return;
    setBusy(true);
    setStatus('Building transaction…');
    try {
      const tx = new Transaction();

      let opCount = 0;

      // set — for every non-empty slot not marked for unset
      for (const key of DISPLAY_PROPS) {
        const val = slots[key].trim();
        if (val && !unsetKeys.has(key)) {
          tx.moveCall({
            target: '0x2::display_registry::set',
            typeArguments: [`${PACKAGE_ID}::hero::Hero`],
            arguments: [
              tx.object(DISPLAY_ID),
              tx.object(DISPLAY_CAP_ID),
              tx.pure.string(key),
              tx.pure.string(val),
            ],
          });
          opCount++;
        }
      }

      // unset — only for fields that currently exist in the Display
      // (safe: we already blocked marking absent fields for unset in toggleUnset)
      for (const key of unsetKeys) {
        tx.moveCall({
          target: '0x2::display_registry::unset',
          typeArguments: [`${PACKAGE_ID}::hero::Hero`],
          arguments: [
            tx.object(DISPLAY_ID),
            tx.object(DISPLAY_CAP_ID),
            tx.pure.string(key),
          ],
        });
        opCount++;
      }

      if (opCount === 0) {
        setStatus('Nothing to apply — fill in at least one slot or mark a prop to unset.');
        setBusy(false);
        return;
      }

      setStatus('Waiting for signature…');
      const result = await dAppKit.signAndExecuteTransaction({ transaction: tx });

      if (result.FailedTransaction) {
        const msg = result.FailedTransaction.status.error?.message ?? 'Transaction failed';
        setStatus(`Error: ${msg}`);
      } else {
        setStatus(`Applied! Digest: ${result.Transaction.digest}`);
        // Capture the PRE-Apply resolved display BEFORE refetching, so the panel
        // can show before→after of the rendered output for the same Hero.
        if (heroId.trim()) {
          setBeforeDisplay(heroDisplayData?.display?.data ?? {});
        }
        // Clear the applied slots and unset marks
        setSlots(Object.fromEntries(DISPLAY_PROPS.map((k) => [k, ''])));
        setUnsetKeys(new Set());
        // Refetch display + hero to show the before→after diff
        void refetchDisplay();
        void refetchHero();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(`Error: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (capLoading) {
    return (
      <section style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: 8, marginTop: '2rem' }}>
        <h2>Display Editor</h2>
        <p style={{ color: '#999' }}>Checking DisplayCap ownership…</p>
      </section>
    );
  }

  if (!isCapOwner) {
    return (
      <section style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: 8, marginTop: '2rem' }}>
        <h2>Display Editor</h2>
        <p style={{ color: '#999' }}>
          Connect the deployer wallet (DisplayCap owner) to edit the Display.
        </p>
      </section>
    );
  }

  // ── Full editor (only visible to the cap owner) ───────────────────────────────
  return (
    <section style={{ padding: '1rem', border: '1px solid #4f46e5', borderRadius: 8, marginTop: '2rem' }}>
      <h2 style={{ marginTop: 0 }}>Display Editor <span style={{ color: '#4f46e5', fontSize: '0.75rem', fontWeight: 400 }}>(cap owner only)</span></h2>

      {/* ── Token palette ── */}
      <div style={{ marginBottom: '1rem' }}>
        <p style={{ margin: '0 0 6px', fontSize: '0.85rem', color: '#555' }}>
          Drag field tokens into the slots below, or type literal text directly:
        </p>
        <DndContext onDragEnd={handleDragEnd}>
          <div style={{ marginBottom: '1rem' }}>
            {FIELD_TOKENS.map((t) => (
              <TokenChip key={t} token={t} />
            ))}
          </div>

          {/* ── Slot table ── */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
            <tbody>
              {DISPLAY_PROPS.map((key) => (
                <SlotRow
                  key={key}
                  propKey={key}
                  value={slots[key]}
                  markedForUnset={unsetKeys.has(key)}
                  onChange={(v) => setSlots((prev) => ({ ...prev, [key]: v }))}
                  onToggleUnset={() => toggleUnset(key)}
                />
              ))}
            </tbody>
          </table>
        </DndContext>

        {/* "Unset" note: only fields currently in the Display can be unset */}
        {currentDisplayData && Object.keys(currentDisplayData).length > 0 && (
          <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: '#777' }}>
            Current Display fields (can be unset):{' '}
            <strong>{Object.keys(currentDisplayData).join(', ')}</strong>
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleApply()}
          disabled={busy || !account}
          style={{
            padding: '6px 16px',
            background: '#4f46e5',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: busy ? 'wait' : 'pointer',
            fontWeight: 600,
          }}
        >
          {busy ? 'Applying…' : 'Apply'}
        </button>

        {status && (
          <p style={{ marginTop: '0.5rem', color: status.startsWith('Error') ? 'red' : 'green', fontSize: '0.85rem' }}>
            {status}
          </p>
        )}
      </div>

      {/* ── Before → After hero panel ── */}
      {/* Teaching point: the Hero's content.fields never change; only the
          resolved display output changes when we update the Display template. */}
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Before → After (Hero object preview)</h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#555' }}>Hero object id:</label>
          <input
            value={heroId}
            onChange={(e) => setHeroId(e.target.value)}
            placeholder="0x…"
            style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8rem', padding: '2px 6px' }}
          />
          <button
            type="button"
            onClick={() => void refetchHero()}
            disabled={!heroId.trim() || heroLoading}
            style={{ fontSize: '0.8rem', padding: '2px 8px' }}
          >
            Refresh
          </button>
        </div>

        {heroDisplayData && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            {/* Raw struct fields — these NEVER change */}
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#333' }}>
                Raw struct fields <span style={{ color: '#aaa', fontWeight: 400 }}>(unchanged)</span>
              </h4>
              <table style={{ fontSize: '0.82rem', borderCollapse: 'collapse', width: '100%' }}>
                <tbody>
                  {Object.entries(heroDisplayData.content?.fields ?? {}).map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ padding: '2px 8px 2px 0', color: '#666' }}>{k}</td>
                      <td style={{ wordBreak: 'break-all' }}>{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Resolved display BEFORE the last Apply — captured snapshot */}
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#333' }}>
                Resolved display <span style={{ color: '#aaa', fontWeight: 400 }}>(before Apply)</span>
              </h4>
              {beforeDisplay === null ? (
                <p style={{ color: '#bbb', fontSize: '0.82rem' }}>— Apply a change to capture the pre-change render.</p>
              ) : Object.keys(beforeDisplay).length > 0 ? (
                <table style={{ fontSize: '0.82rem', borderCollapse: 'collapse', width: '100%' }}>
                  <tbody>
                    {Object.entries(beforeDisplay).map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ padding: '2px 8px 2px 0', color: '#666' }}>{k}</td>
                        <td style={{ wordBreak: 'break-all' }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#bbb', fontSize: '0.82rem' }}>(empty — no fields were set)</p>
              )}
            </div>

            {/* Resolved display AFTER the last Apply — live (re-fetched) */}
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#333' }}>
                Resolved display <span style={{ color: '#4f46e5', fontWeight: 400 }}>(after Apply / current)</span>
              </h4>
              {heroDisplayData.display?.data && Object.keys(heroDisplayData.display.data).length > 0 ? (
                <table style={{ fontSize: '0.82rem', borderCollapse: 'collapse', width: '100%' }}>
                  <tbody>
                    {Object.entries(heroDisplayData.display.data).map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ padding: '2px 8px 2px 0', color: '#666' }}>{k}</td>
                        <td style={{ wordBreak: 'break-all' }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#bbb', fontSize: '0.82rem' }}>No display fields yet.</p>
              )}
              {heroDisplayData.display?.error && (
                <p style={{ color: 'red', fontSize: '0.8rem' }}>Display error: {heroDisplayData.display.error}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
