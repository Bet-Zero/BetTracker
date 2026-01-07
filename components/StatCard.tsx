import React from "react";
import { TrendingUp, TrendingDown } from "./icons";
import { FitText } from "./FitText";

export const StatCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  subtitle?: string;
  subtitleClassName?: string;
  change?: string;
  valueClassName?: string;
  className?: string;
}> = ({
  title,
  value,
  icon,
  subtitle,
  subtitleClassName,
  change,
  valueClassName,
  className,
}) => {
  const isPositive = change && parseFloat(change) > 0;
  const isNegative = change && parseFloat(change) < 0;
  const changeColor = isPositive
    ? "text-accent-500"
    : isNegative
    ? "text-danger-500"
    : "text-neutral-500 dark:text-neutral-400";

  return (
    <div
      className={`bg-white dark:bg-neutral-900 p-4 sm:p-6 rounded-lg shadow-md flex flex-col justify-between relative overflow-hidden ${
        className || ""
      }`}
      style={{ minHeight: "140px" }}
    >
      <div className="min-w-0 flex-1 relative z-10">
        <p className="text-xs sm:text-sm font-medium text-neutral-500 dark:text-neutral-400 uppercase truncate pr-12">
          {title}
        </p>
        {/* Value with FitText */}
        <div
          className={`mt-1 h-12 w-full ${
            valueClassName || "text-neutral-900 dark:text-white"
          }`}
        >
          <FitText
            maxFontSize={26}
            minFontSize={10}
            className="justify-start font-bold"
          >
            {value}
          </FitText>
        </div>
        {subtitle && (
          <p
            className={`text-xs sm:text-sm font-semibold mt-2 ${
              subtitleClassName || "text-neutral-500 dark:text-neutral-400"
            }`}
          >
            {subtitle}
          </p>
        )}
        {change && (
          <p
            className={`text-xs sm:text-sm font-semibold flex items-center mt-2 ${changeColor}`}
          >
            {isPositive && <TrendingUp className="w-4 h-4 mr-1" />}
            {isNegative && <TrendingDown className="w-4 h-4 mr-1" />}
            {change}
          </p>
        )}
      </div>
      <div className="absolute top-2 right-2 bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 p-2 sm:p-3 rounded-full z-0 opacity-80">
        {icon}
      </div>
    </div>
  );
};
