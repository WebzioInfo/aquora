import React from 'react';
import {
  PremiumInput,
  PremiumSelect,
  PremiumSectionHeading
} from '../../../components/ui/PremiumForms';

interface GeneralTabProps {
  formData: any;
  handleFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ formData, handleFormChange }) => {
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <PremiumSectionHeading title="General Partner Information" />
      
      <div className="grid grid-cols-2 gap-5">
        <PremiumSelect
          label="Partner Type *"
          name="customerType"
          value={formData.customerType}
          onChange={handleFormChange}
          required
        >
          <option value="B2C">B2C (Individual / Retail)</option>
          <option value="B2B">B2B (Business / Corporate)</option>
          <option value="Distributor">Distributor / Logistics</option>
        </PremiumSelect>

        <PremiumInput
          label="Partner Name *"
          name="customerName"
          value={formData.customerName}
          onChange={handleFormChange}
          placeholder="e.g. John Doe / Apex Distributors"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <PremiumInput
          label="Contact Person Name"
          name="contactPerson"
          value={formData.contactPerson}
          onChange={handleFormChange}
          placeholder="e.g. Vance R."
        />
        <PremiumInput
          label="Business Name"
          name="businessName"
          value={formData.businessName}
          onChange={handleFormChange}
          placeholder={formData.customerType === 'B2B' ? 'Required business name' : 'Optional'}
          required={formData.customerType === 'B2B'}
        />
      </div>

      <div className="grid grid-cols-3 gap-5">
        <PremiumInput
          label="Primary Phone *"
          name="phone"
          value={formData.phone}
          onChange={handleFormChange}
          placeholder="e.g. +91 9999999999"
          required
        />
        <PremiumInput
          label="WhatsApp Phone"
          name="whatsApp"
          value={formData.whatsApp}
          onChange={handleFormChange}
          placeholder="WhatsApp Number"
        />
        <PremiumInput
          label="Alternate Phone"
          name="alternatePhone"
          value={formData.alternatePhone}
          onChange={handleFormChange}
          placeholder="Optional alternate"
        />
      </div>

      <div className="grid grid-cols-1 gap-5">
        <PremiumInput
          label="Email Address"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleFormChange}
          placeholder="e.g. name@domain.com"
        />
      </div>

      {formData.customerType === 'Distributor' && (
        <div className="pt-4 mt-6 border-t border-gray-100">
          <PremiumSectionHeading title="Distributor Information" />
          <div className="grid grid-cols-2 gap-5 mt-4">
            <PremiumSelect
              label="Distributor Type"
              name="distributorType"
              value={formData.distributorType}
              onChange={handleFormChange}
            >
              <option value="">-- Select Type --</option>
              <option value="Company Distributor">Company Distributor</option>
              <option value="Commission Distributor">Commission Distributor</option>
              <option value="Salary Distributor">Salary Distributor</option>
            </PremiumSelect>
            
            {formData.distributorType === 'Commission Distributor' && (
              <PremiumInput
                label="Commission Percentage"
                name="commissionPercentage"
                type="number"
                value={formData.commissionPercentage}
                onChange={handleFormChange}
              />
            )}
            {formData.distributorType === 'Salary Distributor' && (
              <PremiumInput
                label="Monthly Salary"
                name="monthlySalary"
                type="number"
                value={formData.monthlySalary}
                onChange={handleFormChange}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-5 mt-4">
            <PremiumInput
              label="Route Name"
              name="assignedRoute"
              value={formData.assignedRoute}
              onChange={handleFormChange}
              placeholder="Optional route"
            />
            <PremiumInput
              label="Remarks"
              name="remarks"
              value={formData.remarks}
              onChange={handleFormChange}
              placeholder="Optional remarks"
            />
          </div>
        </div>
      )}
    </div>
  );
};
