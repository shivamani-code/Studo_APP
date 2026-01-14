import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Award, Calendar as CalIcon, Clock, Plus, Check, X, AlertCircle } from 'lucide-react';
import { Exam, QueueItem } from '../types';
import { DataService } from '../services/dataService';

interface Props {
  courses?: any[];
  exams?: Exam[];
}

interface FocusSession {
  id: string;
  date: string;
  duration: number;
  completed: boolean;
}

const PersonalSpace: React.FC<Props> = ({ courses, exams }) => {
  const [activeSession, setActiveSession] = useState(false);
  const [sessionTime, setSessionTime] = useState(25 * 60);
  const [timeLeft, setTimeLeft] = useState(sessionTime);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [mode, setMode] = useState<'focus' | 'short' | 'long'>('focus');
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [showAddQueueModal, setShowAddQueueModal] = useState(false);
  const [newQueueItem, setNewQueueItem] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'high' | 'medium' | 'low',
    dueDate: ''
  });

  useEffect(() => {
    const savedSessions = DataService.getFocusSessions<FocusSession[]>();
    setSessions(Array.isArray(savedSessions) ? savedSessions : []);
    
    // Load queue items
    const items = DataService.getQueueItems();
    setQueueItems(items);
  }, []);

  const sessionTimeRef = useRef(sessionTime);
  const timeLeftRef = useRef(timeLeft);
  const segmentStartRemainingRef = useRef(sessionTime);
  useEffect(() => {
    sessionTimeRef.current = sessionTime;
  }, [sessionTime]);
  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeSession && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((t) => t - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      completeSession();
    }
    return () => clearInterval(interval);
  }, [activeSession, timeLeft]);

  const getTodayFocusTime = () => {
    const today = new Date().toDateString();
    const todaySessions = sessions.filter(session => 
      new Date(session.date).toDateString() === today
    );
    return todaySessions.reduce((total, session) => total + session.duration, 0);
  };

  const getMonthFocusTime = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    return sessions.filter(session => {
      const sessionDate = new Date(session.date);
      return sessionDate.getMonth() === currentMonth && 
             sessionDate.getFullYear() === currentYear;
    }).reduce((total, session) => total + session.duration, 0);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const persistSession = (completed: boolean) => {
    const duration = segmentStartRemainingRef.current - timeLeftRef.current;
    if (!Number.isFinite(duration) || duration <= 0) return;

    const newSession: FocusSession = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      duration,
      completed
    };

    setSessions((prev) => {
      const next = [newSession, ...prev].slice(0, 500);
      DataService.saveFocusSessions(next);
      return next;
    });

    segmentStartRemainingRef.current = timeLeftRef.current;
  };

  const completeSession = () => {
    persistSession(true);
    setActiveSession(false);
    setTimeLeft(sessionTime);
    segmentStartRemainingRef.current = sessionTimeRef.current;
  };

  const toggleTimer = () => {
    setActiveSession((prev) => {
      if (prev) {
        persistSession(false);
        return false;
      }
      segmentStartRemainingRef.current = timeLeftRef.current;
      return true;
    });
  };

  const resetTimer = () => {
    if (segmentStartRemainingRef.current !== timeLeftRef.current) {
      persistSession(false);
    }
    setActiveSession(false);
    setTimeLeft(sessionTime);
    segmentStartRemainingRef.current = sessionTimeRef.current;
  };

  const changeMode = (newMode: 'focus' | 'short' | 'long') => {
    if (segmentStartRemainingRef.current !== timeLeftRef.current) {
      persistSession(false);
    }
    setMode(newMode);
    setActiveSession(false);
    const newTime = newMode === 'focus' ? 25 * 60 : newMode === 'short' ? 5 * 60 : 15 * 60;
    setSessionTime(newTime);
    setTimeLeft(newTime);
    segmentStartRemainingRef.current = newTime;
  };

  useEffect(() => {
    return () => {
      if (segmentStartRemainingRef.current !== timeLeftRef.current) {
        persistSession(false);
      }
    };
  }, []);

  // Queue management functions
  const addQueueItem = () => {
    if (newQueueItem.title.trim()) {
      DataService.addQueueItem({
        ...newQueueItem,
        completed: false
      });
      setNewQueueItem({ title: '', description: '', priority: 'medium', dueDate: '' });
      setShowAddQueueModal(false);
      
      // Reload queue items
      const items = DataService.getQueueItems();
      setQueueItems(items);
    }
  };

  const toggleQueueItem = (id: string) => {
    DataService.toggleQueueItem(id);
    const items = DataService.getQueueItems();
    setQueueItems(items);
  };

  const deleteQueueItem = (id: string) => {
    DataService.deleteQueueItem(id);
    const items = DataService.getQueueItems();
    setQueueItems(items);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-rose-500 text-white';
      case 'medium': return 'bg-amber-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6 min-h-0">
      {/* Productivity Hub / Pomodoro */}
      <div className="xl:col-span-2 space-y-4 md:space-y-6">
        <div className="bg-[#0a0a0a] p-4 md:p-8 lg:p-12 border border-white/[0.03] rounded-[2.5rem] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 md:w-64 h-32 md:h-64 bg-[#d4af37]/5 blur-[100px] pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 md:mb-8 lg:mb-12 relative z-10 gap-4">
            <div>
              <h3 className="serif-luxury text-lg md:text-xl lg:text-3xl uppercase tracking-tighter mb-2 text-white">FOCUS_CORE</h3>
              <p className="text-[#888888] text-[10px] font-bold mono uppercase tracking-widest opacity-60">Productivity Timer</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => changeMode('short')}
                className={`px-2 md:px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                  mode === 'short' ? 'bg-[#d4af37] text-black' : 'bg-white/5 text-[#666] hover:text-white'
                }`}
              >
                5M
              </button>
              <button
                onClick={() => changeMode('focus')}
                className={`px-2 md:px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                  mode === 'focus' ? 'bg-[#d4af37] text-black' : 'bg-white/5 text-[#666] hover:text-white'
                }`}
              >
                25M
              </button>
              <button
                onClick={() => changeMode('long')}
                className={`px-2 md:px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                  mode === 'long' ? 'bg-[#d4af37] text-black' : 'bg-white/5 text-[#666] hover:text-white'
                }`}
              >
                15M
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center relative z-10">
            <h1 className="text-3xl md:text-5xl lg:text-7xl font-black tracking-tighter leading-none mb-4 md:mb-8 lg:mb-16 tabular-nums italic mono text-white relative z-10" style={{ textShadow: '0 0 50px rgba(255,255,255,0.05)' }}>
              {formatTime(timeLeft)}
            </h1>

            <div className="flex items-center gap-3 md:gap-6 lg:gap-10 relative z-10">
              <button 
                onClick={toggleTimer}
                className="w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-28 bg-[#ededed] text-[#0a0a0a] flex items-center justify-center hover:bg-white hover:scale-105 active:scale-95 transition-all shadow-3xl shadow-white/5 rounded-full"
              >
                {activeSession ? <Pause size={20} className="md:size-24 lg:size-32" fill="currentColor" /> : <Play size={20} className="md:size-24 lg:size-32 ml-2" fill="currentColor" />}
              </button>
              <button 
                onClick={resetTimer}
                className="w-8 h-8 md:w-10 md:h-10 lg:w-12 lg:h-16 border border-white/10 bg-white/5 text-[#888888] hover:text-white hover:bg-white/10 transition-all rounded-full flex items-center justify-center shadow-lg"
              >
                <RotateCcw size={12} className="md:size-16 lg:size-20" />
              </button>
            </div>
          </div>
        </div>

        {/* Focus Stats */}
        <div className="bg-[#111111] p-4 md:p-6 lg:p-10 border border-white/5 rounded-[2rem] shadow-xl">
          <h3 className="text-base md:text-lg lg:text-xl font-black uppercase tracking-tighter mb-4 md:mb-6 lg:mb-10 flex items-center gap-3 text-white">
            <Award className="text-[#d4af37]" size={16} /> FOCUS_STATS
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 lg:gap-6">
            <div className="bg-black/30 p-3 md:p-4 lg:p-6 border border-white/5 rounded-xl">
              <p className="text-[10px] font-black text-[#666] uppercase tracking-widest mono mb-2">TODAY_FOCUS</p>
              <p className="text-lg md:text-xl lg:text-2xl font-black text-[#d4af37]">{formatDuration(getTodayFocusTime())}</p>
            </div>
            <div className="bg-black/30 p-3 md:p-4 lg:p-6 border border-white/5 rounded-xl">
              <p className="text-[10px] font-black text-[#666] uppercase tracking-widest mono mb-2">MONTH_FOCUS</p>
              <p className="text-lg md:text-xl lg:text-2xl font-black text-white">{formatDuration(getMonthFocusTime())}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Side: Queue */}
      <div className="space-y-4 md:space-y-6">
        <div className="bg-[#111111] p-4 md:p-6 lg:p-10 border border-white/5 rounded-[2rem] shadow-xl">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h3 className="text-base md:text-lg lg:text-xl font-black uppercase tracking-tighter text-white">QUEUE</h3>
            <button
              onClick={() => setShowAddQueueModal(true)}
              className="p-2 bg-[#d4af37] text-black rounded-xl hover:bg-white transition-all"
            >
              <Plus size={16} />
            </button>
          </div>
          
          <div className="space-y-3 md:space-y-4">
            {queueItems.map(item => (
              <div key={item.id} className="bg-[#0a0a0a] p-3 md:p-4 lg:p-6 border border-white/10 rounded-xl hover:border-white/20 transition-all">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleQueueItem(item.id)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      item.completed 
                        ? 'bg-[#d4af37] border-[#d4af37]' 
                        : 'border-white/20 hover:border-[#d4af37]/50'
                    }`}
                  >
                    {item.completed && <Check size={12} className="text-black" />}
                  </button>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${getPriorityColor(item.priority)}`}>
                        {item.priority}
                      </span>
                      {item.dueDate && (
                        <span className="text-[10px] text-[#666] mono uppercase tracking-widest">
                          {new Date(item.dueDate).toLocaleDateString('default', { month: 'short', day: 'numeric' }).toUpperCase()}
                        </span>
                      )}
                    </div>
                    
                    <h4 className={`font-black text-sm md:text-base uppercase tracking-tighter mb-2 ${
                      item.completed ? 'text-[#666] line-through' : 'text-white'
                    }`}>
                      {item.title}
                    </h4>
                    
                    <p className="text-[10px] text-[#888888] mono uppercase tracking-widest mb-3">
                      {item.description}
                    </p>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => deleteQueueItem(item.id)}
                        className="p-1 text-[#666] hover:text-rose-500 transition-all"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add Queue Modal */}
        {showAddQueueModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-lg font-black uppercase tracking-tighter mb-4 text-white">ADD_QUEUE_ITEM</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-[#666] uppercase tracking-widest mono mb-2 block">TITLE</label>
                  <input
                    type="text"
                    value={newQueueItem.title}
                    onChange={(e) => setNewQueueItem({ ...newQueueItem, title: e.target.value })}
                    className="w-full p-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder-[#666] focus:border-[#d4af37] focus:outline-none"
                    placeholder="Enter task title..."
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-black text-[#666] uppercase tracking-widest mono mb-2 block">DESCRIPTION</label>
                  <textarea
                    value={newQueueItem.description}
                    onChange={(e) => setNewQueueItem({ ...newQueueItem, description: e.target.value })}
                    className="w-full p-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder-[#666] focus:border-[#d4af37] focus:outline-none resize-none"
                    rows={3}
                    placeholder="Enter description..."
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-black text-[#666] uppercase tracking-widest mono mb-2 block">PRIORITY</label>
                  <select
                    value={newQueueItem.priority}
                    onChange={(e) => setNewQueueItem({ ...newQueueItem, priority: e.target.value as 'high' | 'medium' | 'low' })}
                    className="w-full p-3 bg-black/30 border border-white/10 rounded-xl text-white focus:border-[#d4af37] focus:outline-none"
                  >
                    <option value="low">LOW</option>
                    <option value="medium">MEDIUM</option>
                    <option value="high">HIGH</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-[10px] font-black text-[#666] uppercase tracking-widest mono mb-2 block">DUE_DATE</label>
                  <input
                    type="date"
                    value={newQueueItem.dueDate}
                    onChange={(e) => setNewQueueItem({ ...newQueueItem, dueDate: e.target.value })}
                    className="w-full p-3 bg-black/30 border border-white/10 rounded-xl text-white focus:border-[#d4af37] focus:outline-none"
                  />
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddQueueModal(false)}
                  className="flex-1 p-3 border border-white/10 text-[#666] hover:text-white transition-all rounded-xl"
                >
                  CANCEL
                </button>
                <button
                  onClick={addQueueItem}
                  className="flex-1 p-3 bg-[#d4af37] text-black hover:bg-white transition-all rounded-xl font-black"
                >
                  ADD_ITEM
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalSpace;
