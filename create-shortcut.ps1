# Create Desktop Shortcut for Network Dashboard
$WshShell = New-Object -comObject WScript.Shell
$desktopPath = [Environment]::GetFolderPath('Desktop')
$Shortcut = $WshShell.CreateShortcut("$desktopPath\Network Dashboard.lnk")

# Set the target path to the batch file
$Shortcut.TargetPath = "$PSScriptRoot\start-dashboard.bat"
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.WindowStyle = 7  # Minimized window
$Shortcut.IconLocation = "C:\Windows\System32\imageres.dll,1"
$Shortcut.Description = "Start Network Dashboard Application"
$Shortcut.Save()

Write-Host "Desktop shortcut created successfully!"
Write-Host "You can now double-click 'Network Dashboard' on your desktop to start the application."