import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@inbox/components/ui/dialog";
import { Button } from "@inbox/components/ui/button";
import { Input } from "@inbox/components/ui/input";
import { Label } from "@inbox/components/ui/label";
import { Textarea } from "@inbox/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@inbox/components/ui/select";
import { Epic, Story } from "@inbox/types";
import { EpicIcon } from "./EpicIcon";

interface CreateStoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  epics: Epic[];
  selectedEpicId?: string;
  initialTitle?: string;
  statusOptions: string[];
  defaultStatus: string;
  onRequestCreateEpic: () => void;
  onCreateStory: (story: Omit<Story, "id" | "key" | "createdAt">) => void;
  dateMode?: "day" | "month";
  isYearly?: boolean;
}

export function CreateStoryDialog({
  open,
  onOpenChange,
  epics,
  selectedEpicId,
  initialTitle,
  statusOptions,
  defaultStatus,
  onRequestCreateEpic,
  onCreateStory,
  dateMode = "day",
  isYearly = false,
}: CreateStoryDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [epicId, setEpicId] = useState(selectedEpicId || "");
  const [priority, setPriority] = useState<Story["priority"]>("low");
  const [status, setStatus] = useState(defaultStatus);
  const [dueMonth, setDueMonth] = useState(format(new Date(), "yyyy-MM"));
  const titleRef = useRef<HTMLInputElement | null>(null);
  const availableEpics = epics.filter((epic) => !epic.isArchived);
  const defaultEpicId =
    availableEpics.find((epic) => epic.id === selectedEpicId)?.id ??
    availableEpics[0]?.id ??
    "";
  const hasEpics = availableEpics.length > 0;

  useEffect(() => {
    if (open) {
      setEpicId(defaultEpicId);
      setTitle(initialTitle || "");
      setStatus(defaultStatus);
      setDueMonth(format(new Date(), "yyyy-MM"));
      requestAnimationFrame(() => titleRef.current?.focus());
    }
  }, [open, defaultEpicId, initialTitle, defaultStatus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !epicId || !hasEpics) return;
    if (dateMode === "month" && !dueMonth) return;

    const dueDates =
      dateMode === "month"
        ? [new Date(`${dueMonth}-01T00:00:00`)]
        : [new Date()];

    onCreateStory({
      title: title.trim(),
      description: description.trim(),
      epicId,
      dueDates,
      status,
      priority,
      isYearly,
    });

    setTitle("");
    setDescription("");
    setEpicId(defaultEpicId);
    setPriority("low");
    setStatus(defaultStatus);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Story</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="epic">Epic</Label>
            <Select value={epicId} onValueChange={setEpicId} required disabled={!hasEpics}>
              <SelectTrigger>
                <SelectValue
                  placeholder={hasEpics ? "Select an epic" : "Create an epic first"}
                />
              </SelectTrigger>
              <SelectContent>
                {availableEpics.map((epic) => (
                  <SelectItem key={epic.id} value={epic.id}>
                    <div className="flex items-center gap-2">
                      <EpicIcon color={epic.color} size="sm" />
                      <span>{epic.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={onRequestCreateEpic}
            >
              Create new epic
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Story["priority"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Epic Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details..."
              rows={3}
            />
          </div>

          {dateMode === "month" && (
            <div className="space-y-2">
              <Label htmlFor="due-month">Due month</Label>
              <Input
                id="due-month"
                type="month"
                value={dueMonth}
                onChange={(e) => setDueMonth(e.target.value)}
                required
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!hasEpics || !title.trim() || !epicId}>
              Create Story
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
