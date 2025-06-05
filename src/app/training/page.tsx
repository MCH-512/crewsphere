
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { CheckCircle, BookOpen, PlayCircle, Award } from "lucide-react";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";

interface CompletedTraining {
  id: string;
  title: string;
  dateCompleted: string;
  provider: string;
  certificateId: string;
  icon: LucideIcon;
  imageHint: string;
  expiryDate?: string;
}

const completedTrainings: CompletedTraining[] = [
  { id: "CT001", title: "Basic Safety Procedures", dateCompleted: "2024-03-15", provider: "In-House", certificateId: "CERT-BSP-001", icon: CheckCircle, imageHint: "safety checkmark", expiryDate: "2026-03-15" },
  { id: "CT002", title: "Customer Service Excellence", dateCompleted: "2024-01-20", provider: "SkyHigh Training Co.", certificateId: "CERT-CSE-002", icon: Award, imageHint: "customer service award" },
  { id: "CT003", title: "First Aid & CPR Certification", dateCompleted: "2023-11-05", provider: "Red Cross", certificateId: "CERT-FA-CPR-003", icon: CheckCircle, imageHint: "first aid", expiryDate: "2025-11-05" },
];

const recommendedCourses = [
  { id: "RC001", title: "Advanced Crew Resource Management (CRM)", description: "Enhance teamwork and decision-making skills in high-pressure situations.", progress: 0, type: "Advanced", icon: BookOpen, imageHint: "team collaboration" },
  { id: "RC002", title: "Handling Difficult Passengers", description: "Strategies for de-escalation and managing challenging passenger interactions.", progress: 25, type: "Specialization", icon: PlayCircle, imageHint: "conflict resolution" },
  { id: "RC003", title: "Aviation Security Awareness", description: "Updated protocols and threat identification techniques.", progress: 75, type: "Mandatory Update", icon: BookOpen, imageHint: "security shield" },
];

export default function TrainingPage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">My Training Dashboard</CardTitle>
          <CardDescription>Track your completed trainings and explore recommended courses to enhance your skills.</CardDescription>
        </CardHeader>
        <CardContent>
           <p className="text-muted-foreground">Stay up-to-date with your certifications and continuously improve your expertise.</p>
        </CardContent>
      </Card>

      <section>
        <h2 className="text-xl font-semibold mb-4 font-headline flex items-center">
          <CheckCircle className="mr-2 h-6 w-6 text-green-500" />
          Completed Trainings
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {completedTrainings.map((training) => {
            const Icon = training.icon;
            return (
            <Card key={training.id} className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Image src={`https://placehold.co/80x80.png`} alt={training.title} width={60} height={60} className="rounded-lg" data-ai-hint={training.imageHint} />
                  <div>
                    <CardTitle className="text-lg">{training.title}</CardTitle>
                    <Badge variant="secondary" className="mt-1 bg-green-100 text-green-700 border-green-300">Completed</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Date Completed: {training.dateCompleted}
                </p>
                <p className="text-sm text-muted-foreground">Provider: {training.provider}</p>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="mt-4 w-full">View Certificate</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[650px]">
                    <DialogHeader>
                      <DialogTitle>Certificate of Completion</DialogTitle>
                      <DialogDescription>
                        This certificate is awarded for the successful completion of the {training.title} training program.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="mx-auto my-4">
                        <Image src="https://placehold.co/500x350.png" alt="Certificate Preview" width={500} height={350} className="rounded-md border" data-ai-hint="certificate document" />
                      </div>
                      <div className="space-y-1 text-sm">
                        <p><strong>Issued to:</strong> Alex Crewman (Demo User)</p>
                        <p><strong>Training Program:</strong> {training.title}</p>
                        <p><strong>Certificate ID:</strong> {training.certificateId}</p>
                        <p><strong>Date Issued:</strong> {training.dateCompleted}</p>
                        <p><strong>Issuing Body:</strong> {training.provider}</p>
                        {training.expiryDate && <p><strong>Valid Until:</strong> {training.expiryDate}</p>}
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="secondary">Close</Button>
                      </DialogClose>
                      <Button type="button" onClick={() => alert('Download functionality not implemented yet.')}>Download PDF</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )})}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4 font-headline flex items-center">
          <BookOpen className="mr-2 h-6 w-6 text-primary" />
          Recommended & In-Progress Courses
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {recommendedCourses.map((course) => {
             const Icon = course.icon;
             return (
            <Card key={course.id} className="shadow-md hover:shadow-lg transition-shadow">
               <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Image src={`https://placehold.co/80x80.png`} alt={course.title} width={60} height={60} className="rounded-lg" data-ai-hint={course.imageHint} />
                  <div>
                    <CardTitle className="text-lg">{course.title}</CardTitle>
                     <Badge variant="default" className="mt-1">{course.type}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3 h-16 overflow-hidden">
                  {course.description}
                </p>
                {course.progress > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-sm text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>{course.progress}%</span>
                    </div>
                    <Progress value={course.progress} aria-label={`${course.title} progress ${course.progress}%`} />
                  </div>
                )}
                <Button className="w-full" disabled={course.progress === 100}>
                  {course.progress === 0 && "Enroll Now"}
                  {course.progress > 0 && course.progress < 100 && "Continue Course"}
                  {course.progress === 100 && "Completed"}
                </Button>
              </CardContent>
            </Card>
          )})}
        </div>
      </section>
      <div className="text-center mt-8">
        <Button variant="link">Browse Full Course Catalog</Button>
      </div>
    </div>
  );
}

