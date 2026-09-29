[CmdletBinding()]
param(
    [ValidateSet('Release', 'RetentionTest', 'CheckSigning')]
    [string]$Mode = 'Release'
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$AppSlug = 'crm-for-team'
$AppName = 'CRM for Team'

function Read-Properties([string]$Path) {
    $values = @{}
    foreach ($line in [IO.File]::ReadAllLines($Path)) {
        $trimmed = $line.Trim()
        if ($trimmed.Length -eq 0 -or $trimmed.StartsWith('#') -or $trimmed.StartsWith('!')) { continue }
        $separator = $trimmed.IndexOf('=')
        if ($separator -lt 1) { throw "Invalid property line in $Path`: $line" }
        $key = $trimmed.Substring(0, $separator).Trim()
        $value = $trimmed.Substring($separator + 1).Trim()
        if ($values.ContainsKey($key)) { throw "Duplicate property '$key' in $Path" }
        $values[$key] = $value
    }
    return $values
}

function Get-Version([string]$Path) {
    if (-not [IO.File]::Exists($Path)) { throw "Missing version file: $Path" }
    $properties = Read-Properties $Path
    if (-not $properties.ContainsKey('versionCode') -or $properties['versionCode'] -notmatch '^[1-9][0-9]*$') {
        throw 'versionCode must be a positive integer.'
    }
    $code = [int64]$properties['versionCode']
    if ($code -ge 2100000000) { throw 'versionCode is too large to increment safely.' }
    if (-not $properties.ContainsKey('versionName') -or $properties['versionName'] -notmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:[-+][0-9A-Za-z.-]+)?$') {
        throw 'versionName must be a semantic version such as 1.0.0.'
    }
    return @{ Code = $code; Name = $properties['versionName'] }
}

function Resolve-Signing([string]$Root) {
    # Use Java Properties, just like Gradle, and actually unlock the private key.
    # Passwords stay in the ignored file; they never appear in command arguments.
    $java = 'java'
    if ($env:JAVA_HOME -and (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
        $java = Join-Path $env:JAVA_HOME 'bin\java.exe'
    }
    & $java (Join-Path $Root 'scripts\CheckSigning.java') $Root
    if ($LASTEXITCODE -ne 0) { throw 'Signing preflight failed. Correct keystore.properties and run run.bat check-signing again.' }
}

function Find-ApkSigner([string]$Root) {
    $sdkCandidates = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT) | Where-Object { $_ }
    $localProperties = Join-Path $Root 'local.properties'
    if ([IO.File]::Exists($localProperties)) {
        $local = Read-Properties $localProperties
        if ($local.ContainsKey('sdk.dir')) { $sdkCandidates += $local['sdk.dir'].Replace('\\:', ':').Replace('\\', '\') }
    }
    foreach ($sdk in $sdkCandidates | Select-Object -Unique) {
        $toolsRoot = Join-Path $sdk 'build-tools'
        if (-not [IO.Directory]::Exists($toolsRoot)) { continue }
        $versions = Get-ChildItem -LiteralPath $toolsRoot -Directory | Sort-Object {
            try { [version]$_.Name } catch { [version]'0.0' }
        } -Descending
        foreach ($version in $versions) {
            foreach ($name in @('apksigner.bat', 'apksigner.exe')) {
                $candidate = Join-Path $version.FullName $name
                if ([IO.File]::Exists($candidate)) { return $candidate }
            }
        }
    }
    throw 'Android apksigner was not found. Install Android SDK Build Tools before making a release.'
}

function Invoke-Retention([string]$Dist, [string]$Slug, [int]$Keep = 3, [string]$Protect = '') {
    $matching = @(Get-ChildItem -LiteralPath $Dist -File -Filter "$Slug-*.apk" | Sort-Object LastWriteTimeUtc -Descending)
    if ($Protect) {
        $protectedPath = [IO.Path]::GetFullPath($Protect)
        $protected = @($matching | Where-Object { $_.FullName -eq $protectedPath })
        $matching = @($protected) + @($matching | Where-Object { $_.FullName -ne $protectedPath })
    }
    if ($matching.Count -le $Keep) { return }

    $remove = @($matching | Select-Object -Skip $Keep)
    # Confirm every old artifact can be opened exclusively before changing any of them.
    foreach ($file in $remove) {
        $stream = $null
        try { $stream = [IO.File]::Open($file.FullName, 'Open', 'ReadWrite', 'None') }
        catch { throw "Cannot prune '$($file.FullName)'. It may be open in another program. $($_.Exception.Message)" }
        finally { if ($stream) { $stream.Dispose() } }
    }

    $backupDir = Join-Path ([IO.Path]::GetTempPath()) ("$Slug-retention-" + [guid]::NewGuid().ToString('N'))
    [IO.Directory]::CreateDirectory($backupDir) | Out-Null
    $deleted = @()
    try {
        foreach ($file in $remove) {
            Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $backupDir $file.Name)
        }
        foreach ($file in $remove) {
            Remove-Item -LiteralPath $file.FullName -Force
            $deleted += $file
        }
        $remaining = @(Get-ChildItem -LiteralPath $Dist -File -Filter "$Slug-*.apk")
        if ($remaining.Count -gt $Keep) { throw "Retention verification failed: $($remaining.Count) matching APKs remain." }
        Remove-Item -LiteralPath $backupDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    catch {
        foreach ($file in $deleted) {
            $backup = Join-Path $backupDir $file.Name
            if ([IO.File]::Exists($backup) -and -not [IO.File]::Exists($file.FullName)) {
                Copy-Item -LiteralPath $backup -Destination $file.FullName
                [IO.File]::SetLastWriteTimeUtc($file.FullName, $file.LastWriteTimeUtc)
            }
        }
        Remove-Item -LiteralPath $backupDir -Recurse -Force -ErrorAction SilentlyContinue
        throw
    }
}

function Test-Retention {
    $testRoot = Join-Path ([IO.Path]::GetTempPath()) ("crm-retention-test-" + [guid]::NewGuid().ToString('N'))
    [IO.Directory]::CreateDirectory($testRoot) | Out-Null
    try {
        foreach ($number in 1..4) {
            $path = Join-Path $testRoot "$AppSlug-1.0.$number-$($number * 10).apk"
            [IO.File]::WriteAllText($path, "dummy $number")
            [IO.File]::SetLastWriteTimeUtc($path, [DateTime]::UtcNow.AddMinutes($number))
        }
        [IO.File]::WriteAllText((Join-Path $testRoot 'another-app-9.9.9-99.apk'), 'unrelated apk')
        [IO.File]::WriteAllText((Join-Path $testRoot 'notes.txt'), 'unrelated file')
        Invoke-Retention $testRoot $AppSlug 3
        $matches = @(Get-ChildItem -LiteralPath $testRoot -File -Filter "$AppSlug-*.apk")
        if ($matches.Count -ne 3) { throw "Expected 3 matching APKs; found $($matches.Count)." }
        if (-not [IO.File]::Exists((Join-Path $testRoot 'another-app-9.9.9-99.apk')) -or -not [IO.File]::Exists((Join-Path $testRoot 'notes.txt'))) {
            throw 'Retention test removed an unrelated file.'
        }
        Write-Host 'PASS: four matching APKs became three; unrelated APK and text file remained.' -ForegroundColor Green
    }
    finally { Remove-Item -LiteralPath $testRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

if ($Mode -eq 'RetentionTest') {
    try { Test-Retention; exit 0 } catch { Write-Error $_; exit 1 }
}

if ($Mode -eq 'CheckSigning') {
    try { Resolve-Signing $ProjectRoot; exit 0 }
    catch { Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red; exit 1 }
}

$versionPath = Join-Path $ProjectRoot 'version.properties'
$originalVersionBytes = $null
$partialPath = $null
$finalPath = $null
$releaseSucceeded = $false

try {
    Set-Location -LiteralPath $ProjectRoot
    $originalVersionBytes = [IO.File]::ReadAllBytes($versionPath)
    $current = Get-Version $versionPath
    $nextCode = $current.Code + 1
    $versionName = $current.Name
    Resolve-Signing $ProjectRoot
    $apkSigner = Find-ApkSigner $ProjectRoot

    $dist = Join-Path $ProjectRoot 'dist'
    [IO.Directory]::CreateDirectory($dist) | Out-Null
    $fileName = "$AppSlug-$versionName-$nextCode.apk"
    $finalPath = Join-Path $dist $fileName
    $partialPath = "$finalPath.partial"
    if ([IO.File]::Exists($finalPath) -or [IO.File]::Exists($partialPath)) {
        throw "Release output already exists and will not be overwritten: $finalPath"
    }

    # Temporarily advance the source of truth so Gradle compiles the incremented code.
    $versionText = "versionCode=$nextCode`r`nversionName=$versionName`r`n"
    [IO.File]::WriteAllText($versionPath, $versionText, [Text.UTF8Encoding]::new($false))

    $gradle = Join-Path $ProjectRoot 'gradlew.bat'
    if (-not [IO.File]::Exists($gradle)) { throw "Missing Gradle wrapper: $gradle" }
    Write-Host "Building signed $AppName $versionName (build $nextCode)..." -ForegroundColor Cyan
    & $gradle --no-daemon clean :app:assembleRelease
    if ($LASTEXITCODE -ne 0) { throw "Gradle release build failed with exit code $LASTEXITCODE." }

    $apkRoot = Join-Path $ProjectRoot 'app\build\outputs\apk\release'
    $apks = @(Get-ChildItem -LiteralPath $apkRoot -File -Filter '*.apk' -ErrorAction Stop |
        Where-Object { $_.Name -notmatch 'unsigned|androidTest' } | Sort-Object LastWriteTimeUtc -Descending)
    if ($apks.Count -eq 0) { throw "No signed release APK was found under $apkRoot." }
    $sourceApk = $apks[0]
    if ($sourceApk.Length -lt 4) { throw "Release APK is empty: $($sourceApk.FullName)" }
    $header = [IO.File]::ReadAllBytes($sourceApk.FullName)[0..1]
    if ($header[0] -ne 0x50 -or $header[1] -ne 0x4B) { throw 'Release output is not a valid APK/ZIP file.' }

    & $apkSigner verify --verbose --print-certs $sourceApk.FullName
    if ($LASTEXITCODE -ne 0) { throw "APK signature verification failed with exit code $LASTEXITCODE." }

    Copy-Item -LiteralPath $sourceApk.FullName -Destination $partialPath
    & $apkSigner verify --verbose $partialPath
    if ($LASTEXITCODE -ne 0) { throw 'Copied APK failed signature verification.' }
    Move-Item -LiteralPath $partialPath -Destination $finalPath

    Invoke-Retention $dist $AppSlug 3 $finalPath
    $finalCount = @(Get-ChildItem -LiteralPath $dist -File -Filter "$AppSlug-*.apk").Count
    if ($finalCount -gt 3) { throw "Retention invariant failed: $finalCount matching APKs remain." }
    if (-not [IO.File]::Exists($finalPath)) { throw 'Retention removed the release produced by this attempt.' }

    $releaseSucceeded = $true
    Write-Host ''
    Write-Host 'Release created successfully.' -ForegroundColor Green
    Write-Host "APK: $([IO.Path]::GetFullPath($finalPath))"
    Write-Host "versionName: $versionName"
    Write-Host "versionCode: $nextCode"
    Write-Host ''
    Write-Host 'Publish next (after checking that the tag does not already exist):'
    Write-Host "gh release create v$versionName `"dist\$fileName`" --title `"v$versionName`" --notes `"$AppName $versionName (build $nextCode)`""
    exit 0
}
catch {
    Write-Host ("ERROR: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
finally {
    if (-not $releaseSucceeded) {
        if ($partialPath -and [IO.File]::Exists($partialPath)) { Remove-Item -LiteralPath $partialPath -Force -ErrorAction SilentlyContinue }
        if ($finalPath -and [IO.File]::Exists($finalPath)) { Remove-Item -LiteralPath $finalPath -Force -ErrorAction SilentlyContinue }
        if ($originalVersionBytes) { [IO.File]::WriteAllBytes($versionPath, $originalVersionBytes) }
        if (($partialPath -and [IO.File]::Exists($partialPath)) -or ($finalPath -and [IO.File]::Exists($finalPath))) {
            Write-Warning 'A failed attempt output could not be removed. Close programs using it and delete it before retrying.'
        }
        Write-Host 'Release failed: version.properties was restored and this attempt produced no dist artifact.' -ForegroundColor Yellow
    }
}
