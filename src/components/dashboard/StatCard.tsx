import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  bg?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  color = "text-gray-900",
  bg = "bg-gray-100",
  trend,
  subtitle,
}: StatCardProps) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-200 bg-white p-3 transition-shadow hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {title}
          </p>
          <p className={`mt-2 truncate text-xl font-bold sm:text-2xl ${color}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={`text-xs font-semibold ${
                  trend.isPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                {trend.isPositive ? "â†‘" : "â†“"} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-gray-500">vs last period</span>
            </div>
          )}
        </div>
        <div className={`ml-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg sm:ml-3 sm:h-11 sm:w-11 ${bg}`}>
          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}
