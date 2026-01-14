import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Plus, X, Check, ChevronLeft, ChevronRight, Calendar as CalIcon } from 'lucide-react';
import { Habit } from '../types';
import { DataService } from '../services/dataService';

interface HabitCheck {
  date: string;
  habitId: string;
  completed: boolean;
}

const MonthlyHabitTracker: React.FC = () => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [habitChecks, setHabitChecks] = useState<HabitCheck[]>([]);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');

  useEffect(() => {
    setHabits(DataService.getHabits());
    loadHabitChecks();
  }, [currentDate]);

  const loadHabitChecks = () => {
    const saved = DataService.getHabitChecks<HabitCheck[]>();
    setHabitChecks(Array.isArray(saved) ? saved : []);
  };

  const saveHabitChecks = (checks: HabitCheck[]) => {
    DataService.saveHabitChecks(checks);
    setHabitChecks(checks);
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const addHabit = () => {
    if (!newHabitName.trim()) return;
    
    const newHabit: Habit = {
      id: Date.now().toString(),
      name: newHabitName,
      streak: 0,
      lastChecked: ''
    };
    
    const updatedHabits = [...habits, newHabit];
    DataService.saveHabits(updatedHabits);
    setHabits(updatedHabits);
    setNewHabitName('');
    setShowAddHabit(false);
  };

  const deleteHabit = (habitId: string) => {
    const updatedHabits = habits.filter(h => h.id !== habitId);
    DataService.saveHabits(updatedHabits);
    setHabits(updatedHabits);
  };

  const toggleHabitCheck = (habitId: string, day: number) => {
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0];
    const existingCheck = habitChecks.find(c => c.habitId === habitId && c.date === dateStr);
    
    let updatedChecks: HabitCheck[];
    if (existingCheck) {
      updatedChecks = habitChecks.filter(c => !(c.habitId === habitId && c.date === dateStr));
    } else {
      updatedChecks = [...habitChecks, { date: dateStr, habitId, completed: true }];
    }
    
    saveHabitChecks(updatedChecks);
  };

  const isHabitCheckedOnDay = (habitId: string, day: number): boolean => {
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0];
    return habitChecks.some(c => c.habitId === habitId && c.date === dateStr && c.completed);
  };

  const getMonthlyStats = (habitId: string) => {
    const daysInMonth = getDaysInMonth(currentDate);
    const checkedDays = habitChecks.filter(c => 
      c.habitId === habitId && 
      c.completed && 
      new Date(c.date).getMonth() === currentDate.getMonth() &&
      new Date(c.date).getFullYear() === currentDate.getFullYear()
    ).length;
    
    return {
      completed: checkedDays,
      total: daysInMonth,
      percentage: Math.round((checkedDays / daysInMonth) * 100)
    };
  };

  const changeMonth = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-gradient-to-br from-[#0a0a0a] to-[#0f0f0f] p-6 md:p-10 border border-white/[0.03] rounded-[2.5rem] shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 md:mb-8 gap-4">
          <div>
            <div className="flex items-center gap-4 mb-3">
              <div className="p-3 bg-gradient-to-br from-[#d4af37] via-[#f4e4bc] to-[#d4af37] rounded-xl shadow-[0_0_20px_rgba(212,175,55,0.4)] animate-pulse">
                <Flame className="text-black w-6 h-6" />
              </div>
              <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter text-white">HABIT_TRACKER</h2>
            </div>
            <p className="text-[#888888] text-[10px] font-bold mono uppercase tracking-widest opacity-60">Monthly Performance Analysis</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full sm:w-auto">
            <button 
              onClick={() => changeMonth(-1)}
              className="p-2.5 md:p-3 bg-white/[0.02] rounded-xl text-[#666] hover:text-[#d4af37] hover:bg-white/5 transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="px-4 md:px-6 py-3 bg-white/[0.02] rounded-xl w-full sm:w-auto min-w-0 text-center">
              <span className="text-sm font-black text-white uppercase tracking-widest">{monthYear}</span>
            </div>
            <button 
              onClick={() => changeMonth(1)}
              className="p-2.5 md:p-3 bg-white/[0.02] rounded-xl text-[#666] hover:text-[#d4af37] hover:bg-white/5 transition-all"
            >
              <ChevronRight size={20} />
            </button>
            <button 
              onClick={() => setShowAddHabit(true)}
              className="flex items-center justify-center gap-3 px-4 md:px-6 py-3 bg-[#d4af37] text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:scale-105 transition-all shadow-2xl w-full sm:w-auto"
            >
              <Plus size={18} />
              ADD_HABIT
            </button>
          </div>
        </div>

        {habits.length === 0 ? (
          <div className="text-center py-20">
            <Flame className="text-[#666] w-16 h-16 mx-auto mb-6 opacity-20" />
            <h3 className="text-xl font-black text-[#666] mb-4">NO_HABITS_TRACKED</h3>
            <p className="text-[#666] text-sm mono mb-8">Start building better habits this month</p>
            <button 
              onClick={() => setShowAddHabit(true)}
              className="px-8 py-4 bg-[#d4af37] text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:scale-105 transition-all"
            >
              CREATE_FIRST_HABIT
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Monthly Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {habits.map(habit => {
                const stats = getMonthlyStats(habit.id);
                return (
                  <motion.div
                    key={habit.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-white/[0.02] to-white/[0.05] border border-white/[0.03] rounded-2xl p-6 hover:border-[#d4af37]/20 transition-all hover:shadow-[0_0_20px_rgba(212,175,55,0.1)]"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-black uppercase tracking-tighter text-white truncate">{habit.name}</h3>
                      <button
                        onClick={() => deleteHabit(habit.id)}
                        className="p-2 text-[#666] hover:text-rose-500 rounded-xl hover:bg-rose-500/10 transition-all"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-[9px] font-bold text-[#666] uppercase mono mb-1">COMPLETED</p>
                        <p className="text-2xl font-black italic text-[#d4af37]">{stats.completed}/{stats.total}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold text-[#666] uppercase mono mb-1">RATE</p>
                        <p className="text-2xl font-black italic text-white">{stats.percentage}%</p>
                      </div>
                    </div>
                    
                    <div className="w-full bg-black/50 rounded-full h-2 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${stats.percentage}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-[#d4af37] via-[#f4e4bc] to-[#d4af37] rounded-full shadow-[0_0_10px_rgba(212,175,55,0.3)]"
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Calendar Grid */}
            <div className="bg-gradient-to-br from-white/[0.02] to-white/[0.05] border border-white/[0.03] rounded-2xl p-6 overflow-x-auto">
              <div className="min-w-[800px]">
                <div className="grid grid-cols-8 gap-2 mb-4">
                  <div className="text-[10px] font-black text-[#666] uppercase tracking-widest mono text-center">HABIT</div>
                  {Array.from({ length: daysInMonth }, (_, i) => (
                    <div key={i} className="text-[10px] font-black text-[#666] uppercase tracking-widest mono text-center">
                      {i + 1}
                    </div>
                  ))}
                </div>
                
                {habits.map(habit => (
                  <div key={habit.id} className="grid grid-cols-8 gap-2 mb-2">
                    <div className="text-[10px] font-black text-white uppercase tracking-widest mono truncate pr-2">
                      {habit.name}
                    </div>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const isChecked = isHabitCheckedOnDay(habit.id, i + 1);
                      const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1).toDateString();
                      
                      return (
                        <button
                          key={i}
                          onClick={() => toggleHabitCheck(habit.id, i + 1)}
                          className={`h-8 w-8 rounded-lg transition-all flex items-center justify-center ${
                            isChecked 
                              ? 'bg-gradient-to-br from-[#d4af37] to-[#f4e4bc] shadow-[0_0_10px_rgba(212,175,55,0.3)] border border-[#d4af37]/20' 
                              : 'bg-black/40 border border-white/10 hover:border-[#d4af37]/40 hover:bg-[#d4af37]/10'
                          } ${isToday ? 'ring-2 ring-[#d4af37]/50 shadow-[0_0_10px_rgba(212,175,55,0.2)]' : ''}`}
                        >
                          {isChecked && <Check className="text-black w-4 h-4" />}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Habit Modal */}
      <AnimatePresence>
        {showAddHabit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#111111] w-full max-w-md p-10 shadow-3xl relative rounded-[2.5rem] border border-white/10"
            >
              <button 
                onClick={() => setShowAddHabit(false)}
                className="absolute top-8 right-8 p-2.5 text-[#888888] hover:text-white bg-white/5 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
              
              <h3 className="text-3xl font-black uppercase tracking-tighter mb-2 text-white">NEW_HABIT</h3>
              <p className="text-[#888888] text-[10px] font-bold mono uppercase tracking-widest mb-10 opacity-60">CREATE_MONTHLY_PATTERN</p>

              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-[#888888] uppercase tracking-[0.2em] mb-2 mono opacity-60">HABIT_NAME</label>
                  <input 
                    type="text" 
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    placeholder="ENTER_HABIT..." 
                    className="w-full bg-[#0a0a0a] border border-white/10 px-6 py-4.5 rounded-2xl outline-none focus:border-[#d4af37] transition-colors text-sm mono text-white" 
                    autoFocus
                  />
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowAddHabit(false)}
                    className="flex-1 bg-white/5 border border-white/10 text-white py-5 font-black uppercase tracking-tighter text-lg hover:bg-white/10 transition-all rounded-2xl"
                  >
                    CANCEL
                  </button>
                  <button 
                    onClick={addHabit}
                    disabled={!newHabitName.trim()}
                    className="flex-1 bg-[#d4af37] text-black py-5 font-black uppercase tracking-tighter text-lg hover:bg-white hover:scale-[0.98] active:scale-95 transition-all rounded-2xl shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    CREATE
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

export default MonthlyHabitTracker;
