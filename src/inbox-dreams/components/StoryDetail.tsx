import { useState, useEffect } from "react";
import {
  Calendar,
  MoreHorizontal,
  Pencil,
  Check,
  X,
  MessageSquare,
  Paperclip,
  List,
  Plus,
} from "lucide-react";
import { Story, Epic } from "@inbox/types";
import { Button } from "@inbox/components/ui/button";
import { Input } from "@inbox/components/ui/input";
import { Checkbox } from "@inbox/components/ui/checkbox";
import RichTextEditor from "../../components/ui/RichTextEditor";
import Dialog from "../../components/ui/Dialog";
import TextArea from "../../components/ui/TextArea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@inbox/components/ui/select";
import { cn } from "@inbox/lib/utils";
import { format, differenceInCalendarDays, isSameDay } from "date-fns";

interface StoryDetailProps {
  story: Story;
  epic?: Epic;
  epics: Epic[];
  statusOptions: string[];
  doneStatus: string;
  defaultStatus: string;
  onUpdateStory: (story: Story) => void;
  onOpenMeetings?: () => void;
}

const getDueDates = (story: Story) => {
  return story.dueDates && story.dueDates.length > 0
    ? story.dueDates
    : [story.createdAt];
};

const getEffectiveDueDate = (story: Story) => {
  const dates = getDueDates(story);
  const sorted = dates.slice().sort((a, b) => a.getTime() - b.getTime());
  const now = new Date();
  const upcoming = sorted.find((date) => date >= now);
  return upcoming ?? sorted[sorted.length - 1];
};

export function StoryDetail({
  story,
  epic,
  epics,
  statusOptions,
  doneStatus,
  defaultStatus,
  onUpdateStory,
  onOpenMeetings,
}: StoryDetailProps) {
  const [title, setTitle] = useState(story.title);
  const [description, setDescription] = useState(story.description);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);

  useEffect(() => {
    setTitle(story.title);
    setDescription(story.description);
    setIsEditingTitle(false);
    setIsEditingDescription(false);
    setEditingCommentId(null);
    setEditingCommentText("");
    setIsCommentModalOpen(false);
  }, [story.id]);

  const saveTitle = () => {
    if (title.trim()) {
      onUpdateStory({ ...story, title: title.trim() });
      setIsEditingTitle(false);
    }
  };

  const saveDescription = () => {
    onUpdateStory({ ...story, description });
    setIsEditingDescription(false);
  };

  const isCompleted = story.status === doneStatus;
  const effectiveDueDate = getEffectiveDueDate(story);
  const dueDates = getDueDates(story);
  const isOverdue = effectiveDueDate < new Date() && !isCompleted;
  const dueDays = differenceInCalendarDays(effectiveDueDate, new Date());
  const dueLabel = isSameDay(effectiveDueDate, new Date())
    ? "Today"
    : dueDays > 0
    ? `${dueDays} day${dueDays === 1 ? "" : "s"} left`
    : dueDays < 0
    ? `${Math.abs(dueDays)} day${Math.abs(dueDays) === 1 ? "" : "s"} overdue`
    : "Today";
  const comments = story.comments ?? [];
  const completedDateValue = story.completedAt
    ? format(story.completedAt, "yyyy-MM-dd")
    : "";

  const renderRichText = (value?: string) => {
    if (!value) return null;
    return { __html: value };
  };

  const handleDeleteComment = (commentId: string) => {
    const next = comments.filter((comment) => comment.id !== commentId);
    onUpdateStory({ ...story, comments: next });
  };

  const openNewComment = () => {
    setEditingCommentId(null);
    setEditingCommentText("");
    setIsCommentModalOpen(true);
  };

  const openEditComment = (commentId: string, text: string) => {
    setEditingCommentId(commentId);
    setEditingCommentText(text);
    setIsCommentModalOpen(true);
  };

  const saveComment = () => {
    const trimmed = editingCommentText.trim();
    if (!trimmed) return;
    if (editingCommentId) {
      const next = comments.map((comment) =>
        comment.id === editingCommentId ? { ...comment, text: trimmed } : comment
      );
      onUpdateStory({ ...story, comments: next });
    } else {
      const next = [
        ...comments,
        { id: String(Date.now()), text: trimmed, createdAt: new Date() },
      ];
      onUpdateStory({ ...story, comments: next });
    }
    setEditingCommentId(null);
    setEditingCommentText("");
    setIsCommentModalOpen(false);
  };

  const closeCommentModal = () => {
    setEditingCommentId(null);
    setEditingCommentText("");
    setIsCommentModalOpen(false);
  };

  return (
    <div className="w-full bg-card border-l border-panel-border flex flex-col h-full shrink-0 animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={isCompleted}
            onCheckedChange={() => {
              onUpdateStory({
                ...story,
                status: isCompleted ? defaultStatus : doneStatus,
              });
            }}
            className="h-5 w-5"
          />
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className={cn(
              "text-sm font-medium",
              isOverdue ? "text-destructive" : "text-primary"
            )}>
              {format(effectiveDueDate, "d MMM")}
            </span>
            <span
              className={cn(
                "text-xs font-semibold",
                dueDays < 0 ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {dueLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <p className="text-[11px] uppercase text-muted-foreground">Status</p>
            <Select
              value={story.status}
              onValueChange={(value) => onUpdateStory({ ...story, status: value })}
            >
              <SelectTrigger className="h-7 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] uppercase text-muted-foreground">Priority</p>
            <Select
              value={story.priority}
              onValueChange={(value) =>
                onUpdateStory({ ...story, priority: value as Story["priority"] })
              }
            >
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] uppercase text-muted-foreground">Epic</p>
            <Select
              value={story.epicId}
              onValueChange={(value) => onUpdateStory({ ...story, epicId: value })}
            >
              <SelectTrigger className="h-7 w-36 text-xs">
                <SelectValue placeholder="Epic" />
              </SelectTrigger>
              <SelectContent>
                {epics.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] uppercase text-muted-foreground">Due dates</p>
            <div className="space-y-2">
              {dueDates.map((date, index) => (
                <div key={`${date.getTime()}-${index}`} className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={format(new Date(date), "yyyy-MM-dd")}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (!value) return;
                      const next = dueDates.map((entry, idx) =>
                        idx === index ? new Date(`${value}T00:00:00`) : entry
                      );
                      onUpdateStory({ ...story, dueDates: next });
                    }}
                    className="h-7 w-36 text-xs"
                  />
                  {dueDates.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        const next = dueDates.filter((_, idx) => idx !== index);
                        onUpdateStory({ ...story, dueDates: next });
                      }}
                      title="Remove due date"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit px-2 text-xs"
                onClick={() => {
                  const next = [...dueDates, new Date()];
                  onUpdateStory({ ...story, dueDates: next });
                }}
              >
                <Plus className="h-3 w-3" /> Add date
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] uppercase text-muted-foreground">Completed date</p>
            <Input
              type="date"
              value={completedDateValue}
              onChange={(e) => {
                const value = e.target.value;
                onUpdateStory({
                  ...story,
                  completedAt: value ? new Date(`${value}T00:00:00`) : undefined,
                  status: value ? doneStatus : defaultStatus,
                });
              }}
              className="h-7 w-36 text-xs"
            />
          </div>
        </div>
        {/* Title */}
        <div className="mb-4 group">
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-lg font-semibold border-0 shadow-none focus-visible:ring-1 px-0"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") {
                    setTitle(story.title);
                    setIsEditingTitle(false);
                  }
                }}
                onBlur={saveTitle}
              />
            </div>
          ) : (
            <div 
              className="flex items-start gap-2 cursor-pointer"
              onClick={() => setIsEditingTitle(true)}
            >
              <h1 className={cn(
                "text-lg font-semibold leading-tight flex-1",
                isCompleted ? "text-muted-foreground line-through" : "text-foreground"
              )}>
                {story.title}
              </h1>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="mb-6">
          <p className="mb-2 text-[11px] uppercase text-muted-foreground">Description</p>
          {isEditingDescription ? (
            <div className="space-y-2">
              <RichTextEditor
                value={description}
                onChange={(value) => setDescription(value)}
                placeholder="Add notes..."
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveDescription}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDescription(story.description);
                    setIsEditingDescription(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-panel-border/80 bg-background/60 p-3">
              {story.description ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest("a")) return;
                    setIsEditingDescription(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setIsEditingDescription(true);
                    }
                  }}
                  className="rich-text-content text-sm leading-relaxed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary/50"
                  dangerouslySetInnerHTML={renderRichText(story.description)}
                />
              ) : (
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => setIsEditingDescription(true)}
                >
                  Add notes...
                </button>
              )}
            </div>
          )}
        </div>

        <Dialog
          open={isCommentModalOpen}
          onClose={closeCommentModal}
          title={editingCommentId ? "Edit comment" : "Add comment"}
        >
          <div className="space-y-4">
            <TextArea
              value={editingCommentText}
              onChange={(e) => setEditingCommentText(e.target.value)}
              placeholder="Write your comment"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={closeCommentModal}>
                Cancel
              </Button>
              <Button size="sm" onClick={saveComment} disabled={!editingCommentText.trim()}>
                Save
              </Button>
            </div>
          </div>
        </Dialog>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Comments
            </p>
            <span className="text-xs text-muted-foreground">
              {comments.length}
            </span>
          </div>
          <div className="flex justify-start">
            <Button size="sm" onClick={openNewComment}>
              Add comment
            </Button>
          </div>
          <div className="space-y-2">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-lg border border-panel-border bg-background/40 px-3 py-2 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-foreground">{comment.text}</p>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => openEditComment(comment.id, comment.text)}
                        title="Edit comment"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteComment(comment.id)}
                        title="Delete comment"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(comment.createdAt, "MMM d, h:mm a")}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-panel-border">
        {epic && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{epic.name}</span>
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Paperclip className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MessageSquare className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
