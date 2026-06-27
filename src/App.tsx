import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Page_dashboard_admin_api_integration from './app/dashboard/admin/api-integration/page';
import Page_dashboard_admin_application_updates from './app/dashboard/admin/application-updates/page';
import Page_dashboard_admin_batch_work_item_create from './app/dashboard/admin/batch-work-item-create/page';
import Page_dashboard_admin_completed_work from './app/dashboard/admin/completed-work/page';
import Page_dashboard_admin_manage_customer_edit from './app/dashboard/admin/manage-customer/edit/page';
import Page_dashboard_admin_manage_customer from './app/dashboard/admin/manage-customer/page';
import Page_dashboard_admin_manage_customer_view from './app/dashboard/admin/manage-customer/view/page';
import Page_dashboard_admin from './app/dashboard/admin/page';
import Page_dashboard_admin_payment_transactions from './app/dashboard/admin/payment-transactions/page';
import Page_dashboard_admin_unassigned_work_items from './app/dashboard/admin/unassigned-work-items/page';
import Page_dashboard_admin_users_edit from './app/dashboard/admin/users/edit/page';
import Page_dashboard_admin_users_new from './app/dashboard/admin/users/new/page';
import Page_dashboard_admin_users from './app/dashboard/admin/users/page';
import Page_dashboard_admin_users_analytics from './app/dashboard/admin/users-analytics/page';
import Page_dashboard_admin_web_lead_work_items from './app/dashboard/admin/web-lead-work-items/page';
import Page_dashboard_admin_work_items from './app/dashboard/admin/work-items/page';
import Page_dashboard_global_notes from './app/dashboard/global-notes/page';
import DashboardLayout from './app/dashboard/layout';
import Page_dashboard_new_work from './app/dashboard/new-work/page';
import Page_dashboard from './app/dashboard/page';
import Page_dashboard_search from './app/dashboard/search/page';
import Page_dashboard_work_item from './app/dashboard/work-item/page';
import Page_login from './app/login/page';
import Page__ from './app/page';
import { FirebaseClientProvider } from './firebase/client-provider';
import { Toaster } from '@/components/ui/toaster';

export default function App() {
  return (
    <FirebaseClientProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Page__ />} />
          <Route path="/login" element={<Page_login />} />
          
          {/* Dashboard Routes wrapped in DashboardLayout */}
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<Page_dashboard />} />
            <Route path="admin" element={<Page_dashboard_admin />} />
            <Route path="admin/api-integration" element={<Page_dashboard_admin_api_integration />} />
            <Route path="admin/application-updates" element={<Page_dashboard_admin_application_updates />} />
            <Route path="admin/batch-work-item-create" element={<Page_dashboard_admin_batch_work_item_create />} />
            <Route path="admin/completed-work" element={<Page_dashboard_admin_completed_work />} />
            <Route path="admin/manage-customer/edit" element={<Page_dashboard_admin_manage_customer_edit />} />
            <Route path="admin/manage-customer" element={<Page_dashboard_admin_manage_customer />} />
            <Route path="admin/manage-customer/view" element={<Page_dashboard_admin_manage_customer_view />} />
            <Route path="admin/payment-transactions" element={<Page_dashboard_admin_payment_transactions />} />
            <Route path="admin/unassigned-work-items" element={<Page_dashboard_admin_unassigned_work_items />} />
            <Route path="admin/users/edit" element={<Page_dashboard_admin_users_edit />} />
            <Route path="admin/users/new" element={<Page_dashboard_admin_users_new />} />
            <Route path="admin/users" element={<Page_dashboard_admin_users />} />
            <Route path="admin/users-analytics" element={<Page_dashboard_admin_users_analytics />} />
            <Route path="admin/web-lead-work-items" element={<Page_dashboard_admin_web_lead_work_items />} />
            <Route path="admin/work-items" element={<Page_dashboard_admin_work_items />} />
            <Route path="global-notes" element={<Page_dashboard_global_notes />} />
            <Route path="new-work" element={<Page_dashboard_new_work />} />
            <Route path="search" element={<Page_dashboard_search />} />
            <Route path="work-item" element={<Page_dashboard_work_item />} />
          </Route>
        </Routes>
      </HashRouter>
      <Toaster />
    </FirebaseClientProvider>
  );
}
