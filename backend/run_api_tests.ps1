$base = 'http://localhost:3001'
$body = @{ username = 'tester01'; password = 'TestPass123!' }

try {
  $signup = Invoke-RestMethod -Method Post -Uri "$base/api/signup" -Body ($body | ConvertTo-Json) -ContentType 'application/json' -ErrorAction Stop
  $signup | ConvertTo-Json -Depth 5 | Out-File -FilePath "test_signup.json" -Encoding utf8
  Write-Output "Signup successful"
} catch {
  Write-Output "Signup failed, attempting login: $($_.Exception.Message)"
  try {
    $login = Invoke-RestMethod -Method Post -Uri "$base/api/login" -Body ($body | ConvertTo-Json) -ContentType 'application/json' -ErrorAction Stop
    $login | ConvertTo-Json -Depth 5 | Out-File -FilePath "test_signup.json" -Encoding utf8
    $signup = $login
    Write-Output "Login successful"
  } catch {
    Write-Output "Login also failed: $($_.Exception.Message)"
    # Save error
    $err = @{ error = $($_.Exception.Message) }
    $err | ConvertTo-Json | Out-File -FilePath "test_signup.json" -Encoding utf8
    exit 2
  }
}

$token = $signup.token
if (-not $token) {
  Write-Output "No token returned; saved signup/login response to test_signup.json"
  exit 2
}

try {
  $me = Invoke-RestMethod -Method Get -Uri "$base/api/me" -Headers @{ Authorization = "Bearer $token" } -ErrorAction Stop
  $me | ConvertTo-Json -Depth 5 | Out-File -FilePath "test_me.json" -Encoding utf8
  Write-Output "Fetched /api/me"
} catch {
  Write-Output "Failed to call /api/me: $($_.Exception.Message)"
  $err = @{ error = $($_.Exception.Message) }
  $err | ConvertTo-Json | Out-File -FilePath "test_me.json" -Encoding utf8
  exit 2
}

Write-Output "Wrote test_signup.json and test_me.json in $(Get-Location)"
