import React from "react";
import { 
  Droplet, 
  LogOut, 
  ShieldAlert, 
  ShieldCheck, 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  Sparkles, 
  Award, 
  Users, 
  ChevronLeft, 
  ChevronRight, 
  X,
  Menu,
  Database,
  RefreshCw,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { UserProfile, ProductionReport } from "../types";

interface SidebarProps {
  user: UserProfile;
  activeTab: "dashboard" | "input" | "riwayat" | "dmaic" | "kpi" | "users";
  setActiveTab: (tab: "dashboard" | "input" | "riwayat" | "dmaic" | "kpi" | "users") => void;
  reportToEdit: ProductionReport | null;
  setReportToEdit: (report: ProductionReport | null) => void;
  onLogout: () => void;
  isAdmin: boolean;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  syncStatus?: "idle" | "syncing" | "success" | "failed";
  lastSyncTime?: string | null;
  onSync?: () => void;
}

/**
 * Komponen Sidebar - Navigasi utama aplikasi DAMIU Hydro-Monitor.
 * Fitur:
 * 1. Mendukung mode responsif penuh (desktop persisten & mobile slide drawer).
 * 2. Dapat diciutkan (collapsible) oleh pengguna desktop untuk memaksimalkan area kerja.
 * 3. Navigasi cerdas berdasarkan hak akses: Menu khusus Administrator (Kinerja Petugas dan Kontrol User) hanya akan dirender jika pengguna login sebagai admin.
 * 4. Integrasi lencana profil pengguna aktif (Role: Admin / Petugas) dan tombol Keluar Aplikasi.
 */
export default function Sidebar({
  user,
  activeTab,
  setActiveTab,
  reportToEdit,
  setReportToEdit,
  onLogout,
  isAdmin,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
  syncStatus = "idle",
  lastSyncTime = null,
  onSync,
}: SidebarProps) {
  const isServerAdmin = user.role === "admin";

  // Item navigasi standar yang tersedia untuk semua peran pengguna (Admin & Petugas)
  const menuItems = [
    {
      id: "dashboard" as const,
      label: "Dashboard",
      icon: LayoutDashboard,
      color: "text-teal-400",
      bgHover: "hover:bg-teal-500/10 hover:text-teal-400",
      activeBg: "bg-gradient-to-r from-teal-500/10 to-cyan-500/5 text-teal-400 border-l-4 border-teal-500",
    },
    {
      id: "input" as const,
      label: reportToEdit ? "Edit Laporan" : "Laporan Baru",
      icon: PlusCircle,
      color: "text-emerald-400",
      bgHover: "hover:bg-emerald-500/10 hover:text-emerald-400",
      activeBg: "bg-gradient-to-r from-emerald-500/10 to-teal-500/5 text-emerald-400 border-l-4 border-emerald-500",
    },
    {
      id: "riwayat" as const,
      label: "Riwayat",
      icon: History,
      color: "text-cyan-400",
      bgHover: "hover:bg-cyan-500/10 hover:text-cyan-400",
      activeBg: "bg-gradient-to-r from-cyan-500/10 to-blue-500/5 text-cyan-400 border-l-4 border-cyan-500",
    },
    {
      id: "dmaic" as const,
      label: "Analisis",
      icon: Sparkles,
      color: "text-purple-400",
      bgHover: "hover:bg-purple-500/10 hover:text-purple-400",
      activeBg: "bg-gradient-to-r from-purple-500/10 to-pink-500/5 text-purple-400 border-l-4 border-purple-500",
    },
  ];

  // Item navigasi eksklusif untuk tingkat Administrator saja
  const adminItems = [
    {
      id: "kpi" as const,
      label: "Kinerja Petugas",
      icon: Award,
      color: "text-indigo-400",
      bgHover: "hover:bg-indigo-500/10 hover:text-indigo-400",
      activeBg: "bg-gradient-to-r from-indigo-500/10 to-purple-500/5 text-indigo-400 border-l-4 border-indigo-500",
    },
    {
      id: "users" as const,
      label: "Kontrol User",
      icon: Users,
      color: "text-sky-400",
      bgHover: "hover:bg-sky-500/10 hover:text-sky-400",
      activeBg: "bg-gradient-to-r from-sky-500/10 to-blue-500/5 text-sky-400 border-l-4 border-sky-500",
    },
  ];

  /**
   * Menangani aksi perpindahan tab navigasi utama secara mulus.
   */
  const handleTabClick = (tabId: typeof activeTab) => {
    setActiveTab(tabId);
    if (tabId !== "input") {
      setReportToEdit(null);
    }
    // Menutup laci navigasi (drawer) pada layar seluler setelah link diklik
    setMobileOpen(false);
  };

  /**
   * Menggambar deretan tombol navigasi berdasarkan kelompok menu terdaftar.
   */
  const renderNavLinks = (items: {
    id: typeof activeTab;
    label: string;
    icon: any;
    color: string;
    bgHover: string;
    activeBg: string;
  }[]) => {
    return items.map((item) => {
      const Icon = item.icon;
      const isActive = activeTab === item.id;
      return (
        <button
          key={item.id}
          id={`nav-item-${item.id}`}
          onClick={() => handleTabClick(item.id)}
          className={`w-full flex items-center gap-3.5 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
            isActive 
              ? item.activeBg 
              : `text-slate-400 hover:bg-slate-800/60 hover:text-slate-200`
          } ${collapsed ? "md:justify-center md:px-0 md:rounded-lg" : ""}`}
          title={collapsed ? item.label : undefined}
        >
          <Icon className={`w-5 h-5 shrink-0 ${isActive ? "" : "text-slate-400"}`} />
          <span className={`transition-all duration-200 ${collapsed ? "md:hidden" : "block"}`}>
            {item.label}
          </span>
        </button>
      );
    });
  };

  // Konten navigasi dalam (inner) yang dibagi bersama oleh laci seluler dan navigasi desktop
  const sidebarContent = (
    <div className="h-full flex flex-col justify-between bg-slate-950 text-slate-100 font-sans select-none relative">
      {/* Bagian Identitas Brand / Logo */}
      <div>
        <div className={`p-5 flex items-center justify-between border-b border-slate-900 ${collapsed ? "md:p-4 md:justify-center" : ""}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/10 rounded-xl border border-teal-500/20 shrink-0">
              <Droplet className="w-6 h-6 text-teal-400" />
            </div>
            <div className={`transition-all duration-300 ${collapsed ? "md:hidden" : "block"}`}>
              <h1 className="font-display font-extrabold text-sm tracking-wider uppercase bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">
                HYDRO-MONITOR
              </h1>
              <p className="text-[9px] text-slate-500 tracking-wider uppercase font-medium">
                SISTEM DAMIU
              </p>
            </div>
          </div>
          
          {/* Tombol tutup pada layar mobile */}
          <button 
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Daftar Link Navigasi Utama */}
        <div className="p-4 space-y-6 overflow-y-auto no-scrollbar max-h-[calc(100vh-180px)]">
          {/* Bagian Laporan Utama */}
          <div className="space-y-1">
            <p className={`text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2.5 ${collapsed ? "md:hidden" : "block"}`}>
              Laporan Utama
            </p>
            {renderNavLinks(menuItems)}
          </div>

          {/* Bagian Administrasi Eksklusif */}
          {isAdmin && (
            <div className="space-y-1 pt-4 border-t border-slate-900/60">
              <p className={`text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2.5 ${collapsed ? "md:hidden" : "block"}`}>
                Konfigurasi Admin
              </p>
              {renderNavLinks(adminItems)}
            </div>
          )}
        </div>
      </div>

      {/* Identitas Akun Aktif & Tombol Keluar */}
      <div className="p-4 border-t border-slate-900 bg-slate-950/80 sticky bottom-0 z-10 space-y-3">
        {/* Lencana Identitas Akun */}
        <div className={`flex items-center gap-3 p-2 rounded-xl bg-slate-900/40 border border-slate-900/60 ${collapsed ? "md:p-1 md:justify-center" : ""}`}>
          <div className={`p-2.5 rounded-xl shrink-0 ${isServerAdmin ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-teal-500/10 text-teal-400 border border-teal-500/20"}`}>
            {isServerAdmin ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </div>
          <div className={`min-w-0 transition-all duration-300 ${collapsed ? "md:hidden" : "block"}`}>
            <h4 className="font-bold text-sm text-slate-200 truncate leading-tight">{user.name}</h4>
            <span className="inline-block mt-0.5 text-[10px] tracking-wider uppercase font-extrabold text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded-md">
              {user.role}
            </span>
          </div>
        </div>

        {/* Tombol Keluar Akun */}
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-3 py-2.5 px-3 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/25 text-red-400/90 hover:text-red-400 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer ${
            collapsed ? "md:justify-center md:px-0" : ""
          }`}
          title={collapsed ? "Keluar dari Aplikasi" : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className={`transition-all duration-200 ${collapsed ? "md:hidden" : "block"}`}>
            Keluar Aplikasi
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* BAR ATAS KHUSUS PERANGKAT MOBILE */}
      <div className="md:hidden flex items-center justify-between h-16 px-4 bg-slate-950 border-b border-slate-900 text-slate-100 sticky top-0 z-35 shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 hover:bg-slate-900 rounded-xl text-slate-300 hover:text-white transition-colors cursor-pointer"
            id="mobile-menu-toggle"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-2">
            <Droplet className="w-5 h-5 text-teal-400 shrink-0" />
            <span className="font-display font-black text-sm tracking-wider uppercase bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">
              HYDRO-MONITOR
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Lencana Ringkas Sisi Mobile */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 py-1 px-2.5 rounded-full">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-300 max-w-[80px] truncate">{user.name}</span>
          </div>
        </div>
      </div>

      {/* LACI (DRAWER) NAVIGASI UNTUK PERANGKAT MOBILE */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Latar Belakang Gelap Sentuh-Tutup */}
          <div 
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
          />
          
          {/* Tubuh Laci Geser */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-950 border-r border-slate-900 h-full shadow-2xl transition-transform duration-300 transform translate-x-0 animate-slide-in-left">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* PANEL NAVIGASI DESKTOP (COLLAPSIBLE SIDEBAR) */}
      <div 
        className={`hidden md:block h-screen sticky top-0 z-40 border-r border-slate-900/60 bg-slate-950 shrink-0 shadow-lg transition-all duration-300 ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {sidebarContent}

        {/* Tombol Bulat Melayang Penciut Sidebar */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-5 -right-3 p-1 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-full border-2 border-slate-950 shadow-md transition-colors cursor-pointer z-50 hover:scale-110 active:scale-95"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>
    </>
  );
}
