# Network Dashboard Windows Service Setup Script
# Run this script as Administrator to install the dashboard as a Windows service

$serviceName = "NetworkDashboard"
$scriptPath = "$PSScriptRoot\start-dashboard.bat"
$servicePath = "C:\Windows\System32\cmd.exe /c `"$scriptPath`""

# Check if service already exists
$existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue

if ($existingService) {
    Write-Host "Service '$serviceName' already exists. Stopping and removing it first..."
    try {
        Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        sc.exe delete $serviceName | Out-Null
        Write-Host "Existing service removed."
    } catch {
        Write-Warning "Could not remove existing service: $_"
    }
}

# Create the service
Write-Host "Creating Windows service '$serviceName'..."
try {
    $result = sc.exe create $serviceName binPath= $servicePath start= auto
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Service created successfully!"
        
        # Set service to start automatically
        sc.exe config $serviceName start= auto | Out-Null
        
        # Start the service
        Write-Host "Starting service..."
        Start-Service -Name $serviceName
        
        Write-Host "Service is now running!"
        Write-Host "You can access the dashboard at: http://localhost:5173"
        Write-Host "Admin credentials: wanzala / wanzala@2026"
    } else {
        Write-Warning "Failed to create service. Error: $result"
    }
} catch {
    Write-Warning "Error creating service: $_"
}

Write-Host ""
Write-Host "Service Management Commands:"
Write-Host "  Start:  Start-Service -Name $serviceName"
Write-Host "  Stop:   Stop-Service -Name $serviceName"
Write-Host "  Status: Get-Service -Name $serviceName"
Write-Host "  Remove: sc.exe delete $serviceName"