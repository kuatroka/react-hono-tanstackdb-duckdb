import { memo } from "react";
import { Input } from "@/components/ui/input";

interface GlobalSearchInputProps {
  query: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const GlobalSearchInput = memo(function GlobalSearchInput({
  query,
  onChange,
  onFocus,
  onKeyDown,
}: GlobalSearchInputProps) {
  return (
    <Input
      id="global-search"
      name="global-search"
      type="search"
      placeholder="DuckDB Search..."
      value={query}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      className="w-full sm:w-[30rem] pr-16"
    />
  );
});
