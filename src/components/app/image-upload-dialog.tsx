'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { WorkItem } from '@/lib/types';
import { Upload } from 'lucide-react';

interface ImageUploadDialogProps {
  workItem: WorkItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImageUploadDialog({ workItem, open, onOpenChange }: ImageUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type.startsWith('image/')) {
        setSelectedFile(file);
      } else {
        toast({
          variant: 'destructive',
          title: 'Invalid File Type',
          description: 'Please select an image file.',
        });
        setSelectedFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !firestore || !user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No file selected, database not available, or user not logged in.',
      });
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const documentsCollectionRef = collection(firestore, 'work_items', workItem.id, 'documents');
      const newDocument = {
        name: selectedFile.name,
        url: dataUrl,
        uploadedAt: new Date().toISOString(),
        uploadedById: user.uid,
        workItemId: workItem.id,
        type: 'IMAGE',
        direction: 'INBOUND',
        documentSource: 'MANUAL',
        businessEvent: 'UPLOAD',
      };

      try {
        await addDoc(documentsCollectionRef, newDocument);
        toast({
          title: 'Image Uploaded',
          description: 'The image has been successfully added to the work item.',
        });
        onOpenChange(false);
      } catch (error) {
        console.error('Error uploading image:', error);
        const permissionError = new FirestorePermissionError({
            path: documentsCollectionRef.path,
            operation: 'create',
            requestResourceData: { ...newDocument, url: '[data url]' },
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: 'destructive',
          title: 'Upload Failed',
          description: 'Could not save the image. You may not have permissions.',
        });
      } finally {
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
      setIsUploading(false);
      toast({
        variant: 'destructive',
        title: 'File Read Error',
        description: 'There was an error reading the file.',
      });
    };
  };

  // Reset file on dialog close
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSelectedFile(null);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Image</DialogTitle>
          <DialogDescription>
            Select an image to attach to this work item. It will be visible in the "Images" tab.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="image-upload" className="text-right">
              Image
            </Label>
            <Input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="col-span-3"
            />
          </div>
          {selectedFile && (
            <p className="text-sm text-muted-foreground text-center">Selected: {selectedFile.name}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={isUploading || !selectedFile}>
            {isUploading ? 'Uploading...' : <><Upload className="mr-2 h-4 w-4" /> Upload</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
