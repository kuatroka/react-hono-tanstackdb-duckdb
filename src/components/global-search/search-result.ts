import type { SearchResult as CollectionSearchResult } from "@/collections/searches";

export interface SearchResult extends CollectionSearchResult {
  score: number;
}
