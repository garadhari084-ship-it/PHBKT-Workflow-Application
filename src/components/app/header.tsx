"use client";

import { Link } from 'react-router-dom';
import { User as UserIcon, PlusCircle, LogOut, Settings, UserCircle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/app/logo';
import { useNavigate } from 'react-router-dom';
import type { WorkItemTab } from '@/lib/types';
import { useAuth, useUser } from '@/firebase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AppHeader() {
  const navigate = useNavigate();
  const auth = useAuth();
  const { user } = useUser();

  const userName = (user?.firstName && user?.lastName)
    ? `${user.firstName} ${user.lastName}`
    : user?.displayName || user?.email || "User";
  const pageTitle = "WorkFlow Management Application";

  const handleNewWorkClick = () => {
    const newWorkTab: WorkItemTab = {
      href: '/dashboard/new-work',
      label: 'New Work',
    };

    let openTabs: WorkItemTab[] = [];
    try {
      const openTabsString = localStorage.getItem('openWorkItemTabs');
      if (openTabsString) {
        openTabs = JSON.parse(openTabsString);
      }
    } catch (e) {
      console.error('Could not parse open work item tabs', e);
    }
    
    if (!openTabs.find(tab => tab.href === newWorkTab.href)) {
      openTabs.push(newWorkTab);
      localStorage.setItem('openWorkItemTabs', JSON.stringify(openTabs));
      window.dispatchEvent(new CustomEvent('tabs-update'));
    }

    navigate(newWorkTab.href);
  };

  const handleSignOut = async () => {
    await auth.signOut();
    // The dashboard layout will handle the redirect.
  };


  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 md:h-20 items-center justify-between px-2 md:px-4">
        <div className="flex items-center gap-1 md:gap-4 overflow-hidden min-w-0 mr-1 md:mr-2">
            <Link to="/dashboard" className="flex-shrink-0">
                <Logo />
            </Link>
            <div className="flex flex-col items-start gap-0 min-w-0 overflow-hidden">
                <h1 className="text-xs md:text-lg font-semibold text-primary tracking-wider truncate w-full">{pageTitle}</h1>
                <p className="text-[10px] md:text-base text-black font-bold truncate w-full">{userName}<span className="hidden md:inline"> - Home Page</span></p>
            </div>
        </div>

        <div className="flex items-center justify-end gap-0.5 md:gap-1 flex-shrink-0">
          <Button 
                variant="default" 
                className="h-7 px-2 text-[10px] md:text-xs bg-black hover:bg-black/90 text-primary-foreground rounded-sm font-normal"
                onClick={handleNewWorkClick}
            >
                <PlusCircle className="md:mr-2 h-3 w-3" /> <span className="hidden md:inline">New Work</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" className="h-7 px-2 text-[10px] md:text-xs bg-black hover:bg-black/90 text-primary-foreground rounded-sm font-normal">
                    <UserIcon className="md:mr-2 h-3 w-3" />
                    <span className="font-normal hidden md:inline">{userName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <UserCircle className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  <span>Help & Support</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
