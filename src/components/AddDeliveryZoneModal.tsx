 // src/components/AddDeliveryZoneModal.tsx
"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Search, Check } from "lucide-react";

interface Locality {
  id: string;
  name: string;
}

interface DeliveryZone {
  id: string;
  name: string;
  status: string;
  baseDeliveryFee: number;
  minOrderValue: number | null;
  codEnabled: boolean;
  estimatedDays: number | null;
  localities: { locality: { id: string } }[];
}

interface AddDeliveryZoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: DeliveryZone | null;
}

export default function AddDeliveryZoneModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  initialData = null 
}: AddDeliveryZoneModalProps) {
  const [loading, setLoading] = useState(false);
  
  // Location Data State
  const [regions, setRegions] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [localities, setLocalities] = useState<Locality[]>([]);
  
  // Selection State
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedLocalities, setSelectedLocalities] = useState<string[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    status: "ACTIVE",
    baseDeliveryFee: "",
    minOrderValue: "",
    codEnabled: true,
    onlinePayEnabled: true,
    estimatedDays: "",
  });

  const isEditing = !!initialData;

  // 1. Fetch Regions & Pre-fill Form when Modal Opens
  useEffect(() => {
    if (isOpen) {
      fetch('/api/admin/locations/regions')
        .then(res => res.json())
        .then(data => setRegions(data))
        .catch(err => console.error("Failed to fetch regions", err));

      if (initialData) {
        setFormData({
          name: initialData.name || "",
          status: initialData.status || "ACTIVE",
          baseDeliveryFee: initialData.baseDeliveryFee?.toString() || "",
          minOrderValue: initialData.minOrderValue?.toString() || "",
          codEnabled: initialData.codEnabled ?? true,
          onlinePayEnabled: true,
          estimatedDays: initialData.estimatedDays?.toString() || "",
        });
        
        // Note: Pre-selecting localities in a cascading dropdown is complex.
        // For now, we reset selections on edit to keep it simple, or you can 
        // implement logic to find the Region/District of the pre-selected localities.
        setSelectedLocalities(initialData.localities.map(l => l.locality.id));
      } else {
        setFormData({ name: "", status: "ACTIVE", baseDeliveryFee: "", minOrderValue: "", codEnabled: true, onlinePayEnabled: true, estimatedDays: "" });
        setSelectedLocalities([]);
        setSelectedRegion("");
        setSelectedDistrict("");
        setDistricts([]);
        setLocalities([]);
      }
    }
  }, [isOpen, initialData]);

  // 2. Fetch Districts when Region Changes
  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const regionId = e.target.value;
    setSelectedRegion(regionId);
    setSelectedDistrict("");
    setLocalities([]);
    setSelectedLocalities([]); // Reset localities when region changes

    if (regionId) {
      fetch(`/api/admin/locations/districts?regionId=${regionId}`)
        .then(res => res.json())
        .then(data => setDistricts(data));
    } else {
      setDistricts([]);
    }
  };

  // 3. Fetch Localities when District Changes
  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const districtId = e.target.value;
    setSelectedDistrict(districtId);
    setSelectedLocalities([]); // Reset localities when district changes

    if (districtId) {
      fetch(`/api/admin/locations/localities?districtId=${districtId}`)
        .then(res => res.json())
        .then(data => setLocalities(data));
    } else {
      setLocalities([]);
    }
  };

  const toggleLocality = (id: string) => {
    setSelectedLocalities((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLocalities.length === 0) {
      alert("Please select at least one locality.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        baseDeliveryFee: parseFloat(formData.baseDeliveryFee),
        minOrderValue: formData.minOrderValue ? parseFloat(formData.minOrderValue) : null,
        estimatedDays: formData.estimatedDays ? parseInt(formData.estimatedDays) : null,
        localityIds: selectedLocalities,
        zoneId: initialData?.id, // Required for PATCH
      };

      const res = await fetch("/api/admin/delivery/zones", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to save zone");
      }
    } catch (error) {
      alert("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <h2 className="text-xl font-bold text-gray-900">
            {isEditing ? "Edit Delivery Zone" : "Add Delivery Zone"}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Zone Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zone Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., Accra Metro Express"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="RESTRICTED">Restricted</option>
              </select>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base Fee (GH₵)</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.baseDeliveryFee}
                onChange={(e) => setFormData({ ...formData, baseDeliveryFee: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Order (GH₵)</label>
              <input
                type="number"
                step="0.01"
                value={formData.minOrderValue}
                onChange={(e) => setFormData({ ...formData, minOrderValue: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Est. Days</label>
              <input
                type="number"
                value={formData.estimatedDays}
                onChange={(e) => setFormData({ ...formData, estimatedDays: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          {/* Location Hierarchy */}
          <div className="space-y-4 bg-gray-50 p-4 rounded-lg border">
            <h3 className="font-semibold text-gray-900">Select Coverage Area</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                <select
                  value={selectedRegion}
                  onChange={handleRegionChange}
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="">Select a Region</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                <select
                  value={selectedDistrict}
                  onChange={handleDistrictChange}
                  disabled={!selectedRegion}
                  className="w-full px-3 py-2 border rounded-lg bg-white disabled:bg-gray-100"
                >
                  <option value="">Select a District</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Localities Checkboxes */}
            {localities.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Localities</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto border p-2 rounded bg-white">
                  {localities.map((loc) => (
                    <label key={loc.id} className="flex items-center space-x-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedLocalities.includes(loc.id)}
                        onChange={() => toggleLocality(loc.id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{loc.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || selectedLocalities.length === 0}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditing ? "Update Zone" : "Create Zone"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}