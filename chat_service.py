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
        from APP import SessionLocal, Ativo, Colaborador, Setor, Empresa
        db = SessionLocal()
        try:
            # 1. Carrega dados de forma eficiente com joins para evitar queries N+1
            colaboradores = db.query(Colaborador).all()
            ativos = db.query(Ativo).options(joinedload(Ativo.colaborador).joinedload(Colaborador.setor)).all()
            
            # 2. Estatísticas Consolidadas
            total_ativos = len(ativos)
            ativos_em_uso = sum(1 for a in ativos if a.status == "Em Uso")
            ativos_estoque = sum(1 for a in ativos if a.status == "Estoque")
            ativos_manutencao = sum(1 for a in ativos if a.status == "Manutenção")
            
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
            
            # 4. Formata Ativos (Formato Ultra Compacto com Responsável, Setor integrados por linha)
            lista_ativos = ["TAG|MARCA|MODELO|STATUS|RESPONSÁVEL|SETOR"]
            for a in ativos:
                colab_nome = a.colaborador.nome if a.colaborador else ""
                setor_nome = a.colaborador.setor.nome if (a.colaborador and a.colaborador.setor) else ""
                
                lista_ativos.append(
                    f"{c(a.tag_patrimonio)}|{c(a.marca)}|{c(a.modelo)}|{c(a.status)}|"
                    f"{c(colab_nome)}|{c(setor_nome)}"
                )
            ativos_str = "\n".join(lista_ativos)
            
            contexto = (
                f"=== ESTATÍSTICAS GERAIS DO INVENTÁRIO ===\n"
                f"- Total de Equipamentos Cadastrados: {total_ativos}\n"
                f"- Equipamentos Em Uso: {ativos_em_uso}\n"
                f"- Equipamentos Em Estoque: {ativos_estoque}\n"
                f"- Equipamentos em Manutenção: {ativos_manutencao}\n"
                f"- Equipamentos por Categoria: {contagem_tipos}\n"
                f"- Valor Total do Inventário: R$ {soma_valor:,.2f}\n\n"
                
                f"=== EMAILS DE CONTATO ===\n"
                f"{emails_str}\n\n"
                
                f"=== ATIVOS / EQUIPAMENTOS ===\n"
                f"{ativos_str}\n"
            )
            return contexto
            
        finally:
            db.close()
    except Exception as e:
        return f"Não foi possível obter dados completos do inventário: {str(e)}"

@router.post("/conversar")
async def conversar_com_groq(request: ChatRequest):
    try:
        # Carrega a base inteira em tempo real antes de enviar para a IA
        contexto_completo = obter_dados_completos_banco()
        
        # Cria o prompt do sistema altamente otimizado por engenharia de prompts para máxima concisão e objetividade
        system_prompt = (
            "Você é o Assistente Virtual Especialista de Inventário de TI (ITAM) da Avanço Construções.\n"
            "Diretrizes RÍGIDAS de comportamento (Engenharia de Prompt):\n"
            "1. OBJETIVIDADE CRÍTICA: Não faça rodeios, introduções, saudações (como 'Olá', 'Bom dia', 'Tudo bem?'), nem encerramentos cordiais (como 'Espero ter ajudado' ou 'Estou à disposição'). Inicie a resposta diretamente com o dado ou informação solicitada.\n"
            "2. CONCISÃO EXTREMA: Forneça a resposta mais enxuta possível. Use listas em tópicos (bullet points) ou tabelas curtas in Markdown. Remova qualquer palavra, frase ou preâmbulo que não adicione valor informativo direto.\n"
            "3. TOM TÉCNICO E SECO: Fale em Português do Brasil de forma extremamente séria, factual, direta e técnica.\n"
            "4. FOCO ABSOLUTO E 100% DE FIDELIDADE: Responda baseado EXCLUSIVAMENTE nos dados abaixo. Nunca invente ativos, nomes, status ou números. Se perguntarem sobre algo que não está na lista abaixo, diga secamente: 'Registro não localizado no banco de dados.'\n"
            "5. NUNCA EXPLIQUE O SEU PROCESSO: Não diga 'Consultando o banco...', 'Com base nas estatísticas...', ou 'Aqui estão as informações...'. Apenas exiba as informações.\n"
            "6. ESTRUTURA DOS DADOS: Os dados de ativos estão em uma tabela delimitada por barras (|), contendo a TAG, marca, modelo, status, responsável e setor. A primeira linha representa o cabeçalho. Considere valores em branco/vazios como não informados ou não aplicáveis (N/A).\n"
            "7. DICIONÁRIO DE ABREVIAÇÕES: Para interpretar as tags e dados, considere: as tags começam com a categoria do ativo (NTB=Notebook, MON=Monitor, CEL=Celular); marcas LNV=Lenovo, SAM=Samsung, PHL=Philips, ITB=Intelbras; status Uso=Em Uso, Est=Estoque, Man=Manutenção.\n\n"
            f"{contexto_completo}\n"
        )

        # Chamada para a API da Groq utilizando o modelo LLaMA 3.1 8B (Ideal para alta velocidade e cota de uso estável)
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": request.mensagem
                }
            ],
            temperature=0.0,  # Temperatura ZERO garante que o modelo seja absolutamente determinístico e use apenas os fatos informados
            max_tokens=1500,  # Espaço suficiente para listas grandes se necessário
        )

        # Extrai o texto da resposta da IA
        resposta_texto = completion.choices[0].message.content
        return {"resposta": resposta_texto}

    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Erro no processamento do assistente virtual: {str(e)}"
        )