-- =========================================================================
-- SQL SETUP UNTUK DATABASE SUPABASE / POSTGRESQL
-- Aplikasi: DAMIU Health Water (Pemantauan Produksi & Waste Air Minum)
-- =========================================================================
-- 
-- Petunjuk Penggunaan:
-- 1. Buka dashboard proyek Supabase Anda.
-- 2. Navigasi ke menu "SQL Editor" di bilah sebelah kiri.
-- 3. Buat Query Baru (New Query) dan tempelkan (paste) seluruh kode di bawah ini.
-- 4. Klik tombol "Run" untuk menjalankan perintah.
-- 5. Tabel, indeks, dan aturan Row-Level Security (RLS) siap digunakan.
-- =========================================================================

-- ---------------------------------------------------------
-- 1. Tabel: users (Profil Pengguna / Petugas Lapangan)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL,
    uid VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    role VARCHAR NOT NULL DEFAULT 'petugas' CHECK (role IN ('admin', 'petugas')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.users IS 'Menyimpan data profil pengguna dan peranan (admin/petugas).';

-- ---------------------------------------------------------
-- 2. Tabel: production_reports (Laporan Harian Produksi & Waste)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.production_reports (
    report_id VARCHAR PRIMARY KEY,
    date DATE NOT NULL,
    operator VARCHAR NOT NULL,
    operator_uid VARCHAR REFERENCES public.users(uid) ON DELETE SET NULL,
    gallons_used INTEGER NOT NULL CHECK (gallons_used >= 0),
    production_liter NUMERIC NOT NULL CHECK (production_liter >= 0),
    wasted_liter NUMERIC NOT NULL CHECK (wasted_liter >= 0),
    waste_percent NUMERIC NOT NULL CHECK (waste_percent >= 0),
    status VARCHAR NOT NULL CHECK (status IN ('Aman', 'Warning', 'Kritis')),
    approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.production_reports IS 'Menyimpan log harian pengisian galon, volume liter produksi, air terbuang, dan persentase waste.';

-- Indeks untuk mengoptimalkan performa pencarian dan pengurutan
CREATE INDEX IF NOT EXISTS idx_reports_date ON public.production_reports(date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_operator_uid ON public.production_reports(operator_uid);

-- ---------------------------------------------------------
-- 3. Tabel: activity_logs (Log Aktivitas Riil Sistem)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id BIGSERIAL PRIMARY KEY,
    log_id VARCHAR UNIQUE NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    type VARCHAR NOT NULL,
    message TEXT NOT NULL,
    operator VARCHAR NOT NULL,
    operator_uid VARCHAR
);

COMMENT ON TABLE public.activity_logs IS 'Menyimpan catatan riwayat aktivitas sistem, perubahan status, login, dan aksi administratif.';

CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON public.activity_logs(timestamp DESC);


-- =========================================================================
-- KONFIGURASI KEBIJAKAN ROW LEVEL SECURITY (RLS) SUPABASE
-- =========================================================================
-- Catatan: Secara default Supabase mengizinkan pembacaan jika RLS dinonaktifkan.
-- Jika RLS diaktifkan (disarankan), kebijakan di bawah ini akan mengamankan data:

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------
-- Aturan Keamanan untuk Tabel: users
-- ---------------------------------------------------------
CREATE POLICY "Izinkan semua pengguna terautentikasi membaca data profil" 
    ON public.users
    FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Izinkan pengguna mengubah data profilnya sendiri" 
    ON public.users
    FOR UPDATE 
    TO authenticated 
    USING (auth.uid()::text = uid);

CREATE POLICY "Izinkan registrasi pengguna baru" 
    ON public.users
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Izinkan admin menghapus pengguna" 
    ON public.users
    FOR DELETE 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.uid = auth.uid()::text AND users.role = 'admin'
        )
    );

-- ---------------------------------------------------------
-- Aturan Keamanan untuk Tabel: production_reports
-- ---------------------------------------------------------
CREATE POLICY "Izinkan semua pengguna terautentikasi membaca laporan" 
    ON public.production_reports
    FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Izinkan petugas lapangan/admin membuat laporan baru" 
    ON public.production_reports
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Izinkan petugas lapangan mengubah laporannya sendiri atau admin mengubah semua" 
    ON public.production_reports
    FOR UPDATE 
    TO authenticated 
    USING (
        auth.uid()::text = operator_uid OR 
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.uid = auth.uid()::text AND users.role = 'admin'
        )
    );

CREATE POLICY "Izinkan admin menghapus laporan" 
    ON public.production_reports
    FOR DELETE 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.uid = auth.uid()::text AND users.role = 'admin'
        )
    );

-- ---------------------------------------------------------
-- Aturan Keamanan untuk Tabel: activity_logs
-- ---------------------------------------------------------
CREATE POLICY "Izinkan semua pengguna terautentikasi membaca log" 
    ON public.activity_logs
    FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Izinkan sistem mencatat log baru" 
    ON public.activity_logs
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);
