import { TrialClassWithSeats } from "@/types/booking";
import Link from "next/link";

export interface TrialClassCardProps {
  trialClass: TrialClassWithSeats;
}

export function TrialClassCard({ trialClass }: TrialClassCardProps) {
  const { id, class_name, subject, start_time, max_seats, seats_remaining } =
    trialClass;

  const startDate = new Date(start_time);
  const dayName = startDate.toLocaleDateString("en-US", { weekday: "long" });
  const date = startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = startDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const getSeatStatus = () => {
    if (seats_remaining === 0)
      return { text: "No seats available", className: "seat-full" };
    if (seats_remaining <= 1)
      return { text: "1 seat left", className: "seat-limited" };
    return { text: `${seats_remaining} seats available`, className: "seat-available" };
  };

  const seatStatus = getSeatStatus();
  const isFull = seats_remaining === 0;

  const subjectEmoji = subject === "MATH" ? "🔢" : "🔬";

  return (
    <div className="card-playful flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-3xl">{subjectEmoji}</span>
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-ottodot-blue/10 text-ottodot-blue">
          {subject}
        </span>
      </div>

      <h3 className="text-xl font-bold text-gray-900 mb-2">{class_name}</h3>

      <div className="space-y-2 text-sm text-gray-600 mb-4">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-ottodot-yellow"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span>
            {dayName}, {date}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-ottodot-yellow"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{time}</span>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">Seats</span>
          <span className={seatStatus.className}>{seatStatus.text}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              isFull
                ? "bg-ottodot-red"
                : seats_remaining <= 1
                ? "bg-ottodot-yellow"
                : "bg-ottodot-green"
            }`}
            style={{
              width: `${((max_seats - seats_remaining) / max_seats) * 100}%`,
            }}
          />
        </div>
      </div>

      <div className="mt-auto">
        {isFull ? (
          <button
            disabled
            className="w-full py-3 px-4 rounded-lg bg-gray-300 text-gray-500 font-semibold cursor-not-allowed"
          >
            Fully Booked
          </button>
        ) : (
          <Link
            href={`/bookings/${id}`}
            className="block w-full py-3 px-4 rounded-lg text-center btn-ottodot btn-ottodot-yellow"
          >
            Book Now
          </Link>
        )}
      </div>
    </div>
  );
}
