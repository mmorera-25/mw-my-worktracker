import { List, Trash2, Plus, Layers, MoreVertical, Pencil } from "lucide-react";
import { Epic } from "@inbox/types";
import { cn } from "@inbox/lib/utils";
import { Button } from "@inbox/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@inbox/components/ui/dropdown-menu";

interface ListSidebarProps {
  epics: Epic[];
  selectedEpicId: string | null;
  onSelectEpic: (epicId: string | null) => void;
  onCreateEpic: () => void;
  storyCounts: Record<string, number>;
  activeView: string;
  onViewChange: (view: string) => void;
  width?: number;
  onRenameEpic?: (epicId: string) => void;
  onDeleteEpic?: (epicId: string) => void;
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
  onViewChange,
  width,
  onRenameEpic,
  onDeleteEpic,
}: ListSidebarProps) {
  const DOC_EPIC_ID = "documentation-epic";
  const DOC_EPIC_NAME = "Documentation";
  const DOC_EPIC_LEGACY_NAME = "Documentation Epic";
  const noEpic = epics.find(
    (epic) => epic.id === "no-epic-assigned" || epic.name === "No Epic Assigned"
  );
  const docEpic = epics.find(
    (epic) =>
      epic.id === DOC_EPIC_ID ||
      epic.name === DOC_EPIC_NAME ||
      epic.name === DOC_EPIC_LEGACY_NAME
  );
  const orderedEpics = epics
    .filter((epic) => epic !== noEpic && epic !== docEpic)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  return (
    <aside
      style={width ? { width } : undefined}
      className="w-52 bg-card border-r border-panel-border flex flex-col h-full shrink-0"
    >
      {/* Epics Section */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
        {/* Section Label */}
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Epics
        </div>

        {noEpic ? (
          <div
            key={noEpic.id}
            className={cn(
              "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-hover-overlay",
              selectedEpicId === noEpic.id && "bg-selected-bg text-primary font-medium"
            )}
          >
            <button
              type="button"
              className="flex flex-1 min-w-0 items-center gap-3 text-left"
              onClick={() => onSelectEpic(noEpic.id)}
            >
              <span className="shrink-0 text-xs font-semibold uppercase text-muted-foreground">
                N/A
              </span>
              <span className="flex-1 min-w-0 truncate text-muted-foreground">
                {noEpic.name}
              </span>
              <span className="w-6 text-right text-xs text-muted-foreground tabular-nums">
                {storyCounts[noEpic.id] || 0}
              </span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="invisible h-6 w-6"
              disabled
              aria-hidden="true"
              tabIndex={-1}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null}

        {docEpic ? (
          <div
            key={docEpic.id}
            className={cn(
              "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-hover-overlay",
              selectedEpicId === docEpic.id && "bg-selected-bg text-primary font-medium"
            )}
          >
            <button
              type="button"
              className="flex flex-1 min-w-0 items-center gap-3 text-left"
              onClick={() => onSelectEpic(docEpic.id)}
            >
              <span
                className="shrink-0 text-xs font-semibold uppercase"
                style={{ color: docEpic.color }}
              >
                {docEpic.key.slice(0, 3)}
              </span>
              <span className="flex-1 min-w-0 truncate">{docEpic.name}</span>
              <span className="w-6 text-right text-xs text-muted-foreground tabular-nums">
                {storyCounts[docEpic.id] || 0}
              </span>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="invisible h-6 w-6"
              disabled
              aria-hidden="true"
              tabIndex={-1}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null}

        {/* Epic Items */}
        {orderedEpics.map((epic) => {
          const isSystemEpic =
            epic.id === "no-epic-assigned" ||
            epic.name === "No Epic Assigned" ||
            epic.id === DOC_EPIC_ID ||
            epic.name === DOC_EPIC_NAME ||
            epic.name === DOC_EPIC_LEGACY_NAME;
          return (
          <div
            key={epic.id}
            className={cn(
              "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-hover-overlay",
              selectedEpicId === epic.id && "bg-selected-bg text-primary font-medium"
            )}
          >
            <button
              type="button"
              className="flex flex-1 min-w-0 items-center gap-3 text-left"
              onClick={() => onSelectEpic(epic.id)}
            >
              <span
                className="shrink-0 text-xs font-semibold uppercase"
                style={{ color: epic.color }}
              >
                {epic.key.slice(0, 3)}
              </span>
              <span className="flex-1 min-w-0 truncate">{epic.name}</span>
              <span className="w-6 text-right text-xs text-muted-foreground tabular-nums">
                {storyCounts[epic.id] || 0}
              </span>
            </button>
            {isSystemEpic ? (
              <Button
                variant="ghost"
                size="icon"
                className="invisible h-6 w-6"
                disabled
                aria-hidden="true"
                tabIndex={-1}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => onRenameEpic?.(epic.id)}
                    disabled={!onRenameEpic}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDeleteEpic?.(epic.id)}
                    disabled={!onDeleteEpic}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          );
        })}

        <Button
          onClick={onCreateEpic}
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-4 h-4" />
          New Epic
        </Button>

      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-panel-border space-y-2">
        <SidebarItem
          icon={<Layers className="w-4 h-4" />}
          label="Epics admin"
          isActive={activeView === 'epics'}
          onClick={() => {
            onViewChange('epics');
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
      </div>
    </aside>
  );
}
