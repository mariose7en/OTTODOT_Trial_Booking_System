"use client";

import { useState } from "react";
import { Button } from "./Button";

export interface MockPaymentFormProps {
  amount: string;
  onPaymentResult: (result: "SUCCESS" | "FAILED") => void;
  isLoading?: boolean;
}

export function MockPaymentForm({
  amount,
  onPaymentResult,
  isLoading = false,
}: MockPaymentFormProps) {
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    setIsProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsProcessing(false);
    onPaymentResult(simulateFailure ? "FAILED" : "SUCCESS");
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="card-playful">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-ottodot-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-ottodot-green"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Mock Payment</h2>
          <p className="text-gray-600 mt-1">Simulated payment for demo</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Trial Class Fee</span>
            <span className="text-2xl font-bold text-gray-900">{amount}</span>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Card Number
            </label>
            <input
              type="text"
              value="4242 4242 4242 4242"
              readOnly
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiry
              </label>
              <input
                type="text"
                value="12/28"
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CVC
              </label>
              <input
                type="text"
                value="123"
                readOnly
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="simulate-failure"
              checked={simulateFailure}
              onChange={(e) => setSimulateFailure(e.target.checked)}
              className="w-4 h-4 text-ottodot-yellow rounded focus:ring-ottodot-yellow"
            />
            <label htmlFor="simulate-failure" className="text-sm text-yellow-800">
              Simulate payment failure (for demo)
            </label>
          </div>
        </div>

        <Button
          onClick={handlePayment}
          isLoading={isLoading || isProcessing}
          className="w-full btn-ottodot btn-ottodot-green py-3"
        >
          {isProcessing ? "Processing..." : `Pay ${amount}`}
        </Button>

        <p className="text-xs text-gray-500 text-center mt-4">
          This is a mock payment for demonstration purposes only.
        </p>
      </div>
    </div>
  );
}
