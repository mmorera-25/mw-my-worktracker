import {
  List,
  LayoutGrid,
  Calendar,
  BarChart3,
  Code,
  FileText,
  MoreHorizontal,
} from "lucide-react";
import { Epic } from "@/types";
import { EpicIcon } from "./EpicIcon";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

interface TopNavProps {
  epic?: Epic;
}

const navItems = [
  { icon: List, label: "List", active: false },
  { icon: LayoutGrid, label: "All work", active: true },
  { icon: BarChart3, label: "Summary", active: false },
  { icon: Calendar, label: "Timeline", active: false },
  { icon: LayoutGrid, label: "Board", active: false },
  { icon: Calendar, label: "Calendar", active: false },
  { icon: Code, label: "Development", active: false },
  { icon: FileText, label: "Pages", active: false },
];

export function TopNav({ epic }: TopNavProps) {
  return (
    <header className="bg-card border-b border-panel-border">
      {/* Project Header */}
      <div className="px-4 py-3 border-b border-panel-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Spaces</span>
            <span className="text-muted-foreground">/</span>
            {epic ? (
              <div className="flex items-center gap-2">
                <EpicIcon color={epic.color} size="sm" />
                <span className="font-medium text-foreground">{epic.name}</span>
              </div>
            ) : (
              <span className="font-medium text-foreground">All Stories</span>
            )}
            <button className="ml-2 p-1 rounded hover:bg-hover-overlay">
              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="px-4 flex items-center gap-1 overflow-x-auto scrollbar-thin">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              "border-b-2 -mb-px",
              item.active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-hover-overlay"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}
        <button className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground">
          More
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </nav>
    </header>
  );
}
