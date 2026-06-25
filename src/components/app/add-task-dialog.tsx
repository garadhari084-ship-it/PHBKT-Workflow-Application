
'use client';

import { useState, useMemo, useEffect } from 'react';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { WorkItem } from '@/lib/types';
import { FilePenLine } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
    newBusinessRequestTasks, 
    webAndAppTasks, 
    digitalMarketingTasks, 
    taxAndComplianceTasks, 
    bpoAndKpoTasks, 
    feedbackAndComplaintTasks, 
    otherServiceRequestTasks 
} from '@/lib/tasks';

interface AddTaskDialogProps {
  workItem: WorkItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddTaskDialog({ workItem, open, onOpenChange }: AddTaskDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [workType, setWorkType] = useState(workItem.workType);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  
  const workTypes = ['New Business Request', 'Web & App Development', 'Digital Marketing', 'Tax & Compliance', 'BPO & KPO Services', 'Feedback & Complaint', 'Other Service Request'];

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
    // Reset workType to the work item's workType when the dialog is opened
    if (open) {
      setWorkType(workItem.workType);
      setSelectedTasks([]);
    }
  }, [open, workItem.workType]);

  useEffect(() => {
    // When workType changes, reset the selected tasks
    setSelectedTasks([]);
  }, [workType]);

  const availableTasks = useMemo(() => {
    return allAvailableTasks.filter(task => !selectedTasks.includes(task));
  }, [allAvailableTasks, selectedTasks]);

  const handleSelectTask = (task: string) => {
    setSelectedTasks(prev => [...prev, task]);
  };

  const handleDeselectTask = (task: string) => {
      setSelectedTasks(prev => prev.filter(t => t !== task));
  };


  const handleAddTask = async () => {
    if (!firestore || !user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Database not available or user not logged in.',
      });
      return;
    }
    
    if (selectedTasks.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Tasks Selected',
        description: 'Please select at least one task to add.',
      });
      return;
    }

    setIsSubmitting(true);

    const batch = writeBatch(firestore);
    const tasksCollectionRef = collection(firestore, 'work_items', workItem.id, 'tasks');
    const notesCollectionRef = collection(firestore, 'work_items', workItem.id, 'notes');
    
    const tasksToCreate: any[] = [];
    const notesToCreate: any[] = [];

    selectedTasks.forEach(taskTitle => {
        const newTaskRef = doc(tasksCollectionRef);
        const newNoteRef = doc(notesCollectionRef);

        const newTask = {
          id: newTaskRef.id,
          workItemId: workItem.id,
          title: taskTitle,
          description: '',
          status: 'Pending',
          createdDate: new Date().toISOString(),
          createdBy: user.uid,
        };
        tasksToCreate.push({ref: newTaskRef, data: newTask});

        const newNote = {
            id: newNoteRef.id,
            workItemId: workItem.id,
            authorId: user.uid,
            date: new Date().toISOString(),
            text: `Task added: ${taskTitle}`,
            category: 'Task',
            subject: 'New Task Created',
        };
        notesToCreate.push({ref: newNoteRef, data: newNote});

        batch.set(newTaskRef, newTask);
        batch.set(newNoteRef, newNote);
    });

    try {
      await batch.commit();

      toast({
        title: 'Task(s) Added',
        description: `${selectedTasks.length} task(s) have been successfully added.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding tasks:', error);
      const permissionError = new FirestorePermissionError({
        path: tasksCollectionRef.path, // This is a bit simplified for batch writes
        operation: 'create',
        requestResourceData: { tasks: tasksToCreate.map(t => t.data), notes: notesToCreate.map(n => n.data) },
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({
        variant: 'destructive',
        title: 'Add Task Failed',
        description: 'Could not save the tasks. You may not have permissions.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset state when dialog is closed
      setSelectedTasks([]);
      setWorkType(workItem.workType);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Task(s)</DialogTitle>
          <DialogDescription>
            Select a process and add one or more tasks to this work item.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 py-1">
            <div className="space-y-1">
              <Label htmlFor="process-select" className="text-xs">Process</Label>
              <Select value={workType} onValueChange={setWorkType}>
                <SelectTrigger id="process-select" className="h-6">
                  <SelectValue placeholder="Select a process" />
                </SelectTrigger>
                <SelectContent>
                  {workTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {workType && (
                <div className="border rounded-md mt-1">
                    <Label className="flex items-center justify-center p-1 text-xs font-semibold">Tasks</Label>
                    <Separator />
                     <div className="bg-accent p-1 rounded-b-md">
                        <div className="grid grid-cols-2 text-center">
                            <h3 className="font-semibold mb-0 text-xs">Available Tasks</h3>
                            <h3 className="font-semibold mb-0 text-xs">Selected Tasks</h3>
                        </div>
                        <Separator className="my-1 bg-border/20 w-full h-[0.5px]" />
                        <div className="grid grid-cols-2 relative">
                            <div className="pr-1">
                                <ScrollArea className="h-[200px] w-full rounded-md bg-background border">
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
                                <ScrollArea className="h-[200px] w-full rounded-md bg-background border">
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
                    </div>
                </div>
            )}
        </div>
        <DialogFooter>
            <Button variant="outline" type="button" onClick={() => handleOpenChange(false)}>
                Cancel
            </Button>
            <Button type="button" disabled={isSubmitting || selectedTasks.length === 0} onClick={handleAddTask}>
                {isSubmitting ? 'Adding...' : <><FilePenLine className="mr-2 h-4 w-4" /> Add {selectedTasks.length > 0 ? selectedTasks.length : ''} Task(s)</>}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
