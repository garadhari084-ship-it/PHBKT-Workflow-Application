
export type User = {
  id: string;
  employeeId?: string;
  name?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email: string;
  company?: string;
  department?: string;
  jobTitle?: string;
  level?: string;
  workLocation?: string;
  role: 'User' | 'admin';
  phoneNumber?: string;
  dateOfBirth?: string;
  aadharNumber?: string;
  panNumber?: string;
};

export type WorkItemStatus = 'Open' | 'Close' | 'Completed' | 'Terminated' | 'Reindex' | 'Transfer' | 'Pend';

export type Customer = {
  id: string;
  name: string;
  email?: string;
  phone: string;
  secondaryPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  createdDate: string;
};

export type WorkItem = {
  id: string;
  subject: string;
  workType: string;
  status: WorkItemStatus;
  priority: string;
  createdDate: string;
  inboundMethod: string;
  assignedUserId: string; // userId
  slaDueDate: string;
  createdBy?: string; // userId
  lastUpdatedDate?: string;
  overview?: string[];
  initialTask?: string;
  latestUpdate?: {
    title: string;
    description: string;
    date: string;
  };
  // New fields from form
  customerId?: string;
  description?: string;
  leadType?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  secondaryPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  hasBusiness?: boolean;
  businessName?: string;
  lockedBy?: string;
  tasks?: string[];
  customerDateOfBirth?: string;
  customerAadhar?: string;
  customerPan?: string;
  customerBankName?: string;
  customerAccountNumber?: string;
  customerIfscCode?: string;
  customerOtherInfo?: string;
};

export type Note = {
  id: string;
  workItemId: string;
  authorId: string;
  date: string;
  text: string;
  category: string;
  subject: string;
  isGlobal?: boolean;
};

export type AuditLog = {
  id: string;
  userId: string;
  workItemId?: string;
  actionType: string;
  timestamp: string;
  details: string;
};

export type Document = {
  id: string;
  workItemId: string;
  name: string;
  url: string;
  uploadedAt: string;
  uploadedById: string;
  type?: string;
  direction?: 'INBOUND' | 'OUTBOUND';
  documentSource?: string;
  businessEvent?: string;
};

export type Task = {
  id: string;
  workItemId: string;
  title: string;
  description?: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  createdDate: string;
  createdBy: string; // userId
};

export type GlobalNote = {
  id: string;
  customerId: string;
  workItemId?: string;
  text: string;
  authorId: string; // userId
  date: string;
  subject?: string;
};

export type Transaction = {
  id: string;
  customerId: string;
  workItemId: string;
  date: string;
  description: string;
  type: 'Debit Invoice' | 'Credit Invoice' | 'Credit Advance';
  amount: number;
  createdById: string; // userId
};

export type WorkItemTab = {
  href: string;
  label: string;
};
