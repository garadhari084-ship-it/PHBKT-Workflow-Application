'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { EnhancedUser } from '@/firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import type { WorkItem } from '@/lib/types';
// Removed GenerateEmailInput import
import { Wand2, Send, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    newBusinessRequestTasks, 
    webAndAppTasks, 
    digitalMarketingTasks, 
    taxAndComplianceTasks, 
    bpoAndKpoTasks, 
    feedbackAndComplaintTasks, 
    otherServiceRequestTasks 
} from '@/lib/tasks';

const emailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1, 'Subject is required.'),
  body: z.string().min(1, 'Email body is required.'),
  template: z.string().min(1, 'Please enter an email purpose.'),
});

interface EmailComposerProps {
  workItem: WorkItem;
  user: EnhancedUser;
}

const allTasks = [...new Set([
    ...newBusinessRequestTasks, 
    ...webAndAppTasks, 
    ...digitalMarketingTasks, 
    ...taxAndComplianceTasks, 
    ...bpoAndKpoTasks, 
    ...feedbackAndComplaintTasks, 
    ...otherServiceRequestTasks
])].sort();

export default function EmailComposer({ workItem, user }: EmailComposerProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      to: workItem.customerEmail || '',
      subject: '',
      body: '',
      template: '',
    },
  });

  const handleGenerateEmail = async () => {
    const template = form.getValues('template');
    if (!template) {
      toast({
        variant: 'destructive',
        title: 'Template Required',
        description: 'Please enter an email purpose to generate content.',
      });
      return;
    }
    setIsGenerating(true);
    try {
      let geminiApiKey;
      if (firestore) {
        const configRef = doc(firestore, 'app_config/main');
        const configSnap = await getDoc(configRef);
        geminiApiKey = configSnap.data()?.geminiApiKey;
      }

      if (!geminiApiKey) {
        toast({
          variant: 'destructive',
          title: 'Configuration Missing',
          description: 'Gemini AI API Key is not configured. Please add it in the Admin Panel under API Integration.',
        });
        setIsGenerating(false);
        return;
      }

      const input = {
        customerName: workItem.customerName || 'Valued Customer',
        agentName: user.firstName || user.displayName || user.email || 'Support Agent',
        workType: workItem.workType || 'General Inquiry',
        task: workItem.tasks?.[0] || template || 'General Support',
        emailPurpose: template || 'Communication',
        companyName: 'PHBKT Group Limited',
        geminiApiKey,
      };
      const response = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        throw new Error('Failed to generate email');
      }
      const result = await response.json();
      form.setValue('subject', result.subject);
      form.setValue('body', result.body);
      toast({ title: 'AI Generated Content', description: 'Email subject and body have been populated.' });
    } catch (error) {
      console.error('Error generating email:', error);
      toast({ variant: 'destructive', title: 'Generation Failed', description: 'Could not generate email content.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendEmail = async (values: z.infer<typeof emailSchema>) => {
    if (!firestore || !user) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to send an email.' });
      return;
    }
    setIsSending(true);
    
    const emailDocument = {
      to: values.to,
      subject: values.subject,
      body: values.body,
      sentAt: new Date().toISOString(),
      sentBy: user.uid,
    };

    const documentsCollectionRef = collection(firestore, 'work_items', workItem.id, 'documents');
    const newDocumentPayload = {
        name: `Email - ${values.subject}`,
        url: JSON.stringify(emailDocument), // Store email content as JSON string
        uploadedAt: new Date().toISOString(),
        uploadedById: user.uid,
        workItemId: workItem.id,
        type: 'EMAIL',
        direction: 'OUTBOUND',
        documentSource: 'MANUAL',
        businessEvent: 'EMAIL_SENT',
    };

    try {
      // First, save the email record to Firestore
      await addDoc(documentsCollectionRef, newDocumentPayload);
      
      // Then, create and open the mailto link
      const to = encodeURIComponent(values.to);
      const subject = encodeURIComponent(values.subject);
      const body = encodeURIComponent(values.body);
      const mailtoLink = `mailto:${to}?subject=${subject}&body=${body}`;
      
      window.location.href = mailtoLink;

      toast({ title: 'Email Client Opened', description: "Your email client is opening. The email has also been saved as a record." });
      form.reset({
        to: workItem.customerEmail || '',
        subject: '',
        body: '',
        template: '',
      });
    } catch (error) {
      console.error('Error saving email document:', error);
      const permissionError = new FirestorePermissionError({
        path: documentsCollectionRef.path,
        operation: 'create',
        requestResourceData: newDocumentPayload,
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not open email client or save the email. You may not have permissions.' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-2 bg-background">
        <Card>
            <CardHeader className="p-4 pb-2 space-y-0.5">
                <CardTitle className="text-base">Compose Email</CardTitle>
                <CardDescription className="text-xs">Send an email to the customer. Use AI to generate content based on a template.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                <form onSubmit={form.handleSubmit(handleSendEmail)} className="space-y-1">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="md:col-span-1">
                            <Label htmlFor="to">To</Label>
                            <Input id="to" {...form.register('to')} readOnly className="bg-gray-100 border-gray-400" />
                        </div>
                        <div className="md:col-span-2">
                          <Label htmlFor="template">Email Purpose*</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="template"
                              {...form.register('template')}
                              placeholder="Enter email purpose or choose from list..."
                              className="border-gray-400 flex-grow"
                            />
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                                        <ChevronDown className="h-4 w-4" />
                                        <span className="sr-only">Select a purpose</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[300px]">
                                    <ScrollArea className="h-72">
                                        {allTasks.map((task) => (
                                            <DropdownMenuItem key={task} onSelect={() => form.setValue('template', task, { shouldValidate: true })}>
                                                {task}
                                            </DropdownMenuItem>
                                        ))}
                                    </ScrollArea>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Button type="button" variant="outline" onClick={handleGenerateEmail} disabled={isGenerating}>
                                <Wand2 className="mr-2 h-4 w-4" />
                                {isGenerating ? 'Generating...' : 'Generate'}
                            </Button>
                          </div>
                          {form.formState.errors.template && <p className="text-sm text-destructive mt-1">{form.formState.errors.template.message}</p>}
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="subject">Subject*</Label>
                        <Input id="subject" {...form.register('subject')} className="border-gray-400" />
                        {form.formState.errors.subject && <p className="text-sm text-destructive mt-1">{form.formState.errors.subject.message}</p>}
                    </div>
                    <div>
                        <Label htmlFor="body">Body*</Label>
                        <Textarea id="body" {...form.register('body')} rows={8} className="border-gray-400" />
                        {form.formState.errors.body && <p className="text-sm text-destructive mt-1">{form.formState.errors.body.message}</p>}
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="submit" disabled={isSending}>
                            <Send className="mr-2 h-4 w-4" />
                            {isSending ? 'Sending...' : 'Send Email'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    </div>
  );
}
