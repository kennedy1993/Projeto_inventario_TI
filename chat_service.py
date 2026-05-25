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
    Carrega TODOS os registros do banco de dados (Ativos, Colaboradores, Setores, Empresas)
    e formata-os de maneira estruturada e compacta para alimentar a IA com 100% da verdade dos dados.
    """
    try:
        from APP import SessionLocal, Ativo, Colaborador, Setor, Empresa
        db = SessionLocal()
        try:
            # 1. Carrega todas as tabelas com joins adequados para evitar N+1 queries
            empresas = db.query(Empresa).all()
            setores = db.query(Setor).options(joinedload(Setor.empresa)).all()
            colaboradores = db.query(Colaborador).options(joinedload(Colaborador.setor)).all()
            ativos = db.query(Ativo).options(joinedload(Ativo.colaborador)).all()
            
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
            
            # 3. Formata Empresas e Setores
            empresas_map = {e.id: e.nome for e in empresas}
            lista_setores = []
            for s in setores:
                emp_nome = empresas_map.get(s.empresa_id, "N/A")
                lista_setores.append(f"Setor ID {s.id}: {s.nome} (Empresa: {emp_nome})")
            setores_str = "\n".join(lista_setores)
            
            # 4. Formata Colaboradores
            lista_colabs = []
            for c in colaboradores:
                setor_nome = c.setor.nome if c.setor else "N/A"
                lista_colabs.append(
                    f"Colaborador ID {c.id}: {c.nome} | E-mail: {c.email_corporativo or 'N/A'} | "
                    f"Status: {c.status} | Setor: {setor_nome}"
                )
            colabs_str = "\n".join(lista_colabs)
            
            # 5. Formata Ativos
            lista_ativos = []
            for a in ativos:
                colab_nome = a.colaborador.nome if a.colaborador else "Disponível em Estoque"
                valor_f = f"R$ {float(a.valor):,.2f}" if a.valor is not None else "N/A"
                lista_ativos.append(
                    f"TAG: {a.tag_patrimonio} | Tipo: {a.tipo or 'N/A'} | Marca: {a.marca or 'N/A'} | "
                    f"Modelo: {a.modelo or 'N/A'} | Status: {a.status or 'N/A'} | Responsável: {colab_nome} | "
                    f"Local: {a.local_fisico or 'N/A'} | Valor: {valor_f} | Win: {a.licenca_windows or 'N/A'} | "
                    f"Office: {a.licenca_office or 'N/A'} | Specs: {a.especificacoes or 'N/A'}"
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
                
                f"=== SETORES E DEPARTAMENTOS ===\n"
                f"{setores_str}\n\n"
                
                f"=== CADASTRO COMPLETO DE COLABORADORES ===\n"
                f"{colabs_str}\n\n"
                
                f"=== CADASTRO COMPLETO DE ATIVOS / EQUIPAMENTOS ===\n"
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
            "5. NUNCA EXPLIQUE O SEU PROCESSO: Não diga 'Consultando o banco...', 'Com base nas estatísticas...', ou 'Aqui estão as informações...'. Apenas exiba as informações.\n\n"
            f"{contexto_completo}\n"
        )

        # Chamada para a API da Groq utilizando o modelo LLaMA 3.3 70B
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
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