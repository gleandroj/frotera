import React from "react";
import { X } from "lucide-react";

export interface ChipsInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ChipsInput({ value, onChange, placeholder = "Add a tag and press Enter", disabled, className }: ChipsInputProps) {
  const [input, setInput] = React.useState("");
  const tags = value ? value.split(",").map(t => t.trim()).filter(Boolean) : [];

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) {
        onChange([...tags, input.trim()].join(", "));
      }
      setInput("");
    } else if (e.key === "Backspace" && !input && tags.length) {
      onChange(tags.slice(0, -1).join(", "));
    }
  };

  const removeTag = (idx: number) => {
    if (disabled) return;
    onChange(tags.filter((_, i) => i !== idx).join(", "));
  };

  return (
    <div className={`flex flex-wrap gap-1 border rounded px-2 py-1 bg-background min-h-[40px] ${className || ""} ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      {tags.map((tag, idx) => (
        <span key={idx} className="flex items-center bg-muted rounded px-2 py-0.5 text-xs mr-1 mb-1">
          {tag}
          <button
            type="button"
            className="ml-1 text-muted-foreground hover:text-destructive focus:outline-none"
            onClick={() => removeTag(idx)}
            aria-label={`Remove tag ${tag}`}
            disabled={disabled}
          >
            <X size={14} />
          </button>
        </span>
      ))}
      <input
        className="flex-1 min-w-[100px] border-none outline-none bg-transparent text-sm py-1"
        value={input}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={tags.length ? "" : placeholder}
        disabled={disabled}
      />
    </div>
  );
}