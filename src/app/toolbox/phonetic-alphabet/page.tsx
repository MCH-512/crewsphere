"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic } from "lucide-react";

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

export default function PhoneticAlphabetPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline flex items-center">
            <Mic className="mr-3 h-7 w-7 text-primary" />
            Phonetic Alphabet (ICAO)
          </CardTitle>
          <CardDescription>
            A quick reference for the International Radiotelephony Spelling Alphabet, used for clear communication.
          </CardDescription>
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
