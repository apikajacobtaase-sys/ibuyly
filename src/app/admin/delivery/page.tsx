// src/app/admin/delivery/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AddDeliveryZoneModal from "@/components/AddDeliveryZoneModal";

import { 
  MapPin, Package, AlertTriangle, CheckCircle, XCircle, 
  Clock, Plus, Loader2, ChevronDown, ChevronUp, Edit // 👈 Added Edit icon
} from "lucide-react";

interface Locality {
  id: string;
  name: string;
  district: { name: string; region: { name: string } };
}

interface DeliveryZone {
  id: string;
  name: string;
  status: string;
  baseDeliveryFee: number;
  minOrderValue: number | null;
  codEnabled: boolean;
  estimatedDays: number | null;
  localities: { locality: Locality }[];
}

interface CoverageRequest {
  id: string;
  region: { name: string };
  district: { name: string };
  locality: { name: string } | null;
  status: string;
  requestCount: number;
  lastRequestedAt: string;
  notes: string | null;
}

export default function AdminDeliveryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"zones" | "requests">("zones");
  const [showAddZoneModal, setShowAddZoneModal] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null); // 👈 Track zone being edited
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [requests, setRequests] = useState<CoverageRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/admin/delivery");
    }
    if (status === "authenticated") {
      fetchData();
    }
  }, [status, router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [zonesRes, requestsRes] = await Promise.all([
        fetch("/api/admin/delivery/zones"),
        fetch("/api/admin/delivery/requests"),
      ]);
      
      if (zonesRes.ok) {
        const zonesData = await zonesRes.json();
        const processedZones = zonesData.zones.map((zone: any) => ({
          ...zone,
          baseDeliveryFee: Number(zone.baseDeliveryFee),
          minOrderValue: zone.minOrderValue ? Number(zone.minOrderValue) : null,
        }));
        setZones(processedZones);
      }
      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        setRequests(requestsData.requests);
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
      RESTRICTED: "bg-amber-100 text-amber-800 border-amber-200",
      INACTIVE: "bg-gray-100 text-gray-800 border-gray-200",
      TEMPORARILY_UNAVAILABLE: "bg-rose-100 text-rose-800 border-rose-200",
      NEW: "bg-blue-100 text-blue-800 border-blue-200",
      UNDER_REVIEW: "bg-purple-100 text-purple-800 border-purple-200",
      PLANNED: "bg-indigo-100 text-indigo-800 border-indigo-200",
      APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
      REJECTED: "bg-rose-100 text-rose-800 border-rose-200",
      COVERED: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return styles[status] || styles.INACTIVE;
  };

  const updateRequestStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch("/api/admin/delivery/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        fetchData();
        alert("Status updated successfully");
      }
    } catch (error) {
      alert("Failed to update status");
    }
  };

  // 👇 Handle opening the modal in Edit mode
  const handleEditZone = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setShowAddZoneModal(true);
  };

  // 👇 Handle closing the modal and resetting the edit state
  const handleModalClose = () => {
    setShowAddZoneModal(false);
    setEditingZone(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery & Logistics</h1>
          <p className="text-sm text-gray-500 mt-1">Manage delivery zones, pricing, and coverage requests.</p>
        </div>
        <button 
          onClick={() => {
            setEditingZone(null); // Ensure we are in "Add" mode
            setShowAddZoneModal(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Delivery Zone
        </button>
      </div>

      {/* Add/Edit Zone Modal */}
      <AddDeliveryZoneModal
        isOpen={showAddZoneModal}
        onClose={handleModalClose}
        onSuccess={fetchData}
        initialData={editingZone} // 👈 Pass the zone data if editing
      />

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("zones")}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === "zones"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <MapPin className="w-4 h-4" />
            Delivery Zones ({zones.length})
          </button>
          <button
            onClick={() => setActiveTab("requests")}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === "requests"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Package className="w-4 h-4" />
            Coverage Requests ({requests.length})
          </button>
        </nav>
      </div>

      {/* Zones Tab */}
      {activeTab === "zones" && (
        <div className="space-y-4">
          {zones.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No delivery zones yet</h3>
              <p className="text-gray-500 mt-1">Create your first delivery zone to start serving customers.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {zones.map((zone) => (
                // 👇 Added 'relative group' for the hover edit button
                <div key={zone.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative group">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 line-clamp-1 pr-8">{zone.name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(zone.status)}`}>
                      {zone.status.replace("_", " ")}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex justify-between">
                      <span>Delivery Fee:</span>
                      <span className="font-medium text-gray-900">GH₵ {zone.baseDeliveryFee.toFixed(2)}</span>
                    </div>
                    {zone.minOrderValue !== null && (
                      <div className="flex justify-between">
                        <span>Min. Order:</span>
                        <span className="font-medium text-gray-900">GH₵ {zone.minOrderValue.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Cash on Delivery:</span>
                      <span className={zone.codEnabled ? "text-emerald-600 font-medium" : "text-gray-400"}>
                        {zone.codEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Covered Areas ({zone.localities.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {zone.localities.slice(0, 5).map((loc) => (
                        <span key={loc.locality.id} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md truncate max-w-full">
                          {loc.locality.name}, {loc.locality.district.name}
                        </span>
                      ))}
                      {zone.localities.length > 5 && (
                        <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-md font-medium">
                          +{zone.localities.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 👇 Edit Button (Visible on Hover) */}
                  <button
                    onClick={() => handleEditZone(zone)}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Edit Zone"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Requests Tab (Unchanged) */}
      {activeTab === "requests" && (
        <div className="space-y-4">
          {requests.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No coverage requests</h3>
              <p className="text-gray-500 mt-1">Customers haven't requested delivery to new areas yet.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <div className="col-span-3">Location</div>
                <div className="col-span-2">Requests</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-3">Last Requested</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              <div className="divide-y divide-gray-100">
                {requests.map((req) => (
                  <div key={req.id} className="p-4 md:px-6 md:py-4 hover:bg-gray-50 transition-colors">
                    <div className="md:hidden space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{req.locality?.name || req.district.name}</p>
                          <p className="text-xs text-gray-500">{req.district.name}, {req.region.name}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(req.status)}`}>
                          {req.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{req.requestCount} request{req.requestCount > 1 ? "s" : ""}</span>
                        <span className="text-gray-500 text-xs">{new Date(req.lastRequestedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex gap-2 pt-2 border-t">
                        <select 
                          value={req.status}
                          onChange={(e) => updateRequestStatus(req.id, e.target.value)}
                          className="flex-1 text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3"
                        >
                          <option value="NEW">New</option>
                          <option value="UNDER_REVIEW">Under Review</option>
                          <option value="PLANNED">Planned</option>
                          <option value="APPROVED">Approved</option>
                          <option value="REJECTED">Rejected</option>
                          <option value="COVERED">Covered</option>
                        </select>
                      </div>
                    </div>

                    <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-3">
                        <p className="font-medium text-gray-900">{req.locality?.name || "Entire District"}</p>
                        <p className="text-xs text-gray-500">{req.district.name}, {req.region.name}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {req.requestCount}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(req.status)}`}>
                          {req.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="col-span-3 text-sm text-gray-500">
                        {new Date(req.lastRequestedAt).toLocaleDateString()}
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <select 
                          value={req.status}
                          onChange={(e) => updateRequestStatus(req.id, e.target.value)}
                          className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-1.5 px-3"
                        >
                          <option value="NEW">New</option>
                          <option value="UNDER_REVIEW">Under Review</option>
                          <option value="PLANNED">Planned</option>
                          <option value="APPROVED">Approved</option>
                          <option value="REJECTED">Rejected</option>
                          <option value="COVERED">Covered</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}