
"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { Control } from "react-hook-form";

interface CheckboxGroupProps {
    control: Control<any>;
    name: string;
    label: string;
    options: readonly string[];
}

export const CheckboxGroup = ({ control, name, label, options }: CheckboxGroupProps) => (
    <FormField
      control={control}
      name={name}
      render={() => (
        <FormItem>
          <FormLabel className="text-base">{label}</FormLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            {options.map((item) => (
              <FormField
                key={item}
                control={control}
                name={name}
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 hover:bg-muted/50 has-[:checked]:bg-primary/10 has-[:checked]:border-primary transition-colors">
                    <FormControl>
                      <Checkbox
                        checked={field.value?.includes(item)}
                        onCheckedChange={(checked) => {
                          return checked
                            ? field.onChange([...(field.value || []), item])
                            : field.onChange(field.value?.filter((value: string) => value !== item));
                        }}
                      />
                    </FormControl>
                    <FormLabel className="font-normal cursor-pointer w-full">{item}</FormLabel>
                  </FormItem>
                )}
              />
            ))}
          </div>
           <FormMessage />
        </FormItem>
      )}
    />
);
