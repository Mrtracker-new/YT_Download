@echo off
echo ============================================
echo  YT Downloader Tauri - Prerequisites Setup
echo ============================================
echo.
echo This script will help you install the required build tools.
echo.
echo STEP 1: Install Visual Studio Build Tools 2022
echo   - Required for Rust to compile on Windows (MSVC linker)
echo   - This will open the Visual Studio installer
echo.
echo Press any key to open the Visual Studio Build Tools installer...
pause > nul

start "" "https://aka.ms/vs/17/release/vs_buildtools.exe"

echo.
echo In the installer:
echo   1. Check "Desktop development with C++"
echo   2. Also ensure "Windows 11 SDK" is checked on the right panel
echo   3. Click "Install"
echo   4. Wait for installation to complete (may take 10-30 minutes)
echo.
echo STEP 2: After VS Build Tools finish, come back and run:
echo   npm run dev
echo.
echo Press any key when VS Build Tools installation is complete...
pause > nul

echo.
echo STEP 3: Verifying setup...
rustc --version
cargo --version
echo.
echo If you see version numbers above, Rust is ready!
echo.
echo STEP 4: Starting development server...
echo Run: npm run dev
echo.
pause
