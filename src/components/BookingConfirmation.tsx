import { BookingStatus } from "@/types/booking";
import { StatusBadge } from "./StatusBadge";

export interface BookingConfirmationProps {
  bookingId: string;
  studentName: string;
  className: string;
  subject: string;
  startTime: string;
  status: BookingStatus;
}

export function BookingConfirmation({
  bookingId,
  studentName,
  className: trialClassName,
  subject,
  startTime,
  status,
}: BookingConfirmationProps) {
  const startDate = new Date(startTime);
  const formattedDate = startDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = startDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="max-w-md mx-auto">
      <div className="card-playful text-center">
        <div className="mb-6">
          <StatusBadge status={status} />
        </div>

        <div className="space-y-4 text-left">
          <div className="border-b pb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Booking Reference
            </p>
            <p className="font-mono text-lg font-bold text-gray-900">
              {bookingId}
            </p>
          </div>

          <div className="border-b pb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Student
            </p>
            <p className="text-lg font-semibold text-gray-900">{studentName}</p>
          </div>

          <div className="border-b pb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Class
            </p>
            <p className="text-lg font-semibold text-gray-900">
              {trialClassName}
            </p>
            <p className="text-sm text-gray-600">{subject}</p>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Schedule
            </p>
            <p className="text-lg font-semibold text-gray-900">
              {formattedDate}
            </p>
            <p className="text-sm text-gray-600">{formattedTime}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
