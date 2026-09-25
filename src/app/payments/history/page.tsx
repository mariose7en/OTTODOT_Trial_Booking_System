"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";

interface PaymentRecord {
  id: string;
  booking_id: string;
  status: string;
  txn_id: string;
  created_at: string;
  bookings: {
    trial_classes: {
      class_name: string;
      subject: string;
    };
  };
}

export default function PaymentHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
      return;
    }

    if (user) {
      fetchPayments();
    }
  }, [user, authLoading]);

  const fetchPayments = async () => {
    try {
      const response = await fetch(`/api/payments/history?user_id=${user?.id}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch payments");
      }

      setPayments(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-ottodot-blue border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading payment history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Error Loading Payments
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchPayments}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
          <Link href="/bookings">
            <Button variant="outline">Book New Class</Button>
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {payments.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No payments yet
              </h3>
              <p className="text-gray-600 mb-6">
                You haven&apos;t made any payments yet. Book a trial class to get
                started!
              </p>
              <Link href="/bookings">
                <Button>Browse Classes</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Class
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transaction ID
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(payment.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {payment.bookings?.trial_classes?.class_name || "N/A"}
                        </div>
                        <div className="text-sm text-gray-500">
                          {payment.bookings?.trial_classes?.subject || ""}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        $20.00
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={payment.status as any} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {payment.txn_id?.substring(0, 16) || "N/A"}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
