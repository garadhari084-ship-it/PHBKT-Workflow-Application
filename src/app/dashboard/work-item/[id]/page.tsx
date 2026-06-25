'use client';

import { useParams } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, where } from 'firebase/firestore';
import WorkItemDetails from '@/components/app/work-item-details';
import { Skeleton } from '@/components/ui/skeleton';
import type { WorkItem, Note, Document, User, Task, Transaction } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { useMemo } from 'react';

export default function WorkItemPage() {
  const params = useParams();
  const id = params.id as string;
  const firestore = useFirestore();

  const workItemRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, `work_items/${id}`);
  }, [firestore, id]);

  const { data: workItem, isLoading: isLoadingWorkItem, error: workItemError } = useDoc<WorkItem>(workItemRef);

  const notesQuery = useMemoFirebase(() => {
    if (!workItemRef) return null;
    return query(collection(workItemRef, 'notes'), orderBy('date', 'desc'));
  }, [workItemRef]);

  const documentsQuery = useMemoFirebase(() => {
    if (!workItemRef) return null;
    return query(collection(workItemRef, 'documents'), orderBy('uploadedAt', 'desc'));
  }, [workItemRef]);
  
  const tasksQuery = useMemoFirebase(() => {
    if (!workItemRef) return null;
    return query(collection(workItemRef, 'tasks'), orderBy('createdDate', 'desc'));
  }, [workItemRef]);
  
  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !workItem?.customerId) return null;
    return query(
        collection(firestore, 'transactions'), 
        where('customerId', '==', workItem.customerId)
    );
  }, [firestore, workItem]);

  // Fetch all users to resolve names
  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, `users`);
  }, [firestore]);

  const { data: notes, isLoading: isLoadingNotes, error: notesError } = useCollection<Note>(notesQuery);
  const { data: documents, isLoading: isLoadingDocuments, error: documentsError } = useCollection<Document>(documentsQuery);
  const { data: users, isLoading: isLoadingUsers, error: usersError } = useCollection<User>(usersQuery);
  const { data: tasks, isLoading: isLoadingTasks, error: tasksError } = useCollection<Task>(tasksQuery);
  const { data: transactionsData, isLoading: isLoadingTransactions, error: transactionsError } = useCollection<Transaction>(transactionsQuery);

  const transactions = useMemo(() => {
    if (!transactionsData) return [];
    return [...transactionsData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactionsData]);

  const isLoading = isLoadingWorkItem || isLoadingNotes || isLoadingDocuments || isLoadingUsers || isLoadingTasks || isLoadingTransactions;
  const error = workItemError || notesError || documentsError || usersError || tasksError || transactionsError;

  if (error) {
    return (
      <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto p-4 space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load work item data. Please check your network connection and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto p-4 space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!workItem) {
    // We can't use notFound() directly in a client component after hooks.
    // A better approach is to render a "not found" message.
    return (
        <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto p-8 text-center">
            <h1 className="text-2xl font-bold">Work Item Not Found</h1>
            <p className="text-muted-foreground">The work item with ID "{id}" could not be found.</p>
        </div>
    );
  }

  return (
    <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto">
      <WorkItemDetails 
        workItem={workItem} 
        notes={notes || []}
        documents={documents || []}
        users={users || []}
        tasks={tasks || []}
        transactions={transactions}
      />
    </div>
  );
}
