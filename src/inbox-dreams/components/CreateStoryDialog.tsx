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
import {
  Dialog as SubDialog,
  DialogContent as SubDialogContent,
  DialogFooter as SubDialogFooter,
  DialogHeader as SubDialogHeader,
  DialogTitle as SubDialogTitle,
} from "@inbox/components/ui/dialog";

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
  typeOfWorkOptions: string[];
  onAddTypeOfWork: (value: string) => void;
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
  typeOfWorkOptions,
  onAddTypeOfWork,
}: CreateStoryDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [epicId, setEpicId] = useState(selectedEpicId || "");
  const [priority, setPriority] = useState<Story["priority"]>("low");
  const [status, setStatus] = useState(defaultStatus);
  const [typeOfWork, setTypeOfWork] = useState("");
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [customTypeValue, setCustomTypeValue] = useState("");
  const [dueMonth, setDueMonth] = useState(format(new Date(), "yyyy-MM"));
  const titleRef = useRef<HTMLInputElement | null>(null);
  const availableEpics = epics.filter((epic) => !epic.isArchived);
  const noEpicId = availableEpics.find(
    (epic) =>
      epic.id === "no-epic-assigned" ||
      epic.name.toLowerCase() === "no epic assigned"
  )?.id;
  const defaultEpicId =
    availableEpics.find((epic) => epic.id === selectedEpicId)?.id ??
    noEpicId ??
    availableEpics[0]?.id ??
    "";
  const hasEpics = availableEpics.length > 0;

  useEffect(() => {
    if (open) {
      setEpicId(defaultEpicId);
      setTitle(initialTitle || "");
      const shouldDefaultToTodo = !selectedEpicId;
      const nextStatus = isYearly
        ? statusOptions.includes("Backlog")
          ? "Backlog"
          : defaultStatus
        : shouldDefaultToTodo && statusOptions.includes("To Do")
        ? "To Do"
        : defaultStatus;
      setStatus(nextStatus);
      setTypeOfWork("");
      setCustomTypeValue("");
      setDueMonth(format(new Date(), "yyyy-MM"));
      requestAnimationFrame(() => titleRef.current?.focus());
    }
  }, [open, defaultEpicId, initialTitle, defaultStatus, selectedEpicId, statusOptions, isYearly]);

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
      typeOfWork: typeOfWork.trim(),
    });

    setTitle("");
    setDescription("");
    setEpicId(defaultEpicId);
    setPriority("low");
    setStatus(defaultStatus);
    setTypeOfWork("");
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
            <Label htmlFor="type-of-work">Type of work</Label>
            <Select
              value={typeOfWork}
              onValueChange={(value) => {
                if (value === "__other__") {
                  setIsTypeModalOpen(true);
                  return;
                }
                setTypeOfWork(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type of work" />
              </SelectTrigger>
              <SelectContent>
                {typeOfWorkOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
                <SelectItem value="__other__">Other...</SelectItem>
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

      <SubDialog open={isTypeModalOpen} onOpenChange={setIsTypeModalOpen}>
        <SubDialogContent className="sm:max-w-sm">
          <SubDialogHeader>
            <SubDialogTitle>Add type of work</SubDialogTitle>
          </SubDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="custom-type">Type of work</Label>
            <Input
              id="custom-type"
              value={customTypeValue}
              onChange={(e) => setCustomTypeValue(e.target.value)}
              placeholder="Enter a custom type"
            />
          </div>
          <SubDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsTypeModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                const next = customTypeValue.trim();
                if (!next) return;
                onAddTypeOfWork(next);
                setTypeOfWork(next);
                setCustomTypeValue("");
                setIsTypeModalOpen(false);
              }}
            >
              Save
            </Button>
          </SubDialogFooter>
        </SubDialogContent>
      </SubDialog>
    </Dialog>
  );
}
