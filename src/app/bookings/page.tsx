"use client";

import { useEffect, useState } from "react";
import { TrialClassWithSeats, ApiResponse } from "@/types/booking";
import { TrialClassCard } from "@/components/TrialClassCard";

export default function BookingsPage() {
  const [trialClasses, setTrialClasses] = useState<TrialClassWithSeats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrialClasses();
  }, []);

  const fetchTrialClasses = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/trial-classes");
      const result: ApiResponse<TrialClassWithSeats[]> = await response.json();

      if (result.success && result.data) {
        setTrialClasses(result.data);
      } else {
        setError(result.error || "Failed to load classes");
      }
    } catch (err) {
      setError("Failed to load trial classes");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 font-heading">
            Book a Trial Class
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Choose from our available trial classes. Book now to secure your
            spot!
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-ottodot-blue border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Loading classes...</p>
          </div>
        ) : error ? (
          <div className="card-playful text-center py-12">
            <p className="text-ottodot-red mb-4">{error}</p>
            <button
              onClick={fetchTrialClasses}
              className="btn-ottodot btn-ottodot-blue"
            >
              Try Again
            </button>
          </div>
        ) : trialClasses.length === 0 ? (
          <div className="card-playful text-center py-12">
            <p className="text-gray-600">No trial classes available at the moment.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trialClasses.map((trialClass) => (
              <TrialClassCard key={trialClass.id} trialClass={trialClass} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
