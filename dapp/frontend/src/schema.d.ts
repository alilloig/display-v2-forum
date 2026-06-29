// Type declarations for the shared schema.js module (imported by both the browser and
// the bridge). schema.js is the runtime source of truth; these types are for the UI.

export type FieldType = 'string' | 'u64' | 'bool';
export interface Field {
  name: string;
  type: FieldType;
}
export interface Group {
  name: string;
  fields: Field[];
}
export interface Schema {
  typeName: string;
  fields: Field[];
  groups: Group[];
}

export interface MintParam {
  paramName: string;
  moveType: 'String' | 'u64' | 'bool';
  fieldType: FieldType;
  kind: 'flat' | 'nested';
  field: string;
  group?: string;
  token: string;
}

export const MOVE_TYPE: Record<FieldType, string>;
export const FIELD_TYPES: FieldType[];
export const DEFAULT_SCHEMA: Schema;

export function pascal(name: string): string;
export function validateSchema(schema: Schema): string[];
export function mintParams(schema: Schema): MintParam[];
export function displayTokens(schema: Schema): string[];
export function generateHeroMove(schema: Schema): string;
