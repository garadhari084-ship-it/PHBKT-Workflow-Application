'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import AppHeader from '@/components/app/header';
import SubHeader from '@/components/app/sub-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return (
        <div className="flex flex-col h-screen">
            <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex h-20 items-center justify-between px-4">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-12 w-48" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-8 w-32" />
                    </div>
                </div>
            </header>
            <div className="border-b-[1px] border-primary sticky top-20 z-40 bg-background">
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
    <div className="flex h-screen flex-col">
      <AppHeader />
      <SubHeader />
      <main className="flex-1 bg-background flex flex-col min-h-0">{children}</main>
    </div>
  );
}
