'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useUser } from '@/firebase';
import type { WorkItemTab } from '@/lib/types';

// Define all possible navigation links with associated roles if they are restricted
const allNavLinks = [
  { href: '/dashboard/admin', label: 'Admin', roles: ['admin'] },
  { href: '/dashboard', label: 'My Work' },
  { href: '/dashboard/search', label: 'Search' },
  { href: '/dashboard/global-notes', label: 'Global Notes' },
];

export default function SubHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const [isClient, setIsClient] = useState(false);
  const [workItemTabs, setWorkItemTabs] = useState<WorkItemTab[]>([]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Filter the navigation links based on the current user's role
  const navLinks = allNavLinks.filter(link => {
    if (!link.roles) {
      return true; // Show links that don't have a roles property
    }
    if (!user) {
      return false; // Hide protected links if user is not available
    }
    return link.roles.includes(user.role);
  });
  
  useEffect(() => {
    if (!isClient) return;

    const updateTabs = () => {
      try {
        const openTabsString = localStorage.getItem('openWorkItemTabs');
        if (openTabsString) {
          setWorkItemTabs(JSON.parse(openTabsString));
        } else {
          setWorkItemTabs([]);
        }
      } catch (error) {
        console.error("Failed to parse work item tabs from localStorage", error);
        setWorkItemTabs([]);
      }
    };
    
    updateTabs();

    const handleTabsUpdate = () => updateTabs();

    window.addEventListener('tabs-update', handleTabsUpdate);
    window.addEventListener('storage', (e) => {
      if (e.key === 'openWorkItemTabs') {
        updateTabs();
      }
    });

    return () => {
      window.removeEventListener('tabs-update', handleTabsUpdate);
      window.removeEventListener('storage', handleTabsUpdate);
    };
  }, [isClient]);

  const closeTab = (e: React.MouseEvent, tabToClose: WorkItemTab) => {
    e.preventDefault();
    e.stopPropagation();

    const newTabs = workItemTabs.filter(tab => tab.href !== tabToClose.href);
    setWorkItemTabs(newTabs);
    localStorage.setItem('openWorkItemTabs', JSON.stringify(newTabs));
    window.dispatchEvent(new CustomEvent('tabs-update'));


    if (pathname === tabToClose.href) {
        if (newTabs.length > 0) {
            router.push(newTabs[newTabs.length - 1].href);
        } else {
            router.push('/dashboard');
        }
    }
  };

  const isWorkItemTabActive = isClient && workItemTabs.some(tab => tab.href === pathname);

  return (
    <div className="sticky top-20 z-40 bg-background shadow-sm">
      <div className="border-b-[1px] border-primary">
        <nav className="flex items-end overflow-x-auto no-scrollbar tap-highlight-transparent min-w-0">
          {navLinks.map((link) => {
            let isActive = false;
            if (isClient && !isWorkItemTabActive) {
              if (link.href === '/dashboard') {
                // Check if the current path belongs to another main tab
                const isAnotherTabActive = navLinks
                  .filter(l => l.href !== '/dashboard')
                  .some(l => pathname.startsWith(l.href));
                
                // "My Work" is active if the path starts with /dashboard but not with another tab's path
                isActive = pathname.startsWith('/dashboard') && !isAnotherTabActive;
              } else {
                // Other links are active if the path starts with their href
                isActive = pathname.startsWith(link.href);
              }
            }

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center whitespace-nowrap px-3 py-1 text-sm font-medium border-r border-white/20 text-primary-foreground',
                  isActive
                    ? 'bg-black hover:bg-black/90'
                    : 'bg-primary hover:bg-primary/90'
                )}
              >
                {link.label}
              </Link>
            );
          })}
          {isClient && workItemTabs.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center whitespace-nowrap px-3 py-1 text-sm font-medium border-r border-white/20 text-primary-foreground',
                  isActive
                    ? 'bg-black hover:bg-black/90'
                    : 'bg-primary hover:bg-primary/90',
                  'pr-2'
                )}
              >
                {link.label}
                <button
                  onClick={(e) => closeTab(e, link)}
                  className="ml-2 rounded-sm p-0.5 hover:bg-white/20"
                  aria-label={`Close tab for ${link.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
