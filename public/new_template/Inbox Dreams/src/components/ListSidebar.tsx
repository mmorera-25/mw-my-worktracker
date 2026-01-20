import { List, Tag, CheckSquare, Trash2, Plus } from "lucide-react";
import { Epic } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ListSidebarProps {
  epics: Epic[];
  selectedEpicId: string | null;
  onSelectEpic: (epicId: string | null) => void;
  onCreateEpic: () => void;
  storyCounts: Record<string, number>;
  activeView: string;
  onViewChange: (view: string) => void;
}

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  isActive?: boolean;
  onClick?: () => void;
}

function SidebarItem({ icon, label, count, isActive, onClick }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors",
        "hover:bg-hover-overlay text-foreground",
        isActive && "bg-selected-bg text-primary font-medium"
      )}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="flex-1 text-left truncate">{label}</span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">{count}</span>
      )}
    </button>
  );
}

export function ListSidebar({ 
  epics, 
  selectedEpicId, 
  onSelectEpic, 
  onCreateEpic,
  storyCounts,
  activeView,
  onViewChange
}: ListSidebarProps) {
  return (
    <aside className="w-52 bg-card border-r border-panel-border flex flex-col h-full shrink-0">
      {/* Lists Section */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
        {/* Section Label */}
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Lists
        </div>

        {/* Epic Items */}
        {epics.map((epic) => (
          <SidebarItem
            key={epic.id}
            icon={<List className="w-4 h-4" />}
            label={epic.name}
            count={storyCounts[epic.id] || 0}
            isActive={selectedEpicId === epic.id}
            onClick={() => onSelectEpic(epic.id)}
          />
        ))}

        {/* Filters Section */}
        <div className="pt-4">
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Filters
          </div>
        </div>

        {/* Tags Section */}
        <div className="pt-4">
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Tags
          </div>
          <SidebarItem
            icon={<Tag className="w-4 h-4" />}
            label="work"
            count={1}
            onClick={() => {}}
          />
          <SidebarItem
            icon={<Tag className="w-4 h-4" />}
            label="fun"
            count={1}
            onClick={() => {}}
          />
        </div>
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-panel-border space-y-1">
        <SidebarItem
          icon={<CheckSquare className="w-4 h-4" />}
          label="Completed"
          isActive={activeView === 'completed'}
          onClick={() => {
            onViewChange('completed');
            onSelectEpic(null);
          }}
        />
        <SidebarItem
          icon={<Trash2 className="w-4 h-4" />}
          label="Trash"
          isActive={activeView === 'trash'}
          onClick={() => {
            onViewChange('trash');
            onSelectEpic(null);
          }}
        />
        <Button
          onClick={onCreateEpic}
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground mt-2"
        >
          <Plus className="w-4 h-4" />
          New List
        </Button>
      </div>
    </aside>
  );
}
