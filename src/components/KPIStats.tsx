import React from "react";
import { Droplet, AlertTriangle, RefreshCw, Percent, Target, TrendingUp, CheckCircle2, XCircle, HelpCircle, Award } from "lucide-react";
import { ProductionReport } from "../types";

interface KPIStatsProps {
  reports: ProductionReport[];
}

interface CircularProgressProps {
  value: number;
  max?: number;
  colorClass?: string;
  trailColorClass?: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

/**
 * Komponen CircularProgress - Merupakan custom SVG circular gauge modern
 * yang ringan, interaktif, dan mudah dikonfigurasi untuk dashboard industri.
 */
function CircularProgress({
  value,
  max = 100,
  colorClass = "stroke-teal-500",
  trailColorClass = "stroke-slate-100",
  size = 56,
  strokeWidth = 5,
  label
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`${trailColorClass}`}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`${colorClass} transition-all duration-500 ease-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
      <div className="absolute text-[10px] font-black text-slate-800 leading-none">
        {label || `${Math.round(percentage)}%`}
      </div>
    </div>
  );
}

/**
 * Komponen KPIStats - Berfungsi menghitung dan menyajikan Key Performance Indicators (KPI) utama:
 * 1. Total Laporan harian terdaftar.
 * 2. Total Produksi Air Siap Konsumsi (dalam satuan Liter).
 * 3. Total Air Terbuang (Wasted Liter).
 * 4. Rasio Efisiensi (Waste %) terakumulasi.
 * 5. Status Operasional sistem (Aman, Warning, atau Kritis).
 * Menyediakan banner peringatan dinamis jika tingkat pemborosan melebihi ambang toleransi.
 */
export default function KPIStats({ reports }: KPIStatsProps) {
  
  // Memisahkan tanggal unik untuk mengetahui jumlah hari produktif
  const uniqueDates = Array.from(new Set(reports.map(r => r.date)));

  // Mendapatkan tanggal hari ini dalam format YYYY-MM-DD sesuai zona waktu lokal browser pengguna
  const getTodayDateString = () => {
    try {
      const d = new Date();
      return new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(d);
    } catch (e) {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  };

  // State untuk melacak tanggal hari ini di browser secara real-time guna mendukung auto-reset tepat pada jam 0:00
  const [todayStr, setTodayStr] = React.useState(getTodayDateString);

  React.useEffect(() => {
    // Mengecek pergantian tanggal setiap 10 detik agar reset tepat jam 0:00 berjalan otomatis secara responsif tanpa hard-reload
    const interval = setInterval(() => {
      const currentStr = getTodayDateString();
      if (currentStr !== todayStr) {
        setTodayStr(currentStr);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [todayStr]);

  // Laporan hari ini untuk mendukung reset otomatis pada jam 0:00
  const todayReports = reports.filter(r => r.date === todayStr);
  const todayGallons = todayReports.reduce((acc, r) => acc + r.gallonsUsed, 0);
  
  // Perhitungan total volume kapasitas standar (nominal 19 L per galon)
  const todayStandardProduction = todayReports.reduce((acc, r) => acc + (r.productionLiter || (r.gallonsUsed * 19) || 0), 0);
  const todayWasted = todayReports.reduce((acc, r) => acc + Math.max(0, r.wastedLiter), 0);
  const todayWastePercent = todayStandardProduction > 0 ? (todayWasted / todayStandardProduction) * 100 : 0;

  // Tanggal aktif dan total galon disesuaikan khusus untuk hari ini agar reset otomatis bekerja dengan sempurna pada jam 0:00
  const activeDate = todayStr;
  const latestGallons = todayGallons;

  // Nilai produksi target dan pencapaian hari ini untuk Kartu 1
  const displayProduction = todayStandardProduction;
  const displayTargetProduction = 589; // 31 Galon * 19 Liter = 589 Liter
  const displayTargetPercent = (displayProduction / displayTargetProduction) * 100;
  
  // Perhitungan total volume kapasitas standar akumulasi seluruh waktu
  const totalProduction = reports.reduce((acc, curr) => acc + (curr.productionLiter || (curr.gallonsUsed * 19) || 0), 0);

  // Target Produksi Kumulatif berdasarkan hari kerja yang terpantau (setiap hari kerja ditargetkan 31 galon x 19 L = 589 L)
  const totalTargetProduction = uniqueDates.length * 589;
  const totalTargetPercent = totalTargetProduction > 0 ? (totalProduction / totalTargetProduction) * 100 : 0;
  
  // Menghitung akumulasi volume air terbuang (wasted) dari seluruh laporan (hanya nilai positif yang dianggap pemborosan)
  const totalWasted = reports.reduce((acc, curr) => acc + Math.max(0, curr.wastedLiter), 0);
  
  // Rasio pemborosan terakumulasi (%)
  const wastePercent = totalProduction > 0 ? (totalWasted / totalProduction) * 100 : 0;

  // Evaluasi apakah ada laporan untuk hari ini guna menentukan basis data kartu (Hari Ini vs Kumulatif)
  const hasTodayReports = todayReports.length > 0;
  
  // Nilai efisiensi dan waste aktif yang ditampilkan pada dashboard (sesuai dengan data produksi harian agar ter-reset pada jam 0:00 jika tidak ada produksi)
  const activeWastePercent = hasTodayReports ? todayWastePercent : 0;
  const activeEfficiency = hasTodayReports ? (100 - todayWastePercent) : 100;

  // Status operasional dinilai berdasarkan waste hari ini
  const statusEvaluationWaste = hasTodayReports ? todayWastePercent : 0;

  // Konfigurasi status operasional berdasarkan tingkat pemborosan aktif
  let statusText = "Aman";
  let statusIndicatorColor = "bg-green-500";
  let statusIcon = <Droplet className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />;

  if (statusEvaluationWaste > 10) {
    statusText = "Kritis";
    statusIndicatorColor = "bg-red-500";
    statusIcon = <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />;
  } else if (statusEvaluationWaste > 5) {
    statusText = "Warning";
    statusIndicatorColor = "bg-amber-500";
    statusIcon = <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />;
  }

  // Jumlah laporan masuk yang sedang menunggu persetujuan (verifikasi) oleh administrator
  const pendingApprovalsCount = reports.filter(r => !r.approved).length;

  return (
    <div className="space-y-4">
      {/* Banner Peringatan Kritis (jika pemborosan air melebihi batas toleransi 10%) */}
      {todayWastePercent > 10 && (
        <div className="bg-red-50/90 backdrop-blur-md border border-red-200 p-3 rounded-xl shadow-xs flex items-start gap-2.5 border-l-4 border-l-red-500 animate-fade-in">
          <div className="p-1 bg-red-100 rounded-lg text-red-600 shrink-0 mt-0.5">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-red-800">🚨 Pemborosan Kritis! ({todayWastePercent.toFixed(2)}%)</h4>
            <p className="text-[10px] text-red-700 mt-0.5 font-semibold leading-relaxed">
              Melebihi batas toleransi aman (≤ 5%). Harap segera periksa potensi adanya <strong>galon bocor</strong> atau <strong>mesin depot yang rusak/bocor</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Banner Peringatan Sedang (jika pemborosan air berada di atas 5% dan di bawah 10%) */}
      {todayWastePercent > 5 && todayWastePercent <= 10 && (
        <div className="bg-amber-50/90 backdrop-blur-md border border-amber-200 p-3 rounded-xl shadow-xs flex items-start gap-2.5 border-l-4 border-l-amber-500 animate-fade-in">
          <div className="p-1 bg-amber-100 rounded-lg text-amber-600 shrink-0 mt-0.5">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-amber-800">⚠ Peringatan Pemborosan ({todayWastePercent.toFixed(2)}%)</h4>
            <p className="text-[10px] text-amber-700 mt-0.5 font-semibold leading-relaxed">
              Rasio berada di atas target aman (≤ 5%). Imbau petugas lapangan untuk mengecek kemungkinan <strong>galon bocor</strong> atau kendala mekanis pada nozzle pengisian.
            </p>
          </div>
        </div>
      )}

      {/* Grid Kartu Metrik Ringkasan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Kartu 1: Total Produksi & Target Produksi */}
        <div className="tactile-3d-card p-4.5 bg-white flex items-center justify-between group cursor-default relative overflow-hidden border border-slate-200/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-teal-500/5 to-cyan-500/0 rounded-full blur-2xl transition-all duration-300 group-hover:scale-150" />
          <div className="space-y-3 flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-1.5 text-slate-400">
              <RefreshCw className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 truncate">Target Produksi</span>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-display font-black text-xl sm:text-2xl text-slate-900 leading-none">
                  {displayProduction.toLocaleString("id-ID")}
                </span>
                <span className="text-xs text-slate-400 font-bold">L</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">Target Hari Ini: {displayTargetProduction} L</p>
            </div>
          </div>
          <CircularProgress 
            value={displayProduction} 
            max={displayTargetProduction || 1} 
            colorClass="stroke-emerald-500" 
            label={`${Math.round(displayTargetPercent)}%`}
            size={56}
            strokeWidth={5}
          />
        </div>

        {/* Kartu 2: Efisiensi Rata-rata Petugas (Ganti dari Air Terbuang murni agar lebih profesional) */}
        <div className="tactile-3d-card p-4.5 bg-white flex items-center justify-between group cursor-default relative overflow-hidden border border-slate-200/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-500/5 to-purple-500/0 rounded-full blur-2xl transition-all duration-300 group-hover:scale-150" />
          <div className="space-y-3 flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Award className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 truncate font-sans">Efisiensi Rata-rata</span>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-display font-black text-xl sm:text-2xl text-slate-900 leading-none">
                  {activeEfficiency.toFixed(2)}
                </span>
                <span className="text-xs text-slate-400 font-bold">%</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold truncate">
                {hasTodayReports 
                  ? `Waste Hari Ini: ${todayWasted.toLocaleString("id-ID")} L`
                  : `Hari ini belum ada produksi`}
              </p>
            </div>
          </div>
          <CircularProgress 
            value={activeEfficiency} 
            max={100} 
            colorClass="stroke-indigo-500" 
            label={`${activeEfficiency.toFixed(1)}%`}
            size={56}
            strokeWidth={5}
          />
        </div>

        {/* Kartu 3: Rasio Waste */}
        <div className="tactile-3d-card p-4.5 bg-white flex items-center justify-between group cursor-default relative overflow-hidden border border-slate-200/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-amber-500/5 to-rose-500/0 rounded-full blur-2xl transition-all duration-300 group-hover:scale-150" />
          <div className="space-y-3 flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Percent className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 truncate">Rasio Waste</span>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-display font-black text-xl sm:text-2xl text-slate-900 leading-none">
                  {activeWastePercent.toFixed(2)}
                </span>
                <span className="text-xs text-slate-400 font-bold">%</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold truncate">
                {hasTodayReports 
                  ? `Standard: ≤ 5% (Hari Ini: ${todayWastePercent.toFixed(2)}%)`
                  : `Standard: ≤ 5% (Belum ada produksi)`}
              </p>
            </div>
          </div>
          <CircularProgress 
            value={activeWastePercent} 
            max={15} 
            colorClass={activeWastePercent > 10 ? "stroke-red-500" : activeWastePercent > 5 ? "stroke-amber-500" : "stroke-teal-500"} 
            label={`${activeWastePercent.toFixed(1)}%`}
            size={56}
            strokeWidth={5}
          />
        </div>

        {/* Kartu 4: Status Depot */}
        <div className="tactile-3d-card p-4.5 bg-white flex items-center justify-between group cursor-default relative overflow-hidden border border-slate-200/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-emerald-500/5 to-teal-500/0 rounded-full blur-2xl transition-all duration-300 group-hover:scale-150" />
          <div className="space-y-3 flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="shrink-0">{statusIcon}</span>
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-500 truncate">Status Depot</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${statusIndicatorColor} animate-pulse`} />
                <span className="font-display font-black text-lg sm:text-xl text-slate-900 leading-none tracking-tight">
                  {statusText.toUpperCase()}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                {pendingApprovalsCount > 0 ? `${pendingApprovalsCount} laporan pending` : "Operasi Terverifikasi"}
              </p>
            </div>
          </div>
          <CircularProgress 
            value={statusEvaluationWaste > 10 ? 20 : statusEvaluationWaste > 5 ? 60 : 100} 
            max={100} 
            colorClass={statusEvaluationWaste > 10 ? "stroke-red-500" : statusEvaluationWaste > 5 ? "stroke-amber-500" : "stroke-teal-500"} 
            label={statusEvaluationWaste > 10 ? "CRT" : statusEvaluationWaste > 5 ? "WRN" : "OK"}
            size={56}
            strokeWidth={5}
          />
        </div>

      </div>

      {/* SEKTOR BARU: Target Produksi Harian & Evaluasi Solusi */}
      <div className="tactile-3d-card p-4 sm:p-6 bg-white space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Target className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-base sm:text-lg text-slate-900 tracking-tight">Target Produksi Harian</h3>
              <p className="text-[11px] text-slate-400 font-bold mt-0.5">Monitoring pencapaian target harian 31 Galon (589 L).</p>
            </div>
          </div>
          
          {reports.length > 0 && (
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                latestGallons >= 31 
                  ? "bg-teal-50 text-teal-600 border border-teal-100" 
                  : "bg-amber-50 text-amber-600 border border-amber-100"
              }`}>
                {latestGallons >= 31 ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-teal-500" />
                    <span>Target Tercapai</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3 text-amber-500" />
                    <span>Belum Tercapai</span>
                  </>
                )}
              </span>
            </div>
          )}
        </div>

        {reports.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-bold bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            Belum ada laporan harian terdaftar. Silakan masukkan laporan baru di tab "Laporan Baru" untuk memantau pencapaian target produksi.
          </div>
        ) : (
          <div className="space-y-5">
            {/* Grid Metrik Target */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Target Harian</span>
                <div className="flex items-baseline gap-1 mt-1.5">
                  <span className="text-2xl font-black text-slate-900 font-display">31</span>
                  <span className="text-xs text-slate-400 font-bold">Galon / hari</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1 font-semibold">Setara ± 589 Liter air bersih</span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Produksi Hari Ini</span>
                <div className="flex items-baseline gap-1 mt-1.5">
                  <span className={`text-2xl font-black font-display ${latestGallons >= 31 ? "text-teal-600" : "text-amber-500"}`}>
                    {latestGallons}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">Galon</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1 font-semibold truncate font-mono text-[11px]">
                  Tanggal: {activeDate}
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">Penyimpangan Target</span>
                <div className="flex items-baseline gap-1 mt-1.5">
                  <span className={`text-2xl font-black font-display ${latestGallons >= 31 ? "text-teal-600" : "text-rose-500"}`}>
                    {latestGallons >= 31 ? `+${latestGallons - 31}` : `-${31 - latestGallons}`}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">Galon</span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1 font-semibold">
                  {latestGallons >= 31 ? "Melebihi kuota minimal" : "Kurang dari kuota minimal"}
                </span>
              </div>
            </div>

            {/* Bilah Kemajuan Target */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-500">Persentase Pencapaian Target Hari Ini</span>
                <span className={latestGallons >= 31 ? "text-teal-600" : "text-amber-500 font-mono"}>
                  {((latestGallons / 31) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200/50">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    latestGallons >= 31 
                      ? "bg-gradient-to-r from-teal-500 to-emerald-500" 
                      : (latestGallons / 31) * 100 >= 50
                      ? "bg-gradient-to-r from-amber-400 to-amber-500"
                      : "bg-gradient-to-r from-red-500 to-rose-500"
                  }`}
                  style={{ width: `${Math.min((latestGallons / 31) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Panel Rekomendasi Solusi & Feedback */}
            <div className="pt-2">
              {latestGallons >= 31 ? (
                <div className="bg-emerald-50/70 border border-emerald-150 p-4 rounded-2xl flex items-start gap-3 animate-fade-in">
                  <div className="p-1.5 bg-emerald-100 rounded-xl text-emerald-600 shrink-0 mt-0.5">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-800">🎉 Target Tercapai & Konsisten!</h4>
                    <p className="text-[11px] text-emerald-700 mt-1 leading-relaxed font-semibold">
                      Produksi harian telah memenuhi standar minimum 31 galon. Tetap pastikan pengawasan kebersihan depot, sanitasi nozzle dispenser, serta kepatuhan operator terhadap SOP pengisian agar efisiensi waste tetap berada di bawah 5%.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50/70 border border-amber-150 p-4 rounded-2xl space-y-4 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-amber-100 rounded-xl text-amber-600 shrink-0 mt-0.5">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-800">💡 Mengapa Produksi Tidak Mencapai Target 31 Galon?</h4>
                      <p className="text-[11px] text-amber-700 mt-1 leading-relaxed font-semibold">
                        Produksi berada di bawah target harian dengan selisih <strong className="text-rose-600">-{31 - latestGallons} galon</strong>. Berikut analisis masalah yang sering terjadi beserta tindakan perbaikan yang direkomendasikan untuk meningkatkan kapasitas produksi DAMIU:
                      </p>
                    </div>
                  </div>

                  {/* Grid Masukan & Perbaikan */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                    <div className="p-3.5 bg-white border border-amber-200/65 rounded-xl space-y-1.5 shadow-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <h5 className="text-[11px] font-bold text-slate-800">1. Aliran Air Lambat (Masalah Filtrasi)</h5>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                        <strong>Penyebab:</strong> Pasir silika/karbon tersumbat kotoran, cartridge sedimen telah jenuh, atau membran Reverse Osmosis (RO) buntu.
                      </p>
                      <p className="text-[10px] text-teal-700 leading-relaxed font-semibold bg-teal-50/50 p-2 rounded-lg border border-teal-100/30">
                        <strong>Solusi:</strong> Lakukan pencucian balik (backwash) tabung media filter utama secara teratur dan segera ganti cartridge filter sedimen jika telah kecokelatan.
                      </p>
                    </div>

                    <div className="p-3.5 bg-white border border-amber-200/65 rounded-xl space-y-1.5 shadow-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <h5 className="text-[11px] font-bold text-slate-800">2. Keterlambatan Pasokan Air Baku</h5>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                        <strong>Penyebab:</strong> Keterlambatan armada tangki air pegunungan atau volume toren penampung air baku terlalu kecil.
                      </p>
                      <p className="text-[10px] text-teal-700 leading-relaxed font-semibold bg-teal-50/50 p-2 rounded-lg border border-teal-100/30">
                        <strong>Solusi:</strong> Jadwalkan pemesanan air tangki H-1 sebelum tangki penampung kosong total, atau tingkatkan kapasitas tangki (toren) penampung air baku.
                      </p>
                    </div>

                    <div className="p-3.5 bg-white border border-amber-200/65 rounded-xl space-y-1.5 shadow-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <h5 className="text-[11px] font-bold text-slate-800">3. Jam Operasional Depot Tidak Konsisten</h5>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                        <strong>Penyebab:</strong> Keterlambatan petugas membuka depot, waktu istirahat tidak diatur bergantian, atau tutup terlalu cepat.
                      </p>
                      <p className="text-[10px] text-teal-700 leading-relaxed font-semibold bg-teal-50/50 p-2 rounded-lg border border-teal-100/30">
                        <strong>Solusi:</strong> Terapkan pembagian jadwal jaga (shift) petugas secara disiplin dan pastikan depot beroperasi secara konsisten sesuai jam pelayanan.
                      </p>
                    </div>

                    <div className="p-3.5 bg-white border border-amber-200/65 rounded-xl space-y-1.5 shadow-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <h5 className="text-[11px] font-bold text-slate-800">4. Penurunan Penjualan (Pemasaran & Layanan)</h5>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                        <strong>Penyebab:</strong> Persaingan ketat dengan depot sekitar, pelayanan kurang ramah, atau tidak ada program retensi pelanggan.
                      </p>
                      <p className="text-[10px] text-teal-700 leading-relaxed font-semibold bg-teal-50/50 p-2 rounded-lg border border-teal-100/30">
                        <strong>Solusi:</strong> Selenggarakan promo loyalitas (misal: isi 10 galon gratis 1 isi ulang) dan tingkatkan kualitas pelayanan keramahan operator.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
