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
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(false);

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

  const snapshotScore = (snapshot: any): number => {
    try {
      if (!snapshot || typeof snapshot !== 'object') return 0;
      const arrLen = (v: any) => (Array.isArray(v) ? v.length : 0);
      const isNonEmptyString = (v: any) => typeof v === 'string' && v.trim().length > 0;
      const profile = snapshot.userProfile;
      const profileScore = profile && typeof profile === 'object'
        ? Object.values(profile).some((v) => isNonEmptyString(v))
          ? 1
          : 0
        : 0;

      const arraysScore =
        arrLen(snapshot.subjects) +
        arrLen(snapshot.attendanceDays) +
        arrLen(snapshot.queueItems) +
        arrLen(snapshot.habits) +
        arrLen(snapshot.tasks) +
        arrLen(snapshot.courses) +
        arrLen(snapshot.exams) +
        arrLen(snapshot.contactSubmissions) +
        arrLen(snapshot.focusSessions) +
        arrLen(snapshot.habitChecks) +
        arrLen(snapshot.importantDates);

      return arraysScore + profileScore;
    } catch {
      return 0;
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
      setAutoSyncEnabled(false);
      let allowAutoSync = false;

      if (!isAuthenticated) {
        setCloudReady(true);
        return;
      }

      try {
        const localSnapshotStr = DataService.exportData();
        const localSnapshotObj = JSON.parse(localSnapshotStr);
        const localEmpty = isSnapshotEffectivelyEmpty(localSnapshotObj);
        const localScore = snapshotScore(localSnapshotObj);

        const remoteRes = await CloudDataService.pullUserData();
        if (!remoteRes.ok) return;

        // Cloud is reachable for this session; enable autosync so subsequent edits are persisted.
        allowAutoSync = true;

        const remoteSnapshotObj = remoteRes.data.data;
        const remoteEmpty = isSnapshotEffectivelyEmpty(remoteSnapshotObj);
        const remoteScore = snapshotScore(remoteSnapshotObj);

        if (!remoteEmpty && remoteSnapshotObj) {
          if (localEmpty || remoteScore >= localScore) {
            const ok = DataService.importData(JSON.stringify(remoteSnapshotObj));
            if (ok) window.dispatchEvent(new Event('studo_data_updated'));
            return;
          }

          // Local appears richer than cloud; push local up so other devices can restore.
          await CloudDataService.pushUserData(localSnapshotObj);
          return;
        }

        if (!localEmpty && remoteEmpty) {
          await CloudDataService.pushUserData(localSnapshotObj);
        }
      } catch {
        
      } finally {
        if (!cancelled) {
          setCloudReady(true);
          setAutoSyncEnabled(allowAutoSync);
        }
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
    if (!autoSyncEnabled) return;

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
    // (intentionally not forcing an immediate push on login to avoid overwriting cloud with empty/stale local snapshots)

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener('studo_data_updated', onData);
      window.removeEventListener('studo_profile_updated', onData);
      window.removeEventListener('studo_attendance_updated', onData);
      window.removeEventListener('studo_focus_updated', onData);
    };
  }, [isAuthenticated, cloudReady, autoSyncEnabled]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // best-effort
    } finally {
      setCloudReady(false);
      setAutoSyncEnabled(false);
      setIsAuthenticated(false);
      DataService.setActiveUserId(null);
      window.dispatchEvent(new Event('studo_data_updated'));
    }
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
