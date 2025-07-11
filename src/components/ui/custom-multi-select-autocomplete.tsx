
"use client";

import * as React from "react";
import { X, Check } from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandInput,
} from "@/components/ui/command";

interface Option {
  value: string;
  label: string;
}

interface CustomMultiSelectAutocompleteProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function CustomMultiSelectAutocomplete({
  options,
  selected,
  onChange,
  placeholder = "Select options...",
  className,
}: CustomMultiSelectAutocompleteProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const handleUnselect = (valueToRemove: string) => {
    onChange(selected.filter((v) => v !== valueToRemove));
  };

  const handleSelect = (valueToAdd: string) => {
    setInputValue("");
    onChange([...selected, valueToAdd]);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const input = inputRef.current
    if (input) {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (input.value === "" && selected.length > 0) {
          handleUnselect(selected[selected.length - 1]);
        }
      }
      if (e.key === "Escape") {
        input.blur();
      }
    }
  };

  const selectedOptions = options.filter(option => selected.includes(option.value));
  
  const filteredOptions = options.filter(option => {
    if (selected.includes(option.value)) return false;
    if (!inputValue) return true;
    return option.label.toLowerCase().includes(inputValue.toLowerCase());
  });

  return (
    <Command onKeyDown={handleKeyDown} className={cn("overflow-visible bg-transparent", className)}>
      <div className="group rounded-md border border-input px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map((option) => (
            <Badge key={option.value} variant="secondary">
              {option.label}
              <button
                className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onKeyDown={(e) => { if (e.key === "Enter") handleUnselect(option.value); }}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={() => handleUnselect(option.value)}
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            </Badge>
          ))}
          <CommandPrimitive.Input
            ref={inputRef}
            value={inputValue}
            onValueChange={setInputValue}
            onBlur={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="ml-2 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="relative mt-2">
        {open && filteredOptions.length > 0 ? (
          <div className="absolute top-0 z-10 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in">
            <CommandList>
              <CommandGroup className="h-full max-h-60 overflow-auto">
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onSelect={() => handleSelect(option.value)}
                    className={"cursor-pointer"}
                  >
                   <Check className={cn("mr-2 h-4 w-4", selected.includes(option.value) ? "opacity-100" : "opacity-0")}/>
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </div>
        ) : null}
      </div>
    </Command>
  );
}
