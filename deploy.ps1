# =====================================================
# SCRIPT DE DEPLOY - INVENTARIO AVANCO
# Execute como Administrador: clique direito > Executar como Administrador
# =====================================================

$ErrorActionPreference = "Stop"
$projeto = "C:\Users\KennedyMonteirodeLim\OneDrive - AVANCO SA\Documentos\GitHub\Projeto_inventario_TI"
$iisDir  = "C:\inetpub\inventarioavanco"

Write-Host "`n=== DEPLOY INVENTARIO AVANCO ===" -ForegroundColor Cyan

# 1. Build do frontend
Write-Host "`n[1/4] Gerando build do frontend..." -ForegroundColor Yellow
Set-Location "$projeto\frontend"
npm run build
if (-not $?) { Write-Host "ERRO no build!" -ForegroundColor Red; exit 1 }

# 2. Copiar build para IIS
Write-Host "`n[2/4] Copiando arquivos para IIS..." -ForegroundColor Yellow
Copy-Item -Path "$projeto\frontend\dist\*" -Destination $iisDir -Recurse -Force
Copy-Item -Path "$projeto\frontend\web.config" -Destination $iisDir -Force
Write-Host "Arquivos copiados para $iisDir" -ForegroundColor Green

# 3. Criar pasta de logs se nao existir
Write-Host "`n[3/4] Verificando pasta de logs..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "C:\Logs\pm2" | Out-Null
Write-Host "Pasta de logs OK" -ForegroundColor Green

# 4. Iniciar/Reiniciar backend com PM2
Write-Host "`n[4/4] Iniciando backend com PM2..." -ForegroundColor Yellow
Set-Location "$projeto\backend"

$pm2Running = pm2 list 2>&1 | Select-String "inventario-itam"
if ($pm2Running) {
    Write-Host "Reiniciando app existente no PM2..." -ForegroundColor Yellow
    pm2 restart inventario-itam
} else {
    Write-Host "Iniciando app no PM2 pela primeira vez..." -ForegroundColor Yellow
    pm2 start ecosystem.config.js
    pm2 save
}

Write-Host "`n=== DEPLOY CONCLUIDO! ===" -ForegroundColor Green
Write-Host "Frontend: http://10.1.5.198" -ForegroundColor Cyan
Write-Host "Backend:  http://10.1.5.198:8000/docs" -ForegroundColor Cyan
Write-Host "`nStatus do PM2:" -ForegroundColor Yellow
pm2 list
