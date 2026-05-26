module.exports = {
  apps: [
    {
      name: "inventario-itam",
      script: "uvicorn",
      args: "APP:app --host 127.0.0.1 --port 8000 --workers 2",
      interpreter: "none",
      // Ajuste este caminho para onde o projeto ficará no servidor
      cwd: "/var/www/inventario-ti",
      env: {
        PYTHONUNBUFFERED: "1"
      },
      error_file: "/var/log/pm2/inventario-error.log",
      out_file: "/var/log/pm2/inventario-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      restart_delay: 3000,
      max_restarts: 10
    }
  ]
};
