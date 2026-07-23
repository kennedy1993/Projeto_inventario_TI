# ITAM Avanço — rodando via Docker

O sistema inteiro (frontend + API + banco) roda em 3 containers, orquestrados
pelo `docker-compose.yml` na raiz do projeto:

| Serviço       | O que é                                                              |
|---------------|-----------------------------------------------------------------------|
| `db`          | PostgreSQL 18, guarda os dados em um volume Docker (`db_data`)       |
| `app`         | FastAPI (API) + build do React já embutido, servidos juntos na porta 8000 |
| `cloudflared` | Túnel que expõe o `app` publicamente via HTTPS, sem mexer no roteador |

Como o front e o back são servidos pela mesma origem, **não existe mais
dependência de porta 8000 aberta pra fora** — quem acessa de fora da empresa
usa a URL do Cloudflare; quem está na rede interna pode continuar acessando
`http://<IP-da-máquina>:8000` normalmente.

## Primeira vez / depois de puxar o repositório

1. Copie `.env.docker.example` para `.env` (raiz do projeto) e preencha:
   - `POSTGRES_PASSWORD`
   - `GROQ_API_KEY`
   - `ALLOWED_ORIGINS` (pode deixar em branco — libera geral, ok para uso atrás do túnel)
2. Suba tudo:
   ```
   docker compose up -d --build
   ```
3. Pegue a URL pública gerada pelo túnel:
   ```
   docker compose logs cloudflared | grep trycloudflare
   ```
   Vai aparecer algo como `https://palavra-aleatoria.trycloudflare.com`.

**Importante:** esse é um *Quick Tunnel* gratuito, sem precisar de domínio nem
conta Cloudflare. Funciona bem pra usar já, mas a URL **muda toda vez que o
container `cloudflared` reinicia**. Para uma URL fixa, veja a seção abaixo.

## Comandos do dia a dia

```
docker compose ps                 # ver status dos containers
docker compose logs -f app        # acompanhar logs da API
docker compose restart app        # reiniciar só a API (ex: depois de mudar código)
docker compose down                # parar tudo (mantém os dados nos volumes)
```

## Migração de dados (já feita)

Os dados que estavam no PostgreSQL nativo do Windows (301 ativos, 251 linhas
na tabela `ativos`, colaboradores, contratos, etc.) já foram migrados para o
volume `db_data` do Docker via `pg_dump`/`psql`. O processo PM2
(`inventario-itam`) foi parado — o Docker agora é a única fonte de verdade.
Não existe mais dependência do PostgreSQL nativo do Windows; ele pode
continuar instalado (sem uso) ou ser desinstalado quando quiserem.

## Como conseguir uma URL fixa (não muda mais)

O Quick Tunnel é ótimo pra validar agora, mas para uso definitivo (ex:
divulgar o link pro time), o caminho é um **tunnel nomeado**, que precisa de
um domínio cadastrado (grátis) na Cloudflare:

1. Registrar um domínio, se ainda não tiverem um (ex: Registro.br para
   `.com.br`, ou Cloudflare Registrar / Namecheap para `.com`).
2. Criar conta grátis em https://dash.cloudflare.com e adicionar o domínio.
3. Criar o tunnel nomeado (substitui o `cloudflared` do compose):
   ```
   docker run -it --rm -v cloudflared_config:/etc/cloudflared cloudflare/cloudflared \
     tunnel login
   docker run -it --rm -v cloudflared_config:/etc/cloudflared cloudflare/cloudflared \
     tunnel create itam-avanco
   docker run -it --rm -v cloudflared_config:/etc/cloudflared cloudflare/cloudflared \
     tunnel route dns itam-avanco itam.seudominio.com.br
   ```
4. Trocar o serviço `cloudflared` do `docker-compose.yml` para usar
   `tunnel run itam-avanco` (com o volume `cloudflared_config` montado) em vez
   de `tunnel --url`.

Quando tiverem o domínio, é só avisar que eu configuro esse passo 4 direto no
`docker-compose.yml`.

## Arquivos relevantes

- `Dockerfile` — build multi-stage (Node builda o frontend, Python serve tudo)
- `docker-compose.yml` — orquestração dos 3 serviços
- `.env.docker.example` — modelo de variáveis de ambiente (copiar pra `.env`)
- `.dockerignore` — evita subir `node_modules`, `.env`, uploads antigos etc. pro build
