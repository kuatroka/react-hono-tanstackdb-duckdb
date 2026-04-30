export interface SearchIndexItemRecord {
  id: number;
  cusip: string | null;
  code: string;
  name: string | null;
  category: string;
}

export type SearchIndexItemTuple = readonly [
  id: number,
  cusip: string | null,
  code: string,
  name: string | null,
  category: string,
];

export interface SearchIndexMetadata {
  totalItems: number;
  generatedAt?: string;
  persistedAt?: number;
  dataVersion?: string | null;
  indexFileBytes?: number;
  compactBytes?: number;
  error?: string;
}

export interface CompactSearchIndexPayload {
  items: SearchIndexItemTuple[];
  metadata?: SearchIndexMetadata;
}

export interface LegacySearchIndexPayload {
  codeExact?: Record<string, number[]>;
  codePrefixes?: Record<string, number[]>;
  namePrefixes?: Record<string, number[]>;
  items: Record<string, SearchIndexItemRecord> | SearchIndexItemTuple[];
  metadata?: SearchIndexMetadata;
}

export function recordToSearchIndexTuple(item: SearchIndexItemRecord): SearchIndexItemTuple {
  return [
    item.id,
    item.cusip ?? null,
    item.code,
    item.name ?? null,
    item.category,
  ];
}

export function tupleToSearchIndexRecord(tuple: SearchIndexItemTuple): SearchIndexItemRecord {
  return {
    id: tuple[0],
    cusip: tuple[1] ?? null,
    code: tuple[2],
    name: tuple[3] ?? null,
    category: tuple[4],
  };
}

function normalizeTuple(tuple: SearchIndexItemTuple): SearchIndexItemTuple {
  return [
    Number(tuple[0]),
    tuple[1] ?? null,
    String(tuple[2]),
    tuple[3] ?? null,
    String(tuple[4]),
  ];
}

export function compactSearchIndexPayload(
  payload: LegacySearchIndexPayload | CompactSearchIndexPayload,
): CompactSearchIndexPayload {
  const items = Array.isArray(payload.items)
    ? payload.items.map(normalizeTuple)
    : Object.values(payload.items).map(recordToSearchIndexTuple);

  return {
    items,
    metadata: payload.metadata
      ? {
          ...payload.metadata,
          totalItems: payload.metadata.totalItems ?? items.length,
        }
      : {
          totalItems: items.length,
        },
  };
}
