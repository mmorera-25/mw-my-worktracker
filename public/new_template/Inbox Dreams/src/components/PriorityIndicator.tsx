import { cn } from "@/lib/utils";
import { ArrowUp, ArrowRight, ArrowDown } from "lucide-react";

interface PriorityIndicatorProps {
  priority: "low" | "medium" | "high";
  showLabel?: boolean;
  className?: string;
}

const priorityConfig = {
  low: {
    label: "Low",
    icon: ArrowDown,
    className: "text-priority-low",
  },
  medium: {
    label: "Medium",
    icon: ArrowRight,
    className: "text-priority-medium",
  },
  high: {
    label: "High",
    icon: ArrowUp,
    className: "text-priority-high",
  },
};

export function PriorityIndicator({ priority, showLabel = false, className }: PriorityIndicatorProps) {
  const config = priorityConfig[priority];
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Icon className={cn("w-4 h-4", config.className)} />
      {showLabel && (
        <span className={cn("text-xs font-medium", config.className)}>
          {config.label}
        </span>
      )}
    </div>
  );
}
