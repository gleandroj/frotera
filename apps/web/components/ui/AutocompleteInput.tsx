import React, { useState, useMemo } from "react";
import { Input } from "./input";

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  id?: string;
  name?: string;
}

export function AutocompleteInput({ value, onChange, options, placeholder, id, name }: AutocompleteInputProps) {
  const [show, setShow] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const filtered = useMemo(() =>
    options.filter(opt => opt.toLowerCase().includes(inputValue.toLowerCase())),
    [inputValue, options]
  );
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        autoComplete="off"
        value={inputValue}
        placeholder={placeholder}
        onFocus={() => setShow(true)}
        onBlur={() => setTimeout(() => setShow(false), 100)}
        onChange={e => {
          setInputValue(e.target.value);
          onChange(e.target.value);
        }}
      />
      {show && filtered.length > 0 && (
        <div className="absolute z-10 bg-popover border w-full max-h-40 overflow-auto shadow rounded">
          {filtered.map(opt => (
            <div
              key={opt}
              className="px-3 py-1 hover:bg-accent cursor-pointer"
              onMouseDown={() => {
                setInputValue(opt);
                onChange(opt);
                setShow(false);
              }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}