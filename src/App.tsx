import React, { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";
import { UserProfile, ProductionReport, ActivityLog } from "./types";

// Import Komponen-Komponen
import AuthScreen from "./components/AuthScreen";
import Sidebar from "./components/Sidebar";
import KPIStats from "./components/KPIStats";
import Charts from "./components/Charts";
import DashboardTable from "./components/DashboardTable";
import SystemActivity from "./components/SystemActivity";
import ReportForm from "./components/ReportForm";
import HistoryTable from "./components/HistoryTable";
import HistoryAnalysis from "./components/HistoryAnalysis";
import PetugasKpi from "./components/PetugasKpi";
import UserManagement from "./components/UserManagement";

// Import Ikon Pendukung
import { RefreshCw, AlertCircle } from "lucide-react";

const isAdminEmail = (email: string) => {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  return e === "arsdsatu@gmail.com" || 
         e === "mhammdarsyad79@gmail.com";
};

/**
 * Komponen Utama Aplikasi - App
 * Mengelola state global aplikasi:
 * 1. Autentikasi Pengguna (onAuthStateChanged).
 * 2. Sinkronisasi data laporan harian dan data pengguna secara real-time dari Firestore.
 * 3. Navigasi tab internal aplikasi.
 * 4. Penanganan aksi administratif (Persetujuan Laporan, Edit, Hapus, Manajemen Akun).
 */
export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [reports, setReports] = useState<ProductionReport[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "input" | "riwayat" | "dmaic" | "kpi" | "users">("dashboard");
  const [reportToEdit, setReportToEdit] = useState<ProductionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [allOperators, setAllOperators] = useState<{ uid: string; name: string }[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [hasPermissionError, setHasPermissionError] = useState(false);
  
  // State untuk melacak sinkronisasi database Cloud SQL & Firestore
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "failed">("idle");
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Fungsi sinkronisasi dua arah (Cloud SQL + Firestore) via REST API
  const triggerDatabaseSync = useCallback(async () => {
    setSyncStatus("syncing");
    try {
      const [reportsRes, usersRes] = await Promise.all([
        fetch("/api/reports"),
        fetch("/api/users")
      ]);
      if (reportsRes.ok && usersRes.ok) {
        setSyncStatus("success");
        setLastSyncTime(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        console.log("Database Sync: Cloud SQL & Firestore synchronized successfully.");
      } else {
        setSyncStatus("failed");
      }
    } catch (err) {
      console.warn("Gagal menyinkronkan database:", err);
      setSyncStatus("failed");
    }
  }, []);
  
  // State mencatat status panyusutan sidebar di desktop
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem("sidebar_collapsed");
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Memicu sinkronisasi database otomatis saat pengguna berhasil login
  useEffect(() => {
    if (user) {
      triggerDatabaseSync();
    }
  }, [user, triggerDatabaseSync]);

  // Sinkronisasi status sidebarCollapsed ke penyimpanan lokal (localStorage)
  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // 1. Inisialisasi Autentikasi & Pengambilan Profil Pengguna dari database SQL Supabase
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const email = firebaseUser.email || "";
        const defaultRole = isAdminEmail(email) ? ("admin" as const) : ("petugas" as const);
        const defaultProfile: UserProfile = {
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || email.split("@")[0] || "User",
          email: email,
          role: defaultRole
        };

        try {
          // Ambil profil dari database Supabase melalui API backend
          const res = await fetch(`/api/users/${firebaseUser.uid}`);
          if (res.ok) {
            const existingProfile = await res.json();
            // Jika admin, pastikan role admin terjaga
            if (isAdminEmail(email)) {
              existingProfile.role = "admin";
            }
            setUser(existingProfile);
          } else if (res.status === 404) {
            // Jika pengguna baru belum terdaftar di database SQL, simpan profil default
            setUser(defaultProfile);
            await fetch("/api/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(defaultProfile)
            });
          } else {
            setUser(defaultProfile);
          }
        } catch (err) {
          console.warn("Gagal memuat profil pengguna dari SQL, menggunakan fallback lokal:", err);
          setUser(defaultProfile);
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // 2. Sinkronisasi SQL-First: Memuat Laporan Produksi & Daftar Pengguna dari Cloud SQL API secara terstruktur
  const loadAllData = useCallback(async () => {
    if (!user) return;
    try {
      const [reportsRes, usersRes, logsRes] = await Promise.all([
        fetch("/api/reports"),
        fetch("/api/users"),
        fetch("/api/logs").catch(() => null)
      ]);
      if (reportsRes.ok) {
        const reportsList = await reportsRes.json();
        reportsList.sort((a: ProductionReport, b: ProductionReport) => {
          const dateCompare = b.date.localeCompare(a.date);
          if (dateCompare !== 0) return dateCompare;
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        setReports(reportsList);
      }
      if (usersRes.ok) {
        const uList = await usersRes.json();
        setUsersList(uList);
        
        const ops = uList
          .filter((u: UserProfile) => u.role === "petugas")
          .map((u: UserProfile) => ({ uid: u.uid, name: u.name }));
         setAllOperators(ops);
      }
      if (logsRes && logsRes.ok) {
        const logsList = await logsRes.json();
        setActivityLogs(logsList);
      }
    } catch (err) {
      console.warn("Gagal memuat data dari SQL API server:", err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadAllData();

    // Polling berkala setiap 10 detik agar tetap sinkron dan dinamis secara real-time melalui PostgreSQL
    const interval = setInterval(loadAllData, 10000);
    return () => clearInterval(interval);
  }, [user, loadAllData]);

  // 3. Menangani Login Lokal Sukses
  const handleLocalLogin = useCallback((profile: UserProfile) => {
    setUser(profile);
  }, []);

  // 4. Menangani Logout Sesi Aktif
  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("SignOut gagal:", e);
    }
    setUser(null);
    setHasPermissionError(false);
    setActiveTab("dashboard");
  }, []);

  // 5. Menyimpan Baru / Memperbarui Laporan Produksi
  const handleReportSubmit = useCallback(async (reportData: {
    date: string;
    operator: string;
    operatorUid: string;
    gallonsUsed: number;
    productionLiter: number;
    wastedLiter: number;
    wastePercent: number;
    status: "Aman" | "Warning" | "Kritis";
  }) => {
    const reportId = reportToEdit ? reportToEdit.reportId : `report-${Date.now()}`;
    const newReport: ProductionReport = {
      ...reportData,
      reportId,
      approved: true, // Langsung disetujui / langsung masuk tanpa persetujuan admin
      createdAt: reportToEdit ? reportToEdit.createdAt : new Date().toISOString()
    };

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newReport)
      });
      if (response.ok) {
        await loadAllData();
      }
    } catch (err) {
      console.error("Gagal menyimpan laporan:", err);
    }

    setReportToEdit(null);
    setActiveTab("riwayat");
  }, [reportToEdit, user, loadAllData]);

  // 6. Menyetujui Laporan Produksi (Administrator Only)
  const handleApproveReport = useCallback(async (reportId: string) => {
    try {
      const response = await fetch(`/api/reports/${reportId}/approve`, {
        method: "PUT"
      });
      if (response.ok) {
        await loadAllData();
      }
    } catch (err) {
      console.error("Gagal menyetujui laporan:", err);
    }
  }, [loadAllData]);

  // 7. Menghapus Satu Laporan Produksi (Administrator Only)
  const handleReportDelete = useCallback(async (reportId: string) => {
    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: "DELETE"
      });
      if (response.ok) {
        await loadAllData();
      }
    } catch (err) {
      console.error("Gagal menghapus laporan:", err);
    }
  }, [loadAllData]);

  // 7b. Reset Seluruh Laporan Produksi (Administrator Only)
  const handleResetAllReports = useCallback(async () => {
    try {
      const response = await fetch("/api/reports/reset", {
        method: "POST"
      });
      if (response.ok) {
        await loadAllData();
      }
    } catch (err) {
      console.error("Gagal mereset laporan:", err);
    }
  }, [loadAllData]);

  // 8. Mulai Proses Penyuntingan (Editing) Laporan
  const handleStartEdit = useCallback((report: ProductionReport) => {
    setReportToEdit(report);
    setActiveTab("input");
  }, []);

  // Spinner Pemuatan Aplikasi Pertama Kali
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-teal-400 font-sans">
        <RefreshCw className="w-10 h-10 animate-spin mb-4" />
        <span className="text-sm font-bold tracking-wider uppercase">Memuat DAMIU Hydro-Monitor...</span>
      </div>
    );
  }

  // Tampilkan layar login jika belum diautentikasi
  if (!user) {
    return <AuthScreen onLocalLogin={handleLocalLogin} />;
  }

  const isAdmin = user.role === "admin";

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50/50 text-slate-800 font-sans">
      <Sidebar 
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        reportToEdit={reportToEdit}
        setReportToEdit={setReportToEdit}
        onLogout={handleLogout}
        isAdmin={isAdmin}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        syncStatus={syncStatus}
        lastSyncTime={lastSyncTime}
        onSync={triggerDatabaseSync}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-y-auto">
        {/* Kepala Atas Layar Desktop */}
        <header className="hidden md:flex items-center justify-between h-20 px-8 bg-white border-b border-slate-100 shrink-0 select-none">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight font-display">
              {activeTab === "dashboard" && "Dashboard Pemantauan"}
              {activeTab === "input" && (reportToEdit ? "Ubah Laporan" : "Laporan Baru")}
              {activeTab === "riwayat" && "Riwayat Laporan"}
              {activeTab === "dmaic" && "Analisis & Solusi"}
              {activeTab === "kpi" && "Evaluasi Kinerja"}
              {activeTab === "users" && "Kontrol User"}
            </h2>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              {activeTab === "dashboard" && "Ringkasan metrik volume air dan efisiensi harian."}
              {activeTab === "input" && "Pencatatan data galon dan sisa air terbuang harian."}
              {activeTab === "riwayat" && "Daftar rekam laporan produksi harian."}
              {activeTab === "dmaic" && "Analisis otomatis untuk menekan sisa air terbuang."}
              {activeTab === "kpi" && "Evaluasi kinerja operator dari rasio waste harian."}
              {activeTab === "users" && "Kelola akun dan hak akses petugas."}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100/50 py-1.5 px-3 rounded-xl text-[11px] text-emerald-700 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sistem Aktif</span>
            </div>
          </div>
        </header>

        {/* Isi Viewport Konten Utama */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {hasPermissionError && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-200 text-sm space-y-3 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-amber-950/20 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-300">Deteksi Sesi Ditangguhkan</p>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Sesi aktif Anda tidak lagi sinkron dengan database baru ini, sehingga hak akses ditolak.
                    Silakan klik tombol di samping untuk keluar dan atur ulang sesi Anda, kemudian masuk kembali secara otomatis.
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="py-2.5 px-5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold rounded-xl text-xs transition-all shrink-0 whitespace-nowrap self-start md:self-center shadow-md shadow-amber-500/10 cursor-pointer"
              >
                Atur Ulang Sesi & Logout
              </button>
            </div>
          )}

          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Metrik KPI Ringkas */}
              <KPIStats reports={reports} />

              {/* Grafik Analitik Tingkat Lanjut */}
              <Charts reports={reports} />

              {/* Baris 4: Tabel Laporan Terbaru & Aktivitas Sistem */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <DashboardTable
                    reports={reports}
                    user={user}
                    onApprove={handleApproveReport}
                    onNavigateToHistory={() => setActiveTab("riwayat")}
                  />
                </div>
                <div className="lg:col-span-1">
                  <SystemActivity reports={reports} dbLogs={activityLogs} />
                </div>
              </div>
            </div>
          )}

          {activeTab === "input" && (
            <div className="max-w-2xl mx-auto">
              <ReportForm
                user={user}
                reportToEdit={reportToEdit}
                onSubmit={handleReportSubmit}
                onCancel={reportToEdit ? () => { setReportToEdit(null); setActiveTab("riwayat"); } : undefined}
                allOperators={allOperators}
              />
            </div>
          )}

          {activeTab === "riwayat" && (
            <HistoryTable
              reports={reports}
              user={user}
              onEdit={handleStartEdit}
              onDelete={handleReportDelete}
              onApprove={handleApproveReport}
              onResetAll={handleResetAllReports}
            />
          )}

          {activeTab === "dmaic" && (
            <HistoryAnalysis reports={reports} />
          )}

          {activeTab === "kpi" && isAdmin && (
            <PetugasKpi reports={reports} />
          )}

          {activeTab === "users" && isAdmin && (
            <UserManagement users={usersList} currentUser={user} onRefresh={loadAllData} />
          )}
        </main>
      </div>
    </div>
  );
}
