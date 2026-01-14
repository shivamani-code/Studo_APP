
export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LEAVE = 'LEAVE',
  NONE = 'NONE'
}

export interface AttendanceRecord {
  date: string; // ISO string
  status: AttendanceStatus;
  remark?: string;
  proofUrl?: string;
  proofName?: string;
  leaveCounted?: boolean;
}

export interface Subject {
  id: string;
  name: string;
  totalClasses: number;
  attendedClasses: number;
  targetPercentage: number;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
  createdAt: number; // Timestamp for sorting
}

export interface Habit {
  id: string;
  name: string;
  streak: number;
  lastChecked: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  progress: number;
  instructor?: string;
}

export interface Exam {
  id: string;
  subjectId: string;
  name: string;
  date: string; // ISO
}

export interface UserProfile {
  name: string;
  university: string;
  department?: string;
  course: string;
  className?: string;
  year?: number;
  semester: number;
  semesterStartDate?: string;
  semesterEndDate?: string;
  section?: string;
  rollNumber?: string;
  avatar: string;
}

// Normal attendance tracking without subjects
export interface AttendanceDay {
  date: string;
  totalClasses: number;
  attendedClasses: number;
  status: AttendanceStatus;
  remark?: string;
  proofUrl?: string;
  proofName?: string;
  leaveCounted?: boolean;
}

// Queue items for focus section
export interface QueueItem {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  completed: boolean;
  createdAt: number;
}
