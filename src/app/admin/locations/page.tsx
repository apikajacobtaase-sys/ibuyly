// src/app/admin/locations/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { MapPin, Loader2, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface District {
  id: string;
  name: string;
  status: string;
}

interface Region {
  id: string;
  name: string;
  status: string;
  districts: District[];
}

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { value: "TEMPORARILY_UNAVAILABLE", label: "Temporarily Unavailable", color: "text-amber-700 bg-amber-50 border-amber-200" },
  { value: "INACTIVE", label: "Inactive", color: "text-gray-700 bg-gray-50 border-gray-200" },
];

export default function AdminLocationsPage() {
  const router = useRouter();
  const { status } = useSession();
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?callbackUrl=/admin/locations");
    if (status === "authenticated") fetchLocations();
  }, [status, router]);

  const fetchLocations = async () => {
    try {
      const res = await fetch("/api/admin/locations");
      const data = await res.json();
      if (res.ok) setRegions(data.regions);
    } catch (error) {
      console.error("Network error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, type: "REGION" | "DISTRICT", newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch("/api/admin/locations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type, status: newStatus }),
      });

      if (res.ok) {
        // Optimistically update the UI
        setRegions((prev) =>
          prev.map((region) => {
            if (region.id === id) return { ...region, status: newStatus };
            return {
              ...region,
              districts: region.districts.map((d) =>
                d.id === id ? { ...d, status: newStatus } : d
              ),
            };
          })
        );
      } else {
        alert("Failed to update status");
        fetchLocations(); // Revert on failure
      }
    } catch (error) {
      alert("Network error");
      fetchLocations();
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === "ACTIVE") return <CheckCircle className="w-3.5 h-3.5" />;
    if (status === "TEMPORARILY_UNAVAILABLE") return <AlertTriangle className="w-3.5 h-3.5" />;
    return <XCircle className="w-3.5 h-3.5" />;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-slate-800 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
          <MapPin className="w-7 h-7" />
          Location Management
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Control delivery availability by region and district. Paused locations will block checkout.
        </p>
      </div>

      <div className="space-y-4">
        {regions.map((region) => (
          <div key={region.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Region Header */}
            <div className="p-4 sm:p-5 bg-gray-50/50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">{region.name} Region</h3>
                  <p className="text-xs text-gray-500">{region.districts.length} Districts</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Region Status:</span>
                <select
                  value={region.status}
                  onChange={(e) => handleStatusChange(region.id, "REGION", e.target.value)}
                  disabled={updatingId === region.id}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 ${
                    STATUS_OPTIONS.find((opt) => opt.value === region.status)?.color
                  }`}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Districts List */}
            <div className="divide-y divide-gray-100">
              {region.districts.map((district) => (
                <div key={district.id} className="p-4 sm:px-5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-gray-100 text-gray-500 flex items-center justify-center">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">{district.name} District</span>
                  </div>

                  <div className="flex items-center gap-3 sm:ml-auto">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:inline">Status:</span>
                    <select
                      value={district.status}
                      onChange={(e) => handleStatusChange(district.id, "DISTRICT", e.target.value)}
                      disabled={updatingId === district.id}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 flex items-center gap-1 ${
                        STATUS_OPTIONS.find((opt) => opt.value === district.status)?.color
                      }`}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="flex items-center gap-1">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}