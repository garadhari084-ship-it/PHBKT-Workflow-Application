# **App Name**: PHBKT Group Limited - WorkFlow Management System

## Core Features:

- User Authentication: Secure login with Email/Password and SSO (Azure AD / Google Workspace).
- Work Item Management: Create, assign, and track work items with detailed information (Work Type, Status, Priority, Created Date, Inbound Method).
- Multi-Tenant Support: Isolate data by tenant with tenantId in every record.
- SLA Management: Calculate SLA based on working days, excluding weekends and tenant-specific holidays. Display a live countdown timer and highlight breaches.
- Search and Filtering: Search work items by Work ID or Subject, and filter by Status, Priority, Assigned User, and Tenant (Super Admin only).
- Audit Logging: Log every action (status changes, assignments, notes, uploads, SLA breaches) and allow exporting as PDF.
- Image and Document Upload: Upload documents to Firebase Storage and view embedded PDF previews.

## Style Guidelines:

- Header background color: Dark Maroon/Burgundy (#8B1C2D).
- Table headers: Light grey.
- Table-based layouts only, replicating the attached screenshots exactly.
- Thin borders, compact row height, and horizontal scrolling tabs as per screenshots.
- Fonts similar to Segoe UI / Arial.
- Main Tabs: Dark maroon with white text when active.
- Alternating light grey rows for Notes tab, read-only history style.