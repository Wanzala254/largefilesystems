// Create database tables for SQLite
import Database from 'better-sqlite3';

const db = new Database('network-tracker.db');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
console.log('Creating database tables...');

// Users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    createdAt TEXT NOT NULL
  )
`);

// Devices table
db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ip TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unknown',
    lastSeen TEXT,
    latencyMs INTEGER,
    location TEXT,
    createdAt TEXT NOT NULL,
    mac TEXT,
    parentId TEXT,
    FOREIGN KEY (parentId) REFERENCES devices (id)
  )
`);

// Alerts table
db.exec(`
  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    deviceId TEXT,
    deviceName TEXT,
    value INTEGER,
    threshold INTEGER,
    createdAt TEXT NOT NULL,
    acknowledgedAt TEXT,
    resolvedAt TEXT
  )
`);

// Messages table
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    userName TEXT NOT NULL,
    userEmail TEXT,
    ownerUserId TEXT,
    ownerUsername TEXT,
    message TEXT NOT NULL,
    attachmentName TEXT,
    attachmentContentType TEXT,
    attachmentData TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    adminResponse TEXT,
    slaTargetMinutes INTEGER,
    slaDueAt TEXT,
    slaBreached INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    resolvedAt TEXT,
    closedAt TEXT,
    firstResponseAt TEXT,
    estimatedFixTime TEXT
  )
`);

// Events table
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    deviceId TEXT,
    deviceName TEXT,
    severity TEXT NOT NULL,
    timestamp TEXT NOT NULL
  )
`);

// Settings table
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

// Notification preferences table
db.exec(`
  CREATE TABLE IF NOT EXISTS notification_preferences (
    userId TEXT PRIMARY KEY,
    inAppEnabled INTEGER DEFAULT 1,
    emailEnabled INTEGER DEFAULT 1,
    ticketUpdates INTEGER DEFAULT 1,
    alertUpdates INTEGER DEFAULT 1,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
  )
`);

// Audit logs table
db.exec(`
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actorUserId TEXT,
    actorUsername TEXT,
    actorRole TEXT,
    action TEXT NOT NULL,
    targetType TEXT NOT NULL,
    targetId TEXT,
    details TEXT,
    ip TEXT,
    userAgent TEXT,
    createdAt TEXT NOT NULL
  )
`);

// Password resets table
db.exec(`
  CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    tokenHash TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
  )
`);

// Insert default settings
const defaultSettings = [
  ['alertThresholds_latencyMs', '100'],
  ['alertThresholds_downloadMbps', '10'],
  ['alertThresholds_uploadMbps', '5'],
  ['autoRefresh', 'true'],
  ['refreshInterval', '30'],
  ['notifications_email', 'true'],
  ['notifications_browser', 'true'],
  ['topologyMaxDepth', '6'],
  ['ticketSlaHours', '4']
];

const stmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [key, value] of defaultSettings) {
  stmt.run(key, value);
}

console.log('Database tables created successfully!');
db.close();