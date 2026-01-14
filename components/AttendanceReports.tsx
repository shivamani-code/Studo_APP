import React, { useEffect, useMemo, useState } from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { AttendanceDay, AttendanceStatus } from '../types';
import { DataService } from '../services/dataService';

const AttendanceReports: React.FC = () => {
  const [days, setDays] = useState<AttendanceDay[]>([]);

  const dateFromISO = (iso: string) => {
    const s = String(iso || '').slice(0, 10);
    const parts = s.split('-');
    if (parts.length !== 3) return new Date(s);
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date(s);
    return new Date(y, m - 1, d);
  };

  const blobUrlFromDataUrl = (dataUrl: string) => {
    const s = String(dataUrl || '');
    if (!s.startsWith('data:')) return null;
    const commaIndex = s.indexOf(',');
    if (commaIndex < 0) return null;

    const header = s.slice(5, commaIndex);
    const base64 = s.slice(commaIndex + 1);
    const mime = header.split(';')[0] || 'application/octet-stream';

    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  };

  const openProof = (proofUrl: string) => {
    const url = blobUrlFromDataUrl(proofUrl) || proofUrl;
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) {
      alert('Popup blocked. Please allow popups to view the proof.');
    }
    if (url.startsWith('blob:')) {
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // noop
        }
      }, 30_000);
    }
  };

  const downloadProof = (proofUrl: string, filename: string) => {
    const url = blobUrlFromDataUrl(proofUrl) || proofUrl;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (url.startsWith('blob:')) {
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // noop
        }
      }, 30_000);
    }
  };

  useEffect(() => {
    const load = () => {
      setDays(DataService.getAttendanceDays());
    };

    load();
    const onAttendanceUpdated = () => load();
    window.addEventListener('studo_attendance_updated', onAttendanceUpdated);
    return () => window.removeEventListener('studo_attendance_updated', onAttendanceUpdated);
  }, []);

  const reports = useMemo(() => {
    return days
      .filter((d) => Boolean((d.remark && d.remark.trim()) || d.proofUrl))
      .slice()
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [days]);

  const statusColor = (status: AttendanceStatus) => {
    switch (status) {
      case AttendanceStatus.PRESENT:
        return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
      case AttendanceStatus.ABSENT:
        return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
      case AttendanceStatus.LEAVE:
        return 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10';
      default:
        return 'text-[#888] border-white/10 bg-white/5';
    }
  };

  return (
    <div className="space-y-6">
      <div className="px-2">
        <h2 className="text-4xl font-black uppercase tracking-tighter mb-2 text-white">REPORTS</h2>
        <p className="text-[#888888] text-[10px] font-bold mono uppercase tracking-[0.2em] opacity-60">Reasons & proofs with dates</p>
      </div>

      <div className="bg-[#111111] border border-white/5 p-6 md:p-8 rounded-[2rem] shadow-2xl">
        {reports.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] mono text-[#666]">NO_REPORTS</p>
            <p className="mt-4 text-sm font-bold mono text-[#888]">Add a remark or attach proof while marking attendance.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((r) => {
              const dateLabel = dateFromISO(String(r.date)).toLocaleDateString('default', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              });

              const proofFileName = r.proofName || `proof_${String(r.date).slice(0, 10)}`;

              return (
                <div
                  key={r.date}
                  className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 md:p-6 flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-black uppercase tracking-tighter text-white truncate">{dateLabel}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest mono ${statusColor(r.status)}`}>
                          {r.status}
                        </span>
                        {r.status === AttendanceStatus.LEAVE && (
                          <span className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest mono ${r.leaveCounted ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-rose-300 border-rose-500/30 bg-rose-500/10'}`}>
                            {r.leaveCounted ? 'COUNTED' : 'NOT_COUNTED'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {r.proofUrl && (
                        <button
                          type="button"
                          onClick={() => openProof(r.proofUrl!)}
                          className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest mono text-white flex items-center gap-2"
                          title="Open proof"
                        >
                          <ExternalLink size={14} /> VIEW
                        </button>
                      )}
                      {r.proofUrl && (
                        <button
                          type="button"
                          onClick={() => downloadProof(r.proofUrl!, proofFileName)}
                          className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest mono text-white flex items-center gap-2"
                          title="Download proof"
                        >
                          <FileText size={14} /> DOWNLOAD
                        </button>
                      )}
                    </div>
                  </div>

                  {(r.remark && r.remark.trim()) ? (
                    <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest mono text-[#666]">REASON</p>
                      <p className="mt-2 text-xs md:text-sm font-bold mono text-[#ededed] break-words">{r.remark}</p>
                    </div>
                  ) : null}

                  {r.proofUrl && !r.remark ? (
                    <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest mono text-[#666]">PROOF</p>
                      <p className="mt-2 text-xs font-bold mono text-[#888] break-words">{proofFileName}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceReports;
