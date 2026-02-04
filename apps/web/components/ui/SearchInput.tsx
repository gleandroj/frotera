"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import * as React from "react";
import { Button } from "./button";
import { Input } from "./input";

export interface SearchResult {
  id: string | number;
  title: string;
  subtitle?: string;
  data?: any;
}

interface SearchInputProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  onClear?: () => void;
  className?: string;
  expandable?: boolean;
  debounceMs?: number;
  loading?: boolean;
  currentQuery?: string;
  currentMatchIndex?: number;
  totalMatchCount?: number;
  hasMatches?: boolean;
  hasNextMatch?: boolean;
  hasPreviousMatch?: boolean;
  onNextMatch?: () => void;
  onPreviousMatch?: () => void;
}

export function SearchInput({
  placeholder = "Search...",
  onSearch,
  onClear,
  className,
  expandable = true,
  debounceMs = 500,
  loading = false,
  currentQuery = "",
  currentMatchIndex,
  totalMatchCount,
  hasMatches,
  hasNextMatch,
  hasPreviousMatch,
  onNextMatch,
  onPreviousMatch,
}: SearchInputProps) {
  const [isExpanded, setIsExpanded] = React.useState(!expandable);
  const [query, setQuery] = React.useState(currentQuery);
  const [showClearButton, setShowClearButton] = React.useState(!!currentQuery);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<NodeJS.Timeout>(null);
  const lastSearchedQuery = React.useRef<string>(currentQuery);
  const isInternalUpdate = React.useRef<boolean>(false);

  // Sync with external currentQuery
  React.useEffect(() => {
    // Only update if the currentQuery comes from external source (not our own search)
    if (
      currentQuery !== lastSearchedQuery.current &&
      !isInternalUpdate.current
    ) {
      setQuery(currentQuery);
      setShowClearButton(!!currentQuery);
      lastSearchedQuery.current = currentQuery;
    }
    isInternalUpdate.current = false;
  }, [currentQuery]);

  // Debounced search effect
  React.useEffect(() => {
    // Don't search if this is just syncing with external currentQuery
    if (query === lastSearchedQuery.current) {
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (onSearch && query.trim() !== lastSearchedQuery.current) {
        isInternalUpdate.current = true;
        lastSearchedQuery.current = query.trim();
        onSearch(query.trim());
      }
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, debounceMs]); // Removed onSearch from dependencies to prevent re-triggering

  const handleExpand = () => {
    if (expandable && !isExpanded) {
      setIsExpanded(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleCollapse = () => {
    if (expandable) {
      setIsExpanded(false);
      handleClear();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    setShowClearButton(!!newValue.trim());
  };

  const handleClear = () => {
    setQuery("");
    setShowClearButton(false);
    lastSearchedQuery.current = "";
    isInternalUpdate.current = true;
    onClear?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (expandable && query.trim()) {
        handleClear();
      } else if (expandable) {
        handleCollapse();
      }
    }
  };

  if (expandable && !isExpanded) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleExpand}
        className={cn("h-9 w-9", className)}
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className={cn("relative flex items-center gap-2", className)}>
      <div className="relative flex-1">
        <Search
          className={cn(
            "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground",
            loading && "animate-pulse"
          )}
        />
        <Input
          ref={inputRef}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn("pl-10 pr-10", loading && "opacity-75")}
          autoComplete="off"
          disabled={loading}
        />
        {(showClearButton || expandable) && (
          <Button
            variant="ghost"
            size="icon"
            onClick={showClearButton ? handleClear : handleCollapse}
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            aria-label={showClearButton ? "Clear search" : "Close search"}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Navigation controls for matches */}
      {hasMatches && totalMatchCount! > 1 && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span className="whitespace-nowrap">
            {currentMatchIndex! + 1} of {totalMatchCount}
          </span>
          <div className="flex">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onNextMatch}
              disabled={!hasNextMatch || loading}
              aria-label="Previous match"
            >
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label="Next match"
              onClick={onPreviousMatch}
              disabled={!hasPreviousMatch || loading}
            >
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Simple visual indicator for active search */}
      {query.trim() && !hasMatches && (
        <div className="absolute -bottom-4 left-1 text-xs text-muted-foreground text-nowrap truncate max-w-[250px]">
          {loading ? "Searching..." : null}
        </div>
      )}
    </div>
  );
}
