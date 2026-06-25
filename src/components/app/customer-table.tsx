
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
import type { Customer } from '@/lib/types';
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
import Link from 'next/link';
import { cn } from '@/lib/utils';
import ClientFormattedDate from './client-formatted-date';

type CustomerTableProps = {
  customers: Customer[];
};

export default function CustomerTable({ customers }: CustomerTableProps) {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [deleteItem, setDeleteItem] = React.useState<Customer | null>(null);

  const handleDeleteClick = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    setDeleteItem(customer);
  };

  const handleConfirmDelete = async () => {
    if (!deleteItem || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not delete customer. Please try again.',
      });
      return;
    }

    const customerDocRef = doc(firestore, `customers/${deleteItem.id}`);

    try {
      await deleteDoc(customerDocRef);
      toast({
        title: 'Customer Deleted',
        description: `Customer ${deleteItem.name} has been deleted.`,
      });
    } catch (error) {
      console.error("Error deleting customer document:", error);
      const permissionError = new FirestorePermissionError({
        path: customerDocRef.path,
        operation: 'delete',
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: 'You may not have permission to delete this customer.',
      });
    } finally {
      setDeleteItem(null);
    }
  };

  const handleModifyClick = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    router.push(`/dashboard/admin/manage-customer/edit/${customer.id}`);
  };

  return (
    <>
      <Card className="rounded-lg shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-accent border-b">
                <TableHead>Customer ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Created Date</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map(customer => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium py-0">
                    <Link href={`/dashboard/admin/manage-customer/view/${customer.id}`} className="hover:underline text-blue-600">
                      {customer.id}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium py-0">{customer.name}</TableCell>
                  <TableCell className="py-0">{customer.email || 'N/A'}</TableCell>
                  <TableCell className="py-0">{customer.phone}</TableCell>
                  <TableCell className="py-0"><ClientFormattedDate date={customer.createdDate} formatString="dd MMM yyyy" /></TableCell>
                  <TableCell className="py-0">
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleModifyClick(e, customer)}>
                          <FilePenLine className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => handleDeleteClick(e, customer)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {customers.length === 0 && (
                  <TableRow>
                      <TableCell colSpan={6} className="text-center h-24">
                          No customers found.
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
              This action cannot be undone. This will permanently delete the customer record for{' '}
              <span className="font-bold">{deleteItem?.name}</span>. Associated work items will not be deleted but may be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteItem(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={handleConfirmDelete}
            >
              Delete Customer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
