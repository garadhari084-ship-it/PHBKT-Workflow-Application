'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, errorEmitter, FirestorePermissionError, useDoc, useMemoFirebase } from '@/firebase';
import { firebaseConfig } from '@/firebase/config';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, runTransaction } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useState, useEffect, useMemo } from 'react';
import { Building, User as UserIcon, Mail, Phone, Briefcase, KeyRound, UserSquare, BarChart, MapPin, Shield, Fingerprint, FilePenLine, Eye, EyeOff } from 'lucide-react';

const formSchema = z.object({
  firstName: z.string().min(1, 'First name is required.'),
  middleName: z.string().optional(),
  lastName: z.string().min(1, 'Last name is required.'),
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters.'),
  phoneNumber: z.string().length(10, 'Mobile number must be 10 digits.'),
  dateOfBirth: z.string().min(1, "Date of birth is required."),
  aadharNumber: z.string().length(12, "Aadhar Number must be 12 digits.").optional().or(z.literal('')),
  panNumber: z.string().length(10, "PAN Number must be 10 characters.").regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format.").optional().or(z.literal('')),
  department: z.string().min(1, "Department is required."),
  jobTitle: z.string().min(1, "Job title is required."),
  level: z.string().min(1, "Level is required."),
  workLocation: z.string().min(1, "Work location is required."),
  role: z.enum(['User', 'admin']),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function NewUserForm() {
  const firestore = useFirestore();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmailEditable, setIsEmailEditable] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Fetch the counter to display the next employee ID
  const counterRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'counters', 'users');
  }, [firestore]);

  const { data: counterData, isLoading: isLoadingCounter } = useDoc<{ value: number }>(counterRef);

  const nextEmployeeId = useMemo(() => {
    if (isLoadingCounter) return 'Loading...';
    const startId = 1568400;
    const nextId = counterData ? counterData.value + 1 : startId;
    return String(nextId);
  }, [counterData, isLoadingCounter]);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      middleName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'User',
      phoneNumber: '',
      dateOfBirth: '',
      aadharNumber: '',
      panNumber: '',
      department: '',
      jobTitle: '',
      level: '',
      workLocation: '',
    },
  });

  const firstName = form.watch('firstName');
  const lastName = form.watch('lastName');
  
  const capitalize = (s: string) => {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  useEffect(() => {
    if (isEmailEditable) return;

    const first = firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const last = lastName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (first && last) {
      form.setValue('email', `${first}.${last}@phbkt.com`, { shouldValidate: true });
    } else {
      form.setValue('email', '', { shouldValidate: false });
      if (form.formState.errors.email) {
          form.clearErrors('email');
      }
    }
  }, [firstName, lastName, form, isEmailEditable]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Firestore is not available.',
      });
      return;
    }
    if (!values.email) {
        toast({
            variant: 'destructive',
            title: 'Invalid Email',
            description: 'Email is required.',
        });
        return;
    }

    setIsSubmitting(true);
    
    const tempAppName = `temp-user-creation-${Date.now()}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);
    
    let newUserUid: string | null = null;
    let newUserDocForError: any = null;

    try {
      const userCredential = await createUserWithEmailAndPassword(tempAuth, values.email, values.password);
      newUserUid = userCredential.user.uid;

      await runTransaction(firestore, async (transaction) => {
        const counterRef = doc(firestore, 'counters', 'users');
        const counterDoc = await transaction.get(counterRef);
        const startId = 1568400;
        const newCount = counterDoc.exists() ? counterDoc.data().value + 1 : startId;
        const employeeId = String(newCount);
        
        const userDocRef = doc(firestore, `users/${newUserUid}`);
        
        const newUserDoc = {
          id: newUserUid,
          employeeId: employeeId,
          email: values.email,
          firstName: values.firstName,
          middleName: values.middleName || '',
          lastName: values.lastName,
          dateOfBirth: values.dateOfBirth ? new Date(values.dateOfBirth).toISOString() : '',
          aadharNumber: values.aadharNumber || '',
          panNumber: values.panNumber || '',
          company: 'PHBKT Group Limited',
          department: values.department,
          jobTitle: values.jobTitle,
          level: values.level,
          workLocation: values.workLocation,
          role: values.role,
          phoneNumber: values.phoneNumber ? `+91${values.phoneNumber}` : '',
        };
        newUserDocForError = newUserDoc;
        
        transaction.set(userDocRef, newUserDoc);
        transaction.set(counterRef, { value: newCount }, { merge: true });
      });

      toast({
        title: 'Success!',
        description: `User ${values.email} has been created.`,
      });
        
      navigate('/dashboard/admin/users');
      
    } catch (error: any) {
      console.error("Error creating user:", error);
      
      if (error.code && error.code.startsWith('auth/')) {
        toast({
          variant: 'destructive',
          title: 'Authentication Error',
          description: error.code === 'auth/email-already-in-use' ? 'This email address is already in use.' : error.message,
        });
      } else {
        const permissionError = new FirestorePermissionError({
          path: `users/${newUserUid || '{newUserId}'}`,
          operation: 'create',
          requestResourceData: newUserDocForError,
        });
        errorEmitter.emit('permission-error', permissionError);

        toast({
          variant: 'destructive',
          title: 'Database Error',
          description: 'Could not save user data. You may not have permissions.',
        });
      }
    } finally {
      try {
        if (tempAuth.currentUser) await signOut(tempAuth);
        await deleteApp(tempApp);
      } catch (cleanupError) {
        console.error("Error during auth cleanup:", cleanupError);
      }
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
                        <FormControl>
                            <Input disabled value={nextEmployeeId} className="border-zinc-400" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email<span className="text-destructive"> *</span></FormLabel>
                                <div className="flex items-center gap-2">
                                    <FormControl>
                                        <Input 
                                            {...field}
                                            disabled={!isEmailEditable}
                                            className="border-zinc-400"
                                        />
                                    </FormControl>
                                    {firstName && lastName && (
                                      <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => setIsEmailEditable(true)}
                                          aria-label="Edit email"
                                      >
                                          <FilePenLine className="h-4 w-4" />
                                      </Button>
                                    )}
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormItem>
                        <FormLabel>Company</FormLabel>
                        <FormControl>
                            <Input disabled value="PHBKT Group Limited" className="border-zinc-400" />
                        </FormControl>
                        <FormMessage />
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
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Password<span className="text-destructive"> *</span></FormLabel>
                                <div className="relative">
                                    <FormControl>
                                        <Input
                                            type={showPassword ? 'text' : 'password'}
                                            className="pr-10 border-zinc-400"
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
                                <FormLabel>Confirm Password<span className="text-destructive"> *</span></FormLabel>
                                <div className="relative">
                                    <FormControl>
                                        <Input
                                            type={showPassword ? 'text' : 'password'}
                                            className="pr-10 border-zinc-400"
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
              <Button type="button" variant="outline" onClick={() => navigate('/dashboard/admin/users')}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create User'}
              </Button>
            </div>
        </form>
    </Form>
  );
}
