from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from groq import Groq
import os
from dotenv import load_dotenv

# Garante o carregamento das variáveis do arquivo .env antes de inicializar o cliente Groq
load_dotenv()

# Inicializa o roteador para o FastAPI
router = APIRouter(prefix="/api/ia", tags=["Inteligência Artificial"])

# Inicializa o cliente da Groq buscando a chave do arquivo .env
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Estrutura de dados que o frontend vai enviar (ex: {"mensagem": "Olá"})
class ChatRequest(BaseModel):
    mensagem: str

def obter_contexto_inventario():
    """
    Busca estatísticas gerais no banco de dados para alimentar o prompt do sistema da IA.
    Usa importações dinâmicas para evitar imports circulares com o APP.py.
    """
    try:
        from APP import SessionLocal, Ativo, Colaborador, Setor
        db = SessionLocal()
        try:
            total_ativos = db.query(Ativo).count()
            ativos_em_uso = db.query(Ativo).filter(Ativo.status == "Em Uso").count()
            ativos_estoque = db.query(Ativo).filter(Ativo.status == "Estoque").count()
            ativos_manutencao = db.query(Ativo).filter(Ativo.status == "Manutenção").count()
            
            setores = db.query(Setor).all()
            colaboradores = db.query(Colaborador).all()
            
            lista_setores = [s.nome for s in setores]
            lista_colaboradores = [c.nome for c in colaboradores[:20]]  # Limita para não estourar tokens
            
            # Contagem de tipos de equipamentos cadastrados
            tipos_raw = db.query(Ativo.tipo).all()
            tipos_dict = {}
            for t in tipos_raw:
                tipo_str = t[0] or "OUTROS"
                tipos_dict[tipo_str] = tipos_dict.get(tipo_str, 0) + 1
            contagem_tipos = ", ".join([f"{k}: {v}" for k, v in tipos_dict.items()])
            
            # Calcular o valor total dos ativos no banco
            valor_total_raw = db.query(Ativo.valor).all()
            soma_valor = sum([float(v[0]) for v in valor_total_raw if v[0] is not None])
            
            contexto = (
                f"=== INVENTÁRIO EM TEMPO REAL (Estatísticas Atuais) ===\n"
                f"- Total de Equipamentos Cadastrados: {total_ativos}\n"
                f"- Equipamentos Em Uso: {ativos_em_uso}\n"
                f"- Equipamentos Em Estoque (Disponíveis): {ativos_estoque}\n"
                f"- Equipamentos em Manutenção: {ativos_manutencao}\n"
                f"- Equipamentos por Categoria: {contagem_tipos}\n"
                f"- Valor Total do Inventário: R$ {soma_valor:,.2f}\n"
                f"- Setores da Empresa Avanço: {', '.join(lista_setores)}\n"
                f"- Alguns Colaboradores: {', '.join(lista_colaboradores)}\n"
                f"Use estes números reais sempre que o usuário perguntar sobre estatísticas gerais."
            )
            return contexto
        finally:
            db.close()
    except Exception as e:
        return f"Não foi possível obter dados consolidados do inventário: {str(e)}"

def buscar_dados_extras(mensagem: str):
    """
    Varre a mensagem enviada pelo usuário procurando por termos-chave específicos,
    como categorias, marcas, status, setores, colaboradores ou tags, e realiza
    consultas cruzadas e inteligentes no banco de dados.
    """
    try:
        from APP import SessionLocal, Ativo, Colaborador, Setor
        db = SessionLocal()
        try:
            resultados = []
            mensagem_lc = mensagem.lower().strip()
            
            # 1. Identificar se o usuário está pedindo por um TIPO específico de equipamento
            tipos_mapeados = {
                "notebook": "NOTEBOOK", "notebooks": "NOTEBOOK", "laptop": "NOTEBOOK", "laptops": "NOTEBOOK",
                "monitor": "MONITOR", "monitores": "MONITOR", "tela": "MONITOR", "telas": "MONITOR",
                "celular": "CELULAR", "celulares": "CELULAR", "telefone": "CELULAR", "telefones": "CELULAR",
                "smartphone": "CELULAR", "smartphones": "CELULAR",
                "mouse": "MOUSE", "teclado": "TECLADO", "impressora": "IMPRESSORA"
            }
            
            tipo_encontrado = None
            for key, val in tipos_mapeados.items():
                if key in mensagem_lc:
                    tipo_encontrado = val
                    break
            
            # 2. Identificar se o usuário está filtrando por STATUS
            status_mapeados = {
                "estoque": "Estoque", "disponivel": "Estoque", "disponíveis": "Estoque", "estoques": "Estoque",
                "uso": "Em Uso", "utilizando": "Em Uso", "em uso": "Em Uso",
                "manutencao": "Manutenção", "manutenção": "Manutenção", "quebrado": "Manutenção", "conserto": "Manutenção",
                "descartado": "Descartado", "lixo": "Descartado"
            }
            
            status_encontrado = None
            for key, val in status_mapeados.items():
                if key in mensagem_lc:
                    status_encontrado = val
                    break

            # 3. Se identificamos TIPO ou STATUS (ou ambos), fazemos uma busca avançada nos ativos
            if tipo_encontrado or status_encontrado:
                query = db.query(Ativo)
                desc_filtros = []
                if tipo_encontrado:
                    query = query.filter(Ativo.tipo == tipo_encontrado)
                    desc_filtros.append(f"Tipo: {tipo_encontrado}")
                if status_encontrado:
                    query = query.filter(Ativo.status == status_encontrado)
                    desc_filtros.append(f"Status: {status_encontrado}")
                
                ativos_filtrados = query.all()
                if ativos_filtrados:
                    linhas = []
                    for a in ativos_filtrados[:35]:  # Limita a 35 itens para não estourar contexto
                        resp = a.colaborador.nome if a.colaborador else "Disponível em Estoque"
                        linhas.append(
                            f"- TAG {a.tag_patrimonio} | {a.marca} {a.modelo} | Status: {a.status} | "
                            f"Responsável: {resp} | Local: {a.local_fisico} | Valor: R$ {float(a.valor or 0):,.2f}"
                        )
                    
                    filtros_str = " e ".join(desc_filtros)
                    resultados.append(
                        f"[Ativos Filtrados ({filtros_str}) - Total Encontrado: {len(ativos_filtrados)}]\n" + "\n".join(linhas)
                    )

            # 4. Busca por termos específicos: marcas, colaboradores, setores e tags específicas
            palavras = mensagem.split()
            termos_busca = [p.strip(",.!?\"'();:-") for p in palavras if len(p.strip(",.!?\"'();:-")) >= 3]
            
            palavras_ignoradas = {
                "com", "para", "quem", "esta", "está", "onde", "setor", "marca", "modelo", 
                "tag", "ativo", "ativos", "quais", "temos", "sistema", "empresa", "avanco", 
                "avanço", "lista", "listar", "mostrar", "todos", "tudo"
            }
            
            for termo in termos_busca:
                termo_lower = termo.lower()
                if termo_lower in palavras_ignoradas:
                    continue
                
                # A. Buscar por Setor (Engenharia, Financeiro, etc.)
                setores = db.query(Setor).filter(Setor.nome.ilike(f"%{termo}%")).all()
                for setor in setores:
                    # Encontrar todos os ativos cujos colaboradores pertencem a este setor
                    ativos_setor = db.query(Ativo).join(Ativo.colaborador).filter(Colaborador.setor_id == setor.id).all()
                    colabs_setor = db.query(Colaborador).filter(Colaborador.setor_id == setor.id).all()
                    
                    info_colabs = [f"{c.nome} ({c.status})" for c in colabs_setor]
                    info_ativos = [f"TAG {a.tag_patrimonio} ({a.tipo} - {a.marca} {a.modelo})" for a in ativos_setor]
                    
                    resultados.append(
                        f"[Setor Encontrado] Nome: {setor.nome}\n"
                        f"- Colaboradores neste setor: {', '.join(info_colabs) if info_colabs else 'Nenhum'}\n"
                        f"- Equipamentos atribuídos a este setor: {', '.join(info_ativos) if info_ativos else 'Nenhum'}"
                    )
                
                # B. Buscar por Marcas (Dell, Lenovo, Samsung, HP, etc.)
                marcas_comuns = {"dell", "lenovo", "hp", "samsung", "apple", "lg", "positivo", "acer", "asus"}
                if termo_lower in marcas_comuns:
                    ativos_marca = db.query(Ativo).filter(Ativo.marca.ilike(f"%{termo}%")).all()
                    if ativos_marca:
                        linhas_marca = []
                        for a in ativos_marca[:15]:
                            resp = a.colaborador.nome if a.colaborador else "Disponível em Estoque"
                            linhas_marca.append(f"- TAG {a.tag_patrimonio} ({a.tipo}) | {a.modelo} | Status: {a.status} | Responsável: {resp}")
                        resultados.append(
                            f"[Equipamentos da Marca: {termo.upper()} - Total: {len(ativos_marca)}]\n" + "\n".join(linhas_marca)
                        )
                
                # C. Buscar por TAG de Patrimônio específica
                ativos_tag = db.query(Ativo).filter(Ativo.tag_patrimonio.ilike(f"%{termo}%")).all()
                for ativo in ativos_tag:
                    responsavel = ativo.colaborador.nome if ativo.colaborador else "Disponível em Estoque"
                    resultados.append(
                        f"[Equipamento por TAG] TAG: {ativo.tag_patrimonio} | Tipo: {ativo.tipo} | "
                        f"Marca/Modelo: {ativo.marca} {ativo.modelo} | Status: {ativo.status} | "
                        f"Responsável: {responsavel} | Local: {ativo.local_fisico} | "
                        f"Especificações: {ativo.especificacoes or 'N/A'} | "
                        f"Licenças: Windows {ativo.licenca_windows or 'N/A'} / Office {ativo.licenca_office or 'N/A'} | "
                        f"Valor: R$ {float(ativo.valor or 0):,.2f}"
                    )
                
                # D. Buscar por nome de Colaborador
                colaboradores = db.query(Colaborador).filter(Colaborador.nome.ilike(f"%{termo}%")).all()
                for colab in colaboradores:
                    ativos_colab = db.query(Ativo).filter(Ativo.colaborador_id == colab.id).all()
                    tags_colab = [f"TAG {a.tag_patrimonio} ({a.tipo} {a.marca} {a.modelo})" for a in ativos_colab]
                    ativos_desc = f"{', '.join(tags_colab)}" if tags_colab else "Nenhum equipamento atribuído no momento"
                    
                    resultados.append(
                        f"[Cadastro do Colaborador] Nome: {colab.nome} | E-mail: {colab.email_corporativo or 'N/A'} | "
                        f"Setor: {colab.setor.nome if colab.setor else 'N/A'} | Status: {colab.status}\n"
                        f"- Equipamentos atribuídos: {ativos_desc}"
                    )

            # Remover duplicados mantendo a ordem
            resultados_unicos = []
            for r in resultados:
                if r not in resultados_unicos:
                    resultados_unicos.append(r)
            
            if resultados_unicos:
                return "\n\n=== DADOS REAIS EXTRAÍDOS DO BANCO DE DADOS EM TEMPO REAL ===\n" + "\n\n".join(resultados_unicos)
            return None
        finally:
            db.close()
    except Exception as e:
        return f"Erro na consulta de dados de suporte: {str(e)}"

@router.post("/conversar")
async def conversar_com_groq(request: ChatRequest):
    try:
        # Carrega o contexto estático/consolidado do sistema
        contexto_inventario = obter_contexto_inventario()
        
        # Busca por termos específicos na mensagem do usuário
        contexto_busca = buscar_dados_extras(request.mensagem)
        
        # Cria o prompt do sistema informando a IA sobre o seu papel e os dados consolidados
        system_prompt = (
            "Você é o Assistente Virtual Sênior e Especialista de Inventário de TI (ITAM) da Avanço Construções.\n"
            "Seu comportamento deve seguir rigorosamente as seguintes diretrizes:\n"
            "1. OBJETIVIDADE MÁXIMA: Vá direto ao ponto. Evite rodeios, introduções longas ou saudações excessivas. Forneça respostas limpas, focadas e diretas.\n"
            "2. PROFISSIONALISMO: Comporte-se como um assistente corporativo técnico e sério. Fale em Português do Brasil de forma clara e impecável.\n"
            "3. FOCO EXCLUSIVO: Responda APENAS a dúvidas e consultas relacionadas ao inventário da empresa Avanço (ativos, tags, marcas, modelos, colaboradores, licenças e setores). Se o usuário perguntar sobre assuntos completamente alheios ao sistema ou ao inventário, recuse educadamente de forma objetiva.\n"
            "4. APRESENTAÇÃO DE DADOS: Sempre que retornar listas ou informações técnicas de equipamentos, formate em tópicos curtos ou tabelas simples para facilitar a leitura rápida.\n\n"
            f"{contexto_inventario}\n\n"
        )
        
        # Se encontrou dados específicos sobre ativos/colaboradores que o usuário perguntou, insere no prompt
        if contexto_busca:
            system_prompt += (
                "ATENÇÃO: O usuário fez uma pergunta sobre um ativo ou colaborador específico. "
                "Para ajudá-lo de forma cirúrgica e precisa, foram extraídos estes registros reais do banco PostgreSQL:\n"
                f"{contexto_busca}\n"
                "Formule sua resposta com base estritamente nesses dados reais, indicando os status, marcas, nomes e setores correspondentes de maneira extremamente profissional e sem adivinhações."
            )
        else:
            system_prompt += (
                "Instrução: Caso o usuário tenha perguntado sobre um colaborador ou TAG específica que não está no resumo inicial, diga de forma direta "
                "que não localizou o registro no banco de dados e oriente-o a informar a TAG exata ou o nome completo do colaborador para consulta."
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
            temperature=0.6,  # Temperatura ligeiramente menor para manter a IA mais factual e precisa
            max_tokens=1024,
        )

        # Extrai o texto da resposta da IA
        resposta_texto = completion.choices[0].message.content
        return {"resposta": resposta_texto}

    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Erro no processamento do assistente virtual: {str(e)}"
        )