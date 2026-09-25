export interface BookingStatsProps {
  total: number;
  confirmed: number;
  pending: number;
  failed: number;
}

export function BookingStats({
  total,
  confirmed,
  pending,
  failed,
}: BookingStatsProps) {
  const stats = [
    {
      label: "Total Bookings",
      value: total,
      bgColor: "bg-ottodot-blue/10",
      textColor: "text-ottodot-blue",
    },
    {
      label: "Confirmed",
      value: confirmed,
      bgColor: "bg-ottodot-green/10",
      textColor: "text-ottodot-green",
    },
    {
      label: "Pending Payment",
      value: pending,
      bgColor: "bg-ottodot-yellow/10",
      textColor: "text-ottodot-yellow",
    },
    {
      label: "Failed",
      value: failed,
      bgColor: "bg-ottodot-red/10",
      textColor: "text-ottodot-red",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`${stat.bgColor} rounded-xl p-4 text-center`}
        >
          <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
          <p className={`text-3xl font-bold ${stat.textColor}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
