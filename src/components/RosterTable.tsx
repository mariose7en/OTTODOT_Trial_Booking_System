import { RosterResponse } from "@/types/booking";

export interface RosterTableProps {
  roster: RosterResponse;
}

export function RosterTable({ roster }: RosterTableProps) {
  const {
    class_name,
    subject,
    start_time,
    confirmed_students,
    seats_remaining,
    max_seats,
  } = roster;

  const startDate = new Date(start_time);
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
    <div className="card-playful">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold text-gray-900">{class_name}</h3>
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-ottodot-blue/10 text-ottodot-blue">
            {subject}
          </span>
        </div>
        <p className="text-sm text-gray-600">
          {formattedDate} at {formattedTime}
        </p>
        <p className="text-sm text-gray-600 mt-1">
          <span className="font-semibold text-ottodot-green">
            {seats_remaining}
          </span>{" "}
          of {max_seats} seats remaining
        </p>
      </div>

      {confirmed_students.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No confirmed students yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase">
                  #
                </th>
                <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase">
                  Student Name
                </th>
                <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 uppercase">
                  Email
                </th>
              </tr>
            </thead>
            <tbody>
              {confirmed_students.map((student, index) => (
                <tr
                  key={student.student_id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="py-3 px-2 text-sm text-gray-500">
                    {index + 1}
                  </td>
                  <td className="py-3 px-2">
                    <p className="font-semibold text-gray-900">
                      {student.first_name} {student.last_name}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      {student.student_id}
                    </p>
                  </td>
                  <td className="py-3 px-2 text-sm text-gray-600">
                    {student.email}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
