'use client';

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import WorkItemTable from '@/components/app/work-item-table';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { WorkItem, User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WebLeadWorkItemsPage() {
  const firestore = useFirestore();
  const navigate = useNavigate();

  const workItemsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    // Query for work items where inboundMethod is 'API'
    return query(collection(firestore, 'work_items'), where('inboundMethod', '==', 'API'));
  }, [firestore]);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'));
  }, [firestore]);

  const { data: workItemsData, isLoading: isLoadingWorkItems, error: workItemsError } = useCollection<WorkItem>(workItemsQuery);
  const { data: usersData, isLoading: isLoadingUsers, error: usersError } = useCollection<User>(usersQuery);

  const isLoading = isLoadingWorkItems || isLoadingUsers;
  const error = workItemsError || usersError;
  
  const workItems = workItemsData || [];
  const users = usersData || [];

  return (
    <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto px-2 md:px-4 lg:px-6 py-4 md:py-6 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-2xl font-bold">Web Lead Work Items</h1>
        </div>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load data. Please check your network connection and try again.
          </AlertDescription>
        </Alert>
      )}
      {isLoading ? (
        <Card className="rounded-lg shadow-md">
            <CardContent className="p-4 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
            </CardContent>
        </Card>
      ) : !error && (
        <WorkItemTable 
          workItems={workItems} 
          users={users} 
          showActions={true}
        />
      )}
    </div>
  );
}
