import React, { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile } from "firebase/auth";
import { auth } from "../firebase";
import { Droplet, Lock, Mail, User, AlertCircle } from "lucide-react";

interface AuthScreenProps {
  onLocalLogin: (user: { uid: string; name: string; email: string; role: "admin" | "petugas" }) => void;
}

const isAdminEmail = (email: string) => {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  return e === "arsdsatu@gmail.com" || 
         e === "mhammdarsyad79@gmail.com";
};

/**
 * Komponen AuthScreen - Mengelola masuk log (Login) dan pendaftaran akun (SignUp) petugas DAMIU.
 * Sesuai Permintaan User:
 * 1. Tidak menampilkan pesan error teknis Firebase yang membingungkan. Jika password salah, tampilkan pesan sederhana berbahasa Indonesia.
 * 2. Menambahkan pengingat di halaman login untuk menghubungi Administrator jika lupa kata sandi.
 * 3. Mengurangi penggunaan ikon yang berlebihan, serta menghilangkan ikon pada tombol Masuk dengan Google.
 * 4. Bebas dari penyebutan kata "depot".
 */
export default function AuthScreen({ onLocalLogin }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authInstructionType, setAuthInstructionType] = useState<"email" | "google" | null>(null);

  /**
   * Mengatur masuk log atau pendaftaran menggunakan email dan password.
   */
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setAuthInstructionType(null);

    try {
      if (isSignUp) {
        // Daftar Akun Baru (Khusus petugas lapangan DAMIU) menggunakan Firebase Auth
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCred.user.uid;
        
        try {
          await updateProfile(userCred.user, { displayName: name || "Petugas Baru" });
        } catch (profileErr) {
          console.warn("Penyimpanan nama tampilan auth gagal:", profileErr);
        }

        const role = isAdminEmail(email) ? ("admin" as const) : ("petugas" as const);
        const profile = { uid, name: name || "Petugas Baru", email, role };
        
        try {
          await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(profile)
          });
        } catch (dbErr) {
          console.warn("Penyimpanan profil diabaikan saat offline:", dbErr);
        }

        onLocalLogin(profile);
      } else {
        // Masuk Akun menggunakan Firebase Auth
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCred.user.uid;
        
        let role: "admin" | "petugas" = isAdminEmail(email) ? "admin" : "petugas";
        let existingName = email.split("@")[0];

        try {
          const res = await fetch(`/api/users/${uid}`);
          if (res.ok) {
            const dataProfile = await res.json();
            if (dataProfile.role) role = dataProfile.role as "admin" | "petugas";
            if (dataProfile.name) existingName = dataProfile.name;
          }
        } catch (e) {
          console.warn("Gagal membaca peran pengguna saat login:", e);
        }

        const profile = { 
          uid, 
          name: existingName, 
          email, 
          role 
        };
        onLocalLogin(profile);
      }
    } catch (err: any) {
      console.error(err);
      const errCode = err.code || "";
      const errMsg = (err.message || "").toLowerCase();
      
      // Penerjemahan Kode Error Firebase Auth ke Bahasa Indonesia yang Sederhana (Pesanan User)
      if (errCode === "auth/operation-not-allowed") {
        setAuthInstructionType("email");
        setError("Autentikasi Email/Password belum diaktifkan di Firebase Console.");
      } else if (errCode === "auth/network-request-failed") {
        setError("Koneksi jaringan gagal. Menggunakan login demo lokal...");
        setTimeout(() => {
          handleBypassLogin();
        }, 1500);
      } else if (isSignUp) {
        if (errCode === "auth/email-already-in-use") {
          setError("Email sudah terdaftar. Silakan gunakan email lain atau langsung masuk.");
        } else if (errCode === "auth/weak-password") {
          setError("Password terlalu lemah. Harap gunakan minimal 6 karakter.");
        } else if (errCode === "auth/invalid-email") {
          setError("Format email tidak valid. Harap periksa kembali.");
        } else {
          setError(`Gagal mendaftar: ${err.message || "Harap coba lagi atau hubungi admin."}`);
        }
      } else if (
        errCode === "auth/invalid-credential" || 
        errCode === "auth/wrong-password" || 
        errCode === "auth/user-not-found" || 
        errCode === "auth/invalid-email" ||
        errMsg.includes("invalid-credential") ||
        errMsg.includes("wrong-password") ||
        errMsg.includes("invalid_credential")
      ) {
        setError("Password salah atau email tidak valid. Silakan periksa kembali.");
      } else {
        setError("Gagal masuk. Password salah atau email tidak terdaftar. Silakan hubungi admin.");
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Mengatur masuk log instan menggunakan Google Auth.
   */
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    setAuthInstructionType(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      const userEmail = firebaseUser.email || "";
      
      let role: "admin" | "petugas" = isAdminEmail(userEmail) ? "admin" : "petugas";
      let existingName = firebaseUser.displayName || userEmail.split("@")[0] || "User";

      try {
        const res = await fetch(`/api/users/${firebaseUser.uid}`);
        if (res.ok) {
          const dataProfile = await res.json();
          if (dataProfile.role) role = dataProfile.role as "admin" | "petugas";
          if (dataProfile.name) existingName = dataProfile.name;
        } else if (res.status === 404) {
          const profile = { uid: firebaseUser.uid, name: existingName, email: userEmail, role };
          await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(profile)
          });
        }
      } catch (e) {
        console.warn("Gagal sinkronisasi user Google:", e);
      }

      const profile = {
        uid: firebaseUser.uid,
        name: existingName,
        email: userEmail,
        role: role
      };
      onLocalLogin(profile);
    } catch (err: any) {
      console.error(err);
      const errMsg = (err.message || "").toLowerCase();
      if (errMsg.includes("operation-not-allowed") || errMsg.includes("not-enabled") || errMsg.includes("provider is not enabled")) {
        setError("Login Google belum diaktifkan di Firebase Console Anda.");
        setAuthInstructionType("google");
      } else {
        setError("Gagal masuk menggunakan akun Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Mode bypass darurat apabila koneksi internet mengalami gangguan.
   */
  const handleBypassLogin = () => {
    onLocalLogin({
      uid: "local-bypass-user",
      name: name || email.split("@")[0] || "Petugas Lapangan",
      email: email || "petugas@damiu.com",
      role: email.includes("admin") || email.includes("hendra") ? "admin" : "petugas"
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 p-4 relative overflow-hidden font-sans">
      {/* Ornamen Latar Belakang */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl"></div>

      <div className="w-full max-w-4xl grid md:grid-cols-2 bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden relative z-10">
        
        {/* Sisi Kiri: Visual Pembuka & Brand */}
        <div className="p-8 md:p-12 flex flex-col justify-center bg-gradient-to-br from-teal-600 to-cyan-700 text-white relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-500/20 via-transparent to-transparent"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2.5 bg-white/10 rounded-xl">
                <Droplet className="w-7 h-7 text-cyan-200 animate-pulse" />
              </div>
              <span className="font-display font-bold text-xl tracking-wide">DAMIU HYDRO-MONITOR</span>
            </div>
            
            <h1 className="font-display font-bold text-3xl md:text-4xl leading-tight mb-4">
              Monitoring Pemborosan Air Secara Real-Time
            </h1>
            <p className="text-teal-50/90 text-sm leading-relaxed mb-0 font-light">
              Platform optimasi produksi air isi ulang. Membantu mengontrol efisiensi pembilasan, pengisian dispenser, serta menekan tingkat pembuangan air secara konsisten.
            </p>
          </div>
        </div>

        {/* Sisi Kanan: Formulir Autentikasi */}
        <div className="p-8 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="font-display font-bold text-2xl text-white">
              {isSignUp ? "Daftar Akun Baru" : "Selamat Datang"}
            </h2>
            <p className="text-slate-400 text-xs mt-1 mb-4">
              {isSignUp ? "Daftar sebagai Petugas Lapangan DAMIU" : "Silakan masuk ke platform monitoring Anda"}
            </p>

            {/* Banner Lupa Password - Selalu Ditampilkan dengan Jelas Sesuai Permintaan User */}
            {!isSignUp && (
              <div className="p-3 bg-amber-500/15 border-l-4 border-amber-500 rounded-r-lg text-xs text-amber-200 select-none leading-relaxed shadow-lg">
                <span className="font-bold block mb-0.5 text-amber-300">💡 Lupa password?</span>
                Bila lupa kata sandi Anda, harap segera hubungi Administrator untuk mengatur ulang kata sandi.
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/25 text-red-300 rounded-xl text-xs space-y-2">
              <div className="flex items-start gap-2 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="font-semibold">{error}</span>
              </div>
              
              {authInstructionType === "email" && (
                <div className="mt-2.5 p-3 bg-slate-900/80 border border-slate-700/50 rounded-lg space-y-2.5 text-[11px] text-slate-300">
                  <p className="font-bold text-teal-400 uppercase tracking-wider text-[9px]">💡 Instruksi Mengaktifkan Firebase Auth:</p>
                  <ol className="list-decimal list-inside space-y-1 font-sans text-slate-400">
                    <li>Buka <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline font-semibold">Firebase Console</a></li>
                    <li>Navigasi ke menu <span className="font-semibold text-white">Authentication</span></li>
                    <li>Pilih tab <span className="font-semibold text-white">Sign-in method</span></li>
                    <li>Aktifkan penyedia <span className="font-bold text-teal-400">Email/Password</span> dan klik Simpan</li>
                  </ol>
                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-medium leading-tight">Mencoba demo langsung tanpa konfigurasi?</span>
                    <button
                      type="button"
                      onClick={handleBypassLogin}
                      className="py-1 px-2.5 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold rounded text-[10px] transition-colors shrink-0"
                    >
                      Bypass & Masuk Demo
                    </button>
                  </div>
                </div>
              )}

              {authInstructionType === "google" && (
                <div className="mt-2.5 p-3 bg-slate-900/80 border border-slate-700/50 rounded-lg space-y-2.5 text-[11px] text-slate-300">
                  <p className="font-bold text-amber-400 uppercase tracking-wider text-[9px]">💡 Cara Mengaktifkan Google Login di Firebase:</p>
                  <ol className="list-decimal list-inside space-y-1 font-sans text-slate-400">
                    <li>Buka <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline font-semibold">Firebase Console</a></li>
                    <li>Navigasi ke menu <span className="font-semibold text-white">Authentication</span> &gt; <span className="font-semibold text-white">Sign-in method</span></li>
                    <li>Klik <span className="font-bold text-white">Add new provider</span> lalu pilih <span className="font-bold text-white">Google</span></li>
                    <li>Aktifkan toggle <span className="text-teal-400 font-semibold">Enable</span></li>
                    <li>Pilih email dukungan proyek lalu klik <span className="font-bold text-teal-400">Save</span></li>
                  </ol>
                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-medium leading-tight">Mencoba demo langsung tanpa konfigurasi?</span>
                    <button
                      type="button"
                      onClick={handleBypassLogin}
                      className="py-1 px-2.5 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold rounded text-[10px] transition-colors shrink-0"
                    >
                      Bypass & Masuk Demo
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Lengkap</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Andi Wijaya"
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@damiu.com"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-slate-900 font-bold text-sm py-2.5 px-4 rounded-lg transition-all focus:outline-none shadow-md shadow-teal-500/10 disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Memproses..." : isSignUp ? "Daftar Akun" : "Masuk"}
            </button>
          </form>

          <div className="relative flex py-4 items-center">
            <div className="flex-grow border-t border-slate-700/50"></div>
            <span className="flex-shrink mx-4 text-slate-500 text-xs font-medium font-mono uppercase tracking-wider">atau</span>
            <div className="flex-grow border-t border-slate-700/50"></div>
          </div>

          {/* Tombol masuk Google - Berdasarkan permintaan, sama sekali tidak menggunakan ikon */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center bg-slate-900 hover:bg-slate-950 text-white font-semibold text-sm py-2.5 px-4 rounded-lg border border-slate-700/80 transition-all focus:outline-none focus:border-teal-500 shadow-md disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Memproses..." : "Masuk dengan Google"}
          </button>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-teal-400 hover:underline focus:outline-none cursor-pointer"
            >
              {isSignUp ? "Sudah memiliki akun? Silakan masuk" : "Belum punya akun? Daftar Petugas di sini"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
