import { memo } from "react";
import { Input } from "@/components/ui/input";

interface GlobalSearchInputProps {
  query: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  className?: string;
}

export const GlobalSearchInput = memo(function GlobalSearchInput({
  query,
  onChange,
  onKeyDown,
  id = "global-search",
  name = "global-search",
  placeholder = "Search superinvestors, tickers...",
  className = "w-full sm:w-[30rem]",
}: GlobalSearchInputProps) {
  return (
    <Input
      id={id}
      name={name}
      type="search"
      placeholder={placeholder}
      value={query}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      className={className}
    />
  );
});
