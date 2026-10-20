// src/components/LocationSelector.tsx
"use client";

import { useEffect, useState } from "react";

interface Region { id: string; name: string; code: string; }
interface District { id: string; name: string; code: string; }
interface Locality { id: string; name: string; }

interface LocationSelectorProps {
  onLocationChange: (regionId: string, districtId: string, localityId: string) => void;
  initialRegionId?: string;
  initialDistrictId?: string;
  initialLocalityId?: string;
  isLoading?: boolean;
}

export default function LocationSelector({ 
  onLocationChange, 
  initialRegionId, 
  initialDistrictId, 
  initialLocalityId,
  isLoading = false
}: LocationSelectorProps) {
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [localities, setLocalities] = useState<Locality[]>([]);
  
  const [selectedRegion, setSelectedRegion] = useState(initialRegionId || "");
  const [selectedDistrict, setSelectedDistrict] = useState(initialDistrictId || "");
  const [selectedLocality, setSelectedLocality] = useState(initialLocalityId || "");

  const [loadingRegions, setLoadingRegions] = useState(true);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingLocalities, setLoadingLocalities] = useState(false);

  // Fetch regions on mount
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const res = await fetch("/api/locations/regions");
        const data = await res.json();
        if (res.ok) setRegions(data.regions);
      } catch (error) {
        console.error("Failed to fetch regions", error);
      } finally {
        setLoadingRegions(false);
      }
    };
    fetchRegions();
  }, []);

  // Fetch districts when region changes
  useEffect(() => {
    if (!selectedRegion) {
      setDistricts([]);
      setLocalities([]);
      setSelectedDistrict("");
      setSelectedLocality("");
      return;
    }

    const fetchDistricts = async () => {
      setLoadingDistricts(true);
      try {
        const res = await fetch(`/api/locations/districts?regionId=${selectedRegion}`);
        const data = await res.json();
        if (res.ok) setDistricts(data.districts);
      } catch (error) {
        console.error("Failed to fetch districts", error);
      } finally {
        setLoadingDistricts(false);
      }
    };
    fetchDistricts();
  }, [selectedRegion]);

  // Fetch localities when district changes
  useEffect(() => {
    if (!selectedDistrict) {
      setLocalities([]);
      setSelectedLocality("");
      return;
    }

    const fetchLocalities = async () => {
      setLoadingLocalities(true);
      try {
        const res = await fetch(`/api/locations/localities?districtId=${selectedDistrict}`);
        const data = await res.json();
        if (res.ok) setLocalities(data.localities);
      } catch (error) {
        console.error("Failed to fetch localities", error);
      } finally {
        setLoadingLocalities(false);
      }
    };
    fetchLocalities();
  }, [selectedDistrict]);

  // Notify parent of changes
  useEffect(() => {
    if (selectedRegion && selectedDistrict && selectedLocality) {
      onLocationChange(selectedRegion, selectedDistrict, selectedLocality);
    }
  }, [selectedRegion, selectedDistrict, selectedLocality, onLocationChange]);

  // Base input classes for mobile-first, accessible, premium feel
  const selectClass = `w-full min-h-[48px] px-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors disabled:bg-gray-100 disabled:text-gray-400 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`;

  return (
    <div className="space-y-4">
      {/* Region */}
      <div>
        <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1.5">
          Region <span className="text-red-500">*</span>
        </label>
        <select
          id="region"
          name="regionId"
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          disabled={loadingRegions || isLoading}
          className={selectClass}
          required
        >
          <option value="">Select Region</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* District */}
      <div>
        <label htmlFor="district" className="block text-sm font-medium text-gray-700 mb-1.5">
          District / Municipality <span className="text-red-500">*</span>
        </label>
        <select
          id="district"
          name="districtId"
          value={selectedDistrict}
          onChange={(e) => setSelectedDistrict(e.target.value)}
          disabled={!selectedRegion || loadingDistricts || isLoading}
          className={selectClass}
          required
        >
          <option value="">
            {!selectedRegion ? "Select Region First" : loadingDistricts ? "Loading..." : "Select District"}
          </option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Locality */}
      <div>
        <label htmlFor="locality" className="block text-sm font-medium text-gray-700 mb-1.5">
          Town / Community <span className="text-red-500">*</span>
        </label>
        <select
          id="locality"
          name="localityId"
          value={selectedLocality}
          onChange={(e) => setSelectedLocality(e.target.value)}
          disabled={!selectedDistrict || loadingLocalities || isLoading}
          className={selectClass}
          required
        >
          <option value="">
            {!selectedDistrict ? "Select District First" : loadingLocalities ? "Loading..." : "Select Town/Community"}
          </option>
          {localities.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}