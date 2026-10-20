 // src/components/checkout/DeliveryAddressForm.tsx
"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";

interface Region { id: string; name: string; }
interface District { id: string; name: string; }
interface Locality { id: string; name: string; }

interface DeliveryQuote {
  isServiceable: boolean;
  deliveryFee?: number;
  minOrderValue?: number | null;
  minOrderMet?: boolean;
  estimatedDays?: number | null;
  message?: string;
  canRequestCoverage?: boolean;
}

interface DeliveryAddressFormProps {
  cartSubtotal: number;
  onAddressChange: (addressData: any, quote: DeliveryQuote | null) => void;
}

export default function DeliveryAddressForm({ cartSubtotal, onAddressChange }: DeliveryAddressFormProps) {
  // 👇 THESE STORE THE EXACT DATABASE IDs
  const [regionId, setRegionId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [localityId, setLocalityId] = useState("");
  
  const [landmark, setLandmark] = useState("");
  const [street, setStreet] = useState("");
  const [instructions, setInstructions] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [phone, setPhone] = useState("");

  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [localities, setLocalities] = useState<Locality[]>([]);
  
  const [isLoadingRegions, setIsLoadingRegions] = useState(true);
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(false);
  const [isLoadingLocalities, setIsLoadingLocalities] = useState(false);
  
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);

  // 1. Fetch Regions from Database on mount
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const res = await fetch("/api/locations/regions");
        const data = await res.json();
        setRegions(data.regions || []); 
      } catch (err) { console.error("Failed to fetch regions", err); } 
      finally { setIsLoadingRegions(false); }
    };
    fetchRegions();
  }, []);

  // 2. Fetch Districts from Database when Region changes
  useEffect(() => {
    if (!regionId) { setDistricts([]); setDistrictId(""); return; }
    const fetchDistricts = async () => {
      setIsLoadingDistricts(true); setDistrictId(""); setLocalities([]); setLocalityId(""); setQuote(null);
      try {
        const res = await fetch(`/api/locations/districts?regionId=${regionId}`);
        const data = await res.json();
        setDistricts(data.districts || []); 
      } catch (err) { console.error("Failed to fetch districts", err); } 
      finally { setIsLoadingDistricts(false); }
    };
    fetchDistricts();
  }, [regionId]);

  // 3. Fetch Localities from Database when District changes
  useEffect(() => {
    if (!districtId) { setLocalities([]); setLocalityId(""); return; }
    const fetchLocalities = async () => {
      setIsLoadingLocalities(true); setLocalityId(""); setQuote(null);
      try {
        const res = await fetch(`/api/locations/localities?districtId=${districtId}`);
        const data = await res.json();
        setLocalities(data.localities || []); 
      } catch (err) { console.error("Failed to fetch localities", err); } 
      finally { setIsLoadingLocalities(false); }
    };
    fetchLocalities();
  }, [districtId]);

  // 4. Fetch Delivery Quote from Database when Locality changes
  useEffect(() => {
    if (!localityId) return; // Wait until a valid database ID is selected

    const fetchQuote = async () => {
      setIsFetchingQuote(true);
      try {
        console.log("📍 Sending to API - localityId:", localityId, "subtotal:", cartSubtotal);
        const res = await fetch("/api/delivery/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // 👇 THIS SENDS THE EXACT DATABASE ID TO THE BACKEND
          body: JSON.stringify({ 
            localityId: localityId, 
            subtotal: cartSubtotal 
          }),
        });
        const data = await res.json();
        setQuote(data);
        
        const selectedRegion = regions.find(r => r.id === regionId);
        const selectedLocality = localities.find(l => l.id === localityId);
        
        onAddressChange({ 
          regionId, districtId, localityId, 
          regionName: selectedRegion?.name || "",
          localityName: selectedLocality?.name || "",
          landmark, street, instructions, recipientName, phone 
        }, data);
      } catch (err) { console.error("Failed to fetch quote", err); } 
      finally { setIsFetchingQuote(false); }
    };

    const debounce = setTimeout(fetchQuote, 500);
    return () => clearTimeout(debounce);
  }, [localityId, cartSubtotal]); // Triggers when the database ID changes

  const handleManualChange = () => {
    const selectedRegion = regions.find(r => r.id === regionId);
    const selectedLocality = localities.find(l => l.id === localityId);
    onAddressChange({ 
      regionId, districtId, localityId,
      regionName: selectedRegion?.name || "",
      localityName: selectedLocality?.name || "",
      landmark, street, instructions, recipientName, phone 
    }, quote);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Where should we deliver?</h2>
        <p className="text-sm text-gray-500 mb-4">Choose your location to check delivery availability and fees.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Country (Locked to Ghana) */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
          <input type="text" value="Ghana" disabled className="w-full px-3 py-2.5 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-600 cursor-not-allowed" />
        </div>

        {/* Region */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Region *</label>
          <select value={regionId} onChange={(e) => setRegionId(e.target.value)} className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
            <option value="">Select Region</option>
            {isLoadingRegions ? <option>Loading...</option> : regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        {/* District */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">District *</label>
          <select value={districtId} onChange={(e) => setDistrictId(e.target.value)} disabled={!regionId} className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none disabled:bg-gray-50 disabled:text-gray-400">
            <option value="">Select District</option>
            {isLoadingDistricts ? <option>Loading...</option> : districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        {/* Locality */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Town / Locality *</label>
          <select 
            value={localityId} 
            onChange={(e) => {
              console.log("📍 User selected locality Database ID:", e.target.value);
              setLocalityId(e.target.value);
            }}
            disabled={!districtId}
            className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">Select Town or Locality</option>
            {isLoadingLocalities ? (
              <option>Loading...</option>
            ) : (
              localities.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Delivery Quote Result */}
      {isFetchingQuote && (
        <div className="flex items-center gap-2 text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking delivery availability...
        </div>
      )}

      {quote && !isFetchingQuote && (
        <div className={`p-4 rounded-lg border ${quote.isServiceable ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          {quote.isServiceable ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-700 font-semibold">
                <CheckCircle className="w-5 h-5" /> Great news! iBUY delivers to this location.
              </div>
              <div className="text-sm text-gray-700 space-y-1">
                <p>🚚 <strong>Estimated Delivery Fee:</strong> GH₵ {quote.deliveryFee?.toFixed(2)}</p>
                {quote.estimatedDays && <p>⏱️ <strong>Estimated Time:</strong> {quote.estimatedDays} days</p>}
                {!quote.minOrderMet && quote.minOrderValue && (
                  <p className="text-red-600 font-medium flex items-center gap-1 mt-2">
                    <AlertTriangle className="w-4 h-4" /> Minimum order of GH₵ {quote.minOrderValue.toFixed(2)} required.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-red-700 font-semibold">
                <AlertTriangle className="w-5 h-5" /> Delivery Unavailable
              </div>
              <p className="text-sm text-gray-700">{quote.message || "We do not currently deliver to this area."}</p>
            </div>
          )}
        </div>
      )}

      {/* Specific Delivery Details */}
      <div className={`space-y-4 pt-4 border-t border-gray-200 ${!quote?.isServiceable ? "opacity-50 pointer-events-none" : ""}`}>
        <h3 className="text-sm font-semibold text-gray-900">Specific Delivery Instructions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name *</label>
            <input required value={recipientName} onChange={(e) => { setRecipientName(e.target.value); handleManualChange(); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
            <input required type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); handleManualChange(); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Landmark *</label>
            <input value={landmark} onChange={(e) => { setLandmark(e.target.value); handleManualChange(); }} placeholder="e.g., Near University of Energy" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">House / Street Details *</label>
            <input required value={street} onChange={(e) => { setStreet(e.target.value); handleManualChange(); }} placeholder="e.g., House No. 4, Mango Street" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Directions (Optional)</label>
            <textarea value={instructions} onChange={(e) => { setInstructions(e.target.value); handleManualChange(); }} rows={2} placeholder="Any extra info for the rider..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none" />
          </div>
        </div>
      </div>
    </div>
  );
}