
"use client";

import * as React from "react";
import type { Chapter, Resource } from "@/schemas/course-schema";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Download, FileText, Image as ImageIcon, Link as LinkIcon, Video, File as FileGeneric, ChevronRight } from "lucide-react";

interface ChapterDisplayProps {
  chapter: Chapter;
  level: number;
}

const getResourceIcon = (type: Resource['type']) => {
  switch (type) {
    case "pdf": return <FileText className="h-4 w-4 mr-2 flex-shrink-0" />;
    case "image": return <ImageIcon className="h-4 w-4 mr-2 flex-shrink-0" />;
    case "video": return <Video className="h-4 w-4 mr-2 flex-shrink-0" />;
    case "link": return <LinkIcon className="h-4 w-4 mr-2 flex-shrink-0" />;
    case "file":
    default: return <FileGeneric className="h-4 w-4 mr-2 flex-shrink-0" />;
  }
};

const ChapterDisplay: React.FC<ChapterDisplayProps> = ({ chapter, level }) => {
  const HeadingTag = `h${Math.min(level + 3, 6)}` as keyof JSX.IntrinsicElements; // h3, h4, h5, h6

  return (
    <Card 
        className="mb-4 shadow-sm" 
        style={{ marginLeft: level > 0 ? `${level * 20}px` : '0px' }}
    >
      <CardHeader className="py-3 px-4 bg-muted/30 rounded-t-lg">
        <HeadingTag className={`font-semibold ${level === 0 ? 'text-xl' : level === 1 ? 'text-lg' : 'text-md'}`}>
          {chapter.title}
        </HeadingTag>
      </CardHeader>
      <CardContent className="pt-3 px-4 pb-4">
        {chapter.content && (
          <div className="prose prose-sm max-w-none dark:prose-invert text-foreground mb-3">
            <ReactMarkdown>{chapter.content}</ReactMarkdown>
          </div>
        )}

        {chapter.resources && chapter.resources.length > 0 && (
          <div className="mb-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1.5">Resources:</h4>
            <ul className="space-y-1">
              {chapter.resources.map((resource, index) => (
                <li key={index}>
                  <Button
                    variant="link"
                    asChild
                    className="p-0 h-auto text-sm text-primary hover:underline flex items-center justify-start text-left"
                  >
                    <a href={resource.url} target="_blank" rel="noopener noreferrer">
                      {getResourceIcon(resource.type)}
                      <span className="truncate">{resource.filename || resource.url}</span>
                      {resource.type === 'link' && <LinkIcon className="h-3 w-3 ml-1.5 flex-shrink-0" />}
                      {resource.type !== 'link' && <Download className="h-3 w-3 ml-1.5 flex-shrink-0" />}
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {chapter.children && chapter.children.length > 0 && (
          <div className="mt-3">
             <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="sub-sections" className="border-none">
                <AccordionTrigger className="text-sm font-medium py-1 px-0 hover:no-underline text-muted-foreground hover:text-primary">
                  <div className="flex items-center">
                    <ChevronRight className="h-4 w-4 mr-1 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                     Sub-sections ({chapter.children.length})
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pl-0">
                  {chapter.children.map((childChapter, childIndex) => (
                    <ChapterDisplay
                      key={childChapter.id || `child-${childIndex}`}
                      chapter={childChapter}
                      level={level + 1}
                    />
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ChapterDisplay;
