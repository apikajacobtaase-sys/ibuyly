 // src/components/DailyFeedbackPopup.tsx
"use client";

import { useState, useEffect } from "react";
import { X, Star, MessageSquare } from "lucide-react";

export default function DailyFeedbackPopup() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const lastFeedback = localStorage.getItem("ibuy_last_feedback");
    const today = new Date().toDateString();

    if (lastFeedback !== today) {
      const timer = setTimeout(() => setIsVisible(true), 5000); // Show after 5 seconds
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem("ibuy_last_feedback", new Date().toDateString());
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 animate-in slide-in-from-bottom-10 fade-in duration-300 md:bottom-8">
      <button onClick={handleClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-green-100 rounded-full">
          <MessageSquare className="w-5 h-5 text-green-600" />
        </div>
        <h3 className="font-bold text-gray-900">How is your experience?</h3>
      </div>

      <p className="text-sm text-gray-600 mb-4">Help us make iBUY better for everyone in Ghana.</p>

      <div className="flex justify-between gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} onClick={handleClose} className="flex-1 py-2 hover:bg-gray-50 rounded-lg transition-colors group">
            <Star className="w-6 h-6 mx-auto text-gray-300 group-hover:text-yellow-400 group-hover:fill-yellow-400 transition-all" />
          </button>
        ))}
      </div>
    </div>
  );
}