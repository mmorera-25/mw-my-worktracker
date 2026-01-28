export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  initials: string;
  color: string;
}

export interface Story {
  id: string;
  storyCode?: string;
  key: string;
  title: string;
  description: string;
  epicId: string;
  discussed?: boolean;
  startDate?: Date;
  dueDates: Date[];
  typeOfWork?: string;
  assignee?: User;
  status: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  isYearly?: boolean;
  isDeleted?: boolean;
  deletedAt?: Date;
  completedAt?: Date;
  comments?: StoryComment[];
  attachments?: StoryAttachment[];
}

export interface Epic {
  id: string;
  key: string;
  name: string;
  description: string;
  color: string;
  isStarred: boolean;
  isArchived?: boolean;
  createdAt: Date;
}

export interface StoryComment {
  id: string;
  text: string;
  createdAt: Date;
  meetingDate?: number;
  isCompleted?: boolean;
}

export interface StoryAttachment {
  id: string;
  name: string;
  path: string;
}
