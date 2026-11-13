@echo off
setlocal

py -m pip install -r requirements-windows.txt
py -m PyInstaller --noconfirm --clean --onefile --windowed --name Fernanda app.py

echo.
echo Executavel criado em dist\Fernanda.exe
pause
