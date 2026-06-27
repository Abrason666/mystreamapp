# ============================================
# CATSTREAM RELEASE MANAGER v3.0 (PowerShell)
# ============================================

$host.UI.RawUI.WindowTitle = "CatStream Release Manager"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding            = [System.Text.Encoding]::UTF8
Set-Location $PSScriptRoot

function Write-Step { param($n, $msg) Write-Host "`n[STEP $n] $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg)     Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Fail { param($msg)     Write-Host "`n[ERRORE] $msg" -ForegroundColor Red; Read-Host "`nPremi INVIO per uscire"; exit 1 }

Write-Host ""
Write-Host " ===================================" -ForegroundColor Green
Write-Host "   CATSTREAM RELEASE MANAGER v3.0  " -ForegroundColor Green
Write-Host " ===================================" -ForegroundColor Green
Write-Host ""

# --- STEP 1: versione ---
Write-Step "1/7" "Preparazione"
Write-Host ""

$newVersion = Read-Host "Inserisci nuova versione (es. 1.4.1)"
if ([string]::IsNullOrWhiteSpace($newVersion)) { Write-Fail "Versione non inserita!" }

Write-Host ""
Write-Host "  Versione : $newVersion"
Write-Host "  Tag      : v$newVersion"
Write-Host ""
$confirm = Read-Host "Confermi? [S/N]"
if ($confirm -ine "S") { Write-Host "`n[ANNULLATO]" -ForegroundColor Yellow; exit 0 }

# --- STEP 2: package.json ---
Write-Step "2/7" "Aggiornamento package.json"

$pkgPath = Join-Path $PSScriptRoot "package.json"
$pkg = Get-Content $pkgPath -Raw -Encoding UTF8
$pkg = $pkg.TrimStart([char]0xFEFF)
$pkg = $pkg -replace '"version":\s*"[^"]+"', "`"version`": `"$newVersion`""
[System.IO.File]::WriteAllText($pkgPath, $pkg, [System.Text.UTF8Encoding]::new($false))

Write-OK "package.json aggiornato a v$newVersion"

# --- STEP 3: pulizia ---
Write-Step "3/7" "Pulizia cartelle"

foreach ($dir in @("dist", "build")) {
    if (Test-Path $dir) {
        Remove-Item $dir -Recurse -Force
        Write-OK "$dir eliminata"
    }
}
Start-Sleep -Seconds 1

# --- STEP 4: build React ---
Write-Step "4/7" "Build React (1-2 min)..."

npm run build
if ($LASTEXITCODE -ne 0) { Write-Fail "Build React fallita! Controlla gli errori sopra." }

Write-OK "Build React completata"
Start-Sleep -Seconds 1

# --- STEP 5: build Electron (firma inclusa) ---
Write-Step "5/7" "Creazione installer (2-3 min)..."

$env:WIN_CSC_KEY_PASSWORD = "CatStream2025!"
npx electron-builder --publish=never
if ($LASTEXITCODE -ne 0) { Write-Fail "Build Electron fallita! Controlla gli errori sopra." }

Write-OK "Installer creato"
Start-Sleep -Seconds 1

# --- STEP 6: verifica output ---
Write-Step "6/7" "Verifica files generati"

$installerName = "CatStreamApp-Setup-$newVersion.exe"
$installerPath = Join-Path $PSScriptRoot "dist\$installerName"
$ymlPath       = Join-Path $PSScriptRoot "dist\latest.yml"

if (-not (Test-Path $installerPath)) { Write-Fail "Installer non trovato: $installerPath" }
if (-not (Test-Path $ymlPath))       { Write-Fail "latest.yml non trovato!" }

$sizeMB = [math]::Round((Get-Item $installerPath).Length / 1MB)
Write-OK "Installer: $installerName ($sizeMB MB)"
Write-OK "latest.yml presente"

if ($sizeMB -lt 50) {
    Write-Host "[WARNING] Dimensione insolita (atteso: 90-100 MB)" -ForegroundColor Yellow
}

# --- STEP 7: pacchetto distribuzione ---
Write-Step "7/7" "Preparazione pacchetto distribuzione"

$installFolder = Join-Path $PSScriptRoot "dist\installa"
New-Item -ItemType Directory -Force -Path $installFolder | Out-Null

# Copia installer
Copy-Item $installerPath -Destination $installFolder -Force

# Esporta certificato pubblico (.cer) dal .pfx (nessuna chiave privata)
$pfxPath = Join-Path $PSScriptRoot "certs\AbrasonCert.pfx"
if (-not (Test-Path $pfxPath)) { Write-Fail "Certificato non trovato in certs\AbrasonCert.pfx" }

$cert     = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($pfxPath, $env:WIN_CSC_KEY_PASSWORD)
$cerBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
[System.IO.File]::WriteAllBytes("$installFolder\AbrasonCert.cer", $cerBytes)

# Genera lo script PowerShell di installazione certificato
$ps1Content = @"
`$certPath = Join-Path `$PSScriptRoot 'AbrasonCert.cer'

try {
    `$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2(`$certPath)

    `$rootStore = New-Object System.Security.Cryptography.X509Certificates.X509Store(
        [System.Security.Cryptography.X509Certificates.StoreName]::Root,
        [System.Security.Cryptography.X509Certificates.StoreLocation]::LocalMachine
    )
    `$rootStore.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    `$rootStore.Add(`$cert)
    `$rootStore.Close()

    `$pubStore = New-Object System.Security.Cryptography.X509Certificates.X509Store(
        [System.Security.Cryptography.X509Certificates.StoreName]::TrustedPublisher,
        [System.Security.Cryptography.X509Certificates.StoreLocation]::LocalMachine
    )
    `$pubStore.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    `$pubStore.Add(`$cert)
    `$pubStore.Close()

    Write-Host '[OK] Certificato installato.' -ForegroundColor Green
} catch {
    Write-Host "[ERRORE] `$(`$_.Exception.Message)" -ForegroundColor Red
    Read-Host 'Premi INVIO per uscire'
    exit 1
}
"@
[System.IO.File]::WriteAllText(
    "$installFolder\_installa-cert.ps1",
    $ps1Content,
    [System.Text.UTF8Encoding]::new($false)
)

# Genera il batch di avvio
$batContent = @"
@echo off
title Installazione CatStreamApp v$newVersion
chcp 65001 >nul

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Richiesta privilegi di amministratore...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo  ==========================================
echo   CatStreamApp v$newVersion - Installazione
echo  ==========================================
echo.
echo [1/2] Installazione certificato di sicurezza...
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0_installa-cert.ps1"
if %errorLevel% neq 0 ( pause & exit /b 1 )
echo.
echo [2/2] Avvio installatore...
start "" "%~dp0$installerName"
echo.
echo Installazione avviata. Puoi chiudere questa finestra.
timeout /t 3 /nobreak >nul
"@
[System.IO.File]::WriteAllText(
    "$installFolder\Installa CatStreamApp.bat",
    $batContent,
    [System.Text.UTF8Encoding]::new($false)
)

Write-OK "Pacchetto: dist\installa\  ($installerName + AbrasonCert.cer + Installa CatStreamApp.bat)"

# --- RISULTATO ---
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  BUILD COMPLETATO - v$newVersion" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Per GitHub releases:" -ForegroundColor Cyan
Write-Host "  - dist\$installerName"
Write-Host "  - dist\latest.yml"
Write-Host ""
Write-Host "Per installazione su nuovo PC:" -ForegroundColor Cyan
Write-Host "  - Copia dist\installa\ sulla chiavetta"
Write-Host "  - Sul nuovo PC: doppio click su 'Installa CatStreamApp.bat'"
Write-Host ""
Write-Host "Prossimi passi GitHub:" -ForegroundColor Cyan
Write-Host "  1. Testa: dist\$installerName"
Write-Host "  2. Vai su: https://github.com/Abrason666/mystreamapp/releases"
Write-Host "  3. Draft new release -- Tag: v$newVersion"
Write-Host "  4. Carica i due files -- Publish"
Write-Host ""

$open = Read-Host "Aprire la cartella dist? [S/N]"
if ($open -ieq "S") { Start-Process explorer (Join-Path $PSScriptRoot "dist") }

Write-Host ""
Write-Host "Versione $newVersion - Buona release!" -ForegroundColor Green
Write-Host ""
