

'use client';

import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, useUser } from '@/firebase';
import { collection, doc, runTransaction, query, where, getDocs, Query, writeBatch } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  User as UserIcon,
  Users,
  Mail,
  Phone,
  MapPin,
  Building,
  Info,
  Briefcase,
  Link as LinkIcon,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { WorkItemTab, Customer, GlobalNote } from '@/lib/types';
import { format } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
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
    newBusinessRequestTasks, 
    webAndAppTasks, 
    digitalMarketingTasks, 
    taxAndComplianceTasks, 
    bpoAndKpoTasks, 
    feedbackAndComplaintTasks, 
    otherServiceRequestTasks 
} from '@/lib/tasks';


const formSchema = z.object({
  workType: z.string().min(1, 'Process is required.'),
  leadType: z.string().min(1, 'Lead Type is required.').optional(),
  assignment: z.enum(['self', 'queue']).optional(),
  customerName: z.string().min(1, 'Customer Name is required.'),
  customerEmail: z.string().email('Invalid email address.').optional().or(z.literal('')),
  customerPhone: z.string().min(1, 'Customer Phone is required.'),
  secondaryPhone: z.string().optional(),
  city: z.string().min(1, 'City is required.'),
  hasBusiness: z.enum(['yes', 'no']).default('yes'),
  businessName: z.string().optional(),
  description: z.string().min(1, 'Overview is required.'),
  tasks: z.array(z.string()).min(1, 'At least one task must be selected.'),
}).superRefine((data, ctx) => {
    if (data.hasBusiness === 'yes' && !data.businessName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Business name is required when customer has a business.',
        path: ['businessName'],
      });
    }
});


const getWorkTypePrefix = (workType: string): string => {
  switch (workType) {
    case 'New Business Request': return 'NB';
    case 'Web & App Development': return 'DS';
    case 'Digital Marketing': return 'DM';
    case 'Tax & Compliance': return 'TC';
    case 'BPO & KPO Services': return 'BPO';
    case 'Feedback & Complaint': return 'FC';
    case 'Other Service Request': return 'OSR';
    default: return 'WI';
  }
};

const generateCustomerUID = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const Stepper = ({ currentStep, steps }: { currentStep: number, steps: {id: number, name: string}[] }) => {
    return (
        <div className="flex flex-col h-[75vh]">
            {steps.map((step, index) => (
                <React.Fragment key={step.id}>
                    <div className="flex items-center">
                        <div
                            className={cn(
                                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0',
                                currentStep > step.id ? 'bg-green-500 text-white' : '',
                                currentStep === step.id ? 'bg-yellow-500 text-white' : '',
                                currentStep < step.id ? 'bg-gray-300 text-gray-500' : ''
                            )}
                        >
                            {step.id}
                        </div>
                        <div className={cn(
                            'ml-4 text-sm',
                            currentStep === step.id ? 'font-bold' : ''
                        )}>
                            {step.name}
                        </div>
                    </div>
                    {index < steps.length - 1 && (
                        <div
                            className={cn(
                                'h-full w-px ml-2.5 my-1',
                                currentStep > step.id + 1 ? 'bg-green-500' : '',
                                currentStep === step.id + 1 ? 'bg-yellow-500' : '',
                                currentStep <= step.id ? 'bg-gray-300' : ''
                            )}
                        />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};


const NewWorkItemForm = () => {
    const [currentStep, setCurrentStep] = React.useState(1);
    const [customerType, setCustomerType] = React.useState<'new' | 'existing' | null>(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const { user } = useUser();
    const firestore = useFirestore();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [selectedTasks, setSelectedTasks] = React.useState<string[]>([]);
    const [existingCustomerId, setExistingCustomerId] = React.useState<string | null>(null);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [isSearching, setIsSearching] = React.useState(false);
    const [foundCustomer, setFoundCustomer] = React.useState<Customer | null>(null);
    const [showCustomerFoundDialog, setShowCustomerFoundDialog] = React.useState(false);
    const [showCustomerNotFoundDialog, setShowCustomerNotFoundDialog] = React.useState(false);
    const [duplicateCustomer, setDuplicateCustomer] = React.useState<Customer | null>(null);
    const [showDuplicateCustomerDialog, setShowDuplicateCustomerDialog] = React.useState(false);
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            workType: '',
            leadType: undefined,
            customerName: '',
            customerEmail: '',
            customerPhone: '',
            secondaryPhone: '',
            city: '',
            hasBusiness: 'yes',
            businessName: '',
            description: '',
            tasks: [],
            assignment: undefined,
        },
    });

    const hasBusiness = form.watch('hasBusiness');
    const workType = form.watch('workType');

    const handleCustomerFieldBlur = async (field: 'email' | 'phone', value: string) => {
        if (!value.trim() || customerType !== 'new') {
          return;
        }
        if (!firestore) return;
    
        setIsSearching(true);
    
        const customersRef = collection(firestore, 'customers');
        let q: Query | null = null;
        const trimmedValue = value.trim();
    
        if (field === 'email' && trimmedValue) {
          q = query(customersRef, where('email', '==', trimmedValue));
        } else if (field === 'phone' && trimmedValue) {
          const fullPhoneNumber = `+91${trimmedValue}`;
          q = query(customersRef, where('phone', '==', fullPhoneNumber));
        }
    
        if (!q) {
          setIsSearching(false);
          return;
        }
    
        try {
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const customerData = querySnapshot.docs[0].data() as Customer;
            // Don't show if it's the same customer we just selected from a previous blur
            if (customerData.id !== existingCustomerId) {
              setDuplicateCustomer(customerData);
              setShowDuplicateCustomerDialog(true);
            }
          }
        } catch (error) {
          console.error('Duplicate customer check failed:', error);
        } finally {
          setIsSearching(false);
        }
    };
    
    const handleUseExistingCustomer = () => {
        if (!duplicateCustomer) return;
    
        form.setValue('customerName', duplicateCustomer.name);
        form.setValue('customerEmail', duplicateCustomer.email || '');
        const phone = duplicateCustomer.phone.startsWith('+91')
          ? duplicateCustomer.phone.substring(3)
          : duplicateCustomer.phone;
        form.setValue('customerPhone', phone);
        const secondaryPhone = duplicateCustomer.secondaryPhone
          ? duplicateCustomer.secondaryPhone.startsWith('+91')
            ? duplicateCustomer.secondaryPhone.substring(3)
            : duplicateCustomer.secondaryPhone
          : '';
        form.setValue('secondaryPhone', secondaryPhone);
        form.setValue('city', duplicateCustomer.city || '');
        
        setExistingCustomerId(duplicateCustomer.id);
        setCustomerType('existing');
    
        setShowDuplicateCustomerDialog(false);
        setDuplicateCustomer(null);
    
        toast({
          title: 'Customer Data Loaded',
          description: "The existing customer's information has been filled into the form.",
        });
    };

    const availableTasks = React.useMemo(() => {
        let tasks: string[] = [];
        switch (workType) {
            case 'New Business Request':
                tasks = newBusinessRequestTasks;
                break;
            case 'Web & App Development':
                tasks = webAndAppTasks;
                break;
            case 'Digital Marketing':
                tasks = digitalMarketingTasks;
                break;
            case 'Tax & Compliance':
                tasks = taxAndComplianceTasks;
                break;
            case 'BPO & KPO Services':
                tasks = bpoAndKpoTasks;
                break;
            case 'Feedback & Complaint':
                tasks = feedbackAndComplaintTasks;
                break;
            case 'Other Service Request':
                tasks = otherServiceRequestTasks;
                break;
            default:
                tasks = [];
        }
        return tasks.filter(task => !selectedTasks.includes(task));
    }, [workType, selectedTasks]);

    React.useEffect(() => {
        if (workType) {
          // Reset tasks when workType changes
          setSelectedTasks([]);
        }
    }, [workType]);

    React.useEffect(() => {
        form.setValue('tasks', selectedTasks);
    }, [selectedTasks, form]);

    const handleSelectTask = (task: string) => {
        setSelectedTasks(prev => [...prev, task]);
    };

    const handleDeselectTask = (task: string) => {
        setSelectedTasks(prev => prev.filter(t => t !== task));
    };

    const steps = [
        { id: 1, name: 'Customer Type' },
        { id: 2, name: 'Lead Type' },
        { id: 3, name: 'Assignment' },
        { id: 4, name: 'Details' },
    ];

    const handleNext = async () => {
        let isValid = true;
        if (currentStep === 1) {
            if (!customerType) {
                toast({ variant: 'destructive', title: 'Error', description: 'Please select a customer type.' });
                return;
            }
             if (customerType === 'existing') {
                setCurrentStep(2); // Go to search
                return;
            }
        }
        else if (currentStep === 2) {
            if (customerType === 'new') {
                isValid = await form.trigger(['leadType']);
                if (!form.getValues('leadType')) {
                    form.setError('leadType', { type: 'manual', message: 'Lead type is required.' });
                    isValid = false;
                }
            } else { // existing customer, no validation needed here
                setCurrentStep(s => s + 1);
                return;
            }
        } else if (currentStep === 3) {
             if (form.getValues('assignment') === undefined) {
                form.setError('assignment', { type: 'manual', message: 'Please select an assignment option.' });
                isValid = false;
            } else {
                 form.clearErrors('assignment');
            }
        }
        
        if (isValid) {
            setCurrentStep(s => s + 1);
        }
    };

    const handleBack = () => {
        if (customerType === 'existing' && currentStep === 2) {
             setCustomerType(null);
             setCurrentStep(1);
        } else if (customerType === 'existing' && currentStep === 3) {
            setExistingCustomerId(null);
            setFoundCustomer(null);
            setCurrentStep(2);
        }
        else {
            setCurrentStep(s => s - 1);
        }
    };

    const handleSearch = async () => {
        if (!searchTerm.trim()) {
            return;
        }
        if (!firestore) return;

        setIsSearching(true);
        setFoundCustomer(null);
        const customersRef = collection(firestore, "customers");
        
        try {
            const trimmedSearchTerm = searchTerm.trim();
            const queries = [
                query(customersRef, where("id", "==", trimmedSearchTerm)),
                query(customersRef, where("email", "==", trimmedSearchTerm)),
                query(customersRef, where("phone", "==", `+91${trimmedSearchTerm}`)),
                query(customersRef, where("phone", "==", trimmedSearchTerm)),
            ];

            const querySnapshots = await Promise.all(queries.map(q => getDocs(q)));
            
            const allDocs = querySnapshots.flatMap(snap => snap.docs);

            if (allDocs.length > 0) {
                const uniqueDocs = Array.from(new Map(allDocs.map(doc => [doc.id, doc])).values());
                const customerData = uniqueDocs[0].data() as Customer;
                setFoundCustomer(customerData);
                setShowCustomerFoundDialog(true);
            } else {
                setShowCustomerNotFoundDialog(true);
            }
        } catch (error) {
            console.error("Customer search failed:", error);
            toast({ variant: 'destructive', title: 'Search Failed', description: 'An error occurred while searching.' });
        } finally {
            setIsSearching(false);
        }
    };
    
    const handleContinueWithCustomer = () => {
        if (!foundCustomer) return;
        form.setValue('customerName', foundCustomer.name);
        form.setValue('customerEmail', foundCustomer.email || '');
        const phone = foundCustomer.phone.startsWith('+91') ? foundCustomer.phone.substring(3) : foundCustomer.phone;
        form.setValue('customerPhone', phone);
        const secondaryPhone = foundCustomer.secondaryPhone ? (foundCustomer.secondaryPhone.startsWith('+91') ? foundCustomer.secondaryPhone.substring(3) : foundCustomer.secondaryPhone) : '';
        form.setValue('secondaryPhone', secondaryPhone);
        form.setValue('city', foundCustomer.city || '');
        
        setExistingCustomerId(foundCustomer.id);
        setCurrentStep(s => s + 1); // Move to next step (Assignment)
        setShowCustomerFoundDialog(false);
    };

    const handleContinueAsNewCustomer = () => {
        setCustomerType('new');
        setCurrentStep(2); // Go to lead type for new customer
        setShowCustomerNotFoundDialog(false);
        toast({ title: 'Proceeding as New Customer', description: 'Please fill in the lead and customer details.' });
    };

    
    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!user || !firestore) {
          toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to create a work item.' });
          return;
        }
        
        setIsSubmitting(true);
        
        const fullPhoneNumber = `+91${values.customerPhone}`;
    
        try {
            let customerId: string;
            let isNewCustomer = false;

            if (existingCustomerId) {
                customerId = existingCustomerId;
                isNewCustomer = false;
            } else {
                const customersRef = collection(firestore, "customers");
                const q = query(customersRef, where("phone", "==", fullPhoneNumber));
                const customerQuerySnapshot = await getDocs(q);

                if (customerQuerySnapshot.empty) {
                    isNewCustomer = true;
                    customerId = generateCustomerUID();
                } else {
                    customerId = customerQuerySnapshot.docs[0].id;
                }
            }
    
          const newWorkItemId = await runTransaction(firestore, async (transaction) => {
            const prefix = getWorkTypePrefix(values.workType);
            const counterId = `work_items_${prefix}`; 
            const counterRef = doc(firestore, 'counters', counterId);
            const counterDoc = await transaction.get(counterRef);
    
            const newCount = counterDoc.exists() ? counterDoc.data().value + 1 : 1;
            
            const numericId = String(newCount).padStart(7, '0');
            const customId = `${prefix}-${numericId}`;
    
            const workItemsCollectionRef = collection(firestore, 'work_items');
            const newWorkItemRef = doc(workItemsCollectionRef, customId);
    
            const newWorkItemData = {
              ...values,
              id: customId,
              subject: values.workType, 
              customerId: customerId,
              customerPhone: fullPhoneNumber,
              secondaryPhone: values.secondaryPhone ? `+91${values.secondaryPhone}`: '',
              status: 'Open',
              priority: 'Medium',
              createdDate: new Date().toISOString(),
              inboundMethod: 'Manual',
              assignedUserId: values.assignment === 'self' ? user.uid : '',
              createdBy: user.uid,
              lastUpdatedDate: new Date().toISOString(),
              hasBusiness: values.hasBusiness === 'yes',
              slaDueDate: new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
              overview: [values.description],
              latestUpdate: {
                  title: 'WORK ITEM CREATED',
                  description: `New work item created by ${user.displayName || user.email}.`,
                  date: format(new Date(), "'on' MMM d, yyyy"),
              },
              tasks: values.tasks,
              leadType: values.leadType || '',
            };
            
            const newWorkItem = { ...newWorkItemData };
            delete (newWorkItem as any).assignment;


            transaction.set(newWorkItemRef, newWorkItem);

            const notesCollectionRef = collection(firestore, `work_items/${customId}/notes`);
            const newNoteRef = doc(notesCollectionRef);
            const creationNote = {
                id: newNoteRef.id,
                workItemId: customId,
                authorId: user.uid,
                date: new Date().toISOString(),
                text: values.description,
                category: 'Creation',
                subject: 'Work Item Created'
            };
            transaction.set(newNoteRef, creationNote);
    
            if (isNewCustomer) {
                const newCustomerRef = doc(firestore, "customers", customerId);
                const newCustomerData = {
                    id: customerId,
                    name: values.customerName,
                    email: values.customerEmail || "",
                    phone: fullPhoneNumber,
                    secondaryPhone: values.secondaryPhone ? `+91${values.secondaryPhone}`: '',
                    city: values.city || "",
                    createdDate: new Date().toISOString(),
                };
                transaction.set(newCustomerRef, newCustomerData);
            }
    
            transaction.set(counterRef, { value: newCount });
    
            return customId;
          });
    
          // Copy global notes if it's an existing customer
          if (!isNewCustomer) {
            const globalNotesQuery = query(collection(firestore, "global_notes"), where("customerId", "==", customerId));
            const globalNotesSnapshot = await getDocs(globalNotesQuery);

            if (!globalNotesSnapshot.empty) {
                const noteBatch = writeBatch(firestore);
                globalNotesSnapshot.forEach(globalNoteDoc => {
                    const globalNoteData = globalNoteDoc.data() as GlobalNote;
                    const newNoteRef = doc(collection(firestore, `work_items/${newWorkItemId}/notes`));
                    noteBatch.set(newNoteRef, {
                        id: newNoteRef.id,
                        workItemId: newWorkItemId,
                        authorId: globalNoteData.authorId,
                        date: globalNoteData.date,
                        text: globalNoteData.text,
                        category: globalNoteData.workItemId || globalNoteData.customerId,
                        subject: globalNoteData.subject || "Imported Global Note",
                        isGlobal: true,
                    });
                });
                await noteBatch.commit();
            }
          }


          toast({ title: 'Success!', description: `New work item ${newWorkItemId} has been created.` });
          
          form.reset();
          
          const openTabsString = localStorage.getItem('openWorkItemTabs');
          let openTabs: WorkItemTab[] = openTabsString ? JSON.parse(openTabsString) : [];
    
          const filteredTabs = openTabs.filter(tab => tab.href !== '/dashboard/new-work');
          const newTab: WorkItemTab = { href: `/dashboard/work-item?id=${newWorkItemId}`, label: newWorkItemId };
          if (!filteredTabs.find(tab => tab.href === newTab.href)) {
              filteredTabs.push(newTab);
          }
    
          localStorage.setItem('openWorkItemTabs', JSON.stringify(filteredTabs));
          window.dispatchEvent(new CustomEvent('tabs-update'));
          
          navigate(newTab.href);
    
        } catch (error: any) {
            console.error('Work item creation failed:', error);
            toast({ variant: 'destructive', title: 'Creation Failed', description: error.message || 'Could not create work item. A server error occurred.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleCancel = () => {
        const openTabsString = localStorage.getItem('openWorkItemTabs');
        let openTabs: WorkItemTab[] = openTabsString ? JSON.parse(openTabsString) : [];
        const newTabs = openTabs.filter(tab => tab.href !== '/dashboard/new-work');
        localStorage.setItem('openWorkItemTabs', JSON.stringify(newTabs));
        window.dispatchEvent(new CustomEvent('tabs-update'));
        navigate(newTabs.length > 0 ? newTabs[newTabs.length - 1].href : '/dashboard');
    };
    
    return (
        <>
        <div className="flex gap-12">
            <Stepper currentStep={currentStep} steps={steps} />
            <div className="flex-1">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-1">

                        {currentStep === 1 && (
                            <div className="border rounded-md p-4 space-y-4">
                                <h2 className="text-lg font-bold">Customer Type</h2>
                                <p className="text-sm text-muted-foreground">Is this for a new or an existing customer?</p>
                                <div className="flex gap-4">
                                    <Button type="button" className="flex-1 h-8 border border-black" variant={customerType === 'new' ? 'default' : 'outline'} onClick={() => setCustomerType('new')}>New Customer</Button>
                                    <Button type="button" className="flex-1 h-8 border border-black" variant={customerType === 'existing' ? 'default' : 'outline'} onClick={() => setCustomerType('existing')}>Existing Customer</Button>
                                </div>
                            </div>
                        )}
                        
                        {currentStep === 2 && (
                             <>
                                {customerType === 'new' ? (
                                    <div className="border rounded-md p-4 space-y-4">
                                        <h2 className="text-lg font-bold">Lead Type</h2>
                                        <p className="text-sm text-muted-foreground">How did you acquire this lead?</p>
                                        <div className="w-full">
                                            <FormField
                                                control={form.control}
                                                name="leadType"
                                                render={({ field }) => (
                                                    <FormItem>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl><SelectTrigger className="border-black h-8 w-full"><SelectValue placeholder="Select a lead type" /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="Self Sources">Self Sources</SelectItem>
                                                            <SelectItem value="Referred Sources">Referred Sources</SelectItem>
                                                            <SelectItem value="Digital Sources">Digital Sources</SelectItem>
                                                            <SelectItem value="Offline Sources">Offline Sources</SelectItem>
                                                            <SelectItem value="Partner / Third-Party">Partner / Third-Party</SelectItem>
                                                            <SelectItem value="A Sources">A Sources</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                ) : customerType === 'existing' ? (
                                    <div className="border rounded-md p-4 space-y-4">
                                        <h2 className="text-lg font-bold">Search Existing Customer</h2>
                                        <p className="text-sm text-muted-foreground">Search by Customer ID, Email, or Phone Number.</p>
                                        <div className="flex gap-2 w-full">
                                            <Input 
                                                placeholder="Enter search term..." 
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="border-black h-8"
                                            />
                                            <Button type="button" onClick={handleSearch} disabled={isSearching} className="h-8">
                                                {isSearching ? 'Searching...' : 'Search'}
                                            </Button>
                                        </div>
                                    </div>
                                ) : null }
                             </>
                        )}

                        {currentStep === 3 && (
                            <div className="border rounded-md p-4 space-y-4">
                                <h2 className="text-lg font-bold">Assignment</h2>
                                <p className="text-sm text-muted-foreground">Who should this work item be assigned to?</p>
                                <FormField
                                    control={form.control}
                                    name="assignment"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <div className="flex gap-4">
                                                    <Button
                                                        type="button"
                                                        className="flex-1 h-8 border border-black"
                                                        variant={field.value === 'self' ? 'default' : 'outline'}
                                                        onClick={() => field.onChange('self')}
                                                    >
                                                        <UserIcon className="mr-2 h-4 w-4" />
                                                        Assign to Myself
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        className="flex-1 h-8 border border-black"
                                                        variant={field.value === 'queue' ? 'default' : 'outline'}
                                                        onClick={() => field.onChange('queue')}
                                                    >
                                                        <Users className="mr-2 h-4 w-4" />
                                                        Initial Indexing Queue
                                                    </Button>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        {currentStep === 4 && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                                     <div className="lg:col-span-2 space-y-1">
                                        <div className="w-full border rounded-md p-1 border-gray-300/50">
                                            <Label className="flex w-full items-center justify-center gap-1 font-times-new-roman text-xl text-red-600 font-bold p-1">
                                                <Briefcase className="h-3 w-3" /> <span>Process *</span>
                                            </Label>
                                            <FormField
                                                control={form.control}
                                                name="workType"
                                                render={({ field }) => (
                                                    <FormItem className="px-1 pb-1 mt-2 space-y-2">
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl><SelectTrigger className="border-primary h-6 w-full bg-background text-foreground"><SelectValue placeholder="Select a process" /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="New Business Request">New Business Request</SelectItem>
                                                            <SelectItem value="Web & App Development">Web & App Development</SelectItem>
                                                            <SelectItem value="Digital Marketing">Digital Marketing</SelectItem>
                                                            <SelectItem value="Tax & Compliance">Tax & Compliance</SelectItem>
                                                            <SelectItem value="BPO & KPO Services">BPO & KPO Services</SelectItem>
                                                            <SelectItem value="Feedback & Complaint">Feedback & Complaint</SelectItem>
                                                            <SelectItem value="Other Service Request">Other Service Request</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            {workType && (
                                                <div className="bg-accent p-2 rounded-md">
                                                    <div className="grid grid-cols-2 text-center">
                                                        <h3 className="font-semibold mb-1 font-times-new-roman" style={{ fontSize: '0.8rem' }}>Available Tasks</h3>
                                                        <h3 className="font-semibold mb-1 font-times-new-roman" style={{ fontSize: '0.8rem' }}>Selected Tasks</h3>
                                                    </div>
                                                    <Separator className="my-1 bg-border/20 w-full h-[0.5px]" />
                                                    <div className="grid grid-cols-2 relative">
                                                        <div className="pr-1">
                                                            <ScrollArea className="h-[250px] w-full rounded-md bg-background">
                                                                <div className="p-1 space-y-0.5">
                                                                    {availableTasks.map(task => (
                                                                        <div key={task} onClick={() => handleSelectTask(task)} className="cursor-pointer px-1 py-0.5 hover:bg-primary/10 rounded-sm font-times-new-roman text-sm">
                                                                            {task}
                                                                        </div>
                                                                    ))}
                                                                    {availableTasks.length === 0 && <p className="text-muted-foreground text-center" style={{fontSize: '0.75rem'}}>All tasks are selected.</p>}
                                                                </div>
                                                            </ScrollArea>
                                                        </div>
                                                        <div className="w-px bg-border/10 absolute top-0 bottom-0 left-1/2 transform -translate-x-1/2 h-full"></div>
                                                        <div className="pl-1">
                                                            <ScrollArea className="h-[250px] w-full rounded-md bg-background">
                                                                <div className="p-1 space-y-0.5">
                                                                    {selectedTasks.length > 0 ? selectedTasks.map(task => (
                                                                        <div key={task} onClick={() => handleDeselectTask(task)} className="cursor-pointer px-1 py-0.5 hover:bg-primary/10 rounded-sm font-times-new-roman font-bold text-sm">
                                                                            {task}
                                                                        </div>
                                                                    )) : <p className="text-muted-foreground p-2 text-center" style={{fontSize: '0.75rem'}}>Select tasks from the left.</p>}
                                                                </div>
                                                            </ScrollArea>
                                                        </div>
                                                    </div>
                                                     <Separator className="my-1 bg-border/20 w-full h-[0.5px]"/>
                                                </div>
                                            )}
                                            {form.formState.errors.tasks && (
                                                <p className="text-sm font-medium text-destructive px-2 pb-1">
                                                    {form.formState.errors.tasks.message}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="border rounded-md pt-2.5 border-gray-300/50">
                                        <Label className="flex w-full items-center justify-center gap-1 font-times-new-roman text-xl text-red-600 font-bold p-1 pt-4">
                                            <UserIcon className="h-3 w-3 text-blue-400"/> Customer Details
                                        </Label>
                                        <div className="space-y-2 p-2">
                                            <FormField
                                                control={form.control}
                                                name="customerName"
                                                render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="flex items-center gap-1 font-times-new-roman text-10px text-black"><UserIcon className="h-3 w-3"/> Customer Name *</FormLabel>
                                                    <FormControl><Input {...field} className="border-primary h-6"  /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="customerEmail"
                                                render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="flex items-center gap-1 font-times-new-roman text-10px text-black"><Mail className="h-3 w-3"/> Customer Email</FormLabel>
                                                    <FormControl><Input type="email" {...field} onBlur={(e) => handleCustomerFieldBlur('email', e.target.value)} className="border-primary h-6"  /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                                )}
                                            />
                                            <div className="grid grid-cols-2 gap-x-2">
                                                <FormField
                                                    control={form.control}
                                                    name="customerPhone"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                        <FormLabel className="flex items-center gap-1 font-times-new-roman text-10px text-black"><Phone className="h-3 w-3"/> Customer Phone *</FormLabel>
                                                        <div className="relative">
                                                            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm">+91</span>
                                                            <FormControl><Input className="pl-10 border-primary h-6" {...field} onBlur={(e) => handleCustomerFieldBlur('phone', e.target.value)} onChange={(e) => { const numericValue = e.target.value.replace(/[^0-9]/g, ''); field.onChange(numericValue); }}  /></FormControl>
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
                                                        <FormLabel className="flex items-center gap-1 font-times-new-roman text-10px text-black"><Phone className="h-3 w-3"/> Secondary Phone</FormLabel>
                                                        <div className="relative">
                                                            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm">+91</span>
                                                            <FormControl><Input className="pl-10 border-primary h-6" {...field} onChange={(e) => { const numericValue = e.target.value.replace(/[^0-9]/g, ''); field.onChange(numericValue); }}  /></FormControl>
                                                        </div>
                                                        <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <FormField
                                                control={form.control}
                                                name="city"
                                                render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="flex items-center gap-1 font-times-new-roman text-10px text-black"><MapPin className="h-3 w-3"/> City *</FormLabel>
                                                    <FormControl><Input {...field} className="border-primary h-6"  /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                                )}
                                            />
                                            
                                            <FormField
                                                control={form.control}
                                                name="hasBusiness"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <div className="flex items-center gap-4 pt-1">
                                                            <FormLabel className="flex items-center gap-1 font-times-new-roman text-10px text-black"><Building className="h-3 w-3"/> Customer Has Business?</FormLabel>
                                                            <FormControl>
                                                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex items-center gap-4">
                                                                    <div className="flex items-center space-x-2">
                                                                        <RadioGroupItem value="yes" id="has-business-yes" />
                                                                        <Label htmlFor="has-business-yes" className="font-calibri-light text-10px">Yes</Label>
                                                                    </div>
                                                                    <div className="flex items-center space-x-2">
                                                                        <RadioGroupItem value="no" id="has-business-no" />
                                                                        <Label htmlFor="has-business-no" className="font-calibri-light text-10px">No</Label>
                                                                    </div>
                                                                </RadioGroup>
                                                            </FormControl>
                                                        </div>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            {hasBusiness === 'yes' && (
                                                <FormField
                                                    control={form.control}
                                                    name="businessName"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                        <FormLabel className="flex items-center gap-1 font-times-new-roman text-10px text-black"><Building className="h-3 w-3"/> Business / Company Name</FormLabel>
                                                        <FormControl><Input {...field} className="border-primary h-6" /></FormControl>
                                                        <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            )}

                                            <FormField
                                                control={form.control}
                                                name="description"
                                                render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="flex items-center gap-1 font-times-new-roman text-10px text-black pt-1"><Info className="h-3 w-3"/> Overview *</FormLabel>
                                                    <FormControl><Textarea placeholder="Provide a detailed description of the work item..." {...field} className="border-primary h-12"/></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <Separator className="my-2 border-gray-300/50" />
                            </div>
                        )}
                        
                        
                        <div className="flex justify-end gap-2 pt-4">
                           {currentStep > 1 && (
                               <Button type="button" variant="outline" onClick={handleBack}>Back</Button>
                           )}

                           {(currentStep < steps.length && customerType && !(currentStep === 2 && customerType === 'existing')) && (
                               <Button type="button" onClick={handleNext}>Next</Button>
                           )}
                           
                            {customerType === 'existing' && currentStep === 2 && !foundCustomer && (
                                <Button type="button" onClick={handleSearch} disabled={isSearching}>Search</Button>
                           )}
                           
                            {currentStep === steps.length && (
                                <>
                                    <Button type="button" variant="ghost" onClick={handleCancel}>Cancel</Button>
                                    <Button type="submit" disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">{isSubmitting ? 'Creating...' : 'Create'}</Button>
                                </>
                            )}
                        </div>

                    </form>
                </Form>
            </div>
        </div>

        {/* Customer Found Dialog */}
        <AlertDialog open={showCustomerFoundDialog} onOpenChange={setShowCustomerFoundDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Customer Found</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                         <div className="space-y-2 text-left pt-2 text-sm text-foreground">
                            <div><span className="font-semibold w-20 inline-block">ID:</span> {foundCustomer?.id}</div>
                            <div><span className="font-semibold w-20 inline-block">Name:</span> {foundCustomer?.name}</div>
                            <div><span className="font-semibold w-20 inline-block">Email:</span> {foundCustomer?.email || 'N/A'}</div>
                            <div><span className="font-semibold w-20 inline-block">Phone:</span> {foundCustomer?.phone}</div>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Search Again</AlertDialogCancel>
                    <AlertDialogAction onClick={handleContinueWithCustomer}>
                        Continue with this Customer
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Customer Not Found Dialog */}
        <AlertDialog open={showCustomerNotFoundDialog} onOpenChange={setShowCustomerNotFoundDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Customer Not Found</AlertDialogTitle>
                    <AlertDialogDescription>
                        No customer was found with the provided details. You can search again or continue creating a new customer.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Search Again</AlertDialogCancel>
                    <AlertDialogAction onClick={handleContinueAsNewCustomer}>
                        Continue as New Customer
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Duplicate Customer Dialog */}
        <AlertDialog open={showDuplicateCustomerDialog} onOpenChange={setShowDuplicateCustomerDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Existing Customer Found</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                         <div>
                            <p>A customer with these details already exists.</p>
                            <div className="space-y-2 text-left pt-2 text-sm text-foreground border-t mt-2 pt-2">
                                <div><span className="font-semibold w-20 inline-block">ID:</span> {duplicateCustomer?.id}</div>
                                <div><span className="font-semibold w-20 inline-block">Name:</span> {duplicateCustomer?.name}</div>
                                <div><span className="font-semibold w-20 inline-block">Email:</span> {duplicateCustomer?.email || 'N/A'}</div>
                                <div><span className="font-semibold w-20 inline-block">Phone:</span> {duplicateCustomer?.phone}</div>
                            </div>
                            <p className="pt-2">Would you like to use this customer's data?</p>
                         </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Continue with New</AlertDialogCancel>
                    <AlertDialogAction onClick={handleUseExistingCustomer}>
                        Use This Customer
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </>
    );
};

export default NewWorkItemForm;

    










