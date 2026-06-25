'use client';

import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

export const Logo = () => {
    const firestore = useFirestore();

    const configRef = useMemoFirebase(() => {
        if (!firestore) {
            return null;
        }
        return doc(firestore, 'app_config/main');
    }, [firestore]);

    const { data: config, isLoading } = useDoc<{logoUrl: string}>(configRef);
    const logoUrl = config?.logoUrl;
    
    if (isLoading) {
        return <Skeleton className="h-16 w-48" />;
    }

    if (logoUrl) {
        return <img src={logoUrl} alt="App Logo" className="h-16 w-auto" />;
    }

    return (
        <div className="flex flex-col items-start">
            <div className="flex items-stretch gap-2 text-foreground">
                <svg viewBox="0 0 100 100" className="h-16 w-auto">
                    <path d="M 50,50 L 50,5 A 45,45 0 0 1 88.97,27.5 Z" fill="#c04343"/>
                    <path d="M 50,50 L 88.97,27.5 A 45,45 0 0 1 88.97,72.5 Z" fill="#a52a2a"/>
                    <path d="M 50,50 L 88.97,72.5 A 45,45 0 0 1 50,95 Z" fill="#6f0000"/>
                    <path d="M 50,50 L 50,95 A 45,45 0 0 1 11.03,72.5 Z" fill="#d46a6a"/>
                    <path d="M 50,50 L 11.03,72.5 A 45,45 0 0 1 11.03,27.5 Z" fill="#8a1111"/>
                    <path d="M 50,50 L 11.03,27.5 A 45,45 0 0 1 50,5 Z" fill="#540000"/>
                </svg>
                <div className="flex flex-col font-bold leading-tight text-base">
                    <span>PHBKT</span>
                    <span>Group</span>
                    <span>Limited</span>
                </div>
            </div>
            <div className="h-0.5 w-full bg-primary mt-1" />
        </div>
    );
};
