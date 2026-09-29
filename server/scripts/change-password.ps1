param(
  [string]$BaseUrl = 'https://crm-for-team-server.vercel.app'
)

$ErrorActionPreference = 'Stop'
$username = Read-Host 'Master username'
$current = Read-Host 'Current master password' -AsSecureString
$next = Read-Host 'New master password (12+ characters)' -AsSecureString
$confirmNext = Read-Host 'Repeat the new master password' -AsSecureString

function ConvertTo-PlainText([Security.SecureString]$value) {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

try {
  $newPassword = ConvertTo-PlainText $next
  if ($newPassword -cne (ConvertTo-PlainText $confirmNext)) { throw 'New passwords do not match. Password was not changed.' }
  $loginBody = @{ username = $username; password = (ConvertTo-PlainText $current) } | ConvertTo-Json -Compress
  $login = Invoke-RestMethod -Method Post -Uri "$($BaseUrl.TrimEnd('/'))/api/auth/login" -ContentType 'application/json' -Body $loginBody
  $changeBody = @{ currentPassword = (ConvertTo-PlainText $current); newPassword = $newPassword } | ConvertTo-Json -Compress
  Invoke-RestMethod -Method Post -Uri "$($BaseUrl.TrimEnd('/'))/api/auth/password" -ContentType 'application/json' `
    -Headers @{ Authorization = "Bearer $($login.accessToken)" } -Body $changeBody | Out-Null
  Write-Host 'Password changed. Log in again with the new password.'
} finally {
  $loginBody = $null
  $changeBody = $null
  $newPassword = $null
  $current.Dispose()
  $next.Dispose()
  $confirmNext.Dispose()
}
