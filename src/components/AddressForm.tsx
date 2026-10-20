// src/components/AddressForm.tsx
"use client";

import { useState } from "react";
import LocationSelector from "./LocationSelector";

interface AddressFormProps {
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  isLoading?: boolean;
  onCancel?: () => void;
}

export default function AddressForm({ onSubmit, initialData, isLoading = false, onCancel }: AddressFormProps) {
  const [locationData, setLocationData] = useState({
    regionId: initialData?.regionId || "",
    districtId: initialData?.districtId || "",
    localityId: initialData?.localityId || "",
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    // Merge location IDs into the form data
    const payload = {
      ...data,
      regionId: locationData.regionId,
      districtId: locationData.districtId,
      localityId: locationData.localityId,
      countryId: "ghana", // Default to Ghana
      isDefault: data.isDefault === "on",
    };

    await onSubmit(payload);
  };

  const inputClass = "w-full min-h-[48px] px-4 py-3 text-base bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors placeholder:text-gray-400";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section 1: Recipient Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Recipient Details</h3>
        
        <div>
          <label htmlFor="recipientName" className={labelClass}>Full Name <span className="text-red-500">*</span></label>
          <input type="text" id="recipientName" name="recipientName" defaultValue={initialData?.recipientName} required className={inputClass} placeholder="e.g., Kwame Mensah" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className={labelClass}>Phone Number <span className="text-red-500">*</span></label>
            <input type="tel" id="phone" name="phone" defaultValue={initialData?.phone} required className={inputClass} placeholder="e.g., 024 123 4567" pattern="[0-9\s\-+]{10,15}" />
          </div>
          <div>
            <label htmlFor="alternativePhone" className={labelClass}>Alternative Phone <span className="text-gray-400 font-normal">(Optional)</span></label>
            <input type="tel" id="alternativePhone" name="alternativePhone" defaultValue={initialData?.alternativePhone} className={inputClass} placeholder="e.g., 050 987 6543" pattern="[0-9\s\-+]{10,15}" />
          </div>
        </div>
      </div>

      {/* Section 2: Location */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Delivery Location</h3>
        <LocationSelector 
          onLocationChange={(regionId, districtId, localityId) => setLocationData({ regionId, districtId, localityId })}
          initialRegionId={locationData.regionId}
          initialDistrictId={locationData.districtId}
          initialLocalityId={locationData.localityId}
          isLoading={isLoading}
        />
      </div>

      {/* Section 3: Specific Delivery Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Specific Delivery Details</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="neighbourhood" className={labelClass}>Area / Neighbourhood <span className="text-red-500">*</span></label>
            <input type="text" id="neighbourhood" name="neighbourhood" defaultValue={initialData?.neighbourhood} required className={inputClass} placeholder="e.g., East Legon" />
          </div>
          <div>
            <label htmlFor="houseNumber" className={labelClass}>House Number / Building <span className="text-gray-400 font-normal">(Optional)</span></label>
            <input type="text" id="houseNumber" name="houseNumber" defaultValue={initialData?.houseNumber} className={inputClass} placeholder="e.g., House 12, Block B" />
          </div>
        </div>

        <div>
          <label htmlFor="street" className={labelClass}>Street Name <span className="text-gray-400 font-normal">(Optional)</span></label>
          <input type="text" id="street" name="street" defaultValue={initialData?.street} className={inputClass} placeholder="e.g., Liberation Road" />
        </div>

        <div>
          <label htmlFor="landmark" className={labelClass}>Recognizable Landmark <span className="text-gray-400 font-normal">(Optional)</span></label>
          <input type="text" id="landmark" name="landmark" defaultValue={initialData?.landmark} className={inputClass} placeholder="e.g., Near the main junction or blue gate" />
        </div>

        <div>
          <label htmlFor="deliveryInstructions" className={labelClass}>Delivery Instructions <span className="text-gray-400 font-normal">(Optional)</span></label>
          <textarea 
            id="deliveryInstructions" 
            name="deliveryInstructions" 
            defaultValue={initialData?.deliveryInstructions} 
            rows={3} 
            className={`${inputClass} resize-none`} 
            placeholder="e.g., Call when you arrive, leave with the security guard" 
          />
        </div>
      </div>

      {/* Section 4: Save Options */}
      <div className="flex items-center space-x-3 pt-2">
        <input 
          type="checkbox" 
          id="isDefault" 
          name="isDefault" 
          defaultChecked={initialData?.isDefault}
          className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
        />
        <label htmlFor="isDefault" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
          Set as my default delivery address
        </label>
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t">
        {onCancel && (
          <button 
            type="button" 
            onClick={onCancel}
            disabled={isLoading}
            className="w-full sm:w-auto px-6 py-3 text-base font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        )}
        <button 
          type="submit" 
          disabled={isLoading || !locationData.localityId}
          className="w-full sm:w-auto px-6 py-3 text-base font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </>
          ) : (
            initialData ? "Update Address" : "Save Delivery Address"
          )}
        </button>
      </div>
    </form>
  );
}