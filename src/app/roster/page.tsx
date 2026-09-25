"use client";

import { useEffect, useState } from "react";
import { RosterResponse, TrialClassWithSeats, ApiResponse } from "@/types/booking";
import { RosterTable } from "@/components/RosterTable";

export default function RosterPage() {
  const [trialClasses, setTrialClasses] = useState<TrialClassWithSeats[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [roster, setRoster] = useState<RosterResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrialClasses();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchRoster(selectedClassId);
    }
  }, [selectedClassId]);

  const fetchTrialClasses = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/trial-classes");
      const result: ApiResponse<TrialClassWithSeats[]> = await response.json();

      if (result.success && result.data) {
        setTrialClasses(result.data);
        if (result.data.length > 0) {
          setSelectedClassId(result.data[0].id);
        }
      } else {
        setError(result.error || "Failed to load classes");
      }
    } catch (err) {
      setError("Failed to load trial classes");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoster = async (classId: string) => {
    try {
      setIsLoadingRoster(true);
      const response = await fetch(`/api/roster/${classId}`);
      const result: ApiResponse<RosterResponse> = await response.json();

      if (result.success && result.data) {
        setRoster(result.data);
      } else {
        setError(result.error || "Failed to load roster");
      }
    } catch (err) {
      setError("Failed to load roster");
    } finally {
      setIsLoadingRoster(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 font-heading">
            Class Roster
          </h1>
          <p className="text-gray-600">
            View confirmed students for each trial class.
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
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Class
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ottodot-blue focus:border-transparent text-lg"
              >
                {trialClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.class_name} - {cls.seats_remaining} seats remaining
                  </option>
                ))}
              </select>
            </div>

            {isLoadingRoster ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-ottodot-blue border-t-transparent"></div>
                <p className="mt-4 text-gray-600">Loading roster...</p>
              </div>
            ) : roster ? (
              <RosterTable roster={roster} />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
