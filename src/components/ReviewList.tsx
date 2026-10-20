"use client";

import { useEffect, useState } from "react";
import { Star, ShieldCheck } from "lucide-react";

interface Review {
  id: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  isVerified: boolean;
  createdAt: string;
  userName: string;
}

interface ReviewListProps {
  productId: string;
}

export default function ReviewList({ productId }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReviews = async () => {
    try {
      const res = await fetch(`/api/products/${productId}/reviews`);
      const data = await res.json();
      if (res.ok) {
        setReviews(data.reviews || []);
        setAverageRating(data.averageRating || 0);
        setTotalReviews(data.totalReviews || 0);
      }
    } catch (error) {
      console.error("Failed to fetch reviews", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [productId]);

  // Expose refresh function via a key change pattern
  useEffect(() => {
    const handleRefresh = () => fetchReviews();
    window.addEventListener("reviewSubmitted", handleRefresh);
    return () => window.removeEventListener("reviewSubmitted", handleRefresh);
  }, []);

  if (isLoading) {
    return <div className="animate-pulse h-20 bg-gray-100 rounded-lg"></div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-ibuy-card rounded-lg border border-ibuy-border p-6">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-ibuy-orange">{averageRating.toFixed(1)}</div>
            <div className="flex items-center gap-0.5 mt-1 justify-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${
                    star <= Math.round(averageRating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-ibuy-text-secondary mt-1">{totalReviews} reviews</p>
          </div>
          <div className="flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = reviews.filter((r) => r.rating === star).length;
              const percent = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-xs text-ibuy-text w-3">{star}</span>
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-ibuy-orange" style={{ width: `${percent}%` }}></div>
                  </div>
                  <span className="text-xs text-ibuy-text-secondary w-8">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Review List */}
      {reviews.length === 0 ? (
        <div className="bg-ibuy-card rounded-lg border border-ibuy-border p-6 text-center">
          <p className="text-ibuy-text-secondary">No reviews yet. Be the first to review!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="bg-ibuy-card rounded-lg border border-ibuy-border p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-ibuy-text text-sm">{review.userName}</p>
                    {review.isVerified && (
                      <span className="flex items-center gap-1 text-[10px] text-ibuy-intelligence font-medium bg-ibuy-intelligence/10 px-1.5 py-0.5 rounded">
                        <ShieldCheck className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3 h-3 ${
                          star <= review.rating
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-xs text-ibuy-text-secondary">
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>
              {review.title && (
                <p className="font-medium text-ibuy-text text-sm mb-1">{review.title}</p>
              )}
              {review.comment && (
                <p className="text-sm text-ibuy-text-secondary">{review.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}