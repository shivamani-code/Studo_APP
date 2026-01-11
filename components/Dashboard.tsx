
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Calendar, PieChart, LogOut, Bell, Menu, 
  ShieldAlert, BookOpen, Timer, RefreshCw, GraduationCap, User,
  Download, Upload, Zap
} from 'lucide-react';
import AttendanceHealth from './AttendanceHealth';
import AttendanceCalendar from './AttendanceCalendar';
import AIPredictor from './AIPredictor';
import LeavePlanner from './LeavePlanner';
import Analytics from './Analytics';
import HabitTracker from './MonthlyHabitTracker';
import PersonalSpace from './PersonalSpace';
import CloudSync from './CloudSync';
import AcademicQueue from './AcademicQueue';
import TaskManager from './TaskManager';
import Profile from './Profile';
import { Subject, Course, Exam, UserProfile } from '../types';
import { DataService } from '../services/dataService';
import { BillingService } from '../services/billingService';

interface DashboardProps {
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const NOTIF_ENABLED_KEY = 'studo_notifications_enabled';
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(NOTIF_ENABLED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [billingLoading, setBillingLoading] = useState(true);
  const [billingAccessAllowed, setBillingAccessAllowed] = useState(true);
  const [trialHoursLeft, setTrialHoursLeft] = useState<number | null>(null);
  const [billingStatus, setBillingStatus] = useState<string>('');
  const [subscribing, setSubscribing] = useState(false);

  // Load data on component mount
  React.useEffect(() => {
    setSubjects(DataService.getSubjects());
    setCourses(DataService.getCourses());
    setExams(DataService.getExams());
    setProfile(DataService.getUserProfile());
  }, []);

  const refreshBilling = async () => {
    try {
      setBillingLoading(true);
      const s = await BillingService.getStatus();
      if (s?.ok === false) {
        setBillingAccessAllowed(true);
        setTrialHoursLeft(null);
        setBillingStatus('BILLING_UNAVAILABLE');
        return;
      }
      setBillingAccessAllowed(Boolean(s?.accessAllowed));
      setTrialHoursLeft(typeof s?.trialHoursLeft === 'number' ? s.trialHoursLeft : null);
      setBillingStatus(String(s?.status || ''));
    } finally {
      setBillingLoading(false);
    }
  };

  React.useEffect(() => {
    refreshBilling();
    const onProfileUpdated = () => refreshBilling();
    const onDataUpdated = () => refreshBilling();
    window.addEventListener('studo_profile_updated', onProfileUpdated);
    window.addEventListener('studo_data_updated', onDataUpdated);
    return () => {
      window.removeEventListener('studo_profile_updated', onProfileUpdated);
      window.removeEventListener('studo_data_updated', onDataUpdated);
    };
  }, []);

  const startSubscription = async () => {
    try {
      setSubscribing(true);
      const res = await BillingService.createSubscription();
      if ('error' in res) {
        alert(res.error);
        return;
      }
      await BillingService.openCheckout({
        keyId: res.keyId,
        subscriptionId: res.subscriptionId,
        onSuccess: () => {
          alert('Payment initiated. Your access will unlock after confirmation.');
          refreshBilling();
        },
        onDismiss: () => {
          refreshBilling();
        }
      });
    } catch (e: any) {
      alert(e?.message || 'Unable to start subscription');
    } finally {
      setSubscribing(false);
    }
  };

  const safeDateMs = (dateLike: any) => {
    const d = new Date(String(dateLike || ''));
    const t = d.getTime();
    return Number.isFinite(t) ? t : null;
  };

  const tryNotify = (title: string, body: string, dedupeKey: string) => {
    try {
      if (!notificationsEnabled) return;
      if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
      if (Notification.permission !== 'granted') return;

      const todayIso = new Date().toISOString().slice(0, 10);
      const key = `studo_notification_sent__${dedupeKey}__${todayIso}`;
      if (localStorage.getItem(key) === '1') return;
      localStorage.setItem(key, '1');
      new Notification(title, { body });
    } catch {
      // noop
    }
  };

  const runNotificationScan = () => {
    const now = Date.now();
    const horizonMs = 24 * 60 * 60 * 1000;

    const tasks = DataService.getTasks();
    tasks.forEach((t: any) => {
      if (t?.completed) return;
      const dueMs = safeDateMs(t?.dueDate);
      if (dueMs === null) return;
      if (dueMs < now || dueMs > now + horizonMs) return;
      tryNotify('Task due soon', String(t?.title || 'Task'), `task_${String(t?.id || '')}`);
    });

    const examsList = DataService.getExams();
    examsList.forEach((e: any) => {
      const examMs = safeDateMs(e?.date);
      if (examMs === null) return;
      if (examMs < now || examMs > now + horizonMs) return;
      tryNotify('Exam soon', String(e?.name || 'Exam'), `exam_${String(e?.id || '')}`);
    });
  };

  React.useEffect(() => {
    if (!notificationsEnabled) return;
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    runNotificationScan();
    const interval = window.setInterval(() => runNotificationScan(), 5 * 60 * 1000);
    const onDataUpdated = () => runNotificationScan();
    window.addEventListener('studo_data_updated', onDataUpdated);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('studo_data_updated', onDataUpdated);
    };
  }, [notificationsEnabled]);

  const toggleNotifications = async () => {
    try {
      if (typeof window === 'undefined' || typeof Notification === 'undefined') {
        alert('Notifications are not supported in this browser.');
        return;
      }

      if (!notificationsEnabled) {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          alert('Notification permission not granted.');
          return;
        }
      }

      const next = !notificationsEnabled;
      setNotificationsEnabled(next);
      localStorage.setItem(NOTIF_ENABLED_KEY, String(next));
      if (next) runNotificationScan();
    } catch {
      alert('Unable to enable notifications.');
    }
  };

  React.useEffect(() => {
    const onProfileUpdated = () => {
      setProfile(DataService.getUserProfile());
    };
    window.addEventListener('studo_profile_updated', onProfileUpdated);
    return () => window.removeEventListener('studo_profile_updated', onProfileUpdated);
  }, []);

  const exportData = () => {
    const data = DataService.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studo-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const success = DataService.importData(content);
      
      if (success) {
        alert('Data imported successfully! Refreshing your data...');
        setSubjects(DataService.getSubjects());
        setCourses(DataService.getCourses());
        setExams(DataService.getExams());
      } else {
        alert('Failed to import data. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };

  const navItems = [
    { id: 'overview', label: 'CORE', icon: <LayoutDashboard size={18} /> },
    { id: 'attendance', label: 'CALENDAR', icon: <Calendar size={18} /> },
    { id: 'analytics', label: 'ANALYTICS', icon: <PieChart size={18} /> },
    { id: 'planning', label: 'FORECAST', icon: <ShieldAlert size={18} /> },
    { id: 'personal', label: 'FOCUS', icon: <Timer size={18} /> },
    { id: 'habits', label: 'HABITS', icon: <BookOpen size={18} /> },
    { id: 'tasks', label: 'TASKS', icon: <BookOpen size={18} /> },
    { id: 'sync', label: 'SYNC', icon: <RefreshCw size={18} /> },
  ];

  const renderContent = () => {
    if (!billingLoading && !billingAccessAllowed) {
      return (
        <div className="max-w-2xl mx-auto">
          <div className="bg-[#0a0a0a] p-10 border border-white/[0.03] rounded-[2.5rem] shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] mono text-[#666]">PAYWALL</p>
            <p className="mt-6 text-3xl font-black tracking-tighter text-white uppercase">Trial ended</p>
            <p className="mt-3 text-xs font-bold mono text-[#888]">Subscribe to continue using Studo. Plan: ₹59 / month.</p>
            <p className="mt-2 text-xs font-bold mono text-[#888]">Status: {billingStatus || 'unknown'}</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={startSubscription}
                disabled={subscribing}
                className="flex-1 py-4 bg-[#d4af37] text-black font-black uppercase tracking-widest text-[10px] rounded-2xl hover:scale-[0.99] transition-all disabled:opacity-60"
              >
                {subscribing ? 'PROCESSING' : 'SUBSCRIBE_59_PER_MONTH'}
              </button>
              <button
                type="button"
                onClick={refreshBilling}
                className="flex-1 py-4 bg-white/[0.03] border border-white/10 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl"
              >
                REFRESH_STATUS
              </button>
            </div>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
              <div className="xl:col-span-2">
                <AttendanceHealth subjects={subjects} />
              </div>
              <div>
                <AIPredictor subjects={subjects} />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <HabitTracker />
              <TaskManager />
            </div>
          </div>
        );
      case 'attendance': return <AttendanceCalendar />;
      case 'analytics': return <Analytics subjects={subjects} fullWidth />;
      case 'planning': return <LeavePlanner subjects={subjects} />;
      case 'personal': return <PersonalSpace courses={courses} exams={exams} />;
      case 'habits': return <HabitTracker />;
      case 'tasks': return <TaskManager />;
      case 'profile': return <Profile />;
      case 'sync': return <CloudSync />;
      default: return null;
    }
  };

  const displayName = profile?.name?.trim() || 'STUDENT';
  const displayMeta = `${(profile?.className || profile?.department || 'PROFILE').toString().toUpperCase()} // SEM_${profile?.semester ?? 1}`;

  return (
    <div className="flex h-screen bg-[#050505] text-[#ededed] overflow-hidden">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-16'} transition-all duration-300 border-r border-white/[0.03] flex flex-col z-20 bg-[#0a0a0a]/50 backdrop-blur-xl fixed top-0 left-0 h-full lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 lg:p-8 flex items-center gap-4">
          <div className="bg-[#d4af37] p-1.5 rounded shadow-[0_0_20px_rgba(212,175,55,0.4)]">
            <Zap className="text-black w-4 h-4" />
          </div>
          {isSidebarOpen && <span className="text-xl lg:text-2xl font-black tracking-tighter uppercase leading-none text-white">Studo</span>}
        </div>
        
        <nav className="flex-1 px-4 lg:px-6 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all group relative overflow-hidden ${
                activeTab === item.id 
                  ? 'bg-[#d4af37]/5 text-white border border-[#d4af37]/20' 
                  : 'text-[#666] hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="relative z-10">{item.icon}</span>
              {isSidebarOpen && (
                <span className="relative z-10 text-[10px] font-black uppercase tracking-widest transition-all">
                  {item.label}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-4 lg:p-8 border-t border-white/[0.03] space-y-4 mt-auto">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-2xl border border-[#d4af37]/20 overflow-hidden shadow-inner bg-gradient-to-br from-[#d4af37]/20 to-transparent flex items-center justify-center text-[#d4af37]">
               <User size={16} className="lg:size-20" />
            </div>
            {isSidebarOpen && (
              <div className="text-right hidden lg:block">
                <p className="text-sm font-black uppercase tracking-tighter">{displayName}</p>
                <p className="text-[10px] text-[#666] font-bold mono uppercase tracking-widest">{displayMeta}</p>
              </div>
            )}
          </div>
          
          <button onClick={onLogout} className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-rose-500 hover:bg-rose-500/10 transition-all font-bold">
            <LogOut size={18} />
            {isSidebarOpen && <span className="text-[10px] font-bold uppercase tracking-widest mono">Disconnect</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-10 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main content area */}
      <main className="flex-1 flex flex-col overflow-hidden relative lg:ml-0">
        <header className="h-16 md:h-20 border-b border-white/[0.03] px-4 md:px-8 flex items-center justify-between z-10 bg-[#050505]/50 backdrop-blur-lg">
          <div className="flex items-center gap-4 md:gap-6">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2.5 bg-white/[0.02] rounded-xl text-[#666] hover:text-[#d4af37] transition-all hover:bg-white/05">
              <Menu size={20} />
            </button>
            <h2 className="serif-luxury text-lg md:text-xl tracking-tighter text-white uppercase">{activeTab}</h2>
          </div>
          
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={toggleNotifications}
              className={`relative p-2.5 bg-white/[0.02] rounded-xl cursor-pointer transition-all group ${
                notificationsEnabled ? 'text-[#d4af37]' : 'text-[#666] hover:text-[#d4af37]'
              }`}
              title={notificationsEnabled ? 'Notifications enabled' : 'Enable notifications'}
            >
              <Bell size={18} />
              {notificationsEnabled && (
                <span className="absolute top-2 right-2 bg-[#d4af37] w-2 h-2 rounded-full border-2 border-[#050505]"></span>
              )}
            </button>

            {!billingLoading && billingAccessAllowed && (
              <button
                type="button"
                onClick={startSubscription}
                disabled={subscribing}
                className="hidden md:flex items-center px-4 py-2 bg-[#d4af37]/10 border border-[#d4af37]/20 rounded-xl text-[10px] font-black uppercase mono text-[#d4af37] tracking-widest"
                title="Subscribe ₹59/month"
              >
                {subscribing ? 'PROCESSING' : 'UPGRADE'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-4 pl-6 border-l border-white/[0.03] hidden sm:flex text-left"
            >
              <div className="text-right">
                <p className="text-sm font-black uppercase tracking-tighter">{displayName}</p>
                <p className="text-[10px] text-[#666] font-bold mono uppercase tracking-widest">{displayMeta}</p>
              </div>
              <div className="w-10 h-10 rounded-2xl border border-[#d4af37]/20 overflow-hidden shadow-inner bg-gradient-to-br from-[#d4af37]/20 to-transparent flex items-center justify-center text-[#d4af37]">
                 <User size={20} />
              </div>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
          {!billingLoading && billingAccessAllowed && trialHoursLeft !== null && (
            <div className="mb-4 bg-white/[0.03] border border-white/[0.05] rounded-2xl px-5 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest mono text-[#d4af37]">TRIAL_ACTIVE</p>
              <p className="mt-1 text-[10px] font-bold mono uppercase tracking-widest text-[#777] opacity-80">{trialHoursLeft} hours left</p>
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="w-full"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
