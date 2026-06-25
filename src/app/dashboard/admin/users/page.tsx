'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import UserTable from '@/components/app/user-table';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function AdminUsersPage() {
  const firestore = useFirestore();
  const router = useRouter();

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'));
  }, [firestore]);

  const { data: usersData, isLoading: isLoadingUsers, error } = useCollection<User>(usersQuery);

  const isLoading = isLoadingUsers;

  const users = usersData || [];
  
  return (
    <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-2xl font-bold">All Users</h1>
        </div>
        <Link href="/dashboard/admin/users/new" passHref>
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create User
          </Button>
        </Link>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load users. Please check your network connection and try again.
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
        <UserTable 
          users={users} 
        />
      )}
    </div>
  );
}
