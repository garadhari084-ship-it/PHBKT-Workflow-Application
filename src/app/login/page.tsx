'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import LoginForm from '@/components/app/login-form';
import { Logo } from '@/components/app/logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function LoginPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || user) {
    return (
      <main className="flex flex-1 items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <Card className="shadow-xl">
          <CardHeader className="text-center space-y-1">
            <div className="mx-auto mb-2">
              <Logo />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              PHBKT Group Limited
            </CardTitle>
            <CardDescription>
              WorkFlow Management System
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
