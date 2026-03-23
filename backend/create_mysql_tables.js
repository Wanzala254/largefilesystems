import mysql from 'mysql2/promise'

async function main() {
  const host = process.env.MYSQL_HOST || 'localhost'
  const user = process.env.MYSQL_USER || 'Wanzala'
  const password = process.env.MYSQL_PASSWORD
  const database = process.env.MYSQL_DATABASE || 'network_tracker'

  if (!password) {
    console.error('Please provide MYSQL_PASSWORD in env')
    process.exit(2)
  }

  const connection = await mysql.createConnection({
    host,
    user,
    password,
    database,
    multipleStatements: true,
  })

  const ddl = `
    CREATE TABLE IF NOT EXISTS devices (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      ip VARCHAR(45) NOT NULL UNIQUE,
      mac VARCHAR(64),
      parentId VARCHAR(64),
      type VARCHAR(64) NOT NULL,
      status VARCHAR(64) NOT NULL,
      lastSeen VARCHAR(64) NOT NULL,
      latencyMs DOUBLE,
      location VARCHAR(255),
      createdAt VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS alerts (
      id VARCHAR(64) PRIMARY KEY,
      type VARCHAR(64) NOT NULL,
      severity VARCHAR(64) NOT NULL,
      status VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      deviceId VARCHAR(64),
      deviceName VARCHAR(255),
      value DOUBLE,
      threshold DOUBLE,
      createdAt VARCHAR(64) NOT NULL,
      acknowledgedAt VARCHAR(64),
      resolvedAt VARCHAR(64)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS messages (
      id VARCHAR(64) PRIMARY KEY,
      userName VARCHAR(255) NOT NULL,
      userEmail VARCHAR(255),
      ownerUserId VARCHAR(64),
      ownerUsername VARCHAR(255),
      message TEXT NOT NULL,
      attachmentName VARCHAR(255),
      attachmentContentType VARCHAR(255),
      attachmentData MEDIUMTEXT,
      status VARCHAR(64) NOT NULL,
      adminResponse TEXT,
      estimatedFixTime VARCHAR(64),
      slaTargetMinutes INT,
      slaDueAt VARCHAR(64),
      firstResponseAt VARCHAR(64),
      resolvedAt VARCHAR(64),
      closedAt VARCHAR(64),
      slaBreached TINYINT(1) NOT NULL DEFAULT 0,
      createdAt VARCHAR(64) NOT NULL,
      updatedAt VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS events (
      id VARCHAR(64) PRIMARY KEY,
      type VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      deviceId VARCHAR(64),
      deviceName VARCHAR(255),
      severity VARCHAR(64) NOT NULL,
      timestamp VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS traffic_samples (
      id INT AUTO_INCREMENT PRIMARY KEY,
      timestamp VARCHAR(64) NOT NULL UNIQUE,
      bytesIn BIGINT NOT NULL,
      bytesOut BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS speed_samples (
      id INT AUTO_INCREMENT PRIMARY KEY,
      timestamp VARCHAR(64) NOT NULL UNIQUE,
      downloadMbps DOUBLE NOT NULL,
      uploadMbps DOUBLE NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS settings (
      \`key\` VARCHAR(128) PRIMARY KEY,
      \`value\` TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      passwordHash VARCHAR(255) NOT NULL,
      role VARCHAR(64) NOT NULL,
      createdAt VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS password_resets (
      id VARCHAR(64) PRIMARY KEY,
      userId VARCHAR(64) NOT NULL,
      tokenHash VARCHAR(255) NOT NULL,
      expiresAt VARCHAR(64) NOT NULL,
      used TINYINT(1) NOT NULL DEFAULT 0,
      createdAt VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS notification_preferences (
      userId VARCHAR(64) PRIMARY KEY,
      inAppEnabled TINYINT(1) NOT NULL DEFAULT 1,
      emailEnabled TINYINT(1) NOT NULL DEFAULT 1,
      ticketUpdates TINYINT(1) NOT NULL DEFAULT 1,
      alertUpdates TINYINT(1) NOT NULL DEFAULT 1,
      updatedAt VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(64) PRIMARY KEY,
      actorUserId VARCHAR(64),
      actorUsername VARCHAR(255),
      actorRole VARCHAR(64),
      action VARCHAR(255) NOT NULL,
      targetType VARCHAR(255),
      targetId VARCHAR(64),
      details TEXT,
      ip VARCHAR(64),
      userAgent TEXT,
      createdAt VARCHAR(64) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE INDEX idx_alerts_device ON alerts(deviceId);
    CREATE INDEX idx_alerts_status ON alerts(status);
    CREATE INDEX idx_events_device ON events(deviceId);
    CREATE INDEX idx_events_timestamp ON events(timestamp);
    CREATE INDEX idx_messages_status ON messages(status);
    CREATE INDEX idx_traffic_timestamp ON traffic_samples(timestamp);
    CREATE INDEX idx_speed_timestamp ON speed_samples(timestamp);
    CREATE INDEX idx_password_resets_user ON password_resets(userId);
    CREATE INDEX idx_password_resets_token ON password_resets(tokenHash);
    CREATE INDEX idx_audit_logs_created_at ON audit_logs(createdAt);
    CREATE INDEX idx_audit_logs_actor_user ON audit_logs(actorUserId);
    CREATE INDEX idx_audit_logs_action ON audit_logs(action);
  `

  try {
    await connection.query(ddl)
    console.log('MySQL tables created or already exist.')
  } catch (err) {
    console.error('Error creating tables:', err.message || err)
    process.exit(1)
  } finally {
    await connection.end()
  }
}

main()
