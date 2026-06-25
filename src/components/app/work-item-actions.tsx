

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, updateDoc, runTransaction, collection, writeBatch, getDoc, setDoc } from 'firebase/firestore';
import type { WorkItem, Note, User, WorkItemStatus, WorkItemTab } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { 
    newBusinessRequestTasks, 
    webAndAppTasks, 
    digitalMarketingTasks, 
    taxAndComplianceTasks, 
    bpoAndKpoTasks, 
    feedbackAndComplaintTasks, 
    otherServiceRequestTasks 
} from '@/lib/tasks';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';


const getWorkTypePrefix = (workType: string): string => {
  switch (workType) {
    case 'New Business Request': return 'NB';
    case 'Web & App Development': return 'DS';
    case 'Digital Marketing': return 'DM';
    case 'Tax & Compliance': return 'TC';
    case 'BPO & KPO Services': return 'BPO';
    case 'Feedback & Complaint': return 'FC';
    case 'Other Service Request': return 'OSR';
    default: return 'WI';
  }
};

const resolveSchema = z.object({
  note: z.string().min(1, 'A note is required for resolution.'),
});

const resolveCompletedSchema = z.object({
  note: z.string().min(1, 'A note is required for resolution.'),
  category: z.string().min(1, 'Category is required.'),
  subject: z.string().min(1, 'Subject is required.'),
});


function ResolveCompletedForm({ workItem, onClose }: { workItem: WorkItem; onClose: () => void; }) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const form = useForm<z.infer<typeof resolveCompletedSchema>>({
        resolver: zodResolver(resolveCompletedSchema),
        defaultValues: { note: '', category: '', subject: '' },
    });

    async function onSubmit(values: z.infer<typeof resolveCompletedSchema>) {
        if (!firestore || !user) return;
        setIsSubmitting(true);
        
        const workItemRef = doc(firestore, `work_items/${workItem.id}`);
        const noteRef = doc(collection(firestore, `work_items/${workItem.id}/notes`));

        try {
            const batch = writeBatch(firestore);
            
            batch.update(workItemRef, { 
                status: 'Completed',
                lastUpdatedDate: new Date().toISOString(),
                latestUpdate: {
                    title: `RESOLVED - COMPLETED`,
                    description: `Work item resolved as Completed by ${user.displayName || user.email}.`,
                    date: format(new Date(), "'on' MMM d, yyyy"),
                }
            });

            batch.set(noteRef, {
                id: noteRef.id,
                workItemId: workItem.id,
                authorId: user.uid,
                date: new Date().toISOString(),
                text: values.note,
                category: values.category,
                subject: values.subject,
            });

            await batch.commit();

            toast({ title: "Success", description: `Work item marked as Completed.` });
            
            onClose();

        } catch (error: any) {
            console.error("Resolution failed:", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: workItemRef.path, operation: 'update' }));
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update work item.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                 <div className="grid grid-cols-5 gap-4">
                    <div className="space-y-2 col-span-2">
                        <Label className="text-xs">Tasks to be Completed</Label>
                        <div className="p-2 border rounded-md text-xs bg-gray-50 h-32 overflow-y-auto border-zinc-300">
                            {workItem.tasks && workItem.tasks.length > 0 ? (
                                <ul className="list-disc list-inside">
                                    {workItem.tasks.map(task => <li key={task}>{task}</li>)}
                                </ul>
                            ) : <p>No tasks associated with this work item.</p>}
                        </div>
                    </div>
                     <div className="space-y-2 col-span-3">
                         <div className="grid grid-cols-2 gap-2">
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Category*</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-6 text-xs py-0 px-2 border-zinc-300">
                                                    <SelectValue placeholder="Select a category" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="General" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">General</SelectItem>
                                                <SelectItem value="Update" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Update</SelectItem>
                                                <SelectItem value="Correction" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Correction</SelectItem>
                                                <SelectItem value="Follow-up" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Follow-up</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="subject"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Subject*</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-6 text-xs py-0 px-2 border-zinc-300">
                                                    <SelectValue placeholder="Select a subject" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Successfully Delivered as per Requirement" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Successfully Delivered as per Requirement</SelectItem>
                                                <SelectItem value="Issue Resolved and Verified" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Issue Resolved and Verified</SelectItem>
                                                <SelectItem value="Service Request Fulfilled" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Service Request Fulfilled</SelectItem>
                                                <SelectItem value="Development Task Completed" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Development Task Completed</SelectItem>
                                                <SelectItem value="Configuration or Setup Completed" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Configuration or Setup Completed</SelectItem>
                                                <SelectItem value="Data Correction or Update Completed" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Data Correction or Update Completed</SelectItem>
                                                <SelectItem value="Process or Workflow Implemented" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Process or Workflow Implemented</SelectItem>
                                                <SelectItem value="Customer Query Addressed" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Customer Query Addressed</SelectItem>
                                                <SelectItem value="System or Technical Issue Fixed" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">System or Technical Issue Fixed</SelectItem>
                                                <SelectItem value="Other" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="note"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Note*</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder={`Enter resolution note for marking as Completed...`} {...field} className="h-20 text-xs py-1 border-zinc-300" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={onClose} className="h-7">Cancel</Button>
                    <Button type="submit" disabled={isSubmitting} className="h-7 bg-black text-white hover:bg-black/90">
                        {isSubmitting ? 'Submitting...' : 'Submit'}
                    </Button>
                </div>
            </form>
        </Form>
    );
}

function StatusUpdateForm({ workItem, onClose, newStatus }: { workItem: WorkItem; onClose: () => void; newStatus: WorkItemStatus }) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const form = useForm<z.infer<typeof resolveSchema>>({
        resolver: zodResolver(resolveSchema),
        defaultValues: { note: '' },
    });

    async function onSubmit(values: z.infer<typeof resolveSchema>) {
        if (!firestore || !user) return;
        setIsSubmitting(true);
        
        const workItemRef = doc(firestore, `work_items/${workItem.id}`);
        const noteRef = doc(collection(firestore, `work_items/${workItem.id}/notes`));

        try {
            const batch = writeBatch(firestore);
            
            batch.update(workItemRef, { 
                status: newStatus,
                lastUpdatedDate: new Date().toISOString(),
                latestUpdate: {
                    title: `RESOLVED - ${newStatus.toUpperCase()}`,
                    description: `Work item resolved as ${newStatus} by ${user.displayName || user.email}.`,
                    date: format(new Date(), "'on' MMM d, yyyy"),
                }
            });

            batch.set(noteRef, {
                id: noteRef.id,
                workItemId: workItem.id,
                authorId: user.uid,
                date: new Date().toISOString(),
                text: values.note,
                category: 'Resolution',
                subject: `Resolved as ${newStatus}`,
            });

            await batch.commit();

            toast({ title: "Success", description: `Work item marked as ${newStatus}.` });
            
            onClose();

        } catch (error: any) {
            console.error("Resolution failed:", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: workItemRef.path, operation: 'update' }));
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update work item.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0.5">
                <FormField
                    control={form.control}
                    name="note"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs">Note*</FormLabel>
                            <FormControl>
                                <Textarea placeholder={`Enter resolution note for marking as ${newStatus}...`} {...field} className="min-h-[4rem] text-xs py-1 border-zinc-300" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={onClose} className="h-7">Cancel</Button>
                    <Button type="submit" disabled={isSubmitting} className="h-7 bg-black text-white hover:bg-black/90">{isSubmitting ? 'Submitting...' : `Resolve as ${newStatus}`}</Button>
                </div>
            </form>
        </Form>
    );
}

const transferSchema = z.object({
  assignedUserId: z.string().min(1, 'Please select a user.'),
  reason: z.string().min(1, 'Please select a reason.'),
  note: z.string().min(1, 'A note is required for transfer.'),
});

function ResolveTransferForm({ workItem, users, onClose }: { workItem: WorkItem; users: User[]; onClose: () => void; }) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof transferSchema>>({
        resolver: zodResolver(transferSchema),
        defaultValues: { assignedUserId: '', reason: '', note: '' },
    });

    async function onSubmit(values: z.infer<typeof transferSchema>) {
        if (!firestore || !user) return;
        setIsSubmitting(true);

        const workItemRef = doc(firestore, `work_items/${workItem.id}`);
        const noteRef = doc(collection(firestore, `work_items/${workItem.id}/notes`));
        const newAssignee = users.find(u => u.id === values.assignedUserId);

        try {
            const batch = writeBatch(firestore);

            batch.update(workItemRef, {
                status: 'Transfer',
                assignedUserId: values.assignedUserId,
                lastUpdatedDate: new Date().toISOString(),
                latestUpdate: {
                    title: `TRANSFER`,
                    description: `Work item transferred to ${newAssignee?.firstName || newAssignee?.email} by ${user.displayName || user.email}. Reason: ${values.reason}`,
                    date: format(new Date(), "'on' MMM d, yyyy"),
                }
            });

            batch.set(noteRef, {
                id: noteRef.id,
                workItemId: workItem.id,
                authorId: user.uid,
                date: new Date().toISOString(),
                text: values.note,
                category: 'Transfer',
                subject: `Transferred to ${newAssignee?.firstName || newAssignee?.email}. Reason: ${values.reason}`,
            });

            await batch.commit();

            toast({ title: "Success", description: `Work item transferred.` });
            
            onClose();

        } catch (error: any) {
            console.error("Transfer failed:", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: workItemRef.path, operation: 'update' }));
            toast({ variant: 'destructive', title: 'Error', description: 'Could not transfer work item.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="assignedUserId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Transfer To*</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-6 text-xs py-0 px-2 border-zinc-300">
                                                <SelectValue placeholder="Select a user to transfer to" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {users.map(u => <SelectItem key={u.id} value={u.id} className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">{u.firstName} {u.lastName} ({u.email})</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Reason for Transfer*</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-6 text-xs py-0 px-2 border-zinc-300">
                                                <SelectValue placeholder="Select a reason" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Incorrect departmental assignment" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Incorrect departmental assignment</SelectItem>
                                            <SelectItem value="Incorrect process or sub-process classification" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Incorrect process or sub-process classification</SelectItem>
                                            <SelectItem value="Requirement of specialized skills or expertise" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Requirement of specialized skills or expertise</SelectItem>
                                            <SelectItem value="Workload redistribution for operational efficiency" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Workload redistribution for operational efficiency</SelectItem>
                                            <SelectItem value="Escalation as per governance or authority matrix" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Escalation as per governance or authority matrix</SelectItem>
                                            <SelectItem value="Transfer initiated based on customer request" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Transfer initiated based on customer request</SelectItem>
                                            <SelectItem value="SLA, priority, or service category revision" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">SLA, priority, or service category revision</SelectItem>
                                            <SelectItem value="Change in approved business requirements" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Change in approved business requirements</SelectItem>
                                            <SelectItem value="Technical dependency or system constraint" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Technical dependency or system constraint</SelectItem>
                                            <SelectItem value="Other" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                     <FormField
                        control={form.control}
                        name="note"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Note*</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Enter reason for transfer..." {...field} className="min-h-[4rem] text-xs py-1 border-zinc-300" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={onClose} className="h-7">Cancel</Button>
                    <Button type="submit" disabled={isSubmitting} className="h-7 bg-black text-white hover:bg-black/90">{isSubmitting ? 'Submitting...' : 'Submit'}</Button>
                </div>
            </form>
        </Form>
    );
}

const pendSchema = z.object({
  releaseDate: z.string().min(1, "A release date is required."),
  reason: z.string().min(1, 'Please select a reason.'),
  note: z.string().min(1, "A note is required for pending."),
});

function ResolvePendForm({ workItem, onClose }: { workItem: WorkItem; onClose: () => void }) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof pendSchema>>({
        resolver: zodResolver(pendSchema),
        defaultValues: { releaseDate: '', reason: '', note: '' },
    });

    async function onSubmit(values: z.infer<typeof pendSchema>) {
        if (!firestore || !user) return;
        setIsSubmitting(true);
        
        const workItemRef = doc(firestore, `work_items/${workItem.id}`);
        const noteRef = doc(collection(firestore, `work_items/${workItem.id}/notes`));

        try {
            const batch = writeBatch(firestore);
            
            batch.update(workItemRef, { 
                status: 'Pend',
                lastUpdatedDate: new Date().toISOString(),
                slaDueDate: new Date(values.releaseDate).toISOString(), // Update SLA due date
                latestUpdate: {
                    title: `PEND`,
                    description: `${values.reason} by ${user.displayName || user.email}`,
                    date: format(new Date(), "'on' MMM d, yyyy"),
                }
            });

            batch.set(noteRef, {
                id: noteRef.id,
                workItemId: workItem.id,
                authorId: user.uid,
                date: new Date().toISOString(),
                text: values.note,
                category: 'Pend',
                subject: `Pended until ${format(new Date(values.releaseDate), "PPP")}. Reason: ${values.reason}`,
            });

            await batch.commit();

            toast({ title: "Success", description: `Work item has been pended.` });
            onClose();

        } catch (error: any) {
            console.error("Pend failed:", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: workItemRef.path, operation: 'update' }));
            toast({ variant: 'destructive', title: 'Error', description: 'Could not pend work item.' });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                 <div className="grid grid-cols-2 gap-4 items-start">
                     <div className="space-y-4">
                        <div className="flex gap-4 items-start">
                            <FormField
                                control={form.control}
                                name="reason"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel className="text-xs">Reason for Pend*</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-6 text-xs py-0 px-2 border-zinc-300">
                                                    <SelectValue placeholder="Select a reason" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Awaiting customer information or confirmation" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Awaiting customer information or confirmation</SelectItem>
                                                <SelectItem value="Pending document submission or verification" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Pending document submission or verification</SelectItem>
                                                <SelectItem value="Dependency on third-party or external vendor" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Dependency on third-party or external vendor</SelectItem>
                                                <SelectItem value="Internal approval or authorization pending" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Internal approval or authorization pending</SelectItem>
                                                <SelectItem value="Awaiting technical input or resolution" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Awaiting technical input or resolution</SelectItem>
                                                <SelectItem value="Resource unavailability or capacity constraint" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Resource unavailability or capacity constraint</SelectItem>
                                                <SelectItem value="SLA pause as per process guidelines" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">SLA pause as per process guidelines</SelectItem>
                                                <SelectItem value="Pending clarification on business requirements" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Pending clarification on business requirements</SelectItem>
                                                <SelectItem value="System or environment unavailability" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">System or environment unavailability</SelectItem>
                                                <SelectItem value="Other justified operational reason (please specify)" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Other justified operational reason (please specify)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="releaseDate"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Pend Until*</FormLabel>
                                    <FormControl>
                                    <Input type="date" {...field} className="h-6 w-auto text-xs py-0 px-2 border-zinc-300" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                    </div>
                    <FormField
                        control={form.control}
                        name="note"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Note*</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Enter pend note..." {...field} className="min-h-[4rem] text-xs py-1 border-zinc-300" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <div className="flex justify-end pt-1 gap-2">
                    <Button type="button" variant="outline" onClick={onClose} className="h-7">Cancel</Button>
                    <Button type="submit" disabled={isSubmitting} className="h-7 bg-black text-white hover:bg-black/90">{isSubmitting ? 'Submitting...' : 'Submit'}</Button>
                </div>
            </form>
        </Form>
    );
}


const reIndexSchema = z.object({
  workType: z.string().min(1, "Please select a new process."),
  reindexOption: z.enum(['myself', 'queue']),
  reason: z.string().min(1, "Please select a reason."),
  note: z.string().min(1, "A note is required for re-indexing."),
  tasks: z.array(z.string()).optional(),
});

function ResolveReIndexForm({ workItem, notes, onClose }: { workItem: WorkItem; notes: Note[]; onClose: () => void }) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedTasks, setSelectedTasks] = useState<string[]>(workItem.tasks || []);

    const form = useForm<z.infer<typeof reIndexSchema>>({
        resolver: zodResolver(reIndexSchema),
        defaultValues: { workType: '', reindexOption: 'myself', reason: '', note: '', tasks: workItem.tasks || [] },
    });

    const workType = form.watch('workType');
    
    const allAvailableTasks = useMemo(() => {
        switch (workType) {
            case 'New Business Request': return newBusinessRequestTasks;
            case 'Web & App Development': return webAndAppTasks;
            case 'Digital Marketing': return digitalMarketingTasks;
            case 'Tax & Compliance': return taxAndComplianceTasks;
            case 'BPO & KPO Services': return bpoAndKpoTasks;
            case 'Feedback & Complaint': return feedbackAndComplaintTasks;
            case 'Other Service Request': return otherServiceRequestTasks;
            default: return [];
        }
    }, [workType]);

    useEffect(() => {
        if (workType !== workItem.workType) {
          setSelectedTasks([]);
        } else {
          setSelectedTasks(workItem.tasks || []);
        }
    }, [workType, workItem.workType, workItem.tasks]);

    useEffect(() => {
        form.setValue('tasks', selectedTasks);
    }, [selectedTasks, form]);
    
    const availableTasks = useMemo(() => {
        return allAvailableTasks.filter(task => !selectedTasks.includes(task));
    }, [allAvailableTasks, selectedTasks]);
    
      const handleSelectTask = (task: string) => {
        setSelectedTasks(prev => [...prev, task]);
      };
    
      const handleDeselectTask = (task: string) => {
          setSelectedTasks(prev => prev.filter(t => t !== task));
      };

    async function onSubmit(values: z.infer<typeof reIndexSchema>) {
        if (!firestore || !user) return;

        if (values.workType && values.workType !== workItem.workType && (!values.tasks || values.tasks.length === 0)) {
            form.setError("tasks", { type: "manual", message: "Please select at least one task for the new process." });
            return;
        }

        setIsSubmitting(true);
        
        // If the process/workType is the same, just update the existing item.
        if (values.workType === workItem.workType) {
            const workItemRef = doc(firestore, `work_items/${workItem.id}`);
            const noteRef = doc(collection(firestore, `work_items/${workItem.id}/notes`));
            const batch = writeBatch(firestore);
    
            try {
                // Update assignment and latest update
                batch.update(workItemRef, {
                    assignedUserId: values.reindexOption === 'myself' ? user.uid : '',
                    lastUpdatedDate: new Date().toISOString(),
                    latestUpdate: {
                        title: 'RE-INDEXED (SAME PROCESS)',
                        description: `Case re-indexed by ${user.displayName || user.email}. Reason: ${values.reason}`,
                        date: format(new Date(), "'on' MMM d, yyyy"),
                    },
                });
    
                // Add a note about the re-index action
                batch.set(noteRef, {
                    id: noteRef.id,
                    workItemId: workItem.id,
                    authorId: user.uid,
                    date: new Date().toISOString(),
                    text: `Re-indexed within the same process. ${values.note}`,
                    category: 'Re-index',
                    subject: `Re-indexed: ${values.reason}`,
                });
    
                await batch.commit();
    
                toast({ title: "Success", description: `Work item ${workItem.id} has been re-indexed.` });
                onClose(); // Close the action panel
    
            } catch (error: any) {
                console.error("Re-index (same process) failed:", error);
                const permissionError = new FirestorePermissionError({
                    path: workItemRef.path,
                    operation: 'update',
                    requestResourceData: { assignedUserId: values.reindexOption === 'myself' ? user.uid : '' }
                });
                errorEmitter.emit('permission-error', permissionError);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not re-index work item.' });
            } finally {
                setIsSubmitting(false);
            }
            return; // Stop execution here
        }

        // --- If different process, proceed with creating a new work item ---
        try {
            const newWorkItemId = await runTransaction(firestore, async (transaction) => {
                const prefix = getWorkTypePrefix(values.workType);
                const counterId = `work_items_${prefix}`;
                const counterRef = doc(firestore, 'counters', counterId);
                const counterDoc = await transaction.get(counterRef);
                const newCount = counterDoc.exists() ? counterDoc.data().value + 1 : 1;
                const numericId = String(newCount).padStart(7, '0');
                const customId = `${prefix}-${numericId}`;

                const oldWorkItemRef = doc(firestore, `work_items/${workItem.id}`);
                const newWorkItemRef = doc(firestore, 'work_items', customId);

                // Create new work item data
                const newWorkItemData: WorkItem = {
                    ...workItem,
                    id: customId,
                    workType: values.workType,
                    status: 'Open',
                    assignedUserId: values.reindexOption === 'myself' ? user.uid : '',
                    createdDate: new Date().toISOString(),
                    lastUpdatedDate: new Date().toISOString(),
                    tasks: values.tasks || [],
                    overview: [
                        `Re-indexed from ${workItem.id}`,
                        ...(workItem.overview || [])
                    ],
                    latestUpdate: {
                        title: 'RE-INDEX',
                        description: `Case re-indexed from ${workItem.id} by ${user.displayName || user.email}. Reason: ${values.reason}`,
                        date: format(new Date(), "'on' MMM d, yyyy"),
                    }
                };

                // Set new work item
                transaction.set(newWorkItemRef, newWorkItemData);
                // Update old work item
                transaction.update(oldWorkItemRef, { 
                    status: 'Reindex',
                    latestUpdate: {
                         title: 'RE-INDEXED',
                        description: `Case re-indexed to ${customId}. Reason: ${values.reason}`,
                        date: format(new Date(), "'on' MMM d, yyyy"),
                    }
                });

                // Add note to old work item
                const oldWorkItemNoteRef = doc(collection(firestore, `work_items/${workItem.id}/notes`));
                transaction.set(oldWorkItemNoteRef, {
                    id: oldWorkItemNoteRef.id,
                    workItemId: workItem.id,
                    authorId: user.uid,
                    date: new Date().toISOString(),
                    text: values.note,
                    category: 'Re-index',
                    subject: `Re-indexed to ${customId}`,
                });

                // Update counter
                transaction.set(counterRef, { value: newCount });

                return customId;
            });

            // Batch write notes
            const noteBatch = writeBatch(firestore);
            notes.forEach(note => {
                const newNoteRef = doc(collection(firestore, `work_items/${newWorkItemId}/notes`));
                noteBatch.set(newNoteRef, { ...note, workItemId: newWorkItemId, id: newNoteRef.id });
            });
            
            // Add creation note for new work item
            const newWorkItemCreationNoteRef = doc(collection(firestore, `work_items/${newWorkItemId}/notes`));
            noteBatch.set(newWorkItemCreationNoteRef, {
                id: newWorkItemCreationNoteRef.id,
                workItemId: newWorkItemId,
                authorId: user.uid,
                date: new Date().toISOString(),
                text: `Re-indexed from ${workItem.id}. ${values.note}`,
                category: 'Creation',
                subject: `Re-indexed from ${workItem.id}`
            });

            await noteBatch.commit();


            toast({ title: "Success", description: `Work item re-indexed to ${newWorkItemId}` });
            
            onClose();

        } catch (error: any) {
            console.error("Re-index failed:", error);
            const permissionError = new FirestorePermissionError({
                path: `work_items/${workItem.id}`,
                operation: 'write',
                requestResourceData: { newWorkType: values.workType, reason: values.reason, note: values.note }
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not re-index work item.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4">
                         <div className="space-y-2">
                             <FormField
                                control={form.control}
                                name="reason"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel htmlFor='reason' className="text-xs">Reason*</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger id="reason" className="h-6 text-xs py-0 px-2 border-zinc-300"><SelectValue placeholder="Select a reason" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="Incorrect or incomplete data" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Incorrect or incomplete data</SelectItem>
                                                <SelectItem value="Wrong process / sub-process selected" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Wrong process / sub-process selected</SelectItem>
                                                <SelectItem value="Wrong customer, project, or assignment" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Wrong customer, project, or assignment</SelectItem>
                                                <SelectItem value="Missing or incorrect documents" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Missing or incorrect documents</SelectItem>
                                                <SelectItem value="Duplicate or wrongly created case" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Duplicate or wrongly created case</SelectItem>
                                                <SelectItem value="Workflow or status correction required" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Workflow or status correction required</SelectItem>
                                                <SelectItem value="Updated customer or business requirement" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Updated customer or business requirement</SelectItem>
                                                <SelectItem value="System or technical error" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">System or technical error</SelectItem>
                                                <SelectItem value="Quality, audit, or compliance correction" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Quality, audit, or compliance correction</SelectItem>
                                                <SelectItem value="Other" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                         </div>
                         <div className="space-y-2">
                            <FormField
                                control={form.control}
                                name="reindexOption"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Re-index Option*</FormLabel>
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-2 pt-1">
                                                <FormItem className="flex items-center space-x-1"><FormControl><RadioGroupItem value="myself" /></FormControl><Label className="font-normal text-xs">Assign to Myself</Label></FormItem>
                                                <FormItem className="flex items-center space-x-1"><FormControl><RadioGroupItem value="queue" /></FormControl><Label className="font-normal text-xs">Initial Indexing Queue</Label></FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                         </div>
                        <FormField
                            control={form.control}
                            name="note"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="note" className="text-xs">Note*</FormLabel>
                                    <FormControl><Textarea id="note" placeholder="Re-indexing note..." {...field} className="min-h-[4rem] text-xs py-1 border-zinc-300" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="workType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">New Process*</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="h-6 text-xs py-0 px-2 border-zinc-300"><SelectValue placeholder="Select a new process" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="New Business Request" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">New Business Request</SelectItem>
                                            <SelectItem value="Web & App Development" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Web &amp; App Development</SelectItem>
                                            <SelectItem value="Digital Marketing" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Digital Marketing</SelectItem>
                                            <SelectItem value="Tax & Compliance" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Tax &amp; Compliance</SelectItem>
                                            <SelectItem value="BPO & KPO Services" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">BPO &amp; KPO Services</SelectItem>
                                            <SelectItem value="Feedback & Complaint" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Feedback &amp; Complaint</SelectItem>
                                            <SelectItem value="Other Service Request" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Other Service Request</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {workType && workType !== workItem.workType && (
                            <div className="border rounded-md mt-1">
                                <Label className="flex items-center justify-center p-1 text-xs font-semibold">Tasks</Label>
                                <Separator />
                                <div className="bg-accent p-1 rounded-b-md">
                                    <div className="grid grid-cols-2 text-center">
                                        <h3 className="font-semibold mb-0 text-xs">Available</h3>
                                        <h3 className="font-semibold mb-0 text-xs">Selected</h3>
                                    </div>
                                    <Separator className="my-1 bg-border/20 w-full h-[0.5px]" />
                                    <div className="grid grid-cols-2 relative">
                                        <div className="pr-1">
                                            <ScrollArea className="h-[140px] w-full rounded-md bg-background border">
                                                <div className="p-1 space-y-1">
                                                    {availableTasks.map(task => (
                                                        <div key={task} onClick={() => handleSelectTask(task)} className="cursor-pointer p-1 hover:bg-primary/10 rounded-sm text-xs">
                                                            {task}
                                                        </div>
                                                    ))}
                                                    {availableTasks.length === 0 && <p className="text-muted-foreground text-center text-xs p-2">All tasks selected.</p>}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                        <div className="w-px bg-border/20 absolute top-0 bottom-0 left-1/2 transform -translate-x-1/2 h-full"></div>
                                        <div className="pl-1">
                                            <ScrollArea className="h-[140px] w-full rounded-md bg-background border">
                                                <div className="p-1 space-y-1">
                                                    {selectedTasks.length > 0 ? selectedTasks.map(task => (
                                                        <div key={task} onClick={() => handleDeselectTask(task)} className="cursor-pointer p-1 hover:bg-primary/10 rounded-sm font-bold text-xs">
                                                            {task}
                                                        </div>
                                                    )) : <p className="text-muted-foreground p-2 text-center text-xs">Select tasks from the left.</p>}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="tasks"
                                        render={() => (
                                            <FormItem>
                                                <FormMessage className="text-xs pt-1"/>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="flex justify-end pt-1 gap-2">
                    <Button type="button" variant="outline" onClick={onClose} className="h-7">Cancel</Button>
                    <Button type="submit" disabled={isSubmitting} className="h-7 bg-black text-white hover:bg-black/90">{isSubmitting ? 'Submitting...' : 'Submit'}</Button>
                </div>
            </form>
        </Form>
    );
}

const cloneSchema = z.object({
  workType: z.string().min(1, "Please select a process."),
  assignmentOption: z.enum(['myself', 'queue']),
  note: z.string().min(1, "A note is required."),
  tasks: z.array(z.string()).optional(),
});


function CloneWorkItemForm({ workItem, notes, onClose }: { workItem: WorkItem; notes: Note[]; onClose: () => void }) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedTasks, setSelectedTasks] = useState<string[]>(workItem.tasks || []);

    const form = useForm<z.infer<typeof cloneSchema>>({
        resolver: zodResolver(cloneSchema),
        defaultValues: { workType: '', assignmentOption: 'myself', note: '', tasks: workItem.tasks || [] },
    });

    const workType = form.watch('workType');
    
    const allAvailableTasks = useMemo(() => {
        switch (workType) {
            case 'New Business Request': return newBusinessRequestTasks;
            case 'Web & App Development': return webAndAppTasks;
            case 'Digital Marketing': return digitalMarketingTasks;
            case 'Tax & Compliance': return taxAndComplianceTasks;
            case 'BPO & KPO Services': return bpoAndKpoTasks;
            case 'Feedback & Complaint': return feedbackAndComplaintTasks;
            case 'Other Service Request': return otherServiceRequestTasks;
            default: return [];
        }
    }, [workType]);

    useEffect(() => {
        if (workType !== workItem.workType) {
          setSelectedTasks([]);
        } else {
          setSelectedTasks(workItem.tasks || []);
        }
    }, [workType, workItem.workType, workItem.tasks]);

    useEffect(() => {
        form.setValue('tasks', selectedTasks);
    }, [selectedTasks, form]);
    
    const availableTasks = useMemo(() => {
        return allAvailableTasks.filter(task => !selectedTasks.includes(task));
    }, [allAvailableTasks, selectedTasks]);
    
      const handleSelectTask = (task: string) => {
        setSelectedTasks(prev => [...prev, task]);
      };
    
      const handleDeselectTask = (task: string) => {
          setSelectedTasks(prev => prev.filter(t => t !== task));
      };

    async function onSubmit(values: z.infer<typeof cloneSchema>) {
        if (!firestore || !user) return;

        if (values.workType && values.workType !== workItem.workType && (!values.tasks || values.tasks.length === 0)) {
            form.setError("tasks", { type: "manual", message: "Please select at least one task for the new process." });
            return;
        }

        setIsSubmitting(true);
        
        try {
            const newWorkItemId = await runTransaction(firestore, async (transaction) => {
                const prefix = getWorkTypePrefix(values.workType);
                const counterId = `work_items_${prefix}`;
                const counterRef = doc(firestore, 'counters', counterId);
                const counterDoc = await transaction.get(counterRef);
                const newCount = counterDoc.exists() ? counterDoc.data().value + 1 : 1;
                const numericId = String(newCount).padStart(7, '0');
                const customId = `${prefix}-${numericId}`;

                const newWorkItemRef = doc(firestore, 'work_items', customId);

                const newWorkItemData: WorkItem = {
                    ...workItem,
                    id: customId,
                    workType: values.workType,
                    status: 'Open',
                    assignedUserId: values.assignmentOption === 'myself' ? user.uid : '',
                    createdDate: new Date().toISOString(),
                    lastUpdatedDate: new Date().toISOString(),
                    tasks: values.tasks || [],
                    overview: [
                        `Cloned from ${workItem.id}`,
                        ...(workItem.overview || [])
                    ],
                    latestUpdate: {
                        title: 'CLONED',
                        description: `Case cloned from ${workItem.id} by ${user.displayName || user.email}.`,
                        date: format(new Date(), "'on' MMM d, yyyy"),
                    }
                };

                transaction.set(newWorkItemRef, newWorkItemData);
                transaction.set(counterRef, { value: newCount });

                return customId;
            });
            
            const batch = writeBatch(firestore);
            
            // Copy existing notes
            notes.forEach(note => {
                const newNoteRef = doc(collection(firestore, `work_items/${newWorkItemId}/notes`));
                batch.set(newNoteRef, { ...note, workItemId: newWorkItemId, id: newNoteRef.id });
            });

            // Add note to old work item
            const oldWorkItemNoteRef = doc(collection(firestore, `work_items/${workItem.id}/notes`));
            batch.set(oldWorkItemNoteRef, {
                id: oldWorkItemNoteRef.id,
                workItemId: workItem.id,
                authorId: user.uid,
                date: new Date().toISOString(),
                text: `This work item was cloned to a new item: ${newWorkItemId}. ${values.note}`,
                category: 'Clone',
                subject: `Cloned to ${newWorkItemId}`,
            });

            // Add creation note to new work item
            const newWorkItemCreationNoteRef = doc(collection(firestore, `work_items/${newWorkItemId}/notes`));
            batch.set(newWorkItemCreationNoteRef, {
                id: newWorkItemCreationNoteRef.id,
                workItemId: newWorkItemId,
                authorId: user.uid,
                date: new Date().toISOString(),
                text: `Cloned from work item: ${workItem.id}. ${values.note}`,
                category: 'Creation',
                subject: `Cloned from ${workItem.id}`,
            });
            
            // Update latestUpdate on old work item
            const oldWorkItemRef = doc(firestore, `work_items/${workItem.id}`);
            batch.update(oldWorkItemRef, {
                latestUpdate: {
                    title: 'CLONED',
                    description: `Case cloned to ${newWorkItemId} by ${user.displayName || user.email}.`,
                    date: format(new Date(), "'on' MMM d, yyyy"),
                }
            });

            await batch.commit();

            toast({ title: "Success", description: `Work item cloned to ${newWorkItemId}` });

            if (values.assignmentOption === 'myself') {
                const openTabsString = localStorage.getItem('openWorkItemTabs');
                let openTabs: WorkItemTab[] = openTabsString ? JSON.parse(openTabsString) : [];
                
                const newTab: WorkItemTab = { href: `/dashboard/work-item?id=${newWorkItemId}`, label: newWorkItemId };
                if (!openTabs.find(tab => tab.href === newTab.href)) {
                    openTabs.push(newTab);
                }
        
                localStorage.setItem('openWorkItemTabs', JSON.stringify(openTabs));
                window.dispatchEvent(new CustomEvent('tabs-update'));
                
                router.push(newTab.href);
            }
            
            onClose();

        } catch (error: any) {
            console.error("Clone failed:", error);
            const permissionError = new FirestorePermissionError({
                path: `work_items`, // Cloning creates a new item in the collection
                operation: 'create',
                requestResourceData: { 
                    clonedFrom: workItem.id,
                    newWorkType: values.workType,
                    note: values.note,
                    assignedTo: values.assignmentOption === 'myself' ? user?.uid : 'queue',
                }
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not clone work item.' });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    return (
         <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="workType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Process*</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="h-6 text-xs py-0 px-2 border-zinc-300"><SelectValue placeholder="Select a process" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="New Business Request" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">New Business Request</SelectItem>
                                            <SelectItem value="Web & App Development" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Web &amp; App Development</SelectItem>
                                            <SelectItem value="Digital Marketing" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Digital Marketing</SelectItem>
                                            <SelectItem value="Tax & Compliance" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Tax &amp; Compliance</SelectItem>
                                            <SelectItem value="BPO & KPO Services" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">BPO &amp; KPO Services</SelectItem>
                                            <SelectItem value="Feedback & Complaint" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Feedback &amp; Complaint</SelectItem>
                                            <SelectItem value="Other Service Request" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Other Service Request</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {workType && workType !== workItem.workType && (
                            <div className="border rounded-md mt-1">
                                <Label className="flex items-center justify-center p-1 text-xs font-semibold">Tasks</Label>
                                <Separator />
                                <div className="bg-accent p-1 rounded-b-md">
                                    <div className="grid grid-cols-2 text-center">
                                        <h3 className="font-semibold mb-0 text-xs">Available</h3>
                                        <h3 className="font-semibold mb-0 text-xs">Selected</h3>
                                    </div>
                                    <Separator className="my-1 bg-border/20 w-full h-[0.5px]" />
                                    <div className="grid grid-cols-2 relative">
                                        <div className="pr-1">
                                            <ScrollArea className="h-[140px] w-full rounded-md bg-background border">
                                                <div className="p-1 space-y-1">
                                                    {availableTasks.map(task => (
                                                        <div key={task} onClick={() => handleSelectTask(task)} className="cursor-pointer p-1 hover:bg-primary/10 rounded-sm text-xs">
                                                            {task}
                                                        </div>
                                                    ))}
                                                    {availableTasks.length === 0 && <p className="text-muted-foreground text-center text-xs p-2">All tasks selected.</p>}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                        <div className="w-px bg-border/20 absolute top-0 bottom-0 left-1/2 transform -translate-x-1/2 h-full"></div>
                                        <div className="pl-1">
                                            <ScrollArea className="h-[140px] w-full rounded-md bg-background border">
                                                <div className="p-1 space-y-1">
                                                    {selectedTasks.length > 0 ? selectedTasks.map(task => (
                                                        <div key={task} onClick={() => handleDeselectTask(task)} className="cursor-pointer p-1 hover:bg-primary/10 rounded-sm font-bold text-xs">
                                                            {task}
                                                        </div>
                                                    )) : <p className="text-muted-foreground p-2 text-center text-xs">Select tasks from the left.</p>}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="tasks"
                                        render={() => (
                                            <FormItem>
                                                <FormMessage className="text-xs pt-1"/>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <FormField
                            control={form.control}
                            name="assignmentOption"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Assignment Option*</FormLabel>
                                    <FormControl>
                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-2 pt-1">
                                            <FormItem className="flex items-center space-x-1"><FormControl><RadioGroupItem value="myself" /></FormControl><Label className="font-normal text-xs">Assign to Myself</Label></FormItem>
                                            <FormItem className="flex items-center space-x-1"><FormControl><RadioGroupItem value="queue" /></FormControl><Label className="font-normal text-xs">Initial Indexing Queue</Label></FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="note"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel htmlFor="note" className="text-xs">Note*</FormLabel>
                                    <FormControl><Textarea id="note" placeholder="Cloning note..." {...field} className="min-h-[4rem] text-xs py-1 border-zinc-300" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>
                
                <div className="flex justify-end pt-1 gap-2">
                    <Button type="button" variant="outline" onClick={onClose} className="h-7">Cancel</Button>
                    <Button type="submit" disabled={isSubmitting} className="h-7 bg-black text-white hover:bg-black/90">{isSubmitting ? 'Submitting...' : 'Submit'}</Button>
                </div>
            </form>
        </Form>
    );
}

const terminateSchema = z.object({
  reason: z.string().min(1, 'Please select a reason.'),
  note: z.string().min(1, 'A note is required for termination.'),
});

function ResolveTerminatedForm({ workItem, onClose }: { workItem: WorkItem; onClose: () => void }) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const form = useForm<z.infer<typeof terminateSchema>>({
        resolver: zodResolver(terminateSchema),
        defaultValues: { reason: '', note: '' },
    });

    async function onSubmit(values: z.infer<typeof terminateSchema>) {
        if (!firestore || !user) return;
        setIsSubmitting(true);
        
        const workItemRef = doc(firestore, `work_items/${workItem.id}`);
        const noteRef = doc(collection(firestore, `work_items/${workItem.id}/notes`));

        try {
            const batch = writeBatch(firestore);
            
            batch.update(workItemRef, { 
                status: 'Terminated',
                lastUpdatedDate: new Date().toISOString(),
                latestUpdate: {
                    title: `RESOLVED - TERMINATED`,
                    description: `Work item terminated by ${user.displayName || user.email}. Reason: ${values.reason}`,
                    date: format(new Date(), "'on' MMM d, yyyy"),
                }
            });

            batch.set(noteRef, {
                id: noteRef.id,
                workItemId: workItem.id,
                authorId: user.uid,
                date: new Date().toISOString(),
                text: values.note,
                category: 'Resolution',
                subject: `Terminated: ${values.reason}`,
            });

            await batch.commit();

            toast({ title: "Success", description: `Work item marked as Terminated.` });
            
            onClose();

        } catch (error: any) {
            console.error("Termination failed:", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: workItemRef.path, operation: 'update' }));
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update work item.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="reason"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Reason for Terminate*</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-6 text-xs py-0 px-2 border-zinc-300">
                                            <SelectValue placeholder="Select a reason" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="Work completed successfully" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Work completed successfully</SelectItem>
                                        <SelectItem value="Duplicate case identified" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Duplicate case identified</SelectItem>
                                        <SelectItem value="Invalid or incorrect request" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Invalid or incorrect request</SelectItem>
                                        <SelectItem value="Customer withdrew or cancelled request" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Customer withdrew or cancelled request</SelectItem>
                                        <SelectItem value="Insufficient or missing information" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Insufficient or missing information</SelectItem>
                                        <SelectItem value="Out of service scope" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Out of service scope</SelectItem>
                                        <SelectItem value="SLA expired / no response from customer" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">SLA expired / no response from customer</SelectItem>
                                        <SelectItem value="Technical or system limitation" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Technical or system limitation</SelectItem>
                                        <SelectItem value="Management or compliance decision" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Management or compliance decision</SelectItem>
                                        <SelectItem value="Other" className="text-xs h-auto py-0.5 pl-8 pr-2 flex items-center">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="note"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs">Note*</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Enter termination note..." {...field} className="min-h-[4rem] text-xs py-1 border-zinc-300" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={onClose} className="h-7">Cancel</Button>
                    <Button type="submit" disabled={isSubmitting} className="h-7 bg-black text-white hover:bg-black/90">{isSubmitting ? 'Submitting...' : 'Submit'}</Button>
                </div>
            </form>
        </Form>
    );
}


export default function WorkItemActions({ workItem, notes, users, onClose }: { workItem: WorkItem; notes: Note[]; users: User[], onClose: () => void }) {
    const [selectedAction, setSelectedAction] = useState<string>('completed');

    const renderActionForm = () => {
        switch (selectedAction) {
            case 'completed':
                return <ResolveCompletedForm workItem={workItem} onClose={onClose} />;
            case 're-index':
                return <ResolveReIndexForm workItem={workItem} notes={notes} onClose={onClose} />;
            case 'terminated':
                return <ResolveTerminatedForm workItem={workItem} onClose={onClose} />;
            case 'transfer':
                return <ResolveTransferForm workItem={workItem} users={users} onClose={onClose} />;
            case 'clone':
                return <CloneWorkItemForm workItem={workItem} notes={notes} onClose={onClose} />;
            case 'pend':
                return <ResolvePendForm workItem={workItem} onClose={onClose} />;
            default:
                return null;
        }
    };

    const actionLabel = {
        'completed': 'RESOLVE COMPLETED',
        're-index': 'RE-INDEX',
        'terminated': 'RESOLVE TERMINATED',
        'transfer': 'RESOLVE TRANSFER',
        'clone': 'CLONE WORK ITEM',
        'pend': 'PEND WORK ITEM',
    }[selectedAction] || 'ACTION';
    
    return (
        <div className="border rounded-md w-full">
            <div className="flex items-center justify-start gap-2 bg-black text-primary-foreground px-2 py-1 rounded-t-md">
                <Label className="font-semibold shrink-0 text-xs">{actionLabel} OR</Label>
                <Select onValueChange={setSelectedAction} value={selectedAction}>
                    <SelectTrigger className="w-[440px] bg-white text-black h-5 text-xs py-0 px-2">
                        <SelectValue placeholder="--select a different action--" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="completed" className="text-xs h-auto py-0.5 pr-2 pl-8 flex items-center">Resolve Completed</SelectItem>
                        <SelectItem value="re-index" className="text-xs h-auto py-0.5 pr-2 pl-8 flex items-center">Resolve Re-Index</SelectItem>
                        <SelectItem value="terminated" className="text-xs h-auto py-0.5 pr-2 pl-8 flex items-center">Resolve Terminated</SelectItem>
                        <SelectItem value="transfer" className="text-xs h-auto py-0.5 pr-2 pl-8 flex items-center">Resolve Transfer</SelectItem>
                        <SelectItem value="clone" className="text-xs h-auto py-0.5 pr-2 pl-8 flex items-center">Clone Work Item</SelectItem>
                        <SelectItem value="pend" className="text-xs h-auto py-0.5 pr-2 pl-8 flex items-center">Pend Work Item</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            
            <div className="p-2 bg-white rounded-b-md">
                {renderActionForm()}
            </div>
        </div>
    );
}
