// Step 1 — design the NFT's traits. Edits a Schema (flat fields + nested groups) and
// shows the live generated Move source (the bespoke struct the bridge will publish).
import { FIELD_TYPES, validateSchema, generateHeroMove, DEFAULT_SCHEMA } from '../schema';
import type { FieldType, Schema } from '../schema';

interface Props {
  schema: Schema;
  onChange: (s: Schema) => void;
}

const inputStyle = { padding: '3px 6px', fontSize: '0.85rem', border: '1px solid #ccc', borderRadius: 4 };
const smallBtn = { fontSize: '0.75rem', padding: '2px 8px', borderRadius: 4, border: '1px solid #ccc', cursor: 'pointer', background: '#fff' };

function TypeSelect({ value, onChange }: { value: FieldType; onChange: (t: FieldType) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as FieldType)} style={inputStyle}>
      {FIELD_TYPES.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  );
}

export function TraitDesigner({ schema, onChange }: Props) {
  const errors = validateSchema(schema);
  let source = '';
  try {
    source = errors.length ? '' : generateHeroMove(schema);
  } catch {
    source = '';
  }

  // ── immutable update helpers ──
  const set = (patch: Partial<Schema>) => onChange({ ...schema, ...patch });
  const setFields = (fields: Schema['fields']) => set({ fields });
  const setGroups = (groups: Schema['groups']) => set({ groups });

  return (
    <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
      {/* ── Editor ── */}
      <div>
        <h2 style={{ marginTop: 0 }}>1. Design your NFT's traits</h2>
        <p style={{ color: '#666', fontSize: '0.85rem' }}>
          These become the on-chain struct fields. They never change once minted — the
          Display template (step 4) is the mutable view over them.
        </p>

        <label style={{ display: 'block', marginBottom: '1rem', fontSize: '0.85rem' }}>
          NFT type name{' '}
          <input value={schema.typeName} onChange={(e) => set({ typeName: e.target.value })} style={inputStyle} />
        </label>

        {/* flat fields */}
        <h3 style={{ fontSize: '0.95rem', marginBottom: 4 }}>Fields</h3>
        {schema.fields.map((f, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
            <input
              value={f.name}
              placeholder="field_name"
              onChange={(e) => setFields(schema.fields.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              style={{ ...inputStyle, flex: 1 }}
            />
            <TypeSelect value={f.type} onChange={(t) => setFields(schema.fields.map((x, j) => (j === i ? { ...x, type: t } : x)))} />
            <button type="button" style={smallBtn} onClick={() => setFields(schema.fields.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button type="button" style={{ ...smallBtn, marginTop: 4 }} onClick={() => setFields([...schema.fields, { name: '', type: 'string' }])}>
          + Add field
        </button>

        {/* nested groups */}
        <h3 style={{ fontSize: '0.95rem', margin: '1rem 0 4px' }}>
          Nested groups <span style={{ color: '#aaa', fontWeight: 400, fontSize: '0.8rem' }}>(showcases V2 {'{group.field}'} templating)</span>
        </h3>
        {schema.groups.map((g, gi) => (
          <div key={gi} style={{ border: '1px dashed #ccc', borderRadius: 6, padding: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              <input
                value={g.name}
                placeholder="group_name"
                onChange={(e) => setGroups(schema.groups.map((x, j) => (j === gi ? { ...x, name: e.target.value } : x)))}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button type="button" style={smallBtn} onClick={() => setGroups(schema.groups.filter((_, j) => j !== gi))}>remove group</button>
            </div>
            {g.fields.map((f, fi) => (
              <div key={fi} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center', paddingLeft: 12 }}>
                <input
                  value={f.name}
                  placeholder="field_name"
                  onChange={(e) =>
                    setGroups(schema.groups.map((x, j) => (j === gi ? { ...x, fields: x.fields.map((y, k) => (k === fi ? { ...y, name: e.target.value } : y)) } : x)))
                  }
                  style={{ ...inputStyle, flex: 1 }}
                />
                <TypeSelect
                  value={f.type}
                  onChange={(t) => setGroups(schema.groups.map((x, j) => (j === gi ? { ...x, fields: x.fields.map((y, k) => (k === fi ? { ...y, type: t } : y)) } : x)))}
                />
                <button type="button" style={smallBtn} onClick={() => setGroups(schema.groups.map((x, j) => (j === gi ? { ...x, fields: x.fields.filter((_, k) => k !== fi) } : x)))}>✕</button>
              </div>
            ))}
            <button
              type="button"
              style={{ ...smallBtn, marginLeft: 12 }}
              onClick={() => setGroups(schema.groups.map((x, j) => (j === gi ? { ...x, fields: [...x.fields, { name: '', type: 'u64' }] } : x)))}
            >
              + Add field to group
            </button>
          </div>
        ))}
        <button type="button" style={smallBtn} onClick={() => setGroups([...schema.groups, { name: '', fields: [{ name: '', type: 'u64' }] }])}>
          + Add nested group
        </button>

        <div style={{ marginTop: '1rem' }}>
          <button type="button" style={smallBtn} onClick={() => onChange(structuredClone(DEFAULT_SCHEMA))}>Reset to sample</button>
        </div>

        {errors.length > 0 && (
          <ul style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.75rem' }}>
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        )}
      </div>

      {/* ── Live Move preview ── */}
      <div>
        <h3 style={{ marginTop: 0, fontSize: '0.95rem' }}>Generated Move <span style={{ color: '#aaa', fontWeight: 400, fontSize: '0.8rem' }}>(what gets published)</span></h3>
        <pre style={{
          background: '#1e1e2e', color: '#cdd6f4', padding: 12, borderRadius: 8,
          fontSize: '0.72rem', lineHeight: 1.45, overflow: 'auto', maxHeight: 560, margin: 0,
        }}>
          {source || '// fix the errors on the left to preview the generated module'}
        </pre>
      </div>
    </section>
  );
}
