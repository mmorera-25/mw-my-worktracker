import { 
  Calendar, 
  CalendarDays, 
  Inbox, 
  Search, 
  LayoutGrid, 
  RefreshCw, 
  User, 
  HelpCircle,
  CheckSquare,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./UserAvatar";

interface IconSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const topIcons = [
  { id: "today", icon: Calendar, label: "Today" },
  { id: "week", icon: CalendarDays, label: "Next 7 Days" },
  { id: "inbox", icon: Inbox, label: "Inbox" },
];

const middleIcons = [
  { id: "search", icon: Search, label: "Search" },
  { id: "grid", icon: LayoutGrid, label: "All Tasks" },
  { id: "completed", icon: CheckSquare, label: "Completed" },
  { id: "trash", icon: Trash2, label: "Trash" },
];

const bottomIcons = [
  { id: "sync", icon: RefreshCw, label: "Sync" },
  { id: "profile", icon: User, label: "Profile" },
  { id: "help", icon: HelpCircle, label: "Help" },
];

export function IconSidebar({ activeView, onViewChange }: IconSidebarProps) {
  return (
    <aside className="w-14 bg-sidebar-background border-r border-sidebar-border flex flex-col h-full shrink-0">
      {/* User Avatar */}
      <div className="p-3 flex justify-center">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-xs font-medium text-primary">JC</span>
        </div>
      </div>

      {/* Top Icons */}
      <nav className="flex-1 flex flex-col items-center py-2 gap-1">
        {topIcons.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
              "hover:bg-hover-overlay",
              activeView === item.id && "bg-primary text-primary-foreground"
            )}
            title={item.label}
          >
            <item.icon className="w-5 h-5" />
          </button>
        ))}

        <div className="w-8 h-px bg-border my-2" />

        {middleIcons.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
              "hover:bg-hover-overlay text-muted-foreground",
              activeView === item.id && "bg-primary text-primary-foreground"
            )}
            title={item.label}
          >
            <item.icon className="w-5 h-5" />
          </button>
        ))}
      </nav>

      {/* Bottom Icons */}
      <div className="flex flex-col items-center py-3 gap-1 border-t border-sidebar-border">
        {bottomIcons.map((item) => (
          <button
            key={item.id}
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors hover:bg-hover-overlay text-muted-foreground"
            title={item.label}
          >
            <item.icon className="w-5 h-5" />
          </button>
        ))}
      </div>
    </aside>
  );
}
