import { Story, Epic } from "@/types";
import { UserAvatar } from "./UserAvatar";
import { EpicIcon } from "./EpicIcon";
import { cn } from "@/lib/utils";

interface StoryListItemProps {
  story: Story;
  epic?: Epic;
  isSelected: boolean;
  onClick: () => void;
}

export function StoryListItem({ story, epic, isSelected, onClick }: StoryListItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 border-b border-panel-border transition-all",
        "hover:bg-hover-overlay",
        isSelected && "bg-selected-bg border-l-2 border-l-selected-border"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground text-sm leading-tight line-clamp-2">
            {story.title}
          </h3>
          <div className="flex items-center gap-2 mt-2">
            {epic && <EpicIcon color={epic.color} size="sm" />}
            <span className="text-xs text-primary font-medium">{story.key}</span>
          </div>
        </div>
        {story.assignee && (
          <UserAvatar user={story.assignee} size="sm" />
        )}
      </div>
    </button>
  );
}
