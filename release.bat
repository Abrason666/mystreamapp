@echo off
REM ============================================
REM CATSTREAM RELEASE AUTOMATION SCRIPT
REM Versione: 2.0
REM Autore: Claude AI Assistant
REM Data: 21 Dicembre 2025
REM ============================================

SETLOCAL EnableDelayedExpansion

REM Colori (funziona solo su Windows 10+)
color 0A

REM Logo ASCII
echo.
echo  ===================================
echo   CATSTREAM RELEASE MANAGER v2.0
echo  ===================================
echo.

REM ============================================
REM STEP 1: RICHIESTA VERSIONE
REM ============================================
echo [STEP 1/7] Preparazione
echo.
set /p NEW_VERSION="Inserisci nuova versione (es. 1.1.7): "

REM Validazione input
if "%NEW_VERSION%"=="" (
    echo.
    echo [ERRORE] Versione non inserita!
    pause
    exit /b 1
)

echo.
echo Nuova versione: %NEW_VERSION%
echo Tag GitHub: v%NEW_VERSION%
echo.
set /p CONFIRM="Confermi? (S/N): "

if /i not "%CONFIRM%"=="S" (
    echo.
    echo [ANNULLATO] Operazione annullata dall'utente.
    pause
    exit /b 0
)

REM ============================================
REM STEP 2: MODIFICA PACKAGE.JSON
REM ============================================
echo.
echo [STEP 2/7] Aggiornamento package.json...
echo.

REM IMPORTANTE: Questo script NON modifica automaticamente package.json
REM perche' richiederebbe PowerShell o strumenti esterni.
REM L'utente DEVE farlo manualmente!

echo ATTENZIONE: Devi modificare MANUALMENTE package.json!
echo.
echo Apri: package.json
echo Cambia: "version": "%NEW_VERSION%"
echo Salva il file!
echo.
echo Premi un tasto DOPO aver modificato package.json...
pause >nul

REM Verifica che l'utente abbia capito
echo.
set /p MODIFIED="Hai modificato package.json? (S/N): "

if /i not "%MODIFIED%"=="S" (
    echo.
    echo [ERRORE] Devi modificare package.json prima di continuare!
    echo.
    pause
    exit /b 1
)

REM ============================================
REM STEP 3: PULIZIA
REM ============================================
echo.
echo [STEP 3/7] Pulizia cartelle...
echo.

if exist dist (
    echo Eliminazione dist...
    rmdir /s /q dist
    echo [OK] dist eliminata
)

if exist build (
    echo Eliminazione build...
    rmdir /s /q build
    echo [OK] build eliminata
)

echo.
echo [OK] Pulizia completata!
timeout /t 2 >nul

REM ============================================
REM STEP 4: BUILD REACT
REM ============================================
echo.
echo [STEP 4/7] Build React...
echo.
echo Questo richiedera' 1-2 minuti...
echo.

call npm run build

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERRORE] Build React fallita!
    echo Controlla gli errori sopra.
    pause
    exit /b 1
)

echo.
echo [OK] Build React completata!
timeout /t 2 >nul

REM ============================================
REM STEP 5: BUILD ELECTRON
REM ============================================
echo.
echo [STEP 5/7] Creazione installer...
echo.
echo Questo richiedera' 2-3 minuti...
echo.

call npm run dist

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERRORE] Build Electron fallita!
    echo Controlla gli errori sopra.
    pause
    exit /b 1
)

echo.
echo [OK] Installer creato!
timeout /t 2 >nul

REM ============================================
REM STEP 6: VERIFICA FILES
REM ============================================
echo.
echo [STEP 6/7] Verifica files generati...
echo.

set "INSTALLER_NAME=CatStreamApp-Setup-%NEW_VERSION%.exe"
set "INSTALLER_PATH=dist\%INSTALLER_NAME%"
set "YML_PATH=dist\latest.yml"

if not exist "%INSTALLER_PATH%" (
    echo [ERRORE] Installer non trovato: %INSTALLER_PATH%
    echo.
    pause
    exit /b 1
)

if not exist "%YML_PATH%" (
    echo [ERRORE] latest.yml non trovato!
    echo.
    pause
    exit /b 1
)

echo [OK] Installer: %INSTALLER_NAME%

REM Controlla dimensione file
for %%A in ("%INSTALLER_PATH%") do set SIZE=%%~zA
set /a SIZE_MB=%SIZE% / 1048576
echo [OK] Dimensione: %SIZE_MB% MB

if %SIZE_MB% LSS 50 (
    echo.
    echo [WARNING] Installer sembra troppo piccolo!
    echo Dimensione normale: 90-100 MB
    echo Verifica che sia corretto.
    echo.
    pause
)

echo [OK] latest.yml presente
echo.
echo [OK] Tutti i files generati correttamente!
timeout /t 2 >nul

REM Colori (funziona solo su Windows 10+)
color 0A

REM ============================================
REM STEP 7: ISTRUZIONI FINALI
REM ============================================
echo.
echo [STEP 7/7] Release completata!
echo.
echo ============================================
echo   FILES PRONTI PER GITHUB RELEASE
echo ============================================
echo.
echo 1. %INSTALLER_NAME%
echo 2. latest.yml
echo.
echo ============================================
echo   PROSSIMI PASSI MANUALI
echo ============================================
echo.
echo 1. TESTA L'INSTALLER:
echo    - Esegui: dist\%INSTALLER_NAME%
echo    - Verifica che l'app funzioni
echo    - Controlla la versione (in basso a destra)
echo.
echo 2. VAI SU GITHUB:
echo    https://github.com/Abrason666/mystreamapp/releases
echo.
echo 3. CLICCA: "Draft a new release"
echo.
echo 4. COMPILA:
echo    - Tag: v%NEW_VERSION% (CON LA "v"!)
echo    - Title: CatStreamApp v%NEW_VERSION%
echo    - Description: Scrivi changelog
echo.
echo 5. CARICA FILES:
echo    - Trascina: %INSTALLER_NAME%
echo    - Trascina: latest.yml
echo.
echo 6. CLICCA: "Publish release"
echo.
echo 7. TESTA AUTO-UPDATE:
echo    - Reinstalla versione precedente
echo    - Apri app
echo    - Aspetta 10-15 secondi
echo    - Verifica popup aggiornamento
echo.
echo ============================================

REM Apri la cartella dist
echo.
set /p OPEN_FOLDER="Vuoi aprire la cartella dist? (S/N): "

if /i "%OPEN_FOLDER%"=="S" (
    explorer dist
)

echo.
echo ============================================
echo   SCRIPT COMPLETATO CON SUCCESSO!
echo ============================================
echo.
echo Versione creata: %NEW_VERSION%
echo Tag GitHub: v%NEW_VERSION%
echo.
echo Buona release! ^_^
echo.
pause