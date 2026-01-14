
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calculator, Info, ShieldAlert, CheckCircle2, History, Zap } from 'lucide-react';
import { Subject } from '../types';
import { DataService } from '../services/dataService';

interface Props {
  subjects: Subject[];
}

const LeavePlanner: React.FC<Props> = ({ subjects }) => {
  const [plannedLeaves, setPlannedLeaves] = useState(0);
  const [calcTotal, setCalcTotal] = useState<string>('50');
  const [calcAttended, setCalcAttended] = useState<string>('40');
  const [baselineMode, setBaselineMode] = useState<'SEMESTER' | 'MONTH'>('SEMESTER');

  const sem = DataService.getSemesterAttendanceSummary(75);
  const baselineAnalytics = sem?.configured && sem.startDate && sem.endDate
    ? DataService.getAttendanceAnalyticsForRange(sem.startDate, sem.endDate)
    : DataService.getAttendanceAnalytics();

  const rawMonthKeys = baselineAnalytics?.monthlyStats ? Object.keys(baselineAnalytics.monthlyStats) : [];
  const monthKeys = [...rawMonthKeys].sort((a, b) => {
    const ay = DataService.getYearMonthFromMonthKey(a);
    const by = DataService.getYearMonthFromMonthKey(b);
    return ay.localeCompare(by);
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(() => monthKeys[monthKeys.length - 1] || '');
  const monthKeySig = monthKeys.join('|');

  useEffect(() => {
    if (baselineMode !== 'MONTH') return;
    if (monthKeys.length === 0) {
      if (selectedMonth) setSelectedMonth('');
      return;
    }
    if (!selectedMonth || !monthKeys.includes(selectedMonth)) {
      setSelectedMonth(monthKeys[monthKeys.length - 1]);
    }
  }, [baselineMode, monthKeySig]);

  const monthStats = selectedMonth && baselineAnalytics?.monthlyStats
    ? (baselineAnalytics.monthlyStats as any)[selectedMonth]
    : undefined;

  const baselineDays = sem?.configured && sem.startDate && sem.endDate
    ? DataService.getAttendanceDaysInRange(sem.startDate, sem.endDate)
    : DataService.getAttendanceDays();

  const monthDayCount = baselineMode === 'MONTH' && selectedMonth
    ? baselineDays.filter((d) => DataService.getMonthKeyFromISO(d.date) === selectedMonth).length
    : 0;

  const semClassesPerDay = baselineAnalytics?.totalDays > 0
    ? Number(baselineAnalytics.totalClasses) / Number(baselineAnalytics.totalDays)
    : 4;

  const monthClassesPerDay = monthStats && monthDayCount > 0
    ? Number(monthStats.total) / Number(monthDayCount)
    : semClassesPerDay;

  const classesPerLeaveDay = Math.max(1, baselineMode === 'MONTH' ? monthClassesPerDay : semClassesPerDay);

  const todayIso = DataService.getTodayISO();

  const avgClassesFromDays = (days: any[]) => {
    const activeDays = days.filter((d) => Number(d?.totalClasses || 0) > 0);
    const total = activeDays.reduce((acc, d) => acc + Number(d.totalClasses || 0), 0);
    return activeDays.length > 0 ? total / activeDays.length : classesPerLeaveDay;
  };

  const addDaysIso = (iso: string, days: number) => {
    const dt = DataService.parseISODateUTC(iso);
    if (!dt) return iso;
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
  };

  const computeBase = (days: any[]) => {
    const activeDays = days.filter((d) => Number(d?.totalClasses || 0) > 0);
    const loggedTotal = activeDays.reduce((acc, d) => acc + Number(d.totalClasses || 0), 0);
    const loggedAttended = activeDays.reduce((acc, d) => acc + Number(d.attendedClasses || 0), 0);
    const avg = activeDays.length > 0 ? loggedTotal / activeDays.length : classesPerLeaveDay;
    const total = Math.max(0, loggedTotal);
    const attended = Math.max(0, loggedAttended);
    const pct = total > 0 ? (attended / total) * 100 : 0;
    return { total, attended, pct, avgClassesPerDay: avg, activeDayCount: activeDays.length };
  };

  const semStart = sem?.configured && sem.startDate ? String(sem.startDate).slice(0, 10) : '';
  const semEnd = sem?.configured && sem.endDate ? String(sem.endDate).slice(0, 10) : '';

  let periodStart = '';
  let periodEnd = '';

  if (baselineMode === 'SEMESTER') {
    periodStart = semStart;
    periodEnd = semEnd;
  } else {
    const range = selectedMonth ? DataService.getMonthRangeFromMonthKey(selectedMonth) : null;
    if (range) {
      periodStart = range.start;
      periodEnd = semEnd && semEnd < range.end ? semEnd : range.end;
    }
  }

  const toDateEnd = periodEnd && todayIso > periodEnd ? periodEnd : todayIso;
  const hasPeriod = Boolean(periodStart && periodEnd && periodStart <= periodEnd);

  const periodDaysToDate = hasPeriod
    ? baselineDays.filter((d) => d.date >= periodStart && d.date <= toDateEnd)
    : [];

  const workingDaysToDate = periodDaysToDate.length;

  const base = computeBase(periodDaysToDate);
  const baseTotal = base.total;
  const baseAttended = base.attended;
  const currentPercentage = base.pct;
  const avgClassesPerWorkingDay = base.activeDayCount >= 5 ? base.avgClassesPerDay : classesPerLeaveDay;

  const todayInPeriod = hasPeriod && todayIso >= periodStart && todayIso <= periodEnd;
  const hasTodayMarked = todayInPeriod ? periodDaysToDate.some((d) => d.date === todayIso) : false;

  const futureStart = hasPeriod
    ? (toDateEnd < periodStart
      ? periodStart
      : (todayInPeriod && !hasTodayMarked ? todayIso : addDaysIso(toDateEnd, 1)))
    : '';

  const remainingWorkingDays = hasPeriod && futureStart && futureStart <= periodEnd
    ? DataService.countWorkingDaysUTC(futureStart, periodEnd)
    : 0;

  const boundedPlannedLeaves = Math.max(0, Math.min(plannedLeaves, remainingWorkingDays));

  useEffect(() => {
    if (plannedLeaves !== boundedPlannedLeaves) {
      setPlannedLeaves(boundedPlannedLeaves);
    }
  }, [boundedPlannedLeaves]);
  const projectedFutureClasses = Math.max(0, Math.round(remainingWorkingDays * avgClassesPerWorkingDay));
  const projectedLeavesClasses = Math.max(0, Math.round(boundedPlannedLeaves * avgClassesPerWorkingDay));

  const projectedTotal = baseTotal + projectedFutureClasses;
  const projectedAttended = baseAttended + Math.max(0, projectedFutureClasses - projectedLeavesClasses);
  const projectedPercentage = projectedTotal > 0 ? (projectedAttended / projectedTotal) * 100 : currentPercentage;

  const safeCurrentPercentage = Math.max(0, Math.min(100, currentPercentage));
  const safeProjectedPercentage = Math.max(0, Math.min(100, projectedPercentage));
  
  const isSafe = safeProjectedPercentage >= 75;

  const calcResult = () => {
    const t = parseFloat(calcTotal);
    const a = parseFloat(calcAttended);
    if (!t || isNaN(t) || isNaN(a)) return 0;
    return Math.round((a / t) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter mb-2 text-white">PROJECTION_DECK</h2>
          <p className="text-[#888888] text-[10px] font-bold mono uppercase tracking-[0.3em] opacity-60">Absence Risk Forecaster</p>
        </div>
        <div className="flex items-center gap-5 bg-[#111111] px-6 py-3 border border-white/5 rounded-2xl shadow-xl">
          <History className="text-[#555]" size={18} />
          <span className="text-[10px] font-black text-[#888888] uppercase tracking-[0.3em] mono tracking-widest">SCENARIO_CACHE: 12</span>
        </div>
      </div>

      {/* Unified Simulation Box */}
      <div className="bg-[#111111] border border-white/10 rounded-[2.5rem] overflow-hidden flex flex-col md:flex-row shadow-3xl">
        <div className="flex-1 p-12 space-y-16">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-900/30">
              <Zap size={22} />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tighter text-white">SIMULATION_v4.2</h3>
            <div className="ml-auto flex items-center gap-3">
              <select
                value={baselineMode}
                onChange={(e) => setBaselineMode(e.target.value as 'SEMESTER' | 'MONTH')}
                className="bg-[#0a0a0a] border border-white/10 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest mono text-[#d4af37] outline-none"
              >
                <option value="SEMESTER">SEM</option>
                <option value="MONTH">MONTH</option>
              </select>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                disabled={baselineMode !== 'MONTH' || monthKeys.length === 0}
                className="bg-[#0a0a0a] border border-white/10 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest mono text-[#888888] outline-none disabled:opacity-40"
              >
                {monthKeys.length === 0 ? (
                  <option value="">NO_MONTHS</option>
                ) : (
                  monthKeys.map((k) => (
                    <option key={k} value={k}>{String(k).toUpperCase()}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="space-y-16">
            <div>
              <div className="flex justify-between items-center mb-8">
                <span className="text-[11px] font-black text-[#888888] uppercase tracking-[0.4em] mono opacity-60">ABSENCE_PARAMETER</span>
                <span className="bg-[#ededed] text-[#0a0a0a] px-6 py-2.5 rounded-2xl font-black text-2xl mono italic tracking-tighter shadow-xl">{boundedPlannedLeaves}D</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max={Math.max(0, remainingWorkingDays || 0)}
                step="1"
                value={plannedLeaves} 
                onChange={(e) => setPlannedLeaves(parseInt(e.target.value))}
                className="w-full h-2 bg-white/5 appearance-none cursor-pointer accent-indigo-600 rounded-full transition-all hover:bg-white/10"
              />
              <div className="flex justify-between text-[10px] font-black text-[#444] mt-5 uppercase tracking-widest mono">
                <span className="opacity-40">SAFE_MIN</span>
                <span className="opacity-40 text-rose-500/50">CRITICAL_MAX</span>
              </div>
            </div>

            <div className="bg-[#0a0a0a]/50 p-8 rounded-[1.5rem] border border-white/5 flex gap-6 items-center">
              <div className="p-3 bg-indigo-500/10 rounded-2xl">
                <Info className="text-indigo-400 shrink-0" size={24} />
              </div>
              <p className="text-[11px] text-[#888888] font-bold leading-relaxed italic mono uppercase tracking-tight opacity-70">
                Structural logic: leaves consume future working days. 1D leave ≈ {avgClassesPerWorkingDay.toFixed(1)} classes. 
                Forecast assumes attendance on all remaining working days except selected leaves.
              </p>
            </div>
          </div>
        </div>

        <div className={`md:w-[420px] p-12 transition-all duration-700 flex flex-col items-center justify-center text-center ${isSafe ? 'bg-indigo-600/95' : 'bg-rose-600/95'} text-white relative shadow-2xl`}>
          <div className="absolute inset-0 bg-white/5 pointer-events-none" />
          <div className="w-24 h-24 rounded-full flex items-center justify-center mb-10 border-2 border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl relative z-10">
            {isSafe ? <CheckCircle2 size={48} /> : <ShieldAlert size={48} />}
          </div>
          
          <h4 className="text-4xl font-black mb-6 tracking-tighter uppercase italic relative z-10" style={{ textShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
            {isSafe ? "SAFE_TO_EXEC" : "CRITICAL_RISK"}
          </h4>
          <p className="text-[11px] mb-12 font-bold uppercase mono tracking-[0.2em] opacity-80 max-w-[240px] leading-relaxed relative z-10">
            {isSafe 
              ? `Operational integrity maintained at current simulation parameters.` 
              : `Caution: System ineligibility detected at ${safeProjectedPercentage.toFixed(1)}% threshold.`}
          </p>

          <div className="space-y-4 w-full relative z-10">
            <div className="bg-black/20 p-6 rounded-2xl border border-white/10 flex justify-between items-center shadow-lg">
              <span className="text-[10px] font-black uppercase tracking-widest mono opacity-60">ACTUAL</span>
              <span className="text-3xl font-black italic mono tracking-tighter">{safeCurrentPercentage.toFixed(1)}%</span>
            </div>
            <div className="bg-black/30 p-6 rounded-2xl border border-white/20 flex justify-between items-center shadow-xl">
              <span className="text-[10px] font-black uppercase tracking-widest mono opacity-60">FORECAST</span>
              <span className="text-3xl font-black italic mono tracking-tighter">{safeProjectedPercentage.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Calculator */}
      <div className="bg-[#111111] p-12 border border-white/5 rounded-[2.5rem] max-w-2xl shadow-2xl relative">
        <div className="flex items-center gap-4 mb-12">
          <div className="bg-[#0a0a0a] p-3 border border-white/10 rounded-2xl text-[#666]">
            <Calculator size={20} />
          </div>
          <h3 className="text-2xl font-black uppercase tracking-tighter text-white">MANUAL_AUDIT</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-end">
          <div className="space-y-8">
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-[#888888] uppercase tracking-[0.3em] mb-2 mono opacity-60">INPUT_TOTAL</label>
              <input 
                type="number" 
                value={calcTotal} 
                onChange={e => setCalcTotal(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/10 p-5 rounded-2xl outline-none focus:border-indigo-500 font-black text-white mono transition-all shadow-inner"
              />
            </div>
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-[#888888] uppercase tracking-[0.3em] mb-2 mono opacity-60">INPUT_ATTENDED</label>
              <input 
                type="number" 
                value={calcAttended} 
                onChange={e => setCalcAttended(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/10 p-5 rounded-2xl outline-none focus:border-indigo-500 font-black text-white mono transition-all shadow-inner"
              />
            </div>
          </div>
          
          <div className="bg-[#0a0a0a] border border-white/5 p-12 rounded-[2rem] text-center shadow-inner relative overflow-hidden group">
            <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <p className="text-[10px] text-[#444] font-black uppercase tracking-[0.4em] mb-4 mono relative z-10">AUDIT_SCORE</p>
            <p className="text-7xl font-black italic mono tracking-tighter text-indigo-500 relative z-10" style={{ textShadow: '0 0 30px rgba(99, 102, 241, 0.1)' }}>{calcResult()}%</p>
            <div className={`mt-10 inline-block px-8 py-2.5 rounded-2xl text-[10px] font-black uppercase mono tracking-[0.3em] border shadow-2xl relative z-10 transition-all ${calcResult() >= 75 ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border-rose-500/30 text-rose-500 bg-rose-500/5'}`}>
              {calcResult() >= 75 ? 'VERIFIED' : 'FAILED'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeavePlanner;
