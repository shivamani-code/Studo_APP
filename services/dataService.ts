import { Subject, Habit, Task, Course, Exam, UserProfile, AttendanceStatus, AttendanceDay, QueueItem } from '../types';

const ACTIVE_USER_KEY = 'studo_active_user_id';

const STORAGE_KEYS = {
  USER_PROFILE: 'studo_user_profile',
  SUBJECTS: 'studo_subjects',
  ATTENDANCE_DAYS: 'studo_attendance_days',
  QUEUE_ITEMS: 'studo_queue_items',
  HABITS: 'studo_habits',
  TASKS: 'studo_tasks',
  COURSES: 'studo_courses',
  EXAMS: 'studo_exams',
  CONTACT_SUBMISSIONS: 'studo_contact_submissions',
  FOCUS_SESSIONS: 'studo_focus_sessions',
  HABIT_CHECKS: 'studo_habit_checks',
  IMPORTANT_DATES: 'studo_important_dates'
};

const getActiveUserId = () => localStorage.getItem(ACTIVE_USER_KEY) || 'guest';
const scopedKey = (key: string) => `${key}__${getActiveUserId()}`;
const getItem = (key: string) => localStorage.getItem(scopedKey(key)) ?? localStorage.getItem(key);
const setItem = (key: string, value: string) => localStorage.setItem(scopedKey(key), value);
const removeItem = (key: string) => {
  localStorage.removeItem(scopedKey(key));
  localStorage.removeItem(key);
};

export class DataService {
  private static dispatchDataUpdated(): void {
    try {
      window.dispatchEvent(new Event('studo_data_updated'));
    } catch {
      // noop
    }
  }

  private static safeParse<T>(raw: string | null, fallback: T): T {
    try {
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  static clampISODate(dateIso: string): string {
    return String(dateIso || '').slice(0, 10);
  }

  static getTodayISO(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  static parseISODateUTC(dateIso: string): Date | null {
    const s = this.clampISODate(dateIso);
    if (s.length !== 10) return null;
    const y = Number(s.slice(0, 4));
    const m = Number(s.slice(5, 7));
    const d = Number(s.slice(8, 10));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return new Date(Date.UTC(y, m - 1, d));
  }

  static countWorkingDaysUTC(startIso: string, endIso: string): number {
    const start = this.parseISODateUTC(startIso);
    const end = this.parseISODateUTC(endIso);
    if (!start || !end) return 0;
    if (start.getTime() > end.getTime()) return 0;
    let count = 0;
    const cur = new Date(start);
    while (cur.getTime() <= end.getTime()) {
      if (cur.getUTCDay() !== 0) count += 1;
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return count;
  }

  static getCurrentMonthKey(): string {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ];
    const now = new Date();
    const year = now.getFullYear();
    const monthName = monthNames[now.getMonth()] || 'January';
    return `${monthName} ${year}`;
  }

  static getMonthKeyFromISO(dateIso: string): string {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ];
    const y = Number(String(dateIso || '').slice(0, 4));
    const m1 = Number(String(dateIso || '').slice(5, 7));
    const year = Number.isFinite(y) ? y : new Date().getFullYear();
    const monthIndex = Number.isFinite(m1) ? Math.min(12, Math.max(1, m1)) - 1 : 0;
    return `${monthNames[monthIndex]} ${year}`;
  }

  static getYearMonthFromMonthKey(monthKey: string): string {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ];

    const raw = String(monthKey || '').trim();
    if (!raw) return '0000-00';
    const parts = raw.split(' ');
    const year = Number(parts[parts.length - 1]);
    const monthName = parts.slice(0, parts.length - 1).join(' ');
    const monthIndex = monthNames.findIndex((m) => m.toLowerCase() === monthName.toLowerCase());
    const mm = String(monthIndex >= 0 ? monthIndex + 1 : 0).padStart(2, '0');
    const yyyy = String(Number.isFinite(year) ? year : 0).padStart(4, '0');
    return `${yyyy}-${mm}`;
  }

  static getMonthRangeFromMonthKey(monthKey: string): { start: string; end: string } | null {
    const ym = this.getYearMonthFromMonthKey(monthKey);
    const yyyy = Number(ym.slice(0, 4));
    const mm = Number(ym.slice(5, 7));
    if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || mm < 1 || mm > 12) return null;
    const start = `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-01`;
    const endDate = new Date(Date.UTC(yyyy, mm, 0));
    const end = endDate.toISOString().slice(0, 10);
    return { start, end };
  }

  static setActiveUserId(userId: string | null): void {
    if (userId) {
      localStorage.setItem(ACTIVE_USER_KEY, userId);
      this.migrateLegacyDataToCurrentUser();
    } else {
      localStorage.removeItem(ACTIVE_USER_KEY);
    }
  }

  static getActiveUserId(): string {
    return getActiveUserId();
  }

  static clearCurrentUserData(): void {
    Object.values(STORAGE_KEYS).forEach((key) => removeItem(key));
  }

  static migrateLegacyDataToCurrentUser(): void {
    const activeUserId = getActiveUserId();
    if (!activeUserId || activeUserId === 'guest') return;

    Object.values(STORAGE_KEYS).forEach((key) => {
      const legacy = localStorage.getItem(key);
      const scoped = localStorage.getItem(scopedKey(key));
      if (legacy && !scoped) {
        setItem(key, legacy);
      }
      if (legacy) {
        localStorage.removeItem(key);
      }
    });
  }

  // User Profile
  static getUserProfile(): UserProfile | null {
    const data = getItem(STORAGE_KEYS.USER_PROFILE);
    return data ? JSON.parse(data) : null;
  }

  static saveUserProfile(profile: UserProfile): void {
    setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    try {
      window.dispatchEvent(new Event('studo_profile_updated'));
    } catch {
      // noop
    }
    this.dispatchDataUpdated();
  }

  // Subjects (kept for compatibility but not used in attendance)
  static getSubjects(): Subject[] {
    const data = getItem(STORAGE_KEYS.SUBJECTS);
    if (!data) {
      // Initialize with default subjects
      const defaultSubjects: Subject[] = [
        { id: '1', name: 'Mathematics-IV', totalClasses: 45, attendedClasses: 38, targetPercentage: 75 },
        { id: '2', name: 'Computer Architecture', totalClasses: 40, attendedClasses: 28, targetPercentage: 75 },
        { id: '3', name: 'Data Structures', totalClasses: 50, attendedClasses: 48, targetPercentage: 75 },
        { id: '4', name: 'Web Development', totalClasses: 35, attendedClasses: 20, targetPercentage: 75 },
      ];
      this.saveSubjects(defaultSubjects);
      return defaultSubjects;
    }
    return JSON.parse(data);
  }

  static saveSubjects(subjects: Subject[]): void {
    setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
    this.dispatchDataUpdated();
  }

  static updateSubject(id: string, updates: Partial<Subject>): void {
    const subjects = this.getSubjects();
    const index = subjects.findIndex(s => s.id === id);
    if (index !== -1) {
      subjects[index] = { ...subjects[index], ...updates };
      this.saveSubjects(subjects);
    }
  }

  // Normal Attendance Days (new implementation)
  static getAttendanceDays(): AttendanceDay[] {
    return this.safeParse<AttendanceDay[]>(getItem(STORAGE_KEYS.ATTENDANCE_DAYS), []);
  }

  static saveAttendanceDay(day: AttendanceDay): void {
    const date = String(day?.date || '').slice(0, 10);
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (!date || date > today) return;

    const totalClasses = Math.max(0, Number(day?.totalClasses ?? 1));
    const status = day?.status;
    const leaveCounted = Boolean(day?.leaveCounted);
    const attendedClasses = status === AttendanceStatus.PRESENT
      ? totalClasses
      : status === AttendanceStatus.LEAVE
        ? (leaveCounted ? totalClasses : 0)
        : 0;

    const normalized: AttendanceDay = {
      ...day,
      date,
      totalClasses,
      attendedClasses,
      leaveCounted: status === AttendanceStatus.LEAVE ? leaveCounted : undefined
    };

    const days = this.getAttendanceDays();
    const existingIndex = days.findIndex(d => d.date === date);
    
    if (existingIndex !== -1) {
      days[existingIndex] = normalized;
    } else {
      days.push(normalized);
    }
    
    setItem(STORAGE_KEYS.ATTENDANCE_DAYS, JSON.stringify(days));
    window.dispatchEvent(new Event('studo_attendance_updated'));
    this.dispatchDataUpdated();
  }

  static updateAttendanceDay(date: string, updates: Partial<AttendanceDay>): void {
    const dateIso = String(date || '').slice(0, 10);
    if (!dateIso) return;

    const days = this.getAttendanceDays();
    const index = days.findIndex(d => d.date === dateIso);
    if (index === -1) return;

    const merged: AttendanceDay = { ...days[index], ...updates, date: dateIso };
    this.saveAttendanceDay(merged);
  }

  static deleteAttendanceDay(date: string): void {
    const dateIso = String(date || '').slice(0, 10);
    if (!dateIso) return;

    const days = this.getAttendanceDays();
    const filtered = days.filter(d => d.date !== dateIso);
    setItem(STORAGE_KEYS.ATTENDANCE_DAYS, JSON.stringify(filtered));
    window.dispatchEvent(new Event('studo_attendance_updated'));
    this.dispatchDataUpdated();
  }

  // Queue Items Management
  static getQueueItems(): QueueItem[] {
    const data = getItem(STORAGE_KEYS.QUEUE_ITEMS);
    if (!data) {
      const defaultQueueItems: QueueItem[] = [
        {
          id: '1',
          title: 'Complete Mathematics Assignment',
          description: 'Chapter 5 problems 1-20',
          priority: 'high',
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          completed: false,
          createdAt: Date.now()
        },
        {
          id: '2',
          title: 'Review Computer Architecture Notes',
          description: 'Prepare for upcoming quiz',
          priority: 'medium',
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          completed: false,
          createdAt: Date.now()
        },
        {
          id: '3',
          title: 'Data Structures Lab Report',
          description: 'Complete lab report for sorting algorithms',
          priority: 'low',
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          completed: false,
          createdAt: Date.now()
        }
      ];
      this.saveQueueItems(defaultQueueItems);
      return defaultQueueItems;
    }
    return JSON.parse(data);
  }

  static saveQueueItems(items: QueueItem[]): void {
    setItem(STORAGE_KEYS.QUEUE_ITEMS, JSON.stringify(items));
    this.dispatchDataUpdated();
  }

  static addQueueItem(item: Omit<QueueItem, 'id' | 'createdAt'>): void {
    const items = this.getQueueItems();
    const newItem: QueueItem = {
      ...item,
      id: Date.now().toString(),
      createdAt: Date.now()
    };
    items.push(newItem);
    this.saveQueueItems(items);
  }

  static updateQueueItem(id: string, updates: Partial<QueueItem>): void {
    const items = this.getQueueItems();
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates };
      this.saveQueueItems(items);
    }
  }

  static deleteQueueItem(id: string): void {
    const items = this.getQueueItems();
    const filtered = items.filter(item => item.id !== id);
    this.saveQueueItems(filtered);
  }

  static toggleQueueItem(id: string): void {
    const items = this.getQueueItems();
    const item = items.find(item => item.id === id);
    if (item) {
      item.completed = !item.completed;
      this.saveQueueItems(items);
    }
  }

  // Habits
  static getHabits(): Habit[] {
    const data = getItem(STORAGE_KEYS.HABITS);
    if (!data) {
      const defaultHabits: Habit[] = [
        { id: '1', name: 'Morning Study Session', streak: 0, lastChecked: '' },
        { id: '2', name: 'Complete Assignments', streak: 0, lastChecked: '' },
        { id: '3', name: 'Review Notes', streak: 0, lastChecked: '' },
      ];
      this.saveHabits(defaultHabits);
      return defaultHabits;
    }
    return JSON.parse(data);
  }

  static saveHabits(habits: Habit[]): void {
    setItem(STORAGE_KEYS.HABITS, JSON.stringify(habits));
    this.dispatchDataUpdated();
  }

  static updateHabit(id: string, updates: Partial<Habit>): void {
    const habits = this.getHabits();
    const index = habits.findIndex(h => h.id === id);
    if (index !== -1) {
      habits[index] = { ...habits[index], ...updates };
      this.saveHabits(habits);
    }
  }

  static checkInHabit(id: string): void {
    const habits = this.getHabits();
    const habit = habits.find(h => h.id === id);
    if (!habit) return;

    const today = new Date().toISOString().split('T')[0];
    const lastChecked = habit.lastChecked.split('T')[0];
    
    let newStreak = habit.streak;
    if (lastChecked !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      if (lastChecked === yesterdayStr) {
        newStreak += 1;
      } else {
        newStreak = 1;
      }
    }

    this.updateHabit(id, {
      streak: newStreak,
      lastChecked: new Date().toISOString()
    });
  }

  // Tasks
  static getTasks(): Task[] {
    const data = getItem(STORAGE_KEYS.TASKS);
    return data ? JSON.parse(data) : [];
  }

  static saveTasks(tasks: Task[]): void {
    setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    this.dispatchDataUpdated();
  }

  static addTask(task: Omit<Task, 'id' | 'createdAt'>): void {
    const tasks = this.getTasks();
    const newTask: Task = {
      ...task,
      id: Date.now().toString(),
      createdAt: Date.now()
    };
    tasks.push(newTask);
    this.saveTasks(tasks);
  }

  static updateTask(id: string, updates: Partial<Task>): void {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      tasks[index] = { ...tasks[index], ...updates };
      this.saveTasks(tasks);
    }
  }

  static deleteTask(id: string): void {
    const tasks = this.getTasks();
    const filtered = tasks.filter(t => t.id !== id);
    this.saveTasks(filtered);
  }

  // Focus sessions (PersonalSpace)
  static getFocusSessions<T = any[]>(): T {
    return this.safeParse<T>(getItem(STORAGE_KEYS.FOCUS_SESSIONS), [] as any);
  }

  static saveFocusSessions(sessions: unknown): void {
    setItem(STORAGE_KEYS.FOCUS_SESSIONS, JSON.stringify(sessions ?? []));
    try {
      window.dispatchEvent(new Event('studo_focus_updated'));
    } catch {
      // noop
    }
    this.dispatchDataUpdated();
  }

  // Habit checks (MonthlyHabitTracker)
  static getHabitChecks<T = any[]>(): T {
    return this.safeParse<T>(getItem(STORAGE_KEYS.HABIT_CHECKS), [] as any);
  }

  static saveHabitChecks(checks: unknown): void {
    setItem(STORAGE_KEYS.HABIT_CHECKS, JSON.stringify(checks ?? []));
    this.dispatchDataUpdated();
  }

  // Important dates (AcademicQueue)
  static getImportantDates<T = any[]>(): T {
    return this.safeParse<T>(getItem(STORAGE_KEYS.IMPORTANT_DATES), [] as any);
  }

  static saveImportantDates(dates: unknown): void {
    setItem(STORAGE_KEYS.IMPORTANT_DATES, JSON.stringify(dates ?? []));
    this.dispatchDataUpdated();
  }

  // Courses
  static getCourses(): Course[] {
    const data = getItem(STORAGE_KEYS.COURSES);
    if (!data) {
      const defaultCourses: Course[] = [
        { id: '1', name: 'Advanced React Patterns', code: 'CS301', progress: 65 },
        { id: '2', name: 'Cloud Computing', code: 'CS402', progress: 40 },
      ];
      this.saveCourses(defaultCourses);
      return defaultCourses;
    }
    return JSON.parse(data);
  }

  static saveCourses(courses: Course[]): void {
    setItem(STORAGE_KEYS.COURSES, JSON.stringify(courses));
    this.dispatchDataUpdated();
  }

  static updateCourse(id: string, updates: Partial<Course>): void {
    const courses = this.getCourses();
    const index = courses.findIndex(c => c.id === id);
    if (index !== -1) {
      courses[index] = { ...courses[index], ...updates };
      this.saveCourses(courses);
    }
  }

  // Exams
  static getExams(): Exam[] {
    const data = getItem(STORAGE_KEYS.EXAMS);
    return data ? JSON.parse(data) : [];
  }

  static saveExams(exams: Exam[]): void {
    setItem(STORAGE_KEYS.EXAMS, JSON.stringify(exams));
    this.dispatchDataUpdated();
  }

  static addExam(exam: Omit<Exam, 'id'>): void {
    const exams = this.getExams();
    const newExam: Exam = {
      ...exam,
      id: Date.now().toString()
    };
    exams.push(newExam);
    this.saveExams(exams);
  }

  static deleteExam(id: string): void {
    const exams = this.getExams();
    const filtered = exams.filter(e => e.id !== id);
    this.saveExams(filtered);
  }

  // Contact Submissions
  static saveContactSubmission(submission: { name: string; email: string; description: string }): void {
    const submissions = this.getContactSubmissions();
    submissions.push({
      ...submission,
      id: Date.now().toString(),
      timestamp: new Date().toISOString()
    });
    setItem(STORAGE_KEYS.CONTACT_SUBMISSIONS, JSON.stringify(submissions));
    this.dispatchDataUpdated();
  }

  static getContactSubmissions(): any[] {
    const data = getItem(STORAGE_KEYS.CONTACT_SUBMISSIONS);
    return data ? JSON.parse(data) : [];
  }

  // Analytics for Normal Attendance
  static getAttendanceAnalytics() {
    const days = this.getAttendanceDays();
    const totalDays = days.length;
    const presentDays = days.filter(d => d.status === AttendanceStatus.PRESENT).length;
    const absentDays = days.filter(d => d.status === AttendanceStatus.ABSENT).length;
    const leaveDays = days.filter(d => d.status === AttendanceStatus.LEAVE).length;
    const totalClasses = days.reduce((sum, d) => sum + d.totalClasses, 0);
    const totalAttended = days.reduce((sum, d) => sum + d.attendedClasses, 0);
    
    const overallPercentage = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 0;
    
    return {
      totalDays,
      presentDays,
      absentDays,
      leaveDays,
      totalClasses,
      totalAttended,
      overallPercentage,
      monthlyStats: this.getMonthlyStats(days)
    };
  }

  static getAttendanceDaysInRange(startDate: string, endDate: string): AttendanceDay[] {
    const start = String(startDate || '').slice(0, 10);
    const end = String(endDate || '').slice(0, 10);
    if (!start || !end) return [];
    const days = this.getAttendanceDays();
    return days.filter((d) => d.date >= start && d.date <= end);
  }

  static getAttendanceAnalyticsForRange(startDate: string, endDate: string) {
    const days = this.getAttendanceDaysInRange(startDate, endDate);
    const totalDays = days.length;
    const presentDays = days.filter(d => d.status === AttendanceStatus.PRESENT).length;
    const absentDays = days.filter(d => d.status === AttendanceStatus.ABSENT).length;
    const leaveDays = days.filter(d => d.status === AttendanceStatus.LEAVE).length;
    const totalClasses = days.reduce((sum, d) => sum + (d.totalClasses || 0), 0);
    const totalAttended = days.reduce((sum, d) => sum + (d.attendedClasses || 0), 0);
    const overallPercentage = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 100) : 0;
    return {
      totalDays,
      presentDays,
      absentDays,
      leaveDays,
      totalClasses,
      totalAttended,
      overallPercentage,
      monthlyStats: this.getMonthlyStats(days)
    };
  }

  static getSemesterAttendanceSummary(targetPercentage: number = 75) {
    const profile = this.getUserProfile();
    const start = profile?.semesterStartDate;
    const end = profile?.semesterEndDate;

    const startIso = this.clampISODate(String(start || ''));
    const endIso = this.clampISODate(String(end || ''));

    if (!startIso || !endIso || startIso.length !== 10 || endIso.length !== 10 || startIso > endIso) {
      const a = this.getAttendanceAnalytics();
      return {
        configured: false,
        startDate: startIso || '',
        endDate: endIso || '',
        totalClasses: a.totalClasses,
        totalAttended: a.totalAttended,
        percentage: a.overallPercentage,
        possibleLeaves: 0
      };
    }

    const a = this.getAttendanceAnalyticsForRange(startIso, endIso);

    const avgClassesPerDay = a.totalDays > 0 ? a.totalClasses / a.totalDays : 4;
    const safeLeavesByClasses = avgClassesPerDay > 0
      ? Math.floor((a.totalAttended / (targetPercentage / 100) - a.totalClasses) / avgClassesPerDay)
      : 0;

    const today = this.getTodayISO();
    const todayDt = this.parseISODateUTC(today);
    const endDt = this.parseISODateUTC(endIso);
    const remainingCalendarDays = todayDt && endDt && today <= endIso
      ? Math.floor((endDt.getTime() - todayDt.getTime()) / (24 * 60 * 60 * 1000)) + 1
      : 0;

    const possibleLeaves = Math.max(0, Math.min(safeLeavesByClasses, remainingCalendarDays));

    return {
      configured: true,
      startDate: startIso,
      endDate: endIso,
      totalClasses: a.totalClasses,
      totalAttended: a.totalAttended,
      percentage: a.overallPercentage,
      possibleLeaves
    };
  }

  private static getMonthlyStats(days: AttendanceDay[]) {
    const buckets = new Map<string, { displayKey: string; total: number; present: number }>();

    days.forEach((day) => {
      const dateIso = String(day.date || '').slice(0, 10);
      const ym = String(dateIso || '').slice(0, 7);
      const displayKey = this.getMonthKeyFromISO(dateIso);
      if (!buckets.has(ym)) {
        buckets.set(ym, { displayKey, total: 0, present: 0 });
      }
      const b = buckets.get(ym)!;
      b.total += Number(day.totalClasses || 0);
      b.present += Number(day.attendedClasses || 0);
    });

    const monthlyStats: { [key: string]: { total: number; present: number; percentage: number } } = {};
    const yms = Array.from(buckets.keys()).sort();
    yms.forEach((ym) => {
      const b = buckets.get(ym);
      if (!b) return;
      monthlyStats[b.displayKey] = {
        total: b.total,
        present: b.present,
        percentage: b.total > 0 ? Math.round((b.present / b.total) * 100) : 0
      };
    });

    return monthlyStats;
  }

  // Export/Import
  static exportData(): string {
    const data = {
      userProfile: this.getUserProfile(),
      subjects: this.getSubjects(),
      attendanceDays: this.getAttendanceDays(),
      queueItems: this.getQueueItems(),
      habits: this.getHabits(),
      tasks: this.getTasks(),
      courses: this.getCourses(),
      exams: this.getExams(),
      contactSubmissions: this.getContactSubmissions(),
      focusSessions: this.getFocusSessions(),
      habitChecks: this.getHabitChecks(),
      importantDates: this.getImportantDates()
    };
    return JSON.stringify(data, null, 2);
  }

  static importData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.userProfile) this.saveUserProfile(data.userProfile);
      if (data.subjects) this.saveSubjects(data.subjects);
      if (data.attendanceDays) {
        setItem(STORAGE_KEYS.ATTENDANCE_DAYS, JSON.stringify(data.attendanceDays));
      }
      if (data.queueItems) this.saveQueueItems(data.queueItems);
      if (data.habits) this.saveHabits(data.habits);
      if (data.tasks) this.saveTasks(data.tasks);
      if (data.courses) this.saveCourses(data.courses);
      if (data.exams) this.saveExams(data.exams);
      if (data.contactSubmissions) {
        setItem(STORAGE_KEYS.CONTACT_SUBMISSIONS, JSON.stringify(data.contactSubmissions));
      }
      if (data.focusSessions) {
        setItem(STORAGE_KEYS.FOCUS_SESSIONS, JSON.stringify(data.focusSessions));
      }
      if (data.habitChecks) {
        setItem(STORAGE_KEYS.HABIT_CHECKS, JSON.stringify(data.habitChecks));
      }
      if (data.importantDates) {
        setItem(STORAGE_KEYS.IMPORTANT_DATES, JSON.stringify(data.importantDates));
      }

      if (data.attendanceDays) {
        try {
          window.dispatchEvent(new Event('studo_attendance_updated'));
        } catch {
          // noop
        }
      }
      if (data.userProfile) {
        try {
          window.dispatchEvent(new Event('studo_profile_updated'));
        } catch {
          // noop
        }
      }
      if (data.focusSessions) {
        try {
          window.dispatchEvent(new Event('studo_focus_updated'));
        } catch {
          // noop
        }
      }
      this.dispatchDataUpdated();
      
      return true;
    } catch (error) {
      console.error('Import failed:', error);
      return false;
    }
  }
}
