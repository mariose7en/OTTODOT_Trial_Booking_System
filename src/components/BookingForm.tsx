"use client";

import { useState } from "react";
import { Button } from "./Button";

export interface BookingFormData {
  parent_first_name: string;
  parent_last_name: string;
  parent_email: string;
  parent_residential_id: string;
  student_first_name: string;
  student_last_name: string;
  student_residential_id: string;
}

export interface BookingFormProps {
  onSubmit: (data: BookingFormData) => void;
  isLoading?: boolean;
}

export function BookingForm({ onSubmit, isLoading = false }: BookingFormProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<BookingFormData>({
    parent_first_name: "",
    parent_last_name: "",
    parent_email: "",
    parent_residential_id: "",
    student_first_name: "",
    student_last_name: "",
    student_residential_id: "",
  });

  const updateField = (field: keyof BookingFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value.toUpperCase() }));
  };

  const isStep1Valid =
    formData.parent_first_name &&
    formData.parent_last_name &&
    formData.parent_email &&
    formData.parent_residential_id;

  const isStep2Valid =
    formData.student_first_name &&
    formData.student_last_name &&
    formData.student_residential_id;

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-center mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                step >= s
                  ? "bg-ottodot-blue text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={`w-20 h-1 ${
                  step > s ? "bg-ottodot-blue" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {step === 1 && "Parent Information"}
          {step === 2 && "Student Information"}
          {step === 3 && "Review & Confirm"}
        </h2>
        <p className="text-gray-600 mt-1">
          {step === 1 && "Enter parent details"}
          {step === 2 && "Enter student details"}
          {step === 3 && "Review your booking"}
        </p>
      </div>

      {step === 1 && (
        <div className="card-playful space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={formData.parent_first_name}
                onChange={(e) => updateField("parent_first_name", e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ottodot-blue focus:border-transparent"
                placeholder="ALICE"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={formData.parent_last_name}
                onChange={(e) => updateField("parent_last_name", e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ottodot-blue focus:border-transparent"
                placeholder="LEE"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.parent_email}
              onChange={(e) => updateField("parent_email", e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ottodot-blue focus:border-transparent"
              placeholder="alice@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Residential ID
            </label>
            <input
              type="text"
              value={formData.parent_residential_id}
              onChange={(e) =>
                updateField("parent_residential_id", e.target.value)
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ottodot-blue focus:border-transparent"
              placeholder="RES123"
            />
          </div>
          <div className="flex justify-end pt-4">
            <Button
              onClick={() => setStep(2)}
              disabled={!isStep1Valid}
              className="btn-ottodot btn-ottodot-blue"
            >
              Next Step
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card-playful space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Student First Name
              </label>
              <input
                type="text"
                value={formData.student_first_name}
                onChange={(e) =>
                  updateField("student_first_name", e.target.value)
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ottodot-blue focus:border-transparent"
                placeholder="CHARLIE"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Student Last Name
              </label>
              <input
                type="text"
                value={formData.student_last_name}
                onChange={(e) =>
                  updateField("student_last_name", e.target.value)
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ottodot-blue focus:border-transparent"
                placeholder="LEE"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Student Residential ID
            </label>
            <input
              type="text"
              value={formData.student_residential_id}
              onChange={(e) =>
                updateField("student_residential_id", e.target.value)
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ottodot-blue focus:border-transparent"
              placeholder="RES789"
            />
          </div>
          <div className="flex justify-between pt-4">
            <Button onClick={() => setStep(1)} variant="secondary">
              Back
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!isStep2Valid}
              className="btn-ottodot btn-ottodot-blue"
            >
              Next Step
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card-playful">
          <div className="space-y-4">
            <div className="border-b pb-4">
              <h3 className="font-semibold text-gray-900 mb-2">Parent</h3>
              <p className="text-gray-600">
                {formData.parent_first_name} {formData.parent_last_name}
              </p>
              <p className="text-sm text-gray-500">{formData.parent_email}</p>
            </div>

            <div className="border-b pb-4">
              <h3 className="font-semibold text-gray-900 mb-2">Student</h3>
              <p className="text-gray-600">
                {formData.student_first_name} {formData.student_last_name}
              </p>
            </div>

            <div className="bg-ottodot-blue/5 p-4 rounded-lg">
              <p className="text-sm text-gray-600">
                By proceeding, you agree to book a trial class. Payment will be
                required to confirm the booking.
              </p>
            </div>
          </div>

          <div className="flex justify-between pt-6">
            <Button onClick={() => setStep(2)} variant="secondary">
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={isLoading}
              className="btn-ottodot btn-ottodot-yellow"
            >
              Proceed to Payment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
