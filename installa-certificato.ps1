# ============================================
# CATSTREAM — Installazione certificato
# ============================================
# Deve essere eseguito come Amministratore.
# ============================================

$host.UI.RawUI.WindowTitle = "CatStream - Installa Certificato"

# Verifica privilegi amministratore
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host ""
    Write-Host "  ATTENZIONE: questo script deve essere eseguito come Amministratore." -ForegroundColor Red
    Write-Host ""
    Write-Host "  Fai clic destro su 'installa-certificato.bat' e scegli" -ForegroundColor Yellow
    Write-Host "  'Esegui come amministratore', poi riprova." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Premi INVIO per uscire"
    exit 1
}

Write-Host ""
Write-Host " ===================================" -ForegroundColor Cyan
Write-Host "   CATSTREAM - Installa Certificato " -ForegroundColor Cyan
Write-Host " ===================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Questo script installa il certificato necessario" -ForegroundColor White
Write-Host "  per eseguire CatStreamApp senza avvisi di Windows." -ForegroundColor White
Write-Host ""

# Cerca il certificato nella stessa cartella dello script
$certPath = Join-Path $PSScriptRoot "AbrasonCert.pfx"

if (-not (Test-Path $certPath)) {
    Write-Host "[ERRORE] File AbrasonCert.pfx non trovato nella stessa cartella." -ForegroundColor Red
    Write-Host "         Assicurati che AbrasonCert.pfx sia nella stessa cartella di questo script." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Premi INVIO per uscire"
    exit 1
}

Write-Host "  Certificato trovato. Installazione in corso..." -ForegroundColor White
Write-Host ""

try {
    # Chiedi la password del certificato
    $password = Read-Host "  Inserisci la password del certificato" -AsSecureString

    # Importa nelle Autorità di Certificazione Radice Attendibili (macchina locale)
    $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2(
        $certPath,
        $password,
        [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::MachineKeySet
    )

    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store(
        [System.Security.Cryptography.X509Certificates.StoreName]::Root,
        [System.Security.Cryptography.X509Certificates.StoreLocation]::LocalMachine
    )
    $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
    $store.Add($cert)
    $store.Close()

    Write-Host ""
    Write-Host " ===================================" -ForegroundColor Green
    Write-Host "   CERTIFICATO INSTALLATO OK       " -ForegroundColor Green
    Write-Host " ===================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Ora puoi installare CatStreamApp senza avvisi." -ForegroundColor White
    Write-Host "  Fai doppio click su CatStreamApp-Setup-2.0.0.exe" -ForegroundColor White
    Write-Host ""

} catch {
    Write-Host ""
    Write-Host "[ERRORE] Installazione fallita: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "         Verifica che la password sia corretta." -ForegroundColor Yellow
    Write-Host ""
}

Read-Host "Premi INVIO per uscire"
