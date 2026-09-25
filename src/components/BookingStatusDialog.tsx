"use client";

import { BookingStatus } from "@/types/booking";
import { Button } from "./Button";
import Link from "next/link";

export interface BookingStatusDialogProps {
  isOpen: boolean;
  status: BookingStatus;
  bookingId: string;
  className?: string;
  studentName?: string;
  onClose: () => void;
}

const statusConfig: Record<
  BookingStatus,
  {
    title: string;
    message: string;
    icon: string;
    bgColor: string;
    iconColor: string;
  }
> = {
  [BookingStatus.PendingPayment]: {
    title: "Booking Created!",
    message: "Please complete payment to confirm your booking.",
    icon: "⏳",
    bgColor: "bg-yellow-50",
    iconColor: "text-yellow-600",
  },
  [BookingStatus.Confirmed]: {
    title: "Booking Confirmed!",
    message: "Your trial class has been successfully booked.",
    icon: "🎉",
    bgColor: "bg-green-50",
    iconColor: "text-green-600",
  },
  [BookingStatus.PaymentFailed]: {
    title: "Payment Failed",
    message: "There was an issue with your payment. Please try again.",
    icon: "❌",
    bgColor: "bg-red-50",
    iconColor: "text-red-600",
  },
  [BookingStatus.Cancelled]: {
    title: "Booking Cancelled",
    message: "Your booking has been cancelled.",
    icon: "🚫",
    bgColor: "bg-gray-50",
    iconColor: "text-gray-600",
  },
  [BookingStatus.DuplicateBooking]: {
    title: "Duplicate Booking",
    message: "You already have a confirmed booking for this class.",
    icon: "⚠️",
    bgColor: "bg-orange-50",
    iconColor: "text-orange-600",
  },
  [BookingStatus.NoSeatsAvailable]: {
    title: "No Seats Available",
    message: "Sorry, this class is now full. Please try another class.",
    icon: "😔",
    bgColor: "bg-red-50",
    iconColor: "text-red-600",
  },
};

export function BookingStatusDialog({
  isOpen,
  status,
  bookingId,
  className = "",
  studentName,
  onClose,
}: BookingStatusDialogProps) {
  if (!isOpen) return null;

  const config = statusConfig[status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={`relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 ${config.bgColor} ${className}`}
      >
        <div className="text-center">
          <div className="text-6xl mb-4">{config.icon}</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {config.title}
          </h2>
          <p className="text-gray-600 mb-2">{config.message}</p>

          {studentName && (
            <p className="text-sm text-gray-500 mb-2">
              Student: <span className="font-semibold">{studentName}</span>
            </p>
          )}

          <div className="bg-white/80 rounded-lg p-3 mb-6">
            <p className="text-xs text-gray-500">Booking ID</p>
            <p className="font-mono text-sm font-semibold text-gray-900">
              {bookingId}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {status === BookingStatus.Confirmed && (
            <Link href="/roster" className="block">
              <Button className="w-full btn-ottodot btn-ottodot-green">
                View Roster
              </Button>
            </Link>
          )}

          {status === BookingStatus.PaymentFailed && (
            <Button
              onClick={onClose}
              className="w-full btn-ottodot btn-ottodot-yellow"
            >
              Try Again
            </Button>
          )}

          <Link href="/bookings" className="block">
            <Button variant="secondary" className="w-full">
              Book Another Class
            </Button>
          </Link>

          <Button onClick={onClose} variant="secondary" className="w-full">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
