
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Upload, ArrowLeft, Info, Download } from 'lucide-react';
import { useFirestore, useUser } from '@/firebase';
import { collection, doc, runTransaction, query, where, getDocs, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import type { Customer, GlobalNote } from '@/lib/types';
import { 
    newBusinessRequestTasks, 
    webAndAppTasks, 
    digitalMarketingTasks, 
    taxAndComplianceTasks, 
    bpoAndKpoTasks, 
    feedbackAndComplaintTasks, 
    otherServiceRequestTasks 
} from '@/lib/tasks';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

type ExcelRow = {
  'Customer Name': string;
  'Email'?: string;
  'Phone': string;
  'Secondary Phone'?: string;
  'City'?: string;
  'Overview': string;
  'Business / Company Name'?: string;
};

export default function BatchWorkItemCreatePage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const firestore = useFirestore();
  const { user } = useUser();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [workType, setWorkType] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<ExcelRow[]>([]);
  const [isCreating, setIsCreating] = useState(false);

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
    setSelectedTasks([]);
  }, [workType]);

  const availableTasks = useMemo(() => {
    return allAvailableTasks.filter(task => !selectedTasks.includes(task));
  }, [allAvailableTasks, selectedTasks]);

  const handleSelectTask = (task: string) => {
    setSelectedTasks(prev => {
        const newTasks = [...prev, task];
        return newTasks;
    });
  };

  const handleDeselectTask = (task: string) => {
      setSelectedTasks(prev => {
          const newTasks = prev.filter(t => t !== task);
          return newTasks;
      });
  };


  const handleDownloadTemplate = () => {
    const headers = [
      'Customer Name',
      'Phone',
      'City',
      'Overview',
      'Email',
      'Secondary Phone',
      'Business / Company Name',
    ];
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'work_item_upload_template.xlsx');
    XLSX.writeFile(workbook, 'work_item_upload_template.xlsx');
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      const allowedExtensions = /(\.xlsx|\.xls)$/i;
      if (!allowedExtensions.exec(file.name)) {
        toast({
          variant: 'destructive',
          title: 'Invalid File Type',
          description: 'Please upload an Excel file (.xlsx or .xls).',
        });
        setSelectedFile(null);
        setParsedData([]);
        return;
      }
      setSelectedFile(file);
      parseExcel(file);
    }
  };

  const parseExcel = (file: File) => {
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      if (!data) {
          setIsProcessing(false);
          return;
      }
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);
      
      const requiredColumns = ['Customer Name', 'Phone', 'City', 'Overview'];
      const firstRow = json[0] ? Object.keys(json[0]) : [];
      const hasAllColumns = requiredColumns.every(col => firstRow.includes(col));

      if (!hasAllColumns) {
        toast({
            variant: 'destructive',
            title: 'Invalid Excel Format',
            description: `The Excel file must contain at least the following columns: ${requiredColumns.join(', ')}.`,
        });
        setParsedData([]);
        setSelectedFile(null);
      } else {
        setParsedData(json);
      }
      setIsProcessing(false);
    };
    reader.onerror = () => {
        toast({ variant: 'destructive', title: 'File Read Error', description: 'Could not read the selected file.' });
        setIsProcessing(false);
    }
    reader.readAsBinaryString(file);
  };
  
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

  const handleCreateWorkItems = async () => {
    if (!firestore || !user) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in.' });
        return;
    }
    if (parsedData.length === 0) {
        toast({ variant: 'destructive', title: 'No Data', description: 'No data to create work items from.' });
        return;
    }
    if (!workType) {
        toast({ variant: 'destructive', title: 'Process not selected', description: 'Please select a process.' });
        return;
    }
     if (selectedTasks.length === 0) {
        toast({ variant: 'destructive', title: 'Task not selected', description: 'Please select at least one task.' });
        return;
    }

    setIsCreating(true);

    let successCount = 0;
    let errorCount = 0;

    for (const row of parsedData) {
      try {
        const fullPhoneNumber = `+91${row['Phone']}`;
        let customerId: string;
        let isNewCustomer = false;

        const customersRef = collection(firestore, "customers");
        const q = query(customersRef, where("phone", "==", fullPhoneNumber));
        const customerQuerySnapshot = await getDocs(q);

        if (customerQuerySnapshot.empty) {
            isNewCustomer = true;
            customerId = generateCustomerUID();
        } else {
            customerId = customerQuerySnapshot.docs[0].id;
        }
        
        const city = row['City'] || '';

        const newWorkItemId = await runTransaction(firestore, async (transaction) => {
            const prefix = getWorkTypePrefix(workType);
            const counterId = `work_items_${prefix}`;
            const counterRef = doc(firestore, 'counters', counterId);
            const counterDoc = await transaction.get(counterRef);

            const newCount = counterDoc.exists() ? counterDoc.data().value + 1 : 1;
            const numericId = String(newCount).padStart(7, '0');
            const customId = `${prefix}-${numericId}`;

            const workItemsCollectionRef = collection(firestore, 'work_items');
            const newWorkItemRef = doc(workItemsCollectionRef, customId);

            const newWorkItemData = {
              id: customId,
              subject: workType,
              workType: workType,
              status: 'Open',
              priority: 'Medium',
              createdDate: new Date().toISOString(),
              inboundMethod: 'Batch',
              assignedUserId: '', // To queue
              createdBy: user.uid,
              lastUpdatedDate: new Date().toISOString(),
              slaDueDate: new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
              customerId: customerId,
              customerName: row['Customer Name'],
              customerEmail: row['Email'] || '',
              customerPhone: fullPhoneNumber,
              secondaryPhone: row['Secondary Phone'] ? `+91${row['Secondary Phone']}` : '',
              address: '',
              city: city,
              state: '',
              pinCode: '',
              businessName: row['Business / Company Name'] || '',
              hasBusiness: !!row['Business / Company Name'],
              description: row['Overview'],
              tasks: selectedTasks,
              overview: [row['Overview']]
            };
            
            transaction.set(newWorkItemRef, newWorkItemData);
            
            const notesCollectionRef = collection(firestore, 'work_items', customId, 'notes');
            const newNoteRef = doc(notesCollectionRef);
            const creationNote = {
                id: newNoteRef.id,
                workItemId: customId,
                authorId: user.uid,
                date: new Date().toISOString(),
                text: row['Overview'],
                category: 'Creation',
                subject: 'Work Item Created'
            };
            transaction.set(newNoteRef, creationNote);

            if (isNewCustomer) {
                const newCustomerRef = doc(firestore, "customers", customerId);
                const newCustomerData: Partial<Customer> = {
                    id: customerId,
                    name: row['Customer Name'],
                    email: row['Email'] || "",
                    phone: fullPhoneNumber,
                    secondaryPhone: row['Secondary Phone'] ? `+91${row['Secondary Phone']}` : '',
                    address: '',
                    city: city,
                    state: '',
                    pinCode: '',
                    createdDate: new Date().toISOString(),
                };
                transaction.set(newCustomerRef, newCustomerData);
            }

            transaction.set(counterRef, { value: newCount });
            return customId;
        });
        
         if (!isNewCustomer) {
            const globalNotesQuery = query(collection(firestore, "global_notes"), where("customerId", "==", customerId));
            const globalNotesSnapshot = await getDocs(globalNotesQuery);
            if (!globalNotesSnapshot.empty) {
                const noteBatch = writeBatch(firestore);
                globalNotesSnapshot.forEach(globalNoteDoc => {
                    const globalNoteData = globalNoteDoc.data() as GlobalNote;
                    const newNoteRef = doc(collection(firestore, `work_items/${newWorkItemId}/notes`));
                    noteBatch.set(newNoteRef, {
                        id: newNoteRef.id, workItemId: newWorkItemId, authorId: globalNoteData.authorId,
                        date: globalNoteData.date, text: globalNoteData.text, category: 'Global Note',
                        subject: globalNoteData.subject || "Imported Global Note", isGlobal: true,
                    });
                });
                await noteBatch.commit();
            }
          }

        successCount++;
      } catch (error) {
        console.error("Error creating work item for row:", row, error);
        errorCount++;
      }
    }

    setIsCreating(false);
    toast({
        title: 'Batch Creation Complete',
        description: `${successCount} work items created successfully. ${errorCount} failed.`,
    });
    setParsedData([]);
    setSelectedFile(null);
    setWorkType('');
    setSelectedTasks([]);
  };

  return (
    <div className="w-full border-b border-primary bg-background flex-1 overflow-y-auto px-2 md:px-4 lg:px-6 py-4 md:py-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
                    <ArrowLeft className="h-6 w-6" />
                </Button>
                <h1 className="text-2xl font-bold">Batch Work Item Create</h1>
            </div>
            <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download Upload Template
            </Button>
        </div>

        <Card className="mb-6 bg-gray-50 h-28">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0 p-4">
                <Info className="h-5 w-5 text-muted-foreground mt-1"/>
                <div>
                    <CardTitle className="text-lg">Instructions</CardTitle>
                    <ul className="list-disc pl-5 text-xs text-muted-foreground mt-2 space-y-1">
                        <li>To upload items, select a process and a task, then upload an Excel file.</li>
                        <li>Required Excel columns: <strong>Customer Name, Phone, City, Overview</strong>.</li>
                        <li>Optional columns: Email, Secondary Phone, Business / Company Name.</li>
                    </ul>
                </div>
            </CardHeader>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4 md:col-span-2">
                <div>
                  <Label htmlFor="process-select">Process</Label>
                  <Select value={workType} onValueChange={setWorkType}>
                    <SelectTrigger id="process-select">
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
                    <div className="border rounded-md">
                        <Label className="flex items-center justify-center p-2 text-sm font-semibold">Tasks</Label>
                        <Separator />
                         <div className="bg-accent p-2 rounded-b-md">
                            <div className="grid grid-cols-2 text-center">
                                <h3 className="font-semibold mb-1 text-sm">Available Tasks</h3>
                                <h3 className="font-semibold mb-1 text-sm">Selected Tasks</h3>
                            </div>
                            <Separator className="my-1 bg-border/20 w-full h-[0.5px]" />
                            <div className="grid grid-cols-2 relative">
                                <div className="pr-1">
                                    <ScrollArea className="h-[200px] w-full rounded-md bg-background border">
                                        <div className="p-2 space-y-1">
                                            {availableTasks.map(task => (
                                                <div key={task} onClick={() => handleSelectTask(task)} className="cursor-pointer p-1 hover:bg-primary/10 rounded-sm text-sm">
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
                                        <div className="p-2 space-y-1">
                                            {selectedTasks.length > 0 ? selectedTasks.map(task => (
                                                <div key={task} onClick={() => handleDeselectTask(task)} className="cursor-pointer p-1 hover:bg-primary/10 rounded-sm font-bold text-sm">
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
              <div className="space-y-4">
                <div>
                  <Label htmlFor="excel-upload" className="block mb-2">Excel File</Label>
                  <label htmlFor="excel-upload" className="flex justify-center w-full h-10 px-4 transition bg-white border-2 border-gray-300 border-dashed rounded-md appearance-none cursor-pointer hover:border-gray-400 focus:outline-none">
                      <span className="flex items-center space-x-2">
                          <Upload className="h-6 w-6 text-gray-600" />
                          <span className="font-medium text-gray-600 text-xs">
                               {selectedFile ? `${selectedFile.name} (${parsedData.length} rows)` : 'Click to select or drag & drop Excel file'}
                          </span>
                      </span>
                      <Input
                          id="excel-upload"
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={handleFileChange}
                          className="hidden"
                      />
                  </label>
                </div>
                <Button onClick={handleCreateWorkItems} disabled={isCreating || isProcessing || parsedData.length === 0 || !workType || selectedTasks.length === 0} className="w-full">
                  {isCreating ? 'Creating...' : isProcessing ? 'Processing...' : `Create ${parsedData.length > 0 ? parsedData.length : ''} Work Items`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
