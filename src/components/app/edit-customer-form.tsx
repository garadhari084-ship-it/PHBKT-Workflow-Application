'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useState } from 'react';
import type { Customer } from '@/lib/types';
import { User as UserIcon } from 'lucide-react';
import { Textarea } from '../ui/textarea';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.').optional().or(z.literal('')),
  phone: z.string().min(10, 'Phone number must be at least 10 digits.'),
  secondaryPhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pinCode: z.string().optional(),
});


type EditCustomerFormProps = {
  customer: Customer;
};

export default function EditCustomerForm({ customer }: EditCustomerFormProps) {
  const firestore = useFirestore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone.replace('+91', '') || '',
      secondaryPhone: customer.secondaryPhone?.replace('+91', '') || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      pinCode: customer.pinCode || '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !customer) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Customer data is missing. Cannot update.',
      });
      return;
    }

    setIsSubmitting(true);
    
    const customerDocRef = doc(firestore, `customers/${customer.id}`);
    const updatedCustomerData = {
        ...values,
        phone: values.phone ? `+91${values.phone}` : '',
        secondaryPhone: values.secondaryPhone ? `+91${values.secondaryPhone}` : '',
    };

    try {
      await updateDoc(customerDocRef, updatedCustomerData);

      toast({
        title: 'Customer Updated',
        description: `Customer ${customer.name} has been updated successfully.`,
      });
      navigate('/dashboard/admin/manage-customer');
    } catch (error: any) {
      console.error("Error updating customer:", error);
      const permissionError = new FirestorePermissionError({
        path: customerDocRef.path,
        operation: 'update',
        requestResourceData: updatedCustomerData,
      });
      errorEmitter.emit('permission-error', permissionError);

      toast({
        variant: 'destructive',
        title: 'Update Error',
        description: 'Could not update customer data. A permission error was reported.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><UserIcon className="h-5 w-5 text-primary" /> Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>Name<span className="text-destructive"> *</span></FormLabel>
                          <FormControl><Input {...field} className="border-zinc-400" /></FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                  <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl><Input type="email" {...field} className="border-zinc-400" /></FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Phone<span className="text-destructive"> *</span></FormLabel>
                                <div className="relative">
                                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-muted-foreground">+91</span>
                                    <FormControl>
                                      <Input
                                          className="pl-10 h-8 border-zinc-400"
                                          {...field}
                                      />
                                    </FormControl>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="secondaryPhone"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Secondary Phone</FormLabel>
                                <div className="relative">
                                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-muted-foreground">+91</span>
                                     <FormControl>
                                      <Input
                                          className="pl-10 h-8 border-zinc-400"
                                          {...field}
                                      />
                                    </FormControl>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl><Textarea {...field} className="border-zinc-400" /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl><Input {...field} className="border-zinc-400" /></FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                  <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl><Input {...field} className="border-zinc-400" /></FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                  <FormField
                      control={form.control}
                      name="pinCode"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>Pin Code</FormLabel>
                          <FormControl><Input {...field} className="border-zinc-400" /></FormControl>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
                </div>
            </CardContent>
        </Card>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={() => navigate('/dashboard/admin/manage-customer')}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Update Customer'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
