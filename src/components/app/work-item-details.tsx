'use client';

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import ClientFormattedDate from "./client-formatted-date";
import type { WorkItem, Note, Document, User, WorkItemTab, Task, GlobalNote, Transaction } from "@/lib/types";
import { Briefcase, ChevronDown, FilePenLine, MoreVertical, Paperclip, RefreshCw, X, User as UserIcon, CalendarDays, History, MessageSquareText, Lock, Unlock, Trash2, Mail, Phone, Home, Fingerprint, Building, Info, Flag, Link as LinkIcon, Clock, Pencil, Landmark, IndianRupee } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Separator } from '@/components/ui/separator';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import WorkItemActions from './work-item-actions';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError, useDoc, useMemoFirebase, type EnhancedUser } from '@/firebase';
import { doc, updateDoc, deleteDoc, writeBatch, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import ImageUploadDialog from './image-upload-dialog';
import AddTaskDialog from './add-task-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import CreateQuotation from './create-quotation';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import EmailComposer from './email-composer';
import EditCustomerDetailsDialog from './edit-customer-details-dialog';
import AgencyDetails from './agency-details';

type WorkItemDetailsProps = {
    workItem: WorkItem;
    notes: Note[];
    documents: Document[];
    users: User[];
    tasks: Task[];
    transactions: Transaction[];
};

type QuotationItem = {
  id: number;
  item: string;
  description: string;
  qty: number;
  unitPrice: number;
};

const QuotationTemplate = ({ workItem, items, quoteNumber, totals, validUntil, quoteDate, logoUrl }: { workItem: Partial<WorkItem>; items: QuotationItem[]; quoteNumber: string; totals: { subtotal: number; total: number }; validUntil: string; quoteDate: string; logoUrl?: string; }) => {
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    };

    return (
        <div className="bg-white p-8 font-sans relative" style={{ width: '210mm', minHeight: '297mm', color: '#333' }}>
            
            <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
                <span>{new Date().toLocaleString('en-GB', { hour12: true })}</span>
                <span>Business Quotation</span>
            </div>

            <div className="h-px bg-gray-200 mb-6"></div>

            <div className="flex justify-between items-start mb-10">
                <div className="flex items-start gap-4">
                    {logoUrl ? (
                         <img src={logoUrl} alt="App Logo" className="h-20 w-auto" />
                    ) : (
                     <svg viewBox="0 0 100 100" className="h-12 w-auto">
                        <path d="M 50,50 L 50,5 A 45,45 0 0 1 88.97,27.5 Z" fill="#c04343"/>
                        <path d="M 50,50 L 88.97,27.5 A 45,45 0 0 1 88.97,72.5 Z" fill="#a52a2a"/>
                        <path d="M 50,50 L 88.97,72.5 A 45,45 0 0 1 50,95 Z" fill="#6f0000"/>
                        <path d="M 50,50 L 50,95 A 45,45 0 0 1 11.03,72.5 Z" fill="#d46a6a"/>
                        <path d="M 50,50 L 11.03,72.5 A 45,45 0 0 1 11.03,27.5 Z" fill="#8a1111"/>
                        <path d="M 50,50 L 11.03,27.5 A 45,45 0 0 1 50,5 Z" fill="#540000"/>
                    </svg>
                    )}
                    <div>
                        <p className="text-xl font-bold">PHBKT Group Limited</p>
                        <p className="text-xs mt-2">North Main Road, Koregaon Park, Pune, Maharashtra 414501.</p>
                        <p className="text-xs mt-1">Email: contact@phbkt.com | Phone: +91 7972688626</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-4xl font-bold text-gray-800 tracking-wider">QUOTATION</h2>
                    <p className="text-xs mt-2"><span className="font-bold">Date:</span> {quoteDate}</p>
                    <p className="text-xs"><span className="font-bold">Quote #:</span> {quoteNumber}</p>
                    <p className="text-xs"><span className="font-bold">Valid Until:</span> {validUntil}</p>
                </div>
            </div>

            <div className="mb-8">
                <p className="text-xs text-gray-500 mb-1">Quotation For:</p>
                <p className="text-lg font-bold">{workItem.customerName}</p>
                {workItem.businessName && <p className="text-sm">{workItem.businessName}</p>}
                <p className="text-sm">{[workItem.address, workItem.city, workItem.state, workItem.pinCode].filter(Boolean).join(', ')}</p>
            </div>

            <table className="w-full text-sm mb-8">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="p-2 text-left font-bold text-xs w-[5%]">#</th>
                        <th className="p-2 text-left font-bold text-xs w-[25%]">Item</th>
                        <th className="p-2 text-left font-bold text-xs w-[35%]">Description</th>
                        <th className="p-2 text-right font-bold text-xs w-[10%]">Quantity</th>
                        <th className="p-2 text-right font-bold text-xs w-[15%]">Unit Price (₹)</th>
                        <th className="p-2 text-right font-bold text-xs w-[10%]">Total (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={item.id} className="border-b">
                            <td className="p-2 text-center">{index + 1}</td>
                            <td className="p-2 font-semibold">{item.item}</td>
                            <td className="p-2">{item.description}</td>
                            <td className="p-2 text-right">{item.qty}</td>
                            <td className="p-2 text-right">{formatCurrency(item.unitPrice)}</td>
                            <td className="p-2 text-right font-semibold">{formatCurrency(item.qty * item.unitPrice)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="flex justify-end mb-8">
                <div className="w-2/5 text-sm">
                    <div className="flex justify-between py-2">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(totals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-xl py-2 border-t-2 border-gray-600 mt-2">
                        <span>TOTAL:</span>
                        <span>{formatCurrency(totals.total)}</span>
                    </div>
                </div>
            </div>
            
            <div className="absolute bottom-8 left-8 right-8">
                 <div className="mb-12">
                    <h3 className="font-bold text-sm mb-2">Terms & Conditions</h3>
                    <p className="text-xs text-gray-600">50% advance payment is required to start the project.</p>
                    <p className="text-xs text-gray-600">The remaining 50% is due upon project completion, before final delivery.</p>
                    <p className="text-xs text-gray-600">This quotation is valid for 15 days from the date of issue.</p>
                    <p className="text-xs text-gray-600">Any changes or additions to the scope of work may incur additional charges.</p>
                </div>
                <div className="flex justify-between items-start pt-12">
                    <div className="text-center w-2/5">
                        <div className="border-t border-gray-500 pt-2">
                            <p className="text-sm font-semibold">Authorized Signature</p>
                            <p className="text-sm mt-1">PHBKT Group Limited</p>
                        </div>
                    </div>
                    <div className="text-center w-2/5">
                        <div className="border-t border-gray-500 pt-2">
                            <p className="text-sm font-semibold">Client Signature</p>
                            <p className="text-sm mt-1">{workItem.customerName}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const EmailTemplate = ({ emailData, workItem, logoUrl, sentByUser }: { emailData: any; workItem: Partial<WorkItem>; logoUrl?: string; sentByUser?: User | null }) => {
    return (
        <div className="bg-white p-8 font-sans" style={{ width: '210mm', minHeight: '297mm', color: '#333' }}>
            {/* Header */}
            <div className="flex justify-between items-start mb-10">
                <div className="flex items-center gap-4">
                    {logoUrl ? (
                         <img src={logoUrl} alt="App Logo" className="h-16 w-auto self-start" />
                    ) : (
                     <svg viewBox="0 0 100 100" className="h-12 w-auto">
                        <path d="M 50,50 L 50,5 A 45,45 0 0 1 88.97,27.5 Z" fill="#c04343"/>
                        <path d="M 50,50 L 88.97,27.5 A 45,45 0 0 1 88.97,72.5 Z" fill="#a52a2a"/>
                        <path d="M 50,50 L 88.97,72.5 A 45,45 0 0 1 50,95 Z" fill="#6f0000"/>
                        <path d="M 50,50 L 50,95 A 45,45 0 0 1 11.03,72.5 Z" fill="#d46a6a"/>
                        <path d="M 50,50 L 11.03,72.5 A 45,45 0 0 1 11.03,27.5 Z" fill="#8a1111"/>
                        <path d="M 50,50 L 11.03,27.5 A 45,45 0 0 1 50,5 Z" fill="#540000"/>
                    </svg>
                    )}
                    <div>
                        <p className="text-xl font-bold">PHBKT Group Limited</p>
                        <p className="text-xs mt-2">North Main Road, Koregaon Park, Pune, Maharashtra 414501.</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-bold text-gray-700">EMAIL RECORD</h2>
                </div>
            </div>

            {/* Email Info */}
            <div className="mb-8 border-b pb-4 text-xs">
                <p><span className="font-semibold">Date:</span> {new Date(emailData.sentAt).toLocaleString()}</p>
                <p><span className="font-semibold">From:</span> {sentByUser ? `${sentByUser.firstName} ${sentByUser.lastName} <${sentByUser.email}>` : 'System'}</p>
                <p><span className="font-semibold">To:</span> {emailData.to}</p>
                <p><span className="font-semibold">Subject:</span> {emailData.subject}</p>
                <p><span className="font-semibold">Regarding Case:</span> {workItem.id}</p>
            </div>
            
            {/* Email Body */}
            <div className="text-sm whitespace-pre-wrap">
                {emailData.body}
            </div>

            <div className="absolute bottom-8 left-8 right-8 text-center text-xs text-gray-400 border-t pt-2">
                This is a system-generated record of an email sent from the WorkFlow Management Application.
            </div>
        </div>
    );
};


export default function WorkItemDetails({ workItem, notes, documents, users, tasks, transactions }: WorkItemDetailsProps) {
    const navigate = useNavigate();
    const location = useLocation(); const pathname = location.pathname;
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isProcessesOpen, setIsProcessesOpen] = useState(true);
    const [isImagesOpen, setIsImagesOpen] = useState(true);
    const [isAssociationsOpen, setIsAssociationsOpen] = useState(true);
    const [isTasksOpen, setIsTasksOpen] = useState(true);
    const [isQuotationOpen, setIsQuotationOpen] = useState(true);
    const [isPaymentOpen, setIsPaymentOpen] = useState(true);
    const [caseAge, setCaseAge] = useState('');
    const [isActionsPanelOpen, setIsActionsPanelOpen] = useState(false);
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
    const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false);
    const [isEditCustomerDialogOpen, setIsEditCustomerDialogOpen] = useState(false);
    const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
    const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
    const [isGeneratingQuote, setIsGeneratingQuote] = useState(false);
    const [quoteToPrint, setQuoteToPrint] = useState<any>(null);
    const [emailToPrint, setEmailToPrint] = useState<any>(null);
    const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);

    const activeTasks = tasks.filter(task => task.status !== 'Completed');
    const closedTasks = tasks.filter(task => task.status === 'Completed');

    const configRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'app_config/main');
    }, [firestore]);
    const { data: config } = useDoc<{logoUrl: string}>(configRef);
    const logoUrl = config?.logoUrl;

    const creationNote = notes.find(note => note.category === 'Creation');
    const creationNoteAuthor = users.find(u => u.id === creationNote?.authorId);

    useEffect(() => {
        if (workItem.lockedBy && user && workItem.lockedBy === user.uid) {
            setIsActionsPanelOpen(true);
        } else {
            setIsActionsPanelOpen(false);
        }
    }, [workItem.lockedBy, user]);

    useEffect(() => {
        if (workItem.createdDate) {
            const date = new Date(workItem.createdDate);
            if (!isNaN(date.getTime())) {
                setCaseAge(formatDistanceToNowStrict(date));
            } else {
                setCaseAge('Invalid date');
            }
        }
    }, [workItem.createdDate]);

    const getUserFullName = (userId: string) => {
        const user = users.find(u => u.id === userId);
        if (!user) return 'N/A';
        return user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : (user.name || user.email);
    };
    
    const itemNotes = notes.filter(n => !n.isGlobal).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const globalItemNotes = notes.filter(n => n.isGlobal).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());


    const getStatusFlagColor = (status: WorkItem['status']): string => {
        switch (status) {
            case 'Open':
                return 'text-blue-500';
            case 'Completed':
                return 'text-green-500';
            case 'Terminated':
                return 'text-destructive';
            case 'Pend':
                return 'text-yellow-500';
            case 'Reindex':
                return 'text-orange-500';
            case 'Transfer':
                return 'text-purple-500';
            default:
                return 'text-muted-foreground';
        }
    };

    const tabTriggerClassName = "py-1 px-3 h-auto rounded-none border-r border-white/20 text-primary-foreground focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=inactive]:bg-primary data-[state=inactive]:hover:bg-primary/90 data-[state=active]:bg-black data-[state=active]:hover:bg-black/90 shrink-0";
    
    const handleVerifyClick = () => {
        if (!user) return;
        handleLock();
    };

    const handleLock = async () => {
        if (!user || !firestore) return;
        const workItemRef = doc(firestore, `work_items/${workItem.id}`);
        const updateData = {
            assignedUserId: user.uid,
            lockedBy: user.uid,
        };
        try {
            await updateDoc(workItemRef, updateData);
            toast({ title: 'Case Locked', description: 'You have locked this work item for editing.' });
        } catch (error) {
            console.error("Error locking work item:", error);
            const permissionError = new FirestorePermissionError({
                path: workItemRef.path,
                operation: 'update',
                requestResourceData: updateData,
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Lock Failed', description: 'Could not lock the work item.' });
        }
    };
    
    const handleUnlock = async () => {
        if (!user || !firestore || workItem.lockedBy !== user.uid) return;
        const workItemRef = doc(firestore, `work_items/${workItem.id}`);
        const updateData = { lockedBy: '' };
        try {
            await updateDoc(workItemRef, updateData);
            toast({ title: 'Case Unlocked' });
            setIsActionsPanelOpen(false);
        } catch (error) {
            console.error("Error unlocking work item:", error);
             const permissionError = new FirestorePermissionError({
                path: workItemRef.path,
                operation: 'update',
                requestResourceData: updateData,
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Unlock Failed', description: 'Could not unlock the work item.' });
        }
    };

    const handleCloseWorkItem = async () => {
        const openTabsString = localStorage.getItem('openWorkItemTabs');
        let openTabs: WorkItemTab[] = openTabsString ? JSON.parse(openTabsString) : [];

        const newTabs = openTabs.filter(tab => tab.href !== pathname);
        localStorage.setItem('openWorkItemTabs', JSON.stringify(newTabs));
        window.dispatchEvent(new CustomEvent('tabs-update'));

        // Since we are on the page we are closing, we must navigate away.
        if (newTabs.length > 0) {
            navigate(newTabs[newTabs.length - 1].href);
        } else {
            navigate('/dashboard');
        }
    };
    
    const assignedUser = users.find(u => u.id === workItem.assignedUserId);
    const assignedUserFullName = assignedUser ? (assignedUser.firstName && assignedUser.lastName ? `${assignedUser.firstName} ${assignedUser.lastName}` : (assignedUser.name || assignedUser.email)) : workItem.workType;

    const isLockedByOther = workItem.lockedBy && user && workItem.lockedBy !== user.uid;
    const lockingUser = isLockedByOther ? users.find(u => u.id === workItem.lockedBy) : null;
    const lockingUserName = lockingUser ? (lockingUser.firstName && lockingUser.lastName ? `${lockingUser.firstName} ${lockingUser.lastName}` : (lockingUser.name || lockingUser.email)) : 'another user';

    const handleDeleteDocumentClick = (e: React.MouseEvent, doc: Document) => {
        e.stopPropagation();
        setDocumentToDelete(doc);
    };

    const handleConfirmDeleteDocument = async () => {
        if (!documentToDelete || !firestore || !user) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not delete document. Please try again.',
            });
            return;
        }
        if(user.role !== 'admin') {
            toast({
                variant: 'destructive',
                title: 'Permission Denied',
                description: 'You do not have permission to delete documents.',
            });
            setDocumentToDelete(null);
            return;
        }

        const docRef = doc(firestore, `work_items/${workItem.id}/documents/${documentToDelete.id}`);

        try {
            await deleteDoc(docRef);
            toast({
                title: 'Document Deleted',
                description: `Document "${documentToDelete.name}" has been deleted.`,
            });
        } catch (error) {
            console.error("Error deleting document:", error);
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({
                variant: 'destructive',
                title: 'Deletion Failed',
                description: 'You may not have permission to delete this document.',
            });
        } finally {
            setDocumentToDelete(null);
        }
    };

    const handleDeleteNoteClick = (e: React.MouseEvent, note: Note) => {
        e.stopPropagation();
        setNoteToDelete(note);
    };

    const handleConfirmDeleteNote = async () => {
        if (!noteToDelete || !firestore || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not delete note.' });
            return;
        }

        const noteRef = doc(firestore, `work_items/${workItem.id}/notes/${noteToDelete.id}`);

        try {
            if (user.role === 'admin' || user.uid === noteToDelete.authorId) {
                await deleteDoc(noteRef);
                toast({ title: 'Note Deleted', description: 'The note has been successfully deleted.' });
            } else {
                toast({ variant: 'destructive', title: 'Permission Denied', description: 'You do not have permission to delete this note.' });
            }
        } catch (error) {
            console.error("Error deleting note:", error);
            const permissionError = new FirestorePermissionError({
                path: noteRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({
                variant: 'destructive',
                title: 'Deletion Failed',
                description: 'You may not have permission to delete this note.',
            });
        } finally {
            setNoteToDelete(null);
        }
    };
    
    const handleDeleteTaskClick = (e: React.MouseEvent, task: Task) => {
        e.stopPropagation();
        setTaskToDelete(task);
    };

    const handleConfirmDeleteTask = async () => {
        if (!taskToDelete || !firestore || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not delete task.' });
            return;
        }

        const taskRef = doc(firestore, `work_items/${workItem.id}/tasks/${taskToDelete.id}`);

        try {
            if (user.role === 'admin' || user.uid === taskToDelete.createdBy) {
                await deleteDoc(taskRef);
                toast({ title: 'Task Deleted', description: 'The task has been successfully deleted.' });
            } else {
                toast({ variant: 'destructive', title: 'Permission Denied', description: 'You do not have permission to delete this task.' });
            }
        } catch (error) {
            console.error("Error deleting task:", error);
            const permissionError = new FirestorePermissionError({
                path: taskRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({
                variant: 'destructive',
                title: 'Deletion Failed',
                description: 'You may not have permission to delete this task.',
            });
        } finally {
            setTaskToDelete(null);
        }
    };

    const handleRefresh = () => {
        window.location.reload();
        toast({
            title: 'Case Refreshed',
            description: 'The work item details have been updated.',
        });
    };

    const handleResumeWork = async () => {
        if (!user || !firestore) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "You must be logged in to resume work.",
            });
            return;
        }

        const workItemRef = doc(firestore, `work_items/${workItem.id}`);
        const noteRef = doc(collection(firestore, `work_items/${workItem.id}/notes`));

        const newSlaDueDate = new Date();
        newSlaDueDate.setDate(newSlaDueDate.getDate() + 3);

        const updatePayload = {
            status: 'Open',
            slaDueDate: newSlaDueDate.toISOString(),
            latestUpdate: {
                title: 'WORK RESUMED',
                description: `Work resumed by ${user.displayName || user.email}.`,
                date: format(new Date(), "'on' MMM d, yyyy"),
            }
        };

        const newNotePayload = {
            id: noteRef.id,
            workItemId: workItem.id,
            authorId: user.uid,
            date: new Date().toISOString(),
            text: `Work resumed by ${user.displayName || user.email}.`,
            category: 'Status Change',
            subject: 'Work Resumed',
        };

        try {
            const batch = writeBatch(firestore);
            batch.update(workItemRef, updatePayload);
            batch.set(noteRef, newNotePayload);
            await batch.commit();

            toast({
                title: "Work Resumed",
                description: "The work item is now open.",
            });
        } catch (error) {
            console.error("Error resuming work:", error);
            const permissionError = new FirestorePermissionError({
                path: workItemRef.path,
                operation: 'update',
                requestResourceData: updatePayload,
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({
                variant: "destructive",
                title: "Action Failed",
                description: "Could not resume the work item.",
            });
        }
    };

    const displayStatus = ['Completed', 'Terminated'].includes(workItem.status) ? workItem.status : 'Open';
    const showSubStatus = ['Reindex', 'Pend', 'Transfer'].includes(workItem.status);
    const subStatusText = workItem.status === 'Reindex' ? 'Re-indexed' : workItem.status === 'Transfer' ? 'Transferred' : workItem.status === 'Pend' ? 'Pended' : '';
    const statusColor = getStatusFlagColor(workItem.status);
    
    const isClosed = ['Completed', 'Terminated'].includes(workItem.status);

    const handleDownloadQuotation = async (doc: Document) => {
        if (doc.type !== 'QUOTE' || !doc.url) return;
        if (isGeneratingQuote) return;

        try {
            const quotationData = JSON.parse(doc.url);
            setQuoteToPrint(quotationData);
        } catch (e) {
            console.error("Failed to parse quotation data", e);
            toast({ variant: 'destructive', title: 'Download Failed', description: 'Quotation data is corrupted.' });
        }
    };
    
    useEffect(() => {
        if (!quoteToPrint) return;

        const generateAndDownload = async () => {
            setIsGeneratingQuote(true);
            const quotationElement = document.getElementById('quotation-to-print-details');
            if (!quotationElement) {
                setIsGeneratingQuote(false);
                setQuoteToPrint(null);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not find quotation template to render.' });
                return;
            }

            try {
                const canvas = await html2canvas(quotationElement, { scale: 2 });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`Quotation-${quoteToPrint.quoteNumber}.pdf`);
                toast({ title: 'Quotation Downloading', description: `Quotation ${quoteToPrint.quoteNumber} is downloading.`});
            } catch (error) {
                console.error("Error regenerating quotation PDF:", error);
                toast({ variant: 'destructive', title: 'Download Failed', description: 'Could not regenerate PDF.' });
            } finally {
                setIsGeneratingQuote(true);
                setQuoteToPrint(null); // Reset state
            }
        };

        const timer = setTimeout(generateAndDownload, 100); 

        return () => clearTimeout(timer);
    }, [quoteToPrint, toast]);

    const handleDownloadEmail = (doc: Document) => {
        if (doc.type !== 'EMAIL' || !doc.url) return;
        if (isGeneratingEmail) return;

        try {
            const emailData = JSON.parse(doc.url);
            setEmailToPrint(emailData);
        } catch (e) {
            console.error("Failed to parse email data", e);
            toast({ variant: 'destructive', title: 'Download Failed', description: 'Email data is corrupted.' });
        }
    };

    useEffect(() => {
        if (!emailToPrint) return;

        const generateAndDownload = async () => {
            setIsGeneratingEmail(true);
            const emailElement = document.getElementById('email-to-print-details');
            if (!emailElement) {
                setIsGeneratingEmail(false);
                setEmailToPrint(null);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not find email template to render.' });
                return;
            }

            try {
                const canvas = await html2canvas(emailElement, { scale: 2 });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`Email - ${emailToPrint.subject.slice(0, 20)}.pdf`);
                toast({ title: 'Email Downloading', description: `Email "${emailToPrint.subject}" is downloading.`});
            } catch (error) {
                console.error("Error regenerating email PDF:", error);
                toast({ variant: 'destructive', title: 'Download Failed', description: 'Could not regenerate PDF.' });
            } finally {
                setIsGeneratingEmail(false);
                setEmailToPrint(null); // Reset state
            }
        };

        const timer = setTimeout(generateAndDownload, 100); 

        return () => clearTimeout(timer);
    }, [emailToPrint, toast]);

    return (
        <div className="flex-grow flex flex-col bg-white">
            <div className="pt-2 pb-1">
                {/* Request Information Section */}
                <div className="px-4">
                    <div className="flex justify-between items-start">
                        <div className="flex items-start gap-3">
                            <Briefcase className="h-6 w-6 text-muted-foreground mt-1" strokeWidth={1.5} />
                            <div>
                                 <div className="flex items-center gap-4">
                                    <h2 className="text-xl font-semibold">{workItem.workType}</h2>
                                    <div className="flex items-center gap-1 text-sm border-l pl-4">
                                        <Flag className={cn("h-4 w-4", statusColor)} />
                                        <span className="text-muted-foreground">Status:</span>
                                        <span className="font-medium">{displayStatus}</span>
                                    </div>
                                    <div className="text-sm flex items-center gap-1 border-l pl-4">
                                        <span className="text-muted-foreground">Case Age:</span>
                                        <span className="font-medium">{caseAge}</span>
                                    </div>
                                    {showSubStatus && (
                                        <div className="text-sm flex items-center gap-1 border-l pl-4 text-yellow-600">
                                            <Info className="h-4 w-4" />
                                            <span className="font-medium">{subStatusText}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-xs mt-1 text-muted-foreground">
                                    <div>
                                        <span>Created: </span>
                                        <ClientFormattedDate date={workItem.createdDate} formatString="dd/MM/yyyy HH:mm" />
                                    </div>
                                    <div>
                                        <span>Inbound Method: </span>
                                        <span className="">{workItem.inboundMethod}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsEditCustomerDialogOpen(true)}>
                                <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsAddTaskDialogOpen(true)}>
                                <FilePenLine className="h-3 w-3" />
                            </Button>
                             <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRefresh}>
                                <RefreshCw className="h-3 w-3" />
                            </Button>
                             <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsUploadDialogOpen(true)}>
                                <Paperclip className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCloseWorkItem}>
                                <X className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Processes Section */}
                <div className="my-2">
                    {workItem.status === 'Pend' ? (
                        <div className="px-4">
                            <div className="flex items-center gap-2 w-full text-left">
                                <ChevronDown className="h-4 w-4" />
                                <span className="font-medium text-lg">Processes</span>
                            </div>
                            <Separator className="h-[0.5px] bg-primary mt-1 w-full" />
                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-b-md">
                                <div className="flex items-center gap-4 text-sm">
                                    <Clock className="h-5 w-5 text-orange-500" />
                                    <div className='flex items-center gap-2'>
                                        <span className="font-semibold">
                                            Case Pended until <ClientFormattedDate date={workItem.slaDueDate} formatString="yyyy-MM-dd" />:
                                        </span>
                                        <span className="ml-2 text-muted-foreground">{workItem.latestUpdate?.description}</span>
                                    </div>
                                </div>
                                <Button className="bg-red-600 hover:bg-red-700" onClick={handleResumeWork} disabled={!user}>Resume Work</Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {!isActionsPanelOpen && (
                                <>
                                    <div className="px-4 pb-1">
                                        <button
                                            className="flex items-center gap-2 w-full text-left"
                                            onClick={() => setIsProcessesOpen(!isProcessesOpen)}
                                        >
                                            <ChevronDown className={cn("h-4 w-4 transition-transform", !isProcessesOpen && "-rotate-90")} />
                                            <span className="font-medium text-lg">Processes</span>
                                        </button>
                                    </div>
                                    {isProcessesOpen && (
                                        <>
                                            <Separator className="h-[0.5px] bg-primary mb-2 w-full" />
                                            <div className="flex items-center justify-start gap-4 py-1 px-4">
                                                <div className="text-sm">
                                                    <span className="font-bold">Assigned To: </span> 
                                                    <span className="font-medium text-xs">{assignedUserFullName}</span>
                                                </div>
                                                <Button
                                                    variant="default"
                                                    className="h-auto py-1 px-3 text-xs bg-black hover:bg-black/90 text-primary-foreground rounded-sm font-normal"
                                                    onClick={handleVerifyClick}
                                                    disabled={isLockedByOther || isClosed}
                                                >
                                                    {isLockedByOther ? (
                                                        <>
                                                            <Lock className="mr-2 h-3 w-3" />
                                                            Locked by {lockingUserName}
                                                        </>
                                                    ) : isClosed ? (
                                                        <>
                                                            <Lock className="mr-2 h-3 w-3" />
                                                            Work Item Closed
                                                        </>
                                                    ) : (
                                                        'Verify Customer Authority'
                                                    )}
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                            {isActionsPanelOpen && !isClosed && (
                                <div className="px-4 my-2">
                                    <WorkItemActions workItem={workItem} notes={notes} users={users} onClose={handleUnlock} />
                                </div>
                            )}
                        </>
                    )}
                </div>


                {/* Tabs Section */}
                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="flex flex-wrap justify-start w-full h-auto bg-primary p-0 rounded-none border-y border-primary">
                        <TabsTrigger value="overview" className={tabTriggerClassName}>Work Overview</TabsTrigger>
                        <TabsTrigger value="notes" className={tabTriggerClassName}>Notes</TabsTrigger>
                        <TabsTrigger value="contact" className={tabTriggerClassName}>Contact info</TabsTrigger>
                        <TabsTrigger value="images" className={tabTriggerClassName}>Documents</TabsTrigger>
                        <TabsTrigger value="associations" className={tabTriggerClassName}>AI Email</TabsTrigger>
                        <TabsTrigger value="tasks" className={tabTriggerClassName}>Tasks</TabsTrigger>
                        <TabsTrigger value="quotation" className={cn(tabTriggerClassName)}>Quotation</TabsTrigger>
                        <TabsTrigger value="agency" className={cn(tabTriggerClassName, "border-r-0")}>Payment</TabsTrigger>
                    </TabsList>
                    
                    <div className="flex-1 mt-1">
                        <TabsContent value="overview" className="p-0 m-0">
                           <div className="p-4 bg-background space-y-4">
                                <Card>
                                    <CardHeader>
                                    <CardTitle className="text-base font-semibold">Work Details</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4 text-sm">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-4">
                                            <div className="flex items-start gap-3">
                                                <UserIcon className="h-4 w-4 text-muted-foreground mt-1" />
                                                <div>
                                                    <p className="text-muted-foreground">Created By</p>
                                                    <p className="font-medium">{getUserFullName(workItem.createdBy || '')}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <CalendarDays className="h-4 w-4 text-muted-foreground mt-1" />
                                                <div>
                                                    <p className="text-muted-foreground">Created On</p>
                                                    <p className="font-medium">
                                                        <ClientFormattedDate date={workItem.createdDate} formatString="MMMM do, yyyy h:mm a" />
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <History className="h-4 w-4 text-muted-foreground mt-1" />
                                                <div>
                                                    <p className="text-muted-foreground">Last Updated</p>
                                                    <p className="font-medium">
                                                        <ClientFormattedDate date={workItem.lastUpdatedDate || ''} formatString="MMMM do, yyyy h:mm a" />
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <CalendarDays className="h-4 w-4 text-muted-foreground mt-1" />
                                                <div>
                                                    <p className="text-muted-foreground">SLA Due Date</p>
                                                    <p className="font-medium">
                                                        <ClientFormattedDate date={workItem.slaDueDate || ''} formatString="MMMM do, yyyy h:mm a" />
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <Briefcase className="h-4 w-4 text-muted-foreground mt-1" />
                                                <div>
                                                    <p className="text-muted-foreground">Process</p>
                                                    <p className="font-medium">{workItem.workType}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <Flag className="h-4 w-4 text-muted-foreground mt-1" />
                                                <div>
                                                    <p className="text-muted-foreground">Priority</p>
                                                    <p className="font-medium">{workItem.priority}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <Info className="h-4 w-4 text-muted-foreground mt-1" />
                                                <div>
                                                    <p className="text-muted-foreground">Inbound Method</p>
                                                    <p className="font-medium">{workItem.inboundMethod}</p>
                                                </div>
                                            </div>
                                             <div className="flex items-start gap-3">
                                                <LinkIcon className="h-4 w-4 text-muted-foreground mt-1" />
                                                <div>
                                                    <p className="text-muted-foreground">Lead Type</p>
                                                    <p className="font-medium">{workItem.leadType || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <Separator />
                                        <div className="space-y-2">
                                            <div className="flex items-start gap-3">
                                                 <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                                 <div>
                                                     <p className="font-semibold">Overview</p>
                                                     <p className="text-sm text-muted-foreground">
                                                         {creationNote ? creationNote.text : (workItem.description || 'No overview available.')}
                                                     </p>
                                                 </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <FilePenLine className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="font-semibold">Initial Task</p>
                                                     <p className="text-sm text-muted-foreground">{workItem.initialTask || (workItem.tasks && workItem.tasks.length > 0 ? workItem.tasks.join(', ') : 'No initial task specified.')}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base font-semibold">Latest Update</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                    {workItem.latestUpdate ? (
                                        <div className="flex items-start gap-3">
                                            <MessageSquareText className="h-4 w-4 text-muted-foreground mt-1" />
                                            <div>
                                            <p className="font-semibold text-primary">{workItem.latestUpdate.title}</p>
                                            <p className="text-sm text-muted-foreground">{workItem.latestUpdate.description}</p>
                                            <p className="text-xs text-muted-foreground mt-1">{workItem.latestUpdate.date}</p>
                                            </div>
                                        </div>
                                        ) : <p className="text-sm text-muted-foreground">No updates available.</p>}
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                        <TabsContent value="notes" className="p-0 m-0 flex flex-col">
                            {/* Item Notes Section */}
                            <div>
                                <div className="flex items-center gap-2 font-semibold w-full text-left pt-2 pb-1 px-4 bg-white text-sm">
                                    - Notes
                                </div>
                                <Separator className="h-[0.5px] bg-primary w-full" />
                            </div>
                            <div className="flex-grow">
                                <Table className="w-full">
                                    <TableHeader>
                                        <TableRow className="bg-accent border-b h-6">
                                            <TableHead className="min-w-[120px] text-left">Category</TableHead>
                                            <TableHead className="min-w-[150px] text-left">Subject</TableHead>
                                            <TableHead className="min-w-[250px] text-left">Notes</TableHead>
                                            <TableHead className="min-w-[120px] text-left">Added By</TableHead>
                                            <TableHead className="min-w-[120px] text-left whitespace-nowrap">Date/Time</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {itemNotes.map((note) => (
                                            <TableRow key={note.id} className="hover:bg-accent border-none">
                                                <TableCell className="text-left align-top">{note.category}</TableCell>
                                                <TableCell className="text-left align-top">{note.subject}</TableCell>
                                                <TableCell className="text-left align-top whitespace-pre-wrap">{note.text}</TableCell>
                                                <TableCell className="text-left align-top">{getUserFullName(note.authorId)}</TableCell>
                                                <TableCell className="text-left align-top">
                                                     <div className="flex items-center justify-between">
                                                        <ClientFormattedDate date={note.date} formatString="dd MMM yyyy HH:mm" />
                                                        {user && (user.role === 'admin' || user.uid === note.authorId) && (
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => handleDeleteNoteClick(e, note)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {itemNotes.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center h-24">
                                                    No notes found for this work item.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Global Notes Section */}
                            {globalItemNotes.length > 0 && (
                                <>
                                    <div className="mt-4">
                                        <div className="flex items-center gap-2 font-semibold w-full text-left pt-2 pb-1 px-4 bg-white text-sm">
                                            - Global Notes
                                        </div>
                                        <Separator className="h-[0.5px] bg-primary w-full" />
                                    </div>
                                    <div className="flex-grow">
                                        <Table className="w-full">
                                            <TableHeader>
                                                <TableRow className="bg-accent border-b h-6">
                                                    <TableHead className="min-w-[120px] text-left">Index</TableHead>
                                                    <TableHead className="min-w-[150px] text-left">Subject</TableHead>
                                                    <TableHead className="min-w-[250px] text-left">Notes</TableHead>
                                                    <TableHead className="min-w-[120px] text-left">Added By</TableHead>
                                                    <TableHead className="min-w-[120px] text-left whitespace-nowrap">Date/Time</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {globalItemNotes.map((note) => (
                                                    <TableRow key={note.id} className="hover:bg-accent border-none">
                                                        <TableCell className="text-left align-top">{note.category}</TableCell>
                                                        <TableCell className="text-left align-top">{note.subject}</TableCell>
                                                        <TableCell className="text-left align-top whitespace-pre-wrap">{note.text}</TableCell>
                                                        <TableCell className="text-left align-top">{getUserFullName(note.authorId)}</TableCell>
                                                        <TableCell className="text-left align-top">
                                                            <div className="flex items-center justify-between">
                                                                <ClientFormattedDate date={note.date} formatString="dd MMM yyyy HH:mm" />
                                                                {user && (user.role === 'admin' || user.uid === note.authorId) && (
                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => handleDeleteNoteClick(e, note)}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </>
                            )}
                        </TabsContent>
                        <TabsContent value="contact" className="p-4 bg-background space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader className="py-2">
                                        <CardTitle className="text-xs flex items-center gap-2"><UserIcon className="h-4 w-4" />Contact Info</CardTitle>
                                    </CardHeader>
                                    <Separator />
                                    <CardContent className="pt-4 text-sm space-y-3">
                                        <div className="flex justify-between items-center"><span className="text-muted-foreground">Name</span><span className="font-medium text-right">{workItem.customerName || 'N/A'}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-muted-foreground">Phone</span><span className="font-medium text-right">{workItem.customerPhone || 'N/A'}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-muted-foreground">Secondary Phone</span><span className="font-medium text-right">{workItem.secondaryPhone || 'N/A'}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-muted-foreground">Email</span><span className="font-medium text-right">{workItem.customerEmail || 'N/A'}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-muted-foreground">Date of Birth</span><span className="font-medium text-right">{workItem.customerDateOfBirth ? <ClientFormattedDate date={workItem.customerDateOfBirth} formatString="dd MMM yyyy" /> : 'N/A'}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-muted-foreground">Business Name</span><span className="font-medium text-right">{workItem.businessName || 'N/A'}</span></div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="py-2">
                                        <CardTitle className="text-xs flex items-center gap-2"><Landmark className="h-4 w-4" />Bank Info</CardTitle>
                                    </CardHeader>
                                    <Separator />
                                    <CardContent className="pt-4 text-sm space-y-3">
                                        <div className="flex justify-between items-center"><span className="text-muted-foreground">Bank Name</span><span className="font-medium text-right">{workItem.customerBankName || 'N/A'}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-muted-foreground">Account No.</span><span className="font-medium text-right">{workItem.customerAccountNumber || 'N/A'}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-muted-foreground">IFSC Code</span><span className="font-medium text-right">{workItem.customerIfscCode || 'N/A'}</span></div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="py-2">
                                        <CardTitle className="text-xs flex items-center gap-2"><Fingerprint className="h-4 w-4" />Identity</CardTitle>
                                    </CardHeader>
                                    <Separator />
                                    <CardContent className="pt-4 text-sm space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">Customer ID</span>
                                            <span className="font-medium text-right">
                                                {workItem.customerId || 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center"><span className="text-muted-foreground">Aadhar</span><span className="font-medium text-right">{workItem.customerAadhar || 'N/A'}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-muted-foreground">PAN</span><span className="font-medium text-right">{workItem.customerPan || 'N/A'}</span></div>
                                    </CardContent>
                                </Card>
                                <div className="grid grid-cols-1 gap-4">
                                    <Card>
                                        <CardHeader className="py-2">
                                            <CardTitle className="text-xs flex items-center gap-2"><Home className="h-4 w-4" />Address</CardTitle>
                                        </CardHeader>
                                        <Separator />
                                        <CardContent className="pt-4 text-sm">
                                            <p className="text-muted-foreground">{[workItem.address, workItem.city, workItem.state, workItem.pinCode].filter(Boolean).join(', ') || 'N/A'}</p>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader className="py-2">
                                            <CardTitle className="text-xs flex items-center gap-2"><Info className="h-4 w-4" />Other Information</CardTitle>
                                        </CardHeader>
                                        <Separator />
                                        <CardContent className="pt-4 text-sm">
                                            <p className="text-muted-foreground whitespace-pre-wrap">{workItem.customerOtherInfo || 'N/A'}</p>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="images" className="p-0 m-0">
                            <div>
                                <button
                                    className="flex items-center gap-2 font-semibold w-full text-left pt-2 pb-1 px-4 bg-white text-xs"
                                    onClick={() => setIsImagesOpen(!isImagesOpen)}
                                >
                                    <ChevronDown className={cn("h-4 w-4 transition-transform", !isImagesOpen && "-rotate-90")} />
                                    Documents
                                </button>
                                <Separator className="h-[0.5px] bg-primary w-full" />
                            </div>
                            {isImagesOpen && (
                                <div className="p-4">
                                    <Table className="w-full">
                                        <TableHeader>
                                            <TableRow className="bg-accent border-b h-6">
                                                <TableHead className="min-w-[120px] text-left whitespace-nowrap">Date</TableHead>
                                                <TableHead className="min-w-[100px] text-left">Type</TableHead>
                                                <TableHead className="min-w-[100px] text-left">Direction</TableHead>
                                                <TableHead className="min-w-[150px] text-left">Document Source</TableHead>
                                                <TableHead className="min-w-[150px] text-left whitespace-nowrap">Business Event</TableHead>
                                                <TableHead className="min-w-[120px] text-left">Added By</TableHead>
                                                <TableHead className="min-w-[150px] text-left pr-4 whitespace-nowrap">View Document</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {documents && documents.length > 0 ? (
                                                documents.map((doc) => (
                                                    <TableRow key={doc.id}>
                                                        <TableCell className="text-left">
                                                            <ClientFormattedDate date={doc.uploadedAt} formatString="dd MMM yyyy HH:mm:ss" />
                                                        </TableCell>
                                                        <TableCell className="text-left">{doc.type}</TableCell>
                                                        <TableCell className="text-left">{doc.direction}</TableCell>
                                                        <TableCell className="text-left">{doc.documentSource}</TableCell>
                                                        <TableCell className="text-left">{doc.businessEvent}</TableCell>
                                                        <TableCell className="text-left">{getUserFullName(doc.uploadedById)}</TableCell>
                                                        <TableCell className="text-left pr-4">
                                                            <div className="flex items-center justify-start gap-2">
                                                                {doc.type === 'QUOTE' ? (
                                                                    <Button
                                                                        variant="link"
                                                                        className="p-0 h-auto"
                                                                        onClick={() => handleDownloadQuotation(doc)}
                                                                        disabled={isGeneratingQuote}
                                                                    >
                                                                        {isGeneratingQuote ? 'Generating...' : 'Click to view document'}
                                                                    </Button>
                                                                ) : doc.type === 'EMAIL' ? (
                                                                    <Button
                                                                        variant="link"
                                                                        className="p-0 h-auto"
                                                                        onClick={() => handleDownloadEmail(doc)}
                                                                        disabled={isGeneratingEmail}
                                                                    >
                                                                        {isGeneratingEmail ? 'Generating...' : 'Click to view document'}
                                                                    </Button>
                                                                ) : (
                                                                    <a href={doc.url} download={doc.name} className={cn(buttonVariants({ variant: "link" }), "p-0 h-auto")}>
                                                                        Click to view document
                                                                    </a>
                                                                )}
                                                                {user && user.role === 'admin' && (
                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => handleDeleteDocumentClick(e, doc)}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center h-24">
                                                        No documents attached.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="associations" className="p-0 m-0">
                            <div>
                                <button
                                    className="flex items-center gap-2 font-semibold w-full text-left pt-2 pb-1 px-4 bg-white text-xs"
                                    onClick={() => setIsAssociationsOpen(!isAssociationsOpen)}
                                >
                                    <ChevronDown className={cn("h-4 w-4 transition-transform", !isAssociationsOpen && "-rotate-90")} />
                                    AI Email
                                </button>
                                <Separator className="h-[0.5px] bg-primary w-full" />
                            </div>
                            {isAssociationsOpen && user && (
                                <EmailComposer workItem={workItem} user={user} />
                            )}
                            {isAssociationsOpen && !user && (
                                 <p className="p-4 text-center text-muted-foreground">Please log in to use this feature.</p>
                            )}
                        </TabsContent>
                        <TabsContent value="tasks" className="p-0 m-0">
                             <div className="p-2 space-y-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base font-semibold">Active Tasks</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-accent border-b h-6">
                                                    <TableHead className="min-w-[150px]">Title</TableHead>
                                                    <TableHead className="min-w-[100px]">Status</TableHead>
                                                    <TableHead className="min-w-[120px]">Created By</TableHead>
                                                    <TableHead className="min-w-[120px] whitespace-nowrap">Created Date</TableHead>
                                                    <TableHead className="min-w-[80px] text-right">Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {activeTasks.length > 0 ? (
                                                    activeTasks.map((task) => (
                                                        <TableRow key={task.id}>
                                                            <TableCell>{task.title}</TableCell>
                                                            <TableCell>{task.status}</TableCell>
                                                            <TableCell>{getUserFullName(task.createdBy)}</TableCell>
                                                            <TableCell>
                                                                <ClientFormattedDate date={task.createdDate} formatString="dd MMM yyyy HH:mm" />
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                {user && (user.role === 'admin' || user.uid === task.createdBy) && (
                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => handleDeleteTaskClick(e, task)}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center h-24">
                                                            No active tasks for this work item.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base font-semibold">Closed Tasks</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-accent border-b h-6">
                                                    <TableHead className="min-w-[150px]">Title</TableHead>
                                                    <TableHead className="min-w-[100px]">Status</TableHead>
                                                    <TableHead className="min-w-[120px]">Created By</TableHead>
                                                    <TableHead className="min-w-[120px] whitespace-nowrap">Created Date</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {closedTasks.length > 0 ? (
                                                    closedTasks.map((task) => (
                                                        <TableRow key={task.id}>
                                                            <TableCell>{task.title}</TableCell>
                                                            <TableCell>{task.status}</TableCell>
                                                            <TableCell>{getUserFullName(task.createdBy)}</TableCell>
                                                            <TableCell>
                                                                <ClientFormattedDate date={task.createdDate} formatString="dd MMM yyyy HH:mm" />
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center h-24">
                                                            No closed tasks for this work item.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>
                        <TabsContent value="quotation" className="p-0 m-0">
                            <div>
                                <button
                                    className="flex items-center gap-2 font-semibold w-full text-left pt-2 pb-1 px-4 bg-white text-xs"
                                    onClick={() => setIsQuotationOpen(!isQuotationOpen)}
                                >
                                    <ChevronDown className={cn("h-4 w-4 transition-transform", !isQuotationOpen && "-rotate-90")} />
                                    Quotation
                                </button>
                                <Separator className="h-[0.5px] bg-primary w-full" />
                            </div>
                            {isQuotationOpen && (
                                <CreateQuotation workItem={workItem} />
                            )}
                        </TabsContent>
                        <TabsContent value="agency" className="p-0 m-0">
                            <div>
                                <button
                                    className="flex items-center gap-2 font-semibold w-full text-left pt-2 pb-1 px-4 bg-white text-xs"
                                    onClick={() => setIsPaymentOpen(!isPaymentOpen)}
                                >
                                    <ChevronDown className={cn("h-4 w-4 transition-transform", !isPaymentOpen && "-rotate-90")} />
                                    Payment
                                </button>
                                <Separator className="h-[0.5px] bg-primary w-full" />
                            </div>
                            {isPaymentOpen && (
                                <AgencyDetails workItem={workItem} transactions={transactions} />
                            )}
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
            {quoteToPrint && (
                <div id="quotation-to-print-details" className="fixed -left-[9999px] top-0">
                    <QuotationTemplate 
                        workItem={quoteToPrint.workItem} 
                        items={quoteToPrint.items} 
                        quoteNumber={quoteToPrint.quoteNumber}
                        totals={quoteToPrint.totals}
                        validUntil={quoteToPrint.validUntil}
                        quoteDate={quoteToPrint.quoteDate}
                        logoUrl={logoUrl}
                    />
                </div>
            )}
            {emailToPrint && (
                <div id="email-to-print-details" className="fixed -left-[9999px] top-0">
                    <EmailTemplate
                        emailData={emailToPrint}
                        workItem={workItem}
                        logoUrl={logoUrl}
                        sentByUser={users.find(u => u.id === emailToPrint.sentBy)}
                    />
                </div>
            )}
            <ImageUploadDialog workItem={workItem} open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen} />
            <AddTaskDialog workItem={workItem} open={isAddTaskDialogOpen} onOpenChange={setIsAddTaskDialogOpen} />
            <EditCustomerDetailsDialog workItem={workItem} open={isEditCustomerDialogOpen} onOpenChange={setIsEditCustomerDialogOpen} />
            <AlertDialog open={!!documentToDelete} onOpenChange={(isOpen) => !isOpen && setDocumentToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the document "{documentToDelete?.name}".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDocumentToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className={cn(buttonVariants({ variant: "destructive" }))}
                            onClick={handleConfirmDeleteDocument}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={!!noteToDelete} onOpenChange={(isOpen) => !isOpen && setNoteToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the note with subject "{noteToDelete?.subject}".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setNoteToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className={cn(buttonVariants({ variant: "destructive" }))}
                            onClick={handleConfirmDeleteNote}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={!!taskToDelete} onOpenChange={(isOpen) => !isOpen && setTaskToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the task "{taskToDelete?.title}".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setNoteToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className={cn(buttonVariants({ variant: "destructive" }))}
                            onClick={handleConfirmDeleteTask}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
