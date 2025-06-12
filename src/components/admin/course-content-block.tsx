import * as React from 'react';
import { useFormContext, useFieldArray, Controller } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Trash2, UploadCloud, FileText as FileTextIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input'; // Keep Input for title
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReactQuill from 'react-quill';
import { storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Input } from '@/components/ui/input'; // Keep Input for title
import ReactQuill from 'react-quill';
  // 'name' prop is required for useFieldArray in the parent
  name: string; 
  index: number;
  removeSelf: () => void;
  level: number; // 0 for main chapters, 1 for sub-chapters, etc.
}

import 'react-quill/dist/quill.snow.css'; // Styles de l'éditeur
const CourseContentBlock: React.FC<CourseContentBlockProps> = ({
  name,
 index,
  removeSelf,
  level,
}) => {
  const { control, formState, watch, setValue } = useFormContext();
  const { toast } = useToast();
  const fileInputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const [uploadStatus, setUploadStatus] = React.useState<{ index: number | null; progress: number | null; isLoading: boolean }>({ index: null, progress: null, isLoading: false });



  const {
    fields: resourceFields,
    append: appendResource,
    remove: removeResource,
  } = useFieldArray({
    control,
    name: `${name}.resources` as `chapters.${number}.resources`, // Type assertion for nested field array
  });

  const handleFileUpload = async (resourceIndex: number, file: File) => {
    setUploadStatus({ index: resourceIndex, progress: 0, isLoading: true });

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
        setUploadStatus({ index: null, progress: null, isLoading: false });
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        setValue(`${name}.resources.${resourceIndex}.url`, downloadURL);
        setValue(`${name}.resources.${resourceIndex}.filename`, file.name);
        // Attempt to guess type based on extension (basic)
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'file';
        let resourceType = 'file';
        if (['pdf'].includes(fileExtension)) resourceType = 'pdf';
        else if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension)) resourceType = 'image';
        else if (['mp4', 'mov', webm].includes(fileExtension)) resourceType = 'video';
        setValue(`${name}.resources.${resourceIndex}.type`, resourceType);
        
        setUploadStatus({ index: null, progress: null, isLoading: false });
      }
    );
  };

  const {
    fields: childrenFields,
    append: appendChild,
    remove: removeChild,
  } = useFieldArray({
    control,
    name: `${name}.${index}.children` as 'chapters.0.children', // Adjust type based on your form structure
  });

  const indentation = level * 20; // Adjust as needed for visual spacing

  // Watch the children array length to conditionally show remove button
  const watchedChildren = watch(`${name}.${index}.children`);
  const canRemove = level === 0 ? (formState.defaultValues as any)?.chapters?.length > 1 || watchedChildren?.length > 0 : true; // Allow removing child block if not the last main chapter or if it has children

  return (
    <Card style={{ marginLeft: `${indentation}px` }} className={`mb-4 ${level > 0 ? 'border-l-2 border-primary/50 pl-4' : ''}`}>
      <CardHeader className="flex flex-row justify-between items-center py-3 pr-3 pl-0">
        <CardTitle className="text-lg font-semibold flex items-center">
            {level === 0 ? `Chapter ${index + 1}` : `Section ${index + 1}`}
        </CardTitle>
        <div className="flex gap-2">
            {/* Button to add a sub-block (child) */}
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendChild({ title: '', content: '', resources: [], children: [] })}
                className="flex items-center"
            >
                <PlusCircle className="mr-1 h-4 w-4" /> Add Sub-section
            </Button>
            {/* Button to remove the current block */}
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (level === 0 && (formState.defaultValues as any)?.chapters?.length <= 1 && childrenFields.length === 0) {
                     toast({ title: "Cannot Remove", description: "Course must have at least one main chapter.", variant: "destructive" });
                     return;
                  }
                  removeSelf();
                }}  
                className="text-destructive hover:text-destructive/80"
                disabled={level === 0 && (formState.defaultValues as any)?.chapters?.length <= 1 && childrenFields.length === 0}
            >
                <Trash2 className="h-4 w-4" /> Remove {level === 0 ? 'Chapter' : 'Section'}
            </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Title Field */}
        <FormField
          name={`${name}.${index}.title`}
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

        {/* Content Field */}
        <FormField
          name={`${name}.${index}.content`}
          control={control} // Make sure control is passed correctly from the parent
          render={({ field }) => (
            <FormItem>
              <FormLabel>Content (Text/HTML/Markdown)</FormLabel>
              <FormControl>
                <ReactQuill
                  theme="snow" // or "bubble"
                  value={field.value}
                  onChange={field.onChange}
                  modules={{
                    toolbar: [['bold', 'italic', 'underline'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['link', 'image'], ['clean']],
                  }}
                  placeholder={`Enter content for ${level === 0 ? 'chapter' : 'section'} ${index + 1}...`}
                  className="min-h-[150px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Resources Section */}
        <div className="border-t pt-4 mt-4 space-y-4">
            <FormLabel className="text-md font-medium">Resources</FormLabel>
            {resourceFields.map((resourceItem, resourceIndex) => (
                <div key={resourceItem.id} className="flex items-start gap-3 p-3 border rounded-md">
                    <div className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Resource Type */}
                        <FormField
                            name={`${name}.resources.${resourceIndex}.type` as `chapters.${number}.resources.${number}.type`}
                            control={control}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="sr-only">Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="file">Generic File</SelectItem>
                                            <SelectItem value="pdf">PDF</SelectItem>
                                            <SelectItem value="image">Image</SelectItem>
                                            <SelectItem value="video">Video</SelectItem>
                                            <SelectItem value="link">Link/URL</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {/* Resource URL/Upload */}
                        <FormField
                            name={`${name}.resources.${resourceIndex}.url` as `chapters.${number}.resources.${number}.url`}
                            control={control}
                            render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                    <FormLabel className="sr-only">URL</FormLabel>
                                    <FormControl>
                                        <div className="flex gap-2">
                                             <Input placeholder="Enter URL or Upload File" {...field} disabled={uploadStatus.isLoading && uploadStatus.index === resourceIndex} />
                                             <input
                                                type="file"
                                                ref={el => fileInputRefs.current[resourceIndex] = el}
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) {
                                                        handleFileUpload(resourceIndex, e.target.files[0]);
                                                    }
                                                }}
                                                disabled={uploadStatus.isLoading}
                                            />
                                             <Button type="button" variant="outline" size="sm" onClick={() => fileInputRefs.current[resourceIndex]?.click()} disabled={uploadStatus.isLoading}><UploadCloud className="h-4 w-4" /></Button>
                                        </div>
                                    </FormControl>
                                    {uploadStatus.isLoading && uploadStatus.index === resourceIndex && uploadStatus.progress !== null && (
                                        <Progress value={uploadStatus.progress} className="w-full mt-1" />
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {/* Optional Filename Display/Field */}
                         <FormField
                            name={`${name}.resources.${resourceIndex}.filename` as `chapters.${number}.resources.${number}.filename`}
                            control={control}
                             render={({ field }) => (
                                <FormItem className="md:col-span-3">
                                    <FormLabel className="sr-only">Filename</FormLabel>
                                     <FormControl>
                                         <Input placeholder="Filename (auto-filled on upload)" {...field} disabled />
                                     </FormControl>
                                     <FormMessage />
                                </FormItem>
                             )}
                         />
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeResource(resourceIndex)} className="text-destructive hover:text-destructive/80" disabled={uploadStatus.isLoading}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => appendResource({ url: '', type: 'file', filename: '' })} disabled={uploadStatus.isLoading}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Resource
            </Button>
        </div>

        {/* Recursive Rendering of Children Blocks */}
        {childrenFields.map((childField, childIndex) => (
          <CourseContentBlock
            key={childField.id}
            name={`${name}.${index}.children`} // Pass the nested name
            index={childIndex}
            removeSelf={() => removeChild(childIndex)}
            level={level + 1} // Increase level for children
          />
        ))}
      </CardContent>
    </Card>
  );
};

export default CourseContentBlock;