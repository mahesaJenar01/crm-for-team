param(
  [string]$BaseUrl = 'https://crm-for-team-server.vercel.app'
)

$ErrorActionPreference = 'Stop'
$secureSecret = Read-Host 'BOOTSTRAP_SECRET from Vercel' -AsSecureString
$securePassword = Read-Host 'New master password (12+ characters)' -AsSecureString
$username = Read-Host 'Master username'
$displayName = Read-Host 'Master display name'

function ConvertTo-PlainText([Security.SecureString]$value) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

$payload = @{
  username = $username
  displayName = $displayName
  password = ConvertTo-PlainText $securePassword
} | ConvertTo-Json -Compress

try {
  $result = Invoke-RestMethod -Method Post -Uri "$($BaseUrl.TrimEnd('/'))/api/auth/bootstrap" `
    -ContentType 'application/json' -Headers @{ 'x-bootstrap-secret' = (ConvertTo-PlainText $secureSecret) } `
    -Body $payload
  Write-Host "Master account created: $($result.username)"
  Write-Host 'Next: log in, change the password, then remove BOOTSTRAP_SECRET from Vercel.'
} finally {
  $payload = $null
  $secureSecret.Dispose()
  $securePassword.Dispose()
}
