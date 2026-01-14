import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Upload, Check, X, Plane, Trash2, Download } from 'lucide-react';
import { AttendanceStatus, AttendanceDay } from '../types';
import { DataService } from '../services/dataService';

interface Props {
  startDate?: string;
  endDate?: string;
}

const AttendanceCalendar: React.FC<Props> = ({ startDate, endDate }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [remark, setRemark] = useState('');
  const [attendanceDays, setAttendanceDays] = useState<AttendanceDay[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus | null>(null);
  const [leaveCounted, setLeaveCounted] = useState(false);
  const [proofUrl, setProofUrl] = useState<string>('');
  const [proofName, setProofName] = useState<string>('');

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const formatISODateLocal = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getDayISO = (day: number) => {
    return formatISODateLocal(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
  };

  const downloadCsv = () => {
    const source = startDate && endDate
      ? DataService.getAttendanceDaysInRange(startDate, endDate)
      : DataService.getAttendanceDays();

    const sorted = source.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const header = ['Date', 'Status', 'LeaveCounted', 'TotalClasses', 'AttendedClasses', 'Remark', 'ProofName'];

    const escape = (v: unknown) => {
      const s = String(v ?? '');
      if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = sorted.map((d) => {
      return [
        d.date,
        d.status,
        d.status === AttendanceStatus.LEAVE ? String(Boolean(d.leaveCounted)) : '',
        String(d.totalClasses ?? ''),
        String(d.attendedClasses ?? ''),
        d.remark ?? '',
        d.proofName ?? ''
      ].map(escape).join(',');
    });

    const csv = `\ufeff${header.join(',')}\n${rows.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = startDate && endDate ? `${String(startDate).slice(0, 10)}_${String(endDate).slice(0, 10)}` : 'all';
    a.download = `attendance_report_${suffix}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const statusColors = {
    [AttendanceStatus.PRESENT]: 'bg-[#ededed] border-white/20 text-black shadow-lg shadow-white/5',
    [AttendanceStatus.ABSENT]: 'bg-rose-600/90 border-rose-500/50 text-white shadow-lg shadow-rose-900/20',
    [AttendanceStatus.LEAVE]: 'bg-indigo-600/90 border-indigo-500/50 text-white shadow-lg shadow-indigo-900/20',
    [AttendanceStatus.NONE]: 'bg-white/2 border-white/5 hover:border-white/20'
  };

  // Load attendance days on component mount and when date changes
  useEffect(() => {
    const load = () => {
      if (startDate && endDate) {
        setAttendanceDays(DataService.getAttendanceDaysInRange(startDate, endDate));
      } else {
        setAttendanceDays(DataService.getAttendanceDays());
      }
    };

    load();
    const onAttendanceUpdated = () => load();
    window.addEventListener('studo_attendance_updated', onAttendanceUpdated);
    return () => window.removeEventListener('studo_attendance_updated', onAttendanceUpdated);
  }, [currentDate, startDate, endDate]);

  const handleStatusSelect = (status: AttendanceStatus) => {
    setSelectedStatus(status);
    if (status !== AttendanceStatus.LEAVE) {
      setLeaveCounted(false);
    }
  };

  const handleSubmitAttendance = () => {
    if (!selectedDay || !selectedStatus) return;
    
    const dateStr = getDayISO(selectedDay);
    const record: AttendanceDay = {
      date: dateStr,
      status: selectedStatus,
      totalClasses: 1,
      attendedClasses: 0,
      remark: remark || undefined,
      proofUrl: proofUrl || undefined,
      proofName: proofName || undefined,
      leaveCounted: selectedStatus === AttendanceStatus.LEAVE ? leaveCounted : undefined
    };
    
    DataService.saveAttendanceDay(record);
    if (startDate && endDate) {
      setAttendanceDays(DataService.getAttendanceDaysInRange(startDate, endDate));
    } else {
      setAttendanceDays(DataService.getAttendanceDays());
    }
    
    // Reset form
    setShowModal(false);
    setSelectedStatus(null);
    setRemark('');
    setLeaveCounted(false);
    setProofUrl('');
    setProofName('');
    setSelectedDay(null);
  };

  const handleClearAttendance = () => {
    if (!selectedDay) return;
    const dateStr = getDayISO(selectedDay);
    DataService.deleteAttendanceDay(dateStr);
    if (startDate && endDate) {
      setAttendanceDays(DataService.getAttendanceDaysInRange(startDate, endDate));
    } else {
      setAttendanceDays(DataService.getAttendanceDays());
    }
    setShowModal(false);
    setSelectedStatus(null);
    setRemark('');
    setLeaveCounted(false);
    setProofUrl('');
    setProofName('');
    setSelectedDay(null);
  };

  const handleDayClick = (day: number) => {
    const dateStr = getDayISO(day);
    const todayIso = formatISODateLocal(new Date());
    if (dateStr > todayIso) return;

    const existing = attendanceDays.find(r => r.date === dateStr);
    setSelectedStatus(existing?.status ?? null);
    setRemark(existing?.remark ?? '');
    setLeaveCounted(Boolean(existing?.leaveCounted));
    setProofUrl(existing?.proofUrl ?? '');
    setProofName(existing?.proofName ?? '');
    setSelectedDay(day);
    setShowModal(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter mb-2 text-white">LOG_STATION</h2>
          <p className="text-[#888888] text-[10px] font-bold mono uppercase tracking-[0.2em] opacity-60">Operational Attendance Grid</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={downloadCsv}
            className="flex items-center gap-3 bg-[#111111] p-3 px-4 border border-white/5 rounded-2xl shadow-xl text-white hover:bg-white/5 transition-all"
          >
            <Download size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest mono">DOWNLOAD_REPORT</span>
          </button>
          <div className="flex items-center gap-6 bg-[#111111] p-3 border border-white/5 rounded-2xl shadow-xl">
          <button className="p-2 text-[#888888] hover:text-white transition-all hover:bg-white/5 rounded-xl" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}>
            <ChevronLeft size={20} />
          </button>
          <span className="font-black text-xs min-w-[150px] text-center uppercase tracking-widest mono text-white">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button className="p-2 text-[#888888] hover:text-white transition-all hover:bg-white/5 rounded-xl" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}>
            <ChevronRight size={20} />
          </button>
          </div>
        </div>
      </div>

      <div className="bg-[#111111] border border-white/5 p-8 rounded-[2rem] overflow-x-auto shadow-2xl relative">
        <div className="grid grid-cols-7 gap-3 min-w-[700px]">
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
            <div key={day} className="py-4 text-center text-[10px] font-black uppercase tracking-widest text-[#555] mono">
              {day}
            </div>
          ))}
          
          {[...Array(firstDayOfMonth)].map((_, i) => (
            <div key={`empty-${i}`} className="h-28 rounded-2xl bg-[#0a0a0a]/30" />
          ))}
          
          {[...Array(daysInMonth)].map((_, i) => {
            const dayNum = i + 1;
            const dateStr = getDayISO(dayNum);
            const todayIso = formatISODateLocal(new Date());
            const isFuture = dateStr > todayIso;
            const record = attendanceDays.find(r => r.date === dateStr);
            const status = record?.status ?? AttendanceStatus.NONE;
            const hasProof = !!record?.proofUrl;

            return (
              <motion.div
                key={dayNum}
                whileHover={isFuture ? undefined : { scale: 1.05 }}
                onClick={() => !isFuture && handleDayClick(dayNum)}
                className={`h-28 p-5 transition-all flex flex-col justify-between group relative rounded-2xl border-2 ${statusColors[status]} ${status === AttendanceStatus.NONE ? 'bg-[#0a0a0a]' : ''} ${isFuture ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-xl font-black mono tracking-tighter ${status === AttendanceStatus.NONE ? 'text-[#333]' : 'text-current'}`}>
                    {dayNum.toString().padStart(2, '0')}
                  </span>
                  {hasProof && (
                    <div className="w-5 h-5 bg-indigo-500 rounded-lg flex items-center justify-center text-[9px] font-black text-black shadow-lg shadow-indigo-500/20">R</div>
                  )}
                </div>
                
                {status !== AttendanceStatus.NONE && (
                    <div className={`text-[9px] font-black uppercase tracking-tighter px-2.5 py-1.5 rounded-lg border border-white/10`}>
                        {status}
                    </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-[#111111] w-full max-w-md p-10 shadow-3xl relative rounded-[2.5rem] border border-white/10"
          >
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-8 right-8 p-2.5 text-[#888888] hover:text-white bg-white/5 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
            <h3 className="text-3xl font-black uppercase tracking-tighter mb-2 text-white">COMMAND_LOG</h3>
            <p className="text-[#888888] text-[10px] font-bold mono uppercase tracking-widest mb-10 opacity-60">ENTRY_{selectedDay}/{currentDate.getMonth() + 1}</p>

            <div className="space-y-8">
              <div className="grid grid-cols-3 gap-3">
                <button 
                  onClick={() => handleStatusSelect(AttendanceStatus.PRESENT)}
                  className={`flex flex-col items-center gap-3 p-6 border rounded-2xl transition-all ${
                    selectedStatus === AttendanceStatus.PRESENT 
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' 
                      : 'border-white/5 hover:bg-white/5 text-emerald-500 hover:border-emerald-500/30'
                  }`}
                >
                  <Check size={28} />
                  <span className="text-[10px] font-black uppercase mono tracking-widest">PRESENT</span>
                </button>
                <button 
                  onClick={() => handleStatusSelect(AttendanceStatus.ABSENT)}
                  className={`flex flex-col items-center gap-3 p-6 border rounded-2xl transition-all ${
                    selectedStatus === AttendanceStatus.ABSENT 
                      ? 'bg-rose-500/20 border-rose-500 text-rose-500' 
                      : 'border-white/5 hover:bg-white/5 text-rose-500 hover:border-rose-500/30'
                  }`}
                >
                  <X size={28} />
                  <span className="text-[10px] font-black uppercase mono tracking-widest">ABSENT</span>
                </button>
                <button 
                  onClick={() => handleStatusSelect(AttendanceStatus.LEAVE)}
                  className={`flex flex-col items-center gap-3 p-6 border rounded-2xl transition-all ${
                    selectedStatus === AttendanceStatus.LEAVE 
                      ? 'bg-indigo-500/20 border-indigo-500 text-indigo-500' 
                      : 'border-white/5 hover:bg-white/5 text-indigo-500 hover:border-indigo-500/30'
                  }`}
                >
                  <Plane size={28} />
                  <span className="text-[10px] font-black uppercase mono tracking-widest">LEAVE</span>
                </button>
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] font-black text-[#888888] uppercase tracking-[0.2em] mb-2 mono opacity-60">REMARK_DOC</label>
                <input 
                  type="text" 
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="INPUT_REASON..." 
                  className="w-full bg-[#0a0a0a] border border-white/10 px-6 py-4.5 rounded-2xl outline-none focus:border-indigo-500 transition-colors text-sm mono text-white" 
                />
              </div>

              {selectedStatus === AttendanceStatus.LEAVE && (
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-[#888888] uppercase tracking-[0.2em] mb-2 mono opacity-60">LEAVE_COUNTED</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setLeaveCounted(true)}
                      className={`px-4 py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest mono transition-all ${leaveCounted ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'border-white/5 text-[#888] hover:bg-white/5'}`}
                    >
                      COUNTED
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaveCounted(false)}
                      className={`px-4 py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest mono transition-all ${!leaveCounted ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'border-white/5 text-[#888] hover:bg-white/5'}`}
                    >
                      NOT_COUNTED
                    </button>
                  </div>
                </div>
              )}

              <label className="flex flex-col items-center justify-center gap-3 w-full border-2 border-dashed border-white/5 rounded-2xl p-10 cursor-pointer hover:bg-white/5 hover:border-white/20 transition-all group">
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2_000_000) {
                      alert('File too large. Please upload a smaller proof file (max 2MB).');
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      setProofUrl(String(reader.result || ''));
                      setProofName(file.name);
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                <Upload className="text-[#444] group-hover:text-white transition-colors" size={24} />
                <span className="text-[10px] font-bold text-[#888888] group-hover:text-white uppercase tracking-widest mono transition-colors">{proofName ? `PROOF_${proofName}` : 'ATTACH_PROOF'}</span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button 
                  type="button"
                  onClick={handleClearAttendance}
                  className="w-full bg-white/5 text-rose-400 py-5 font-black uppercase tracking-tighter text-sm hover:bg-rose-500/10 transition-all rounded-2xl border border-white/10 flex items-center justify-center gap-3"
                >
                  <Trash2 size={18} /> CLEAR_RECORD
                </button>
                <button 
                  onClick={handleSubmitAttendance}
                  disabled={!selectedStatus}
                  className="w-full bg-[#ededed] text-[#0a0a0a] py-5 font-black uppercase tracking-tighter text-lg hover:bg-white hover:scale-[0.98] active:scale-95 transition-all rounded-2xl shadow-2xl shadow-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  SUBMIT_RECORD
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AttendanceCalendar;
