import React from "react";
import { ProductionReport, UserProfile } from "../types";
import { Clock, Check, Calendar, ArrowRight, AlertCircle } from "lucide-react";

interface DashboardTableProps {
  reports: ProductionReport[];
  user: UserProfile;
  onApprove?: (reportId: string) => Promise<void>;
  onNavigateToHistory: () => void;
}

/**
 * Komponen DashboardTable - Menampilkan 5 laporan produksi terbaru secara real-time pada halaman utama.
 * Membantu admin menyetujui laporan dengan cepat dan melacak aktivitas petugas di lapangan.
 */
export default function DashboardTable({ reports, user, onApprove, onNavigateToHistory }: DashboardTableProps) {
  // Mengecek apakah pengguna masuk sebagai Administrator
  const isAdmin = user.role === "admin";

  /**
   * Menyaring dan mengurutkan 5 laporan terbaru berdasarkan tanggal dan waktu pembuatan secara menurun.
   */
  const recentReports = [...reports]
    .sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    })
    .slice(0, 5);

  /**
   * Mendapatkan label dan styling badge status berdasarkan detail laporan produksi.
   */
  const getReportStatusInfo = (report: ProductionReport) => {
    if (report.wastedLiter < 0) {
      return {
        label: "Kurang Isi",
        style: "text-amber-700 bg-amber-50 border-amber-200"
      };
    }
    if (report.wastedLiter === 0) {
      return {
        label: "Bagus (Pas)",
        style: "text-teal-700 bg-teal-50 border-teal-200"
      };
    }
    // Jika wastedLiter > 0 (Pemborosan)
    switch (report.status) {
      case "Aman":
        return {
          label: "Aman",
          style: "text-teal-700 bg-teal-50 border-teal-200"
        };
      case "Warning":
        return {
          label: "Peringatan",
          style: "text-amber-700 bg-amber-50 border-amber-200"
        };
      case "Kritis":
        return {
          label: "Kritis (Bocor)",
          style: "text-rose-700 bg-rose-50 border-rose-200"
        };
      default:
        return {
          label: "Lainnya",
          style: "text-slate-500 bg-slate-50 border-slate-200"
        };
    }
  };

  /**
   * Memformat string tanggal menjadi teks tanggal bahasa Indonesia yang rapi (Contoh: Sab, 4 Jul 2026)
   */
  const formatDate = (dateStr: string) => {
    try {
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return dateStr.split("-").reverse().join("/");
      
      const options: Intl.DateTimeFormatOptions = { 
        weekday: "short", 
        day: "numeric", 
        month: "short", 
        year: "numeric" 
      };
      return dateObj.toLocaleDateString("id-ID", options);
    } catch (e) {
      return dateStr.split("-").reverse().join("/");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Bagian Kepala Tabel */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-teal-50 text-teal-600 rounded-lg">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Laporan Aktivitas Terbaru (Real-Time)</h3>
            <p className="text-[10px] text-slate-400 font-medium">Log produksi air DAMIU yang terhubung langsung ke basis data.</p>
          </div>
        </div>
        
        {/* Tombol Navigasi ke Riwayat Laporan Lengkap */}
        <button
          onClick={onNavigateToHistory}
          className="text-[10px] font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>Semua Laporan</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Bagian Isi Laporan */}
      {recentReports.length === 0 ? (
        <div className="p-8 text-center text-slate-400">
          <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-semibold">Belum ada laporan aktivitas terbaru.</p>
        </div>
      ) : (
        <>
          {/* Tampilan Tabel untuk Perangkat Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-400/90">
                  <th className="py-3 px-5">Hari & Tanggal</th>
                  <th className="py-3 px-5">Petugas</th>
                  <th className="py-3 px-5 text-right">Target</th>
                  <th className="py-3 px-5 text-right">Galon</th>
                  <th className="py-3 px-5 text-right">Produksi Air</th>
                  <th className="py-3 px-5 text-right">Air Terbuang</th>
                  <th className="py-3 px-5 text-right">Rasio Waste</th>
                  <th className="py-3 px-5 text-center">Status</th>
                  <th className="py-3 px-5 text-center">Verifikasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/70 text-xs font-semibold text-slate-700">
                {recentReports.map((report) => (
                  <tr key={report.reportId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-5 font-medium whitespace-nowrap">
                      {formatDate(report.date)}
                    </td>
                    <td className="py-3 px-5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-extrabold">
                          {report.operator.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-800">{report.operator}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-right font-mono font-bold text-slate-500">{report.productionLiter} L</td>
                    <td className="py-3 px-5 text-right font-mono">{report.gallonsUsed}</td>
                    <td className="py-3 px-5 text-right font-mono text-teal-600 font-bold">{report.productionLiter + report.wastedLiter} L</td>
                    <td className={`py-3 px-5 text-right font-mono font-bold ${
                      report.wastedLiter < 0 
                        ? "text-amber-600" 
                        : report.wastedLiter === 0 
                          ? "text-teal-600" 
                          : "text-rose-500"
                    }`}>
                      {report.wastedLiter > 0 ? `+${report.wastedLiter}` : report.wastedLiter} L
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-slate-900 font-extrabold">
                      {report.wastePercent.toFixed(2)}%
                    </td>
                    <td className="py-3 px-5 text-center">
                      <span className={`inline-block px-2 py-0.5 border rounded-full text-[9px] uppercase tracking-wider font-black ${getReportStatusInfo(report).style}`}>
                        {getReportStatusInfo(report).label}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-center whitespace-nowrap">
                      {report.approved ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 border border-teal-100 py-0.5 px-2 rounded-full">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                          <span>Disetujui</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border border-slate-200 py-0.5 px-2 rounded-full animate-pulse">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Pending</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tampilan Daftar Kartu untuk Perangkat Handphone / Mobile */}
          <div className="block md:hidden divide-y divide-slate-100">
            {recentReports.map((report) => (
              <div key={report.reportId} className="p-4 flex flex-col gap-2.5 hover:bg-slate-50/30 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">{formatDate(report.date)}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 border rounded-full text-[9px] uppercase tracking-wider font-black ${getReportStatusInfo(report).style}`}>
                      {getReportStatusInfo(report).label}
                    </span>
                    {report.approved ? (
                      <span className="text-[9px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 border border-teal-100 py-0.5 px-2 rounded-full flex items-center gap-0.5">
                        <Check className="w-2 h-2 stroke-[3]" />
                        <span>Disetujui</span>
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border border-slate-200 py-0.5 px-2 rounded-full flex items-center gap-0.5">
                        <Clock className="w-2 h-2" />
                        <span>Pending</span>
                      </span>
                    )}
                  </div>
                </div>

                 <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Petugas</span>
                    <span className="font-bold text-slate-700">{report.operator}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Target Produksi</span>
                    <span className="font-mono font-bold text-slate-500">{report.productionLiter} L</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Volume Produksi</span>
                    <span className="font-mono font-bold text-teal-600">{report.productionLiter + report.wastedLiter} L ({report.gallonsUsed} Galon)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Air Terbuang</span>
                    <span className={`font-mono font-bold ${
                      report.wastedLiter < 0 
                        ? "text-amber-600" 
                        : report.wastedLiter === 0 
                          ? "text-teal-600" 
                          : "text-rose-500"
                    }`}>
                      {report.wastedLiter > 0 ? `+${report.wastedLiter}` : report.wastedLiter} L
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Rasio Waste</span>
                    <span className="font-mono font-extrabold text-slate-900">{report.wastePercent.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
