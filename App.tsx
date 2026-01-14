import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import { supabase } from './services/supabaseClient';
import { DataService } from './services/dataService';
import { CloudDataService } from './services/cloudDataService';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [cloudReady, setCloudReady] = useState<boolean>(false);

  const isSnapshotEffectivelyEmpty = (snapshot: any): boolean => {
    try {
      if (!snapshot || typeof snapshot !== 'object') return true;

      const hasArray = (v: any) => Array.isArray(v) && v.length > 0;
      const isNonEmptyString = (v: any) => typeof v === 'string' && v.trim().length > 0;
      const hasMeaningfulProfile = (p: any) => {
        if (!p || typeof p !== 'object') return false;
        return Object.values(p).some((v) => {
          if (isNonEmptyString(v)) return true;
          return false;
        });
      };

      if (hasMeaningfulProfile(snapshot.userProfile)) return false;
      if (hasArray(snapshot.subjects)) return false;
      if (hasArray(snapshot.attendanceDays)) return false;
      if (hasArray(snapshot.queueItems)) return false;
      if (hasArray(snapshot.habits)) return false;
      if (hasArray(snapshot.tasks)) return false;
      if (hasArray(snapshot.courses)) return false;
      if (hasArray(snapshot.exams)) return false;
      if (hasArray(snapshot.contactSubmissions)) return false;
      if (hasArray(snapshot.focusSessions)) return false;
      if (hasArray(snapshot.habitChecks)) return false;
      if (hasArray(snapshot.importantDates)) return false;

      return true;
    } catch {
      return true;
    }
  };

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setIsAuthenticated(!!data.session);
      DataService.setActiveUserId(data.session?.user?.id ?? null);
      window.dispatchEvent(new Event('studo_data_updated'));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      DataService.setActiveUserId(session?.user?.id ?? null);
      window.dispatchEvent(new Event('studo_data_updated'));
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrateFromCloud = async () => {
      setCloudReady(false);

      if (!isAuthenticated) {
        setCloudReady(true);
        return;
      }

      try {
        const localSnapshotStr = DataService.exportData();
        const localSnapshotObj = JSON.parse(localSnapshotStr);
        const localEmpty = isSnapshotEffectivelyEmpty(localSnapshotObj);

        const remoteRes = await CloudDataService.pullUserData();
        if (!remoteRes.ok) return;

        const remoteSnapshotObj = remoteRes.data.data;
        const remoteEmpty = isSnapshotEffectivelyEmpty(remoteSnapshotObj);

        if (localEmpty && !remoteEmpty && remoteSnapshotObj) {
          DataService.importData(JSON.stringify(remoteSnapshotObj));
          return;
        }

        if (!localEmpty && remoteEmpty) {
          await CloudDataService.pushUserData(localSnapshotObj);
        }
      } catch {
        
      } finally {
        if (!cancelled) setCloudReady(true);
      }
    };

    hydrateFromCloud();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!cloudReady) return;

    let timer: number | null = null;
    let inFlight = false;
    let pending = false;
    let lastSentSnapshot: string | null = null;

    const schedule = () => {
      if (!isAuthenticated) return;
      pending = true;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        timer = null;
        if (inFlight) return;
        if (!pending) return;

        pending = false;
        inFlight = true;
        try {
          const snapshot = DataService.exportData();
          if (lastSentSnapshot === snapshot) return;

          const payload = JSON.parse(snapshot);
          if (isSnapshotEffectivelyEmpty(payload)) return;
          const res = await CloudDataService.pushUserData(payload);
          if (res.ok) lastSentSnapshot = snapshot;
        } catch {
          // best-effort autosync
        } finally {
          inFlight = false;
          if (pending) schedule();
        }
      }, 1500);
    };

    const onData = () => schedule();
    window.addEventListener('studo_data_updated', onData);
    window.addEventListener('studo_profile_updated', onData);
    window.addEventListener('studo_attendance_updated', onData);
    window.addEventListener('studo_focus_updated', onData);

    // Initial sync shortly after login
    schedule();

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener('studo_data_updated', onData);
      window.removeEventListener('studo_profile_updated', onData);
      window.removeEventListener('studo_attendance_updated', onData);
      window.removeEventListener('studo_focus_updated', onData);
    };
  }, [isAuthenticated, cloudReady]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    DataService.setActiveUserId(null);
  };

  return (
    <div className="min-h-screen">
      <Routes>
        <Route 
          path="/" 
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <LandingPage />} 
        />
        <Route 
          path="/dashboard/*" 
          element={isAuthenticated ? <Dashboard onLogout={handleLogout} /> : <Navigate to="/" />} 
        />
      </Routes>
    </div>
  );
};

export default App;
