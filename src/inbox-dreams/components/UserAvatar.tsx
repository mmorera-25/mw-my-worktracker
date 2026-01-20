import { forwardRef } from "react";
import { User } from "@inbox/types";
import { cn } from "@inbox/lib/utils";

interface UserAvatarProps {
  user: User;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-6 h-6 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-10 h-10 text-base",
};

export const UserAvatar = forwardRef<HTMLDivElement, UserAvatarProps>(
  ({ user, size = "md", className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-full flex items-center justify-center font-medium text-primary-foreground shrink-0",
          sizeClasses[size],
          className
        )}
        style={{ backgroundColor: user.color }}
        title={user.name}
      >
        {user.initials}
      </div>
    );
  }
);

UserAvatar.displayName = "UserAvatar";
