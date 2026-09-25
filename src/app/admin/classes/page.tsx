"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";

interface TrialClass {
  id: string;
  class_name: string;
  subject: string;
  start_time: string;
  end_time: string;
  location: string;
  max_seats: number;
  confirmed_count: number;
  seats_remaining: number;
}

export default function AdminClassesPage() {
  const [classes, setClasses] = useState<TrialClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClass, setNewClass] = useState({
    class_name: "",
    subject: "Math",
    start_time: "",
    end_time: "",
    location: "",
    max_seats: 10,
  });

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const response = await fetch("/api/trial-classes");
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch classes");
      }

      setClasses(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load classes");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/trial-classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClass),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to create class");
      }

      setShowCreateModal(false);
      setNewClass({
        class_name: "",
        subject: "Math",
        start_time: "",
        end_time: "",
        location: "",
        max_seats: 10,
      });
      fetchClasses();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create class");
    }
  };

  const handleDeleteClass = async (classId: string) => {
    if (!confirm("Are you sure you want to delete this class?")) {
      return;
    }

    try {
      const response = await fetch(`/api/trial-classes/${classId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to delete class");
      }

      fetchClasses();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete class");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-ottodot-blue border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading classes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Error Loading Classes
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchClasses}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">
            Class Management
          </h1>
          <div className="flex gap-3">
            <Button onClick={() => setShowCreateModal(true)}>
              Create New Class
            </Button>
            <Link href="/admin">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Seats
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {classes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No classes found
                    </td>
                  </tr>
                ) : (
                  classes.map((cls) => (
                    <tr key={cls.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {cls.class_name}
                        </div>
                        <div className="text-sm text-gray-500 font-mono">
                          {cls.id}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            cls.subject === "Math"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {cls.subject}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(cls.start_time).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(cls.start_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          -{" "}
                          {new Date(cls.end_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {cls.location || "TBD"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span
                            className={`text-sm font-medium ${
                              cls.seats_remaining === 0
                                ? "text-red-600"
                                : cls.seats_remaining <= 2
                                ? "text-yellow-600"
                                : "text-green-600"
                            }`}
                          >
                            {cls.confirmed_count}/{cls.max_seats}
                          </span>
                          <span className="text-sm text-gray-500 ml-2">
                            ({cls.seats_remaining} available)
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          href={`/roster?classId=${cls.id}`}
                          className="text-ottodot-blue hover:underline mr-4"
                        >
                          Roster
                        </Link>
                        <button
                          onClick={() => handleDeleteClass(cls.id)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Create New Class
              </h2>
              <form onSubmit={handleCreateClass} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Class Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newClass.class_name}
                    onChange={(e) =>
                      setNewClass({ ...newClass, class_name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ottodot-blue focus:border-transparent"
                    placeholder="e.g., Math Trial - Saturday"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject
                  </label>
                  <select
                    value={newClass.subject}
                    onChange={(e) =>
                      setNewClass({ ...newClass, subject: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ottodot-blue focus:border-transparent"
                  >
                    <option value="Math">Math</option>
                    <option value="Science">Science</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={newClass.start_time}
                      onChange={(e) =>
                        setNewClass({ ...newClass, start_time: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ottodot-blue focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={newClass.end_time}
                      onChange={(e) =>
                        setNewClass({ ...newClass, end_time: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ottodot-blue focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={newClass.location}
                    onChange={(e) =>
                      setNewClass({ ...newClass, location: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ottodot-blue focus:border-transparent"
                    placeholder="e.g., Zoom Room 1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Seats
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={newClass.max_seats}
                    onChange={(e) =>
                      setNewClass({
                        ...newClass,
                        max_seats: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-ottodot-blue focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="submit" className="flex-1">
                    Create Class
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
