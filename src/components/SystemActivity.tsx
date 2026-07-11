import React, { useMemo } from "react";
import { Clock, CheckCircle2, AlertTriangle, PlusCircle, User, ShieldCheck } from "lucide-react";
import { ProductionReport, ActivityLog } from "../types";

interface SystemActivityProps {
  reports: ProductionReport[];
  dbLogs?: ActivityLog[];
}

interface ActivityEvent {
  id: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "critical" | "admin";
  message: string;
  operator: string;
  icon: React.ReactNode;
}

/**
 * Komponen SystemActivity - Menampilkan log aktivitas real-time sistem DAMIU.
 * Menghasilkan feed log dinamis dari perubahan status, laporan baru, dan tindakan verifikasi.
 */
export default function SystemActivity({ reports, dbLogs }: SystemActivityProps) {
  // Olah data laporan menjadi stream aktivitas yang logis dan menarik
  const activities = useMemo(() => {
    if (dbLogs && dbLogs.length > 0) {
      return dbLogs.map((log) => {
        let icon = <PlusCircle className="w-3.5 h-3.5 text-blue-500" />;
        if (log.type === "success") {
          icon = <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
        } else if (log.type === "warning") {
          icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
        } else if (log.type === "critical") {
          icon = <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />;
        } else if (log.type === "admin") {
          icon = <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />;
        }

        return {
          id: log.logId || String(log.id),
          timestamp: log.timestamp,
          type: log.type,
          message: log.message,
          operator: log.operator,
          icon,
        };
      });
    }

    const events: ActivityEvent[] = [];

    // Urutkan laporan dari terbaru ke terlama
    const sortedReports = [...reports].sort((a, b) => {
      return (b.createdAt || b.date).localeCompare(a.createdAt || a.date);
    });

    sortedReports.forEach((r, idx) => {
      const formattedDate = r.date.split("-").reverse().join("/");
      const opName = r.operator || "Operator";
      
      // Event 1: Laporan ditambahkan
      events.push({
        id: `add-${r.reportId}-${idx}`,
        timestamp: r.createdAt || new Date(r.date).toISOString(),
        type: "info",
        message: `Laporan produksi air harian (${formattedDate}) dimasukkan oleh ${opName}.`,
        operator: opName,
        icon: <PlusCircle className="w-3.5 h-3.5 text-blue-500" />
      });

      // Event 2: Verifikasi/Persetujuan Admin
      if (r.approved) {
        events.push({
          id: `approve-${r.reportId}-${idx}`,
          timestamp: new Date(new Date(r.createdAt || r.date).getTime() + 10 * 60000).toISOString(), // 10 menit setelah input
          type: "admin",
          message: `Laporan tanggal ${formattedDate} telah ditinjau dan diverifikasi oleh Administrator.`,
          operator: "Administrator",
          icon: <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
        });
      }

      // Event 3: Deteksi Pemborosan (Warning atau Kritis)
      const waste = r.productionLiter ? (r.wastedLiter / r.productionLiter) * 100 : 0;
      if (waste > 10) {
        events.push({
          id: `critical-${r.reportId}-${idx}`,
          timestamp: r.createdAt || new Date(r.date).toISOString(),
          type: "critical",
          message: `ALARM INDUSTRI: Rasio waste kritis terdeteksi pada ${formattedDate} sebesar ${waste.toFixed(1)}%!`,
          operator: opName,
          icon: <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
        });
      } else if (waste > 5) {
        events.push({
          id: `warn-${r.reportId}-${idx}`,
          timestamp: r.createdAt || new Date(r.date).toISOString(),
          type: "warning",
          message: `PERINGATAN: Rasio waste melebihi batas 5% pada ${formattedDate} (${waste.toFixed(1)}%).`,
          operator: opName,
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
        });
      }
    });

    // Urutkan seluruh feed aktivitas gabungan secara kronologis terbalik
    return events
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 10); // Ambil 10 aktivitas terhangat
  }, [reports]);

  // Formatter waktu ringkas (Contoh: "10 menit yang lalu" atau format jam)
  const formatTimeAgo = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return "Baru saja";
      if (diffMins < 60) return `${diffMins} mnt lalu`;
      if (diffHours < 24) return `${diffHours} jam lalu`;
      
      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short"
      }) + ` ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    } catch (e) {
      return "Aktif";
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center gap-2">
        <div className="p-1.5 bg-slate-50 text-slate-600 rounded-lg border border-slate-200/50">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">Aktivitas Sistem (Live Logs)</h3>
          <p className="text-[10px] text-slate-400 font-semibold">Feed otomatis pemantauan mesin & otorisasi admin.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-50 p-2 max-h-[360px] sm:max-h-[440px]">
        {activities.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-semibold">
            Belum ada log aktivitas sistem.
          </div>
        ) : (
          activities.map((act) => (
            <div key={act.id} className="p-3 hover:bg-slate-50/70 transition-colors flex items-start gap-3 rounded-xl">
              <div className="shrink-0 p-1.5 bg-slate-50 rounded-lg border border-slate-200/30">
                {act.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-semibold leading-relaxed ${
                  act.type === "critical" ? "text-red-700 font-extrabold" :
                  act.type === "warning" ? "text-amber-800" :
                  act.type === "admin" ? "text-indigo-900 font-medium" :
                  "text-slate-600"
                }`}>
                  {act.message}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] font-mono font-bold text-slate-400">
                    {formatTimeAgo(act.timestamp)}
                  </span>
                  <span className="text-[9px] text-slate-300">•</span>
                  <span className="text-[9px] font-bold text-slate-400 flex items-center gap-0.5">
                    <User className="w-2.5 h-2.5 text-slate-350" />
                    {act.operator}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
