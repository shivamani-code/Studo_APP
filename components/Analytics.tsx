import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { AttendanceDay, AttendanceStatus, Subject, Task, Habit, QueueItem, Course, Exam } from '../types';
import { Activity, BarChart3, CalendarDays, ClipboardList, Layers, ListTodo, Radar, Sparkles } from 'lucide-react';
import { DataService } from '../services/dataService';
import AttendanceCalendar from './AttendanceCalendar';

interface Props {
  subjects: Subject[];
  fullWidth?: boolean;
}

const Analytics: React.FC<Props> = ({ subjects, fullWidth = false }) => {
  const [attendanceAnalytics, setAttendanceAnalytics] = useState<any>(null);
  const [attendanceDays, setAttendanceDays] = useState<AttendanceDay[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [focusSessions, setFocusSessions] = useState<any[]>([]);
  const [semesterStart, setSemesterStart] = useState<string | undefined>(undefined);
  const [semesterEnd, setSemesterEnd] = useState<string | undefined>(undefined);

  const loadAll = () => {
    const profile = DataService.getUserProfile();
    const start = profile?.semesterStartDate;
    const end = profile?.semesterEndDate;
    const startIso = start ? DataService.clampISODate(String(start)) : '';
    const endIso = end ? DataService.clampISODate(String(end)) : '';
    const ranged = Boolean(startIso && endIso && startIso <= endIso);

    setSemesterStart(ranged ? startIso : undefined);
    setSemesterEnd(ranged ? endIso : undefined);

    setAttendanceAnalytics(ranged ? DataService.getAttendanceAnalyticsForRange(startIso, endIso) : DataService.getAttendanceAnalytics());
    setAttendanceDays(ranged ? DataService.getAttendanceDaysInRange(startIso, endIso) : DataService.getAttendanceDays());
    setTasks(DataService.getTasks());
    setHabits(DataService.getHabits());
    setQueueItems(DataService.getQueueItems());
    setCourses(DataService.getCourses());
    setExams(DataService.getExams());

    setFocusSessions(DataService.getFocusSessions());
  };

  useEffect(() => {
    loadAll();
  }, [subjects]);

  useEffect(() => {
    const onAttendanceUpdated = () => loadAll();
    const onProfileUpdated = () => loadAll();
    const onFocusUpdated = () => loadAll();
    const onDataUpdated = () => loadAll();
    window.addEventListener('studo_attendance_updated', onAttendanceUpdated);
    window.addEventListener('studo_profile_updated', onProfileUpdated);
    window.addEventListener('studo_focus_updated', onFocusUpdated);
    window.addEventListener('studo_data_updated', onDataUpdated);
    return () => {
      window.removeEventListener('studo_attendance_updated', onAttendanceUpdated);
      window.removeEventListener('studo_profile_updated', onProfileUpdated);
      window.removeEventListener('studo_focus_updated', onFocusUpdated);
      window.removeEventListener('studo_data_updated', onDataUpdated);
    };
  }, []);

  const iso = (d: Date) => d.toISOString().split('T')[0];

  const safeNumber = (n: any, fallback: number = 0) => {
    const v = Number(n);
    return Number.isFinite(v) ? v : fallback;
  };

  const safeUpper = (s: any, maxLen: number) => {
    const str = String(s ?? '');
    const trimmed = str.trim() || 'NO_DATA';
    return trimmed.slice(0, maxLen).toUpperCase();
  };

  const safeDateMs = (dateLike: any) => {
    const d = new Date(String(dateLike || ''));
    const t = d.getTime();
    return Number.isFinite(t) ? t : null;
  };

  const safeExamLabel = (dateLike: any) => {
    const t = safeDateMs(dateLike);
    if (t === null) return 'NO_DATE';
    return new Date(t).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }).toUpperCase();
  };

  const formatFocus = (seconds: number) => {
    const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const overallAttendance = useMemo(() => {
    const total = attendanceDays.reduce((acc, d) => acc + (d.totalClasses || 0), 0);
    const present = attendanceDays.reduce((acc, d) => acc + (d.attendedClasses || 0), 0);
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, percentage };
  }, [attendanceDays]);

  const last14Trend = useMemo(() => {
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const today = new Date();
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (13 - i));
      return d;
    });
    return days.map((d) => {
      const dateStr = iso(d);
      const day = attendanceDays.find(x => x.date === dateStr);
      const totalClasses = day?.totalClasses ?? 0;
      const presentClasses = day?.attendedClasses ?? 0;
      const percentage = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;
      return { name: dayNames[d.getDay()], date: dateStr, perc: percentage };
    });
  }, [attendanceDays]);

  const monthlyAttendance = useMemo(() => {
    const stats = attendanceAnalytics?.monthlyStats;
    if (!stats) return [];
    const rows = Object.entries(stats).map(([monthKey, v]: any) => {
      const ym = DataService.getYearMonthFromMonthKey(monthKey);
      const yy = ym.slice(2, 4);
      const label = `${String(monthKey || '').split(' ')[0].slice(0, 3).toUpperCase()} '${yy}`;
      return {
        name: label,
        perc: safeNumber(v?.percentage, 0),
        monthKey: String(monthKey || ''),
        ym
      };
    });
    rows.sort((a, b) => String(a.ym).localeCompare(String(b.ym)));
    return rows;
  }, [attendanceAnalytics]);

  const attendanceStatusDistribution = useMemo(() => {
    const counts: Record<string, number> = { PRESENT: 0, ABSENT: 0, LEAVE: 0 };
    attendanceDays.forEach(d => {
      if (d.status === AttendanceStatus.PRESENT) counts.PRESENT += 1;
      if (d.status === AttendanceStatus.ABSENT) counts.ABSENT += 1;
      if (d.status === AttendanceStatus.LEAVE) counts.LEAVE += 1;
    });
    return [
      { name: 'PRESENT', value: counts.PRESENT, color: '#ededed' },
      { name: 'ABSENT', value: counts.ABSENT, color: '#f43f5e' },
      { name: 'LEAVE', value: counts.LEAVE, color: '#d4af37' }
    ].filter(x => x.value > 0);
  }, [attendanceDays]);

  const tasksSummary = useMemo(() => {
    const completed = tasks.filter(t => t.completed).length;
    return { total: tasks.length, completed, pending: tasks.length - completed };
  }, [tasks]);

  const tasksDueNext7 = useMemo(() => {
    const today = new Date();
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const windowDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });

    return windowDays.map(d => {
      const dateStr = iso(d);
      const due = tasks.filter(t => {
        if (!t.dueDate) return false;
        return t.dueDate.split('T')[0] === dateStr && !t.completed;
      }).length;
      return { name: dayNames[d.getDay()], date: dateStr, due };
    });
  }, [tasks]);

  const tasksCompletionDistribution = useMemo(() => {
    return [
      { name: 'DONE', value: tasksSummary.completed, color: '#ededed' },
      { name: 'PENDING', value: tasksSummary.pending, color: '#d4af37' }
    ].filter(x => x.value > 0);
  }, [tasksSummary.completed, tasksSummary.pending]);

  const queueSummary = useMemo(() => {
    const pending = queueItems.filter(i => !i.completed).length;
    return { total: queueItems.length, pending };
  }, [queueItems]);

  const focusTime = useMemo(() => {
    const todayStr = iso(new Date());
    const monthKey = todayStr.slice(0, 7);
    let today = 0;
    let month = 0;

    for (const s of focusSessions) {
      const d = s?.date ? new Date(s.date) : null;
      const dateStr = d && !Number.isNaN(d.getTime()) ? iso(d) : '';
      const dur = Number(s?.duration ?? 0);
      if (!Number.isFinite(dur) || dur <= 0) continue;

      if (dateStr === todayStr) today += dur;
      if (dateStr.slice(0, 7) === monthKey) month += dur;
    }

    return { todaySeconds: today, monthSeconds: month };
  }, [focusSessions]);

  const queuePriorityDistribution = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    queueItems.forEach((i: any) => {
      const p = i?.priority;
      if (p === 'high' || p === 'medium' || p === 'low') counts[p] += 1;
    });
    return [
      { name: 'HIGH', value: counts.high, color: '#f43f5e' },
      { name: 'MED', value: counts.medium, color: '#d4af37' },
      { name: 'LOW', value: counts.low, color: '#888888' }
    ].filter(x => x.value > 0);
  }, [queueItems]);

  const queueCompletionDistribution = useMemo(() => {
    const done = queueItems.filter(i => i.completed).length;
    const pending = queueItems.length - done;
    return [
      { name: 'DONE', value: done, color: '#ededed' },
      { name: 'PENDING', value: pending, color: '#d4af37' }
    ].filter(x => x.value > 0);
  }, [queueItems]);

  const habitsSummary = useMemo(() => {
    const todayStr = iso(new Date());
    const checkedToday = habits.filter(h => (h.lastChecked || '').split('T')[0] === todayStr).length;
    return { total: habits.length, checkedToday };
  }, [habits]);

  const topHabitStreaks = useMemo(() => {
    return [...habits]
      .sort((a, b) => (b.streak || 0) - (a.streak || 0))
      .slice(0, 8)
      .map(h => ({ name: safeUpper((h as any)?.name, 14), streak: safeNumber((h as any)?.streak, 0) }));
  }, [habits]);

  const habitStreakChart = useMemo(() => {
    const base = topHabitStreaks;
    const maxStreak = base.reduce((m, x) => Math.max(m, safeNumber((x as any)?.streak, 0)), 0);
    const data = (base.length ? base : [{ name: 'NO_DATA', streak: 0 }]).map((x: any) => {
      const streak = safeNumber(x?.streak, 0);
      return {
        name: safeUpper(x?.name, 14),
        streak,
        vizStreak: maxStreak > 0 ? streak : 1
      };
    });
    return { data, maxStreak };
  }, [topHabitStreaks]);

  const currentMonthAttendance = useMemo(() => {
    const stats = attendanceAnalytics?.monthlyStats;
    const monthKey = DataService.getMonthKeyFromISO(DataService.getTodayISO());
    const m = stats && (stats as any)[monthKey] ? (stats as any)[monthKey] : null;
    const total = safeNumber(m?.total, 0);
    const present = safeNumber(m?.present, 0);
    const percentage = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;
    return { monthKey, total, present, absent: Math.max(0, total - present), percentage, hasData: Boolean(m) };
  }, [attendanceAnalytics]);

  const semToDateAttendance = useMemo(() => {
    const todayIso = DataService.getTodayISO();
    const start = String(semesterStart || '').slice(0, 10);
    const end = String(semesterEnd || '').slice(0, 10);
    const ranged = Boolean(start && end);
    const toDateEnd = ranged && end && todayIso > end ? end : todayIso;
    const days = ranged
      ? DataService.getAttendanceDaysInRange(start, toDateEnd)
      : DataService.getAttendanceDays();

    const total = days.reduce((acc, d) => acc + safeNumber((d as any)?.totalClasses, 0), 0);
    const present = days.reduce((acc, d) => acc + safeNumber((d as any)?.attendedClasses, 0), 0);
    const percentage = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;
    return { total, present, absent: Math.max(0, total - present), percentage, ranged };
  }, [semesterStart, semesterEnd, attendanceDays]);

  const syncSummary = useMemo(() => {
    const avgProgress = courses.length > 0
      ? Math.round(courses.reduce((acc, c) => acc + (c.progress || 0), 0) / courses.length)
      : 0;
    const now = Date.now();
    const upcomingExams = exams.filter((e: any) => {
      const t = safeDateMs(e?.date);
      return t !== null && t >= now;
    }).length;
    return { avgProgress, upcomingExams };
  }, [courses, exams]);

  const courseProgressData = useMemo(() => {
    return courses
      .slice(0, 8)
      .map(c => ({
        name: safeUpper((c as any)?.code || (c as any)?.name, 10),
        progress: safeNumber((c as any)?.progress, 0)
      }));
  }, [courses]);

  const upcomingExamsSoon = useMemo(() => {
    const horizonMs = 45 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return [...exams]
      .filter((e: any) => {
        const t = safeDateMs(e?.date);
        return t !== null && t >= now && t <= now + horizonMs;
      })
      .sort((a: any, b: any) => {
        const ta = safeDateMs(a?.date) ?? 0;
        const tb = safeDateMs(b?.date) ?? 0;
        return ta - tb;
      })
      .slice(0, 6);
  }, [exams]);

  const forecastSignal = useMemo(() => {
    const target = 75;
    const current = overallAttendance.percentage;
    const gap = Math.max(0, target - current);
    const status = current >= target ? 'NOMINAL' : 'ALERT';
    return { target, current, gap, status };
  }, [overallAttendance.percentage]);

  const computeRangeForecast = (rangeStart: string, rangeEnd: string, targetPct: number) => {
    const start = DataService.clampISODate(String(rangeStart || ''));
    const end = DataService.clampISODate(String(rangeEnd || ''));
    if (!start || !end || start > end) {
      return { percentage: 0, gap: targetPct, recoverDays: 0, remainingDays: 0 };
    }

    const todayIso = DataService.getTodayISO();
    const toDateEnd = todayIso > end ? end : todayIso;
    if (start > toDateEnd) {
      const remainingDays = DataService.countWorkingDaysUTC(start, end);
      return { percentage: 0, gap: targetPct, recoverDays: 0, remainingDays };
    }

    const days = DataService.getAttendanceDaysInRange(start, toDateEnd);
    const activeDays = days.filter((d) => safeNumber((d as any)?.totalClasses, 0) > 0);
    const loggedTotal = activeDays.reduce((acc, d) => acc + safeNumber((d as any)?.totalClasses, 0), 0);
    const loggedAttended = activeDays.reduce((acc, d) => acc + safeNumber((d as any)?.attendedClasses, 0), 0);

    const total = Math.max(0, loggedTotal);
    const attended = Math.max(0, loggedAttended);
    const percentage = total > 0 ? (attended / total) * 100 : 0;

    const avg = activeDays.length > 0 ? total / activeDays.length : 4;

    const p = targetPct / 100;
    const neededClasses = percentage >= targetPct || p >= 1
      ? 0
      : Math.ceil(Math.max(0, (p * total - attended) / (1 - p)));
    const recoverDays = avg > 0 ? Math.ceil(neededClasses / avg) : 0;

    const todayInRange = todayIso >= start && todayIso <= end;
    const hasTodayMarked = todayInRange ? activeDays.some((d: any) => String(d?.date || '').slice(0, 10) === todayIso) : false;
    const base = DataService.parseISODateUTC(toDateEnd);
    const nextDay = base ? (() => {
      base.setUTCDate(base.getUTCDate() + 1);
      return base.toISOString().slice(0, 10);
    })() : toDateEnd;
    const futureStart = todayInRange && !hasTodayMarked ? todayIso : nextDay;
    const remainingDays = futureStart <= end ? DataService.countWorkingDaysUTC(futureStart, end) : 0;

    return {
      percentage,
      gap: Math.max(0, targetPct - percentage),
      recoverDays,
      remainingDays
    };
  };

  const forecastSem = useMemo(() => {
    if (!semesterStart || !semesterEnd) return null;
    return computeRangeForecast(semesterStart, semesterEnd, 75);
  }, [semesterStart, semesterEnd, attendanceDays]);

  const forecastMonth = useMemo(() => {
    const todayIso = DataService.getTodayISO();
    const monthKey = DataService.getMonthKeyFromISO(todayIso);
    const range = DataService.getMonthRangeFromMonthKey(monthKey);
    if (!range) return null;
    const semEnd = semesterEnd ? DataService.clampISODate(semesterEnd) : '';
    const end = semEnd && semEnd < range.end ? semEnd : range.end;
    return computeRangeForecast(range.start, end, 75);
  }, [semesterEnd, attendanceDays]);

  const chartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="bg-[#0a0a0a] text-[#ededed] p-4 border border-white/10 rounded-2xl shadow-3xl backdrop-blur-xl">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#555] mb-3 mono">{String(label).toUpperCase()}</p>
        <div className="space-y-1">
          {payload.map((p: any, idx: number) => (
            <div key={idx} className="text-xs font-bold flex items-center justify-between gap-12 mono">
              <span className="opacity-60">{String(p.name || p.dataKey).toUpperCase()}</span>
              <span className="text-white italic font-black">{
                p?.dataKey === 'vizStreak' && Number.isFinite(Number(p?.payload?.streak))
                  ? Number(p.payload.streak)
                  : p.value
              }</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-4 md:space-y-6 ${fullWidth ? 'p-0' : ''}`}>
      <div className="bg-[#0a0a0a] p-6 md:p-10 border border-white/[0.03] rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 blur-[110px] pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-[#d4af37]">
                <Radar size={20} />
              </div>
              <h3 className="serif-luxury text-2xl md:text-3xl uppercase tracking-tighter text-white">STUDENT_INTEL</h3>
            </div>
            <p className="text-[#888888] text-[10px] font-bold mono uppercase tracking-[0.4em] opacity-60">Attendance • Forecast • Focus • Habits • Tasks • Sync</p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex items-center gap-3 px-5 py-2.5 bg-black/40 border border-white/10 rounded-2xl text-[10px] font-black uppercase mono text-[#d4af37] tracking-widest shadow-xl"
          >
            <Sparkles size={14} /> FULL_SCAN
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-[#0a0a0a] p-5 md:p-6 border border-white/[0.03] rounded-[2rem] shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] mono text-[#666]">ATTENDANCE</p>
              <p className="mt-3 text-3xl md:text-4xl font-black tracking-tighter text-white">{overallAttendance.percentage}%</p>
              <p className="mt-2 text-[10px] font-bold mono uppercase tracking-widest text-[#777] opacity-70">{overallAttendance.present}/{overallAttendance.total} classes</p>
            </div>
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-[#d4af37]"><Activity size={18} /></div>
          </div>
        </div>
        <div className="bg-[#0a0a0a] p-5 md:p-6 border border-white/[0.03] rounded-[2rem] shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] mono text-[#666]">TASKS</p>
              <p className="mt-3 text-3xl md:text-4xl font-black tracking-tighter text-white">{tasksSummary.pending}</p>
              <p className="mt-2 text-[10px] font-bold mono uppercase tracking-widest text-[#777] opacity-70">{tasksSummary.completed} done / {tasksSummary.total} total</p>
            </div>
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-[#d4af37]"><ListTodo size={18} /></div>
          </div>
        </div>
        <div className="bg-[#0a0a0a] p-5 md:p-6 border border-white/[0.03] rounded-[2rem] shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] mono text-[#666]">FOCUS_QUEUE</p>
              <p className="mt-3 text-3xl md:text-4xl font-black tracking-tighter text-white">{queueSummary.pending}</p>
              <p className="mt-2 text-[10px] font-bold mono uppercase tracking-widest text-[#777] opacity-70">{queueSummary.total} queued</p>
            </div>
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-[#d4af37]"><ClipboardList size={18} /></div>
          </div>
        </div>
        <div className="bg-[#0a0a0a] p-5 md:p-6 border border-white/[0.03] rounded-[2rem] shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] mono text-[#666]">SYNC</p>
              <p className="mt-3 text-3xl md:text-4xl font-black tracking-tighter text-white">{syncSummary.avgProgress}%</p>
              <p className="mt-2 text-[10px] font-bold mono uppercase tracking-widest text-[#777] opacity-70">{syncSummary.upcomingExams} exams</p>
            </div>
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-[#d4af37]"><Layers size={18} /></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
        <div className="xl:col-span-2 bg-[#0a0a0a] p-6 md:p-10 border border-white/[0.03] rounded-[2.5rem] shadow-2xl">
          <div className="flex items-center justify-between gap-4 mb-6 md:mb-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/10 rounded-2xl"><BarChart3 size={20} className="text-indigo-300" /></div>
              <div>
                <h4 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white">ATTENDANCE_FLOW</h4>
                <p className="text-[#888888] text-[10px] font-bold mono uppercase tracking-[0.4em] opacity-60">Last 14 days (%)</p>
              </div>
            </div>
          </div>
          <div className="h-[260px] md:h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={last14Trend}>
                <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#1a1a1a" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 800, fill: '#444' }}
                  dy={14}
                  tickFormatter={(_, idx) => String((last14Trend[idx] as any)?.name || '').toUpperCase()}
                />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#444' }} width={30} />
                <Tooltip content={chartTooltip} cursor={{ stroke: '#222', strokeWidth: 2, strokeDasharray: '4 4' }} />
                <Line type="monotone" dataKey="perc" stroke="#ededed" strokeWidth={3.5} dot={{ r: 2.5, strokeWidth: 2, fill: '#0a0a0a' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0a0a0a] p-6 md:p-10 border border-white/[0.03] rounded-[2.5rem] shadow-2xl">
          <div className="flex items-center gap-4 mb-6 md:mb-10">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-[#d4af37]"><CalendarDays size={20} /></div>
            <div>
              <h4 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white">STATUS_SPLIT</h4>
              <p className="text-[#888888] text-[10px] font-bold mono uppercase tracking-[0.4em] opacity-60">Present / Absent / Leave</p>
            </div>
          </div>
          <div className="h-[240px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={chartTooltip} />
                <Legend verticalAlign="bottom" height={30} wrapperStyle={{ fontSize: 10, color: '#777', fontWeight: 800 }} />
                <Pie data={attendanceStatusDistribution.length ? attendanceStatusDistribution : [{ name: 'NO_DATA', value: 1, color: '#222' }]} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={2}>
                  {(attendanceStatusDistribution.length ? attendanceStatusDistribution : [{ name: 'NO_DATA', value: 1, color: '#222' }]).map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 bg-white/5 p-5 rounded-[1.75rem] border border-white/10">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] mono text-[#666]">HABITS_TODAY</p>
            <p className="mt-2 text-xs font-bold mono text-[#888]">{habitsSummary.checkedToday}/{habitsSummary.total} checked in today</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-[#0a0a0a] p-6 md:p-10 border border-white/[0.03] rounded-[2.5rem] shadow-2xl">
          <div className="flex items-center gap-4 mb-6 md:mb-10">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-[#d4af37]"><BarChart3 size={20} /></div>
            <div>
              <h4 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white">MONTHLY_VIEW</h4>
              <p className="text-[#888888] text-[10px] font-bold mono uppercase tracking-[0.4em] opacity-60">Attendance % by month</p>
            </div>
          </div>
          <div className="h-[260px] md:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyAttendance} barGap={10}>
                <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#1a1a1a" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#444' }} dy={14} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#444' }} width={30} />
                <Tooltip content={chartTooltip} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="perc" radius={[10, 10, 10, 10]} barSize={28}>
                  {monthlyAttendance.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.perc >= 75 ? '#ededed' : '#f43f5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/5 p-5 rounded-[1.75rem] border border-white/10">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] mono text-[#666]">CURRENT_MONTH</p>
              {currentMonthAttendance.hasData ? (
                <>
                  <p className="mt-2 text-xs font-bold mono text-[#888]">{currentMonthAttendance.present}/{currentMonthAttendance.total} classes</p>
                  <p className="mt-1 text-xs font-bold mono text-[#888]">ABSENT: {currentMonthAttendance.absent}</p>
                  <p className="mt-1 text-xs font-bold mono text-[#888]">{currentMonthAttendance.percentage}%</p>
                </>
              ) : (
                <p className="mt-2 text-xs font-bold mono text-[#888]">No attendance logged for this month yet.</p>
              )}
            </div>

            <div className="bg-white/5 p-5 rounded-[1.75rem] border border-white/10">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] mono text-[#666]">SEM_TO_DATE</p>
              {semToDateAttendance.total > 0 ? (
                <>
                  <p className="mt-2 text-xs font-bold mono text-[#888]">{semToDateAttendance.present}/{semToDateAttendance.total} classes</p>
                  <p className="mt-1 text-xs font-bold mono text-[#888]">ABSENT: {semToDateAttendance.absent}</p>
                  <p className="mt-1 text-xs font-bold mono text-[#888]">{semToDateAttendance.percentage}%</p>
                </>
              ) : (
                <p className="mt-2 text-xs font-bold mono text-[#888]">{semToDateAttendance.ranged ? 'No attendance logged for this semester yet.' : 'No attendance data available.'}</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-[#0a0a0a] p-6 md:p-10 border border-white/[0.03] rounded-[2.5rem] shadow-2xl">
          <div className="flex items-center gap-4 mb-6 md:mb-10">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-[#d4af37]"><CalendarDays size={20} /></div>
            <div>
              <h4 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white">ATTENDANCE_CALENDAR</h4>
              <p className="text-[#888888] text-[10px] font-bold mono uppercase tracking-[0.4em] opacity-60">Day-wise log</p>
            </div>
          </div>
          <AttendanceCalendar startDate={semesterStart} endDate={semesterEnd} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-[#0a0a0a] p-6 md:p-10 border border-white/[0.03] rounded-[2.5rem] shadow-2xl relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-emerald-500/5 blur-[110px] pointer-events-none" />
          <div className="flex items-center justify-between gap-4 mb-6 md:mb-10 relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-[#d4af37]"><Radar size={20} /></div>
              <div>
                <h4 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white">FORECAST</h4>
                <p className="text-[#888888] text-[10px] font-bold mono uppercase tracking-[0.4em] opacity-60">Target threshold health</p>
              </div>
            </div>
            <div className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest mono border ${forecastSignal.status === 'NOMINAL' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 'text-rose-400 border-rose-500/20 bg-rose-500/5'}`}>
              {forecastSignal.status}
            </div>
          </div>
          <div className="space-y-3 relative z-10">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase tracking-widest mono text-[#666]">TARGET</p>
                <p className="mt-2 text-xl font-black text-white">{forecastSignal.target}%</p>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase tracking-widest mono text-[#666]">SEM_CURRENT</p>
                <p className="mt-2 text-xl font-black text-white">{forecastSem ? forecastSem.percentage.toFixed(1) : `${forecastSignal.current}%`}</p>
                <p className="mt-1 text-[10px] font-bold mono uppercase tracking-widest text-[#777] opacity-70">GAP: {forecastSem ? forecastSem.gap.toFixed(1) : `${forecastSignal.gap}%`}</p>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase tracking-widest mono text-[#666]">SEM_RECOVER</p>
                <p className="mt-2 text-xl font-black text-white">{forecastSem ? `${forecastSem.recoverDays}D` : '0D'}</p>
                <p className="mt-1 text-[10px] font-bold mono uppercase tracking-widest text-[#777] opacity-70">REMAIN: {forecastSem ? `${forecastSem.remainingDays}D` : '0D'}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase tracking-widest mono text-[#666]">MONTH_CURRENT</p>
                <p className="mt-2 text-xl font-black text-white">{forecastMonth ? forecastMonth.percentage.toFixed(1) : '0.0'}</p>
                <p className="mt-1 text-[10px] font-bold mono uppercase tracking-widest text-[#777] opacity-70">GAP: {forecastMonth ? forecastMonth.gap.toFixed(1) : '0.0'}</p>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase tracking-widest mono text-[#666]">MONTH_RECOVER</p>
                <p className="mt-2 text-xl font-black text-white">{forecastMonth ? `${forecastMonth.recoverDays}D` : '0D'}</p>
                <p className="mt-1 text-[10px] font-bold mono uppercase tracking-widest text-[#777] opacity-70">REMAIN: {forecastMonth ? `${forecastMonth.remainingDays}D` : '0D'}</p>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-2xl p-4">
                <p className="text-[10px] font-black uppercase tracking-widest mono text-[#666]">MODE</p>
                <p className="mt-2 text-xl font-black text-white">{semesterStart && semesterEnd ? 'SEM+MON' : 'MON'}</p>
                <p className="mt-1 text-[10px] font-bold mono uppercase tracking-widest text-[#777] opacity-70">AUTO UPDATED</p>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 bg-[#0a0a0a] p-6 md:p-10 border border-white/[0.03] rounded-[2.5rem] shadow-2xl">
          <div className="flex items-center justify-between gap-4 mb-6 md:mb-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-[#d4af37]"><ListTodo size={20} /></div>
              <div>
                <h4 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white">TASK_WORKLOAD</h4>
                <p className="text-[#888888] text-[10px] font-bold mono uppercase tracking-[0.4em] opacity-60">Due next 7 days</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 h-[240px] md:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tasksDueNext7} barGap={10}>
                  <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#1a1a1a" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#444' }} dy={14} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#444' }} width={30} />
                  <Tooltip content={chartTooltip} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="due" radius={[10, 10, 10, 10]} barSize={26}>
                    {tasksDueNext7.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.due > 0 ? '#d4af37' : '#222'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-[240px] md:h-[280px] bg-black/30 border border-white/10 rounded-[2rem] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] mono text-[#666]">COMPLETION</p>
              <div className="mt-2 h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={chartTooltip} />
                    <Pie data={tasksCompletionDistribution.length ? tasksCompletionDistribution : [{ name: 'NO_DATA', value: 1, color: '#222' }]} dataKey="value" nameKey="name" innerRadius={52} outerRadius={70} paddingAngle={2}>
                      {(tasksCompletionDistribution.length ? tasksCompletionDistribution : [{ name: 'NO_DATA', value: 1, color: '#222' }]).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[10px] font-bold mono uppercase tracking-widest text-[#777] opacity-70">{tasksSummary.completed} done / {tasksSummary.total} total</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-[#0a0a0a] p-6 md:p-10 border border-white/[0.03] rounded-[2.5rem] shadow-2xl">
          <div className="flex items-center gap-4 mb-6 md:mb-10">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-[#d4af37]"><ClipboardList size={20} /></div>
            <div>
              <h4 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white">FOCUS_ANALYSIS</h4>
              <p className="text-[#888888] text-[10px] font-bold mono uppercase tracking-[0.4em] opacity-60">Queue priority & completion</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-[240px] bg-black/30 border border-white/10 rounded-[2rem] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] mono text-[#666]">PRIORITY</p>
              <div className="mt-2 h-[190px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={chartTooltip} />
                    <Pie data={queuePriorityDistribution.length ? queuePriorityDistribution : [{ name: 'NO_DATA', value: 1, color: '#222' }]} dataKey="value" nameKey="name" innerRadius={52} outerRadius={70} paddingAngle={2}>
                      {(queuePriorityDistribution.length ? queuePriorityDistribution : [{ name: 'NO_DATA', value: 1, color: '#222' }]).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="h-[240px] bg-black/30 border border-white/10 rounded-[2rem] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] mono text-[#666]">COMPLETION</p>
              <div className="mt-2 h-[190px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={chartTooltip} />
                    <Pie data={queueCompletionDistribution.length ? queueCompletionDistribution : [{ name: 'NO_DATA', value: 1, color: '#222' }]} dataKey="value" nameKey="name" innerRadius={52} outerRadius={70} paddingAngle={2}>
                      {(queueCompletionDistribution.length ? queueCompletionDistribution : [{ name: 'NO_DATA', value: 1, color: '#222' }]).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="mt-6 bg-white/5 p-5 rounded-[1.75rem] border border-white/10">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] mono text-[#666]">QUEUE_STATUS</p>
            <p className="mt-2 text-xs font-bold mono text-[#888]">{queueSummary.pending}/{queueSummary.total} pending</p>

            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.4em] mono text-[#666]">FOCUS_TIME</p>
            <p className="mt-2 text-xs font-bold mono text-[#888]">{formatFocus(focusTime.todaySeconds)} today</p>
            <p className="mt-1 text-xs font-bold mono text-[#888]">{formatFocus(focusTime.monthSeconds)} this month</p>
          </div>
        </div>

        <div className="xl:col-span-2 bg-[#0a0a0a] p-6 md:p-10 border border-white/[0.03] rounded-[2.5rem] shadow-2xl">
          <div className="flex items-center gap-4 mb-6 md:mb-10">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-[#d4af37]"><Activity size={20} /></div>
            <div>
              <h4 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white">HABITS_STREAKS</h4>
              <p className="text-[#888888] text-[10px] font-bold mono uppercase tracking-[0.4em] opacity-60">Top streak leaderboard</p>
            </div>
          </div>
          <div className="h-[260px] md:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={habitStreakChart.data} barGap={10}>
                <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#1a1a1a" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#444' }} dy={14} interval={0} />
                <YAxis allowDecimals={false} domain={[0, Math.max(4, habitStreakChart.maxStreak || 0)]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#444' }} width={30} />
                <Tooltip content={chartTooltip} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="vizStreak" radius={[10, 10, 10, 10]} barSize={22}>
                  {habitStreakChart.data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill="#ededed" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {habitStreakChart.maxStreak === 0 && (
            <div className="mt-6 bg-white/5 p-5 rounded-[1.75rem] border border-white/10">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] mono text-[#666]">NO_STREAKS_YET</p>
              <p className="mt-2 text-xs font-bold mono text-[#888]">Check-in your habits to start building streaks.</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
        <div className="xl:col-span-2 bg-[#0a0a0a] p-6 md:p-10 border border-white/[0.03] rounded-[2.5rem] shadow-2xl">
          <div className="flex items-center gap-4 mb-6 md:mb-10">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-[#d4af37]"><Layers size={20} /></div>
            <div>
              <h4 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white">SYNC_PROGRESS</h4>
              <p className="text-[#888888] text-[10px] font-bold mono uppercase tracking-[0.4em] opacity-60">Courses progress snapshot</p>
            </div>
          </div>
          <div className="h-[260px] md:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={courseProgressData} barGap={10} layout="vertical">
                <CartesianGrid strokeDasharray="6 6" horizontal={false} stroke="#1a1a1a" />
                <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#444' }} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#444' }} width={70} />
                <Tooltip content={chartTooltip} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="progress" radius={[10, 10, 10, 10]} barSize={16}>
                  {courseProgressData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.progress >= 70 ? '#ededed' : '#d4af37'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0a0a0a] p-6 md:p-10 border border-white/[0.03] rounded-[2.5rem] shadow-2xl">
          <div className="flex items-center gap-4 mb-6 md:mb-10">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-[#d4af37]"><CalendarDays size={20} /></div>
            <div>
              <h4 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white">UPCOMING_EXAMS</h4>
              <p className="text-[#888888] text-[10px] font-bold mono uppercase tracking-[0.4em] opacity-60">Next 45 days</p>
            </div>
          </div>
          <div className="space-y-3">
            {upcomingExamsSoon.length === 0 ? (
              <div className="bg-black/30 border border-white/10 rounded-[2rem] p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] mono text-[#666]">NO_EXAMS</p>
                <p className="mt-2 text-xs font-bold mono text-[#888]">Set exam dates in the Exams section to display upcoming exams here.</p>
              </div>
            ) : (
              upcomingExamsSoon.map(exam => (
                <div key={exam.id} className="bg-black/30 border border-white/10 rounded-[2rem] p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] mono text-[#666]">{safeExamLabel((exam as any)?.date)}</p>
                  <p className="mt-2 text-sm font-black tracking-tight text-white uppercase">{safeUpper((exam as any)?.name, 40)}</p>
                  <p className="mt-1 text-[10px] font-bold mono uppercase tracking-widest text-[#777] opacity-70">SUBJECT_ID: {safeUpper((exam as any)?.subjectId, 30)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
