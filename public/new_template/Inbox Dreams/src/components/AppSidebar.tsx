import { useState } from "react";
import {
  Star,
  Clock,
  Filter,
  LayoutDashboard,
  Settings,
  Plus,
  ChevronRight,
  Layers,
} from "lucide-react";
import { Epic } from "@/types";
import { EpicIcon } from "./EpicIcon";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AppSidebarProps {
  epics: Epic[];
  selectedEpicId: string | null;
  onSelectEpic: (epicId: string) => void;
  onCreateEpic: () => void;
}

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  hasChevron?: boolean;
  onClick?: () => void;
}

function SidebarItem({ icon, label, isActive, hasChevron, onClick }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
        "hover:bg-hover-overlay text-sidebar-foreground",
        isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-left truncate">{label}</span>
      {hasChevron && <ChevronRight className="w-4 h-4 opacity-50" />}
    </button>
  );
}

export function AppSidebar({ epics, selectedEpicId, onSelectEpic, onCreateEpic }: AppSidebarProps) {
  const starredEpics = epics.filter((e) => e.isStarred);
  const recentEpics = epics.slice(0, 3);

  return (
    <aside className="w-56 bg-card border-r border-panel-border flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-panel-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <Layers className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">TaskFlow</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
        <SidebarItem icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboard" />
        
        {/* Starred Section */}
        {starredEpics.length > 0 && (
          <div className="pt-4">
            <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Starred
            </div>
            {starredEpics.map((epic) => (
              <SidebarItem
                key={epic.id}
                icon={<EpicIcon color={epic.color} size="sm" />}
                label={epic.name}
                isActive={selectedEpicId === epic.id}
                onClick={() => onSelectEpic(epic.id)}
              />
            ))}
          </div>
        )}

        {/* Recent Section */}
        <div className="pt-4">
          <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Recent
          </div>
          {recentEpics.map((epic) => (
            <SidebarItem
              key={epic.id}
              icon={<EpicIcon color={epic.color} size="sm" />}
              label={epic.name}
              isActive={selectedEpicId === epic.id}
              onClick={() => onSelectEpic(epic.id)}
            />
          ))}
        </div>

        {/* Quick Links */}
        <div className="pt-4">
          <SidebarItem icon={<Filter className="w-4 h-4" />} label="Filters" hasChevron />
          <SidebarItem icon={<LayoutDashboard className="w-4 h-4" />} label="Dashboards" hasChevron />
        </div>
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-panel-border space-y-1">
        <Button
          onClick={onCreateEpic}
          variant="ghost"
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-hover-overlay"
        >
          <Plus className="w-4 h-4" />
          Create Epic
        </Button>
        <SidebarItem icon={<Settings className="w-4 h-4" />} label="Settings" />
      </div>
    </aside>
  );
}
