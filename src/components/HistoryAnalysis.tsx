import React, { useState, useMemo } from "react";
import { ProductionReport } from "../types";
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Award, 
  Calendar, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle, 
  HelpCircle,
  FileText,
  Clock,
  ChevronRight,
  ShieldCheck,
  Droplet,
  Upload,
  Trash2,
  Camera,
  AlertTriangle
} from "lucide-react";
import { GoogleGenAI, Type } from "@google/genai";

const getClientApiKey = (): string => {
  const viteKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (viteKey) return viteKey;

  try {
    const procKey = (process as any).env?.GEMINI_API_KEY;
    if (procKey) return procKey;
  } catch (e) {
    // Ignore
  }
  return "";
};

const generateContentWithRetryAndFallback = async (
  client: GoogleGenAI,
  params: { contents: any; config?: any },
  primaryModel: string = "gemini-3.5-flash",
  maxRetries = 3
): Promise<any> => {
  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    primaryModel,
    "gemini-3.1-flash-lite",
    "gemini-flash-latest"
  ];

  let lastError: any = null;

  for (const model of modelsToTry) {
    let delay = 1000;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Mengirim permintaan ke model ${model} (Percobaan ${attempt + 1}/${maxRetries})...`);
        const response = await client.models.generateContent({
          ...params,
          model,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errStr = String(err?.message || err);
        console.warn(`Gagal memanggil model ${model}:`, errStr);

        const isRetryable =
          errStr.includes("503") ||
          errStr.includes("UNAVAILABLE") ||
          errStr.includes("429") ||
          errStr.includes("RESOURCE_EXHAUSTED") ||
          errStr.includes("fetch") ||
          errStr.includes("timeout") ||
          errStr.includes("temp") ||
          errStr.includes("demand") ||
          errStr.includes("overloaded");

        if (!isRetryable) {
          break;
        }

        if (attempt < maxRetries - 1) {
          console.log(`Menunggu ${delay}ms sebelum mencoba kembali...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 1.5;
        }
      }
    }
    console.log(`Pindah ke model alternatif berikutnya karena ${model} gagal.`);
  }

  throw lastError || new Error("Gagal menghubungi semua model Gemini.");
};

const callGeminiDmaicDirectly = async (productionData: ProductionReport[], apiKey: string): Promise<CustomAnalysisData> => {
  const totalProduction = productionData.reduce((sum, r) => sum + ((r.productionLiter || 0) + (r.wastedLiter || 0)), 0);
  const totalWasted = productionData.reduce((sum, r) => sum + Math.max(0, r.wastedLiter || 0), 0);
  const overallWastePercent = totalProduction > 0 ? (totalWasted / totalProduction) * 100 : 0;

  const operatorStats = productionData.reduce((acc, r) => {
    const op = r.operator || "Unknown";
    if (!acc[op]) acc[op] = { production: 0, wasted: 0 };
    acc[op].production += ((r.productionLiter || 0) + (r.wastedLiter || 0));
    acc[op].wasted += Math.max(0, r.wastedLiter || 0);
    return acc;
  }, {} as Record<string, { production: number; wasted: number }>);

  const worstOperator = (Object.entries(operatorStats) as [string, { production: number; wasted: number }][]).reduce((worst, [name, stats]) => {
    const pct = stats.production > 0 ? (stats.wasted / stats.production) * 100 : 0;
    if (pct > worst.pct) {
      return { name, pct };
    }
    return worst;
  }, { name: "Tidak terdeteksi", pct: 0 });

  const ai = new GoogleGenAI({ apiKey });

  const opSummaryString = (Object.entries(operatorStats) as [string, { production: number; wasted: number }][])
    .map(([op, stat]) => {
      const pct = stat.production > 0 ? (stat.wasted / stat.production) * 100 : 0;
      return `- ${op}: Produksi ${stat.production.toFixed(0)}L, Terbuang ${stat.wasted.toFixed(0)}L (Waste: ${pct.toFixed(2)}%)`;
    })
    .join("\n");

  const recentLogsString = productionData
    .slice(-10)
    .map(r => {
      const prodLit = (r.productionLiter || (r.gallonsUsed * 19) || 0) + (r.wastedLiter || 0);
      const wstLit = Math.max(0, r.wastedLiter || 0);
      const wstPct = prodLit > 0 ? (wstLit / prodLit) * 100 : 0;
      return `- Tanggal ${r.date}, Petugas: ${r.operator}, Galon: ${r.gallonsUsed}, Produksi: ${prodLit}L, Terbuang: ${wstLit}L (Waste: ${wstPct.toFixed(2)}%, Status: ${r.status})`;
    })
    .join("\n");

  const prompt = `
Kamu adalah DAMIU Agent, asisten AI optimasi operasional cerdas untuk Air Minum Isi Ulang (DAMIU). 
Analisis data operasional riil DAMIU berikut dan hasilkan Laporan Analisis Riwayat Operasional yang sangat terperinci, formal, bersahabat, dan taktis dalam format JSON menggunakan bahasa Indonesia yang baik dan benar. 

DATA MONITORING PRODUKSI DAMIU:
- Total Produksi: ${totalProduction.toFixed(0)} Liter (dengan kapasitas produksi harian fix 589 Liter)
- Total Air Terbuang: ${totalWasted.toFixed(0)} Liter
- Rata-rata Persentase Pemborosan (Waste): ${overallWastePercent.toFixed(2)}%
- Target Batas Pemborosan Maksimum: 5%

Kinerja Berdasarkan Petugas:
${opSummaryString}

10 Riwayat Laporan Terakhir:
${recentLogsString}

Persyaratan Format Output:
Kembalikan respon HANYA berupa objek JSON murni dengan struktur berikut:
{
  "trendSummary": "Ringkasan tren operasional berdasarkan total produksi (${totalProduction.toFixed(0)}L) dan total air terbuang (${totalWasted.toFixed(0)}L). Sebutkan rasio pemborosan aktual (${overallWastePercent.toFixed(2)}%) dibanding target aman (5%), serta deskripsi singkat pola trennya.",
  "operatorAnalysis": "Analisis terperinci mengenai kontribusi dan kinerja masing-masing operator (terutama bandingkan ${worstOperator.name} dengan operator lainnya). Berikan ulasan mengapa ada variasi keterampilan dan tindakan pembinaan yang direkomendasikan.",
  "temporalPattern": "Ulasan tentang pola waktu dari riwayat, misalnya apakah pemborosan cenderung terjadi di hari kerja tertentu, atau saat volume galon harian sedang tinggi. Sebutkan insiden tanggal pemborosan air tertinggi yang terdeteksi dalam riwayat.",
  "actionableSteps": "Langkah perbaikan taktis yang langsung bisa diterapkan oleh pemilik DAMIU berdasarkan riwayat nyata di atas (seperti pembinaan petugas tertentu, standar waktu bilas, pengecekan berkala, dll).",
  "forecast": "Proyeksi dampak operasional jangka panjang (misal perkiraan total air terbuang dalam 30 hari ke depan jika pemborosan terus berlanjut, dan potensi penghematan jika ditekankan ke batas minimal)."
}
`;

  const aiResponse = await generateContentWithRetryAndFallback(ai, {
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          trendSummary: {
            type: Type.STRING,
            description: "Ringkasan tren operasional berdasarkan total produksi dan total air terbuang, membandingkan rasio pemborosan aktual dengan target aman 5% serta pola trennya.",
          },
          operatorAnalysis: {
            type: Type.STRING,
            description: "Analisis terperinci mengenai kontribusi dan kinerja masing-masing operator. Ulasan variasi keterampilan dan rekomendasi tindakan pembinaan.",
          },
          temporalPattern: {
            type: Type.STRING,
            description: "Ulasan tentang pola waktu dari riwayat, seperti hari tertentu atau saat volume tinggi, serta insiden tanggal pemborosan air tertinggi.",
          },
          actionableSteps: {
            type: Type.STRING,
            description: "Langkah perbaikan taktis operasional air minum yang langsung bisa diterapkan berdasarkan data riwayat nyata.",
          },
          forecast: {
            type: Type.STRING,
            description: "Proyeksi dampak operasional jangka panjang (perkiraan air terbuang dalam 30 hari jika berlanjut, dan potensi penghematan jika ditekankan ke batas minimal).",
          },
        },
        required: ["trendSummary", "operatorAnalysis", "temporalPattern", "actionableSteps", "forecast"],
      }
    }
  });

  const responseText = aiResponse.text;
  if (!responseText) {
    throw new Error("Respon kosong dari Gemini API");
  }

  let jsonString = responseText.trim();
  if (jsonString.startsWith("```json")) {
    jsonString = jsonString.substring(7);
  }
  if (jsonString.startsWith("```")) {
    jsonString = jsonString.substring(3);
  }
  if (jsonString.endsWith("```")) {
    jsonString = jsonString.substring(0, jsonString.length - 3);
  }
  jsonString = jsonString.trim();

  const dmaicResult = JSON.parse(jsonString);
  return {
    ...dmaicResult,
    source: "gemini",
    warning: "Menghubungkan via Direct Client-Side API Fallback (Sukses!)"
  };
};

const callGeminiAnalyzePhotoDirectly = async (photoBase64OrUrl: string, activeMimeType: string, apiKey: string): Promise<any> => {
  let base64Data = "";
  let mimeType = activeMimeType || "image/jpeg";

  if (photoBase64OrUrl.startsWith("http")) {
    try {
      const imgResponse = await fetch(photoBase64OrUrl);
      if (!imgResponse.ok) {
        throw new Error(`Status: ${imgResponse.status}`);
      }
      const blob = await imgResponse.blob();
      mimeType = blob.type || mimeType;
      
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res.replace(/^data:image\/\w+;base64,/, ""));
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      base64Data = await base64Promise;
    } catch (fetchErr: any) {
      throw new Error(`Gagal memproses gambar contoh: ${fetchErr.message || fetchErr}`);
    }
  } else {
    base64Data = photoBase64OrUrl.replace(/^data:image\/\w+;base64,/, "");
  }

  const ai = new GoogleGenAI({ apiKey });

  const imagePart = {
    inlineData: {
      mimeType,
      data: base64Data
    }
  };

  const prompt = `
Kamu adalah DAMIU Agent, konsultan kecerdasan buatan ahli kontrol kualitas dan keselamatan wadah pangan di industri Air Minum Isi Ulang (DAMIU) profesional.
Analisis foto galon yang diunggah berikut dan identifikasi masalahnya (misalnya apakah bocor, retak, tutup rusak/pecah, kotor/berlumut, penyok, kusam, atau masalah kebersihan lainnya).

Berikan analisis yang sangat terperinci, formal, bersahabat, dan taktis dalam bahasa Indonesia. Kembalikan respon HANYA berupa objek JSON murni dengan struktur berikut:
{
  "status": "Sukses",
  "issue": "Nama/identifikasi singkat masalah yang terlihat pada foto galon (gunakan istilah teknis bahasa Indonesia yang baik)",
  "severity": "Rendah" atau "Sedang" atau "Tinggi",
  "rootCause": "Penyebab utama dari kerusakan/masalah tersebut (mengapa hal itu bisa terjadi secara operasional)",
  "solution": "Langkah solusi konkret dan taktis yang harus diambil oleh pemilik DAMIU atau petugas untuk menangani galon ini sekarang",
  "prevention": "Tips pencegahan operasional di masa depan agar masalah serupa tidak terulang kembali"
}
`;

  const aiResponse = await generateContentWithRetryAndFallback(ai, {
    contents: { parts: [imagePart, { text: prompt }] },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          status: {
            type: Type.STRING,
            description: "Harus selalu bernilai 'Sukses' jika gambar berhasil diidentifikasi.",
          },
          issue: {
            type: Type.STRING,
            description: "Nama atau identifikasi singkat masalah kerusakan/kebersihan yang terlihat pada foto galon.",
          },
          severity: {
            type: Type.STRING,
            description: "Tingkat keparahan masalah, harus salah satu dari: 'Rendah', 'Sedang', atau 'Tinggi'.",
          },
          rootCause: {
            type: Type.STRING,
            description: "Penyebab utama dari kerusakan/masalah tersebut secara operasional.",
          },
          solution: {
            type: Type.STRING,
            description: "Langkah solusi konkret dan taktis yang harus diambil sekarang oleh pemilik atau petugas untuk menangani galon ini.",
          },
          prevention: {
            type: Type.STRING,
            description: "Tips pencegahan operasional di masa depan agar masalah serupa tidak terulang kembali.",
          },
        },
        required: ["status", "issue", "severity", "rootCause", "solution", "prevention"],
      }
    }
  });

  const responseText = aiResponse.text;
  if (!responseText) {
    throw new Error("Respon kosong dari Gemini API");
  }

  let jsonString = responseText.trim();
  if (jsonString.startsWith("```json")) {
    jsonString = jsonString.substring(7);
  }
  if (jsonString.startsWith("```")) {
    jsonString = jsonString.substring(3);
  }
  if (jsonString.endsWith("```")) {
    jsonString = jsonString.substring(0, jsonString.length - 3);
  }
  jsonString = jsonString.trim();

  const analysisResult = JSON.parse(jsonString);
  return {
    ...analysisResult,
    source: "gemini",
    warning: "Menghubungkan via Direct Client-Side API Fallback (Sukses!)"
  };
};

interface HistoryAnalysisProps {
  reports: ProductionReport[];
}

interface CustomAnalysisData {
  trendSummary: string;
  operatorAnalysis: string;
  temporalPattern: string;
  actionableSteps: string;
  forecast: string;
  source?: "gemini" | "rule-engine" | "rule-engine-fallback";
  warning?: string;
}

export default function HistoryAnalysis({ reports }: HistoryAnalysisProps) {
  const [activeSubTab, setActiveSubTab] = useState<"ringkasan" | "operator" | "pola" | "saran">("ringkasan");
  const [aiAnalysis, setAiAnalysis] = useState<CustomAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // --- PHOTO DAMAGE ANALYSIS STATES ---
  const [photo, setPhoto] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoResult, setPhotoResult] = useState<{
    status: string;
    issue: string;
    severity: "Rendah" | "Sedang" | "Tinggi";
    rootCause: string;
    solution: string;
    prevention: string;
    source?: string;
    warning?: string;
  } | null>(null);
  const [selectedSimType, setSelectedSimType] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);

  const compressImage = (base64Str: string, maxWidth = 600, maxHeight = 600): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(base64Str);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Compress quality to 70% JPEG
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
        resolve(compressedDataUrl);
      };
      img.onerror = () => {
        resolve(base64Str); // Fallback to original
      };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setPhotoError("File yang diunggah harus berupa gambar (JPG, PNG, dll).");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setPhotoError("Ukuran gambar terlalu besar (Maksimum 4MB).");
      return;
    }

    setPhotoError("");
    setPhotoResult(null);
    setMimeType("image/jpeg"); // standardized to jpeg after compression
    setSelectedSimType("");

    const reader = new FileReader();
    reader.onloadend = async () => {
      const originalBase64 = reader.result as string;
      try {
        const compressed = await compressImage(originalBase64);
        setPhoto(compressed);
      } catch (err) {
        setPhoto(originalBase64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.type.startsWith("image/")) {
        setPhotoError("File yang diunggah harus berupa gambar (JPG, PNG, dll).");
        return;
      }
      if (file.size > 4 * 1024 * 1024) {
        setPhotoError("Ukuran gambar terlalu besar (Maksimum 4MB).");
        return;
      }
      setPhotoError("");
      setPhotoResult(null);
      setMimeType("image/jpeg"); // standardized to jpeg after compression
      setSelectedSimType("");

      const reader = new FileReader();
      reader.onloadend = async () => {
        const originalBase64 = reader.result as string;
        try {
          const compressed = await compressImage(originalBase64);
          setPhoto(compressed);
        } catch (err) {
          setPhoto(originalBase64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectSimulated = (type: string) => {
    setSelectedSimType(type);
    setPhotoResult(null);
    setPhotoError("");
    
    if (type === "retak") {
      setPhoto("https://images.unsplash.com/photo-1548839140-29a749e1cf4d?q=80&w=600&auto=format&fit=crop");
      setMimeType("image/jpeg");
    } else if (type === "tutup") {
      setPhoto("https://images.unsplash.com/photo-1608889175123-8ec330b86f84?q=80&w=600&auto=format&fit=crop");
      setMimeType("image/jpeg");
    } else if (type === "lumut") {
      setPhoto("https://images.unsplash.com/photo-1581092921461-eab62e97a780?q=80&w=600&auto=format&fit=crop");
      setMimeType("image/jpeg");
    }
  };

  const handleAnalyzePhoto = async () => {
    if (!photo) {
      setPhotoError("Silakan unggah foto galon terlebih dahulu atau pilih simulasi.");
      return;
    }

    setPhotoLoading(true);
    setPhotoError("");
    try {
      let data;
      try {
        const response = await fetch("/api/analyze-gallon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: photo,
            mimeType: mimeType,
            simulatedType: selectedSimType || undefined
          })
        });

        if (!response.ok) {
          throw new Error("Backend API not OK");
        }

        data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
      } catch (backendErr) {
        console.warn("Backend API photo analysis failed, trying direct client-side fallback:", backendErr);
        const apiKey = getClientApiKey();
        if (!apiKey) {
          throw new Error("Gagal terhubung ke API backend, dan GEMINI_API_KEY tidak ditemukan di environment variable Vercel. Pastikan Anda telah memasang GEMINI_API_KEY di dashboard Vercel.");
        }
        data = await callGeminiAnalyzePhotoDirectly(photo, mimeType, apiKey);
      }

      setPhotoResult(data);
    } catch (err: any) {
      console.error(err);
      setPhotoError(err.message || "Gagal menganalisis foto galon.");
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleResetPhoto = () => {
    setPhoto(null);
    setMimeType("");
    setPhotoResult(null);
    setPhotoError("");
    setSelectedSimType("");
  };

  // --- LOCAL CALCULATED METRICS FROM HISTORY ---
  const stats = useMemo(() => {
    if (reports.length === 0) return null;

    const totalProduction = reports.reduce((acc, curr) => acc + ((curr.productionLiter || (curr.gallonsUsed * 19) || 0) + (curr.wastedLiter || 0)), 0);
    const totalWasted = reports.reduce((acc, curr) => acc + Math.max(0, curr.wastedLiter), 0);
    const overallWastePercent = totalProduction > 0 ? (totalWasted / totalProduction) * 100 : 0;

    // Distribution
    let amanCount = 0;
    let warningCount = 0;
    let kritisCount = 0;

    reports.forEach(r => {
      if (r.status === "Kritis" || r.wastePercent > 10) kritisCount++;
      else if (r.status === "Warning" || r.wastePercent > 5) warningCount++;
      else amanCount++;
    });

    // Operator Metrics
    const operatorDates: Record<string, Set<string>> = {};
    const opStats: Record<string, { prod: number; waste: number; count: number }> = {};
    reports.forEach(r => {
      const name = r.operator || "Unknown";
      const prod = (r.productionLiter || (r.gallonsUsed * 19) || 0) + (r.wastedLiter || 0);
      if (!operatorDates[name]) {
        operatorDates[name] = new Set();
      }
      operatorDates[name].add(r.date);

      if (!opStats[name]) {
        opStats[name] = { prod: 0, waste: 0, count: 0 };
      }
      opStats[name].prod += prod;
      opStats[name].waste += Math.max(0, r.wastedLiter);
      opStats[name].count += 1;
    });

    let bestOperator = "";
    let bestOpWastePct = Infinity;
    let worstOperator = "";
    let worstOpWastePct = -1;

    Object.entries(opStats).forEach(([name, data]) => {
      const pct = data.prod > 0 ? (data.waste / data.prod) * 100 : 0;
      if (pct < bestOpWastePct) {
        bestOpWastePct = pct;
        bestOperator = name;
      }
      if (pct > worstOpWastePct) {
        worstOpWastePct = pct;
        worstOperator = name;
      }
    });

    // Worst Single Day
    let worstDayReport = reports[0];
    reports.forEach(r => {
      if (r.wastePercent > worstDayReport.wastePercent) {
        worstDayReport = r;
      }
    });

    // Weekday Metrics
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const weekdayDates = Array.from({ length: 7 }, () => new Set<string>());
    const weekdayStats = Array.from({ length: 7 }, () => ({ prod: 0, waste: 0, count: 0 }));

    reports.forEach(r => {
      if (!r.date) return;
      const dayIndex = new Date(r.date).getDay();
      const prod = (r.productionLiter || (r.gallonsUsed * 19) || 0) + (r.wastedLiter || 0);
      weekdayDates[dayIndex].add(r.date);
      weekdayStats[dayIndex].prod += prod;
      weekdayStats[dayIndex].waste += r.wastedLiter;
      weekdayStats[dayIndex].count += 1;
    });

    let worstWeekdayIndex = -1;
    let maxWeekdayPct = -1;
    let bestWeekdayIndex = -1;
    let minWeekdayPct = Infinity;

    weekdayStats.forEach((data, index) => {
      if (data.count === 0) return;
      const pct = data.prod > 0 ? (data.waste / data.prod) * 100 : 0;
      if (pct > maxWeekdayPct) {
        maxWeekdayPct = pct;
        worstWeekdayIndex = index;
      }
      if (pct < minWeekdayPct) {
        minWeekdayPct = pct;
        bestWeekdayIndex = index;
      }
    });

    return {
      totalProduction,
      totalWasted,
      overallWastePercent,
      amanCount,
      warningCount,
      kritisCount,
      bestOperator,
      bestOpWastePct,
      worstOperator,
      worstOpWastePct,
      worstDayReport,
      worstWeekdayName: worstWeekdayIndex !== -1 ? dayNames[worstWeekdayIndex] : "Tidak ada data",
      worstWeekdayPct: maxWeekdayPct,
      bestWeekdayName: bestWeekdayIndex !== -1 ? dayNames[bestWeekdayIndex] : "Tidak ada data",
      bestWeekdayPct: minWeekdayPct
    };
  }, [reports]);

  const currentAnalysis = aiAnalysis;

  // Trigger Backend Historical Analysis
  const handleAiAudit = async () => {
    if (reports.length === 0) return;
    setLoading(true);
    setError("");
    try {
      let data;
      try {
        const response = await fetch("/api/dmaic", { // keep endpoint for simplicity but server handles prompt adaptively
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productionData: reports })
        });

        if (!response.ok) {
          throw new Error("Backend API not OK");
        }

        data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
      } catch (backendErr) {
        console.warn("Backend API failed, trying direct client-side fallback:", backendErr);
        const apiKey = getClientApiKey();
        if (!apiKey) {
          throw new Error("Gagal terhubung ke API backend, dan GEMINI_API_KEY tidak ditemukan di environment variable Vercel. Pastikan Anda telah memasang GEMINI_API_KEY di dashboard Vercel.");
        }
        data = await callGeminiDmaicDirectly(reports, apiKey);
      }

      // Check if server returned DMAIC format, map it to our clean historical format gracefully
      if (data.define && data.measure && data.analyze) {
        setAiAnalysis({
          trendSummary: `${data.define}\n\n${data.measure}`,
          operatorAnalysis: data.analyze,
          temporalPattern: `Pola yang Ditemukan:\n${data.measure}`,
          actionableSteps: data.improve,
          forecast: data.control,
          source: data.source,
          warning: data.warning
        });
      } else {
        setAiAnalysis(data);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Gagal menghasilkan analisis riwayat.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {reports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8 text-center text-slate-400">
          <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">Belum ada riwayat laporan operasional untuk dianalisis.</p>
          <p className="text-xs text-slate-400 mt-1">Silakan tambahkan data produksi harian terlebih dahulu pada tab "Laporan Baru" untuk melihat visualisasi dan pola pemborosan.</p>
        </div>
      ) : (
        <div className="tactile-3d-card p-6 bg-white">
          {/* Title + Action Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="font-display font-extrabold text-lg text-slate-900 flex items-center gap-1.5 tracking-tight">
                <Sparkles className="w-5 h-5 text-teal-500 animate-pulse" />
                <span>Analisis</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-bold mt-0.5">Asisten pintar untuk mengoptimalkan efisiensi operasional.</p>
            </div>

            <button
              onClick={handleAiAudit}
              disabled={loading || reports.length === 0}
              className="tactile-3d-button-teal text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Menghubungi sistem..." : "Perbarui Analisis"}</span>
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200/60 rounded-xl text-xs text-red-600 flex items-start gap-2 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}



          {/* Grid of Heuristics Indicators */}
          {stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl flex items-start gap-2.5">
                <div className="p-1.5 bg-green-100 text-green-700 rounded-lg">
                  <Award className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Operator Terbaik</span>
                  <span className="text-sm font-bold text-slate-800 block mt-0.5">{stats.bestOperator}</span>
                  <span className="text-[10px] font-bold text-green-600 font-mono">Waste: {stats.bestOpWastePct.toFixed(2)}%</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl flex items-start gap-2.5">
                <div className="p-1.5 bg-red-100 text-red-700 rounded-lg">
                  <TrendingUp className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Operator Terboros</span>
                  <span className="text-sm font-bold text-slate-800 block mt-0.5">{stats.worstOperator}</span>
                  <span className="text-[10px] font-bold text-red-600 font-mono">Waste: {stats.worstOpWastePct.toFixed(2)}%</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl flex items-start gap-2.5">
                <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                  <Calendar className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Hari Terboros</span>
                  <span className="text-sm font-bold text-slate-800 block mt-0.5">Hari {stats.worstWeekdayName}</span>
                  <span className="text-[10px] font-bold text-amber-600 font-mono font-bold">Avg Waste: {stats.worstWeekdayPct.toFixed(2)}%</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/50 rounded-xl flex items-start gap-2.5">
                <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                  <Clock className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Hari Terbaik</span>
                  <span className="text-sm font-bold text-slate-800 block mt-0.5">Hari {stats.bestWeekdayName}</span>
                  <span className="text-[10px] font-bold text-indigo-600 font-mono font-bold">Avg Waste: {stats.bestWeekdayPct.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Sub-Tabs and Content */}
          {loading && !currentAnalysis ? (
            <div className="bg-slate-50 p-8 rounded-xl border border-slate-200/50 flex flex-col items-center justify-center text-center space-y-4 min-h-[300px]">
              <div className="relative">
                <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-500 rounded-full animate-spin"></div>
                <Sparkles className="w-5 h-5 text-teal-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div className="space-y-1 max-w-md">
                <h4 className="text-sm font-bold text-slate-800">Sedang menganalisis data...</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                  Membaca riwayat log produksi, mengevaluasi rasio pemborosan tiap petugas harian, dan merancang rekomendasi taktis real-time menggunakan Gemini.
                </p>
              </div>
            </div>
          ) : !currentAnalysis ? (
            <div className="bg-slate-50 p-8 rounded-xl border border-slate-200/50 flex flex-col items-center justify-center text-center space-y-4 min-h-[300px]">
              <Sparkles className="w-10 h-10 text-teal-500 animate-pulse" />
              <div className="space-y-1 max-w-md">
                <h4 className="text-sm font-bold text-slate-800">Mulai Analisis</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                  Sistem siap melakukan audit menyeluruh pada data riwayat produksi Anda menggunakan kecerdasan buatan Gemini secara real-time.
                </p>
              </div>
              <button
                onClick={handleAiAudit}
                className="tactile-3d-button-teal text-white font-bold text-xs py-2.5 px-5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Mulai Analisis</span>
              </button>
            </div>
          ) : (
            <>
              {/* Navigation Sub-Tabs */}
              <div className="flex border-b border-slate-100 gap-1 overflow-x-auto no-scrollbar pb-1">
                {[
                  { key: "ringkasan", label: "Ringkasan Tren", icon: <FileText className="w-4 h-4" /> },
                  { key: "operator", label: "Kinerja Petugas", icon: <Award className="w-4 h-4" /> },
                  { key: "pola", label: "Pola Waktu & Hari", icon: <Calendar className="w-4 h-4" /> },
                  { key: "saran", label: "Rekomendasi Taktis", icon: <ShieldCheck className="w-4 h-4" /> }
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveSubTab(tab.key as any)}
                    className={`flex items-center gap-1.5 py-2 px-3 border-b-2 font-bold text-xs transition-all shrink-0 cursor-pointer ${
                      activeSubTab === tab.key
                        ? "border-teal-500 text-teal-600"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab Content Area */}
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200/50 space-y-4 mt-4">
                {activeSubTab === "ringkasan" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Ringkasan Tren & Riwayat</h4>
                      <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">Kinerja Umum</span>
                    </div>
                    <p className="text-sm text-slate-700 font-sans leading-relaxed whitespace-pre-line">
                      {currentAnalysis.trendSummary}
                    </p>
                    
                    {/* Distribution visual progress bar */}
                    {stats && (
                      <div className="bg-white p-4 rounded-xl border border-slate-200/60 space-y-3 mt-4">
                        <span className="text-xs font-bold text-slate-500">Distribusi Status Log Riwayat</span>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2.5 bg-green-50 border border-green-100 rounded-lg">
                            <span className="text-slate-400 block font-semibold text-[10px]">Aman (≤ 5%)</span>
                            <span className="font-bold text-green-600 text-base">{stats.amanCount} Hari</span>
                          </div>
                          <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
                            <span className="text-slate-400 block font-semibold text-[10px]">Warning (5-10%)</span>
                            <span className="font-bold text-amber-600 text-base">{stats.warningCount} Hari</span>
                          </div>
                          <div className="p-2.5 bg-red-50 border border-red-100 rounded-lg">
                            <span className="text-slate-400 block font-semibold text-[10px]">Kritis (&gt; 10%)</span>
                            <span className="font-bold text-red-600 text-base">{stats.kritisCount} Hari</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeSubTab === "operator" && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Evaluasi Kinerja & Komparasi Petugas</h4>
                    <p className="text-sm text-slate-700 font-sans leading-relaxed whitespace-pre-line">
                      {currentAnalysis.operatorAnalysis}
                    </p>
                  </div>
                )}

                {activeSubTab === "pola" && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Pola Kejadian Pemborosan (Sesuai Kalender)</h4>
                    <p className="text-sm text-slate-700 font-sans leading-relaxed whitespace-pre-line">
                      {currentAnalysis.temporalPattern}
                    </p>
                  </div>
                )}

                {activeSubTab === "saran" && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Langkah Korektif & Rekomendasi Solusi</h4>
                    <p className="text-sm text-slate-700 font-sans leading-relaxed whitespace-pre-line">
                      {currentAnalysis.actionableSteps}
                    </p>
                    
                    <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl space-y-2 mt-4 text-xs text-teal-800">
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle className="w-4 h-4 text-teal-600" />
                        <span>Proyeksi Penghematan Riwayat</span>
                      </div>
                      <p className="font-sans leading-relaxed whitespace-pre-line">
                        {currentAnalysis.forecast}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Info notice with Connection Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 mt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold font-sans">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>
                {aiAnalysis
                  ? "Analisis aktif secara langsung menggunakan model kecerdasan buatan Gemini 3.5 Flash."
                  : "Analisis siap menganalisis data log riwayat DAMIU Anda secara real-time."}
              </span>
            </div>

            <div className="self-start sm:self-auto">
              {aiAnalysis ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wider">
                  <CheckCircle className="w-3 h-3 text-emerald-500" />
                  <span>Sistem Analisis - Terhubung</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-50 text-slate-700 border border-slate-200 uppercase tracking-wider" title="Pastikan GEMINI_API_KEY terpasang di Settings > Secrets untuk mengaktifkan analisis pintar.">
                  <HelpCircle className="w-3 h-3 text-slate-400 animate-pulse" />
                  <span>Menunggu Analisis</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- NEW SECTION: PHOTO DAMAGE ANALYSIS --- */}
      <div className="tactile-3d-card p-6 bg-white space-y-6">
        <div>
          <h3 className="font-display font-extrabold text-lg text-slate-900 flex items-center gap-1.5 tracking-tight">
            <Camera className="w-5 h-5 text-teal-500" />
            <span>Analisis Kerusakan & Kebocoran Galon</span>
          </h3>
          <p className="text-[11px] text-slate-400 font-bold mt-0.5">
            Unggah foto galon bocor, retak, tutup longgar, atau berlumut untuk diidentifikasi masalahnya & temukan solusi taktisnya secara langsung.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Image Uploader */}
          <div className="space-y-4">
            {/* Drag & Drop Upload Container */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all relative ${
                dragActive
                  ? "border-teal-500 bg-teal-50/40"
                  : photo
                  ? "border-slate-200 bg-slate-50/30"
                  : "border-slate-300/80 hover:border-slate-400 bg-slate-50/50"
              }`}
            >
              {photo ? (
                <div className="space-y-3">
                  <div className="relative mx-auto w-full max-w-[240px] aspect-video sm:aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                    <img
                      src={photo}
                      alt="Uploaded Gallon"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={handleResetPhoto}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md transition-colors cursor-pointer"
                      title="Hapus Gambar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  <div className="text-xs">
                    <span className="font-bold text-slate-700 block">Gambar Berhasil Dimuat</span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      Menggunakan foto unggahan Anda
                    </span>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-2.5 py-6">
                  <div className="p-2 bg-slate-100 text-slate-500 rounded-xl">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">
                      Tarik & Lepas Foto di Sini
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                      atau <span className="text-teal-600 font-extrabold underline">Pilih File</span> dari perangkat Anda (Maks. 4MB)
                    </span>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </label>
              )}
            </div>

            {/* Submit / Trigger Button */}
            <button
              type="button"
              onClick={handleAnalyzePhoto}
              disabled={photoLoading || !photo}
              className="w-full tactile-3d-button-teal text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${photoLoading ? "animate-spin" : ""}`} />
              <span>{photoLoading ? "Menganalisis Foto..." : "Mulai Analisis Foto Galon"}</span>
            </button>

            {photoError && (
              <div className="p-3 bg-red-50 border border-red-200/60 rounded-xl text-xs text-red-600 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{photoError}</span>
              </div>
            )}
          </div>

          {/* Right Column: AI Analysis Result */}
          <div className="flex flex-col justify-between border border-slate-200/50 bg-slate-50/40 rounded-2xl p-5 min-h-[300px]">
            {photoLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="relative">
                  <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
                  <Sparkles className="w-4 h-4 text-teal-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Menganalisis Kerusakan...</h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">
                    Gemini sedang memindai pola kebocoran, retakan, dan higienitas kemasan galon.
                  </p>
                </div>
              </div>
            ) : photoResult ? (
              <div className="space-y-4 flex-1">
                {/* Result Header & Severity Badge */}
                <div className="flex items-center justify-between gap-4 border-b border-slate-200/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🔍</span>
                    <h4 className="text-xs font-black text-indigo-700 uppercase tracking-wider">
                      Hasil Analisis Kerusakan
                    </h4>
                  </div>
                  
                  {/* Severity Badge */}
                  <span
                    className={`inline-flex items-center gap-1 py-0.5 px-2 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                      photoResult.severity === "Tinggi"
                        ? "bg-red-50 text-red-600 border-red-200"
                        : photoResult.severity === "Sedang"
                        ? "bg-amber-50 text-amber-600 border-amber-200"
                        : "bg-blue-50 text-blue-600 border-blue-200"
                    }`}
                  >
                    <AlertTriangle className="w-2.5 h-2.5" />
                    <span>Keparahan: {photoResult.severity}</span>
                  </span>
                </div>



                {/* Detected Issue Title */}
                <div className="bg-white p-3.5 border border-slate-200/60 rounded-xl">
                  <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">
                    Masalah Terdeteksi
                  </span>
                  <span className="text-sm font-extrabold text-slate-800 block mt-0.5">
                    {photoResult.issue}
                  </span>
                </div>

                {/* Root Cause & Solutions Details */}
                <div className="space-y-3.5">
                  <div className="flex gap-2.5">
                    <div className="p-1 bg-amber-50 text-amber-600 border border-amber-100 rounded-lg shrink-0 h-fit">
                      <HelpCircle className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold block uppercase tracking-wider">
                        Kenapa Hal Ini Terjadi (Penyebab)
                      </span>
                      <p className="text-xs text-slate-600 font-sans mt-0.5 leading-relaxed">
                        {photoResult.rootCause}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2.5">
                    <div className="p-1 bg-green-50 text-green-600 border border-green-100 rounded-lg shrink-0 h-fit">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold block uppercase tracking-wider">
                        Solusi Taktis Sekarang
                      </span>
                      <p className="text-xs text-slate-600 font-sans mt-0.5 leading-relaxed">
                        {photoResult.solution}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2.5">
                    <div className="p-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg shrink-0 h-fit">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold block uppercase tracking-wider">
                        Saran Pencegahan Masa Depan
                      </span>
                      <p className="text-xs text-slate-600 font-sans mt-0.5 leading-relaxed">
                        {photoResult.prevention}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <div className="p-3 bg-white border border-slate-200/60 rounded-2xl shadow-xs mb-3">
                  <Upload className="w-6 h-6 text-slate-300" />
                </div>
                <h4 className="text-xs font-bold text-slate-600">Menunggu Unggahan Foto</h4>
                <p className="text-[10px] text-slate-400 font-medium max-w-[250px] mx-auto mt-1 leading-relaxed">
                  Unggah foto galon dari perangkat Anda, lalu klik tombol analisis untuk memulai diagnostik.
                </p>
              </div>
            )}

            {/* Source Tag Footer */}
            {photoResult && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-semibold font-sans">
                <span>Metode Pemrosesan</span>
                <span className="inline-flex items-center gap-1 text-teal-600 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">
                  🤖 Gemini Vision
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
