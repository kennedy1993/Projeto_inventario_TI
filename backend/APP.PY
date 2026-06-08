# ==============================================================================
# BACK-END ITAM - AVANÇO CONSTRUÇÕES
# Stack: Python 3, FastAPI, SQLAlchemy, PostgreSQL
# ==============================================================================
# Instruções para executar:
# 1. Instalar dependências: pip install fastapi uvicorn sqlalchemy psycopg2-binary
# 2. Executar o servidor: uvicorn APP:app --reload
#    ou: uvicorn main:app --reload (main.py importa APP.app)
# 3. Aceder à documentação automática: http://localhost:8000/docs
# ==============================================================================

# 1. No topo do arquivo, junto com os outros imports:
from chat_service import router as chat_router
from dotenv import load_dotenv

# Carrega as variáveis do arquivo .env (garante que a GROQ_API_KEY seja lida)
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Numeric, ForeignKey, Date, DateTime, or_, Boolean
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship, joinedload
from pydantic import BaseModel, ConfigDict, field_validator
from typing import List, Optional, Any
from datetime import datetime, date, timedelta

# --- 1. CONFIGURAÇÃO DO BANCO DE DADOS POSTGRESQL ---
import os
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:30209713@localhost:5432/itam_avanco?application_name=itam_api"
)

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- 2. MODELOS DO BANCO DE DADOS (SQLAlchemy) ---
# Estes modelos representam as tabelas que criámos no script SQL

class Empresa(Base):
    __tablename__ = "empresas"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    setores = relationship("Setor", back_populates="empresa")

class Setor(Base):
    __tablename__ = "setores"
    id = Column(Integer, primary_key=True, index=True)
    empresa_id = Column(Integer, ForeignKey("empresas.id"))
    nome = Column(String, nullable=False)
    empresa = relationship("Empresa", back_populates="setores")
    colaboradores = relationship("Colaborador", back_populates="setor")

class Colaborador(Base):
    __tablename__ = "colaboradores"
    id = Column(Integer, primary_key=True, index=True)
    setor_id = Column(Integer, ForeignKey("setores.id"))
    nome = Column(String, nullable=False)
    email_corporativo = Column(String, unique=True, index=True)
    status = Column(String, default="Ativo")
    setor = relationship("Setor", back_populates="colaboradores")

class Ativo(Base):
    __tablename__ = "ativos"
    id = Column(Integer, primary_key=True, index=True)
    tag_patrimonio = Column(String, unique=True, index=True)
    tipo = Column(String) # Equipamento (Notebook, Monitor, etc.)
    marca = Column(String)
    modelo = Column(String)
    especificacoes = Column(String) # Descrição
    local_fisico = Column(String) # Local
    status = Column(String, default="Estoque")
    licenca_windows = Column(String)
    licenca_office = Column(String)
    numero_chip = Column(String)
    numero_serie = Column(String)
    fornecedor = Column(String)
    data_aquisicao = Column(Date, nullable=True)
    data_garantia = Column(Date, nullable=True)
    observacao = Column(String)
    valor = Column(Numeric(10, 2))
    colaborador_id = Column(Integer, ForeignKey("colaboradores.id"), nullable=True)
    
    colaborador = relationship("Colaborador")
    historico = relationship("HistoricoAtivo", back_populates="ativo", cascade="all, delete-orphan")

class HistoricoAtivo(Base):
    __tablename__ = "historico_ativos"
    id = Column(Integer, primary_key=True, index=True)
    ativo_id = Column(Integer, ForeignKey("ativos.id", ondelete="CASCADE"), nullable=False)
    colaborador_id = Column(Integer, ForeignKey("colaboradores.id", ondelete="SET NULL"), nullable=True)
    status = Column(String)
    local_fisico = Column(String)
    data_alteracao = Column(DateTime, default=datetime.now)
    descricao = Column(String)

    ativo = relationship("Ativo", back_populates="historico")
    colaborador = relationship("Colaborador")

class Contrato(Base):
    __tablename__ = "contratos"
    id = Column(Integer, primary_key=True, index=True)
    numero_contrato = Column(String, nullable=True)
    titulo = Column(String, nullable=False)
    tipo = Column(String, nullable=False)
    fornecedor = Column(String, nullable=False)
    contato_fornecedor = Column(String, nullable=True)
    telefone_fornecedor = Column(String, nullable=True)
    email_fornecedor = Column(String, nullable=True)
    data_inicio = Column(Date, nullable=True)
    data_vencimento = Column(Date, nullable=False)
    valor_mensal = Column(Numeric(15, 2), nullable=True)
    valor_anual = Column(Numeric(15, 2), nullable=True)
    valor_total = Column(Numeric(15, 2), nullable=True)
    status = Column(String, default="Ativo")
    descricao = Column(String, nullable=True)
    observacoes = Column(String, nullable=True)
    responsavel_interno = Column(String, nullable=True)
    renovacao_automatica = Column(Boolean, default=False)
    prazo_aviso_dias = Column(Integer, default=30)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

# Criar as tabelas no banco de dados automaticamente (após as tabelas estarem definidas no script Python)
Base.metadata.create_all(bind=engine)

# Migração incremental: garante colunas adicionadas após criação inicial da tabela
from sqlalchemy import text as _text
with engine.connect() as _conn:
    _conn.execute(_text("ALTER TABLE ativos ADD COLUMN IF NOT EXISTS numero_chip VARCHAR"))
    _conn.execute(_text("ALTER TABLE ativos ADD COLUMN IF NOT EXISTS observacao VARCHAR"))
    _conn.execute(_text("ALTER TABLE ativos ADD COLUMN IF NOT EXISTS numero_serie VARCHAR"))
    _conn.execute(_text("ALTER TABLE ativos ADD COLUMN IF NOT EXISTS fornecedor VARCHAR"))
    _conn.execute(_text("ALTER TABLE ativos ADD COLUMN IF NOT EXISTS data_aquisicao DATE"))
    _conn.execute(_text("ALTER TABLE ativos ADD COLUMN IF NOT EXISTS data_garantia DATE"))
    # Normaliza e-mails vazios para NULL (evita violação de UNIQUE em cadastros sem e-mail)
    _conn.execute(_text("UPDATE colaboradores SET email_corporativo = NULL WHERE email_corporativo = ''"))
    _conn.commit()


# --- 3. SCHEMAS (Pydantic) ---
# Usados para validar os dados que entram e saem da API

class AtivoBase(BaseModel):
    tag_patrimonio: str
    tipo: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    especificacoes: Optional[str] = None
    local_fisico: Optional[str] = None
    status: Optional[str] = None
    licenca_windows: Optional[str] = None
    licenca_office: Optional[str] = None
    numero_chip: Optional[str] = None
    numero_serie: Optional[str] = None
    fornecedor: Optional[str] = None
    data_aquisicao: Optional[date] = None
    data_garantia: Optional[date] = None
    observacao: Optional[str] = None
    valor: Optional[float] = None
    colaborador_id: Optional[int] = None

class AtivoCreate(AtivoBase):
    pass

class AtivoUpdate(BaseModel):
    tag_patrimonio: Optional[str] = None
    tipo: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    especificacoes: Optional[str] = None
    local_fisico: Optional[str] = None
    status: Optional[str] = None
    licenca_windows: Optional[str] = None
    licenca_office: Optional[str] = None
    numero_chip: Optional[str] = None
    numero_serie: Optional[str] = None
    fornecedor: Optional[str] = None
    data_aquisicao: Optional[date] = None
    data_garantia: Optional[date] = None
    observacao: Optional[str] = None
    valor: Optional[float] = None
    colaborador_id: Optional[int] = None

class ColaboradorCreate(BaseModel):
    nome: str
    email_corporativo: Optional[str] = None
    setor_id: Optional[int] = None
    status: Optional[str] = "Ativo"

class AtivoBulkImportItem(BaseModel):
    tag_patrimonio: str
    tipo: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    especificacoes: Optional[str] = None
    local_fisico: Optional[str] = None
    status: Optional[str] = None
    licenca_windows: Optional[str] = None
    licenca_office: Optional[str] = None
    valor: Optional[float] = None
    colaborador_nome: Optional[str] = None
    setor_nome: Optional[str] = None
    numero_serie: Optional[str] = None
    fornecedor: Optional[str] = None
    data_aquisicao: Optional[date] = None
    data_garantia: Optional[date] = None

class ColaboradorSimple(BaseModel):
    id: int
    nome: str
    email_corporativo: Optional[str] = None
    setor: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

    @field_validator('setor', mode='before')
    @classmethod
    def extract_setor_name(cls, v: Any):
        if hasattr(v, 'nome'):
            return v.nome
        return v

class AtivoResponse(BaseModel):
    id: int
    tag_patrimonio: str
    tipo: Any = None
    marca: Any = None
    modelo: Any = None
    especificacoes: Any = None
    local_fisico: Any = None
    status: Any = None
    licenca_windows: Any = None
    licenca_office: Any = None
    numero_chip: Any = None
    numero_serie: Any = None
    fornecedor: Any = None
    data_aquisicao: Any = None
    data_garantia: Any = None
    observacao: Any = None
    valor: Any = None
    colaborador_id: Any = None
    colaborador: Optional[ColaboradorSimple] = None
    model_config = ConfigDict(from_attributes=True)

class DashboardResumo(BaseModel):
    total_ativos: int
    ativos_em_uso: int
    ativos_estoque: int
    valor_total: float

class ColaboradorUpdate(BaseModel):
    nome: Optional[str] = None
    email_corporativo: Optional[str] = None
    setor_id: Optional[int] = None
    status: Optional[str] = None

class SetorResponse(BaseModel):
    id: int
    nome: str
    model_config = ConfigDict(from_attributes=True)


class ContratoCreate(BaseModel):
    numero_contrato: Optional[str] = None
    titulo: str
    tipo: str
    fornecedor: str
    contato_fornecedor: Optional[str] = None
    telefone_fornecedor: Optional[str] = None
    email_fornecedor: Optional[str] = None
    data_inicio: Optional[date] = None
    data_vencimento: date
    valor_mensal: Optional[float] = None
    valor_anual: Optional[float] = None
    valor_total: Optional[float] = None
    status: Optional[str] = "Ativo"
    descricao: Optional[str] = None
    observacoes: Optional[str] = None
    responsavel_interno: Optional[str] = None
    renovacao_automatica: Optional[bool] = False
    prazo_aviso_dias: Optional[int] = 30

class ContratoUpdate(BaseModel):
    numero_contrato: Optional[str] = None
    titulo: Optional[str] = None
    tipo: Optional[str] = None
    fornecedor: Optional[str] = None
    contato_fornecedor: Optional[str] = None
    telefone_fornecedor: Optional[str] = None
    email_fornecedor: Optional[str] = None
    data_inicio: Optional[date] = None
    data_vencimento: Optional[date] = None
    valor_mensal: Optional[float] = None
    valor_anual: Optional[float] = None
    valor_total: Optional[float] = None
    status: Optional[str] = None
    descricao: Optional[str] = None
    observacoes: Optional[str] = None
    responsavel_interno: Optional[str] = None
    renovacao_automatica: Optional[bool] = None
    prazo_aviso_dias: Optional[int] = None


import logging
import traceback

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- 4. CONFIGURAÇÃO DO FASTAPI ---
app = FastAPI(
    title="ITAM API - Avanço Construções",
    description="API para gestão de inventário de T.I",
    version="1.0.0"
)

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Erro Global: {exc}")
    logger.error(traceback.format_exc())
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "detail": str(exc)
        }
    )

# Configuração de CORS dinâmica para produção
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_str:
    allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]
else:
    allowed_origins = ["*"]

# Se a origem for curinga ("*"), desativamos credentials para cumprir com especificações de CORS
allow_credentials = True
if "*" in allowed_origins:
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?",
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclui as rotas do assistente virtual de chat IA
app.include_router(chat_router)

# Dependência para obter a sessão do banco de dados
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- 5. ROTAS (ENDPOINTS) ---

@app.get("/")
def read_root():
    return {"mensagem": "API do Sistema ITAM está online!"}

# Rota para o Dashboard do React
@app.get("/api/dashboard")
def obter_resumo_dashboard(db: Session = Depends(get_db)):
    hoje = date.today()
    trinta_dias = hoje + timedelta(days=30)

    total = db.query(Ativo).count()
    em_uso = db.query(Ativo).filter(Ativo.status == "Em Uso").count()
    estoque = db.query(Ativo).filter(Ativo.status == "Estoque").count()
    manutencao = db.query(Ativo).filter(Ativo.status == "Manutenção").count()
    descartados = db.query(Ativo).filter(Ativo.status == "Descartado").count()

    garantia_vencida = db.query(Ativo).filter(
        Ativo.data_garantia != None,
        Ativo.data_garantia < hoje,
        Ativo.status != "Descartado"
    ).count()

    garantia_vencendo_30d = db.query(Ativo).filter(
        Ativo.data_garantia != None,
        Ativo.data_garantia >= hoje,
        Ativo.data_garantia <= trinta_dias
    ).count()

    # Valor e quantidade por tipo (ordenado por valor desc)
    ativos_all = db.query(Ativo.tipo, Ativo.valor).all()
    valor_por_tipo_dict: dict = {}
    count_por_tipo_dict: dict = {}
    for tipo, valor in ativos_all:
        t = tipo or "OUTROS"
        valor_por_tipo_dict[t] = valor_por_tipo_dict.get(t, 0) + float(valor or 0)
        count_por_tipo_dict[t] = count_por_tipo_dict.get(t, 0) + 1

    soma_valor = sum(valor_por_tipo_dict.values())

    return {
        "total_ativos": total,
        "ativos_em_uso": em_uso,
        "ativos_estoque": estoque,
        "ativos_manutencao": manutencao,
        "ativos_descartados": descartados,
        "garantia_vencida": garantia_vencida,
        "garantia_vencendo_30d": garantia_vencendo_30d,
        "valor_total": round(soma_valor, 2),
        "valor_por_tipo": [
            {"tipo": k, "valor": round(v, 2), "quantidade": count_por_tipo_dict[k]}
            for k, v in sorted(valor_por_tipo_dict.items(), key=lambda x: -x[1])
        ]
    }

@app.get("/api/ativos")
def listar_ativos(
    status: Optional[str] = None, 
    tipo: Optional[str] = None, 
    search: Optional[str] = None,
    skip: int = 0, 
    limit: int = 1000, 
    db: Session = Depends(get_db)
):
    query = db.query(Ativo).options(joinedload(Ativo.colaborador))
    
    if status and status != "Todos":
        query = query.filter(Ativo.status == status)
    
    if tipo and tipo != "Todos":
        query = query.filter(Ativo.tipo == tipo)
        
    if search:
        search_filter = or_(
            Ativo.tag_patrimonio.ilike(f"%{search}%"),
            Ativo.marca.ilike(f"%{search}%"),
            Ativo.modelo.ilike(f"%{search}%"),
            Ativo.local_fisico.ilike(f"%{search}%")
        )
        query = query.filter(search_filter)
        
    ativos = query.offset(skip).limit(limit).all()
    return [
        {
            "id": a.id,
            "tag_patrimonio": a.tag_patrimonio,
            "tipo": a.tipo,
            "marca": a.marca,
            "modelo": a.modelo,
            "especificacoes": a.especificacoes,
            "local_fisico": a.local_fisico,
            "status": a.status,
            "licenca_windows": a.licenca_windows,
            "licenca_office": a.licenca_office,
            "numero_chip": a.numero_chip,
            "numero_serie": a.numero_serie,
            "fornecedor": a.fornecedor,
            "data_aquisicao": a.data_aquisicao.isoformat() if a.data_aquisicao else None,
            "data_garantia": a.data_garantia.isoformat() if a.data_garantia else None,
            "observacao": a.observacao,
            "valor": float(a.valor) if a.valor else None,
            "colaborador_id": a.colaborador_id,
            "colaborador": {
                "id": a.colaborador.id,
                "nome": a.colaborador.nome,
                "email": a.colaborador.email_corporativo,
                "setor": a.colaborador.setor.nome if a.colaborador.setor else None
            } if a.colaborador else None
        } for a in ativos
    ]

# Rota para gerar a próxima TAG de patrimônio com base no tipo do equipamento
@app.get("/api/ativos/next-tag")
def obter_proxima_tag(tipo: str = "NOTEBOOK", db: Session = Depends(get_db)):
    prefixos = {
        "NOTEBOOK":   "NTB",
        "MONITOR":    "MON",
        "DESKTOP":    "DSK",
        "CELULAR":    "CEL",
        "IMPRESSORA": "IMP",
        "TONER":      "TNR",
        "LICENÇA":    "LIC",
        "STARLINK":   "STL",
        "OUTROS":     "OUT",
    }
    prefixo = prefixos.get(tipo.upper(), "OUT")
    pattern = f"{prefixo}-AVAN-%"

    tags = db.query(Ativo.tag_patrimonio).filter(
        Ativo.tag_patrimonio.like(pattern)
    ).all()

    maior_num = 0
    for (tag,) in tags:
        partes = tag.split("-")
        if len(partes) == 3 and partes[2].isdigit():
            maior_num = max(maior_num, int(partes[2]))

    proxima = maior_num + 1
    return {"next_tag": f"{prefixo}-AVAN-{proxima:03d}"}


# Rota para registar um novo equipamento no banco
@app.post("/api/ativos")
def criar_ativo(ativo: AtivoCreate, db: Session = Depends(get_db)):
    db_ativo = db.query(Ativo).filter(Ativo.tag_patrimonio == ativo.tag_patrimonio).first()
    if db_ativo:
        raise HTTPException(status_code=400, detail="TAG de Patrimônio já registrada.")
    
    payload = ativo.dict()
    novo_ativo = Ativo(**payload)
    db.add(novo_ativo)
    db.commit()
    db.refresh(novo_ativo)
    
    # Log de cadastro inicial no histórico
    hist = HistoricoAtivo(
        ativo_id=novo_ativo.id,
        colaborador_id=novo_ativo.colaborador_id,
        status=novo_ativo.status or "Estoque",
        local_fisico=novo_ativo.local_fisico or "Sede Central",
        descricao="Equipamento cadastrado inicialmente no sistema."
    )
    db.add(hist)
    db.commit()
    
    return novo_ativo

# Rota para atualizar um equipamento no banco com auditoria automática no histórico
@app.put("/api/ativos/{id}")
def atualizar_ativo(id: int, data: AtivoUpdate, db: Session = Depends(get_db)):
    ativo = db.query(Ativo).filter(Ativo.id == id).first()
    if not ativo:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")
    
    update_data = data.dict(exclude_unset=True)
    
    old_status = ativo.status
    old_colab_id = ativo.colaborador_id
    old_local = ativo.local_fisico
    
    # Atualizar campos no objeto ativo
    for key, value in update_data.items():
        setattr(ativo, key, value)
    
    # Se mudou status, colab ou local, cria histórico de movimentação
    if "status" in update_data or "colaborador_id" in update_data or "local_fisico" in update_data:
        mudancas = []
        
        # Resolver nomes dos colaboradores para registrar no histórico
        old_colab_nome = "Disponível (Sem atribuição)"
        if old_colab_id:
            old_c = db.query(Colaborador).filter(Colaborador.id == old_colab_id).first()
            if old_c:
                old_colab_nome = old_c.nome
                
        new_colab_nome = "Disponível (Sem atribuição)"
        new_colab_id = update_data.get("colaborador_id", old_colab_id)
        if new_colab_id:
            new_c = db.query(Colaborador).filter(Colaborador.id == new_colab_id).first()
            if new_c:
                new_colab_nome = new_c.nome
        
        if "status" in update_data and old_status != data.status:
            mudancas.append(f"Status alterado de '{old_status}' para '{data.status}'")
            
        if "colaborador_id" in update_data and old_colab_id != data.colaborador_id:
            mudancas.append(f"Responsabilidade transferida de '{old_colab_nome}' para '{new_colab_nome}'")
            
        if "local_fisico" in update_data and old_local != data.local_fisico:
            mudancas.append(f"Local alterado de '{old_local}' para '{data.local_fisico}'")
            
        if mudancas:
            descricao = " | ".join(mudancas)
            hist = HistoricoAtivo(
                ativo_id=ativo.id,
                colaborador_id=ativo.colaborador_id,
                status=ativo.status,
                local_fisico=ativo.local_fisico,
                descricao=descricao
            )
            db.add(hist)
    
    db.commit()
    db.refresh(ativo)
    return ativo

# Rota para excluir um equipamento no banco
@app.delete("/api/ativos/{id}")
def deletar_ativo(id: int, db: Session = Depends(get_db)):
    ativo = db.query(Ativo).filter(Ativo.id == id).first()
    if not ativo:
        raise HTTPException(status_code=404, detail="Equipamento não encontrado")
    
    db.delete(ativo)
    db.commit()
    return {"message": "Equipamento excluído com sucesso"}

# Rota para obter a linha do tempo de histórico de um equipamento
@app.get("/api/ativos/{id}/historico")
def obter_historico_ativo(id: int, db: Session = Depends(get_db)):
    historico = db.query(HistoricoAtivo).options(joinedload(HistoricoAtivo.colaborador)).filter(HistoricoAtivo.ativo_id == id).order_by(HistoricoAtivo.data_alteracao.desc()).all()
    
    return [
        {
            "id": h.id,
            "ativo_id": h.ativo_id,
            "status": h.status,
            "local_fisico": h.local_fisico,
            "data_alteracao": h.data_alteracao.isoformat(),
            "descricao": h.descricao,
            "colaborador": {
                "id": h.colaborador.id,
                "nome": h.colaborador.nome,
                "email": h.colaborador.email_corporativo
            } if h.colaborador else None
        } for h in historico
    ]

# Rota para importação em massa e upsert inteligente de equipamentos a partir do Excel
@app.post("/api/ativos/bulk")
def bulk_import_ativos(items: List[AtivoBulkImportItem], db: Session = Depends(get_db)):
    # Obter ou criar a empresa padrão (Empresa 1)
    empresa = db.query(Empresa).first()
    if not empresa:
        empresa = Empresa(nome="Avanço Construções")
        db.add(empresa)
        db.commit()
        db.refresh(empresa)

    created_count = 0
    updated_count = 0

    for item in items:
        # Pular linhas que não têm TAG válida
        if not item.tag_patrimonio or not item.tag_patrimonio.strip():
            continue
            
        tag_clean = item.tag_patrimonio.strip()

        # Resolver setor
        setor_id = None
        if item.setor_nome:
            setor_nome_clean = item.setor_nome.strip()
            if setor_nome_clean:
                setor = db.query(Setor).filter(Setor.nome.ilike(setor_nome_clean)).first()
                if not setor:
                    setor = Setor(nome=setor_nome_clean, empresa_id=empresa.id)
                    db.add(setor)
                    db.commit()
                    db.refresh(setor)
                setor_id = setor.id

        # Resolver colaborador
        colaborador_id = None
        if item.colaborador_nome:
            colab_nome_clean = item.colaborador_nome.strip()
            # Ignorar palavras reservadas de planilhas como "CELULARES" ou "SOMENTE LINHA" como colaboradores reais
            if colab_nome_clean and colab_nome_clean.upper() not in ["CELULARES", "SOMENTE LINHA", "LINHA", "DISPONÍVEL", "ESTOQUE"]:
                colab = db.query(Colaborador).filter(Colaborador.nome.ilike(colab_nome_clean)).first()
                if not colab:
                    # Criar email limpo e único
                    email_clean = colab_nome_clean.lower().replace(" ", ".") + "@avancoconstrucoes.com.br"
                    existing_email = db.query(Colaborador).filter(Colaborador.email_corporativo == email_clean).first()
                    if existing_email:
                        # Adicionar timestamp microscópico para diferenciar
                        email_clean = colab_nome_clean.lower().replace(" ", ".") + f"{datetime.now().microsecond}@avancoconstrucoes.com.br"
                        
                    colab = Colaborador(
                        nome=colab_nome_clean,
                        email_corporativo=email_clean,
                        setor_id=setor_id,
                        status="Ativo"
                    )
                    db.add(colab)
                    db.commit()
                    db.refresh(colab)
                colaborador_id = colab.id

        # Verificar se ativo já existe
        ativo = db.query(Ativo).filter(Ativo.tag_patrimonio == tag_clean).first()
        
        status_clean = item.status or ("Em Uso" if colaborador_id else "Estoque")
        
        # Preparar dicionário de dados do ativo
        ativo_dict = {
            "tipo": item.tipo or "OUTROS",
            "marca": item.marca or "N/A",
            "modelo": item.modelo or "N/A",
            "especificacoes": item.especificacoes or "",
            "local_fisico": item.local_fisico or "Sede Central",
            "status": status_clean,
            "licenca_windows": item.licenca_windows,
            "licenca_office": item.licenca_office,
            "valor": item.valor,
            "colaborador_id": colaborador_id,
            "numero_serie": item.numero_serie,
            "fornecedor": item.fornecedor,
            "data_aquisicao": item.data_aquisicao,
            "data_garantia": item.data_garantia
        }

        if ativo:
            # Detectar se houve mudanças importantes
            mudou_status = ativo.status != status_clean
            mudou_colab = ativo.colaborador_id != colaborador_id
            mudou_local = ativo.local_fisico != (item.local_fisico or "Sede Central")

            # Atualizar os campos do ativo existente
            for k, v in ativo_dict.items():
                setattr(ativo, k, v)
            
            db.commit()
            db.refresh(ativo)
            updated_count += 1

            # Gravar histórico caso haja alteração significativa
            if mudou_status or mudou_colab or mudou_local:
                hist_desc = "Equipamento atualizado via importação em massa do Excel."
                hist = HistoricoAtivo(
                    ativo_id=ativo.id,
                    colaborador_id=colaborador_id,
                    status=status_clean,
                    local_fisico=ativo.local_fisico,
                    descricao=hist_desc
                )
                db.add(hist)
                db.commit()
        else:
            # Criar novo ativo
            novo_ativo = Ativo(
                tag_patrimonio=tag_clean,
                **ativo_dict
            )
            db.add(novo_ativo)
            db.commit()
            db.refresh(novo_ativo)
            created_count += 1

            # Gravar histórico de cadastro inicial
            hist = HistoricoAtivo(
                ativo_id=novo_ativo.id,
                colaborador_id=colaborador_id,
                status=status_clean,
                local_fisico=novo_ativo.local_fisico,
                descricao="Equipamento cadastrado e configurado via importação do Excel."
            )
            db.add(hist)
            db.commit()

    return {"message": f"Importação concluída. {created_count} ativos criados, {updated_count} ativos atualizados."}


@app.get("/api/colaboradores")
def listar_colaboradores(db: Session = Depends(get_db)):
    colaboradores = db.query(Colaborador).all()
    return [
        {
            "id": c.id, 
            "nome": c.nome, 
            "email": c.email_corporativo, 
            "status": c.status, 
            "setor_id": c.setor_id,
            "setor": c.setor.nome if c.setor else None
        } for c in colaboradores
    ]

@app.put("/api/colaboradores/{colaborador_id}")
def atualizar_colaborador(colaborador_id: int, data: ColaboradorUpdate, db: Session = Depends(get_db)):
    db_colab = db.query(Colaborador).filter(Colaborador.id == colaborador_id).first()
    if not db_colab:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado")
    
    update_data = data.dict(exclude_unset=True)
    if "email_corporativo" in update_data:
        db_colab.email_corporativo = update_data["email_corporativo"] if update_data["email_corporativo"] else None
    if "nome" in update_data:
        db_colab.nome = update_data["nome"]
    if "setor_id" in update_data:
        db_colab.setor_id = update_data["setor_id"]
    if "status" in update_data:
        db_colab.status = update_data["status"]
    
    db.commit()
    db.refresh(db_colab)
    return db_colab

# Rota para cadastrar um novo colaborador
@app.post("/api/colaboradores")
def criar_colaborador(colab: ColaboradorCreate, db: Session = Depends(get_db)):
    email = colab.email_corporativo if colab.email_corporativo else None

    if email:
        if db.query(Colaborador).filter(Colaborador.email_corporativo == email).first():
            raise HTTPException(status_code=400, detail="E-mail corporativo já cadastrado para outro colaborador.")

    novo_colab = Colaborador(
        nome=colab.nome,
        email_corporativo=email,
        setor_id=colab.setor_id,
        status=colab.status or "Ativo"
    )
    db.add(novo_colab)
    db.commit()
    db.refresh(novo_colab)
    return novo_colab

# Rota para excluir um colaborador e liberar/desatribuir seus ativos associados de forma inteligente
@app.delete("/api/colaboradores/{colaborador_id}")
def deletar_colaborador(colaborador_id: int, db: Session = Depends(get_db)):
    colab = db.query(Colaborador).filter(Colaborador.id == colaborador_id).first()
    if not colab:
        raise HTTPException(status_code=404, detail="Colaborador não encontrado")
    
    # Buscar e tratar ativos que estavam sob a responsabilidade dele
    ativos_associados = db.query(Ativo).filter(Ativo.colaborador_id == colaborador_id).all()
    for ativo in ativos_associados:
        ativo.colaborador_id = None
        ativo.status = "Estoque" # Retorna para estoque
        
        # Logar a movimentação automática no histórico do ativo
        hist = HistoricoAtivo(
            ativo_id=ativo.id,
            colaborador_id=None,
            status="Estoque",
            local_fisico=ativo.local_fisico,
            descricao=f"Desatribuição automática: Colaborador '{colab.nome}' foi excluído do sistema. O equipamento retornou ao Estoque."
        )
        db.add(hist)
    
    db.delete(colab)
    db.commit()
    return {"message": f"Colaborador {colab.nome} excluído com sucesso e ativos liberados para o Estoque."}

@app.get("/api/setores")
def listar_setores(db: Session = Depends(get_db)):
    return db.query(Setor).all()

# --- 6. ENDPOINTS DE CONTRATOS DE TI ---

def _serializar_contrato(c: Contrato) -> dict:
    return {
        "id": c.id,
        "numero_contrato": c.numero_contrato,
        "titulo": c.titulo,
        "tipo": c.tipo,
        "fornecedor": c.fornecedor,
        "contato_fornecedor": c.contato_fornecedor,
        "telefone_fornecedor": c.telefone_fornecedor,
        "email_fornecedor": c.email_fornecedor,
        "data_inicio": c.data_inicio.isoformat() if c.data_inicio else None,
        "data_vencimento": c.data_vencimento.isoformat() if c.data_vencimento else None,
        "valor_mensal": float(c.valor_mensal) if c.valor_mensal else None,
        "valor_anual": float(c.valor_anual) if c.valor_anual else None,
        "valor_total": float(c.valor_total) if c.valor_total else None,
        "status": c.status,
        "descricao": c.descricao,
        "observacoes": c.observacoes,
        "responsavel_interno": c.responsavel_interno,
        "renovacao_automatica": c.renovacao_automatica,
        "prazo_aviso_dias": c.prazo_aviso_dias,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }

def _auto_vencer_contratos(db: Session):
    hoje = date.today()
    expirados = db.query(Contrato).filter(
        Contrato.status == "Ativo",
        Contrato.data_vencimento < hoje
    ).all()
    for c in expirados:
        c.status = "Vencido"
    if expirados:
        db.commit()

@app.get("/api/contratos/stats")
def stats_contratos(db: Session = Depends(get_db)):
    _auto_vencer_contratos(db)
    hoje = date.today()
    trinta_dias = hoje + timedelta(days=30)
    sessenta_dias = hoje + timedelta(days=60)

    total = db.query(Contrato).count()
    ativos = db.query(Contrato).filter(Contrato.status == "Ativo").count()
    vencidos = db.query(Contrato).filter(Contrato.status == "Vencido").count()
    cancelados = db.query(Contrato).filter(Contrato.status == "Cancelado").count()
    em_renovacao = db.query(Contrato).filter(Contrato.status == "Em Renovação").count()

    vencendo_30d = db.query(Contrato).filter(
        Contrato.status == "Ativo",
        Contrato.data_vencimento >= hoje,
        Contrato.data_vencimento <= trinta_dias
    ).count()

    vencendo_60d = db.query(Contrato).filter(
        Contrato.status == "Ativo",
        Contrato.data_vencimento >= hoje,
        Contrato.data_vencimento <= sessenta_dias
    ).count()

    contratos_ativos_list = db.query(Contrato).filter(Contrato.status == "Ativo").all()
    valor_anual_total = sum(
        float(c.valor_anual or (float(c.valor_mensal) * 12 if c.valor_mensal else 0))
        for c in contratos_ativos_list
    )

    return {
        "total": total,
        "ativos": ativos,
        "vencidos": vencidos,
        "cancelados": cancelados,
        "em_renovacao": em_renovacao,
        "vencendo_30d": vencendo_30d,
        "vencendo_60d": vencendo_60d,
        "valor_anual_total": round(valor_anual_total, 2),
    }

@app.get("/api/contratos")
def listar_contratos(
    status: Optional[str] = None,
    tipo: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    _auto_vencer_contratos(db)
    query = db.query(Contrato)

    if status and status != "Todos":
        query = query.filter(Contrato.status == status)
    if tipo and tipo != "Todos":
        query = query.filter(Contrato.tipo == tipo)
    if search:
        query = query.filter(or_(
            Contrato.titulo.ilike(f"%{search}%"),
            Contrato.fornecedor.ilike(f"%{search}%"),
            Contrato.numero_contrato.ilike(f"%{search}%"),
            Contrato.responsavel_interno.ilike(f"%{search}%"),
        ))

    contratos = query.order_by(Contrato.data_vencimento.asc()).all()
    return [_serializar_contrato(c) for c in contratos]

@app.post("/api/contratos")
def criar_contrato(contrato: ContratoCreate, db: Session = Depends(get_db)):
    hoje = date.today()
    status_final = contrato.status or "Ativo"
    if contrato.data_vencimento < hoje and status_final == "Ativo":
        status_final = "Vencido"

    novo = Contrato(
        numero_contrato=contrato.numero_contrato,
        titulo=contrato.titulo,
        tipo=contrato.tipo,
        fornecedor=contrato.fornecedor,
        contato_fornecedor=contrato.contato_fornecedor,
        telefone_fornecedor=contrato.telefone_fornecedor,
        email_fornecedor=contrato.email_fornecedor,
        data_inicio=contrato.data_inicio,
        data_vencimento=contrato.data_vencimento,
        valor_mensal=contrato.valor_mensal,
        valor_anual=contrato.valor_anual,
        valor_total=contrato.valor_total,
        status=status_final,
        descricao=contrato.descricao,
        observacoes=contrato.observacoes,
        responsavel_interno=contrato.responsavel_interno,
        renovacao_automatica=contrato.renovacao_automatica or False,
        prazo_aviso_dias=contrato.prazo_aviso_dias or 30,
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return _serializar_contrato(novo)

@app.put("/api/contratos/{id}")
def atualizar_contrato(id: int, data: ContratoUpdate, db: Session = Depends(get_db)):
    contrato = db.query(Contrato).filter(Contrato.id == id).first()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")

    update_data = data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(contrato, key, value)
    contrato.updated_at = datetime.now()

    db.commit()
    db.refresh(contrato)
    return _serializar_contrato(contrato)

@app.delete("/api/contratos/{id}")
def deletar_contrato(id: int, db: Session = Depends(get_db)):
    contrato = db.query(Contrato).filter(Contrato.id == id).first()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")
    db.delete(contrato)
    db.commit()
    return {"message": "Contrato excluído com sucesso"}


# --- 7. ENDPOINTS DE RELATÓRIOS ---

@app.get("/api/reports/valor-por-setor")
def relatorio_valor_por_setor(db: Session = Depends(get_db)):
    # Este relatório agrupa o valor dos ativos pelo setor do colaborador
    ativos = db.query(Ativo).all()
    report = {}
    for a in ativos:
        setor_nome = "Sem Setor"
        if a.colaborador and a.colaborador.setor:
            setor_nome = a.colaborador.setor.nome
        
        report[setor_nome] = report.get(setor_nome, 0) + float(a.valor or 0)
    
    return [{"setor": k, "valor": v} for k, v in report.items()]

@app.get("/api/reports/ativos-por-tipo")
def relatorio_ativos_por_tipo(db: Session = Depends(get_db)):
    ativos = db.query(Ativo).all()
    report = {}
    for a in ativos:
        tipo = a.tipo or "Não Definido"
        report[tipo] = report.get(tipo, 0) + 1

    return [{"tipo": k, "quantidade": v} for k, v in report.items()]

@app.get("/api/reports/garantia-status")
def relatorio_garantia_status(db: Session = Depends(get_db)):
    hoje = date.today()
    trinta_dias = hoje + timedelta(days=30)

    vencida = db.query(Ativo).filter(
        Ativo.data_garantia != None,
        Ativo.data_garantia < hoje,
        Ativo.status != "Descartado"
    ).count()

    vencendo = db.query(Ativo).filter(
        Ativo.data_garantia != None,
        Ativo.data_garantia >= hoje,
        Ativo.data_garantia <= trinta_dias
    ).count()

    ativa = db.query(Ativo).filter(
        Ativo.data_garantia != None,
        Ativo.data_garantia > trinta_dias
    ).count()

    sem_registro = db.query(Ativo).filter(
        Ativo.data_garantia == None,
        Ativo.status != "Descartado"
    ).count()

    return [
        {"status": "Ativa", "quantidade": ativa},
        {"status": "Vencendo (30d)", "quantidade": vencendo},
        {"status": "Vencida", "quantidade": vencida},
        {"status": "Sem Registro", "quantidade": sem_registro},
    ]


# --- SERVE FRONTEND REACT (produção) ---
# Deve ser o ÚLTIMO mount — captura tudo que não casou com rotas /api
from fastapi.staticfiles import StaticFiles as _StaticFiles

_dist_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist")
if os.path.isdir(_dist_dir):
    app.mount("/", _StaticFiles(directory=_dist_dir, html=True), name="frontend")