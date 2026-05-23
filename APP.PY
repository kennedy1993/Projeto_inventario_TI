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

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Numeric, ForeignKey, Date, DateTime, or_
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship, joinedload
from pydantic import BaseModel, ConfigDict, field_validator
from typing import List, Optional, Any
from datetime import datetime

# --- 1. CONFIGURAÇÃO DO BANCO DE DADOS POSTGRESQL ---
# Altere as credenciais (utilizador, palavra-passe, host, nome_do_banco)
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:30209713@localhost:5432/itam_avanco?application_name=itam_api"

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

# Criar as tabelas no banco de dados automaticamente (após as tabelas estarem definidas no script Python)
Base.metadata.create_all(bind=engine)


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
    return {
        "error": "Internal Server Error",
        "detail": str(exc)
    }

# Configuração de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Em produção, colocar o domínio do front-end
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    total = db.query(Ativo).count()
    em_uso = db.query(Ativo).filter(Ativo.status == "Em Uso").count()
    estoque = db.query(Ativo).filter(Ativo.status == "Estoque").count()
    
    # Calcular valor total do inventário
    valor_total = db.query(Ativo.valor).all()
    soma_valor = sum([float(v[0]) for v in valor_total if v[0] is not None])
    
    return {
        "total_ativos": total,
        "ativos_em_uso": em_uso,
        "ativos_estoque": estoque,
        "valor_total": soma_valor
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
            "colaborador_id": colaborador_id
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
        db_colab.email_corporativo = update_data["email_corporativo"]
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
    # Validar duplicidade de e-mail corporativo (se preenchido)
    if colab.email_corporativo:
        db_colab = db.query(Colaborador).filter(Colaborador.email_corporativo == colab.email_corporativo).first()
        if db_colab:
            raise HTTPException(status_code=400, detail="E-mail corporativo já cadastrado para outro colaborador.")
            
    novo_colab = Colaborador(
        nome=colab.nome,
        email_corporativo=colab.email_corporativo,
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

# --- 6. ENDPOINTS DE RELATÓRIOS ---

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