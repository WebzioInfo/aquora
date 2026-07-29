import React from 'react';
import {
  PremiumInput,
  PremiumSelect,
  PremiumSectionHeading
} from '../../../components/ui/PremiumForms';

interface AddressTabProps {
  formData: any;
  handleFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  indianStates: string[];
}

export const AddressTab: React.FC<AddressTabProps> = ({ formData, handleFormChange, indianStates }) => {
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <PremiumSectionHeading title="Primary Billing & Shipping Address" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <PremiumInput
          label="Address Line 1 *"
          name="addressLine1"
          value={formData.addressLine1}
          onChange={handleFormChange}
          placeholder="Building, street name"
          required
        />
        <PremiumInput
          label="Address Line 2"
          name="addressLine2"
          value={formData.addressLine2}
          onChange={handleFormChange}
          placeholder="Area, landmark"
        />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <PremiumInput
          label="District *"
          name="district"
          value={formData.district}
          onChange={handleFormChange}
          placeholder="District Name"
          required
        />
        <PremiumSelect
          label="State *"
          name="state"
          value={formData.state}
          onChange={handleFormChange}
          required
        >
          <option value="">Select State</option>
          {indianStates.map(state => (
            <option key={state} value={state}>{state}</option>
          ))}
        </PremiumSelect>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <PremiumInput
          label="Country *"
          name="country"
          value={formData.country}
          onChange={handleFormChange}
          required
        />
        <PremiumInput
          label="PIN/Zip Code *"
          name="pinCode"
          value={formData.pinCode}
          onChange={handleFormChange}
          placeholder="6-digit PIN"
          required
        />
      </div>
    </div>
  );
};
