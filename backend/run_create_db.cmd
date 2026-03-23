@echo off
REM Usage: run_create_db.cmd <rootPassword> <newPassword>
if "%1"=="" (
  echo Please provide root password as first arg
  exit /b 2
)
if "%2"=="" (
  echo Please provide new user password as second arg
  exit /b 2
)
set MYSQL_ROOT_PASSWORD=%1
set NEW_PASSWORD=%2
node "%~dp0create_db.cjs"
