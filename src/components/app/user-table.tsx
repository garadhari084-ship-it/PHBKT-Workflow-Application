"use client";

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { User } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { FilePenLine, Trash2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

type UserTableProps = {
  users: User[];
};

export default function UserTable({ users }: UserTableProps) {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [deleteItem, setDeleteItem] = React.useState<User | null>(null);

  const getUserFullName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.name || user.email;
  }

  const handleDeleteClick = (e: React.MouseEvent, user: User) => {
    e.stopPropagation();
    setDeleteItem(user);
  };

  const handleConfirmDelete = async () => {
    if (!deleteItem || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not delete user. Please try again.',
      });
      return;
    }

    const userDocRef = doc(firestore, `users/${deleteItem.id}`);

    try {
      await deleteDoc(userDocRef);
      toast({
        title: 'User Data Deleted',
        description: `User document for ${deleteItem.email} has been deleted. Please delete the user from the Firebase Authentication console manually.`,
      });
    } catch (error) {
      console.error("Error deleting user document:", error);
      const permissionError = new FirestorePermissionError({
        path: userDocRef.path,
        operation: 'delete',
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: 'You may not have permission to delete this user document.',
      });
    } finally {
      setDeleteItem(null);
    }
  };

  const handleModifyClick = (e: React.MouseEvent, user: User) => {
    e.stopPropagation();
    router.push(`/dashboard/admin/users/edit?id=${user.id}`);
  };

  return (
    <>
      <Card className="rounded-lg shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-accent border-b">
                <TableHead>Employee ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium py-0">{user.employeeId || 'N/A'}</TableCell>
                  <TableCell className="font-medium py-0">{getUserFullName(user)}</TableCell>
                  <TableCell className="py-0">{user.email}</TableCell>
                  <TableCell className="py-0">{user.role}</TableCell>
                  <TableCell className="py-0">
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleModifyClick(e, user)}>
                          <FilePenLine className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => handleDeleteClick(e, user)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                  <TableRow>
                      <TableCell colSpan={5} className="text-center h-24">
                          No users found.
                      </TableCell>
                  </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AlertDialog open={!!deleteItem} onOpenChange={(isOpen) => !isOpen && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user document for{' '}
              <span className="font-bold">{deleteItem?.email}</span>. You will need to manually delete the user from Firebase Authentication.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteItem(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={handleConfirmDelete}
            >
              Delete Document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
