
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calculator, Weight, Ruler, Wind, Thermometer } from "lucide-react";

// Conversion functions
const CONVERSIONS = {
  length: {
    m: { ft: 3.28084, label: "Meters" },
    ft: { m: 0.3048, label: "Feet" },
  },
  weight: {
    kg: { lbs: 2.20462, label: "Kilograms" },
    lbs: { kg: 0.453592, label: "Pounds" },
  },
  speed: {
    kts: { 'km/h': 1.852, mph: 1.15078, label: "Knots" },
    'km/h': { kts: 0.539957, mph: 0.621371, label: "Km/h" },
    mph: { kts: 0.868976, 'km/h': 1.60934, label: "Mph" },
  },
  temperature: {
    c: { f: (c: number) => (c * 9/5) + 32, label: "Celsius" },
    f: { c: (f: number) => (f - 32) * 5/9, label: "Fahrenheit" },
  }
};

const UnitConverter = ({ type, icon: Icon }: { type: keyof typeof CONVERSIONS; icon: React.ElementType }) => {
    const units = Object.keys(CONVERSIONS[type]);
    const [fromUnit, setFromUnit] = React.useState(units[0]);
    const [toUnit, setToUnit] = React.useState(units[1]);
    const [fromValue, setFromValue] = React.useState("1");
    const [toValue, setToValue] = React.useState("");

    React.useEffect(() => {
        const calculate = () => {
            const val = parseFloat(fromValue);
            if (isNaN(val)) {
                setToValue("");
                return;
            }
            if (fromUnit === toUnit) {
                setToValue(fromValue);
                return;
            }

            const conversionRule = (CONVERSIONS[type] as any)[fromUnit][toUnit];
            if (typeof conversionRule === 'number') {
                setToValue((val * conversionRule).toFixed(4));
            } else if (typeof conversionRule === 'function') {
                setToValue(conversionRule(val).toFixed(4));
            }
        };
        calculate();
    }, [fromValue, fromUnit, toUnit, type]);

    const handleFromValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFromValue(e.target.value);
    };

    const swapUnits = () => {
        const currentFromUnit = fromUnit;
        setFromUnit(toUnit);
        setToUnit(currentFromUnit);
        setFromValue(toValue);
    };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {type.charAt(0).toUpperCase() + type.slice(1)} Converter
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full space-y-1">
                <Select value={fromUnit} onValueChange={setFromUnit}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{Object.entries(CONVERSIONS[type]).map(([key, data]) => <SelectItem key={key} value={key}>{(data as any).label}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" value={fromValue} onChange={handleFromValueChange} />
            </div>
            
            <Button variant="ghost" size="icon" onClick={swapUnits} className="rotate-90 sm:rotate-0 flex-shrink-0" aria-label="Swap units">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-left-right h-5 w-5"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>
            </Button>
            
            <div className="flex-1 w-full space-y-1">
                <Select value={toUnit} onValueChange={setToUnit}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{Object.entries(CONVERSIONS[type]).map(([key, data]) => <SelectItem key={key} value={key}>{(data as any).label}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" value={toValue} readOnly className="bg-muted/50" />
            </div>
        </div>
      </CardContent>
    </Card>
  );
};


export default function ConvertersPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Calculator className="mr-3 h-7 w-7 text-primary" />
            Aviation Converters
          </CardTitle>
          <CardDescription>
            A tool for quick conversions of common aviation units.
          </CardDescription>
        </CardHeader>
      </Card>
      <div className="space-y-6">
        <UnitConverter type="length" icon={Ruler} />
        <UnitConverter type="weight" icon={Weight} />
        <UnitConverter type="speed" icon={Wind} />
        <UnitConverter type="temperature" icon={Thermometer} />
      </div>
    </div>
  );
}
