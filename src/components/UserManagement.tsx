import React, { useState } from "react";
import { UserProfile } from "../types";
import { Search, UserCheck, Shield, Trash2, Users, AlertTriangle, Key } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";

interface UserManagementProps {
  users: UserProfile[];
  currentUser: UserProfile;
  onRefresh?: () => void;
}

/**
 * Komponen UserManagement - Mengizinkan administrator mengelola seluruh akun pengguna DAMIU.
 * Fitur:
 * 1. Filter pencarian cepat berdasarkan nama, email, atau peranan (role).
 * 2. Mengubah tingkat kewenangan akun (Toggle Role: Admin <-> Petugas).
 * 3. Mengirimkan tautan reset kata sandi langsung ke email pengguna yang lupa sandinya.
 * 4. Menghapus akun petugas secara permanen dari basis data SQL & Firestore.
 * 5. Proteksi keamanan agar pengguna tidak dapat mengubah peranan atau menghapus akun mereka sendiri.
 */
export default function UserManagement({ users, currentUser, onRefresh }: UserManagementProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  /**
   * Menyaring daftar pengguna yang ditampilkan secara real-time berdasarkan kata kunci pencarian.
   */
  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    return (
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term)
    );
  });

  /**
   * Mengubah tingkat kewenangan pengguna (Toggle Role).
   * Melakukan proteksi agar pengguna aktif tidak dapat menurunkan peranan dirinya sendiri.
   */
  const handleToggleRole = async (targetUser: UserProfile) => {
    if (targetUser.uid === currentUser.uid) {
      setError("Anda tidak dapat mengubah peran Anda sendiri.");
      return;
    }

    setLoadingId(targetUser.uid);
    setError("");
    setSuccessMsg("");

    const newRole = targetUser.role === "admin" ? "petugas" : "admin";
    try {
      const response = await fetch(`/api/users/${targetUser.uid}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole })
      });
      if (!response.ok) {
        throw new Error("Gagal merubah peran dari server API SQL");
      }
      setSuccessMsg(`Peran ${targetUser.name} berhasil diubah menjadi ${newRole.toUpperCase()}.`);
      if (onRefresh) onRefresh();
      
      // Menghilangkan pesan sukses secara otomatis setelah 4 detik
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      console.error(err);
      setError(`Gagal mengubah peran: ${err.message || "Kesalahan jaringan."}`);
    } finally {
      setLoadingId(null);
    }
  };

  /**
   * Menghapus profil pengguna dari basis data secara permanen.
   * Melakukan proteksi agar pengguna aktif tidak dapat menghapus akunnya sendiri.
   */
  const handleDeleteUser = async (uid: string, name: string) => {
    if (uid === currentUser.uid) {
      setError("Anda tidak dapat menghapus akun Anda sendiri.");
      return;
    }

    setLoadingId(uid);
    setError("");
    setSuccessMsg("");

    try {
      const response = await fetch(`/api/users/${uid}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error("Gagal menghapus pengguna dari server API SQL");
      }
      setSuccessMsg(`Akun ${name} berhasil dihapus dari database.`);
      setConfirmDeleteId(null);
      if (onRefresh) onRefresh();
      
      // Menghilangkan pesan sukses secara otomatis setelah 4 detik
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      console.error(err);
      setError(`Gagal menghapus pengguna: ${err.message || "Kesalahan jaringan."}`);
    } finally {
      setLoadingId(null);
    }
  };

  /**
   * Mengirimkan instruksi pemulihan atur ulang kata sandi ke email pengguna target menggunakan Firebase Auth.
   */
  const handleResetPassword = async (targetUser: UserProfile) => {
    setLoadingId(targetUser.uid);
    setError("");
    setSuccessMsg("");
    try {
      await sendPasswordResetEmail(auth, targetUser.email);
      setSuccessMsg(`Tautan atur ulang kata sandi berhasil dikirim ke email: ${targetUser.email}`);
      
      // Menghilangkan pesan sukses secara otomatis setelah 6 detik
      setTimeout(() => setSuccessMsg(""), 6000);
    } catch (err: any) {
      console.error(err);
      setError(`Gagal mengirim email reset kata sandi: ${err.message || "Kesalahan jaringan."}`);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="tactile-3d-card p-6 bg-white">
      {/* Bagian Kepala Komponen */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-teal-50 text-teal-600 border border-teal-100 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-lg text-slate-900 tracking-tight">Manajemen Pengguna</h3>
            <p className="text-[11px] text-slate-400 font-bold mt-0.5">
              Kelola peran petugas dan administrator.
            </p>
          </div>
        </div>

        {/* Indikator Jumlah Pengguna */}
        <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
          <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-xs">
            Total User: <span className="text-slate-950 font-black">{users.length}</span>
          </div>
          <div className="bg-teal-50/50 text-teal-700 px-3 py-1.5 rounded-xl border border-teal-200/40 shadow-xs">
            Admin: <span className="text-teal-950 font-black">{users.filter(u => u.role === "admin").length}</span>
          </div>
        </div>
      </div>

      {/* Tampilan Pesan Alarm / Notifikasi */}
      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200/80 text-red-700 rounded-2xl text-xs flex items-center gap-2 font-semibold mb-4 animate-fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200/80 text-emerald-700 rounded-2xl text-xs flex items-center gap-2 font-semibold mb-4 animate-fade-in">
          <UserCheck className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Kolom Pencarian Akun */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Cari berdasarkan nama, email, atau peran..."
          className="w-full bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 hover:border-slate-300 rounded-xl pl-10 pr-4 py-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-teal-500 transition-all font-semibold shadow-xs"
        />
      </div>

      {/* Daftar Pengguna */}
      <div>
        {/* Tampilan Tabel Desktop */}
        <div className="overflow-x-auto mb-6 hidden md:block">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider select-none">
                <th className="pb-4 pl-4">Pengguna</th>
                <th className="pb-4">Email</th>
                <th className="pb-4">Peran / Role</th>
                <th className="pb-4 text-right pr-4">Aksi Kontrol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60 font-semibold text-slate-600">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 font-bold font-sans">
                    Tidak ada pengguna yang cocok dengan pencarian Anda.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = u.uid === currentUser.uid;
                  const initials = u.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() || "U";
                  
                  return (
                    <tr key={u.uid} className="hover:bg-teal-50/10 transition-colors group">
                      {/* Avatar & Identitas */}
                      <td className="py-4 pl-4 flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-xs ${
                          u.role === "admin" 
                            ? "bg-gradient-to-br from-cyan-500 to-teal-500 text-white" 
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}>
                          {initials}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span>{u.name}</span>
                            {isSelf && (
                              <span className="text-[9px] uppercase tracking-wider bg-slate-900 text-white px-1.5 py-0.5 rounded-md font-black">
                                Anda
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] font-mono text-slate-400 font-semibold">ID: {u.uid.substring(0, 8)}...</span>
                        </div>
                      </td>

                      {/* Alamat Email */}
                      <td className="py-4 text-slate-500 font-mono text-[11px] font-medium">
                        {u.email}
                      </td>

                      {/* Tingkat Kewenangan (Role) */}
                      <td className="py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          u.role === "admin"
                            ? "bg-cyan-50 text-cyan-600 border border-cyan-100"
                            : "bg-teal-50 text-teal-600 border border-teal-100"
                        }`}>
                          {u.role === "admin" ? (
                            <>
                              <Shield className="w-2.5 h-2.5 text-cyan-500" />
                              <span>Admin</span>
                            </>
                          ) : (
                            <>
                              <Users className="w-2.5 h-2.5 text-teal-500" />
                              <span>Petugas</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Tombol Kontrol / Aksi */}
                      <td className="py-4 text-right pr-4">
                        {isSelf ? (
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider italic pr-2 select-none">
                            Hak Akses Aktif
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-2.5">
                            {/* Tombol Ganti Peran */}
                            <button
                              disabled={loadingId !== null}
                              onClick={() => handleToggleRole(u)}
                              className={`flex items-center gap-1 py-1.5 px-3 rounded-xl text-[10px] font-bold border transition-all cursor-pointer shadow-xs ${
                                u.role === "admin"
                                  ? "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
                                  : "bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border-cyan-200"
                              }`}
                            >
                              <Shield className="w-3 h-3" />
                              <span>{u.role === "admin" ? "Jadikan Petugas" : "Jadikan Admin"}</span>
                            </button>

                            {/* Tombol Reset Kata Sandi */}
                            <button
                              disabled={loadingId !== null}
                              onClick={() => handleResetPassword(u)}
                              className="flex items-center gap-1 py-1.5 px-3 rounded-xl text-[10px] font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all cursor-pointer shadow-xs"
                              title="Kirim email untuk mereset kata sandi petugas"
                            >
                              <Key className="w-3 h-3 text-slate-400" />
                              <span>Reset Sandi</span>
                            </button>

                            {/* Tombol Hapus Akun */}
                            {confirmDeleteId === u.uid ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  disabled={loadingId !== null}
                                  onClick={() => handleDeleteUser(u.uid, u.name)}
                                  className="py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[9px] font-extrabold shadow-sm shadow-red-600/10 cursor-pointer"
                                >
                                  Ya, Hapus
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[9px] font-extrabold border border-slate-250 cursor-pointer"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <button
                                disabled={loadingId !== null}
                                onClick={() => setConfirmDeleteId(u.uid)}
                                className="p-1.5 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-400 hover:text-red-500 rounded-xl transition-all cursor-pointer shadow-xs"
                                title="Hapus Pengguna"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Tampilan Daftar Kartu di Perangkat Mobile */}
        <div className="grid grid-cols-1 gap-4 mb-6 md:hidden">
          {filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-bold font-sans">
              Tidak ada pengguna yang cocok dengan pencarian Anda.
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isSelf = u.uid === currentUser.uid;
              const initials = u.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() || "U";
              
              return (
                <div key={u.uid} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-3">
                  {/* Foto Profil & Identitas Ringkas */}
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-xs ${
                      u.role === "admin" 
                        ? "bg-gradient-to-br from-cyan-500 to-teal-500 text-white" 
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}>
                      {initials}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span>{u.name}</span>
                        {isSelf && (
                          <span className="text-[9px] uppercase tracking-wider bg-slate-900 text-white px-1.5 py-0.5 rounded-md font-black">
                            Anda
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 block mt-0.5">ID: {u.uid.substring(0, 8)}...</span>
                    </div>
                  </div>

                  {/* Rincian Tambahan */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2.5 border-t border-slate-100">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Email</span>
                      <span className="font-mono text-[10px] text-slate-600 break-all">{u.email}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Peran / Role</span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider mt-1 ${
                        u.role === "admin"
                          ? "bg-cyan-50 text-cyan-600 border border-cyan-100"
                          : "bg-teal-50 text-teal-600 border border-teal-100"
                      }`}>
                        {u.role === "admin" ? "Admin" : "Petugas"}
                      </span>
                    </div>
                  </div>

                  {/* Sektor Tombol Kontrol */}
                  <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-100">
                    {isSelf ? (
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider italic select-none">
                        Hak Akses Aktif
                      </span>
                    ) : (
                      <>
                        {/* Tombol Ganti Peran */}
                        <button
                          disabled={loadingId !== null}
                          onClick={() => handleToggleRole(u)}
                          className={`flex items-center gap-1 py-1.5 px-3 rounded-xl text-[10px] font-bold border transition-all cursor-pointer shadow-xs ${
                            u.role === "admin"
                              ? "bg-white hover:bg-slate-50 border-slate-250 text-slate-600"
                              : "bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border-cyan-200"
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          <span>{u.role === "admin" ? "Jadikan Petugas" : "Jadikan Admin"}</span>
                        </button>

                        {/* Tombol Reset Kata Sandi */}
                        <button
                          disabled={loadingId !== null}
                          onClick={() => handleResetPassword(u)}
                          className="flex items-center gap-1 py-1.5 px-3 rounded-xl text-[10px] font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all cursor-pointer shadow-xs"
                          title="Kirim email untuk mereset kata sandi petugas"
                        >
                          <Key className="w-3 h-3 text-slate-400" />
                          <span>Reset Sandi</span>
                        </button>

                        {/* Tombol Hapus Akun */}
                        {confirmDeleteId === u.uid ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              disabled={loadingId !== null}
                              onClick={() => handleDeleteUser(u.uid, u.name)}
                              className="py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[9px] font-extrabold shadow-sm shadow-red-600/10 cursor-pointer"
                            >
                              Ya, Hapus
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[9px] font-extrabold border border-slate-250 cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled={loadingId !== null}
                            onClick={() => setConfirmDeleteId(u.uid)}
                            className="p-1.5 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-400 hover:text-red-500 rounded-xl transition-all cursor-pointer shadow-xs"
                            title="Hapus Pengguna"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Catatan Keselamatan Keamanan */}
      <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl flex gap-3.5">
        <AlertTriangle className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-slate-800">Catatan Keamanan Administrator</h4>
          <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
            Menjadikan pengguna sebagai <strong>Admin / Owner</strong> memberikan hak istimewa penuh untuk menyetujui, mengedit, atau menghapus seluruh log laporan produksi DAMIU, serta mengelola pengguna lain. Pastikan tindakan ini dilakukan secara bertanggung jawab.
          </p>
        </div>
      </div>
    </div>
  );
}
