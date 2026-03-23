-- Create database network_tracker if it doesn't exist
IF DB_ID(N'[network_tracker]') IS NULL
BEGIN
  CREATE DATABASE [network_tracker];
END
GO

-- Create server login nt_user if it doesn't exist
IF NOT EXISTS (
  SELECT 1
  FROM sys.server_principals
  WHERE name = N'[nt_user]'
)
BEGIN
  CREATE LOGIN [nt_user]
  WITH PASSWORD = N'Wanzala@8728!', 
       CHECK_POLICY = OFF,
       DEFAULT_DATABASE = [master];
END
GO

-- Switch to database and create user
USE [network_tracker];
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.database_principals
  WHERE name = N'[nt_user]'
)
BEGIN
  CREATE USER [nt_user] FOR LOGIN [nt_user];
END
GO

-- Grant db_owner role
ALTER ROLE [db_owner] ADD MEMBER [nt_user];
GO

PRINT 'Database setup complete for network_tracker with nt_user.';

