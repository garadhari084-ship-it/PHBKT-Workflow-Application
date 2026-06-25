"use client";

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Trash2, UserPlus, Unlock, FilePenLine } from 'lucide-react';
import type { WorkItem, User, WorkItemTab } from '@/lib/types';
import ClientFormattedDate from './client-formatted-date';
import { Card, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type WorkItemTableProps = {
  workItems: WorkItem[];
  users: User[];
  showActions?: boolean;
  className?: string;
};

export default function WorkItemTable({ workItems, users, showActions = false, className }: WorkItemTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const [allocationItem, setAllocationItem] = React.useState<WorkItem | null>(null);
  const [selectedUserId, setSelectedUserId] = React.useState<string>('');
  const [deleteItem, setDeleteItem] = React.useState<WorkItem | null>(null);
  const [unlockItem, setUnlockItem] = React.useState<WorkItem | null>(null);


  const handleRowClick = (item: WorkItem) => {
    const openTabsString = localStorage.getItem('openWorkItemTabs');
    let openTabs: WorkItemTab[] = openTabsString ? JSON.parse(openTabsString) : [];

    if (!openTabs.find(tab => tab.href === `/dashboard/work-item/${item.id}`)) {
      openTabs.push({ href: `/dashboard/work-item/${item.id}`, label: item.id });
      localStorage.setItem('openWorkItemTabs', JSON.stringify(openTabs));
      window.dispatchEvent(new CustomEvent('tabs-update'));
    }

    router.push(`/dashboard/work-item/${item.id}`);
  };

  const getDisplayStatus = (status: WorkItem['status']): WorkItem['status'] => {
    if (status === 'Reindex' || status === 'Transfer' || status === 'Pend') {
        return 'Open';
    }
    return status;
  };

  const getUserName = (userId: string) => {
    if (!userId) return 'Unassigned';
    const user = users.find(u => u.id === userId);
    if (!user) return 'Unassigned';
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.name || user.email;
  };

  const statusBadgeClass = (status: WorkItem['status']): string => {
    const baseClasses = 'font-normal';
    switch (status) {
      case 'Open':
        return `${baseClasses} bg-blue-500 text-white border-transparent hover:bg-blue-600`;
      case 'Close':
        return `${baseClasses} bg-muted text-muted-foreground border-transparent`;
      case 'Completed':
        return `${baseClasses} bg-[hsl(var(--chart-3))] text-primary-foreground border-transparent`;
      case 'Terminated':
        return `${baseClasses} bg-destructive text-destructive-foreground border-transparent`;
      case 'Reindex':
        return `${baseClasses} bg-[hsl(var(--chart-4))] text-foreground border-transparent`;
      case 'Transfer':
        return `${baseClasses} bg-[hsl(var(--chart-5))] text-foreground border-transparent`;
      default:
        return `${baseClasses} bg-secondary text-secondary-foreground border-transparent`;
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, item: WorkItem) => {
    e.stopPropagation();
    setDeleteItem(item);
  };

  const handleConfirmDelete = async () => {
    if (!deleteItem || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not delete work item. Please try again.',
      });
      return;
    }

    const workItemRef = doc(firestore, `work_items/${deleteItem.id}`);

    try {
      await deleteDoc(workItemRef);
      toast({
        title: 'Success!',
        description: `Work item ${deleteItem.id} has been deleted.`,
      });
    } catch (error) {
      console.error("Error deleting work item:", error);
      const permissionError = new FirestorePermissionError({
        path: workItemRef.path,
        operation: 'delete',
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        variant: 'destructive',
        title: 'Deletion Failed',
        description: 'You may not have permission to perform this action.',
      });
    } finally {
      setDeleteItem(null);
    }
  };

  const handleAllocateClick = (e: React.MouseEvent, item: WorkItem) => {
    e.stopPropagation();
    setAllocationItem(item);
    setSelectedUserId(item.assignedUserId || 'unassigned');
  };

  const handleAllocationDialogClose = () => {
    setAllocationItem(null);
    setSelectedUserId('');
  };

  const handleConfirmAllocation = async () => {
    if (!allocationItem || !firestore) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not allocate work item. Please try again.',
        });
        return;
    }

    const newAssignedTo = selectedUserId === 'unassigned' ? '' : selectedUserId;

    if (allocationItem.assignedUserId === newAssignedTo) {
        handleAllocationDialogClose();
        return;
    }

    const workItemRef = doc(firestore, `work_items/${allocationItem.id}`);

    try {
      await updateDoc(workItemRef, {
        assignedUserId: newAssignedTo,
        lastUpdatedDate: new Date().toISOString(),
      });
      toast({
        title: 'Success!',
        description: `Work item ${allocationItem.id} has been allocated.`,
      });
      handleAllocationDialogClose();
    } catch (error) {
        console.error("Error allocating work item:", error);
        const permissionError = new FirestorePermissionError({
            path: workItemRef.path,
            operation: 'update',
            requestResourceData: { assignedUserId: newAssignedTo },
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
            variant: 'destructive',
            title: 'Allocation Failed',
            description: 'You may not have permission to perform this action.',
        });
    }
  };
  
  const handleUnlockClick = (e: React.MouseEvent, item: WorkItem) => {
    e.stopPropagation();
    setUnlockItem(item);
  };

  const handleConfirmUnlock = async () => {
    if (!unlockItem || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not unlock work item. Please try again.',
      });
      return;
    }

    const workItemRef = doc(firestore, `work_items/${unlockItem.id}`);

    try {
      await updateDoc(workItemRef, { lockedBy: '' });
      toast({
        title: 'Success!',
        description: `Work item ${unlockItem.id} has been unlocked.`,
      });
    } catch (error) {
      console.error("Error unlocking work item:", error);
      const permissionError = new FirestorePermissionError({
        path: workItemRef.path,
        operation: 'update',
        requestResourceData: { lockedBy: '' },
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        variant: 'destructive',
        title: 'Unlock Failed',
        description: 'You may not have permission to perform this action.',
      });
    } finally {
      setUnlockItem(null);
    }
  };


  return (
    <>
      <Card className="rounded-lg shadow-md overflow-hidden">
        <CardContent className="p-0">
          <Table className={className}>
            <TableHeader>
              <TableRow className="bg-accent border-b">
                <TableHead className="w-12"></TableHead>
                <TableHead className="min-w-[100px] whitespace-nowrap">Case ID</TableHead>
                <TableHead className="min-w-[100px]">Status</TableHead>
                <TableHead className="min-w-[180px] whitespace-nowrap">Process</TableHead>
                <TableHead className="min-w-[150px]">Customer Name</TableHead>
                <TableHead className="min-w-[150px]">Assigned To</TableHead>
                <TableHead className="min-w-[120px] whitespace-nowrap">Date</TableHead>
                {showActions && <TableHead className="min-w-[120px] text-right pr-4">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {workItems.map(item => {
                const displayStatus = getDisplayStatus(item.status);
                return (
                  <TableRow key={item.id} onClick={() => handleRowClick(item)} className="cursor-pointer group hover:bg-muted/50 transition-colors duration-200">
                    <TableCell className="py-2"><ArrowRight className="h-4 w-4 text-yellow-500 group-hover:translate-x-1 transition-transform duration-200" /></TableCell>
                    <TableCell className="font-medium py-2">{item.id}</TableCell>
                    <TableCell className="py-2"><Badge className={statusBadgeClass(displayStatus)}>{displayStatus}</Badge></TableCell>
                    <TableCell className="py-2">{item.workType}</TableCell>
                    <TableCell className="py-2">{item.customerName || 'N/A'}</TableCell>
                    <TableCell className="py-2">{item.assignedUserId ? getUserName(item.assignedUserId) : item.workType}</TableCell>
                    <TableCell className="py-2"><ClientFormattedDate date={item.createdDate} formatString="MMM d, yyyy" /></TableCell>
                    {showActions && (
                      <TableCell className="py-0">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleRowClick(item); }}>
                            <FilePenLine className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleAllocateClick(e, item)}>
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => handleDeleteClick(e, item)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {item.lockedBy && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={(e) => handleUnlockClick(e, item)}>
                                  <Unlock className="h-4 w-4" />
                              </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
              {workItems.length === 0 && (
                  <TableRow>
                      <TableCell colSpan={showActions ? 8 : 7} className="text-center h-24">
                          No work items found.
                      </TableCell>
                  </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!allocationItem} onOpenChange={(isOpen) => !isOpen && handleAllocationDialogClose()}>
          <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                  <DialogTitle>Allocate Work Item - {allocationItem?.id}</DialogTitle>
                  <DialogDescription>
                      Assign this work item to a different user. Click allocate when you&apos;re done.
                  </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="user-select" className="text-right">
                          User
                      </Label>
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                          <SelectTrigger id="user-select" className="col-span-3">
                              <SelectValue placeholder="Select a user" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="unassigned">
                                  <em>Unassigned</em>
                              </SelectItem>
                              {users.map(user => (
                                  <SelectItem key={user.id} value={user.id}>
                                      {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : (user.name || user.email)}
                                  </SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={handleAllocationDialogClose}>Cancel</Button>
                  <Button onClick={handleConfirmAllocation}>Allocate</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!unlockItem} onOpenChange={(isOpen) => !isOpen && setUnlockItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Force Unlock Case?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unlock the work item{' '}
              <span className="font-bold">{unlockItem?.id}</span>.
              This could cause conflicts if another user is actively working on it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUnlockItem(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={handleConfirmUnlock}
            >
              Force Unlock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteItem} onOpenChange={(isOpen) => !isOpen && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the work item{' '}
              <span className="font-bold">{deleteItem?.id}</span> and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteItem(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={handleConfirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}