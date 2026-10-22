 // src/components/product/ReviewSection.tsx
"use client";

import { useState, useEffect } from "react";
import { Star, Send, CheckCircle2 } from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";

interface Review {
  id: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  isVerified: boolean;
  createdAt: string;
  user: {
    firstName: string;
    lastName: string;
    image?: string | null;
  };
}

export default function ReviewSection({ productSlug, orderId }: { productSlug: string, orderId?: string }) {
  const { data: session } = useSession();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/products/${productSlug}/reviews`)
      .then(res => res.json())
      .then(data => {
        setReviews(data.reviews);
        setAvgRating(data.avgRating);
      });
  }, [productSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return alert("Please log in to review.");
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productSlug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, title, comment, orderId }),
      });
      
      if (res.ok) {
        setTitle("");
        setComment("");
        setRating(5);
        // Refresh reviews
        const data = await (await fetch(`/api/products/${productSlug}/reviews`)).json();
        setReviews(data.reviews);
        setAvgRating(data.avgRating);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to submit review");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-16 border-t border-gray-200 pt-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Customer Reviews</h3>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-5 h-5 ${i < Math.round(avgRating) ? "fill-current" : "text-gray-300"}`} />
              ))}
            </div>
            <span className="text-sm font-medium text-gray-900">{avgRating} out of 5</span>
            <span className="text-sm text-gray-500">({reviews.length} reviews)</span>
          </div>
        </div>
      </div>

      {/* Review Form */}
      {session && !reviews.find(r => r.user.firstName === session.user?.firstName && r.productId) && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-6 rounded-xl mb-10 border border-gray-100">
          <h4 className="font-semibold text-gray-900 mb-4">Share your thoughts</h4>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Your Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setRating(star)} className="focus:outline-none">
                  <Star className={`w-8 h-8 transition-colors ${star <= rating ? "text-yellow-400 fill-current" : "text-gray-300 hover:text-yellow-200"}`} />
                </button>
              ))}
            </div>
          </div>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your review a title"
            className="w-full p-3 border border-gray-200 rounded-lg mb-3 focus:ring-2 focus:ring-green-500 outline-none bg-white"
          />
          
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What did you like or dislike? How was the quality?"
            className="w-full p-3 border border-gray-200 rounded-lg mb-4 focus:ring-2 focus:ring-green-500 outline-none bg-white"
            rows={4}
          />
          
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2 transition-colors"
          >
            <Send className="w-4 h-4" /> {isSubmitting ? "Submitting..." : "Submit Review"}
          </button>
        </form>
      )}

      {/* Reviews List */}
      <div className="space-y-8">
        {reviews.length === 0 ? (
          <p className="text-gray-500 italic">No reviews yet. Be the first to share your experience!</p>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="border-b border-gray-100 pb-8 last:border-0">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  {review.user.image ? (
                    <Image src={review.user.image} alt="" width={40} height={40} className="rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold">
                      {review.user.firstName[0]}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{review.user.firstName} {review.user.lastName}</p>
                    {review.isVerified && (
                      <div className="flex items-center gap-1 text-xs text-green-600 font-medium mt-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Verified Buyer
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString()}</span>
              </div>
              
              <div className="flex text-yellow-400 mb-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < review.rating ? "fill-current" : "text-gray-300"}`} />
                ))}
              </div>
              
              {review.title && <h5 className="font-bold text-gray-900 mb-1">{review.title}</h5>}
              <p className="text-gray-600 leading-relaxed">{review.comment}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}