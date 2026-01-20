import { useState } from "react";
import { Search, SlidersHorizontal, RefreshCw, Plus } from "lucide-react";
import { Story, Epic } from "@/types";
import { StoryListItem } from "./StoryListItem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StoryListProps {
  stories: Story[];
  epics: Epic[];
  selectedStoryId: string | null;
  onSelectStory: (storyId: string) => void;
  onCreateStory: () => void;
}

export function StoryList({
  stories,
  epics,
  selectedStoryId,
  onSelectStory,
  onCreateStory,
}: StoryListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const filteredStories = stories.filter((story) => {
    const matchesSearch =
      story.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      story.key.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getEpicForStory = (epicId: string) => epics.find((e) => e.id === epicId);

  return (
    <div className="w-80 bg-card border-r border-panel-border flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="p-3 border-b border-panel-border space-y-3">
        <div className="flex items-center gap-2">
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="me">Assigned to me</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <SlidersHorizontal className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <div className="flex-1" />
          <Button
            onClick={onCreateStory}
            size="sm"
            className="h-8 gap-1"
          >
            <Plus className="w-4 h-4" />
            Story
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stories..."
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Story List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filteredStories.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p className="text-sm">No stories found</p>
          </div>
        ) : (
          filteredStories.map((story) => (
            <StoryListItem
              key={story.id}
              story={story}
              epic={getEpicForStory(story.epicId)}
              isSelected={selectedStoryId === story.id}
              onClick={() => onSelectStory(story.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
