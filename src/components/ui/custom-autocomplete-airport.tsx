
"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Check, ChevronsUpDown, PlaneTakeoff, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { Airport } from "@/services/airport-service";

interface CustomAutocompleteAirportProps {
  value?: string; // The selected airport's ICAO or IATA code
  onSelect: (airport: Airport | null) => void;
  placeholder?: string;
  airports: Airport[];
  isLoading?: boolean;
  onInputChange: (search: string) => void;
  currentSearchTerm: string;
}

export function CustomAutocompleteAirport({
  value,
  onSelect,
  placeholder = "Select airport...",
  airports,
  isLoading = false,
  onInputChange,
  currentSearchTerm,
}: CustomAutocompleteAirportProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedAirportDisplay, setSelectedAirportDisplay] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (value) {
      // Attempt to find the airport in the current suggestions or a broader list if available
      // For now, this relies on the `airports` prop being up-to-date or the value being a direct code.
      const airport = airports.find(
        (a) => (a.icao && a.icao.toLowerCase() === value.toLowerCase()) || (a.iata && a.iata.toLowerCase() === value.toLowerCase())
      );
      setSelectedAirportDisplay(airport ? `${airport.name} (${airport.iata || airport.icao})` : value);
    } else {
      setSelectedAirportDisplay(null);
    }
  }, [value, airports]);

  const handleSelect = (airport: Airport) => {
    onSelect(airport);
    setSelectedAirportDisplay(`${airport.name} (${airport.iata || airport.icao})`);
    onInputChange(""); // Clear search input after selection
    setOpen(false);
  };

  const handleClear = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation(); // Prevent PopoverTrigger from re-opening if it's part of the button
    onSelect(null);
    setSelectedAirportDisplay(null);
    onInputChange("");
    // setOpen(false); // Optionally close popover on clear
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between text-sm h-10 font-normal"
          >
            <PlaneTakeoff className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            {selectedAirportDisplay ? (
              <span className="truncate">{selectedAirportDisplay}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        {selectedAirportDisplay && value && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="absolute right-8 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
            aria-label="Clear selection"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </Button>
        )}
      </div>
      <PopoverContent 
        className="p-0 min-w-[var(--radix-popover-trigger-width)] w-auto max-w-md" 
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search airport (name, IATA, ICAO)..."
            value={currentSearchTerm}
            onValueChange={onInputChange}
          />
          <CommandList>
            {isLoading && <CommandPrimitive.Loading><div className="p-2 text-sm text-center text-muted-foreground">Loading...</div></CommandPrimitive.Loading>}
            {!isLoading && airports.length === 0 && currentSearchTerm && (
              <CommandEmpty>No airport found for "{currentSearchTerm}".</CommandEmpty>
            )}
            {!isLoading && airports.length === 0 && !currentSearchTerm && (
              <CommandEmpty>Type to search airports.</CommandEmpty>
            )}
            {!isLoading && airports.length > 0 && (
              <CommandGroup>
                {airports.map((airport) => (
                  <CommandItem
                    key={airport.icao || airport.iata} // Ensure unique key
                    value={`${airport.name} ${airport.city} ${airport.iata || ''} ${airport.icao || ''}`.trim()} // Create a unique value string
                    onSelect={() => handleSelect(airport)}
                    className="text-xs cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        (value === airport.icao || value === airport.iata) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div>
                      <div className="font-medium">{airport.name} ({airport.iata || airport.icao})</div>
                      <div className="text-muted-foreground text-xs">{airport.city}, {airport.country}</div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
