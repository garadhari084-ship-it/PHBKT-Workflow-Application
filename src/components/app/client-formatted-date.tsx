"use client";

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

type ClientFormattedDateProps = {
  date: string | Date;
  formatString: string;
};

export default function ClientFormattedDate({ date, formatString }: ClientFormattedDateProps) {
  const [formattedDate, setFormattedDate] = useState<string>('');

  useEffect(() => {
    if (date) {
        setFormattedDate(format(new Date(date), formatString));
    }
  }, [date, formatString]);

  return <>{formattedDate}</>;
}
