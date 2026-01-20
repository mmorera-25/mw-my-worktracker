import { cn } from "@inbox/lib/utils";

interface EpicIconProps {
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
};

export function EpicIcon({ color, size = "md", className }: EpicIconProps) {
  return (
    <div
      className={cn(
        "rounded-sm shrink-0",
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: color }}
    />
  );
}
