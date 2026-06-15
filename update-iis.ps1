# ============================================================
# SCRIPT DE ATUALIZACAO DO SISTEMA ITAM - Executar como Admin
# Clique direito no arquivo > "Executar com PowerShell como Administrador"
# ============================================================

$PROJETO = "c:\Users\KennedyMonteirodeLim\OneDrive - AVANÇO SA\Documentos\GitHub\Projeto_inventario_TI"
$DIST    = "$PROJETO\frontend\dist"
$IIS_DIR = "C:\inetpub\inventarioavanco"
$SITE    = "inventarioavanco"
$APPCMD  = "$env:SystemRoot\system32\inetsrv\appcmd.exe"

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  ATUALIZANDO SISTEMA ITAM - AVANCO CONSTRUCOES" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# 1. Corrigir binding do IIS para aceitar qualquer IP
Write-Host ""
Write-Host "[1/4] Corrigindo binding do IIS para qualquer rede..." -ForegroundColor Yellow
if (Test-Path $APPCMD) {
    $result = & $APPCMD set site $SITE /bindings:"http/*:80:"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "      OK - IIS agora responde em qualquer IP na porta 80" -ForegroundColor Green
    } else {
        Write-Host "      AVISO: $result" -ForegroundColor Red
    }
} else {
    Write-Host "      appcmd.exe nao encontrado." -ForegroundColor Red
}

# 2. Garantir permissoes na pasta do IIS
Write-Host ""
Write-Host "[2/4] Ajustando permissoes na pasta do IIS..." -ForegroundColor Yellow
$acl = Get-Acl $IIS_DIR
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    [System.Security.Principal.WindowsIdentity]::GetCurrent().Name,
    "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"
)
$acl.SetAccessRule($rule)
Set-Acl $IIS_DIR $acl
Write-Host "      OK - Permissoes atualizadas" -ForegroundColor Green

# 3. Copiar o frontend construido para o IIS
Write-Host ""
Write-Host "[3/4] Copiando frontend para o IIS..." -ForegroundColor Yellow
if (Test-Path $DIST) {
    robocopy $DIST $IIS_DIR /E /IS /IT /PURGE /NFL /NDL /NJH /NJS | Out-Null
    Write-Host "      OK - Arquivos copiados para $IIS_DIR" -ForegroundColor Green
} else {
    Write-Host "      ERRO: Pasta dist nao encontrada. Rode 'npm run build' antes." -ForegroundColor Red
}

# 4. Reiniciar IIS para aplicar mudancas
Write-Host ""
Write-Host "[4/4] Reiniciando IIS..." -ForegroundColor Yellow
iisreset /restart | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "      OK - IIS reiniciado com sucesso" -ForegroundColor Green
} else {
    Write-Host "      AVISO: iisreset retornou codigo $LASTEXITCODE" -ForegroundColor Red
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  CONCLUIDO!" -ForegroundColor Green
Write-Host ""
Write-Host "  O sistema agora funciona em QUALQUER rede." -ForegroundColor White
Write-Host "  Acesse pelo IP atual da maquina na porta 80." -ForegroundColor White
Write-Host ""
Write-Host "  Para descobrir o IP atual:" -ForegroundColor White
Write-Host "  ipconfig | findstr IPv4" -ForegroundColor Gray
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""
Pause
