# ============================================
# CATSTREAM DEV SETUP
# ============================================

$host.UI.RawUI.WindowTitle = "CatStream Dev Setup"
Set-Location $PSScriptRoot

function Write-Step { param($n, $msg) Write-Host "`n[STEP $n] $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg)     Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Fail { param($msg)     Write-Host "`n[ERRORE] $msg" -ForegroundColor Red; Read-Host "Premi INVIO per uscire"; exit 1 }

Write-Host ""
Write-Host " ===================================" -ForegroundColor Cyan
Write-Host "   CATSTREAM DEV SETUP             " -ForegroundColor Cyan
Write-Host " ===================================" -ForegroundColor Cyan
Write-Host ""

# ── STEP 1: Node.js ───────────────────────────────────────────────────────────
Write-Step "1/4" "Verifica Node.js"

try {
    $nodeVersion = node --version 2>&1
    Write-OK "Node.js trovato: $nodeVersion"
} catch {
    Write-Fail "Node.js non trovato. Installalo da https://nodejs.org (versione LTS)"
}

# ── STEP 2: npm install ───────────────────────────────────────────────────────
Write-Step "2/4" "Installazione dipendenze npm..."

npm install
if ($LASTEXITCODE -ne 0) { Write-Fail "npm install fallito." }
Write-OK "Dipendenze installate"

# ── STEP 3: file .env ────────────────────────────────────────────────────────
Write-Step "3/4" "Configurazione .env"

$envPath = Join-Path $PSScriptRoot ".env"

if (Test-Path $envPath) {
    Write-OK ".env gia presente, salto"
} else {
    Write-Host ""
    Write-Host "  Serve la chiave API di TMDB." -ForegroundColor Yellow
    Write-Host "  Ottienila su: https://www.themoviedb.org/settings/api" -ForegroundColor Yellow
    Write-Host ""
    $apiKey = Read-Host "Incolla la tua TMDB API Key"

    if ([string]::IsNullOrWhiteSpace($apiKey)) {
        Write-Host "[WARNING] Nessuna chiave inserita - il file .env non verra creato." -ForegroundColor Yellow
        Write-Host "          Crealo manualmente: REACT_APP_TMDB_API_KEY=la_tua_chiave" -ForegroundColor Yellow
    } else {
        [System.IO.File]::WriteAllText($envPath, "REACT_APP_TMDB_API_KEY=$apiKey`n", [System.Text.UTF8Encoding]::new($false))
        Write-OK ".env creato"
    }
}

# ── STEP 4: certificato ───────────────────────────────────────────────────────
Write-Step "4/4" "Verifica certificato firma (solo per build/release)"

$certPath = "C:\AbrasonCert.pfx"
if (Test-Path $certPath) {
    Write-OK "Certificato trovato in C:\AbrasonCert.pfx"
} else {
    Write-Host "[WARNING] Certificato non trovato in C:\AbrasonCert.pfx" -ForegroundColor Yellow
    Write-Host "          Copia il file AbrasonCert.pfx in C:\ per poter fare release firmate." -ForegroundColor Yellow
}

# ── RISULTATO ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  SETUP COMPLETATO" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Per avviare in sviluppo, apri DUE terminali:"
Write-Host ""
Write-Host "  Terminale 1:  npm start" -ForegroundColor White
Write-Host "  Terminale 2:  npm run electron-dev" -ForegroundColor White
Write-Host ""
Write-Host "Per fare una release:"
Write-Host "  Lancia release.bat" -ForegroundColor White
Write-Host ""
