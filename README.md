# Remix: DAMIU Hydro-Monitor

DAMIU Hydro-Monitor adalah platform manajemen dan pemantauan sistem pengisian ulang air minum (depo air minum) berbasis web. Aplikasi ini dirancang untuk melacak volume produksi, mengukur persentase air yang terbuang (waste), serta memfasilitasi peningkatan kualitas berkelanjutan dengan metodologi **DMAIC** (Define, Measure, Analyze, Improve, Control).

---

## Fitur Utama

### 1. Pencatatan Produksi dan Efisiensi Air
* **Input Data Produksi**: Petugas dapat mencatat jumlah galon yang digunakan dan volume air terbuang (dalam liter).
* **Kalkulasi Otomatis**: Sistem secara otomatis menghitung volume produksi air (galon × 19 liter) dan persentase air terbuang (*waste percent*).
* **Sistem Peringatan Dinamis**: Status produksi secara otomatis dikategorikan menjadi **Aman**, **Warning**, atau **Kritis** berdasarkan persentase tingkat kebocoran/buangan air.
* **Persetujuan Instan**: Laporan produksi yang dibuat oleh petugas langsung disetujui secara otomatis tanpa memerlukan proses persetujuan manual dari administrator.

### 2. Analisis Kinerja & KPI Petugas
* **Visualisasi Recharts**: Grafik interaktif yang memantau tren produksi dan pemborosan air dari waktu ke waktu.
* **Metrik KPI Utama**: Pemantauan rata-rata kebocoran air, total galon yang diolah, dan total volume produksi bersih.
* **Kontribusi Petugas**: Menampilkan peringkat keaktifan petugas dalam melakukan pelaporan dan menjaga tingkat efisiensi air.

### 3. Modul Manajemen Kualitas DMAIC
* **Siklus Peningkatan**: Formulir khusus untuk mendokumentasikan tahapan analisis kualitas air:
  * **Define**: Menentukan masalah atau sasaran kualitas produksi.
  * **Measure**: Mengukur performa proses produksi saat ini.
  * **Analyze**: Menganalisis penyebab utama tingginya limbah/buangan air.
  * **Improve**: Merencanakan tindakan perbaikan taktis.
  * **Control**: Memastikan perbaikan dipertahankan dalam jangka panjang.

### 4. Manajemen Pengguna Tingkat Lanjut (Khusus Admin)
* **Manajemen Peran**: Mendukung otentikasi multi-peran, memisahkan hak akses antara **Admin** dan **Petugas**.
* **Ubah Password Langsung**: Administrator memiliki kendali penuh untuk mengatur ulang kata sandi pengguna langsung dari dasbor manajemen tanpa perlu mengirimkan tautan konfirmasi email.
* **Pendaftaran & Penghapusan**: Admin dapat mendaftarkan petugas baru atau menonaktifkan akun petugas secara langsung.

### 5. Log Aktivitas Sistem
* Menyimpan rekaman riwayat setiap aksi penting di aplikasi seperti proses login pengguna, pembuatan laporan baru, perubahan profil, dan aktivitas administratif untuk audit operasional.

---

## Arsitektur & Teknologi

* **Frontend**: React 19, TypeScript, dan Vite.
* **Styling**: Tailwind CSS untuk antarmuka modern yang responsif, dikombinasikan dengan pustaka animasi `motion/react`.
* **Icons**: Lucide React.
* **Grafik & Data**: Recharts untuk visualisasi data analitik produksi.
* **Database & Otentikasi**: Supabase (PostgreSQL) sebagai penyedia backend-as-a-service yang menangani otentikasi pengguna, penyimpanan profil, dan tabel data laporan.

---

## Struktur File Proyek

```bash
├── src/
│   ├── components/
│   │   ├── AuthScreen.tsx       # Tampilan Masuk dan Daftar
│   │   ├── Charts.tsx           # Grafik Analitik Produksi & Waste
│   │   ├── DashboardTable.tsx   # Dasbor Utama & Ringkasan Laporan
│   │   ├── HistoryAnalysis.tsx  # Laporan Analisis DMAIC
│   │   ├── HistoryTable.tsx     # Tabel Riwayat Produksi Lengkap
│   │   ├── KPIStats.tsx         # Ringkasan Kinerja & Indikator Kunci
│   │   ├── PetugasKpi.tsx       # Analisis Kinerja Tiap Petugas
│   │   ├── ReportForm.tsx       # Formulir Input Laporan Baru
│   │   ├── Sidebar.tsx          # Navigasi Dasbor Samping
│   │   ├── SystemActivity.tsx   # Audit Log Aktivitas Sistem
│   │   └── UserManagement.tsx   # Panel Administrasi Anggota & Reset Sandi
│   ├── App.tsx                  # Logika Utama Aplikasi & Router
│   ├── supabase.ts              # Konfigurasi Koneksi Supabase SDK
│   ├── types.ts                 # Definisi Tipe Data TypeScript (Interfaces)
│   ├── index.css                # Global CSS & Konfigurasi Tema Tailwind
│   └── main.tsx                 # Entrypoint Aplikasi React
├── package.json                 # Manajemen Dependensi & Skrip Build
├── tsconfig.json                # Konfigurasi Aturan Kompilasi TypeScript
└── vite.config.ts               # Konfigurasi Bundling Vite
```

---

## Langkah Instalasi dan Pengembangan Lokal

### 1. Prasyarat
Pastikan Anda sudah menginstal Node.js (versi 18 ke atas) dan npm di komputer Anda.

### 2. Menginstal Dependensi
Gunakan perintah berikut untuk mengunduh semua pustaka yang diperlukan:
```bash
npm install
```

### 3. Konfigurasi Environment Variables
Buat file bernama `.env` di direktori utama (root) proyek dan tambahkan detail kredensial Supabase Anda:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key
```

### 4. Menjalankan Aplikasi di Mode Pengembangan
Jalankan dev server dengan perintah:
```bash
npm run dev
```
Aplikasi akan dapat diakses di browser melalui alamat `http://localhost:3000`.

### 5. Membangun Aplikasi untuk Produksi
Gunakan skrip kompilasi berikut untuk memproduksi aset siap rilis ke folder `dist/`:
```bash
npm run build
```
