'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { WorkItem } from '@/lib/types';

const formSchema = z.object({
  customerName: z.string().min(1, 'Customer Name is required.'),
  customerEmail: z.string().email('Invalid email address.').optional().or(z.literal('')),
  customerPhone: z.string().min(1, 'Customer Phone is required.'),
  secondaryPhone: z.string().optional(),
  customerDateOfBirth: z.string().optional(),

  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pinCode: z.string().optional(),

  customerAadhar: z.string().optional(),
  customerPan: z.string().optional(),
  
  customerBankName: z.string().optional(),
  customerAccountNumber: z.string().optional(),
  customerIfscCode: z.string().optional(),

  customerOtherInfo: z.string().optional(),
});

interface EditCustomerDetailsDialogProps {
  workItem: WorkItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditCustomerDetailsDialog({ workItem, open, onOpenChange }: EditCustomerDetailsDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerName: workItem.customerName || '',
      customerEmail: workItem.customerEmail || '',
      customerPhone: workItem.customerPhone?.replace('+91', '') || '',
      secondaryPhone: workItem.secondaryPhone?.replace('+91', '') || '',
      customerDateOfBirth: workItem.customerDateOfBirth ? workItem.customerDateOfBirth.split('T')[0] : '',
      address: workItem.address || '',
      city: workItem.city || '',
      state: workItem.state || '',
      pinCode: workItem.pinCode || '',
      customerAadhar: workItem.customerAadhar || '',
      customerPan: workItem.customerPan || '',
      customerBankName: workItem.customerBankName || '',
      customerAccountNumber: workItem.customerAccountNumber || '',
      customerIfscCode: workItem.customerIfscCode || '',
      customerOtherInfo: workItem.customerOtherInfo || '',
    },
  });
  
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firestore || !user) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to perform this action.' });
      return;
    }
    setIsSubmitting(true);

    const updatedData: Partial<WorkItem> = {};

    const formatPhone = (phone: string | undefined) => phone ? `+91${phone}` : '';

    const newValues = {
        ...values,
        customerPhone: formatPhone(values.customerPhone),
        secondaryPhone: formatPhone(values.secondaryPhone),
        customerDateOfBirth: values.customerDateOfBirth ? new Date(values.customerDateOfBirth).toISOString() : '',
    };

    const originalValues = {
        customerName: workItem.customerName || '',
        customerEmail: workItem.customerEmail || '',
        customerPhone: workItem.customerPhone || '',
        secondaryPhone: workItem.secondaryPhone || '',
        customerDateOfBirth: workItem.customerDateOfBirth || '',
        address: workItem.address || '',
        city: workItem.city || '',
        state: workItem.state || '',
        pinCode: workItem.pinCode || '',
        customerAadhar: workItem.customerAadhar || '',
        customerPan: workItem.customerPan || '',
        customerBankName: workItem.customerBankName || '',
        customerAccountNumber: workItem.customerAccountNumber || '',
        customerIfscCode: workItem.customerIfscCode || '',
        customerOtherInfo: workItem.customerOtherInfo || '',
    };
    
    let hasChanges = false;
    (Object.keys(newValues) as Array<keyof typeof newValues>).forEach(key => {
        if (newValues[key] !== originalValues[key]) {
            updatedData[key] = newValues[key];
            hasChanges = true;
        }
    });

    if (!hasChanges) {
        toast({ title: 'No Changes', description: 'No details were modified.' });
        setIsSubmitting(false);
        onOpenChange(false);
        return;
    }

    const workItemRef = doc(firestore, 'work_items', workItem.id);

    try {
      await updateDoc(workItemRef, updatedData);
      toast({ title: 'Success', description: 'Customer details updated successfully.' });
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating customer details:', error);
      const permissionError = new FirestorePermissionError({
        path: workItemRef.path,
        operation: 'update',
        requestResourceData: updatedData,
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not save the changes.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Customer Details</DialogTitle>
          <DialogDescription>Modify the customer's information. All changes will be recorded in the notes.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="contact">
              <TabsList>
                <TabsTrigger value="contact">Contact & Personal</TabsTrigger>
                <TabsTrigger value="address">Address</TabsTrigger>
                <TabsTrigger value="identity">Identity & Bank</TabsTrigger>
                <TabsTrigger value="other">Other</TabsTrigger>
              </TabsList>
              
              <TabsContent value="contact" className="space-y-4 pt-4">
                 <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="customerName" render={({ field }) => (<FormItem><FormLabel>Customer Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="customerDateOfBirth" render={({ field }) => (<FormItem><FormLabel>Date of Birth</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="customerEmail" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="customerPhone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="secondaryPhone" render={({ field }) => (<FormItem><FormLabel>Secondary Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
              </TabsContent>

              <TabsContent value="address" className="space-y-4 pt-4">
                <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="city" render={({ field }) => (<FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="state" render={({ field }) => (<FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="pinCode" render={({ field }) => (<FormItem><FormLabel>Pin Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
              </TabsContent>

              <TabsContent value="identity" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="customerAadhar" render={({ field }) => (<FormItem><FormLabel>Aadhar Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="customerPan" render={({ field }) => (<FormItem><FormLabel>PAN Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <h3 className="font-medium pt-4">Bank Details</h3>
                 <div className="grid grid-cols-3 gap-4">
                    <FormField control={form.control} name="customerBankName" render={({ field }) => (<FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="customerAccountNumber" render={({ field }) => (<FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="customerIfscCode" render={({ field }) => (<FormItem><FormLabel>IFSC Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
              </TabsContent>

              <TabsContent value="other" className="space-y-4 pt-4">
                <FormField control={form.control} name="customerOtherInfo" render={({ field }) => (<FormItem><FormLabel>Other Information</FormLabel><FormControl><Textarea {...field} rows={5} /></FormControl><FormMessage /></FormItem>)} />
              </TabsContent>
            </Tabs>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Changes'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
