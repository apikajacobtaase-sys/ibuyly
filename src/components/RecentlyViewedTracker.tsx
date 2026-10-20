"use client";

import { useEffect } from "react";
import { useRecentlyViewedStore } from "@/store/recentlyViewedStore";

interface TrackerProps {
  id: string;
  title: string;
  slug: string;
  imageUrl?: string | null;
  price: number;
}

export default function RecentlyViewedTracker({ id, title, slug, imageUrl, price }: TrackerProps) {
  const addView = useRecentlyViewedStore((state) => state.addView);

  useEffect(() => {
    addView({ id, title, slug, imageUrl, price });
  }, [id, title, slug, imageUrl, price, addView]);

  return null;
}