import { BookingStatus } from "@/types/booking";

export interface StatusBadgeProps {
  status: BookingStatus;
}

const statusStyles: Record<BookingStatus, string> = {
  [BookingStatus.PendingPayment]:
    "bg-yellow-100 text-yellow-800 border-yellow-200",
  [BookingStatus.Confirmed]: "bg-green-100 text-green-800 border-green-200",
  [BookingStatus.PaymentFailed]: "bg-red-100 text-red-800 border-red-200",
  [BookingStatus.Cancelled]: "bg-gray-100 text-gray-800 border-gray-200",
  [BookingStatus.DuplicateBooking]:
    "bg-orange-100 text-orange-800 border-orange-200",
  [BookingStatus.NoSeatsAvailable]:
    "bg-red-100 text-red-800 border-red-200",
};

const statusLabels: Record<BookingStatus, string> = {
  [BookingStatus.PendingPayment]: "Pending Payment",
  [BookingStatus.Confirmed]: "Confirmed",
  [BookingStatus.PaymentFailed]: "Payment Failed",
  [BookingStatus.Cancelled]: "Cancelled",
  [BookingStatus.DuplicateBooking]: "Duplicate Booking",
  [BookingStatus.NoSeatsAvailable]: "No Seats Available",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        statusStyles[status] || "bg-gray-100 text-gray-800 border-gray-200"
      }`}
    >
      {statusLabels[status] || status}
    </span>
  );
}
