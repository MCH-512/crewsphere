
"use client";

import * as React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';

interface SortableHeaderProps<T> {
  column: T;
  label: string;
  sortColumn: T;
  sortDirection: 'asc' | 'desc';
  onSort: (column: T) => void;
}

export function SortableHeader<T extends string>({
  column,
  label,
  sortColumn,
  sortDirection,
  onSort,
}: SortableHeaderProps<T>) {
  return (
    <TableHead
      onClick={() => onSort(column)}
      className="cursor-pointer hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        {label}
        {sortColumn === column ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )}
      </div>
    </TableHead>
  );
}
