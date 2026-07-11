import React, { useState, useMemo } from "react";
import { ProductionReport, UserProfile } from "../types";
import { 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  Edit3, 
  Trash2, 
  Check, 
  Clock, 
  UserCheck, 
  AlertTriangle, 
  RefreshCw,
  LayoutGrid,
  List
} from "lucide-react";

interface HistoryTableProps {
  reports: ProductionReport[];
  user: UserProfile;
  onEdit: (report: ProductionReport) => void;
  onDelete: (reportId: string) => Promise<void>;
  onApprove?: (reportId: string) => Promise<void>;
  onResetAll?: () => Promise<void>;
}

/**
 * Komponen HistoryTable - Menampilkan riwayat laporan harian produksi air dan tingkat pemborosan.
 * Fitur utama:
 * 1. Filter pencarian teks bebas (tanggal & nama petugas).
 * 2. Filter spesifik berdasarkan operator, status (Aman/Warning/Kritis), dan rentang tanggal.
 * 3. Ekspor laporan terpilih ke format file CSV.
 * 4. Pilihan mode tampilan dinamis: Mode Tabel (untuk analisis detil) vs Mode Kartu (responsif dan ramah sentuhan).
 * 5. Fitur persetujuan admin (approval) dan aksi edit/hapus yang dikontrol hak akses (Role-Based).
 */
export default function HistoryTable({ 
  reports, 
  user, 
  onEdit, 
  onDelete, 
  onApprove, 
  onResetAll 
}: HistoryTableProps) {
  
  // Mengidentifikasi apakah pengguna yang masuk memiliki peran administrator (admin)
  const isAdmin = user.role === "admin";

  // State untuk melacak mode visual: "table" (tabel baris) atau "card" (bento kartu)
  // Default dimuat dari localStorage jika sebelumnya pernah diatur oleh pengguna
  const [viewMode, setViewMode] = useState<"table" | "card">(() => {
    try {
      const saved = localStorage.getItem("riwayat_view_mode");
      return (saved === "table" || saved === "card") ? saved : "table";
    } catch {
      return "table";
    }
  });

  // State untuk filter interaktif pencarian dan pengelompokan data
  const [search, setSearch] = useState("");
  const [operatorFilter, setOperatorFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  /**
   * Mengubah mode visual dan menyimpannya ke dalam local storage browser agar pilihan pengguna tetap terjaga.
   */
  const handleViewModeChange = (mode: "table" | "card") => {
    setViewMode(mode);
    try {
      localStorage.setItem("riwayat_view_mode", mode);
    } catch (e) {
      console.warn("Gagal menyimpan mode tampilan ke localstorage", e);
    }
  };

  /**
   * Menghasilkan daftar nama unik petugas dari laporan yang ada untuk diisi ke dalam dropdown filter.
   */
  const operatorsList = useMemo(() => {
    const names = reports.map(r => r.operator);
    return Array.from(new Set(names)).filter(Boolean);
  }, [reports]);

  /**
   * Memproses penyaringan data secara reaktif berdasarkan seluruh kriteria filter aktif (pencarian, operator, status, rentang tanggal).
   * Data diurutkan dari yang paling baru (kronologis terbalik).
   */
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      // 1. Filter pencarian teks bebas (mencari kecocokan nama operator atau string tanggal)
      const matchesSearch = 
        r.operator.toLowerCase().includes(search.toLowerCase()) || 
        r.date.includes(search);

      // 2. Filter berdasarkan nama petugas terpilih
      const matchesOperator = operatorFilter === "" || r.operator === operatorFilter;

      // 3. Filter berdasarkan rentang tanggal mulai dan tanggal akhir
      const matchesStartDate = startDate === "" || r.date >= startDate;
      const matchesEndDate = endDate === "" || r.date <= endDate;

      // 4. Filter berdasarkan status level pemborosan (Aman/Warning/Kritis)
      const matchesStatus = statusFilter === "" || r.status === statusFilter;

      return matchesSearch && matchesOperator && matchesStartDate && matchesEndDate && matchesStatus;
    }).sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      // Urutkan berdasarkan waktu input pembuatan (createdAt) jika tanggal sama agar yang terbaru di atas
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [reports, search, operatorFilter, startDate, endDate, statusFilter]);

  /**
   * Melakukan ekspor data yang telah difilter ke dalam file berformat CSV (Comma Separated Values) untuk dibuka di Excel.
   * Format disesuaikan agar rapi, kompatibel dengan regional setting Indonesia/Global, dan didukung UTF-8 BOM.
   */
  const handleExportCSV = () => {
    const headers = [
      "Tanggal",
      "Nama Petugas",
      "Galon Terpakai (Pcs)",
      "Total Produksi Air (Liter)",
      "Air Terbuang/Mubazir (Liter)",
      "Rasio Pemborosan Air (%)",
      "Status Kelayakan",
      "Verifikasi Administrator"
    ];

    const rows = filteredReports.map(r => {
      // Format tanggal menjadi DD/MM/YYYY agar lebih bersahabat di Excel
      const formattedDate = r.date.split("-").reverse().join("/");
      const operatorClean = r.operator ? r.operator.replace(/"/g, '""') : "-";
      const statusClean = r.status ? r.status : "Aman";
      const approvalText = r.approved ? "DISETUJUI (TERVERIFIKASI)" : "PENDING (MENUNGGU PERSETUJUAN)";

      return [
        `"${formattedDate}"`,
        `"${operatorClean}"`,
        r.gallonsUsed,
        r.productionLiter,
        r.wastedLiter,
        `"${r.wastePercent.toFixed(2)}%"`,
        `"${statusClean}"`,
        `"${approvalText}"`
      ];
    });

    // Menambahkan instruksi 'sep=,' pada baris pertama agar Excel langsung mengenali tanda koma sebagai pembatas kolom,
    // dikombinasikan dengan baris header dan seluruh baris data.
    const csvContent = "sep=,\n" 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    // Gunakan Blob dengan UTF-8 Byte Order Mark (\uFEFF) agar seluruh karakter terbaca rapi di Excel tanpa glitch encoding
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `DAMIU_Laporan_Produksi_${new Date().toISOString().split("T")[0]}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * Menghapus seluruh data laporan historis dari database. (Aksi terbatas untuk Administrator).
   */
  const handleResetAll = async () => {
    if (!onResetAll) return;
    setIsResetting(true);
    try {
      await onResetAll();
      setShowResetConfirm(false);
    } catch (err) {
      console.error("Gagal mereset data:", err);
    } finally {
      setIsResetting(false);
    }
  };

  /**
   * Mendapatkan label dan styling badge status berdasarkan detail laporan produksi.
   */
  const getReportStatusInfo = (report: ProductionReport) => {
    if (report.wastedLiter < 0) {
      return {
        label: "Kurang Isi",
        style: "bg-amber-50 text-amber-700 border-amber-200/60"
      };
    }
    if (report.wastedLiter === 0) {
      return {
        label: "Bagus (Pas)",
        style: "bg-teal-50 text-teal-700 border-teal-200/60"
      };
    }
    // Jika wastedLiter > 0 (Pemborosan)
    switch (report.status) {
      case "Aman":
        return {
          label: "Aman",
          style: "bg-teal-50 text-teal-700 border-teal-200/60"
        };
      case "Warning":
        return {
          label: "Peringatan",
          style: "bg-amber-50 text-amber-700 border-amber-200/60"
        };
      case "Kritis":
        return {
          label: "Kritis (Bocor)",
          style: "bg-rose-50 text-rose-700 border-rose-200/60"
        };
    }
  };

  return (
    <div className="tactile-3d-card p-0 overflow-hidden bg-white hover:shadow-md transition-all duration-300 border border-slate-200/80">
      
      {/* Header Utama dan Panel Filter */}
      <div className="p-6 border-b border-slate-100/80 bg-slate-50/20">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="font-display font-extrabold text-lg text-slate-900 tracking-tight">Riwayat Laporan</h3>
            <p className="text-[11px] text-slate-400 font-bold mt-0.5">Cari, verifikasi, atau ekspor laporan aktivitas harian.</p>
          </div>
          
          {/* Kelompok Tombol Pengatur (Mode Visual, Ekspor, Reset) */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Toggle Mode Tampilan (Tabel vs Kartu) */}
            <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200/50 text-xs font-bold shadow-xs">
              <button
                onClick={() => handleViewModeChange("table")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                  viewMode === "table" ? "bg-white text-teal-700 shadow-xs" : "text-slate-500 hover:text-slate-900"
                }`}
                title="Tampilan Tabel"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tabel</span>
              </button>
              <button
                onClick={() => handleViewModeChange("card")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                  viewMode === "card" ? "bg-white text-teal-700 shadow-xs" : "text-slate-500 hover:text-slate-900"
                }`}
                title="Tampilan Kartu"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kartu</span>
              </button>
            </div>

            {/* Tombol Ekspor CSV */}
            <button
              onClick={handleExportCSV}
              disabled={filteredReports.length === 0}
              className="inline-flex items-center gap-1.5 py-2 px-3.5 bg-teal-50 hover:bg-teal-100/80 text-teal-700 text-xs font-bold rounded-xl border border-teal-200/40 shadow-xs transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor CSV ({filteredReports.length})</span>
            </button>

            {/* Tombol Reset Laporan (Admin Saja) */}
            {isAdmin && (
              <button
                onClick={() => setShowResetConfirm(true)}
                disabled={reports.length === 0}
                className="inline-flex items-center gap-1.5 py-2 px-3.5 bg-rose-50 hover:bg-rose-100/80 text-rose-700 text-xs font-bold rounded-xl border border-rose-200/40 shadow-xs transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Hapus Semua Riwayat Laporan"
              >
                <Trash2 className="w-4 h-4" />
                <span>Reset Data ({reports.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Panel Konfirmasi Reset Data (Menghindari Pemanggilan Alert Asinkronis yang Memblokir Iframe) */}
        {showResetConfirm && (
          <div className="mb-6 p-4.5 bg-rose-50 border border-rose-200/85 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-100 text-rose-600 rounded-xl shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-rose-900 uppercase tracking-wider">Peringatan: Reset Seluruh Data</h4>
                <p className="text-[11px] text-rose-700 font-semibold leading-relaxed mt-1">
                  Apakah Anda yakin ingin menghapus permanen semua {reports.length} laporan secara permanen? Langkah ini tidak dapat dibatalkan.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                disabled={isResetting}
                onClick={() => setShowResetConfirm(false)}
                className="px-3.5 py-2 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
              >
                Batal
              </button>
              <button
                disabled={isResetting}
                onClick={handleResetAll}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/10"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mereset...</span>
                  </>
                ) : (
                  <span>Ya, Hapus Semua</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Kontrol Input Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Pencarian teks bebas */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari tanggal / petugas..."
              className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-teal-500 transition-all shadow-xs"
            />
          </div>

          {/* Filter spesifik berdasarkan operator (petugas) */}
          <div className="relative">
            <Filter className="absolute left-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={operatorFilter}
              onChange={(e) => setOperatorFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl pl-9 pr-8 py-2.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-teal-500 transition-all shadow-xs cursor-pointer appearance-none"
            >
              <option value="">Semua Petugas</option>
              {operatorsList.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <div className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none border-l pl-1.5 flex items-center justify-center">▼</div>
          </div>

          {/* Filter spesifik berdasarkan status pemborosan */}
          <div className="relative">
            <Filter className="absolute left-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl pl-9 pr-8 py-2.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-teal-500 transition-all shadow-xs cursor-pointer appearance-none"
            >
              <option value="">Semua Status</option>
              <option value="Aman">🟢 Aman (≤ 5%)</option>
              <option value="Warning">🟡 Warning (5-10%)</option>
              <option value="Kritis">🔴 Kritis (&gt; 10%)</option>
            </select>
            <div className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none border-l pl-1.5 flex items-center justify-center">▼</div>
          </div>

          {/* Pengatur rentang tanggal mulai */}
          <div className="relative">
            <Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-teal-500 transition-all shadow-xs cursor-pointer"
              title="Mulai Tanggal"
            />
          </div>

          {/* Pengatur rentang tanggal selesai */}
          <div className="relative">
            <Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white border border-slate-200 hover:border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-700 font-semibold focus:outline-none focus:border-teal-500 transition-all shadow-xs cursor-pointer"
              title="Sampai Tanggal"
            />
          </div>
        </div>
      </div>

      {/* Render Area Hasil Data */}
      <div>
        {filteredReports.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs font-bold bg-slate-50/40">
            Tidak menemukan laporan yang cocok dengan filter pencarian Anda.
          </div>
        ) : (
          <>
            {/* OPSI 1: TAMPILAN TABEL DATA */}
            {viewMode === "table" && (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-[850px]">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-500 text-[10px] font-extrabold uppercase tracking-wider border-b border-slate-100 select-none">
                      <th className="py-4 px-6">Tanggal</th>
                      <th className="py-4 px-6">Petugas</th>
                      <th className="py-4 px-6 text-right">Target</th>
                      <th className="py-4 px-6 text-right">Galon</th>
                      <th className="py-4 px-6 text-right">Produksi</th>
                      <th className="py-4 px-6 text-right">Air Terbuang</th>
                      <th className="py-4 px-6 text-right">Rasio Waste</th>
                      <th className="py-4 px-6 text-center">Status</th>
                      <th className="py-4 px-6 text-center">Persetujuan</th>
                      <th className="py-4 px-6 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/60 text-xs text-slate-600 font-semibold">
                    {filteredReports.map((report) => {
                      const isReportOwner = report.operatorUid === user.uid;
                      const canEdit = isAdmin || isReportOwner;
                      
                      return (
                        <tr key={report.reportId} className="hover:bg-slate-50/50 transition-colors group">
                          {/* Format tanggal lokal */}
                          <td className="py-4 px-6 font-mono font-bold text-slate-950">
                            {report.date.split("-").reverse().join("/")}
                          </td>
                          <td className="py-4 px-6 font-bold text-slate-800">
                            {report.operator}
                          </td>
                          <td className="py-4 px-6 text-right font-mono font-bold text-slate-500">
                            {report.productionLiter} L
                          </td>
                          <td className="py-4 px-6 text-right font-mono font-extrabold text-slate-800">
                            {report.gallonsUsed}
                          </td>
                          <td className="py-4 px-6 text-right font-mono font-bold text-slate-600">
                            {report.productionLiter + report.wastedLiter} L
                          </td>
                          <td className={`py-4 px-6 text-right font-mono font-bold ${
                            report.wastedLiter < 0 
                              ? "text-amber-600" 
                              : report.wastedLiter === 0 
                                ? "text-teal-600" 
                                : "text-rose-500 bg-rose-500/[0.01]"
                          }`}>
                            {report.wastedLiter > 0 ? `+${report.wastedLiter}` : report.wastedLiter} L
                          </td>
                          <td className="py-4 px-6 text-right font-mono font-extrabold text-slate-950">
                            {report.wastePercent.toFixed(2)}%
                          </td>
                          <td className="py-4 px-6 text-center">
                            <span className={`inline-block px-2.5 py-0.5 border rounded-full text-[9px] uppercase tracking-widest font-black ${getReportStatusInfo(report).style}`}>
                              {getReportStatusInfo(report).label}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-center">
                            {report.approved ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 border border-teal-100/80 py-0.5 px-2 rounded-full">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                                <span>Disetujui</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border border-slate-200/80 py-0.5 px-2 rounded-full">
                                <Clock className="w-2.5 h-2.5" />
                                <span>Pending</span>
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {/* Aksi Edit Laporan */}
                              <button
                                disabled={!canEdit}
                                onClick={() => onEdit(report)}
                                className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                                  canEdit 
                                    ? "text-slate-500 hover:text-slate-800 hover:bg-slate-100 border-slate-200 hover:shadow-xs" 
                                    : "text-slate-300 border-slate-100 cursor-not-allowed opacity-30"
                                }`}
                                title={canEdit ? "Edit Laporan" : "Laporan tidak diizinkan untuk diubah"}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Aksi Hapus Laporan (Hanya Admin) */}
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    if (confirm("Apakah Anda yakin ingin menghapus laporan ini secara permanen?")) {
                                      onDelete(report.reportId);
                                    }
                                  }}
                                  className="p-1.5 text-red-500 hover:bg-red-50 hover:border-red-200 border border-transparent rounded-xl transition-all cursor-pointer"
                                  title="Hapus Laporan Secara Permanen"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* OPSI 2: TAMPILAN BENTO KARTU DATA */}
            {viewMode === "card" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-slate-50/40">
                {filteredReports.map((report) => {
                  const isReportOwner = report.operatorUid === user.uid;
                  const canEdit = isAdmin || isReportOwner;
                  
                  return (
                    <div 
                      key={report.reportId} 
                      className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-4 hover:shadow-md hover:border-slate-300 transition-all duration-300"
                    >
                      {/* Kartu Header: Tanggal & Badge Persetujuan */}
                      <div className="flex items-center justify-between border-b border-slate-100/80 pb-3">
                        <span className="font-mono font-extrabold text-slate-900 text-sm">
                          {report.date.split("-").reverse().join("/")}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-block px-2.5 py-0.5 border rounded-full text-[9px] uppercase tracking-widest font-black ${getReportStatusInfo(report).style}`}>
                            {getReportStatusInfo(report).label}
                          </span>
                          {report.approved ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 border border-teal-100 py-0.5 px-2 rounded-full">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                              <span>Ok</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 border border-slate-200 py-0.5 px-2 rounded-full">
                              <Clock className="w-2.5 h-2.5" />
                              <span>Pending</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Detail Volume Produksi dan Air Terbuang */}
                      <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                        <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 col-span-2">
                          <span className="text-[9px] text-slate-400 font-extrabold block uppercase tracking-wider mb-0.5">Petugas</span>
                          <span className="text-slate-800 font-bold truncate block">{report.operator}</span>
                        </div>
                        <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[9px] text-slate-400 font-extrabold block uppercase tracking-wider mb-0.5">Target</span>
                          <span className="font-mono font-bold text-slate-500 block">{report.productionLiter} L</span>
                        </div>
                        <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[9px] text-slate-400 font-extrabold block uppercase tracking-wider mb-0.5">Jumlah Galon</span>
                          <span className="font-mono font-extrabold text-slate-900">{report.gallonsUsed} Galon</span>
                        </div>
                        <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[9px] text-slate-400 font-extrabold block uppercase tracking-wider mb-0.5">Total Produksi</span>
                          <span className="font-mono font-bold text-slate-700">{report.productionLiter + report.wastedLiter} Liter</span>
                        </div>
                        <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[9px] text-slate-400 font-extrabold block uppercase tracking-wider mb-0.5">Air Terbuang</span>
                          <span className={`font-mono font-bold ${
                            report.wastedLiter < 0 
                              ? "text-amber-600" 
                              : report.wastedLiter === 0 
                                ? "text-teal-600" 
                                : "text-rose-500"
                          }`}>
                            {report.wastedLiter > 0 ? `+${report.wastedLiter}` : report.wastedLiter} Liter
                          </span>
                        </div>
                        
                        {/* Area Bawah Kartu: Rasio Waste & Tombol Aksi */}
                        <div className="col-span-2 border-t border-slate-100/80 pt-3 flex items-center justify-between">
                          <div>
                            <span className="text-[9px] text-slate-400 font-extrabold block uppercase tracking-wider">Rasio Pemborosan</span>
                            <span className="font-mono font-black text-slate-950 text-base">{report.wastePercent.toFixed(2)}%</span>
                          </div>
                          
                          {/* Tombol aksi khusus di dalam bento kartu */}
                          <div className="flex items-center gap-1.5">
                            {/* Edit */}
                            <button
                              disabled={!canEdit}
                              onClick={() => onEdit(report)}
                              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                                canEdit 
                                  ? "text-slate-500 hover:text-slate-800 hover:bg-slate-100 border-slate-200" 
                                  : "text-slate-300 border-slate-100 cursor-not-allowed opacity-30"
                              }`}
                              title={canEdit ? "Edit Laporan" : "Laporan tidak diizinkan untuk diubah"}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Hapus (Khusus Admin) */}
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  if (confirm("Apakah Anda yakin ingin menghapus laporan ini secara permanen?")) {
                                    onDelete(report.reportId);
                                  }
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 hover:border-red-200 border border-transparent rounded-xl transition-all cursor-pointer"
                                title="Hapus Laporan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
