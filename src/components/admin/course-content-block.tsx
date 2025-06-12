
import * as React from 'react';
import { useFormContext, useFieldArray, Controller } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Trash2, UploadCloud } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReactQuill from 'react-quill';
import { storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Progress } from "@/components/ui/progress";
import 'react-quill/dist/quill.snow.css';
import type { Chapter } from '@/schemas/course-schema'; // Import Chapter type

interface CourseContentBlockProps {
  name: string; // Path to the array this block belongs to (e.g., "chapters" or "chapters.0.children")
  index: number; // Index of this block within its parent array
  removeSelf: () => void;
  level: number; // 0 for main chapters, 1 for sub-chapters, etc.
  control: any; // Pass control from the main form
}

const CourseContentBlock: React.FC<CourseContentBlockProps> = ({
  name,
  index,
  removeSelf,
  level,
  control, // Receive control as a prop
}) => {
  const { watch, setValue, getValues } = useFormContext(); // getValues can be used to get form state for complex logic
  const { toast } = useToast();
  const fileInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const [uploadStatus, setUploadStatus] = React.useState<{ resourceIndex: number | null; progress: number | null; isLoading: boolean }>({ resourceIndex: null, progress: null, isLoading: false });

  const currentBlockPath = `${name}.${index}`;

  const {
    fields: resourceFields,
    append: appendResource,
    remove: removeResource,
  } = useFieldArray({
    control,
    name: `${currentBlockPath}.resources` as any, // Correct path for resources array
  });

  const handleFileUpload = async (resourceIndex: number, file: File) => {
    setUploadStatus({ resourceIndex, progress: 0, isLoading: true });

    const uniqueFileName = `${new Date().getTime()}-${file.name.replace(/\s+/g, '_')}`;
    const fileStoragePath = `courseResources/${uniqueFileName}`;
    const materialStorageRef = storageRef(storage, fileStoragePath);
    const uploadTask = uploadBytesResumable(materialStorageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        setUploadStatus(prev => ({ ...prev, progress: (snapshot.bytesTransferred / snapshot.totalBytes) * 100 }));
      },
      (error) => {
        console.error("Upload failed:", error);
        toast({ title: "File Upload Failed", description: error.message, variant: "destructive" });
        setUploadStatus({ resourceIndex: null, progress: null, isLoading: false });
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setValue(`${currentBlockPath}.resources.${resourceIndex}.url`, downloadURL);
        setValue(`${currentBlockPath}.resources.${resourceIndex}.filename`, file.name);
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'file';
        let resourceType = 'file';
        if (['pdf'].includes(fileExtension)) resourceType = 'pdf';
        else if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension)) resourceType = 'image';
        else if (['mp4', 'mov', 'webm'].includes(fileExtension)) resourceType = 'video';
        setValue(`${currentBlockPath}.resources.${resourceIndex}.type`, resourceType);
        
        setUploadStatus({ resourceIndex: null, progress: null, isLoading: false });
        if (fileInputRefs.current[resourceIndex]) {
            fileInputRefs.current[resourceIndex]!.value = ""; // Reset file input
        }
      }
    );
  };

  const {
    fields: childrenFields,
    append: appendChild,
    remove: removeChild,
  } = useFieldArray({
    control,
    name: `${currentBlockPath}.children` as any, // Correct path for children array
  });

  const indentation = level * 24; // Adjust as needed for visual spacing (e.g., 1.5rem per level)

  const watchedChapters = watch(name.split('.')[0]); // Watch the top-level chapters array
  const mainChaptersLength = Array.isArray(watchedChapters) ? watchedChapters.length : 0;


  return (
    <Card style={{ marginLeft: `${indentation}px` }} className={`mb-4 ${level > 0 ? 'border-l-4 border-primary/30 pl-4' : ''} bg-card`}>
      <CardHeader className="flex flex-row justify-between items-center py-3 px-4">
        <CardTitle className="text-lg font-semibold flex items-center">
            {level === 0 ? `Chapter ${index + 1}` : `Section ${level}.${index + 1}`}
        </CardTitle>
        <div className="flex gap-2">
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendChild({ title: '', content: '', resources: [], children: [] } as Chapter)} // Ensure correct type for append
                className="flex items-center"
            >
                <PlusCircle className="mr-1 h-4 w-4" /> Add Sub-section
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (level === 0 && mainChaptersLength <= 1) {
                     toast({ title: "Cannot Remove", description: "Course must have at least one main chapter.", variant: "destructive" });
                     return;
                  }
                  removeSelf();
                }}  
                className="text-destructive hover:text-destructive/80 h-8 w-8"
                disabled={level === 0 && mainChaptersLength <= 1}
            >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Remove {level === 0 ? 'Chapter' : 'Section'}</span>
            </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0 px-4 pb-4">
        <FormField
          name={`${currentBlockPath}.title`}
          control={control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{level === 0 ? 'Chapter' : 'Section'} Title*</FormLabel>
              <FormControl>
                <Input placeholder={`Enter title for ${level === 0 ? 'chapter' : 'section'} ${index + 1}`} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name={`${currentBlockPath}.content`}
          control={control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Content</FormLabel>
              <FormControl>
                <ReactQuill
                  theme="snow" 
                  value={field.value || ""}
                  onChange={field.onChange}
                  modules={{
                    toolbar: [['bold', 'italic', 'underline', 'strike'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['link', 'image', 'video'], ['clean'], [{ 'header': [1, 2, 3, 4, 5, 6, false] }], [{ 'align': [] }]],
                  }}
                  placeholder={`Enter content for ${level === 0 ? 'chapter' : 'section'} ${index + 1}...`}
                  className="min-h-[200px] bg-background" 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="border-t pt-4 mt-4 space-y-4">
            <FormLabel className="text-md font-medium">Resources</FormLabel>
            {resourceFields.map((resourceItem, resourceIndex) => (
                <div key={resourceItem.id} className="flex flex-col md:flex-row items-start gap-3 p-3 border rounded-md bg-muted/30">
                    <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                        <FormField
                            name={`${currentBlockPath}.resources.${resourceIndex}.type`}
                            control={control}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Type</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || "file"}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="file">Generic File</SelectItem><SelectItem value="pdf">PDF</SelectItem>
                                            <SelectItem value="image">Image</SelectItem><SelectItem value="video">Video</SelectItem>
                                            <SelectItem value="link">Link/URL</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            name={`${currentBlockPath}.resources.${resourceIndex}.url`}
                            control={control}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">URL / File</FormLabel>
                                    <div className="flex gap-2">
                                        <Input placeholder="Enter URL or Upload" {...field} value={field.value || ""} disabled={uploadStatus.isLoading && uploadStatus.resourceIndex === resourceIndex} />
                                        <input type="file" ref={el => fileInputRefs.current[resourceIndex] = el} className="hidden"
                                            onChange={(e) => { if (e.target.files?.[0]) { handleFileUpload(resourceIndex, e.target.files[0]); } }}
                                            disabled={uploadStatus.isLoading} />
                                        <Button type="button" variant="outline" size="icon" onClick={() => fileInputRefs.current[resourceIndex]?.click()} disabled={uploadStatus.isLoading} className="h-10 w-10">
                                            <UploadCloud className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    {uploadStatus.isLoading && uploadStatus.resourceIndex === resourceIndex && uploadStatus.progress !== null && (
                                        <Progress value={uploadStatus.progress} className="w-full h-1.5 mt-1" />
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            name={`${currentBlockPath}.resources.${resourceIndex}.filename`}
                            control={control}
                             render={({ field }) => (
                                <FormItem className="sm:col-span-2">
                                    <FormLabel className="text-xs">Display Filename (Optional)</FormLabel>
                                     <FormControl><Input placeholder="Filename (auto-filled on upload)" {...field} value={field.value || ""} /></FormControl>
                                     <FormMessage />
                                </FormItem>
                             )}
                         />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeResource(resourceIndex)} className="text-destructive hover:text-destructive/80 mt-2 md:mt-0 md:self-center h-8 w-8 shrink-0" disabled={uploadStatus.isLoading}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remove Resource</span>
                    </Button>
                </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => appendResource({ url: '', type: 'file', filename: '' })} disabled={uploadStatus.isLoading}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Resource
            </Button>
        </div>

        {childrenFields.map((childField, childIndex) => (
          <CourseContentBlock
            key={childField.id}
            control={control} // Pass control down
            name={`${currentBlockPath}.children`}
            index={childIndex}
            removeSelf={() => removeChild(childIndex)}
            level={level + 1}
          />
        ))}
      </CardContent>
    </Card>
  );
};

export default CourseContentBlock;
