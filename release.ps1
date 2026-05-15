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

# ── STEP 1: versione ──────────────────────────────────────────────────────────
Write-Step "1/6" "Preparazione"
Write-Host ""

$newVersion = Read-Host "Inserisci nuova versione (es. 1.4.1)"
if ([string]::IsNullOrWhiteSpace($newVersion)) { Write-Fail "Versione non inserita!" }

Write-Host ""
Write-Host "  Versione : $newVersion"
Write-Host "  Tag      : v$newVersion"
Write-Host ""
$confirm = Read-Host "Confermi? [S/N]"
if ($confirm -ine "S") { Write-Host "`n[ANNULLATO]" -ForegroundColor Yellow; exit 0 }

# ── STEP 2: package.json ──────────────────────────────────────────────────────
Write-Step "2/6" "Aggiornamento package.json"

$pkgPath = Join-Path $PSScriptRoot "package.json"
$pkg = Get-Content $pkgPath -Raw -Encoding UTF8
$pkg = $pkg.TrimStart([char]0xFEFF)
$pkg = $pkg -replace '"version":\s*"[^"]+"', "`"version`": `"$newVersion`""
[System.IO.File]::WriteAllText($pkgPath, $pkg, [System.Text.UTF8Encoding]::new($false))

Write-OK "package.json aggiornato a v$newVersion"

# ── STEP 3: pulizia ───────────────────────────────────────────────────────────
Write-Step "3/6" "Pulizia cartelle"

foreach ($dir in @("dist", "build")) {
    if (Test-Path $dir) {
        Remove-Item $dir -Recurse -Force
        Write-OK "$dir eliminata"
    }
}
Start-Sleep -Seconds 1

# ── STEP 4: build React ───────────────────────────────────────────────────────
Write-Step "4/6" "Build React (1-2 min)..."

npm run build
if ($LASTEXITCODE -ne 0) { Write-Fail "Build React fallita! Controlla gli errori sopra." }

Write-OK "Build React completata"
Start-Sleep -Seconds 1

# ── STEP 5: build Electron (firma inclusa) ────────────────────────────────────
Write-Step "5/6" "Creazione installer (2-3 min)..."

$env:WIN_CSC_KEY_PASSWORD = "CatStream2025!"
npx electron-builder --publish=never
if ($LASTEXITCODE -ne 0) { Write-Fail "Build Electron fallita! Controlla gli errori sopra." }

Write-OK "Installer creato"
Start-Sleep -Seconds 1

# ── STEP 6: verifica output ───────────────────────────────────────────────────
Write-Step "6/6" "Verifica files generati"

$installerName = "CatStreamApp-Setup-$newVersion.exe"
$installerPath = "dist\$installerName"
$ymlPath       = "dist\latest.yml"

if (-not (Test-Path $installerPath)) { Write-Fail "Installer non trovato: $installerPath" }
if (-not (Test-Path $ymlPath))       { Write-Fail "latest.yml non trovato!" }

$sizeMB = [math]::Round((Get-Item $installerPath).Length / 1MB)
Write-OK "Installer: $installerName ($sizeMB MB)"
Write-OK "latest.yml presente"

if ($sizeMB -lt 50) {
    Write-Host "[WARNING] Dimensione insolita (atteso: 90-100 MB)" -ForegroundColor Yellow
}

# ── RISULTATO ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  BUILD COMPLETATO — v$newVersion" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Files pronti in /dist:"
Write-Host "  • $installerName"
Write-Host "  • latest.yml"
Write-Host ""
Write-Host "Prossimi passi:" -ForegroundColor Cyan
Write-Host "  1. Testa: dist\$installerName"
Write-Host "  2. Vai su: https://github.com/Abrason666/mystreamapp/releases"
Write-Host "  3. Draft new release `> Tag: v$newVersion"
Write-Host "  4. Carica i due files `> Publish"
Write-Host ""

$open = Read-Host "Aprire la cartella dist? [S/N]"
if ($open -ieq "S") { Start-Process explorer "dist" }

Write-Host ""
Write-Host "Versione $newVersion — Buona release!" -ForegroundColor Green
Write-Host ""
