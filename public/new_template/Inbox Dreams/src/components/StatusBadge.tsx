import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "todo" | "in-progress" | "done";
  className?: string;
}

const statusConfig = {
  todo: {
    label: "To Do",
    className: "bg-muted text-muted-foreground",
  },
  "in-progress": {
    label: "In Progress",
    className: "bg-primary/10 text-primary",
  },
  done: {
    label: "Done",
    className: "bg-status-done/10 text-status-done",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
