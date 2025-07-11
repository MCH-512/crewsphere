
"use client";

import * as React from "react";
import { X, Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "./button";

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
  const [open, setOpen] = React.useState(false);

  const handleUnselect = (valueToRemove: string) => {
    onChange(selected.filter((v) => v !== valueToRemove));
  };

  const handleSelect = (valueToAdd: string) => {
    // If the value is already selected, unselect it. Otherwise, add it.
    if (selected.includes(valueToAdd)) {
        handleUnselect(valueToAdd);
    } else {
        onChange([...selected, valueToAdd]);
    }
  };

  const selectedOptions = options.filter(option => selected.includes(option.value));

  return (
    <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
            <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className={cn("w-full justify-between h-auto min-h-10", className)}
                onClick={() => setOpen(!open)}
            >
                <div className="flex flex-wrap gap-1">
                    {selectedOptions.length > 0 ? (
                        selectedOptions.map((option) => (
                        <Badge
                            key={option.value}
                            variant="secondary"
                            className="mr-1"
                            aria-label={`Remove ${option.label}`}
                            onClick={(e) => {
                                e.stopPropagation(); // prevent popover from closing
                                handleUnselect(option.value);
                            }}
                        >
                            {option.label}
                            <X className="ml-1 h-3 w-3" />
                        </Badge>
                        ))
                    ) : (
                        <span className="text-muted-foreground">{placeholder}</span>
                    )}
                </div>
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                 const isSelected = selected.includes(option.value);
                 return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleSelect(option.value)}
                    value={option.label}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
