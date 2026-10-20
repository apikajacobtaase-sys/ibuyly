"use client";

import { useState, useEffect } from "react";

interface FlashSaleTimerProps {
  endDate: string | Date; // ISO date string or Date object
  onComplete?: () => void;
}

export default function FlashSaleTimer({ endDate, onComplete }: FlashSaleTimerProps) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const end = new Date(endDate).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        onComplete?.();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [endDate, onComplete]);

  if (isExpired) {
    return (
      <div className="flex items-center gap-1 text-sm font-medium text-gray-500">
        <span>Sale Ended</span>
      </div>
    );
  }

  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className="flex items-center gap-1 text-sm font-medium text-ibuy-error">
      <span className="hidden sm:inline">Ends in:</span>
      <span className="bg-ibuy-error text-white px-1.5 py-0.5 rounded text-xs font-bold">{pad(timeLeft.hours)}</span>
      <span>:</span>
      <span className="bg-ibuy-error text-white px-1.5 py-0.5 rounded text-xs font-bold">{pad(timeLeft.minutes)}</span>
      <span>:</span>
      <span className="bg-ibuy-error text-white px-1.5 py-0.5 rounded text-xs font-bold">{pad(timeLeft.seconds)}</span>
    </div>
  );
}