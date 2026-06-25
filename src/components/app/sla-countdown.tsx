"use client";

import { useState, useEffect } from 'react';
import { formatDistanceToNowStrict, isPast } from 'date-fns';
import { cn } from '@/lib/utils';

type SlaCountdownProps = {
  slaDueDate: string;
};

export default function SlaCountdown({ slaDueDate }: SlaCountdownProps) {
  const [countdown, setCountdown] = useState('');
  const [isBreached, setIsBreached] = useState(false);

  useEffect(() => {
    const dueDate = new Date(slaDueDate);
    let interval: ReturnType<typeof setInterval>;

    const updateCountdown = () => {
      if (isPast(dueDate)) {
        setCountdown('Breached');
        setIsBreached(true);
        if (interval) clearInterval(interval);
      } else {
        setCountdown(formatDistanceToNowStrict(dueDate, { addSuffix: true }));
        setIsBreached(false);
      }
    };
    
    updateCountdown();
    interval = setInterval(updateCountdown, 1000 * 60); // Update every minute

    return () => clearInterval(interval);
  }, [slaDueDate]);

  const isAboutToExpire = !isBreached && new Date(slaDueDate).getTime() - new Date().getTime() < 60 * 60 * 1000; // Less than 1 hour

  return (
    <span className={cn(
        "font-medium",
        isBreached && "text-destructive",
        isAboutToExpire && "text-amber-600",
    )}>
      {countdown}
    </span>
  );
}
