
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Activity, AlertCircle } from 'lucide-react';
import { AttendanceStatus, Subject } from '../types';
import { getAIAttendanceAdvice } from '../services/gemini';
import { DataService } from '../services/dataService';

interface Props {
  subjects: Subject[];
}

const AIPredictor: React.FC<Props> = ({ subjects }) => {
  const [advice, setAdvice] = useState<string>("Analyzing structural patterns...");
  const [loading, setLoading] = useState(true);
  const [projectedPct, setProjectedPct] = useState<number>(0);
  const [semToDate, setSemToDate] = useState<{ workingDays: number; totalClasses: number; present: number; absent: number }>(
    { workingDays: 0, totalClasses: 0, present: 0, absent: 0 }
  );
  const inFlightRef = useRef(false);
  const lastRunAtRef = useRef(0);

  const computeToDate = (days: any[], workingDays: number) => {
    const activeDays = days.filter((d) => Number(d?.totalClasses || 0) > 0);
    const loggedTotal = activeDays.reduce((acc, d) => acc + Number(d.totalClasses || 0), 0);
    const loggedPresent = activeDays.reduce((acc, d) => acc + Number(d.attendedClasses || 0), 0);
    const avgClassesPerDay = activeDays.length > 0 ? loggedTotal / activeDays.length : 4;
    const missingDays = Math.max(0, workingDays - activeDays.length);
    const estimatedTotal = Math.round(loggedTotal + missingDays * avgClassesPerDay);
    const totalClasses = Math.max(0, Math.max(loggedTotal, estimatedTotal));
    const present = Math.max(0, loggedPresent);
    const absent = Math.max(0, totalClasses - present);
    const percentage = totalClasses > 0 ? (present / totalClasses) * 100 : 0;
    return { workingDays, totalClasses, present, absent, percentage, avgClassesPerDay, loggedDays: activeDays.length };
  };

  const exportFullAudit = () => {
    const profile = DataService.getUserProfile();
    const sem = DataService.getSemesterAttendanceSummary(75);

    const todayIso = DataService.getTodayISO();
    const startIso = sem?.configured && sem.startDate ? DataService.clampISODate(sem.startDate) : '';
    const endIso = sem?.configured && sem.endDate ? DataService.clampISODate(sem.endDate) : '';
    const toDateEndIso = endIso && todayIso > endIso ? endIso : todayIso;

    const range = startIso ? { startDate: startIso, endDate: toDateEndIso } : null;
    const days = range
      ? DataService.getAttendanceDaysInRange(range.startDate, range.endDate)
      : DataService.getAttendanceDays();

    const workingDays = days.length;
    const computed = computeToDate(days, workingDays);
    const percentage = Math.round(computed.percentage * 10) / 10;

    const analytics = sem?.configured && sem.startDate && sem.endDate
      ? DataService.getAttendanceAnalyticsForRange(sem.startDate, sem.endDate)
      : DataService.getAttendanceAnalytics();

    const payload = {
      generatedAt: new Date().toISOString(),
      profile,
      semester: {
        configured: Boolean(sem?.configured),
        startDate: startIso,
        endDate: endIso,
        toDateEnd: toDateEndIso
      },
      semToDate: {
        workingDays,
        totalClasses: computed.totalClasses,
        present: computed.present,
        absent: computed.absent,
        percentage
      },
      analytics,
      attendanceDays: days
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studo-audit-${todayIso}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let alive = true;

    const fetchAdvice = async () => {
      const now = Date.now();
      if (inFlightRef.current) return;
      if (now - lastRunAtRef.current < 2500) return;
      inFlightRef.current = true;
      lastRunAtRef.current = now;

      try {
        setLoading(true);

        const profile = DataService.getUserProfile();
        const sem = DataService.getSemesterAttendanceSummary(75);
        const todayIso = DataService.getTodayISO();
        const startIso = sem?.configured && sem.startDate ? DataService.clampISODate(sem.startDate) : '';
        const endIso = sem?.configured && sem.endDate ? DataService.clampISODate(sem.endDate) : '';
        const toDateEndIso = endIso && todayIso > endIso ? endIso : todayIso;

        const semToDateDays = startIso
          ? DataService.getAttendanceDaysInRange(startIso, toDateEndIso)
          : DataService.getAttendanceDays();

        const workingDays = semToDateDays.length;
        const computed = computeToDate(semToDateDays, workingDays);
        setSemToDate({
          workingDays: computed.workingDays,
          totalClasses: computed.totalClasses,
          present: computed.present,
          absent: computed.absent
        });
        setProjectedPct(computed.percentage);

        const analytics = sem?.configured && sem.startDate && sem.endDate
          ? DataService.getAttendanceAnalyticsForRange(sem.startDate, sem.endDate)
          : DataService.getAttendanceAnalytics();

        const today = todayIso;
        const days = DataService.getAttendanceDays();
        const upcomingLeaves = days.filter((d) => d.date >= today && d.status === AttendanceStatus.LEAVE).length;

        const subjectHealth: any[] = [
          { name: 'OVERALL', perc: computed.percentage }
        ];

        if (analytics?.monthlyStats && typeof analytics.monthlyStats === 'object') {
          Object.entries(analytics.monthlyStats)
            .slice(-3)
            .forEach(([month, v]: any) => {
              subjectHealth.push({ name: String(month).toUpperCase(), perc: Number(v?.percentage ?? 0) });
            });
        }

        try {
          const res = await getAIAttendanceAdvice({
            currentPercentage: computed.percentage,
            targetPercentage: 75,
            subjectHealth,
            upcomingLeaves: sem?.configured ? Number(sem.possibleLeaves || 0) : upcomingLeaves,
            profile
          });

          if (!alive) return;
          setAdvice(res || "Status optimal. Maintain current velocity.");
        } catch (e: any) {
          if (!alive) return;
          const msg = e?.message || String(e || '');
          setAdvice(msg ? `AI unavailable: ${msg}` : 'AI unavailable. Check Gemini setup.');
        }
      } finally {
        if (alive) setLoading(false);
        inFlightRef.current = false;
      }
    };

    fetchAdvice();

    let daySig = DataService.getTodayISO();
    const dayTimer = window.setInterval(() => {
      const cur = DataService.getTodayISO();
      if (cur !== daySig) {
        daySig = cur;
        fetchAdvice();
      }
    }, 60 * 1000);

    const onAttendanceUpdated = () => fetchAdvice();
    window.addEventListener('studo_attendance_updated', onAttendanceUpdated);
    window.addEventListener('studo_profile_updated', onAttendanceUpdated);
    window.addEventListener('studo_data_updated', onAttendanceUpdated);
    return () => {
      alive = false;
      inFlightRef.current = false;
      window.clearInterval(dayTimer);
      window.removeEventListener('studo_attendance_updated', onAttendanceUpdated);
      window.removeEventListener('studo_profile_updated', onAttendanceUpdated);
      window.removeEventListener('studo_data_updated', onAttendanceUpdated);
    };
  }, [subjects]);

  return (
    <div className="bg-[#0a0a0a] p-6 md:p-10 border border-white/[0.03] rounded-[2.5rem] h-full flex flex-col shadow-2xl relative group overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#d4af37]/5 blur-[100px] pointer-events-none group-hover:bg-[#d4af37]/10 transition-colors" />
      
      <div className="flex items-center justify-between mb-8 md:mb-12 relative z-10">
        <div>
          <h3 className="serif-luxury text-2xl md:text-3xl uppercase tracking-tighter mb-2 text-white">AI_PREDICT_VI</h3>
          <p className="text-[#666] text-[10px] font-bold mono uppercase tracking-widest">Projected End Sem</p>
        </div>
        <div className="px-4 py-2 bg-white/[0.02] border border-white/[0.05] rounded-2xl text-[10px] font-bold mono uppercase text-[#d4af37] tracking-widest shadow-xl">
          GEMINI
        </div>
      </div>

      <div className="flex-1 relative z-10 space-y-4">
        <div className="bg-black p-6 border border-white/[0.03] rounded-[2rem] hover:border-[#d4af37]/20 transition-colors">
          <p className="text-[10px] text-[#666] font-bold uppercase tracking-[0.2em] mb-3 flex items-center gap-2 mono">
            <Activity size={12} /> Projected_End_Sem
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-5xl font-black tracking-tighter mono italic text-white">{Number.isFinite(projectedPct) ? projectedPct.toFixed(1) : '0.0'}</p>
            <p className="text-lg font-bold text-[#666] mono uppercase tracking-widest">PCT</p>
          </div>
          <div className="mt-5 h-1 w-full bg-white/[0.02] overflow-hidden rounded-full">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(0, Math.min(100, projectedPct || 0))}%` }} className="h-full bg-gradient-to-r from-[#d4af37] to-[#8a6d3b] shadow-[0_0_15px_rgba(212,175,55,0.2)]" />
          </div>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] mono text-[#555]">WORK_DAYS</p>
              <p className="mt-1 text-sm font-black mono text-white">{semToDate.workingDays}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] mono text-[#555]">CLASSES</p>
              <p className="mt-1 text-sm font-black mono text-white">{semToDate.totalClasses}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] mono text-[#555]">PRESENT</p>
              <p className="mt-1 text-sm font-black mono text-white">{semToDate.present}</p>
            </div>
            <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] mono text-[#555]">ABSENT</p>
              <p className="mt-1 text-sm font-black mono text-white">{semToDate.absent}</p>
            </div>
          </div>
        </div>

        <div className="bg-black p-6 border border-white/[0.03] rounded-[2rem] min-h-[150px] hover:border-[#d4af37]/20 transition-colors shadow-inner">
          <p className="text-[10px] font-bold mb-4 flex items-center gap-2 mono text-[#666] uppercase tracking-widest">
            <AlertCircle size={14} className="text-[#d4af37]" /> GEMINI_SYNTHESIS
          </p>
          <p className="text-[#888] text-xs font-medium leading-relaxed mono">
            {loading ? (
              <span className="opacity-40 animate-pulse block space-y-2">
                <span className="block h-2 bg-white/5 rounded w-full" />
                <span className="block h-2 bg-white/5 rounded w-3/4" />
              </span>
            ) : advice}
          </p>
        </div>

        <button
          type="button"
          onClick={exportFullAudit}
          className="w-full py-4.5 bg-[#d4af37] text-black font-black uppercase tracking-widest text-[10px] hover:scale-[0.98] transition-all rounded-2xl shadow-xl"
        >
          EXPORT_FULL_AUDIT
        </button>
      </div>
    </div>
  );
};

export default AIPredictor;
