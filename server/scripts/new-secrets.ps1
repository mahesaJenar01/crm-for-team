Write-Host 'Copy each value into the matching Vercel Production environment variable.'
Write-Host 'Keep these values private. Never put them in Git or a screenshot.'
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 48
try {
  $rng.GetBytes($bytes)
  Write-Host "JWT_SECRET=$([Convert]::ToBase64String($bytes))"
  $rng.GetBytes($bytes)
  Write-Host "BOOTSTRAP_SECRET=$([Convert]::ToBase64String($bytes))"
} finally {
  [Array]::Clear($bytes, 0, $bytes.Length)
  $rng.Dispose()
}
