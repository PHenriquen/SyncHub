param(
  [string]$Url = 'http://localhost:3000',
  [int]$TimeoutSeconds = 180
)

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)

while ((Get-Date) -lt $deadline) {
  try {
    $response = Invoke-WebRequest -Uri $Url -Method Head -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
      Start-Process $Url
      exit 0
    }
  } catch {
    Start-Sleep -Milliseconds 750
  }
}

exit 1
