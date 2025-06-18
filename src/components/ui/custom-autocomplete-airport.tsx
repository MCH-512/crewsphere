
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
import { getAirportByCode } from "@/services/airport-service"; // Import the service function

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
    let isMounted = true;

    const updateDisplayForValue = async () => {
      if (value) {
        // Check if the display is already correctly formatted for the current value
        const currentCodeInDisplay = selectedAirportDisplay?.match(/\(([^)]+)\)/)?.[1];
        if (selectedAirportDisplay && selectedAirportDisplay !== value && currentCodeInDisplay?.toLowerCase() === value.toLowerCase()) {
          // Already displaying full name + code, and code matches.
          return;
        }

        const airportDetails = await getAirportByCode(value);
        if (isMounted) {
          if (airportDetails) {
            setSelectedAirportDisplay(`${airportDetails.name} (${airportDetails.iata || airportDetails.icao})`);
          } else {
            setSelectedAirportDisplay(value); // Fallback to just code if not found
          }
        }
      } else {
        if (isMounted) {
          setSelectedAirportDisplay(null);
        }
      }
    };

    updateDisplayForValue();

    return () => {
      isMounted = false;
    };
  }, [value, selectedAirportDisplay]); // Re-run if `value` changes or if `selectedAirportDisplay` was out of sync

  const handleSelect = (airport: Airport) => {
    onSelect(airport); // This will trigger the parent form to update its `value` (the code)
    setSelectedAirportDisplay(`${airport.name} (${airport.iata || airport.icao})`); // Set display immediately
    onInputChange(""); // Clear search input after selection
    setOpen(false);
  };

  const handleClear = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onSelect(null);
    setSelectedAirportDisplay(null);
    onInputChange("");
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
        className="p-0 min-w-[var(--radix-popover-trigger-width)] w-auto max-w-md md:max-w-lg" 
        align="start"
        style={{ '--radix-popover-trigger-width': 'auto' } as React.CSSProperties} // Allow popover to be wider
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
                    key={airport.icao || airport.iata} 
                    value={`${airport.name} ${airport.city} ${airport.iata || ''} ${airport.icao || ''}`.trim()} 
                    onSelect={() => handleSelect(airport)}
                    className="text-xs cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        (value && (value.toLowerCase() === airport.icao?.toLowerCase() || value.toLowerCase() === airport.iata?.toLowerCase())) ? "opacity-100" : "opacity-0"
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
