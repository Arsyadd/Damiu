import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean, real } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  role: text('role').notNull().default('petugas'), // 'admin' | 'petugas'
  createdAt: timestamp('created_at').defaultNow(),
});

export const productionReports = pgTable('production_reports', {
  id: serial('id').primaryKey(),
  reportId: text('report_id').notNull().unique(),
  date: text('date').notNull(), // YYYY-MM-DD
  operator: text('operator').notNull(),
  operatorUid: text('operator_uid').notNull(),
  gallonsUsed: integer('gallons_used').notNull(),
  productionLiter: integer('production_liter').notNull(),
  wastedLiter: integer('wasted_liter').notNull(),
  wastePercent: real('waste_percent').notNull(),
  status: text('status').notNull(), // 'Aman' | 'Warning' | 'Kritis'
  approved: boolean('approved').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  reports: many(productionReports),
}));

export const productionReportsRelations = relations(productionReports, ({ one }) => ({
  operatorUser: one(users, {
    fields: [productionReports.operatorUid],
    references: [users.uid],
  }),
}));

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  logId: text('log_id').notNull().unique(),
  timestamp: timestamp('timestamp').defaultNow(),
  type: text('type').notNull(), // 'info' | 'success' | 'warning' | 'critical' | 'admin'
  message: text('message').notNull(),
  operator: text('operator').notNull(),
  operatorUid: text('operator_uid'),
});

