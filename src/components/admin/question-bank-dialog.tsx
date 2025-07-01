
"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, PlusCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import type { StoredQuestion } from "@/schemas/quiz-question-schema";
import { useToast } from "@/hooks/use-toast";

interface QuestionBankDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAddQuestions: (questions: StoredQuestion[]) => void;
  existingQuestionIds: string[]; 
}

export function QuestionBankDialog({ isOpen, onOpenChange, onAddQuestions, existingQuestionIds }: QuestionBankDialogProps) {
  const [allQuestions, setAllQuestions] = React.useState<StoredQuestion[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedQuestions, setSelectedQuestions] = React.useState<StoredQuestion[]>([]);
  const { toast } = useToast();

  React.useEffect(() => {
    if (isOpen) {
      const fetchQuestions = async () => {
        setIsLoading(true);
        setSelectedQuestions([]); 
        try {
          const q = query(collection(db, "questions"), orderBy("createdAt", "desc"));
          const snapshot = await getDocs(q);
          const fetchedQuestions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredQuestion));
          setAllQuestions(fetchedQuestions);
        } catch (error) {
          toast({ title: "Error", description: "Could not fetch question bank.", variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      };
      fetchQuestions();
    }
  }, [isOpen, toast]);
  
  const filteredQuestions = allQuestions.filter(q => {
    if (existingQuestionIds.includes(q.id)) {
      return false;
    }
    if (searchTerm) {
      return q.questionText.toLowerCase().includes(searchTerm.toLowerCase()) || q.category.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  });

  const handleSelectQuestion = (question: StoredQuestion, checked: boolean) => {
    if (checked) {
      setSelectedQuestions(prev => [...prev, question]);
    } else {
      setSelectedQuestions(prev => prev.filter(q => q.id !== question.id));
    }
  };

  const handleAddSelected = () => {
    onAddQuestions(selectedQuestions);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Questions from Bank</DialogTitle>
          <DialogDescription>Select questions to add to this course's quiz.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by text or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <ScrollArea className="flex-grow border rounded-md p-2">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredQuestions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">No available questions found.</p>
          ) : (
            <div className="space-y-2">
              {filteredQuestions.map(q => (
                <div key={q.id} className="flex items-start space-x-3 p-3 rounded-md border bg-card hover:bg-muted/50">
                   <Checkbox
                    id={`q-${q.id}`}
                    checked={selectedQuestions.some(sq => sq.id === q.id)}
                    onCheckedChange={(checked) => handleSelectQuestion(q, !!checked)}
                    className="mt-1"
                  />
                  <label htmlFor={`q-${q.id}`} className="flex-grow cursor-pointer">
                    <p className="font-medium text-sm">{q.questionText}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline">{q.category}</Badge>
                      <Badge variant="secondary">{q.questionType.toUpperCase()}</Badge>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleAddSelected} disabled={selectedQuestions.length === 0}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add {selectedQuestions.length} Selected Question(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
