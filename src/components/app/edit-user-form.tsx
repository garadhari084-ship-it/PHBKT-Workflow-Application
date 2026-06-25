
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useState, useEffect } from 'react';
import type { User } from '@/lib/types';
import { User as UserIcon, Briefcase, UserSquare, Eye, EyeOff, KeyRound } from 'lucide-react';

const formSchema = z.object({
  firstName: z.string().min(1, 'First name is required.'),
  middleName: z.string().optional(),
  lastName: z.string().min(1, 'Last name is required.'),
  phoneNumber: z.string().length(10, 'Mobile number must be 10 digits.'),
  dateOfBirth: z.string().min(1, 'Date of Birth is required.'),
  aadharNumber: z.string().length(12, "Aadhar number must be 12 digits.").optional().or(z.literal('')),
  panNumber: z.string().length(10, "PAN number must be 10 characters.").regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format.").optional().or(z.literal('')),
  department: z.string().min(1, "Department is required."),
  jobTitle: z.string().min(1, "Job title is required."),
  level: z.string().min(1, "Level is required."),
  workLocation: z.string().min(1, "Work location is required."),
  role: z.enum(['User', 'admin']),
  password: z.string().min(6, 'Password must be at least 6 characters.').optional().or(z.literal('')),
  confirmPassword: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});


type EditUserFormProps = {
  user: User;
};

export default function EditUserForm({ user }: EditUserFormProps) {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  const capitalize = (s: string) => {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  useEffect(() => {
    if (user.phoneNumber) {
      setPhoneNumber(user.phoneNumber.replace(/^\+91/, ''));
    }
  }, [user.phoneNumber]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: user.firstName || '',
      middleName: user.middleName || '',
      lastName: user.lastName || '',
      role: user.role,
      phoneNumber: phoneNumber,
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split('T')[0] : '',
      aadharNumber: user.aadharNumber || '',
      panNumber: user.panNumber || '',
      department: user.department || '',
      jobTitle: user.jobTitle || '',
      level: user.level || '',
      workLocation: user.workLocation || '',
      password: '',
      confirmPassword: '',
    },
  });
  
  useEffect(() => {
      form.setValue('phoneNumber', phoneNumber);
  }, [phoneNumber, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'User data is missing. Cannot update.',
      });
      return;
    }

    setIsSubmitting(true);
    
    const passwordUpdateAttempted = !!values.password;

    const { password, confirmPassword, ...userDataToUpdate } = values;

    const userDocRef = doc(firestore, `users/${user.id}`);
    const updatedUserData = {
        ...userDataToUpdate,
        dateOfBirth: values.dateOfBirth ? new Date(values.dateOfBirth).toISOString() : '',
        phoneNumber: values.phoneNumber ? `+91${values.phoneNumber}` : '',
    };

    try {
      await updateDoc(userDocRef, updatedUserData);

      toast({
        title: 'User Updated',
        description: passwordUpdateAttempted
          ? `User details for ${user.email} have been updated. Password was not changed as this is not supported.`
          : `User ${user.email} has been updated successfully.`,
      });
      router.push('/dashboard/admin/users');
    } catch (error: any) {
      console.error("Error updating user:", error);
      const permissionError = new FirestorePermissionError({
        path: userDocRef.path,
        operation: 'update',
        requestResourceData: updatedUserData,
      });
      errorEmitter.emit('permission-error', permissionError);

      toast({
        variant: 'destructive',
        title: 'Update Error',
        description: 'Could not update user data. A permission error was reported.',
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
                <CardTitle className="flex items-center gap-2 text-lg"><UserSquare className="h-5 w-5 text-primary" /> Official Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormItem>
                    <FormLabel>Employee ID</FormLabel>
                    <FormControl><Input disabled value={user.employeeId} className="border-zinc-400" /></FormControl>
                </FormItem>
                <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" value={user.email} disabled className="border-zinc-400" /></FormControl>
                </FormItem>
                 <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl><Input disabled value={user.company || 'PHBKT Group Limited'} className="border-zinc-400" /></FormControl>
                </FormItem>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><UserIcon className="h-5 w-5 text-primary" /> Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                     <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>First Name<span className="text-destructive"> *</span></FormLabel>
                            <FormControl><Input {...field} onChange={e => field.onChange(capitalize(e.target.value))} className="border-zinc-400" /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="middleName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Middle Name</FormLabel>
                                <FormControl><Input {...field} onChange={e => field.onChange(capitalize(e.target.value))} className="border-zinc-400" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Last Name<span className="text-destructive"> *</span></FormLabel>
                            <FormControl><Input {...field} onChange={e => field.onChange(capitalize(e.target.value))} className="border-zinc-400" /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                    <FormField
                        control={form.control}
                        name="phoneNumber"
                        render={({ field }) => (
                            <FormItem className="space-y-0 items-start">
                                <FormLabel className="font-normal">Mobile Number<span className="text-destructive"> *</span></FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-muted-foreground">+91</span>
                                        <Input
                                            className="pl-10 h-7 border-zinc-400"
                                            {...field}
                                            onChange={(e) => {
                                                const numericValue = e.target.value.replace(/[^0-9]/g, '');
                                                if (numericValue.length <= 10) {
                                                  field.onChange(numericValue);
                                                }
                                            }}
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="dateOfBirth"
                        render={({ field }) => (
                            <FormItem className="space-y-0 items-start">
                                <FormLabel className="font-normal">Date of Birth<span className="text-destructive"> *</span></FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} className="w-fit h-7 border-zinc-400" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="aadharNumber"
                        render={({ field }) => (
                            <FormItem className="space-y-0">
                                <FormLabel className="font-normal">Aadhar Number</FormLabel>
                                <FormControl>
                                    <Input 
                                        {...field} 
                                        className="h-7 border-zinc-400"
                                        onChange={(e) => {
                                            const numericValue = e.target.value.replace(/[^0-9]/g, '');
                                            if (numericValue.length <= 12) {
                                                field.onChange(numericValue);
                                            }
                                        }}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="panNumber"
                        render={({ field }) => (
                            <FormItem className="space-y-0">
                                <FormLabel className="font-normal">PAN Number</FormLabel>
                                <FormControl>
                                    <Input 
                                        {...field} 
                                        className="h-7 border-zinc-400"
                                        onChange={(e) => {
                                            const upperValue = e.target.value.toUpperCase();
                                            if (upperValue.length <= 10) {
                                                field.onChange(upperValue);
                                            }
                                        }}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><Briefcase className="h-5 w-5 text-primary" /> Employment Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Department<span className="text-destructive"> *</span></FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger className="border-zinc-400"><SelectValue placeholder="Select a department" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="Technology">Technology</SelectItem>
                                    <SelectItem value="Sales">Sales</SelectItem>
                                    <SelectItem value="Marketing">Marketing</SelectItem>
                                    <SelectItem value="Human Resources">Human Resources</SelectItem>
                                    <SelectItem value="Operations">Operations</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="jobTitle"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Job Title<span className="text-destructive"> *</span></FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger className="border-zinc-400"><SelectValue placeholder="Select a job title" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="Software Engineer">Software Engineer</SelectItem>
                                    <SelectItem value="Sales Executive">Sales Executive</SelectItem>
                                    <SelectItem value="Marketing Manager">Marketing Manager</SelectItem>
                                    <SelectItem value="HR Generalist">HR Generalist</SelectItem>
                                    <SelectItem value="Operations Analyst">Operations Analyst</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="level"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Level<span className="text-destructive"> *</span></FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger className="border-zinc-400"><SelectValue placeholder="Select a level" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="L1">L1 - Associate</SelectItem>
                                    <SelectItem value="L2">L2 - Intermediate</SelectItem>
                                    <SelectItem value="L3">L3 - Senior</SelectItem>
                                    <SelectItem value="L4">L4 - Lead</SelectItem>
                                    <SelectItem value="L5">L5 - Manager</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="workLocation"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Work Location<span className="text-destructive"> *</span></FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger className="border-zinc-400"><SelectValue placeholder="Select a location" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="Mumbai Office">Mumbai Office</SelectItem>
                                    <SelectItem value="Pune Office">Pune Office</SelectItem>
                                    <SelectItem value="Remote">Remote</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Role<span className="text-destructive"> *</span></FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger className="border-zinc-400"><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="User">User</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><KeyRound className="h-5 w-5 text-primary" /> Security</CardTitle>
                <CardDescription>Leave these fields blank to keep the current password.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <div className="relative">
                                <FormControl>
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        className="pr-10 border-zinc-400"
                                        placeholder="Enter new password"
                                        {...field}
                                    />
                                </FormControl>
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 flex items-center pr-3"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-5 w-5 text-gray-500" />
                                    ) : (
                                        <Eye className="h-5 w-5 text-gray-500" />
                                    )}
                                </button>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Confirm New Password</FormLabel>
                            <div className="relative">
                                <FormControl>
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        className="pr-10 border-zinc-400"
                                        placeholder="Confirm new password"
                                        {...field}
                                    />
                                </FormControl>
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 flex items-center pr-3"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-5 w-5 text-gray-500" />
                                    ) : (
                                        <Eye className="h-5 w-5 text-gray-500" />
                                    )}
                                </button>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </CardContent>
        </Card>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={() => router.push('/dashboard/admin/users')}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Update User'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
