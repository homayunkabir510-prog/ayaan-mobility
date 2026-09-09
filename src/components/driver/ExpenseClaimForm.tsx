"use client";

import { useState } from "react";
import Card, { CardContent, CardHeader } from "@/components/shared/Card";
import Button from "@/components/shared/Button";
import Input from "@/components/shared/Input";
import { formatCurrency } from "@/lib/formatter";
import { Camera, Trash2 } from "lucide-react";

export interface ExpenseClaim {
  id: string;
  type: "TOLL" | "PARKING" | "OTHER";
  amount: number;
  receiptImg: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export interface ExpenseClaimFormProps {
  dutyLogId: string;
  existingClaims?: ExpenseClaim[];
  onSubmit?: (claims: ExpenseClaim[]) => void;
}

const ExpenseClaimForm = ({ existingClaims = [] }: ExpenseClaimFormProps) => {
  const [claims, setClaims] = useState<ExpenseClaim[]>(existingClaims);
  const [formData, setFormData] = useState({
    type: "TOLL" as "TOLL" | "PARKING" | "OTHER",
    amount: 0,
    receipt: "",
  });
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
        setFormData({ ...formData, receipt: file.name });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddClaim = () => {
    if (!formData.receipt || formData.amount <= 0) {
      return;
    }
    const newClaim: ExpenseClaim = {
      id: `temp-${Date.now()}`,
      type: formData.type,
      amount: formData.amount,
      receiptImg: formData.receipt,
      status: "PENDING",
    };
    setClaims([...claims, newClaim]);
    setFormData({ type: "TOLL", amount: 0, receipt: "" });
    setPreviewUrl("");
  };

  const handleRemoveClaim = (id: string) => {
    setClaims(claims.filter((c) => c.id !== id));
  };

  const totalClaimed = claims.reduce((sum, c) => sum + c.amount, 0);

  const typeLabels = {
    TOLL: "🛣️ Toll",
    PARKING: "🅿️ Parking",
    OTHER: "📌 Other",
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-bold">Add Expense Claim</h3>
          <p className="text-sm text-gray-600 mt-1">Document toll and parking expenses</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-900 block mb-2">Expense Type</label>
              <select
                value={formData.type}
                onChange={(e) => {
                  const type = e.target.value;
                  if (type === "TOLL" || type === "PARKING" || type === "OTHER") {
                    setFormData({ ...formData, type });
                  }
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="TOLL">Toll</option>
                <option value="PARKING">Parking</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <Input
              label="Amount (৳)"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              placeholder="0.00"
            />
          </div>

          {/* Photo Upload */}
          <div>
            <label className="text-sm font-medium text-gray-900 block mb-2">Receipt Photo *</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="hidden"
              id="receipt-input"
            />
            <label
              htmlFor="receipt-input"
              className="flex items-center justify-center w-full p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
            >
              {previewUrl ? (
                <div className="text-center">
                  <img src={previewUrl} alt="Receipt" className="max-h-24 mx-auto rounded" />
                  <p className="text-xs text-gray-600 mt-2">Click to change</p>
                </div>
              ) : (
                <div className="text-center">
                  <Camera className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-900">Upload Receipt</p>
                </div>
              )}
            </label>
          </div>

          <Button
            onClick={handleAddClaim}
            disabled={!formData.receipt || formData.amount <= 0}
            className="w-full"
          >
            Add Claim
          </Button>
        </CardContent>
      </Card>

      {/* Claims List */}
      {claims.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-bold">Submitted Claims</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {claims.map((claim) => (
              <div key={claim.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{typeLabels[claim.type]}</p>
                  <p className="text-sm text-gray-600">{formatCurrency(claim.amount)}</p>
                </div>
                <button
                  onClick={() => handleRemoveClaim(claim.id)}
                  className="text-red-600 hover:text-red-900 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <div className="border-t border-gray-200 pt-3 font-bold">
              <div className="flex justify-between text-gray-900">
                <span>Total Claimed</span>
                <span>{formatCurrency(totalClaimed)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ExpenseClaimForm;
