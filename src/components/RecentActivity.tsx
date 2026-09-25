export interface Activity {
  id: string;
  type: "booking" | "payment" | "cancellation";
  message: string;
  timestamp: string;
}

export interface RecentActivityProps {
  activities: Activity[];
}

export function RecentActivity({ activities }: RecentActivityProps) {
  const getActivityIcon = (type: Activity["type"]) => {
    switch (type) {
      case "booking":
        return "📋";
      case "payment":
        return "💰";
      case "cancellation":
        return "❌";
    }
  };

  return (
    <div className="card-playful">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h3>

      {activities.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No recent activity</p>
      ) : (
        <ul className="space-y-3">
          {activities.map((activity) => (
            <li
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-gray-50"
            >
              <span className="text-xl">{getActivityIcon(activity.type)}</span>
              <div className="flex-1">
                <p className="text-sm text-gray-900">{activity.message}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(activity.timestamp).toLocaleString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
