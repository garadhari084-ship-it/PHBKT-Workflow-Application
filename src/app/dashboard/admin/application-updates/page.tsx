'use client';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, ArrowLeft } from 'lucide-react';
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function ApplicationUpdatesPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const firestore = useFirestore();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
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

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        variant: 'destructive',
        title: 'No File Selected',
        description: 'Please select a file to upload.',
      });
      return;
    }

    if (!firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Firestore is not available.',
      });
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const configRef = doc(firestore, 'app_config/main');
      const payload = { logoUrl: dataUrl };
      try {
        await setDoc(configRef, payload, { merge: true });
        toast({
          title: 'Logo Updated',
          description: 'The application logo has been successfully updated for all users.',
        });
      } catch (error) {
          console.error("Error updating logo:", error);
          const permissionError = new FirestorePermissionError({
            path: configRef.path,
            operation: 'update',
            requestResourceData: payload,
          });
          errorEmitter.emit('permission-error', permissionError);
          toast({
            variant: 'destructive',
            title: 'Upload Failed',
            description: 'Could not save the new logo. You may not have permissions.',
          });
      } finally {
        setIsUploading(false);
        setSelectedFile(null);
      }
    };
    reader.onerror = (error) => {
      setIsUploading(false);
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: 'There was an error reading the file.',
      });
      console.error('FileReader error:', error);
    };
  };

  return (
    <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto px-2 md:px-4 lg:px-6 py-4 md:py-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-2xl font-bold">Application Updates</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Update Application Logo</CardTitle>
            <CardDescription>
              Upload a new image to replace the existing application logo. The logo will be updated across the app for all users.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <Input
                id="logo-upload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="flex-grow"
              />
            </div>
            {selectedFile && <p className="text-sm text-muted-foreground">Selected file: {selectedFile.name}</p>}
            <Button onClick={handleUpload} disabled={isUploading || !selectedFile}>
              {isUploading ? 'Uploading...' : 'Upload and Update Logo'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
