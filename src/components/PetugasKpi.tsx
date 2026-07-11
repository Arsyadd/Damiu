import React, { useMemo } from "react";
import { ProductionReport } from "../types";
import { Award, Star } from "lucide-react";

interface PetugasKpiProps {
  reports: ProductionReport[];
}

/**
 * Komponen PetugasKpi - Mengevaluasi kinerja petugas lapangan berdasarkan data rata-rata pemborosan air (waste %).
 * Fitur utama:
 * 1. Mengakumulasikan log kerja, total produksi, dan air terbuang per operator secara dinamis.
 * 2. Memberikan sistem penilaian bintang (Star Rating) berbasis target efisiensi operasional.
 * 3. Mengurutkan operator dari yang paling efisien (waste terendah) hingga yang membutuhkan evaluasi tambahan.
 */
export default function PetugasKpi({ reports }: PetugasKpiProps) {
  
  /**
   * Mengolah data mentah laporan produksi untuk menghasilkan metrik KPI per petugas.
   */
  const operatorKpis = useMemo(() => {
    const operatorDates: Record<string, Set<string>> = {};
    const agg: Record<string, { name: string; logs: number; prod: number; waste: number }> = {};
    
    reports.forEach(r => {
      const opName = r.operator || "Unknown";
      const prod = (r.productionLiter || (r.gallonsUsed * 19) || 0) + (r.wastedLiter || 0);
      if (!operatorDates[opName]) {
        operatorDates[opName] = new Set();
      }
      operatorDates[opName].add(r.date);

      if (!agg[opName]) {
        agg[opName] = { name: opName, logs: 0, prod: 0, waste: 0 };
      }
      agg[opName].logs += 1;
      agg[opName].prod += prod;
      agg[opName].waste += r.wastedLiter;
    });

    return Object.values(agg).map(o => {
      const avgWaste = o.prod > 0 ? (o.waste / o.prod) * 100 : 0;
      
      // Menentukan Rating Bintang (Skala 1 - 5) dan Status Efisiensi Petugas
      let rating = 5;
      let status = "Sangat Efisien (Aman)";
      let statusColor = "text-teal-700 bg-teal-50 border-teal-100";

      if (avgWaste > 10) {
        rating = 1.5;
        status = "Boros Kritis (Butuh Evaluasi)";
        statusColor = "text-rose-700 bg-rose-50 border-rose-150";
      } else if (avgWaste > 7) {
        rating = 3;
        status = "Kurang Efisien (Warning)";
        statusColor = "text-amber-700 bg-amber-50 border-amber-150";
      } else if (avgWaste > 5) {
        rating = 3.5;
        status = "Cukup Efisien (SOP Limit)";
        statusColor = "text-yellow-700 bg-yellow-50 border-yellow-150";
      } else if (avgWaste > 3) {
        rating = 4.5;
        status = "Efisien (Aman)";
        statusColor = "text-teal-700 bg-teal-50 border-teal-150";
      }

      return {
        name: o.name,
        totalLogs: o.logs,
        totalProduction: o.prod,
        totalWasted: o.waste,
        avgWastePercent: avgWaste,
        rating,
        status,
        statusColor
      };
    }).sort((a, b) => a.avgWastePercent - b.avgWastePercent); // Diurutkan dari yang paling efisien (pemborosan paling minim)
  }, [reports]);

  /**
   * Helper fungsi menggambar ikon rating bintang (Star) secara presisi dengan dukungan pecahan setengah bintang (Half Star).
   */
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 !== 0;

    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(<Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />);
      } else if (i === fullStars + 1 && hasHalf) {
        stars.push(
          <div key={i} className="relative inline-block overflow-hidden w-3.5 h-3.5">
            <Star className="absolute left-0 top-0 w-3.5 h-3.5 text-slate-200" />
            <Star className="absolute left-0 top-0 w-3.5 h-3.5 fill-amber-400 text-amber-400" style={{ clipPath: "polygon(0 0, 50% 0, 50% 100%, 0 100%)" }} />
          </div>
        );
      } else {
        stars.push(<Star key={i} className="w-3.5 h-3.5 text-slate-200" />);
      }
    }
    return <div className="flex items-center gap-0.5">{stars}</div>;
  };

  return (
    <div className="tactile-3d-card p-4 sm:p-6 bg-white">
      {/* Bagian Judul Komponen */}
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
          <Award className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-display font-extrabold text-lg text-slate-900 tracking-tight">Kinerja & Evaluasi Petugas</h3>
          <p className="text-[11px] text-slate-400 font-bold mt-0.5">Efisiensi kerja operator berdasarkan log harian operasional.</p>
        </div>
      </div>

      {operatorKpis.length === 0 ? (
        <div className="p-16 text-center text-slate-400 text-xs font-bold bg-slate-50/50 rounded-2xl">
          Belum ada data laporan operasional untuk mengevaluasi kinerja.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Legend Banner */}
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] text-slate-500 flex flex-col sm:flex-row gap-2 sm:items-center justify-between font-semibold">
            <span>💡 Rekomendasi: Operator dengan waste tinggi butuh pembekalan ulang SOP.</span>
            <span className="font-extrabold text-teal-600 uppercase tracking-wider shrink-0">Urut: Paling Efisien</span>
          </div>

          {/* Grid Daftar Petugas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {operatorKpis.map((op, index) => {
              const rankColor = index === 0 
                ? "bg-teal-500 text-white font-bold shadow-md shadow-teal-500/20" 
                : index === 1 
                ? "bg-cyan-500 text-white font-semibold shadow-md shadow-cyan-500/20" 
                : "bg-slate-200 text-slate-700";

              return (
                <div key={op.name} className="p-4 bg-white rounded-2xl border border-slate-200/85 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between gap-3 group hover:-translate-y-1 hover:shadow-md">
                  {/* Informasi Operator & Rank */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      {/* Rank circular badge */}
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs ${rankColor}`}>
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">{op.name}</h4>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">Mencatat {op.totalLogs} hari kerja</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`inline-block px-2.5 py-0.5 border rounded-full text-[9px] font-black uppercase tracking-widest ${op.statusColor}`}>
                        {op.status.split(" (")[0]}
                      </span>
                    </div>
                  </div>

                  {/* Detil Kuantitatif */}
                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 text-center font-mono">
                    <div className="text-left">
                      <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Total Produksi</span>
                      <span className="text-xs font-bold text-slate-700">{op.totalProduction.toLocaleString("id-ID")}L</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Terbuang (Waste)</span>
                      <span className="text-xs font-bold text-rose-500">{op.totalWasted.toLocaleString("id-ID")}L</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Rata-rata Waste</span>
                      <span className="text-xs font-black text-slate-900">{op.avgWastePercent.toFixed(2)}%</span>
                    </div>
                  </div>

                  {/* Rating dan Angka Penilaian */}
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Efisiensi:</span>
                      {renderStars(op.rating)}
                    </div>
                    <span className="text-[10px] font-extrabold text-slate-600 bg-slate-50 py-0.5 px-1.5 border border-slate-150 rounded-md font-mono">{(op.rating).toFixed(1)} / 5.0</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
