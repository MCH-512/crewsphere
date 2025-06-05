
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListChecks, PlayCircle, CheckCircle, Zap } from "lucide-react";
import Image from "next/image";

const placeholderQuizzes = [
  {
    id: "QZ001",
    title: "Emergency Procedures Review",
    description: "Test your knowledge on standard emergency protocols and aircraft-specific procedures.",
    category: "Safety",
    questions: 20,
    status: "Not Started",
    imageHint: "emergency exit",
    icon: Zap,
  },
  {
    id: "QZ002",
    title: "Aircraft Systems: Boeing 787",
    description: "A comprehensive quiz covering the key systems of the Boeing 787 Dreamliner.",
    category: "Aircraft Systems",
    questions: 25,
    status: "In Progress",
    progress: 40,
    imageHint: "aircraft cockpit",
    icon: PlayCircle,
  },
  {
    id: "QZ003",
    title: "Dangerous Goods Handling",
    description: "Ensure you're up-to-date with the latest regulations for handling dangerous goods.",
    category: "Regulations",
    questions: 15,
    status: "Completed",
    score: "93%",
    imageHint: "hazard symbol",
    icon: CheckCircle,
  },
  {
    id: "QZ004",
    title: "Customer Service Scenarios",
    description: "Assess your responses to common and challenging customer service situations.",
    category: "Service",
    questions: 10,
    status: "Not Started",
    imageHint: "flight attendant",
    icon: Zap,
  },
];

export default function QuizzesPage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-start gap-4">
          <ListChecks className="h-8 w-8 text-primary mt-1" />
          <div>
            <CardTitle className="text-2xl font-headline">Quizzes</CardTitle>
            <CardDescription>
              Test your knowledge and stay sharp with our interactive quizzes. Select a quiz below to get started.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Regularly completing quizzes helps reinforce critical knowledge and procedures.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {placeholderQuizzes.map((quiz) => {
          const Icon = quiz.icon;
          return (
            <Card key={quiz.id} className="shadow-md hover:shadow-lg transition-shadow flex flex-col">
              <CardHeader className="flex-shrink-0">
                <div className="flex items-start gap-4">
                    <Image
                        src={`https://placehold.co/100x100.png`}
                        alt={quiz.title}
                        width={70}
                        height={70}
                        className="rounded-lg"
                        data-ai-hint={quiz.imageHint}
                    />
                    <div>
                        <CardTitle className="text-lg mb-1">{quiz.title}</CardTitle>
                        <Badge variant="outline">{quiz.category}</Badge>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col justify-between">
                <div>
                    <p className="text-sm text-muted-foreground mb-3 h-16 overflow-hidden">
                    {quiz.description}
                    </p>
                    <div className="text-xs text-muted-foreground mb-3">
                        <span>{quiz.questions} Questions</span>
                        {quiz.status === "Completed" && quiz.score && (
                            <span className="ml-2 font-semibold text-green-600">Score: {quiz.score}</span>
                        )}
                        {quiz.status === "In Progress" && quiz.progress !== undefined && (
                            <span className="ml-2 font-semibold text-blue-600">Progress: {quiz.progress}%</span>
                        )}
                    </div>
                </div>
                <Button className="w-full mt-2">
                  <Icon className="mr-2 h-4 w-4" />
                  {quiz.status === "Not Started" && "Start Quiz"}
                  {quiz.status === "In Progress" && "Continue Quiz"}
                  {quiz.status === "Completed" && "Review Quiz"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
       <Card className="shadow-md mt-8">
        <CardHeader>
            <CardTitle className="text-lg font-headline">Why Quizzes?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Interactive quizzes are an effective way to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Reinforce learning of critical procedures and information.</li>
              <li>Identify areas where you might need further review.</li>
              <li>Stay current with evolving standards and regulations.</li>
              <li>Prepare for formal assessments and evaluations.</li>
            </ul>
            <p className="font-semibold">New quizzes are added regularly. Check back often!</p>
        </CardContent>
      </Card>
    </div>
  );
}
