
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, SpellCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const phoneticAlphabet = [
  { letter: "A", word: "Alpha" }, { letter: "B", word: "Bravo" }, { letter: "C", word: "Charlie" },
  { letter: "D", word: "Delta" }, { letter: "E", word: "Echo" }, { letter: "F", word: "Foxtrot" },
  { letter: "G", word: "Golf" }, { letter: "H", word: "Hotel" }, { letter: "I", word: "India" },
  { letter: "J", word: "Juliett" }, { letter: "K", word: "Kilo" }, { letter: "L", word: "Lima" },
  { letter: "M", word: "Mike" }, { letter: "N", word: "November" }, { letter: "O", word: "Oscar" },
  { letter: "P", word: "Papa" }, { letter: "Q", word: "Quebec" }, { letter: "R", word: "Romeo" },
  { letter: "S", word: "Sierra" }, { letter: "T", word: "Tango" }, { letter: "U", "word": "Uniform" },
  { letter: "V", word: "Victor" }, { letter: "W", word: "Whiskey" }, { letter: "X", word: "X-ray" },
  { letter: "Y", word: "Yankee" }, { letter: "Z", word: "Zulu" },
  { letter: "0", word: "Zero" }, { letter: "1", word: "One" }, { letter: "2", word: "Two" },
  { letter: "3", word: "Three" }, { letter: "4", word: "Four" }, { letter: "5", word: "Five" },
  { letter: "6", word: "Six" }, { letter: "7", word: "Seven" }, { letter: "8", word: "Eight" },
  { letter: "9", word: "Nine" },
];

const phoneticAlphabetMap: Record<string, string> = phoneticAlphabet.reduce((acc, item) => {
    acc[item.letter] = item.word;
    return acc;
}, {} as Record<string, string>);

export default function PhoneticAlphabetPage() {
    const [inputText, setInputText] = React.useState("");

    const phoneticOutput = React.useMemo(() => {
        return inputText
          .toUpperCase()
          .split("")
          .map((char) => ({
            char,
            word: phoneticAlphabetMap[char] || null,
          }));
      }, [inputText]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Mic className="mr-3 h-7 w-7 text-primary" />
            Phonetic Alphabet (ICAO)
          </CardTitle>
          <CardDescription>
            A quick reference and interactive speller for the International Radiotelephony Spelling Alphabet.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
                <SpellCheck className="h-5 w-5"/>
                Interactive Speller
            </CardTitle>
            <CardDescription>Type a word or code below to see its phonetic spelling.</CardDescription>
        </CardHeader>
        <CardContent>
            <Input
                placeholder="Type here, e.g., 'A320' or 'Paris'"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="text-lg font-mono"
            />
            {inputText && (
                <div className="mt-4 p-4 bg-muted rounded-md flex flex-wrap gap-x-4 gap-y-2">
                    {phoneticOutput.map((item, index) => (
                        <div key={index} className="flex items-baseline gap-2">
                            <span className="font-bold text-lg text-primary">{item.char}</span>
                            <span>-</span>
                            <span className="text-foreground">{item.word || '??'}</span>
                        </div>
                    ))}
                </div>
            )}
        </CardContent>
      </Card>
      
       <Card>
        <CardHeader>
            <CardTitle className="text-lg">Full Alphabet Reference</CardTitle>
        </CardHeader>
        <CardContent>
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 text-sm">
            {phoneticAlphabet.map((item) => (
              <div key={item.letter} className="flex items-baseline p-2 rounded-md bg-muted/50">
                <span className="font-bold text-lg text-primary w-8">{item.letter}</span>
                <span className="text-foreground">{item.word}</span>
              </div>
            ))}
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
