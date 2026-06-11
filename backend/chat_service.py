from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from groq import Groq
import os
from dotenv import load_dotenv
from sqlalchemy.orm import joinedload

# Garante o carregamento das variáveis do arquivo .env antes de inicializar o cliente Groq
load_dotenv()

# Inicializa o roteador para o FastAPI
router = APIRouter(prefix="/api/ia", tags=["Inteligência Artificial"])

# Inicializa o cliente da Groq buscando a chave do arquivo .env
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Estrutura de dados que o frontend vai enviar (ex: {"mensagem": "Olá"})
class ChatRequest(BaseModel):
    mensagem: str

def obter_dados_completos_banco():
    """
    Carrega registros do banco de dados (Ativos, Colaboradores) de forma otimizada
    e formata-os em formato super compacto (pipe-separated) com relacionamento direto
    de setores e e-mails para evitar atingir limites de tokens (TPM) da IA.
    """
    def c(val):
        """Auxiliar para limpar, encurtar e remover caracteres corrompidos na serialização"""
        if val is None:
            return ""
        s = str(val).strip()
        s = s.replace("\uFFFD", "")  # Remove caractere de substituição Unicode corrompido
        if s.upper() in ["N/A", "NONE", "NULL", "SEM ATRIBUIÇÃO", "DISPONÍVEL EM ESTOQUE"]:
            return ""
        
        # Abreviações inteligentes para economizar precioso espaço de tokens
        abrev = {
            "NOTEBOOK": "NTB",
            "MONITOR": "MON",
            "CELULAR": "CEL",
            "LENOVO": "LNV",
            "HEWLETT-PACKARD": "HP",
            "SAMSUNGBOOK": "SAM",
            "SAMSUNG": "SAM",
            "MOTOROLA": "MOT",
            "PHILIPS": "PHL",
            "INTELBRAS": "ITB",
            "Em Uso": "Uso",
            "Estoque": "Est",
            "Manutenção": "Man",
            "Escritório Avanço": "Escritório",
            "Sede Central": "Sede",
            "AVANÇO CONSTRUÇÕES": "Avanço",
            "Avanço Construções": "Avanço",
        }
        return abrev.get(s, s)

    try:
        from APP import SessionLocal, Ativo, Colaborador, SolicitacaoCompra
        db = SessionLocal()
        try:
            # 1. Carrega dados de forma eficiente com joins para evitar queries N+1
            colaboradores = db.query(Colaborador).options(joinedload(Colaborador.setor)).all()
            ativos = db.query(Ativo).options(joinedload(Ativo.colaborador).joinedload(Colaborador.setor)).all()
            solicitacoes = db.query(SolicitacaoCompra).all()
            
            # IDs de colaboradores vinculados a algum ativo
            colabs_ativos_ids = {a.colaborador_id for a in ativos if a.colaborador_id is not None}
            
            # 2. Estatísticas Consolidadas
            def _qtd(a): return (a.quantidade or 1) if a.tipo == "TONER" else 1
            total_ativos = sum(_qtd(a) for a in ativos)
            total_colabs = len(colaboradores)
            ativos_em_uso = sum(_qtd(a) for a in ativos if a.status == "Em Uso")
            ativos_estoque = sum(_qtd(a) for a in ativos if a.status == "Estoque")
            ativos_manutencao = sum(_qtd(a) for a in ativos if a.status == "Manutenção")
            
            # Contagem de tipos
            tipos_dict = {}
            for a in ativos:
                tipo_str = a.tipo or "OUTROS"
                tipos_dict[tipo_str] = tipos_dict.get(tipo_str, 0) + 1
            contagem_tipos = ", ".join([f"{k}: {v}" for k, v in tipos_dict.items()])
            
            # Soma dos valores
            soma_valor = sum(float(a.valor) for a in ativos if a.valor is not None)
            
            # 3. Formata Contatos/E-mails (Apenas colaboradores que possuem e-mail válido)
            lista_emails = []
            for colab in colaboradores:
                if colab.email_corporativo and colab.email_corporativo.strip():
                    lista_emails.append(f"{c(colab.nome)}: {c(colab.email_corporativo)}")
            emails_str = "\n".join(lista_emails)
            
            # 4. Formata Colaboradores Sem Ativos (Apenas inativos para economizar espaço de tokens)
            lista_colabs = ["NOME|SETOR"]
            for colab in colaboradores:
                if colab.id not in colabs_ativos_ids:
                    setor_nome = colab.setor.nome if colab.setor else ""
                    lista_colabs.append(f"{c(colab.nome)}|{c(setor_nome)}")
            colabs_str = "\n".join(lista_colabs)
            
            # 5. Formata Ativos (Formato Ultra Compacto com Responsável, Setor integrados por linha)
            lista_ativos = ["TAG|MARCA|MODELO|STATUS|RESPONSÁVEL|SETOR"]
            for a in ativos:
                colab_nome = a.colaborador.nome if a.colaborador else ""
                setor_nome = a.colaborador.setor.nome if (a.colaborador and a.colaborador.setor) else ""
                
                lista_ativos.append(
                    f"{c(a.tag_patrimonio)}|{c(a.marca)}|{c(a.modelo)}|{c(a.status)}|"
                    f"{c(colab_nome)}|{c(setor_nome)}"
                )
            ativos_str = "\n".join(lista_ativos)
            
            # 6. Formata Solicitações de Aquisição (apenas em aberto e recentes)
            sol_em_aberto = [s for s in solicitacoes if s.status in ("Aguard. Aprovação", "Aprovado", "Em Cotação", "Em Aquisição")]
            sol_recebidos = [s for s in solicitacoes if s.status == "Recebido"]
            sol_valor_comprometido = sum(float(s.valor_aprovado or s.valor_estimado or 0) for s in sol_em_aberto)
            sol_valor_gasto = sum(float(s.valor_final or s.valor_aprovado or s.valor_estimado or 0) for s in sol_recebidos)
            lista_sol = ["Nº|TÍTULO|CATEG|PRIOR|STATUS|SOLICITANTE|VALOR_EST"]
            for s in sol_em_aberto[:20]:
                lista_sol.append(
                    f"{c(s.numero_solicitacao)}|{c(s.titulo)}|{c(s.categoria)}|"
                    f"{c(s.prioridade)}|{c(s.status)}|{c(s.solicitante)}|"
                    f"R${float(s.valor_estimado or 0):,.0f}"
                )
            sol_str = "\n".join(lista_sol)

            contexto = (
                f"=== ESTATÍSTICAS GERAIS DO INVENTÁRIO ===\n"
                f"- Total de Equipamentos Cadastrados: {total_ativos}\n"
                f"- Total de Colaboradores Cadastrados: {total_colabs}\n"
                f"- Equipamentos Em Uso: {ativos_em_uso}\n"
                f"- Equipamentos Em Estoque: {ativos_estoque}\n"
                f"- Equipamentos em Manutenção: {ativos_manutencao}\n"
                f"- Equipamentos por Categoria: {contagem_tipos}\n"
                f"- Valor Total do Inventário: R$ {soma_valor:,.2f}\n\n"

                f"=== AQUISIÇÕES DE MATERIAL ===\n"
                f"- Total de Solicitações: {len(solicitacoes)}\n"
                f"- Em Aberto (aguardando/aprovado/cotação/aquisição): {len(sol_em_aberto)}\n"
                f"- Recebidas: {len(sol_recebidos)}\n"
                f"- Valor Comprometido (em andamento): R$ {sol_valor_comprometido:,.2f}\n"
                f"- Valor Total Gasto (recebidos): R$ {sol_valor_gasto:,.2f}\n\n"

                f"=== SOLICITAÇÕES EM ABERTO ===\n"
                f"{sol_str}\n\n"

                f"=== EMAILS DE CONTATO ===\n"
                f"{emails_str}\n\n"

                f"=== COLABORADORES CADASTRADOS SEM EQUIPAMENTO ATRIBUÍDO ===\n"
                f"{colabs_str}\n\n"

                f"=== ATIVOS / EQUIPAMENTOS ===\n"
                f"{ativos_str}\n"
            )
            return contexto
            
        finally:
            db.close()
    except Exception as e:
        return f"Não foi possível obter dados completos do inventário: {str(e)}"

# Ordem de preferência dos modelos — tenta o próximo se o anterior falhar
GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "llama3-8b-8192",
    "gemma2-9b-it",
]

@router.post("/conversar")
async def conversar_com_groq(request: ChatRequest):
    # Carrega a base inteira em tempo real antes de enviar para a IA
    contexto_completo = obter_dados_completos_banco()

    system_prompt = (
        "Você é o Assistente Virtual Especialista de Inventário de TI (ITAM) da Avanço Construções.\n"
        "Diretrizes RÍGIDAS de comportamento (Engenharia de Prompt):\n"
        "1. OBJETIVIDADE CRÍTICA: Não faça rodeios, introduções, saudações (como 'Olá', 'Bom dia', 'Tudo bem?'), nem encerramentos cordiais (como 'Espero ter ajudado' ou 'Estou à disposição'). Inicie a resposta diretamente com o dado ou informação solicitada.\n"
        "2. CONCISÃO EXTREMA: Forneça a resposta mais enxuta possível. Use listas em tópicos (bullet points) ou tabelas curtas em Markdown. Remova qualquer palavra, frase ou preâmbulo que não adicione valor informativo direto.\n"
        "3. TOM TÉCNICO E SECO: Fale em Português do Brasil de forma extremamente séria, factual, direta e técnica.\n"
        "4. FOCO ABSOLUTO E 100% DE FIDELIDADE: Responda baseado EXCLUSIVAMENTE nos dados abaixo. Nunca invente ativos, nomes, status ou números. Se perguntarem sobre algo que não está na lista abaixo, diga secamente: 'Registro não localizado no banco de dados.'\n"
        "5. NUNCA EXPLIQUE O SEU PROCESSO: Não diga 'Consultando o banco...', 'Com base nas estatísticas...', ou 'Aqui estão as informações...'. Apenas exiba as informações.\n"
        "6. ESTRUTURA DOS DADOS: Os dados de colaboradores e de ativos estão em tabelas delimitadas por barras (|). A primeira linha é o cabeçalho. Valores em branco = não informado (N/A).\n"
        "7. DICIONÁRIO DE ABREVIAÇÕES: NTB=Notebook, MON=Monitor, CEL=Celular; LNV=Lenovo, SAM=Samsung, PHL=Philips, ITB=Intelbras; Uso=Em Uso, Est=Estoque, Man=Manutenção.\n\n"
        f"{contexto_completo}\n"
    )

    ultimo_erro = None
    for modelo in GROQ_MODELS:
        try:
            completion = client.chat.completions.create(
                model=modelo,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": request.mensagem},
                ],
                temperature=0.0,
                max_tokens=1500,
            )
            resposta_texto = completion.choices[0].message.content
            return {"resposta": resposta_texto}

        except Exception as e:
            ultimo_erro = e
            # Se for erro de modelo não encontrado / deprecado, tenta o próximo
            erro_str = str(e).lower()
            if any(k in erro_str for k in ("model", "not found", "deprecated", "does not exist", "invalid")):
                continue
            # Qualquer outro erro (rate limit, autenticação, rede) — falha imediata
            break

    # Todos os modelos falharam — retorna detalhe do erro para ajudar no diagnóstico
    raise HTTPException(
        status_code=500,
        detail=f"Assistente indisponível: {str(ultimo_erro)}"
    )