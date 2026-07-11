import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
  Cell,
  LabelList
} from "recharts";
import { ProductionReport } from "../types";
import { Layers, Activity, Award, Calendar } from "lucide-react";

interface ChartsProps {
  reports: ProductionReport[];
}

/**
 * Komponen Charts - Menyediakan visualisasi analitik tingkat industri untuk:
 * 1. Grafik Area Produksi vs Waste Air (Full Width).
 * 2. Grafik Tren Persentase Pemborosan (Waste %) dengan indikator status wilayah & rata-rata.
 * 3. Grafik Efisiensi Petugas menggunakan Horizontal Bar Chart bergradasi warna sesuai target.
 */
export default function Charts({ reports }: ChartsProps) {
  // State untuk rentang waktu pemantauan
  const [timeframe, setTimeframe] = useState<"daily" | "weekly" | "monthly">("daily");

  /**
   * Mengolah data laporan produksi secara kronologis sesuai rentang waktu (Harian/Mingguan/Bulanan).
   */
  const formattedData = useMemo(() => {
    const sorted = [...reports].sort((a, b) => a.date.localeCompare(b.date));

    // Pemrosesan untuk tampilan HARIAN
    if (timeframe === "daily") {
      const dailyMap: Record<string, { production: number; wasted: number }> = {};
      sorted.forEach(r => {
        const prod = (r.productionLiter || (r.gallonsUsed * 19) || 0) + (r.wastedLiter || 0);
        if (!dailyMap[r.date]) {
          dailyMap[r.date] = { production: 0, wasted: 0 };
        }
        dailyMap[r.date].production += prod;
        dailyMap[r.date].wasted += r.wastedLiter;
      });

      return Object.entries(dailyMap).map(([date, d]) => ({
        label: date.split("-").slice(1).reverse().join("/"), // DD/MM
        production: d.production,
        wasted: d.wasted,
        wastePercent: d.production > 0 ? (d.wasted / d.production) * 100 : 0,
        rawDate: date
      }));
    }

    // Pemrosesan untuk tampilan MINGGUAN
    if (timeframe === "weekly") {
      const dailyMap: Record<string, { production: number; wasted: number }> = {};
      sorted.forEach(r => {
        const prod = (r.productionLiter || (r.gallonsUsed * 19) || 0) + (r.wastedLiter || 0);
        if (!dailyMap[r.date]) {
          dailyMap[r.date] = { production: 0, wasted: 0 };
        }
        dailyMap[r.date].production += prod;
        dailyMap[r.date].wasted += r.wastedLiter;
      });

      const weeks: Record<string, { production: number; wasted: number }> = {};
      Object.entries(dailyMap).forEach(([dateStr, d]) => {
        const dateObj = new Date(dateStr);
        const firstDayOfYear = new Date(dateObj.getFullYear(), 0, 1);
        const pastDaysOfYear = (dateObj.getTime() - firstDayOfYear.getTime()) / 86400000;
        const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        const weekLabel = `Mgg ${weekNum}`;
        
        if (!weeks[weekLabel]) {
          weeks[weekLabel] = { production: 0, wasted: 0 };
        }
        weeks[weekLabel].production += d.production;
        weeks[weekLabel].wasted += d.wasted;
      });

      return Object.entries(weeks).map(([label, w]) => ({
        label,
        production: Math.round(w.production),
        wasted: Math.round(w.wasted),
        wastePercent: w.production > 0 ? (w.wasted / w.production) * 100 : 0
      }));
    }

    // Pemrosesan untuk tampilan BULANAN
    const dailyMap: Record<string, { production: number; wasted: number }> = {};
    sorted.forEach(r => {
      const prod = (r.productionLiter || (r.gallonsUsed * 19) || 0) + (r.wastedLiter || 0);
      if (!dailyMap[r.date]) {
        dailyMap[r.date] = { production: 0, wasted: 0 };
      }
      dailyMap[r.date].production += prod;
      dailyMap[r.date].wasted += r.wastedLiter;
    });

    const months: Record<string, { production: number; wasted: number }> = {};
    Object.entries(dailyMap).forEach(([dateStr, d]) => {
      const monthLabel = new Date(dateStr).toLocaleString("id-ID", { month: "short" });
      if (!months[monthLabel]) {
        months[monthLabel] = { production: 0, wasted: 0 };
      }
      months[monthLabel].production += d.production;
      months[monthLabel].wasted += d.wasted;
    });

    return Object.entries(months).map(([label, m]) => ({
      label,
      production: Math.round(m.production),
      wasted: Math.round(m.wasted),
      wastePercent: m.production > 0 ? (m.wasted / m.production) * 100 : 0
    }));
  }, [reports, timeframe]);

  /**
   * Menghitung efisiensi rata-rata masing-masing operator.
   * Diurutkan dari paling efisien (waste terendah) ke paling boros.
   */
  const operatorData = useMemo(() => {
    const opStats: Record<string, { waste: number; prod: number }> = {};
    
    reports.forEach(r => {
      const name = r.operator || "Petugas";
      const prod = (r.productionLiter || (r.gallonsUsed * 19) || 0) + (r.wastedLiter || 0);
      if (!opStats[name]) {
        opStats[name] = { waste: 0, prod: 0 };
      }
      opStats[name].waste += r.wastedLiter;
      opStats[name].prod += prod;
    });

    return Object.entries(opStats).map(([name, stat]) => {
      const wastePercent = stat.prod > 0 ? (stat.waste / stat.prod) * 100 : 0;
      return {
        name,
        wastePercent,
        waste: stat.waste,
        production: stat.prod
      };
    }).sort((a, b) => a.wastePercent - b.wastePercent); // Urutan: Paling efisien (waste terkecil) di atas
  }, [reports]);

  /**
   * Menghitung rata-rata waste secara keseluruhan untuk diletakkan sebagai garis referensi.
   */
  const averageWaste = useMemo(() => {
    if (reports.length === 0) return 0;
    const totalProd = reports.reduce((acc, curr) => acc + ((curr.productionLiter || (curr.gallonsUsed * 19) || 0) + (curr.wastedLiter || 0)), 0);
    const totalWasted = reports.reduce((acc, curr) => acc + curr.wastedLiter, 0);
    return totalProd > 0 ? (totalWasted / totalProd) * 100 : 0;
  }, [reports]);

  /**
   * Helper warna status pemborosan
   */
  const getWasteColor = (percent: number) => {
    if (percent > 10) return "#ef4444"; // Red - Boros
    if (percent > 5) return "#f59e0b";  // Orange/Amber - Sedang
    return "#10b981";                    // Green - Efisien
  };

  return (
    <div className="space-y-6">
      {/* 1. Grafik Area Produksi vs Waste Air (Full Width) */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-300 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-slate-800 tracking-tight text-base">Grafik Area Produksi vs Waste Air</h3>
              <p className="text-[10px] text-slate-400 font-bold">Visualisasi tren total produksi bersih harian dibandingkan dengan air terbuang (SOP Sanitasi).</p>
            </div>
          </div>

          {/* Pengontrol Filter Waktu */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/50 text-xs font-bold self-end sm:self-auto shadow-inner">
            <button
              onClick={() => setTimeframe("daily")}
              className={`px-4 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                timeframe === "daily" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Harian
            </button>
            <button
              onClick={() => setTimeframe("weekly")}
              className={`px-4 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                timeframe === "weekly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Mingguan
            </button>
            <button
              onClick={() => setTimeframe("monthly")}
              className={`px-4 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                timeframe === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Bulanan
            </button>
          </div>
        </div>

        {/* Area Chart Container */}
        <div className="h-72 sm:h-80 w-full font-mono text-[10px]">
          {reports.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 font-sans font-semibold border border-dashed border-slate-200 rounded-2xl bg-slate-50">
              Belum ada data untuk digambarkan.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={formattedData} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorProdModern" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="colorWasteModern" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} dy={8} className="font-sans font-bold" />
                <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} dx={-5} className="font-sans font-bold" />
                <Tooltip 
                  contentStyle={{ background: "rgba(15, 23, 42, 0.95)", border: "none", borderRadius: "12px", color: "#fff", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.25)" }}
                  itemStyle={{ color: "#fff", fontFamily: 'sans-serif', fontWeight: 600 }}
                  labelStyle={{ fontFamily: 'sans-serif', fontWeight: 800, color: '#10b981', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', marginBottom: '8px' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontFamily: 'sans-serif', fontWeight: 700 }} />
                <Area 
                  name="Volume Bersih (L)" 
                  type="monotone" 
                  dataKey="production" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorProdModern)" 
                  isAnimationActive={true} 
                />
                <Area 
                  name="Volume Terbuang (L)" 
                  type="monotone" 
                  dataKey="wasted" 
                  stroke="#ef4444" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#colorWasteModern)" 
                  isAnimationActive={true} 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Grid Baris 3: Grafik Tren Waste % (Kiri) dan Grafik Efisiensi Petugas (Kanan) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 2. Grafik Tren Persentase Pemborosan (Waste %) */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-cyan-50 text-cyan-600 rounded-xl border border-cyan-100">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-slate-800 tracking-tight text-base">Grafik Tren Waste %</h3>
                <p className="text-[10px] text-slate-400 font-bold">Rasio sisa air terbuang terhadap ambang batas toleransi industri.</p>
              </div>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full font-mono text-[10px]">
            {reports.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 font-sans font-semibold border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                Belum ada data pemborosan.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formattedData} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" stroke="#94a3b8" tickLine={false} axisLine={false} dy={8} className="font-sans font-bold" />
                  <YAxis stroke="#94a3b8" unit="%" tickLine={false} axisLine={false} dx={-5} className="font-sans font-bold" />
                  <Tooltip
                    contentStyle={{ background: "rgba(15, 23, 42, 0.95)", border: "none", borderRadius: "12px", color: "#fff", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.25)" }}
                    labelStyle={{ fontFamily: 'sans-serif', fontWeight: 800, color: '#22d3ee', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', marginBottom: '8px' }}
                    formatter={(value: any) => [`${parseFloat(value).toFixed(2)}%`, "Rasio Pemborosan"]}
                  />
                  
                  {/* Indikator Area Warna */}
                  <ReferenceArea y1={0} y2={5} {...{ fill: "#10b981", fillOpacity: 0.04 } as any} />
                  <ReferenceArea y1={5} y2={10} {...{ fill: "#f59e0b", fillOpacity: 0.04 } as any} />
                  <ReferenceArea y1={10} y2={25} {...{ fill: "#ef4444", fillOpacity: 0.04 } as any} />

                  {/* Garis Batas Toleransi Target 5% */}
                  <ReferenceLine 
                    y={5} 
                    stroke="#f59e0b" 
                    strokeDasharray="4 4" 
                    strokeWidth={1.5}
                    label={{ value: "Target (5%)", position: "insideBottomRight", fill: "#f59e0b", fontSize: 9, fontWeight: "bold" }} 
                  />
                  
                  {/* Garis Rata-Rata Waste Keseluruhan */}
                  <ReferenceLine 
                    y={averageWaste} 
                    stroke="#6366f1" 
                    strokeWidth={2}
                    label={{ value: `Rerata (${averageWaste.toFixed(1)}%)`, position: "insideTopLeft", fill: "#6366f1", fontSize: 9, fontWeight: "extrabold" }} 
                  />

                  <Line
                    type="monotone"
                    dataKey="wastePercent"
                    stroke="#475569"
                    strokeWidth={3}
                    isAnimationActive={true}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      return (
                        <circle
                          key={`dot-waste-${payload.label}-${cx}`}
                          cx={cx}
                          cy={cy}
                          r={4.5}
                          fill={getWasteColor(payload.wastePercent)}
                          stroke="#fff"
                          strokeWidth={1.5}
                        />
                      );
                    }}
                    activeDot={{ r: 7, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 3. Grafik Efisiensi Petugas (Horizontal Bar Chart) */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-slate-800 tracking-tight text-base">Grafik Efisiensi Petugas</h3>
                <p className="text-[10px] text-slate-400 font-bold">Peringkat efisiensi operator diurutkan dari yang paling patuh (waste terendah).</p>
              </div>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full font-mono text-[10px]">
            {reports.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 font-sans font-semibold border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                Belum ada data petugas.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={operatorData} 
                  layout="vertical" 
                  margin={{ top: 10, right: 35, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" unit="%" tickLine={false} axisLine={false} className="font-sans font-bold" />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    stroke="#475569" 
                    tickLine={false} 
                    axisLine={false} 
                    className="font-sans font-extrabold text-xs" 
                    width={85}
                  />
                  <Tooltip
                    contentStyle={{ background: "rgba(15, 23, 42, 0.95)", border: "none", borderRadius: "12px", color: "#fff", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.25)" }}
                    labelStyle={{ fontFamily: 'sans-serif', fontWeight: 800, color: '#818cf8', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', marginBottom: '8px' }}
                    formatter={(value: any, name: any, props: any) => {
                      const { payload } = props;
                      return [
                        <div className="flex flex-col gap-1 text-xs font-sans">
                          <span className="font-extrabold text-white">Rata-rata Waste: {parseFloat(value).toFixed(2)}%</span>
                          <span className="text-[10px] text-slate-300">Total Produksi: {payload.production.toLocaleString("id-ID")} Liter</span>
                          <span className="text-[10px] text-slate-300">Total Air Terbuang: {payload.waste.toLocaleString("id-ID")} Liter</span>
                        </div>,
                        ""
                      ];
                    }}
                  />
                  <ReferenceLine 
                    x={5} 
                    stroke="#10b981" 
                    strokeDasharray="4 4" 
                    strokeWidth={1.5}
                    label={{ value: "Target", position: "insideTopRight", fill: "#10b981", fontSize: 9, fontWeight: "bold" }} 
                  />
                  <Bar dataKey="wastePercent" radius={[0, 6, 6, 0]} isAnimationActive={true} barSize={20}>
                    {operatorData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getWasteColor(entry.wastePercent)} />
                    ))}
                    <LabelList 
                      dataKey="wastePercent" 
                      position="right" 
                      formatter={(v: number) => `${v.toFixed(1)}%`} 
                      className="font-sans font-black text-slate-700 text-[10px]"
                      dx={5}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
