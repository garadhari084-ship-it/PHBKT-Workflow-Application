'use client';

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Key, Terminal, Copy, Check } from 'lucide-react';
import { useFirestore, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const formSchema = z.object({
  apiKey: z.string().min(1, 'API Key is required.'),
});

export default function ApiIntegrationPage() {
  const navigate = useNavigate();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const configRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'app_config/main');
  }, [firestore]);

  const { data: config, isLoading } = useDoc<{ externalApiKey?: string }>(configRef);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { apiKey: '' },
  });

  useEffect(() => {
    if (config?.externalApiKey) {
      form.setValue('apiKey', config.externalApiKey);
    }
  }, [config, form]);
  
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firestore) return;
    if (!configRef) return;
    
    setIsSubmitting(true);

    const payload = { externalApiKey: values.apiKey };
    try {
      await setDoc(configRef, payload, { merge: true });
      toast({
        title: 'API Key Updated',
        description: 'The external API key has been saved.',
      });
    } catch (error) {
        console.error("Error updating API key:", error);
        const permissionError = new FirestorePermissionError({
          path: configRef.path,
          operation: 'update',
          requestResourceData: payload,
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: 'Could not save the API key. You may not have permissions.',
        });
    } finally {
      setIsSubmitting(false);
    }
  };

  const endpointUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/create-work-item` : '';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };
  
  const samplePayload = `{
  "product": "Web & App Development", // * Required
  "customerName": "John Doe", // * Required
  "customerPhone": "9876543210", // * Required
  "customerEmail": "john.doe@example.com" // Optional
}`;

  return (
    <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto px-2 md:px-4 lg:px-6 py-4 md:py-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-2xl font-bold">API Integration</h1>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    <CardTitle>API Key Management</CardTitle>
                </div>
                <CardDescription>
                    Set the secret API key used to authenticate requests to the Work Item Creation API.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="apiKey"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>External API Key</FormLabel>
                                    <div className="flex gap-2">
                                        <FormControl>
                                            <Input {...field} placeholder={isLoading ? 'Loading...' : 'Paste your API key here...'} />
                                        </FormControl>
                                        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Key'}</Button>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </form>
                </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Details</CardTitle>
              <CardDescription>
                Use these details to integrate your external application.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-1 text-sm">API Endpoint URL</h3>
                <div className="p-2 flex items-center justify-between bg-muted rounded-md text-sm font-mono">
                  <span>POST {endpointUrl}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(endpointUrl)}>
                    {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-1 text-sm">Authentication Header</h3>
                <div className="p-2 bg-muted rounded-md text-sm font-mono">
                  <p>Authorization: Bearer YOUR_API_KEY</p>
                </div>
                 <p className="text-xs text-muted-foreground mt-1">Replace YOUR_API_KEY with the key you saved above.</p>
              </div>

            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                <CardTitle>Example Payload</CardTitle>
              </div>
               <CardDescription>
                Your form should send a JSON object with the fields below. Only `customerEmail` is optional.
              </CardDescription>
            </CardHeader>
            <CardContent>
               <pre className="p-3 bg-muted rounded-md text-xs overflow-x-auto">
                    <code>{samplePayload}</code>
               </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
