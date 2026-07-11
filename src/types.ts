export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: "admin" | "petugas";
}

export interface ProductionReport {
  reportId: string;
  date: string; // YYYY-MM-DD
  operator: string;
  operatorUid: string;
  gallonsUsed: number;
  productionLiter: number; // gallonsUsed * 19
  wastedLiter: number;
  wastePercent: number; // (wastedLiter / productionLiter) * 100
  status: "Aman" | "Warning" | "Kritis";
  approved: boolean;
  createdAt: string;
}

export interface DmaicReport {
  dmaicId: string;
  define: string;
  measure: string;
  analyze: string;
  improve: string;
  control: string;
  createdAt: string;
}

export interface ActivityLog {
  id?: number;
  logId: string;
  timestamp: string;
  type: "info" | "success" | "warning" | "critical" | "admin";
  message: string;
  operator: string;
  operatorUid?: string;
}
