#!/bin/bash
# ==============================================================================
# SCRIPT DE DEPLOY - ITAM Avanço Construções
# Servidor: Ubuntu 22.04 LTS
# ==============================================================================
# COMO USAR:
#   1. Faça upload deste repositório para o servidor
#   2. Execute: chmod +x deploy.sh && sudo ./deploy.sh
#
# O script instala tudo do zero. Para atualizações, use update.sh (veja ao final).
# ==============================================================================

set -e  # Para em qualquer erro

APP_DIR="/var/www/inventario-ti"
DB_NAME="itam_avanco"
DB_USER="postgres"
NODE_VERSION="20"
PYTHON_VERSION="3.11"

echo "======================================================"
echo " DEPLOY - ITAM Avanço Construções"
echo "======================================================"

# --- 1. ATUALIZAR SISTEMA ---
echo ""
echo "[1/8] Atualizando pacotes do sistema..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl git build-essential python3-pip python3-venv nginx certbot python3-certbot-nginx

# --- 2. INSTALAR NODE.JS + PM2 ---
echo ""
echo "[2/8] Instalando Node.js $NODE_VERSION e PM2..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs
npm install -g pm2
pm2 startup systemd -u root --hp /root

# --- 3. INSTALAR POSTGRESQL ---
echo ""
echo "[3/8] Instalando PostgreSQL..."
apt-get install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

echo "Criando banco de dados '$DB_NAME'..."
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "  Banco já existe, continuando..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# --- 4. COPIAR PROJETO ---
echo ""
echo "[4/8] Configurando diretório do projeto em $APP_DIR..."
mkdir -p "$APP_DIR"
cp -r . "$APP_DIR/"
cd "$APP_DIR"

# Verificar se .env existe
if [ ! -f ".env" ]; then
    echo ""
    echo "  ATENÇÃO: Arquivo .env não encontrado!"
    echo "  Copie .env.example para .env e preencha os valores:"
    echo "    cp .env.example .env && nano .env"
    echo ""
    echo "  Após editar o .env, execute novamente: sudo ./deploy.sh"
    exit 1
fi

# --- 5. INSTALAR DEPENDÊNCIAS PYTHON ---
echo ""
echo "[5/8] Instalando dependências Python..."
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# --- 6. BUILD DO FRONTEND REACT ---
echo ""
echo "[6/8] Instalando dependências e buildando o frontend..."
cd web
npm install
npm run build
cd ..
echo "  Build gerado em web/dist/"

# --- 7. CONFIGURAR NGINX ---
echo ""
echo "[7/8] Configurando Nginx..."
cp nginx.conf /etc/nginx/sites-available/inventario-ti
ln -sf /etc/nginx/sites-available/inventario-ti /etc/nginx/sites-enabled/inventario-ti
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx

# --- 8. INICIAR COM PM2 ---
echo ""
echo "[8/8] Iniciando aplicação com PM2..."
mkdir -p /var/log/pm2

# Usar o uvicorn do virtualenv
sed -i "s|\"uvicorn\"|\"$APP_DIR/venv/bin/uvicorn\"|" "$APP_DIR/ecosystem.config.js"

pm2 start "$APP_DIR/ecosystem.config.js"
pm2 save

echo ""
echo "======================================================"
echo " DEPLOY CONCLUÍDO COM SUCESSO!"
echo "======================================================"
echo ""
echo " Próximos passos:"
echo " 1. Edite nginx.conf e troque 'seu-dominio.com.br' pelo IP ou domínio real"
echo "    sudo nano /etc/nginx/sites-available/inventario-ti"
echo "    sudo systemctl reload nginx"
echo ""
echo " 2. Para SSL gratuito (HTTPS) com Let's Encrypt:"
echo "    sudo certbot --nginx -d seu-dominio.com.br"
echo ""
echo " 3. Monitorar logs:"
echo "    pm2 logs inventario-itam"
echo "    pm2 monit"
echo ""
echo " Acesse: http://IP-DO-SERVIDOR"
echo "======================================================"


# ==============================================================================
# SCRIPT DE ATUALIZAÇÃO (use após o primeiro deploy)
# Salve como update.sh e execute com: sudo ./update.sh
# ==============================================================================
cat > /var/www/inventario-ti/update.sh << 'UPDATEEOF'
#!/bin/bash
set -e
APP_DIR="/var/www/inventario-ti"
cd "$APP_DIR"

echo "Puxando atualizações do Git..."
git pull origin main

echo "Atualizando dependências Python..."
source venv/bin/activate
pip install -r requirements.txt

echo "Rebuilding frontend..."
cd web && npm install && npm run build && cd ..

echo "Reiniciando aplicação..."
pm2 restart inventario-itam

echo "Atualização concluída!"
pm2 status
UPDATEEOF
chmod +x /var/www/inventario-ti/update.sh
echo " Script de atualização criado em: $APP_DIR/update.sh"
