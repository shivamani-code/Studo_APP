import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Plus, X, AlertTriangle, Clock, Target } from 'lucide-react';
import { DataService } from '../services/dataService';

interface ImportantDate {
  id: string;
  title: string;
  date: string;
  type: 'exam' | 'assignment' | 'holiday' | 'other';
  description?: string;
}

const AcademicQueue: React.FC = () => {
  const [importantDates, setImportantDates] = useState<ImportantDate[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDate, setNewDate] = useState({
    title: '',
    date: '',
    type: 'exam' as const,
    description: ''
  });

  useEffect(() => {
    const saved = DataService.getImportantDates<ImportantDate[]>();
    setImportantDates(Array.isArray(saved) ? saved : []);
  }, []);

  const saveImportantDates = (dates: ImportantDate[]) => {
    DataService.saveImportantDates(dates);
    setImportantDates(dates);
  };

  const addImportantDate = () => {
    if (!newDate.title || !newDate.date) return;

    const date: ImportantDate = {
      id: Date.now().toString(),
      ...newDate
    };

    saveImportantDates([...importantDates, date]);
    setNewDate({ title: '', date: '', type: 'exam', description: '' });
    setShowAddModal(false);
  };

  const deleteImportantDate = (id: string) => {
    saveImportantDates(importantDates.filter(d => d.id !== id));
  };

  const getDaysLeft = (dateString: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(dateString);
    targetDate.setHours(0, 0, 0, 0);
    
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const getUrgencyColor = (daysLeft: number) => {
    if (daysLeft < 0) return 'text-gray-500';
    if (daysLeft <= 3) return 'text-rose-500';
    if (daysLeft <= 7) return 'text-amber-500';
    if (daysLeft <= 14) return 'text-yellow-500';
    return 'text-emerald-500';
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'exam': return <Target size={16} />;
      case 'assignment': return <Calendar size={16} />;
      case 'holiday': return <Clock size={16} />;
      default: return <AlertTriangle size={16} />;
    }
  };

  const sortedDates = [...importantDates].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const upcomingDates = sortedDates.filter(d => getDaysLeft(d.date) >= 0);
  const pastDates = sortedDates.filter(d => getDaysLeft(d.date) < 0);

  return (
    <div className="space-y-6">
      <div className="bg-[#0a0a0a] p-10 border border-white/[0.03] rounded-[2.5rem] shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-[#d4af37] rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.3)]">
                <Calendar className="text-black w-6 h-6" />
              </div>
              <h2 className="text-4xl font-black uppercase tracking-tighter text-white">ACADEMIC_QUEUE</h2>
            </div>
            <p className="text-[#888888] text-[10px] font-bold mono uppercase tracking-widest opacity-60">Important Dates Tracker</p>
          </div>
          
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-3 px-6 py-3 bg-[#d4af37] text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:scale-105 transition-all shadow-2xl"
          >
            <Plus size={18} />
            ADD_DATE
          </button>
        </div>

        {/* Upcoming Dates */}
        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-[#666] uppercase tracking-widest mono mb-4">UPCOMING</h3>
          {upcomingDates.length === 0 ? (
            <div className="text-center py-12 border border-white/[0.03] rounded-2xl">
              <Calendar className="text-[#666] w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="text-[#666] text-sm mono">No upcoming dates</p>
            </div>
          ) : (
            upcomingDates.map(date => {
              const daysLeft = getDaysLeft(date.date);
              return (
                <motion.div
                  key={date.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white/[0.02] border border-white/[0.03] rounded-2xl p-6 hover:border-[#d4af37]/20 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white/[0.02] rounded-xl text-[#666] group-hover:text-[#d4af37] transition-colors">
                        {getTypeIcon(date.type)}
                      </div>
                      <div>
                        <h4 className="text-lg font-black uppercase tracking-tighter text-white mb-1">{date.title}</h4>
                        <p className="text-[10px] font-bold mono uppercase tracking-widest text-[#666]">
                          {new Date(date.date).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                        {date.description && (
                          <p className="text-[#666] text-xs mt-2">{date.description}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`text-2xl font-black italic mono tracking-tighter ${getUrgencyColor(daysLeft)}`}>
                        {daysLeft === 0 ? 'TODAY' : daysLeft === 1 ? '1 DAY' : `${daysLeft} DAYS`}
                      </div>
                      <button
                        onClick={() => deleteImportantDate(date.id)}
                        className="mt-2 p-2 text-[#666] hover:text-rose-500 rounded-xl hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Past Dates */}
        {pastDates.length > 0 && (
          <div className="space-y-4 mt-8">
            <h3 className="text-[10px] font-black text-[#666] uppercase tracking-widest mono mb-4">PAST</h3>
            <div className="space-y-2">
              {pastDates.slice(0, 3).map(date => {
                const daysLeft = getDaysLeft(date.date);
                return (
                  <div
                    key={date.id}
                    className="bg-white/[0.01] border border-white/[0.02] rounded-xl p-4 opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-white/[0.02] rounded-lg text-[#666]">
                          {getTypeIcon(date.type)}
                        </div>
                        <div>
                          <h4 className="text-sm font-black uppercase tracking-tighter text-[#666]">{date.title}</h4>
                          <p className="text-[9px] font-bold mono uppercase tracking-widest text-[#666]">
                            {new Date(date.date).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-[#666] text-xs font-black mono">
                        {Math.abs(daysLeft)} DAYS AGO
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Add Date Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#111111] w-full max-w-md p-10 shadow-3xl relative rounded-[2.5rem] border border-white/10"
            >
              <button 
                onClick={() => setShowAddModal(false)}
                className="absolute top-8 right-8 p-2.5 text-[#888888] hover:text-white bg-white/5 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
              
              <h3 className="text-3xl font-black uppercase tracking-tighter mb-2 text-white">ADD_IMPORTANT_DATE</h3>
              <p className="text-[#888888] text-[10px] font-bold mono uppercase tracking-widest mb-10 opacity-60">SCHEDULE_MILESTONE</p>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-[#888888] uppercase tracking-[0.2em] mb-2 mono opacity-60">TITLE</label>
                  <input 
                    type="text" 
                    value={newDate.title}
                    onChange={(e) => setNewDate({ ...newDate, title: e.target.value })}
                    placeholder="Enter title..." 
                    className="w-full bg-[#0a0a0a] border border-white/10 px-6 py-4.5 rounded-2xl outline-none focus:border-[#d4af37] transition-colors text-sm mono text-white" 
                    autoFocus
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-[#888888] uppercase tracking-[0.2em] mb-2 mono opacity-60">DATE</label>
                  <input 
                    type="date" 
                    value={newDate.date}
                    onChange={(e) => setNewDate({ ...newDate, date: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-white/10 px-6 py-4.5 rounded-2xl outline-none focus:border-[#d4af37] transition-colors text-sm mono text-white" 
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-[#888888] uppercase tracking-[0.2em] mb-2 mono opacity-60">TYPE</label>
                  <select 
                    value={newDate.type}
                    onChange={(e) => setNewDate({ ...newDate, type: e.target.value as any })}
                    className="w-full bg-[#0a0a0a] border border-white/10 px-6 py-4.5 rounded-2xl outline-none focus:border-[#d4af37] transition-colors text-sm mono text-white"
                  >
                    <option value="exam">Exam</option>
                    <option value="assignment">Assignment</option>
                    <option value="holiday">Holiday</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-[#888888] uppercase tracking-[0.2em] mb-2 mono opacity-60">DESCRIPTION (OPTIONAL)</label>
                  <textarea 
                    value={newDate.description}
                    onChange={(e) => setNewDate({ ...newDate, description: e.target.value })}
                    placeholder="Add notes..." 
                    className="w-full bg-[#0a0a0a] border border-white/10 px-6 py-4.5 rounded-2xl outline-none focus:border-[#d4af37] transition-colors text-sm mono text-white resize-none h-20" 
                  />
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-white/5 border border-white/10 text-white py-5 font-black uppercase tracking-tighter text-lg hover:bg-white/10 transition-all rounded-2xl"
                  >
                    CANCEL
                  </button>
                  <button 
                    onClick={addImportantDate}
                    disabled={!newDate.title || !newDate.date}
                    className="flex-1 bg-[#d4af37] text-black py-5 font-black uppercase tracking-tighter text-lg hover:bg-white hover:scale-[0.98] active:scale-95 transition-all rounded-2xl shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ADD
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AcademicQueue;
