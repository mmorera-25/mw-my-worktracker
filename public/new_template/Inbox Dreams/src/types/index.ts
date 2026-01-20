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
  key: string;
  title: string;
  description: string;
  epicId: string;
  assignee?: User;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
  completedAt?: Date;
}

export interface Epic {
  id: string;
  key: string;
  name: string;
  description: string;
  color: string;
  isStarred: boolean;
  createdAt: Date;
}
