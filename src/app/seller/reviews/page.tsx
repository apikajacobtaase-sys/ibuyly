// src/app/seller/reviews/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Star, MessageSquare, Loader2, CheckCircle } from "lucide-react";

interface Review {
  id: string;
  rating: number;
  comment?: string;
  isVerified: boolean;
  sellerResponse?: string;
  respondedAt?: string;
  createdAt: string;
  buyerName: string;
}

export default function SellerReviewsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [ratingDistribution, setRatingDistribution] = useState<Record<number, number>>({
    5: 0, 4: 0, 3: 0, 2: 0, 1: 0,
  });
  const [loading, setLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/seller/reviews");
    }
    if (status === "authenticated") {
      fetchReviews();
    }
  }, [status, router]);

  const fetchReviews = async () => {
    try {
      const res = await fetch("/api/seller/reviews");
      const data = await res.json();
      if (res.ok) {
        setReviews(data.reviews);
        setTotalReviews(data.totalReviews);
        setAverageRating(data.averageRating);
        setRatingDistribution(data.ratingDistribution);
      }
    } catch (error) {
      console.error("Failed to fetch reviews", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (reviewId: string) => {
    if (!responseText.trim()) return;

    try {
      const res = await fetch("/api/seller/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, response: responseText }),
      });

      if (res.ok) {
        setReviews((prev) =>
          prev.map((r) =>
            r.id === reviewId
              ? { ...r, sellerResponse: responseText, respondedAt: new Date().toISOString() }
              : r
          )
        );
        setRespondingTo(null);
        setResponseText("");
        alert("Response submitted successfully!");
      }
    } catch (error) {
      console.error("Failed to respond", error);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"
        }`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
          Customer Reviews
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          See what customers are saying about your store
        </p>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Average Rating */}
          <div className="text-center">
            <p className="text-5xl font-bold text-gray-900">{averageRating.toFixed(1)}</p>
            <div className="flex justify-center mt-2">{renderStars(Math.round(averageRating))}</div>
            <p className="text-sm text-gray-500 mt-2">
              Based on {totalReviews} review{totalReviews !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Rating Distribution */}
          <div className="md:col-span-2 space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = ratingDistribution[star] || 0;
              const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-12">
                    <span className="text-sm font-medium text-gray-700">{star}</span>
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  </div>
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No reviews yet</h3>
          <p className="text-gray-500 mt-1">
            Customer reviews will appear here once you receive your first order.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white rounded-xl border border-gray-200 p-6">
              {/* Review Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{review.buyerName}</p>
                    {review.isVerified && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                        <CheckCircle className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex">{renderStars(review.rating)}</div>
                    <span className="text-xs text-gray-500">
                      {new Date(review.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Review Comment */}
              {review.comment && (
                <p className="text-sm text-gray-700 mb-4">{review.comment}</p>
              )}

              {/* Seller Response */}
              {review.sellerResponse ? (
                <div className="mt-4 pl-4 border-l-2 border-indigo-200 bg-indigo-50/50 rounded-r-lg p-3">
                  <p className="text-xs font-semibold text-indigo-700 mb-1">Your Response</p>
                  <p className="text-sm text-gray-700">{review.sellerResponse}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Responded on{" "}
                    {new Date(review.respondedAt!).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              ) : (
                <div className="mt-4">
                  {respondingTo === review.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        placeholder="Write your response..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRespond(review.id)}
                          disabled={!responseText.trim()}
                          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Submit Response
                        </button>
                        <button
                          onClick={() => {
                            setRespondingTo(null);
                            setResponseText("");
                          }}
                          className="px-4 py-2 text-gray-600 text-sm font-medium hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRespondingTo(review.id)}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                    >
                      Respond to this review
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}