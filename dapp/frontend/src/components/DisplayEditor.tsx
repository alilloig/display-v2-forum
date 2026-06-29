// Step 4 — the metadata-views playground. Drag your schema's field tokens (flat {field}
// and nested {group.field}) into the 7 standard Display props, compose literal text +
// tokens per slot, Apply (one set/unset PTB via the DisplayCap), and watch the resolved
// render change (before → after) while the raw struct fields stay fixed. Cap-gated.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentClient } from '@mysten/dapp-kit-react';
import { Transaction } from '@mysten/sui/transactions';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { displayTokens } from '../schema';
import { useDeployment } from '../DeploymentContext';
import { useSigner } from '../SignerContext';

// The 7 standard Display props (drop targets).
const DISPLAY_PROPS = ['name', 'description', 'image_url', 'link', 'thumbnail_url', 'project_url', 'creator'] as const;
type DisplayPropKey = (typeof DISPLAY_PROPS)[number];

function TokenChip({ token }: { token: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: token });
  return (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ display: 'inline-block', padding: '2px 8px', marginRight: 4, marginBottom: 4, background: '#4f46e5', color: '#fff', borderRadius: 4, fontSize: '0.8rem', cursor: 'grab', opacity: isDragging ? 0.4 : 1, userSelect: 'none' }}
    >
      {token}
    </span>
  );
}

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
      <td style={{ padding: '4px 8px 4px 0', color: '#555', whiteSpace: 'nowrap', width: 110 }}>{propKey}</td>
      <td ref={setNodeRef} style={{ padding: '2px 4px', background: isOver ? '#eef2ff' : 'transparent', borderRadius: 4, border: '1px dashed #ccc', transition: 'background 0.1s' }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={markedForUnset}
          placeholder="drop tokens or type…"
          style={{ width: '100%', border: 'none', background: 'transparent', fontFamily: 'monospace', fontSize: '0.85rem', outline: 'none' }}
        />
      </td>
      <td style={{ padding: '4px 0 4px 6px', whiteSpace: 'nowrap' }}>
        <button
          type="button"
          onClick={onToggleUnset}
          title={markedForUnset ? 'Cancel unset' : 'Mark to unset (remove from Display)'}
          style={{ fontSize: '0.75rem', padding: '1px 6px', background: markedForUnset ? '#dc2626' : '#e5e7eb', color: markedForUnset ? '#fff' : '#444', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          {markedForUnset ? 'cancel unset' : 'unset'}
        </button>
      </td>
    </tr>
  );
}

export function DisplayEditor() {
  const { address, signAndExecute } = useSigner();
  const client = useCurrentClient();
  const { deployment } = useDeployment();

  // Derive ids/tokens (empty when no deployment yet; hooks must still run unconditionally).
  const packageId = deployment?.packageId ?? '';
  const displayId = deployment?.displayId ?? '';
  const displayCapId = deployment?.displayCapId ?? '';
  const typeName = deployment?.schema.typeName ?? 'Hero';
  const typeArg = `${packageId}::hero::${typeName}`;
  const tokens = deployment ? displayTokens(deployment.schema) : [];

  const [slots, setSlots] = useState<Record<string, string>>(Object.fromEntries(DISPLAY_PROPS.map((k) => [k, ''])));
  const [unsetKeys, setUnsetKeys] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [heroId, setHeroId] = useState('');
  // Snapshot of the resolved display captured at Apply, for a true temporal before→after.
  const [beforeDisplay, setBeforeDisplay] = useState<Record<string, string> | null>(null);

  // 1. DisplayCap ownership gate — only the cap owner can edit the Display.
  const { data: capData, isLoading: capLoading } = useQuery({
    queryKey: ['display-cap-owner', displayCapId],
    queryFn: async () => {
      const res = await (client as unknown as {
        getObject: (args: { id: string; options: { showOwner?: boolean } }) => Promise<{ data?: { owner?: { AddressOwner?: string } | string } }>;
      }).getObject({ id: displayCapId, options: { showOwner: true } });
      return res.data?.owner;
    },
    enabled: !!displayCapId,
  });
  const capOwner = capData && typeof capData === 'object' && 'AddressOwner' in capData ? capData.AddressOwner : undefined;
  const isCapOwner = address !== null && capOwner === address;

  // 2. Current Display fields (so we only allow unset on fields that exist — unset aborts otherwise).
  const { data: currentDisplayData, refetch: refetchDisplay } = useQuery({
    queryKey: ['display-fields', displayId],
    queryFn: async () => {
      const res = await (client as unknown as {
        getObject: (args: { id: string; options: { showContent?: boolean } }) => Promise<{ data?: { content?: { fields?: { fields?: { contents?: Array<{ key: string; value: string }> } } } } }>;
      }).getObject({ id: displayId, options: { showContent: true } });
      const contents = res.data?.content?.fields?.fields?.contents ?? [];
      return Object.fromEntries(contents.map((e) => [e.key, e.value]));
    },
    enabled: isCapOwner && !!displayId,
  });

  // 3. Before/after Hero display fetch.
  const { data: heroDisplayData, isLoading: heroLoading, refetch: refetchHero } = useQuery({
    queryKey: ['hero-display', heroId],
    queryFn: async () => {
      if (!heroId.trim()) return null;
      const res = await (client as unknown as {
        getObject: (args: { id: string; options: { showDisplay?: boolean; showContent?: boolean } }) => Promise<{ data?: { display?: { data?: Record<string, string> | null; error?: string | null }; content?: { fields?: Record<string, unknown> } } }>;
      }).getObject({ id: heroId.trim(), options: { showDisplay: true, showContent: true } });
      return res.data;
    },
    enabled: !!heroId.trim() && isCapOwner,
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const token = String(active.id);
    const key = String(over.id) as DisplayPropKey;
    setSlots((prev) => ({ ...prev, [key]: prev[key] + token }));
    setUnsetKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function toggleUnset(key: string) {
    const existsInDisplay = currentDisplayData && key in currentDisplayData;
    setUnsetKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (existsInDisplay) {
        next.add(key);
        setSlots((s) => ({ ...s, [key]: '' }));
      }
      return next;
    });
  }

  async function handleApply() {
    if (!address || !deployment) return;
    setBusy(true);
    setStatus('Building transaction…');
    try {
      const tx = new Transaction();
      let opCount = 0;

      for (const key of DISPLAY_PROPS) {
        const v = slots[key].trim();
        if (v && !unsetKeys.has(key)) {
          tx.moveCall({
            target: '0x2::display_registry::set',
            typeArguments: [typeArg],
            arguments: [tx.object(displayId), tx.object(displayCapId), tx.pure.string(key), tx.pure.string(v)],
          });
          opCount++;
        }
      }
      for (const key of unsetKeys) {
        tx.moveCall({
          target: '0x2::display_registry::unset',
          typeArguments: [typeArg],
          arguments: [tx.object(displayId), tx.object(displayCapId), tx.pure.string(key)],
        });
        opCount++;
      }

      if (opCount === 0) {
        setStatus('Nothing to apply — fill in at least one slot or mark a prop to unset.');
        setBusy(false);
        return;
      }

      setStatus('Submitting…');
      const r = await signAndExecute(tx);
      if (!r.ok) {
        setStatus(`Error: ${r.error}`);
      } else {
        setStatus(`Applied! Digest: ${r.digest}`);
        if (heroId.trim()) setBeforeDisplay(heroDisplayData?.display?.data ?? {});
        setSlots(Object.fromEntries(DISPLAY_PROPS.map((k) => [k, ''])));
        setUnsetKeys(new Set());
        void refetchDisplay();
        void refetchHero();
      }
    } catch (err: unknown) {
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  if (!deployment) return null;

  if (capLoading) {
    return (
      <section><h2 style={{ marginTop: 0 }}>4. Display playground</h2><p style={{ color: '#999' }}>Checking DisplayCap ownership…</p></section>
    );
  }

  if (!isCapOwner) {
    return (
      <section>
        <h2 style={{ marginTop: 0 }}>4. Display playground</h2>
        <p style={{ color: '#999' }}>Connect the wallet that published (the DisplayCap owner) to edit the Display.</p>
      </section>
    );
  }

  return (
    <section>
      <h2 style={{ marginTop: 0 }}>4. Display playground <span style={{ color: '#4f46e5', fontSize: '0.75rem', fontWeight: 400 }}>(cap owner)</span></h2>
      <p style={{ color: '#666', fontSize: '0.85rem' }}>
        Drag your field tokens into the standard Display properties (or type literal text +
        tokens to compose a string). Apply lands all changes in one transaction.
      </p>

      <DndContext onDragEnd={handleDragEnd}>
        <div style={{ marginBottom: '1rem' }}>
          {tokens.map((t) => <TokenChip key={t} token={t} />)}
        </div>
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

      {currentDisplayData && Object.keys(currentDisplayData).length > 0 && (
        <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: '#777' }}>
          Current Display fields (can be unset): <strong>{Object.keys(currentDisplayData).join(', ')}</strong>
        </p>
      )}

      <button type="button" onClick={() => void handleApply()} disabled={busy || !address} style={{ padding: '6px 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, cursor: busy ? 'wait' : 'pointer', fontWeight: 600 }}>
        {busy ? 'Applying…' : 'Apply'}
      </button>
      {status && <p style={{ marginTop: '0.5rem', color: status.startsWith('Error') ? 'red' : 'green', fontSize: '0.85rem', wordBreak: 'break-all' }}>{status}</p>}

      {/* Before → After hero panel */}
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Before → After (one Hero, same object)</h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.85rem', color: '#555' }}>{typeName} object id:</label>
          <input value={heroId} onChange={(e) => setHeroId(e.target.value)} placeholder="0x…" style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8rem', padding: '2px 6px' }} />
          <button type="button" onClick={() => void refetchHero()} disabled={!heroId.trim() || heroLoading} style={{ fontSize: '0.8rem', padding: '2px 8px' }}>Refresh</button>
        </div>

        {heroDisplayData && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#333' }}>Raw struct fields <span style={{ color: '#aaa', fontWeight: 400 }}>(unchanged)</span></h4>
              <table style={{ fontSize: '0.82rem', borderCollapse: 'collapse', width: '100%' }}>
                <tbody>
                  {Object.entries(heroDisplayData.content?.fields ?? {}).map(([k, v]) => (
                    <tr key={k}><td style={{ padding: '2px 8px 2px 0', color: '#666' }}>{k}</td><td style={{ wordBreak: 'break-all' }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#333' }}>Resolved display <span style={{ color: '#aaa', fontWeight: 400 }}>(before Apply)</span></h4>
              {beforeDisplay === null ? (
                <p style={{ color: '#bbb', fontSize: '0.82rem' }}>— Apply a change to capture the pre-change render.</p>
              ) : Object.keys(beforeDisplay).length > 0 ? (
                <table style={{ fontSize: '0.82rem', borderCollapse: 'collapse', width: '100%' }}><tbody>
                  {Object.entries(beforeDisplay).map(([k, v]) => (<tr key={k}><td style={{ padding: '2px 8px 2px 0', color: '#666' }}>{k}</td><td style={{ wordBreak: 'break-all' }}>{v}</td></tr>))}
                </tbody></table>
              ) : (<p style={{ color: '#bbb', fontSize: '0.82rem' }}>(empty — no fields were set)</p>)}
            </div>
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#333' }}>Resolved display <span style={{ color: '#4f46e5', fontWeight: 400 }}>(after Apply / current)</span></h4>
              {heroDisplayData.display?.data && Object.keys(heroDisplayData.display.data).length > 0 ? (
                <table style={{ fontSize: '0.82rem', borderCollapse: 'collapse', width: '100%' }}><tbody>
                  {Object.entries(heroDisplayData.display.data).map(([k, v]) => (<tr key={k}><td style={{ padding: '2px 8px 2px 0', color: '#666' }}>{k}</td><td style={{ wordBreak: 'break-all' }}>{v}</td></tr>))}
                </tbody></table>
              ) : (<p style={{ color: '#bbb', fontSize: '0.82rem' }}>No display fields yet.</p>)}
              {heroDisplayData.display?.error && <p style={{ color: 'red', fontSize: '0.8rem' }}>Display error: {heroDisplayData.display.error}</p>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
