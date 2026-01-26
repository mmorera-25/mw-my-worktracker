import {
  Calendar,
  CalendarRange,
  Inbox,
  Search,
  RefreshCw,
  HelpCircle,
  StickyNote,
  Goal,
  MessageCircle,
  FileText,
  Settings,
  Bell,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@inbox/lib/utils";
import { useEffect, useMemo, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@inbox/components/ui/dropdown-menu";

interface IconSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onRefresh?: () => void;
  user: FirebaseUser;
}

const topIcons = [
  { id: "week", icon: Inbox, label: "Inbox" },
  { id: "yearly", icon: CalendarRange, label: "Yearly" },
  { id: "today", icon: Calendar, label: "Calendar" },
  { id: "search", icon: Search, label: "Search" },
];

const workTrackerIcons = [
  { id: "oneonone", icon: MessageCircle, label: "Meetings" },
  { id: "notes", icon: StickyNote, label: "Notes" },
  { id: "okrs", icon: Goal, label: "OKRs" },
  { id: "reporting", icon: FileText, label: "Reporting" },
];

const bottomIcons = [
  { id: "settings", icon: Settings, label: "Settings", view: true },
  { id: "refresh", icon: RefreshCw, label: "Refresh", refresh: true },
  { id: "notifications", icon: Bell, label: "Notifications", view: true },
  { id: "help", icon: HelpCircle, label: "Help" },
];

const SIDEBAR_EXPANSION_KEY = "mw-sidebar-expanded";

const getInitialExpansion = () => {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(SIDEBAR_EXPANSION_KEY) !== "collapsed";
};

const getInitials = (user: FirebaseUser) => {
  const name = user.displayName?.trim();
  if (name) {
    return name
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  const email = user.email?.trim();
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "ME";
};

export function IconSidebar({ activeView, onViewChange, onRefresh, user }: IconSidebarProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(getInitialExpansion);
  const initials = getInitials(user);
  const displayName =
    user.displayName?.trim() ?? user.email?.split("@")[0] ?? "Account";

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      SIDEBAR_EXPANSION_KEY,
      isExpanded ? "expanded" : "collapsed"
    );
  }, [isExpanded]);

  const buttonBaseClasses = useMemo(
    () =>
      cn(
        "flex items-center gap-2 rounded-lg transition-colors",
        isExpanded ? "w-full px-3 py-2 justify-start" : "h-10 w-10 justify-center"
      ),
    [isExpanded]
  );

  return (
    <aside
      className={cn(
        "bg-sidebar-background border-r border-sidebar-border flex flex-col h-full shrink-0 transition-all",
        isExpanded ? "w-48" : "w-14"
      )}
    >
      {/* User Avatar */}
      <div
        className={cn(
          "flex",
          isExpanded ? "p-1.5 justify-start" : "p-3 justify-center"
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex items-center rounded-lg transition-colors hover:bg-hover-overlay",
                isExpanded ? "w-full px-0 py-1.5 gap-2" : "h-9 w-9 justify-center"
              )}
              title={user.displayName ?? user.email ?? "Account"}
            >
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-medium text-primary">{initials}</span>
              </div>
              {isExpanded && (
                <div className="min-w-0 text-left">
                  <div className="text-sm font-medium text-foreground truncate">
                    {displayName}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {user.email ?? "Signed in"}
                  </div>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => signOut(auth)}>
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Top Icons */}
      <nav
        className={cn(
          "flex-1 flex flex-col justify-start py-2 gap-1",
          isExpanded ? "px-1 items-stretch" : "items-center"
        )}
      >
        {topIcons.map((item) => (
          <div
            key={item.id}
            className={cn(isExpanded ? "w-full" : "w-auto")}
          >
            <button
              onClick={() => onViewChange(item.id)}
            className={cn(
              buttonBaseClasses,
              activeView === item.id
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "hover:bg-hover-overlay text-muted-foreground"
            )}
              title={item.label}
            >
              <item.icon className="w-5 h-5" />
            {isExpanded && (
              <span
                className={cn(
                  "text-sm font-medium",
                  activeView === item.id ? "text-primary-foreground" : "text-foreground"
                )}
              >
                {item.label}
              </span>
            )}
            </button>
          </div>
        ))}

        <div className="w-8 h-px bg-border my-2" />

        {workTrackerIcons.map((item) => (
          <div
            key={item.id}
            className={cn(isExpanded ? "w-full" : "w-auto")}
          >
            <button
              onClick={() => onViewChange(item.id)}
            className={cn(
              buttonBaseClasses,
              activeView === item.id
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "hover:bg-hover-overlay text-muted-foreground"
            )}
              title={item.label}
            >
              <item.icon className="w-5 h-5" />
            {isExpanded && (
              <span
                className={cn(
                  "text-sm font-medium",
                  activeView === item.id ? "text-primary-foreground" : "text-foreground"
                )}
              >
                {item.label}
              </span>
            )}
            </button>
          </div>
        ))}
      </nav>

      {/* Bottom Icons */}
      <div
        className={cn(
          "flex flex-col py-3 gap-1 border-t border-sidebar-border",
          isExpanded ? "px-1 items-stretch" : "items-center"
        )}
      >
        {bottomIcons.map((item) => (
          <div
            key={item.id}
            className={cn(isExpanded ? "w-full" : "w-auto")}
          >
            <button
              onClick={() => {
                if (item.refresh) {
                  onRefresh?.()
                  return
                }
                if (item.view) {
                  onViewChange(item.id)
                }
              }}
              className={cn(
                buttonBaseClasses,
                item.view && activeView === item.id
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "hover:bg-hover-overlay text-muted-foreground"
              )}
              title={item.label}
            >
              <item.icon className="w-5 h-5" />
            {isExpanded && (
              <span
                className={cn(
                  "text-sm font-medium",
                  item.view && activeView === item.id
                    ? "text-primary-foreground"
                    : "text-foreground"
                )}
              >
                {item.label}
              </span>
            )}
            </button>
          </div>
        ))}
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className={cn(
            buttonBaseClasses,
            "text-muted-foreground hover:bg-hover-overlay border-t border-panel-border"
          )}
        >
          {isExpanded ? (
            <ChevronsLeft className="w-5 h-5" />
          ) : (
            <ChevronsRight className="w-5 h-5" />
          )}
          {isExpanded && (
            <span className="text-sm font-medium text-foreground">
              {isExpanded ? "Collapse" : "Expand"}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
