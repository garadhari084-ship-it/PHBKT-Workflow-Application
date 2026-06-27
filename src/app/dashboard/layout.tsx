'use client';

import { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useUser } from '@/firebase';
import AppHeader from '@/components/app/header';
import SubHeader from '@/components/app/sub-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLayout() {
  const { user, isUserLoading } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isUserLoading && !user) {
      navigate('/login');
    }
  }, [user, isUserLoading, navigate]);

  if (isUserLoading || !user) {
    return (
        <div className="flex flex-col h-screen overflow-hidden w-full">
            <header className="flex-shrink-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex h-16 md:h-20 items-center justify-between pl-0 pr-2 md:pr-4">
                    <div className="flex items-center gap-2 md:gap-4">
                        <Skeleton className="h-10 md:h-12 w-32 md:w-48" />
                    </div>
                    <div className="flex items-center gap-1 md:gap-2">
                        <Skeleton className="h-8 w-20 md:w-24" />
                        <Skeleton className="h-8 w-8 md:w-32" />
                    </div>
                </div>
            </header>
            <div className="flex-shrink-0 border-b-[1px] border-primary z-40 bg-background">
                <div className="flex items-end h-9">
                    <Skeleton className="h-full w-20" />
                    <Skeleton className="h-full w-20" />
                    <Skeleton className="h-full w-20" />
                    <Skeleton className="h-full w-20" />
                </div>
            </div>
            <main className="flex-1 p-4">
                <Skeleton className="h-full w-full" />
            </main>
        </div>
    );
  }

  return (
    <div className="flex h-screen flex-col w-full overflow-hidden">
      <AppHeader />
      <SubHeader />
      <main className="flex-1 bg-background flex flex-col min-h-0 overflow-y-auto"><Outlet /></main>
    </div>
  );
}
