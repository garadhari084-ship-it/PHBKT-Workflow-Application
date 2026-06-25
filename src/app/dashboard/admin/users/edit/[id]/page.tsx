'use client';

import { useParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User } from '@/lib/types';
import EditUserForm from '@/components/app/edit-user-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function EditUserPage() {
  const params = useParams();
  const id = params.id as string;
  const firestore = useFirestore();

  const userRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, `users/${id}`);
  }, [firestore, id]);

  const { data: user, isLoading: isLoadingUser, error } = useDoc<User>(userRef);

  if (error) {
    return (
      <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to load user data. Please check your network connection and try again.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (isLoadingUser) {
    return (
      <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          <Skeleton className="h-10 w-48 mb-6" />
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-10 w-full" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
               <div className="flex justify-end gap-2 pt-4">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!user) {
    // Can't use notFound() directly in client component after hooks.
    return (
       <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto p-8 text-center">
            <h1 className="text-2xl font-bold">User Not Found</h1>
            <p className="text-muted-foreground">The user with ID "{id}" could not be found.</p>
        </div>
    );
  }

  return (
    <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Edit User: {user.firstName} {user.lastName}</h1>
        <EditUserForm user={user} />
      </div>
    </div>
  );
}
