// src/components/DeliveryEligibilityBanner.tsx
"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle, XCircle, Truck, Clock, Loader2 } from "lucide-react";

interface DeliveryEligibilityBannerProps {
  localityId: string | null;
  orderTotal: number;
  onEligibilityChange?: (result: DeliveryEligibility | null) => void;
}

export interface DeliveryEligibility {
  eligible: boolean;
  status?: "ACTIVE" | "RESTRICTED";
  reason?: "UNAVAILABLE" | "MINIMUM_ORDER";
  message: string;
  deliveryFee?: number;
  codEnabled?: boolean;
  onlinePayEnabled?: boolean;
  estimatedDays?: number;
  minOrderValue?: number;
  zoneName?: string;
}

export default function DeliveryEligibilityBanner({
  localityId,
  orderTotal,
  onEligibilityChange,
}: DeliveryEligibilityBannerProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeliveryEligibility | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!localityId) {
      setResult(null);
      onEligibilityChange?.(null);
      return;
    }

    const checkEligibility = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/delivery/eligibility", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ localityId, orderTotal }),
        });
        const data = await res.json();
        
        if (res.ok) {
          setResult(data);
          onEligibilityChange?.(data);
        } else {
          setError(data.error || "Failed to check delivery");
          setResult(null);
          onEligibilityChange?.(null);
        }
      } catch (err) {
        setError("Network error. Please try again.");
        setResult(null);
        onEligibilityChange?.(null);
      } finally {
        setLoading(false);
      }
    };

    checkEligibility();
  }, [localityId, orderTotal, onEligibilityChange]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
        <Loader2 className="w-5 h-5 text-indigo-600 animate-spin flex-shrink-0" />
        <p className="text-sm text-indigo-900 font-medium">Checking delivery availability...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-900">{error}</p>
      </div>
    );
  }

  // No address selected yet
  if (!result) {
    return null;
  }

  // State A: Delivery Available
  if (result.eligible && result.status === "ACTIVE") {
    return (
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-emerald-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-900">
              Great news! We deliver to your area.
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-emerald-800">
              {result.deliveryFee !== undefined && (
                <span className="flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5" />
                  Delivery: <strong>GH₵ {result.deliveryFee.toFixed(2)}</strong>
                </span>
              )}
              {result.estimatedDays && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {result.estimatedDays} day{result.estimatedDays > 1 ? "s" : ""} delivery
                </span>
              )}
              {result.codEnabled && (
                <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded font-medium">
                  Cash on Delivery available
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State B: Restricted (but still deliverable)
  if (result.eligible && result.status === "RESTRICTED") {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              Delivery to this area is currently limited.
            </p>
            <p className="mt-1 text-xs text-amber-800">
              {result.message} Online payment only.
            </p>
            {result.deliveryFee !== undefined && (
              <p className="mt-2 text-xs font-medium text-amber-900">
                Delivery fee: GH₵ {result.deliveryFee.toFixed(2)}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // State C: Minimum order not met
  if (!result.eligible && result.reason === "MINIMUM_ORDER") {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              Minimum order required for this area
            </p>
            <p className="mt-1 text-xs text-amber-800">
              {result.message} Add more items to your cart to proceed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // State D: Unavailable
  if (!result.eligible && result.reason === "UNAVAILABLE") {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center">
            <XCircle className="w-5 h-5 text-rose-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-rose-900">
              We haven't started delivering to this area yet.
            </p>
            <p className="mt-1 text-xs text-rose-800">
              {result.message}
            </p>
                           <button
              type="button"
              className="mt-3 text-xs font-medium text-rose-700 underline hover:text-rose-900 transition-colors"
              onClick={async () => {
                // We need to fetch the region and district IDs for this locality
                // For simplicity, we'll pass the localityId and let the backend infer, 
                // OR we can fetch it. Let's do a quick fetch to get the full hierarchy.
                try {
                  // Note: In a real app, you'd pass regionId/districtId from the address object.
                  // Since we only have localityId here, we'll assume the backend can handle it, 
                  // or we fetch the locality details first.
                  const res = await fetch("/api/delivery/coverage-requests", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                      // We will update the API to accept just localityId and resolve the rest, 
                      // OR we pass what we have. Let's update the API to be more flexible.
                      localityId: localityId 
                    }),
                  });
                  
                  if (res.ok) {
                    alert("Thank you! We've received your request and will consider expanding delivery to this area.");
                  } else {
                    alert("Failed to submit request. Please try again.");
                  }
                } catch (error) {
                  alert("Failed to submit request. Please try again.");
                }
              }}
            >
              Request delivery to my area →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}