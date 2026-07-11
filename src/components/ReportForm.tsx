import React, { useState, useEffect } from "react";
import { ProductionReport, UserProfile } from "../types";
import { Calendar, User, ShoppingBag, Droplet, Check, AlertTriangle, X } from "lucide-react";

interface ReportFormProps {
  user: UserProfile;
  reportToEdit?: ProductionReport | null;
  onSubmit: (reportData: {
    date: string;
    operator: string;
    operatorUid: string;
    gallonsUsed: number;
    productionLiter: number;
    wastedLiter: number;
    wastePercent: number;
    status: "Aman" | "Warning" | "Kritis";
  }) => Promise<void>;
  onCancel?: () => void;
  allOperators?: { uid: string; name: string }[];
}

/**
 * Komponen ReportForm - Menyediakan formulir input dan edit laporan produksi harian.
 * Fitur:
 * 1. Menghitung persentase waste dan status kelayakan (Aman/Warning/Kritis) secara langsung (real-time) saat pengguna mengetik.
 * 2. Bagi Administrator, dimungkinkan memilih nama operator lain untuk mencatat laporan atas nama petugas lapangan tersebut.
 * 3. Validasi ketat untuk menghindari angka minus, tanggal kosong, atau galon bernilai nol.
 */
export default function ReportForm({ user, reportToEdit, onSubmit, onCancel, allOperators = [] }: ReportFormProps) {
  const isAdmin = user.role === "admin";
  
  // Mendapatkan tanggal hari ini dalam format YYYY-MM-DD sesuai zona waktu lokal browser pengguna
  const getLocalDateString = () => {
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

  // State manajemen input form
  const [date, setDate] = useState(getLocalDateString());
  const [operatorId, setOperatorId] = useState(user.uid);
  const [operatorName, setOperatorName] = useState(user.name);
  const [gallonsUsed, setGallonsUsed] = useState<number | "">("");
  
  // Input untuk total air terisi (L)
  const [totalLitersFilled, setTotalLitersFilled] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /**
   * Mengisi ulang formulir (hydration) jika masuk ke dalam mode edit laporan.
   */
  useEffect(() => {
    if (reportToEdit) {
      setDate(reportToEdit.date);
      setOperatorId(reportToEdit.operatorUid);
      setOperatorName(reportToEdit.operator);
      setGallonsUsed(reportToEdit.gallonsUsed);
      
      const prodLiter = (reportToEdit.gallonsUsed || 0) * 19;
      const actualLiters = prodLiter + (reportToEdit.wastedLiter || 0);
      setTotalLitersFilled(Number(actualLiters.toFixed(2)));
    }
  }, [reportToEdit]);

  /**
   * Mengatur perubahan operator terpilih oleh Administrator.
   */
  const handleOperatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    setOperatorId(selectedId);
    const selectedOp = allOperators.find(o => o.uid === selectedId);
    if (selectedOp) {
      setOperatorName(selectedOp.name);
    }
  };

  // Perhitungan kapasitas produksi aktual berdasarkan jumlah galon terpakai (1 galon = 19 Liter)
  const gallons = gallonsUsed ? Number(gallonsUsed) : 0;
  const productionLiter = gallons * 19;
  const actualLiters = totalLitersFilled !== "" ? Number(totalLitersFilled) : 0;
  const wasted = totalLitersFilled !== "" ? actualLiters - productionLiter : 0;
  const averageLpg = gallons > 0 ? actualLiters / gallons : 0;
  
  // Perhitungan rasio pemborosan secara asinkronis/real-time (pemborosan hanya jika wasted > 0)
  const wastePercent = productionLiter > 0 && wasted > 0 ? (wasted / productionLiter) * 100 : 0;

  // Penentuan tingkat klasifikasi kelayakan (Status Kelayakan).
  // Jika pengisian kurang (<19L) atau pas, maka tidak diklasifikasikan sebagai pemborosan (Aman).
  let status: "Aman" | "Warning" | "Kritis" = "Aman";
  let statusBadgeClass = "bg-green-100 text-teal-700 border-green-200";
  
  if (wasted > 0) {
    if (wastePercent > 10) {
      status = "Kritis";
      statusBadgeClass = "bg-rose-100 text-rose-700 border-red-200";
    } else if (wastePercent > 5) {
      status = "Warning";
      statusBadgeClass = "bg-amber-100 text-amber-700 border-amber-200";
    }
  } else if (wasted < 0) {
    statusBadgeClass = "bg-amber-50 text-amber-600 border-amber-200";
  }

  /**
   * Memproses penyimpanan laporan baru maupun perubahan laporan lama ke database.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validasi data input
    if (!date) {
      setError("Tanggal laporan harus diisi.");
      return;
    }
    if (!gallonsUsed || Number(gallonsUsed) <= 0) {
      setError("Jumlah galon terpakai harus lebih besar dari 0.");
      return;
    }
    if (totalLitersFilled === "") {
      setError("Total air terisi (Liter) harus diisi.");
      return;
    }
    if (Number(totalLitersFilled) === 0) {
      setError("Total air terisi tidak boleh 0 (berarti belum isi galonnya).");
      return;
    }
    if (Number(totalLitersFilled) < 0) {
      setError("Total air terisi tidak boleh negatif.");
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        date,
        operator: operatorName,
        operatorUid: operatorId,
        gallonsUsed: Number(gallonsUsed),
        productionLiter,
        wastedLiter: wasted,
        wastePercent,
        status
      });
      // Kosongkan formulir setelah pengiriman berhasil jika tidak dalam mode edit
      if (!reportToEdit) {
        setGallonsUsed("");
        setTotalLitersFilled("");
      }
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan laporan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tactile-3d-card p-4 sm:p-6 md:p-8 bg-white relative">
      {/* Tombol Silang/Tutup Formulir jika bertindak sebagai modal */}
      {onCancel && (
        <button 
          onClick={onCancel}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <h3 className="font-display font-bold text-lg text-slate-900 mb-1">
        {reportToEdit ? "Edit Laporan Produksi" : "Input Produksi Harian"}
      </h3>
      <p className="text-xs text-slate-400 font-semibold mb-6">
        {reportToEdit 
          ? `Ubah laporan milik ${reportToEdit.operator} (${reportToEdit.date})` 
          : "Catat jumlah galon terpakai dan volume air terbuang."}
      </p>

      {/* Tampilan Pesan Error Validasi */}
      {error && (
        <div className="mb-5 p-3.5 bg-red-50/80 backdrop-blur-md border border-red-200 rounded-xl text-xs text-red-600 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Input 1: Tanggal Operasional */}
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tanggal Operasional</label>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200/80 hover:border-slate-300 rounded-xl pl-11 pr-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white transition-all font-semibold shadow-xs"
            />
          </div>
        </div>

        {/* Input 2: Petugas Operator */}
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Petugas Operator</label>
          {isAdmin && !reportToEdit ? (
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <select
                value={operatorId}
                onChange={handleOperatorChange}
                className="w-full bg-slate-50 border border-slate-200/80 hover:border-slate-300 rounded-xl pl-11 pr-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white transition-all font-semibold appearance-none shadow-xs"
              >
                <option value={user.uid}>{user.name} (Anda)</option>
                {allOperators
                  .filter(o => o.uid !== user.uid)
                  .map(o => (
                    <option key={o.uid} value={o.uid}>{o.name}</option>
                  ))}
              </select>
            </div>
          ) : (
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                disabled
                value={operatorName}
                className="w-full bg-slate-100 border border-slate-200/80 rounded-xl pl-11 pr-4 py-2.5 text-xs text-slate-500 font-semibold cursor-not-allowed shadow-xs"
              />
            </div>
          )}
        </div>

        {/* Input 3: Jumlah Galon Terpakai */}
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Jumlah Galon Terpakai</label>
          <div className="relative">
            <ShoppingBag className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="number"
              required
              min="1"
              value={gallonsUsed}
              onChange={(e) => setGallonsUsed(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="Contoh: 31 galon"
              className="w-full bg-slate-50 border border-slate-200/80 hover:border-slate-300 rounded-xl pl-11 pr-16 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white transition-all font-mono font-bold shadow-xs"
            />
            <span className="absolute right-4 top-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">galon</span>
          </div>
          {gallonsUsed !== "" && (
            <p className="text-[10px] font-bold text-teal-600 mt-1.5 flex items-center gap-1 pl-1">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              <span>Total Volume Kapasitas: {productionLiter} L (1 Galon = 19 Liter)</span>
            </p>
          )}
        </div>

        {/* Input 4: Total Air Terisi (Liter) */}
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Total Air Terisi (Liter)</label>
          <div className="relative">
            <Droplet className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="number"
              required
              step="0.1"
              value={totalLitersFilled}
              onChange={(e) => setTotalLitersFilled(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="Contoh: 950 (pas), 940 (kurang), atau 960 (pemborosan)"
              className="w-full bg-slate-50 border border-slate-200/80 hover:border-slate-300 rounded-xl pl-11 pr-16 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white transition-all font-mono font-bold shadow-xs"
            />
            <span className="absolute right-4 top-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">liter</span>
          </div>
          
          {/* Hasil Penilaian Otomatis secara Real-Time */}
          {totalLitersFilled !== "" && gallonsUsed !== "" && (
            <div className="mt-2 space-y-2 animate-fade-in">
              {actualLiters === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200/50 rounded-xl text-amber-800 text-[10px] font-bold flex items-start gap-1.5 leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    Status: <strong>Belum isi galonnya</strong> (Total Air Terisi adalah 0).
                  </span>
                </div>
              ) : averageLpg === 19 ? (
                <div className="p-3 bg-teal-50 border border-teal-100 rounded-xl text-teal-800 text-[10px] font-bold flex items-start gap-1.5 leading-relaxed">
                  <Check className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                  <span>
                    Hasil: <strong>🟢 Pas (Bagus)</strong>. Rata-rata pengisian air pas 19.0 liter per galon. Sangat Bagus & Efisien!
                  </span>
                </div>
              ) : averageLpg < 19 ? (
                <div className="p-3 bg-amber-50 border border-amber-200/50 rounded-xl text-amber-800 text-[10px] font-semibold flex flex-col gap-1.5 leading-relaxed">
                  <div className="flex items-start gap-1.5 font-bold text-amber-700">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>Hasil: 🟡 Kurang Isi (Total: {actualLiters.toFixed(1)} L dari Target {productionLiter} L)</span>
                  </div>
                  <p>
                    Rata-rata isi per galon: {averageLpg.toFixed(2)} L (Kurang dari standar 19 L). Defisit total: {Math.abs(wasted).toFixed(1)} Liter.
                  </p>
                  <p className="text-[9px] text-amber-600/90 font-medium">
                    ⚠️ Pengisian galon tidak sampai 19 liter berarti kurang. Pastikan nozzle pengisian bekerja dengan benar!
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-rose-50 border border-rose-200/50 rounded-xl text-rose-800 text-[10px] font-semibold flex flex-col gap-1.5 leading-relaxed">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-1.5 font-bold text-rose-700">
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <span>Hasil: 🔴 Pemborosan (Total: {actualLiters.toFixed(1)} L dari Target {productionLiter} L)</span>
                    </div>
                    <span className={`px-2 py-0.5 border rounded-full text-[9px] uppercase tracking-widest font-black ${statusBadgeClass}`}>
                      {status}
                    </span>
                  </div>
                  <p>
                    Rata-rata isi per galon: {averageLpg.toFixed(2)} L (Lebih dari standar 19 L). Kelebihan total: {wasted.toFixed(1)} Liter terbuang | Rasio Waste: {wastePercent.toFixed(2)}%
                  </p>
                  {status !== "Aman" && (
                    <p className="text-[9px] text-red-600/90 font-medium">
                      ⚠️ Rasio pemborosan {status}. Pengisian lebih dari 19 liter mengindikasikan adanya masalah mesin rusak atau galon bocor. Segera periksa nozzle depot!
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tombol Pengiriman */}
        <div className="flex gap-3 pt-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 tactile-3d-button-teal text-white font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{loading ? "Menyimpan..." : reportToEdit ? "Simpan Perubahan" : "Simpan Laporan"}</span>
          </button>
          
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="tactile-3d-button-secondary text-slate-700 font-bold text-xs py-3 px-5 rounded-xl cursor-pointer"
            >
              Batal
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
