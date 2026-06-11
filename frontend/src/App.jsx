import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LayoutDashboard,
  Monitor,
  Users,
  Plus,
  Search,
  Box,
  HardDrive,
  CheckCircle2,
  Package,
  X,
  FileSpreadsheet,
  FileText,
  Filter,
  BarChart3,
  Edit2,
  Trash2,
  UploadCloud,
  Clock,
  AlertTriangle,
  Info,
  DollarSign,
  Briefcase,
  Layers,
  MapPin,
  Sparkles,
  ChevronRight,
  MessageSquare,
  Send,
  Smartphone,
  Calendar,
  ShieldCheck,
  ShieldOff,
  Shield,
  TrendingUp,
  Wrench,
  ScrollText,
  Building2,
  Phone,
  CalendarX2,
  BadgeCheck,
  RefreshCw,
  ShoppingCart,
  ClipboardList,
  PackageCheck,
  Tag,
  ListChecks,
  TrendingDown,
  PackagePlus,
  CircleDot,
  ArrowRight,
  Inbox
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoImg from './assets/logo_avanço.png';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

const SafeChart = ({ children }) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const containerRef = React.useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setSize({ width, height });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', minWidth: '1px', minHeight: '1px', position: 'relative' }}>
      {size.width > 0 && size.height > 0 ? (
        React.Children.map(children, child => 
          React.cloneElement(child, { width: size.width, height: size.height })
        )
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
          Carregando gráfico...
        </div>
      )}
    </div>
  );
};

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({ total_ativos: 0, ativos_em_uso: 0, ativos_estoque: 0, ativos_manutencao: 0, ativos_descartados: 0, garantia_vencida: 0, garantia_vencendo_30d: 0, valor_total: 0, valor_por_tipo: [] });
  const [ativos, setAtivos] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [setores, setSetores] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modais de Criação e Edição
  const [isModalOpen, setIsModalOpen] = useState(false); // Criar Ativo
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // Editar Ativo
  const [isColabModalOpen, setIsColabModalOpen] = useState(false); // Editar Colaborador
  const [isColabCreateModalOpen, setIsColabCreateModalOpen] = useState(false); // Criar Colaborador

  // Toast System State
  const [toasts, setToasts] = useState([]);

  // Asset Details sliding drawer (Slide-over Gaveta)
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [assetHistory, setAssetHistory] = useState([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Excel Import Tab State
  const [excelFile, setExcelFile] = useState(null);
  const [excelSheets, setExcelSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [parsedData, setParsedData] = useState([]);
  const [importMappings, setImportMappings] = useState({
    tag_patrimonio: '',
    tipo: '',
    marca: '',
    modelo: '',
    especificacoes: '',
    local_fisico: '',
    status: '',
    valor: '',
    colaborador_nome: '',
    setor_nome: '',
    numero_serie: '',
    fornecedor: '',
    data_aquisicao: '',
    data_garantia: ''
  });

  // Reports State
  const [reportValueBySector, setReportValueBySector] = useState([]);
  const [reportAssetsByType, setReportAssetsByType] = useState([]);
  const [reportGarantiaStatus, setReportGarantiaStatus] = useState([]);

  // Filter State
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterTipo, setFilterTipo] = useState('Todos');
  const [filterLocal, setFilterLocal] = useState('Todos');
  const [filterColab, setFilterColab] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'tag_patrimonio', direction: 'asc' });

  // Form State Ativo
  const [formData, setFormData] = useState({
    tag_patrimonio: '',
    tipo: 'NOTEBOOK',
    marca: '',
    modelo: '',
    especificacoes: '',
    local_fisico: 'Sede Central',
    status: 'Estoque',
    licenca_windows: '',
    licenca_office: '',
    numero_chip: '',
    numero_serie: '',
    fornecedor: '',
    data_aquisicao: '',
    data_garantia: '',
    observacao: '',
    valor: '',
    quantidade: 1,
    colaborador_id: ''
  });

  const [editingAsset, setEditingAsset] = useState(null);

  // Form State Colaborador
  const [editingColab, setEditingColab] = useState(null);
  const [colabFormData, setColabFormData] = useState({
    nome: '',
    email_corporativo: '',
    setor_id: '',
    status: 'Ativo'
  });

  // --- CONTRATOS TI STATE ---
  const [contratos, setContratos] = useState([]);
  const [contratoStats, setContratoStats] = useState({
    total: 0, ativos: 0, vencidos: 0, cancelados: 0,
    em_renovacao: 0, vencendo_30d: 0, vencendo_60d: 0, valor_anual_total: 0
  });
  const [isContratoModalOpen, setIsContratoModalOpen] = useState(false);
  const [isContratoEditModalOpen, setIsContratoEditModalOpen] = useState(false);
  const [editingContrato, setEditingContrato] = useState(null);
  const [filterContratoText, setFilterContratoText] = useState('');
  const [filterContratoStatus, setFilterContratoStatus] = useState('Todos');
  const [filterContratoTipo, setFilterContratoTipo] = useState('Todos');

  const CONTRATO_TIPOS = [
    'Licença de Software', 'Suporte Técnico', 'Manutenção Preventiva',
    'Serviço Cloud', 'Telecomunicações', 'Hardware/Equipamento', 'Consultoria', 'Outro'
  ];

  const contratoFormDefault = {
    numero_contrato: '', titulo: '', tipo: 'Licença de Software',
    fornecedor: '', contato_fornecedor: '', telefone_fornecedor: '',
    email_fornecedor: '', data_inicio: '', data_vencimento: '',
    valor_mensal: '', valor_anual: '', valor_total: '',
    status: 'Ativo', descricao: '', observacoes: '',
    responsavel_interno: '', renovacao_automatica: false, prazo_aviso_dias: 30
  };
  const [contratoFormData, setContratoFormData] = useState(contratoFormDefault);

  // --- AQUISIÇÃO DE MATERIAL STATE ---
  const SOLICITACAO_CATEGORIAS = ['Notebook', 'Monitor', 'Desktop', 'Celular', 'Fone', 'Impressora', 'Periférico', 'Software', 'Serviço de TI', 'Infraestrutura', 'Outro'];
  const SOLICITACAO_PRIORIDADES = ['Baixa', 'Média', 'Alta', 'Crítica'];
  const SOLICITACAO_STATUS_LIST = ['Rascunho', 'Aguard. Aprovação', 'Aprovado', 'Em Cotação', 'Em Aquisição', 'Recebido', 'Cancelado'];

  const solicitacaoFormDefault = {
    numero_solicitacao: '', titulo: '', descricao: '', categoria: 'Notebook',
    prioridade: 'Média', status: 'Rascunho', quantidade_solicitada: 1,
    valor_estimado: '', valor_aprovado: '', valor_final: '',
    fornecedor_escolhido: '', solicitante: '', aprovador: '', justificativa: '',
    observacoes: '', centro_custo: '', data_solicitacao: '', data_aprovacao: '',
    data_previsao_entrega: '', data_recebimento: ''
  };

  const [solicitacoes, setSolicitacoes] = useState([]);
  const [solicitacaoStats, setSolicitacaoStats] = useState({
    total: 0, rascunhos: 0, aguardando_aprovacao: 0, aprovados: 0,
    em_cotacao: 0, em_aquisicao: 0, recebidos: 0, cancelados: 0,
    em_aberto: 0, valor_comprometido: 0, valor_gasto_total: 0,
    gastos_por_categoria: [], funil_status: []
  });
  const [isSolicitacaoModalOpen, setIsSolicitacaoModalOpen] = useState(false);
  const [isSolicitacaoEditModalOpen, setIsSolicitacaoEditModalOpen] = useState(false);
  const [editingSolicitacao, setEditingSolicitacao] = useState(null);
  const [solicitacaoFormData, setSolicitacaoFormData] = useState(solicitacaoFormDefault);
  const [filterSolicitacaoText, setFilterSolicitacaoText] = useState('');
  const [filterSolicitacaoStatus, setFilterSolicitacaoStatus] = useState('Todos');
  const [filterSolicitacaoPrioridade, setFilterSolicitacaoPrioridade] = useState('Todos');
  const [filterSolicitacaoCategoria, setFilterSolicitacaoCategoria] = useState('Todos');

  // Chat IA State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      sender: 'assistant',
      text: 'Olá! Sou o Assistente de Inteligência Artificial do ITAM Avanço. Posso te ajudar a consultar equipamentos, colaboradores, status de inventário ou tirar dúvidas gerais de TI. Como posso te ajudar hoje?'
    }
  ]);

  const messagesEndRef = React.useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isChatOpen) {
      scrollToBottom();
    }
  }, [chatMessages, isChatOpen]);

  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatInput('');
    
    // Adiciona a mensagem do usuário
    setChatMessages(prev => [...prev, {
      id: Date.now(),
      sender: 'user',
      text: userMessage
    }]);

    setChatLoading(true);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/ia/conversar`, {
        mensagem: userMessage
      });
      
      setChatMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'assistant',
        text: res.data.resposta
      }]);
    } catch (error) {
      console.error("Erro ao falar com a IA:", error);
      const detalhe = error?.response?.data?.detail;
      const isNetworkError = !error?.response;
      const mensagemErro = isNetworkError
        ? 'Sem conexão com o servidor. Verifique se o backend FastAPI está rodando em ' + API_BASE_URL
        : detalhe
          ? `Assistente indisponível: ${detalhe}`
          : 'Erro inesperado no Assistente de IA. Tente novamente.';
      setChatMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'system-error',
        text: mensagemErro
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Helper to trigger Toast Alert
  const showToast = (message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resStats, resAtivos, resColaboradores, resSetores] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/dashboard`),
        axios.get(`${API_BASE_URL}/api/ativos`),
        axios.get(`${API_BASE_URL}/api/colaboradores`),
        axios.get(`${API_BASE_URL}/api/setores`)
      ]);
      setStats(resStats.data);
      setAtivos(resAtivos.data);
      setColaboradores(resColaboradores.data);
      setSetores(resSetores.data);

      if (activeTab === 'relatorios') {
        const [resValSector, resAssetsType, resGarantia] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/reports/valor-por-setor`),
          axios.get(`${API_BASE_URL}/api/reports/ativos-por-tipo`),
          axios.get(`${API_BASE_URL}/api/reports/garantia-status`)
        ]);
        setReportValueBySector(resValSector.data);
        setReportAssetsByType(resAssetsType.data);
        setReportGarantiaStatus(resGarantia.data);
      }

      if (activeTab === 'contratos') {
        const [resContratos, resContratoStats] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/contratos`),
          axios.get(`${API_BASE_URL}/api/contratos/stats`)
        ]);
        setContratos(resContratos.data);
        setContratoStats(resContratoStats.data);
      }

      if (activeTab === 'aquisicao') {
        const [resSol, resSolStats] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/solicitacoes`),
          axios.get(`${API_BASE_URL}/api/solicitacoes/stats`)
        ]);
        setSolicitacoes(resSol.data);
        setSolicitacaoStats(resSolStats.data);
      }
    } catch (error) {
      console.error("Erro ao buscar dados da API:", error);
      showToast("Não foi possível estabelecer contato com a API Backend.", "error");
    } finally {
      setLoading(false);
    }
  };

  // --- CRUD ATIVOS ---

  const handleOpenDrawer = async (ativo) => {
    setSelectedAsset(ativo);
    setIsDrawerOpen(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/ativos/${ativo.id}/historico`);
      setAssetHistory(res.data);
    } catch (error) {
      console.error("Erro ao buscar histórico do ativo:", error);
      showToast("Não foi possível carregar a linha do tempo do equipamento.", "warning");
    }
  };

  const openEditAsset = (ativo) => {
    setEditingAsset(ativo);
    setFormData({
      tag_patrimonio: ativo.tag_patrimonio,
      tipo: ativo.tipo || 'NOTEBOOK',
      marca: ativo.marca || '',
      modelo: ativo.modelo || '',
      especificacoes: ativo.especificacoes || '',
      local_fisico: ativo.local_fisico || 'Sede Central',
      status: ativo.status || 'Estoque',
      licenca_windows: ativo.licenca_windows || '',
      licenca_office: ativo.licenca_office || '',
      numero_chip: ativo.numero_chip || '',
      numero_serie: ativo.numero_serie || '',
      fornecedor: ativo.fornecedor || '',
      data_aquisicao: ativo.data_aquisicao || '',
      data_garantia: ativo.data_garantia || '',
      observacao: ativo.observacao || '',
      valor: ativo.valor || '',
      quantidade: ativo.quantidade || 1,
      colaborador_id: ativo.colaborador_id || ''
    });
    setIsEditModalOpen(true);
  };

  const fetchNextTag = async (tipo) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/ativos/next-tag?tipo=${tipo}`);
      return res.data.next_tag;
    } catch {
      return '';
    }
  };

  const handleCreateAtivo = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };
      if (!payload.colaborador_id) delete payload.colaborador_id;
      else payload.colaborador_id = parseInt(payload.colaborador_id);
      if (payload.valor) payload.valor = parseFloat(payload.valor);
      else payload.valor = null;
      if (!payload.data_aquisicao) payload.data_aquisicao = null;
      if (!payload.data_garantia) payload.data_garantia = null;
      payload.quantidade = payload.tipo === 'TONER' ? parseInt(payload.quantidade) || 1 : 1;
      const camposOpcionais = ['marca', 'modelo', 'especificacoes', 'licenca_windows', 'licenca_office', 'numero_chip', 'numero_serie', 'fornecedor', 'observacao'];
      camposOpcionais.forEach(campo => { if (payload[campo] === '') payload[campo] = null; });
      await axios.post(`${API_BASE_URL}/api/ativos`, payload);
      showToast("Equipamento cadastrado com sucesso!", "success");
      setIsModalOpen(false);
      setFormData({
        tag_patrimonio: '', tipo: 'NOTEBOOK', marca: '', modelo: '',
        especificacoes: '', local_fisico: 'Sede Central', status: 'Estoque',
        licenca_windows: '', licenca_office: '', numero_chip: '', numero_serie: '', fornecedor: '',
        data_aquisicao: '', data_garantia: '', observacao: '', valor: '', quantidade: 1, colaborador_id: ''
      });
      fetchData();
    } catch (error) {
      showToast(error.response?.data?.detail || "Erro ao criar ativo", "error");
    }
  };

  const handleUpdateAtivo = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };
      if (!payload.colaborador_id) payload.colaborador_id = null;
      else payload.colaborador_id = parseInt(payload.colaborador_id);
      if (payload.valor) payload.valor = parseFloat(payload.valor);
      else payload.valor = null;
      if (!payload.data_aquisicao) payload.data_aquisicao = null;
      if (!payload.data_garantia) payload.data_garantia = null;
      payload.quantidade = payload.tipo === 'TONER' ? parseInt(payload.quantidade) || 1 : 1;
      const camposOpcionais = ['marca', 'modelo', 'especificacoes', 'licenca_windows', 'licenca_office', 'numero_chip', 'numero_serie', 'fornecedor', 'observacao'];
      camposOpcionais.forEach(campo => { if (payload[campo] === '') payload[campo] = null; });
      await axios.put(`${API_BASE_URL}/api/ativos/${editingAsset.id}`, payload);
      showToast("Equipamento atualizado com sucesso!", "success");
      setIsEditModalOpen(false);
      setEditingAsset(null);
      setIsDrawerOpen(false);
      fetchData();
    } catch (error) {
      showToast(error.response?.data?.detail || "Erro ao atualizar equipamento", "error");
    }
  };

  const handleDeleteAtivo = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir permanentemente este equipamento?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/ativos/${id}`);
      showToast("Equipamento excluído com sucesso!", "success");
      setIsDrawerOpen(false);
      setSelectedAsset(null);
      fetchData();
    } catch (error) {
      showToast("Erro ao excluir equipamento", "error");
    }
  };

  // --- CRUD CONTRATOS ---

  const handleCreateContrato = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...contratoFormData };
      if (!payload.data_inicio) payload.data_inicio = null;
      if (!payload.data_vencimento) { showToast("Data de vencimento é obrigatória", "error"); return; }
      ['valor_mensal', 'valor_anual', 'valor_total'].forEach(k => {
        payload[k] = payload[k] ? parseFloat(payload[k]) : null;
      });
      payload.prazo_aviso_dias = parseInt(payload.prazo_aviso_dias) || 30;
      await axios.post(`${API_BASE_URL}/api/contratos`, payload);
      showToast("Contrato cadastrado com sucesso!", "success");
      setIsContratoModalOpen(false);
      setContratoFormData(contratoFormDefault);
      fetchData();
    } catch (error) {
      showToast(error.response?.data?.detail || "Erro ao criar contrato", "error");
    }
  };

  const handleUpdateContrato = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...contratoFormData };
      if (!payload.data_inicio) payload.data_inicio = null;
      ['valor_mensal', 'valor_anual', 'valor_total'].forEach(k => {
        payload[k] = payload[k] ? parseFloat(payload[k]) : null;
      });
      payload.prazo_aviso_dias = parseInt(payload.prazo_aviso_dias) || 30;
      await axios.put(`${API_BASE_URL}/api/contratos/${editingContrato.id}`, payload);
      showToast("Contrato atualizado com sucesso!", "success");
      setIsContratoEditModalOpen(false);
      setEditingContrato(null);
      fetchData();
    } catch (error) {
      showToast(error.response?.data?.detail || "Erro ao atualizar contrato", "error");
    }
  };

  const handleDeleteContrato = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir este contrato permanentemente?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/contratos/${id}`);
      showToast("Contrato excluído com sucesso!", "success");
      fetchData();
    } catch (error) {
      showToast("Erro ao excluir contrato", "error");
    }
  };

  const openEditContrato = (c) => {
    setEditingContrato(c);
    setContratoFormData({
      numero_contrato: c.numero_contrato || '',
      titulo: c.titulo || '',
      tipo: c.tipo || 'Licença de Software',
      fornecedor: c.fornecedor || '',
      contato_fornecedor: c.contato_fornecedor || '',
      telefone_fornecedor: c.telefone_fornecedor || '',
      email_fornecedor: c.email_fornecedor || '',
      data_inicio: c.data_inicio || '',
      data_vencimento: c.data_vencimento || '',
      valor_mensal: c.valor_mensal ?? '',
      valor_anual: c.valor_anual ?? '',
      valor_total: c.valor_total ?? '',
      status: c.status || 'Ativo',
      descricao: c.descricao || '',
      observacoes: c.observacoes || '',
      responsavel_interno: c.responsavel_interno || '',
      renovacao_automatica: c.renovacao_automatica || false,
      prazo_aviso_dias: c.prazo_aviso_dias || 30
    });
    setIsContratoEditModalOpen(true);
  };

  // --- CRUD SOLICITAÇÕES DE AQUISIÇÃO ---

  const fetchSolicitacoes = async () => {
    try {
      const [resSol, resSolStats] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/solicitacoes`),
        axios.get(`${API_BASE_URL}/api/solicitacoes/stats`)
      ]);
      setSolicitacoes(resSol.data);
      setSolicitacaoStats(resSolStats.data);
    } catch (err) {
      console.error("Erro ao buscar solicitações:", err);
    }
  };

  const parseSolicitacaoPayload = (form) => {
    const p = { ...form };
    p.valor_estimado = p.valor_estimado ? parseFloat(p.valor_estimado) : null;
    p.valor_aprovado = p.valor_aprovado ? parseFloat(p.valor_aprovado) : null;
    p.valor_final    = p.valor_final    ? parseFloat(p.valor_final)    : null;
    p.quantidade_solicitada = p.quantidade_solicitada ? parseInt(p.quantidade_solicitada) : 1;
    ['data_solicitacao', 'data_aprovacao', 'data_previsao_entrega', 'data_recebimento'].forEach(k => {
      if (!p[k]) p[k] = null;
    });
    if (!p.numero_solicitacao) delete p.numero_solicitacao;
    return p;
  };

  const handleCreateSolicitacao = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE_URL}/api/solicitacoes`, parseSolicitacaoPayload(solicitacaoFormData));
      showToast("Solicitação criada com sucesso!", "success");
      setIsSolicitacaoModalOpen(false);
      setSolicitacaoFormData(solicitacaoFormDefault);
      fetchSolicitacoes();
    } catch (error) {
      showToast(error.response?.data?.detail || "Erro ao criar solicitação", "error");
    }
  };

  const handleUpdateSolicitacao = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_BASE_URL}/api/solicitacoes/${editingSolicitacao.id}`, parseSolicitacaoPayload(solicitacaoFormData));
      showToast("Solicitação atualizada com sucesso!", "success");
      setIsSolicitacaoEditModalOpen(false);
      setEditingSolicitacao(null);
      fetchSolicitacoes();
    } catch (error) {
      showToast(error.response?.data?.detail || "Erro ao atualizar solicitação", "error");
    }
  };

  const handleDeleteSolicitacao = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir esta solicitação permanentemente?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/solicitacoes/${id}`);
      showToast("Solicitação excluída com sucesso!", "success");
      fetchSolicitacoes();
    } catch (error) {
      showToast("Erro ao excluir solicitação", "error");
    }
  };

  const openEditSolicitacao = (s) => {
    setEditingSolicitacao(s);
    setSolicitacaoFormData({
      numero_solicitacao: s.numero_solicitacao || '',
      titulo: s.titulo || '',
      descricao: s.descricao || '',
      categoria: s.categoria || 'Notebook',
      prioridade: s.prioridade || 'Média',
      status: s.status || 'Rascunho',
      quantidade_solicitada: s.quantidade_solicitada || 1,
      valor_estimado: s.valor_estimado ?? '',
      valor_aprovado: s.valor_aprovado ?? '',
      valor_final: s.valor_final ?? '',
      fornecedor_escolhido: s.fornecedor_escolhido || '',
      solicitante: s.solicitante || '',
      aprovador: s.aprovador || '',
      justificativa: s.justificativa || '',
      observacoes: s.observacoes || '',
      centro_custo: s.centro_custo || '',
      data_solicitacao: s.data_solicitacao || '',
      data_aprovacao: s.data_aprovacao || '',
      data_previsao_entrega: s.data_previsao_entrega || '',
      data_recebimento: s.data_recebimento || ''
    });
    setIsSolicitacaoEditModalOpen(true);
  };

  const openCreateSolicitacao = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/solicitacoes/next-numero`);
      setSolicitacaoFormData({ ...solicitacaoFormDefault, numero_solicitacao: res.data.next_numero });
    } catch {
      setSolicitacaoFormData(solicitacaoFormDefault);
    }
    setIsSolicitacaoModalOpen(true);
  };

  const exportSolicitacoesToExcel = () => {
    const data = filteredSolicitacoes.map(s => ({
      'Nº Solicitação':       s.numero_solicitacao || '',
      'Título':               s.titulo || '',
      'Categoria':            s.categoria || '',
      'Prioridade':           s.prioridade || '',
      'Status':               s.status || '',
      'Solicitante':          s.solicitante || '',
      'Quantidade':           s.quantidade_solicitada || 1,
      'Valor Estimado (R$)':  s.valor_estimado != null ? Number(s.valor_estimado).toFixed(2).replace('.', ',') : '',
      'Valor Aprovado (R$)':  s.valor_aprovado != null ? Number(s.valor_aprovado).toFixed(2).replace('.', ',') : '',
      'Valor Final (R$)':     s.valor_final    != null ? Number(s.valor_final).toFixed(2).replace('.', ',')    : '',
      'Fornecedor':           s.fornecedor_escolhido || '',
      'Centro de Custo':      s.centro_custo || '',
      'Previsão de Entrega':  s.data_previsao_entrega ? new Date(s.data_previsao_entrega + 'T00:00:00').toLocaleDateString('pt-BR') : '',
      'Data Recebimento':     s.data_recebimento ? new Date(s.data_recebimento + 'T00:00:00').toLocaleDateString('pt-BR') : '',
      'Justificativa':        s.justificativa || '',
      'Observações':          s.observacoes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [16, 32, 14, 12, 20, 24, 10, 20, 20, 18, 26, 18, 18, 18, 40, 40].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aquisições TI");
    XLSX.writeFile(wb, 'Aquisicoes_TI_Avanco.xlsx');
    showToast(`Excel exportado — ${filteredSolicitacoes.length} solicitações!`, "success");
  };

  const exportContratosToExcel = () => {
    const dataToExport = filteredContratos.map(c => ({
      'Nº Contrato': c.numero_contrato || '',
      'Título': c.titulo || '',
      'Tipo': c.tipo || '',
      'Fornecedor': c.fornecedor || '',
      'Contato Fornecedor': c.contato_fornecedor || '',
      'Telefone': c.telefone_fornecedor || '',
      'Email Fornecedor': c.email_fornecedor || '',
      'Data Início': c.data_inicio ? new Date(c.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR') : '',
      'Data Vencimento': c.data_vencimento ? new Date(c.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '',
      'Valor Mensal (R$)': c.valor_mensal != null ? Number(c.valor_mensal).toFixed(2).replace('.', ',') : '',
      'Valor Anual (R$)': c.valor_anual != null ? Number(c.valor_anual).toFixed(2).replace('.', ',') : '',
      'Valor Total (R$)': c.valor_total != null ? Number(c.valor_total).toFixed(2).replace('.', ',') : '',
      'Status': c.status || '',
      'Responsável Interno': c.responsavel_interno || '',
      'Renovação Auto': c.renovacao_automatica ? 'Sim' : 'Não',
      'Descrição': c.descricao || '',
      'Observações': c.observacoes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    ws['!cols'] = [14, 30, 22, 28, 22, 16, 28, 14, 14, 16, 16, 16, 16, 22, 10, 35, 35].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contratos TI");
    XLSX.writeFile(wb, 'Contratos_TI_Avanco.xlsx');
    showToast(`Exportação concluída — ${filteredContratos.length} contratos!`, "success");
  };

  // --- CRUD COLABORADORES ---

  const openCreateColab = () => {
    setColabFormData({ nome: '', email_corporativo: '', setor_id: '', status: 'Ativo' });
    setIsColabCreateModalOpen(true);
  };

  const handleCreateColaborador = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...colabFormData };
      if (payload.setor_id) payload.setor_id = parseInt(payload.setor_id);
      else payload.setor_id = null;
      if (!payload.email_corporativo) payload.email_corporativo = null;

      await axios.post(`${API_BASE_URL}/api/colaboradores`, payload);
      showToast("Colaborador cadastrado com sucesso!", "success");
      setIsColabCreateModalOpen(false);
      fetchData();
    } catch (error) {
      showToast(error.response?.data?.detail || "Erro ao cadastrar colaborador", "error");
    }
  };

  const openEditColab = (colab) => {
    setEditingColab(colab);
    setColabFormData({
      nome: colab.nome,
      email_corporativo: colab.email || '',
      setor_id: colab.setor_id || '',
      status: colab.status
    });
    setIsColabModalOpen(true);
  };

  const handleUpdateColaborador = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...colabFormData };
      if (payload.setor_id) payload.setor_id = parseInt(payload.setor_id);
      else payload.setor_id = null;
      if (!payload.email_corporativo) payload.email_corporativo = null;

      await axios.put(`${API_BASE_URL}/api/colaboradores/${editingColab.id}`, payload);
      showToast("Colaborador atualizado com sucesso!", "success");
      setIsColabModalOpen(false);
      fetchData();
    } catch (error) {
      showToast("Erro ao atualizar colaborador", "error");
    }
  };

  const handleDeleteColaborador = async (id, nome) => {
    if (!window.confirm(`Tem certeza que deseja excluir permanentemente o colaborador ${nome}? Todos os ativos associados a ele retornarão automaticamente ao Estoque.`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/colaboradores/${id}`);
      showToast(`Colaborador ${nome} excluído e equipamentos recolhidos ao estoque.`, "success");
      fetchData();
    } catch (error) {
      showToast("Erro ao excluir colaborador", "error");
    }
  };

  // --- EXCEL SMART IMPORTER ---

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setExcelFile(file);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      setExcelSheets(workbook.SheetNames);
      setSelectedSheet(workbook.SheetNames[0]);
      parseSheet(workbook, workbook.SheetNames[0]);
    };
    reader.readAsBinaryString(file);
  };

  const handleSheetChange = (e) => {
    const sheetName = e.target.value;
    setSelectedSheet(sheetName);
    if (excelFile) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        parseSheet(workbook, sheetName);
      };
      reader.readAsBinaryString(excelFile);
    }
  };

  const parseSheet = (workbook, sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    if (json.length === 0) {
      setParsedData([]);
      showToast("A aba selecionada está vazia.", "warning");
      return;
    }

    // Achar a linha do cabeçalho procurando por palavras-chave comuns
    let headerRowIndex = 0;
    for (let r = 0; r < Math.min(10, json.length); r++) {
      const row = json[r];
      if (row && row.some(cell => typeof cell === 'string' && ['tag', 'colaborador', 'modelo', 'marca', 'fabricante', 'setor'].includes(cell.toLowerCase().trim()))) {
        headerRowIndex = r;
        break;
      }
    }

    const headers = json[headerRowIndex].map(h => h ? String(h).trim() : '');
    const dataRows = json.slice(headerRowIndex + 1).filter(row => row && row.some(cell => cell !== null && cell !== ''));

    // Mapeamento automático inteligente
    const newMappings = {
      tag_patrimonio: '',
      tipo: '',
      marca: '',
      modelo: '',
      especificacoes: '',
      local_fisico: '',
      status: '',
      valor: '',
      colaborador_nome: '',
      setor_nome: ''
    };

    headers.forEach((h) => {
      const hLower = h.toLowerCase();
      if (hLower === 'tag' || hLower === 'patrimônio' || hLower.includes('tag')) {
        newMappings.tag_patrimonio = h;
      } else if (hLower.includes('colaborador') || hLower === 'nome completo') {
        newMappings.colaborador_nome = h;
      } else if (hLower.includes('setor') || hLower.includes('lote')) {
        newMappings.setor_nome = h;
      } else if (hLower === 'marca' || hLower === 'fabricante') {
        newMappings.marca = h;
      } else if (hLower === 'modelo') {
        newMappings.modelo = h;
      } else if (hLower === 'tipo' || hLower === 'equipamento') {
        newMappings.tipo = h;
      } else if (hLower === 'valor' || hLower === 'preço' || hLower.includes('valor')) {
        newMappings.valor = h;
      } else if (hLower.includes('especific') || hLower.includes('descri') || hLower.includes('observ') || hLower.includes('polegadas') || hLower.includes('telefone') || hLower.includes('linha')) {
        newMappings.especificacoes = h;
      }
    });

    // Casos especiais específicos da planilha do usuário
    if (sheetName.includes('MONITORES') && !newMappings.tag_patrimonio) {
      // Monitores Secundários usa a coluna OBSERVAÇÃO para a TAG
      const obsHeader = headers.find(h => h.toLowerCase().includes('observ'));
      if (obsHeader) newMappings.tag_patrimonio = obsHeader;
    }

    setImportMappings(newMappings);

    // Estruturar dados em JSON
    const formatted = dataRows.map((row, index) => {
      const item = {};
      headers.forEach((h, idx) => {
        item[h] = row[idx];
      });
      return { id_temp: index, ...item };
    });

    setParsedData(formatted);
    showToast(`Carregadas ${formatted.length} linhas da aba "${sheetName}"`, "success");
  };

  const handleConfirmImport = async () => {
    if (parsedData.length === 0) return;
    
    if (!importMappings.tag_patrimonio) {
      showToast("Você precisa selecionar a coluna correspondente à TAG de Patrimônio", "error");
      return;
    }

    setLoading(true);
    try {
      const payload = parsedData.map(row => {
        const tag = row[importMappings.tag_patrimonio];
        const marca = importMappings.marca ? row[importMappings.marca] : '';
        const modelo = importMappings.modelo ? row[importMappings.modelo] : '';
        const tipo = importMappings.tipo ? row[importMappings.tipo] : '';
        const especificacoes = importMappings.especificacoes ? row[importMappings.especificacoes] : '';
        const valorRaw = importMappings.valor ? row[importMappings.valor] : null;
        const colaborador = importMappings.colaborador_nome ? row[importMappings.colaborador_nome] : '';
        const setor = importMappings.setor_nome ? row[importMappings.setor_nome] : '';
        const local = importMappings.local_fisico ? row[importMappings.local_fisico] : 'Sede Central';
        const status = importMappings.status ? row[importMappings.status] : '';
        const numero_serie = importMappings.numero_serie ? row[importMappings.numero_serie] : '';
        const fornecedor = importMappings.fornecedor ? row[importMappings.fornecedor] : '';
        const data_aquisicao_raw = importMappings.data_aquisicao ? row[importMappings.data_aquisicao] : null;
        const data_garantia_raw = importMappings.data_garantia ? row[importMappings.data_garantia] : null;

        // Converte datas: aceita número serial Excel, string BR (DD/MM/AAAA) ou ISO (AAAA-MM-DD)
        const parseExcelDate = (val) => {
          if (!val) return null;
          if (typeof val === 'number') {
            // Serial date do Excel — converte para JS Date
            const d = new Date(Math.round((val - 25569) * 86400 * 1000));
            return d.toISOString().split('T')[0];
          }
          const s = String(val).trim();
          // DD/MM/AAAA
          const brMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
          // AAAA-MM-DD já está no formato correto
          if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
          return null;
        };

        // Limpeza e Parse de Valores Monetários do BRL
        let valor = null;
        if (valorRaw !== null && valorRaw !== undefined && valorRaw !== '') {
          if (typeof valorRaw === 'number') {
            // Excel já retornou número — usar direto, sem tocar no ponto decimal
            valor = valorRaw;
          } else {
            const s = String(valorRaw).replace(/R\$\s*/g, '').replace(/\s/g, '');
            const dots   = (s.match(/\./g) || []).length;
            const commas = (s.match(/,/g) || []).length;
            let cleanVal;
            if (commas === 1) {
              // Formato BR: pontos = milhar, vírgula = decimal  ex: "1.234,56"
              cleanVal = s.replace(/\./g, '').replace(',', '.');
            } else if (dots > 1) {
              // Múltiplos pontos sem vírgula: último ponto é decimal  ex: "2.416.67"
              const parts = s.split('.');
              cleanVal = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
            } else {
              // Ponto único (decimal US) ou sem separadores
              cleanVal = s;
            }
            valor = parseFloat(cleanVal);
          }
          if (isNaN(valor)) valor = null;
        }

        // Tentar adivinhar a Categoria do Ativo caso não informada
        let deducedTipo = String(tipo || '').toUpperCase().trim();
        if (!deducedTipo) {
          if (selectedSheet.toUpperCase().includes('NOTEBOOK')) deducedTipo = 'NOTEBOOK';
          else if (selectedSheet.toUpperCase().includes('MONITOR')) deducedTipo = 'MONITOR';
          else if (selectedSheet.toUpperCase().includes('TELEVISOR') || selectedSheet.toUpperCase().includes('TV')) deducedTipo = 'MONITOR';
          else if (selectedSheet.toUpperCase().includes('CELULAR') || selectedSheet.toUpperCase().includes('CHIP') || selectedSheet.toUpperCase().includes('MOBILE')) deducedTipo = 'CELULAR';
          else deducedTipo = 'OUTROS';
        }

        return {
          tag_patrimonio: String(tag || '').trim(),
          tipo: deducedTipo,
          marca: String(marca || '').trim() || 'N/A',
          modelo: String(modelo || '').trim() || 'N/A',
          especificacoes: String(especificacoes || '').trim(),
          local_fisico: String(local || 'Sede Central').trim(),
          status: String(status || (colaborador ? 'Em Uso' : 'Estoque')).trim(),
          valor: isNaN(valor) ? null : valor,
          colaborador_nome: String(colaborador || '').trim(),
          setor_nome: String(setor || '').trim(),
          numero_serie: String(numero_serie || '').trim() || null,
          fornecedor: String(fornecedor || '').trim() || null,
          data_aquisicao: parseExcelDate(data_aquisicao_raw),
          data_garantia: parseExcelDate(data_garantia_raw)
        };
      }).filter(item => item.tag_patrimonio && item.tag_patrimonio.length > 2);

      if (payload.length === 0) {
        showToast("Nenhum equipamento válido foi encontrado para importação.", "warning");
        setLoading(false);
        return;
      }

      const res = await axios.post(`${API_BASE_URL}/api/ativos/bulk`, payload);
      showToast(res.data.message || "Planilha importada com sucesso!", "success");
      
      // Resetar
      setExcelFile(null);
      setParsedData([]);
      setActiveTab('ativos');
      fetchData();
    } catch (error) {
      console.error(error);
      showToast(error.response?.data?.detail || "Erro ao executar importação em lote.", "error");
    } finally {
      setLoading(false);
    }
  };

  // --- LOGICA GERAL DE AUXILIO ---

  const getBrandData = () => {
    const brands = {};
    ativos.forEach(a => {
      if (a.marca) {
        brands[a.marca] = (brands[a.marca] || 0) + 1;
      }
    });
    return Object.keys(brands).map(name => ({ name, value: brands[name] }));
  };

  const COLORS = ['#2563eb', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#38bdf8', '#ec4899'];

  const exportToExcel = () => {
    const isToner = filterTipo === 'TONER';
    const hasChip = !isToner && filteredAtivos.some(a => a.tipo === 'CELULAR');
    const filterSuffix = filterTipo !== 'Todos' ? `_${filterTipo}`
                       : filterStatus !== 'Todos' ? `_${filterStatus}`
                       : '';

    const dataToExport = filteredAtivos.map(a => {
      const row = {};
      if (isToner) {
        row['Quantidade']        = a.quantidade || 1;
        row['Tipo']              = a.tipo || '';
        row['Marca']             = a.marca || '';
        row['Modelo']            = a.modelo || '';
        row['Especificações']    = a.especificacoes || '';
        row['Local']             = a.local_fisico || '';
        row['Status']            = a.status || '';
        row['Valor (R$)']        = a.valor ? Number(a.valor).toFixed(2).replace('.', ',') : '';
        row['Observação']        = a.observacao || '';
      } else {
        row['TAG Patrimônio']    = a.tag_patrimonio;
        row['Tipo']              = a.tipo || '';
        if (hasChip) row['Número do Chip'] = a.tipo === 'CELULAR' ? (a.numero_chip || '') : '';
        row['Marca']             = a.marca || '';
        row['Modelo']            = a.modelo || '';
        row['Especificações']    = a.especificacoes || '';
        row['Colaborador']       = a.colaborador?.nome || '';
        row['Setor']             = a.colaborador?.setor || '';
        row['Local']             = a.local_fisico || '';
        row['Status']            = a.status || '';
        row['Licença Windows']   = a.licenca_windows || '';
        row['Licença Office']    = a.licenca_office || '';
        row['Valor (R$)']        = a.valor ? Number(a.valor).toFixed(2).replace('.', ',') : '';
      }
      return row;
    });

    if (isToner) {
      const totalUnidades = filteredAtivos.reduce((acc, a) => acc + (a.quantidade || 1), 0);
      dataToExport.push({});
      dataToExport.push({
        'Quantidade': totalUnidades,
        'Tipo': '',
        'Marca': 'TOTAL DE UNIDADES EM ESTOQUE',
        'Modelo': '',
        'Especificações': '',
        'Local': '',
        'Status': '',
        'Valor (R$)': '',
        'Observação': '',
      });
    }

    const ws = XLSX.utils.json_to_sheet(dataToExport);

    if (isToner) {
      const colW = [12, 8, 18, 22, 35, 16, 10, 14, 30];
      ws['!cols'] = colW.map(w => ({ wch: w }));
      // Destaca a linha de total (negrito via estilo não é suportado em xlsx puro, mas o valor já comunica)
    } else {
      const colW = [16, 12, 15, 14, 20, 35, 22, 18, 14, 12, 22, 18, 14];
      if (hasChip) colW.splice(2, 0, 18);
      ws['!cols'] = colW.map(w => ({ wch: w }));
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isToner ? "Toners" : "Ativos");
    XLSX.writeFile(wb, `Inventario_TI_Avanco${filterSuffix}.xlsx`);
    showToast(`Exportação Excel concluída — ${filteredAtivos.length} modelos exportados!`, "success");
  };

  const exportToPDF = () => {
    const isToner = filterTipo === 'TONER';
    const hasChip = !isToner && filteredAtivos.some(a => a.tipo === 'CELULAR');
    const filterLabel  = filterTipo !== 'Todos'   ? filterTipo
                       : filterStatus !== 'Todos' ? filterStatus
                       : filterLocal !== 'Todos'  ? filterLocal
                       : 'Todos os Equipamentos';
    const filterSuffix = filterTipo !== 'Todos'   ? `_${filterTipo}`
                       : filterStatus !== 'Todos' ? `_${filterStatus}`
                       : '';

    const doc = new jsPDF({ orientation: hasChip ? 'landscape' : 'portrait' });
    const pageW = doc.internal.pageSize.width;

    // Cabeçalho
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('Inventário de T.I — Avanço Construções', 14, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    const dataEmissao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    if (isToner) {
      const totalUnidades = filteredAtivos.reduce((acc, a) => acc + (a.quantidade || 1), 0);
      doc.text(
        `Filtro: TONER DE IMPRESSORA   ·   ${filteredAtivos.length} modelos   ·   ${totalUnidades} unidades em estoque   ·   Emitido em ${dataEmissao}`,
        14, 21
      );
    } else {
      doc.text(
        `Filtro: ${filterLabel}   ·   ${filteredAtivos.length} itens   ·   Emitido em ${dataEmissao}`,
        14, 21
      );
    }

    // Linha separadora
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, 24, pageW - 14, 24);

    doc.setTextColor(0, 0, 0);

    let tableColumn, tableRows;

    if (isToner) {
      tableColumn = ['Qtd', 'Tipo', 'Marca', 'Modelo', 'Especificações', 'Local', 'Status', 'Valor (R$)'];
      const totalUnidades = filteredAtivos.reduce((acc, a) => acc + (a.quantidade || 1), 0);
      tableRows = filteredAtivos.map(a => [
        a.quantidade || 1,
        a.tipo || '',
        a.marca || '',
        a.modelo || '',
        a.especificacoes || '—',
        a.local_fisico || '',
        a.status || '',
        a.valor ? `R$ ${Number(a.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—',
      ]);
      // Linha de total
      tableRows.push([
        { content: totalUnidades, styles: { fontStyle: 'bold', textColor: [37, 99, 235] } },
        { content: 'TOTAL DE UNIDADES', colSpan: 7, styles: { fontStyle: 'bold', textColor: [37, 99, 235], halign: 'left' } },
      ]);
    } else {
      tableColumn = hasChip
        ? ['TAG', 'Tipo', 'Nº Chip', 'Equipamento', 'Colaborador', 'Setor', 'Local', 'Status', 'Valor (R$)']
        : ['TAG', 'Tipo', 'Equipamento', 'Colaborador', 'Setor', 'Local', 'Status', 'Valor (R$)'];
      tableRows = filteredAtivos.map(a => {
        const base = [
          a.tag_patrimonio,
          a.tipo || '',
          `${a.marca || ''} ${a.modelo || ''}`.trim(),
          a.colaborador?.nome || 'Disponível',
          a.colaborador?.setor || '—',
          a.local_fisico || '',
          a.status || '',
          a.valor ? `R$ ${Number(a.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—',
        ];
        if (hasChip) base.splice(2, 0, a.tipo === 'CELULAR' ? (a.numero_chip || '—') : '—');
        return base;
      });
    }

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      theme: 'grid',
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 7.5,
        halign: 'left',
        cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
        textColor: [30, 41, 59],
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: isToner
        ? { 0: { fontStyle: 'bold', textColor: [37, 99, 235], halign: 'center' } }
        : { 0: { fontStyle: 'bold', textColor: [37, 99, 235] } },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        const total = doc.internal.getNumberOfPages();
        const current = doc.internal.getCurrentPageInfo().pageNumber;
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Página ${current} de ${total}`,
          pageW - 14,
          doc.internal.pageSize.height - 8,
          { align: 'right' }
        );
      },
    });

    doc.save(`Inventario_TI_Avanco${filterSuffix}.pdf`);
    showToast(`Exportação PDF concluída — ${filteredAtivos.length} modelos exportados!`, "success");
  };

  // Média de valor dos notebooks para destaque visual
  const avgNotebookValue = React.useMemo(() => {
    const notebooks = ativos.filter(a => a.tipo === 'NOTEBOOK' && a.valor != null);
    if (notebooks.length === 0) return 0;
    return notebooks.reduce((sum, n) => sum + n.valor, 0) / notebooks.length;
  }, [ativos]);

  // Filtragem e Ordenação avançada
  const filteredAtivos = React.useMemo(() => {
    return ativos
      .filter(a => {
        const searchStr = `${a.tag_patrimonio} ${a.marca} ${a.modelo} ${a.local_fisico} ${a.colaborador?.nome || ''}`.toLowerCase();
        const matchesSearch = searchStr.includes(filterText.toLowerCase());
        const matchesStatus = filterStatus === 'Todos' || a.status === filterStatus;
        const matchesTipo = filterTipo === 'Todos' || a.tipo === filterTipo;
        const matchesLocal = filterLocal === 'Todos' || a.local_fisico === filterLocal;
        return matchesSearch && matchesStatus && matchesTipo && matchesLocal;
      })
      .sort((a, b) => {
        let aVal = a[sortConfig.key] || '';
        let bVal = b[sortConfig.key] || '';
        
        if (sortConfig.key === 'colaborador') {
          aVal = a.colaborador?.nome || '';
          bVal = b.colaborador?.nome || '';
        }

        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [ativos, filterText, filterStatus, filterTipo, filterLocal, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredContratos = React.useMemo(() => {
    return contratos.filter(c => {
      const searchStr = `${c.titulo} ${c.fornecedor} ${c.numero_contrato || ''} ${c.responsavel_interno || ''}`.toLowerCase();
      const matchesSearch = searchStr.includes(filterContratoText.toLowerCase());
      const matchesStatus = filterContratoStatus === 'Todos' || c.status === filterContratoStatus;
      const matchesTipo = filterContratoTipo === 'Todos' || c.tipo === filterContratoTipo;
      return matchesSearch && matchesStatus && matchesTipo;
    });
  }, [contratos, filterContratoText, filterContratoStatus, filterContratoTipo]);

  const filteredSolicitacoes = React.useMemo(() => {
    return solicitacoes.filter(s => {
      const searchStr = `${s.titulo} ${s.numero_solicitacao || ''} ${s.solicitante || ''} ${s.fornecedor_escolhido || ''} ${s.centro_custo || ''}`.toLowerCase();
      const matchesSearch = searchStr.includes(filterSolicitacaoText.toLowerCase());
      const matchesStatus = filterSolicitacaoStatus === 'Todos' || s.status === filterSolicitacaoStatus;
      const matchesPrioridade = filterSolicitacaoPrioridade === 'Todos' || s.prioridade === filterSolicitacaoPrioridade;
      const matchesCategoria = filterSolicitacaoCategoria === 'Todos' || s.categoria === filterSolicitacaoCategoria;
      return matchesSearch && matchesStatus && matchesPrioridade && matchesCategoria;
    });
  }, [solicitacoes, filterSolicitacaoText, filterSolicitacaoStatus, filterSolicitacaoPrioridade, filterSolicitacaoCategoria]);

  return (
    <div className="app-container">
      {/* Sidebar de Navegação Lateral */}
      <aside className="sidebar">
        <div className="logo" onClick={() => setActiveTab('dashboard')}>
          <img src={logoImg} alt="Avanço S.A." style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
        <nav className="nav-links">
          <div 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </div>
          <div 
            className={`nav-item ${activeTab === 'ativos' ? 'active' : ''}`}
            onClick={() => setActiveTab('ativos')}
          >
            <Monitor size={20} />
            Equipamentos
          </div>
          <div 
            className={`nav-item ${activeTab === 'colaboradores' ? 'active' : ''}`}
            onClick={() => setActiveTab('colaboradores')}
          >
            <Users size={20} />
            Colaboradores
          </div>
          <div 
            className={`nav-item ${activeTab === 'importar' ? 'active' : ''}`}
            onClick={() => setActiveTab('importar')}
          >
            <UploadCloud size={20} />
            Importar Excel
          </div>
          <div
            className={`nav-item ${activeTab === 'aquisicao' ? 'active' : ''}`}
            onClick={() => setActiveTab('aquisicao')}
          >
            <ShoppingCart size={20} />
            Aquisição
          </div>
          <div
            className={`nav-item ${activeTab === 'relatorios' ? 'active' : ''}`}
            onClick={() => setActiveTab('relatorios')}
          >
            <BarChart3 size={20} />
            Relatórios
          </div>
          <div
            className={`nav-item ${activeTab === 'contratos' ? 'active' : ''}`}
            onClick={() => setActiveTab('contratos')}
          >
            <ScrollText size={20} />
            Contratos TI
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab !== 'ativos' && (
          <header>
            <h1>
              {activeTab === 'dashboard' ? 'Dashboard de Inventário' :
               activeTab === 'colaboradores' ? 'Gestão de Colaboradores' :
               activeTab === 'importar' ? 'Importação Inteligente Excel' :
               activeTab === 'contratos' ? 'Contratos de T.I.' :
               activeTab === 'aquisicao' ? 'Aquisição de Material' : 'Relatórios Estratégicos'}
            </h1>
            <p className="subtitle">Bem-vindo ao sistema de controle de ativos de T.I. Avanço Construções.</p>
          </header>
        )}

        {loading && activeTab !== 'importar' ? (
          <div style={{display: 'flex', justifyContent: 'center', padding: '5rem', color: 'var(--text-muted)'}}>
             Carregando informações do servidor...
          </div>
        ) : activeTab === 'dashboard' ? (
          <>
            {/* Alertas críticos de garantia */}
            {(stats.garantia_vencida > 0 || stats.garantia_vencendo_30d > 0) && (
              <div style={{display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap'}}>
                {stats.garantia_vencida > 0 && (
                  <div style={{flex: 1, minWidth: '260px', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.1rem', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '10px'}}>
                    <ShieldOff size={20} color="#ef4444" style={{flexShrink: 0}} />
                    <div>
                      <div style={{fontWeight: '700', color: '#ef4444', fontSize: '0.9rem'}}>{stats.garantia_vencida} equipamento{stats.garantia_vencida > 1 ? 's' : ''} com garantia vencida</div>
                      <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>Verifique os ativos e acione o fornecedor ou planeje substituição.</div>
                    </div>
                  </div>
                )}
                {stats.garantia_vencendo_30d > 0 && (
                  <div style={{flex: 1, minWidth: '260px', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.1rem', backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: '10px'}}>
                    <Shield size={20} color="var(--warning)" style={{flexShrink: 0}} />
                    <div>
                      <div style={{fontWeight: '700', color: 'var(--warning)', fontSize: '0.9rem'}}>{stats.garantia_vencendo_30d} equipamento{stats.garantia_vencendo_30d > 1 ? 's' : ''} com garantia vencendo em 30 dias</div>
                      <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>Acione a garantia antes do prazo para evitar custo extra.</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* KPI Cards Grid — 4 principais */}
            <div className="stats-grid" style={{marginBottom: '1rem'}}>
              <div className="stat-card">
                <div className="stat-label">Total de Ativos</div>
                <div className="stat-value">{stats.total_ativos}</div>
                <Package size={24} color="var(--accent)" style={{marginTop: 'auto'}} />
              </div>
              <div className="stat-card">
                <div className="stat-label">Em Uso</div>
                <div className="stat-value">{stats.ativos_em_uso}</div>
                <CheckCircle2 size={24} color="var(--success)" style={{marginTop: 'auto'}} />
              </div>
              <div className="stat-card">
                <div className="stat-label">Em Estoque</div>
                <div className="stat-value">{stats.ativos_estoque}</div>
                <HardDrive size={24} color="var(--warning)" style={{marginTop: 'auto'}} />
              </div>
              <div className="stat-card">
                <div className="stat-label">Valor Total do Inventário</div>
                <div className="stat-value" style={{fontSize: '1.1rem'}}>R$ {(stats.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <TrendingUp size={24} color="#8b5cf6" style={{marginTop: 'auto'}} />
              </div>
            </div>

            {/* KPI Cards Grid — operacional */}
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem'}}>
              <div className="stat-card" style={{borderColor: stats.ativos_manutencao > 0 ? 'rgba(239,68,68,0.3)' : undefined}}>
                <div className="stat-label">Em Manutenção</div>
                <div className="stat-value" style={{fontSize: '1.5rem', color: stats.ativos_manutencao > 0 ? '#ef4444' : 'var(--text-main)'}}>{stats.ativos_manutencao || 0}</div>
                <Wrench size={20} color={stats.ativos_manutencao > 0 ? '#ef4444' : 'var(--text-muted)'} style={{marginTop: 'auto'}} />
              </div>
              <div className="stat-card">
                <div className="stat-label">Descartados</div>
                <div className="stat-value" style={{fontSize: '1.5rem', color: 'var(--text-muted)'}}>{stats.ativos_descartados || 0}</div>
                <Trash2 size={20} color="var(--text-muted)" style={{marginTop: 'auto'}} />
              </div>
              <div className="stat-card" style={{borderColor: stats.garantia_vencida > 0 ? 'rgba(239,68,68,0.3)' : undefined}}>
                <div className="stat-label">Garantia Vencida</div>
                <div className="stat-value" style={{fontSize: '1.5rem', color: stats.garantia_vencida > 0 ? '#ef4444' : 'var(--success)'}}>{stats.garantia_vencida || 0}</div>
                <ShieldOff size={20} color={stats.garantia_vencida > 0 ? '#ef4444' : 'var(--text-muted)'} style={{marginTop: 'auto'}} />
              </div>
              <div className="stat-card" style={{borderColor: stats.garantia_vencendo_30d > 0 ? 'rgba(245,158,11,0.3)' : undefined}}>
                <div className="stat-label">Garantia Vencendo (30d)</div>
                <div className="stat-value" style={{fontSize: '1.5rem', color: stats.garantia_vencendo_30d > 0 ? 'var(--warning)' : 'var(--text-main)'}}>{stats.garantia_vencendo_30d || 0}</div>
                <Shield size={20} color={stats.garantia_vencendo_30d > 0 ? 'var(--warning)' : 'var(--text-muted)'} style={{marginTop: 'auto'}} />
              </div>
            </div>

            <div className="dashboard-row">
              {/* Gráfico Valor por Categoria */}
              <div className="chart-container">
                <h3>Valor Total por Categoria (R$)</h3>
                <div style={{ height: '300px' }}>
                  {(stats.valor_por_tipo || []).length > 0 ? (
                    <SafeChart>
                      <BarChart data={stats.valor_por_tipo} margin={{ top: 10, right: 20, left: 40, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="tipo" stroke="#94a3b8" tick={{fontSize: 11}} />
                        <YAxis stroke="#94a3b8" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid var(--border)', borderRadius: '8px' }}
                          formatter={(val, name, props) => [
                            `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                            `Valor — ${props.payload.quantidade} unid.`
                          ]}
                        />
                        <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                          {(stats.valor_por_tipo || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </SafeChart>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                      Nenhum equipamento cadastrado.
                    </div>
                  )}
                </div>
              </div>

              {/* Tabela de Equipamentos Recentes */}
              <div className="recent-list-container">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                  <h2>Ativos Recentes</h2>
                  <button className="btn-primary" onClick={() => setActiveTab('ativos')}>Ver Todos</button>
                </div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Tag</th>
                        <th>Equipamento</th>
                        <th>Responsável</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ativos.slice(0, 8).map(ativo => (
                        <tr key={ativo.id} className="table-row-hover" onClick={() => handleOpenDrawer(ativo)}>
                          <td><strong style={{color: 'var(--accent)'}}>{ativo.tag_patrimonio}</strong></td>
                          <td style={{fontSize: '0.82rem'}}>{ativo.marca} {ativo.modelo}</td>
                          <td style={{fontSize: '0.78rem', color: 'var(--text-muted)'}}>{ativo.colaborador?.nome || <span style={{fontStyle:'italic'}}>Disponível</span>}</td>
                          <td>
                            <span className={`status-badge status-${ativo.status.toLowerCase().replace(' ', '-')}`}>
                              {ativo.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        ) : activeTab === 'ativos' ? (
          <>
            <div className="equipamentos-sticky-top">
              <header>
                <h1>Gestão de Equipamentos</h1>
                <p className="subtitle">Bem-vindo ao sistema de controle de ativos de T.I. Avanço Construções.</p>
              </header>
              {/* Filtros e Controles de Ações */}
            <div className="filter-bar">
              <div className="search-box">
                <Search size={18} />
                <input 
                  type="text" 
                  placeholder="Pesquisar TAG, equipamento, setor..." 
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                />
              </div>
              
              <div className="filter-select">
                <Filter size={16} />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="Todos">📦 Todos Status</option>
                  <option value="Estoque">🏬 Em Estoque</option>
                  <option value="Em Uso">👤 Em Uso</option>
                  <option value="Manutenção">🔧 Manutenção</option>
                  <option value="Descartado">🗑️ Descartado</option>
                </select>
              </div>

              <div className="filter-select">
                <Box size={16} />
                <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
                  <option value="Todos">📂 Categorias</option>
                  {Array.from(new Set(ativos.map(a => a.tipo).filter(Boolean))).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="filter-select">
                <HardDrive size={16} />
                <select value={filterLocal} onChange={e => setFilterLocal(e.target.value)}>
                  <option value="Todos">📍 Locais</option>
                  {Array.from(new Set(ativos.map(a => a.local_fisico).filter(Boolean))).map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              <div className="export-buttons">
                <button className="btn-secondary" onClick={exportToExcel} title="Exportar Excel">
                  <FileSpreadsheet size={18} />
                </button>
                <button className="btn-secondary" onClick={exportToPDF} title="Exportar PDF">
                  <FileText size={18} />
                </button>
              </div>

              <button className="btn-primary gradient-btn" onClick={async () => {
                const nextTag = await fetchNextTag('NOTEBOOK');
                setFormData({
                  tag_patrimonio: nextTag, tipo: 'NOTEBOOK', marca: '', modelo: '',
                  especificacoes: '', local_fisico: 'Sede Central', status: 'Estoque',
                  licenca_windows: '', licenca_office: '', numero_chip: '', numero_serie: '', fornecedor: '',
                  data_aquisicao: '', data_garantia: '', observacao: '', valor: '', colaborador_id: ''
                });
                setIsModalOpen(true);
              }}>
                <Plus size={20} /> Novo Ativo
              </button>
            </div>
            </div>{/* fim equipamentos-sticky-top */}

            <div style={{display: 'flex', gap: '1rem', marginBottom: '1.5rem'}}>
              {filterTipo === 'TONER' ? (
                <>
                  <div className="stat-card" style={{flex: 1, padding: '1rem'}}>
                    <div className="stat-label">Modelos Cadastrados</div>
                    <div className="stat-value" style={{fontSize: '1.25rem'}}>{filteredAtivos.length}</div>
                    <div style={{fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem'}}>tipos distintos de toner</div>
                  </div>
                  <div className="stat-card" style={{flex: 1, padding: '1rem', borderColor: 'rgba(99,102,241,0.3)'}}>
                    <div className="stat-label" style={{color: 'var(--accent)'}}>Total de Unidades</div>
                    <div className="stat-value" style={{fontSize: '1.25rem', color: 'var(--accent)'}}>
                      {filteredAtivos.reduce((acc, curr) => acc + (curr.quantidade || 1), 0)}
                    </div>
                    <div style={{fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem'}}>unidades em estoque</div>
                  </div>
                  <div className="stat-card" style={{flex: 1, padding: '1rem'}}>
                    <div className="stat-label">Valor Total Selecionado</div>
                    <div className="stat-value" style={{fontSize: '1.25rem', color: 'var(--success)'}}>
                      R$ {filteredAtivos.reduce((acc, curr) => acc + (curr.valor || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="stat-card" style={{flex: 1, padding: '1rem'}}>
                    <div className="stat-label">Itens Filtrados</div>
                    <div className="stat-value" style={{fontSize: '1.25rem'}}>{filteredAtivos.length}</div>
                  </div>
                  <div className="stat-card" style={{flex: 1, padding: '1rem'}}>
                    <div className="stat-label">Valor Total Selecionado</div>
                    <div className="stat-value" style={{fontSize: '1.25rem', color: 'var(--success)'}}>
                      R$ {filteredAtivos.reduce((acc, curr) => acc + (curr.valor || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  {avgNotebookValue > 0 && (
                    <div className="stat-card" style={{flex: 1, padding: '1rem', borderColor: 'rgba(245,158,11,0.3)'}}>
                      <div className="stat-label" style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}>
                        <AlertTriangle size={13} color="var(--warning)" /> Média Notebooks
                      </div>
                      <div className="stat-value" style={{fontSize: '1.25rem', color: 'var(--warning)'}}>
                        R$ {avgNotebookValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem'}}>
                        {ativos.filter(a => a.tipo === 'NOTEBOOK' && a.valor != null && a.valor > avgNotebookValue).length} acima da média
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Tabela de Equipamentos Geral */}
            <div className="table-container">
              <table>
                <colgroup>
                  {filterTipo !== 'TONER' && <col style={{width: '8%'}} />}
                  <col style={{width: '6%'}} />
                  {filterTipo === 'CELULAR' && <col style={{width: '12%'}} />}
                  {filterTipo === 'TONER' && <col style={{width: '8%'}} />}
                  <col style={{width: '14%'}} />
                  <col style={{width: '11%'}} />
                  <col style={{width: '9%'}} />
                  <col style={{width: '7%'}} />
                  <col style={{width: '7%'}} />
                  <col style={{width: '7%'}} />
                  <col style={{width: '13%'}} />
                  <col style={{width: '6%'}} />
                </colgroup>
                <thead>
                  <tr>
                    {filterTipo !== 'TONER' && (
                      <th onClick={() => requestSort('tag_patrimonio')}>TAG {sortConfig.key === 'tag_patrimonio' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    )}
                    <th onClick={() => requestSort('tipo')}>Tipo {sortConfig.key === 'tipo' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    {filterTipo === 'CELULAR' && (
                      <th>
                        <div style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}>
                          <Smartphone size={13} />
                          Chip
                        </div>
                      </th>
                    )}
                    {filterTipo === 'TONER' && (
                      <th onClick={() => requestSort('quantidade')}>Qtd {sortConfig.key === 'quantidade' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    )}
                    <th onClick={() => requestSort('marca')}>Equipamento {sortConfig.key === 'marca' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('colaborador')}>Colaborador {sortConfig.key === 'colaborador' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th>Setor</th>
                    <th onClick={() => requestSort('local_fisico')}>Local {sortConfig.key === 'local_fisico' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('status')}>Status {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('valor')}>Valor {sortConfig.key === 'valor' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th>Observação</th>
                    <th style={{textAlign: 'center'}}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAtivos.map(ativo => (
                    <tr key={ativo.id} className="table-row-hover" onClick={() => handleOpenDrawer(ativo)}>
                      {filterTipo !== 'TONER' && (
                        <td style={{color: 'var(--accent)', fontWeight: '600'}}>{ativo.tag_patrimonio}</td>
                      )}
                      <td>
                        <span className="type-badge">{ativo.tipo || 'N/A'}</span>
                      </td>
                      {filterTipo === 'CELULAR' && (
                        <td style={{whiteSpace: 'nowrap'}}>
                          {ativo.numero_chip ? (
                            <div style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}>
                              <Smartphone size={13} color="var(--accent)" style={{flexShrink: 0}} />
                              <span style={{fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-main)', whiteSpace: 'nowrap'}}>{ativo.numero_chip}</span>
                            </div>
                          ) : (
                            <span style={{fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic'}}>Não cadastrado</span>
                          )}
                        </td>
                      )}
                      {filterTipo === 'TONER' && (
                        <td style={{fontWeight: '600', color: 'var(--accent)', textAlign: 'center'}}>
                          {ativo.quantidade ?? 1}
                        </td>
                      )}
                      <td>
                        <div style={{fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{ativo.marca} {ativo.modelo}</div>
                        <div style={{color: 'var(--text-muted)', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{ativo.especificacoes}</div>
                      </td>
                      <td>
                        <div style={{display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden'}}>
                          <Users size={14} color={ativo.colaborador ? 'var(--accent)' : 'var(--text-muted)'} style={{flexShrink: 0}} />
                          <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.875rem'}}>
                            {ativo.colaborador?.nome || <span style={{color: 'var(--text-muted)'}}>Disponível</span>}
                          </span>
                        </div>
                      </td>
                      <td style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{ativo.colaborador?.setor || '-'}</td>
                      <td style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{ativo.local_fisico}</td>
                      <td>
                        <span className={`status-badge status-${ativo.status.toLowerCase().replace(' ', '-')}`}>
                          {ativo.status}
                        </span>
                      </td>
                      <td style={{fontWeight: '600', color: 'var(--text-main)'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'nowrap', overflow: 'hidden'}}>
                          {ativo.valor ? `R$ ${ativo.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                          {ativo.tipo === 'NOTEBOOK' && ativo.valor != null && avgNotebookValue > 0 && ativo.valor > avgNotebookValue && (
                            <span
                              title={`Acima da média dos notebooks (R$ ${avgNotebookValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`}
                              style={{
                                fontSize: '0.65rem',
                                fontWeight: '700',
                                backgroundColor: 'rgba(245,158,11,0.15)',
                                color: 'var(--warning)',
                                border: '1px solid rgba(245,158,11,0.4)',
                                borderRadius: '4px',
                                padding: '1px 5px',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              ▲ Acima da Média
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                        {ativo.observacao ? (
                          <span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}} title={ativo.observacao}>
                            {ativo.observacao}
                          </span>
                        ) : (
                          <span style={{color: 'var(--text-muted)', opacity: 0.4}}>—</span>
                        )}
                      </td>
                      <td style={{textAlign: 'center'}} onClick={(e) => e.stopPropagation()}>
                        <div style={{display: 'flex', justifyContent: 'center', gap: '0.25rem'}}>
                          <button className="btn-icon" onClick={() => openEditAsset(ativo)} title="Editar Ativo">
                            <Edit2 size={15} />
                          </button>
                          <button className="btn-icon" style={{color: '#ef4444'}} onClick={() => handleDeleteAtivo(ativo.id)} title="Excluir Ativo">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : activeTab === 'colaboradores' ? (
          <>
            {/* Lista e Filtros de Colaboradores */}
            <div className="filter-bar" style={{marginBottom: '1.5rem'}}>
              <div className="search-box">
                <Search size={18} />
                <input 
                  type="text" 
                  placeholder="Pesquisar por colaborador ou setor..." 
                  value={filterColab}
                  onChange={e => setFilterColab(e.target.value)}
                />
              </div>

              <button className="btn-primary gradient-btn" onClick={openCreateColab}>
                <Plus size={20} /> Novo Colaborador
              </button>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail Corporativo</th>
                    <th>Setor</th>
                    <th>Status</th>
                    <th style={{textAlign: 'center'}}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {colaboradores
                    .slice()
                    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
                    .filter(c => `${c.nome} ${c.setor}`.toLowerCase().includes(filterColab.toLowerCase()))
                    .map(colab => (
                      <tr key={colab.id}>
                        <td><strong>{colab.nome}</strong></td>
                        <td>{colab.email || <span style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>Não cadastrado</span>}</td>
                        <td>{colab.setor || '-'}</td>
                        <td>
                          <span className={`status-badge status-${colab.status.toLowerCase()}`}>
                            {colab.status}
                          </span>
                        </td>
                        <td style={{textAlign: 'center'}}>
                          <div style={{display: 'flex', justifyContent: 'center', gap: '0.5rem'}}>
                            <button className="btn-icon" onClick={() => openEditColab(colab)} title="Editar Colaborador">
                              <Edit2 size={16} />
                            </button>
                            <button className="btn-icon" style={{color: '#ef4444'}} onClick={() => handleDeleteColaborador(colab.id, colab.nome)} title="Excluir Colaborador">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        ) : activeTab === 'importar' ? (
          <>
            {/* Tela de Importador de Planilha Excel com Validação */}
            <div style={{maxWidth: '800px', margin: '0 auto'}}>
              <div className="dropzone" onClick={() => document.getElementById('excel-file-input').click()}>
                <UploadCloud size={48} color="var(--accent)" />
                <div>
                  <h3>Importar Planilha do Excel</h3>
                  <p style={{marginTop: '0.5rem'}}>Arraste ou clique para selecionar seu arquivo `.xlsx` (ex: `Inventário de Ativos de T.I.xlsx`)</p>
                </div>
                <input 
                  type="file" 
                  id="excel-file-input" 
                  accept=".xlsx" 
                  style={{display: 'none'}} 
                  onChange={handleExcelUpload} 
                />
              </div>

              {excelFile && (
                <div className="import-preview-container" style={{marginTop: '2rem', padding: '1.5rem'}}>
                  <h3 style={{marginBottom: '1rem'}}>Configuração da Aba & Colunas</h3>
                  
                  <div className="import-grid-select">
                    <div className="form-group">
                      <label>Selecione a Aba (Sheet)</label>
                      <select value={selectedSheet} onChange={handleSheetChange}>
                        {excelSheets.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {parsedData.length > 0 && (
                    <>
                      <h4 style={{fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase'}}>Mapeamento de Colunas Inteligente</h4>
                      <div className="import-grid-select" style={{gridTemplateColumns: 'repeat(3, 1fr)'}}>
                        <div className="form-group">
                          <label>TAG Patrimônio *</label>
                          <select value={importMappings.tag_patrimonio} onChange={e => setImportMappings({...importMappings, tag_patrimonio: e.target.value})}>
                            <option value="">-- Selecione --</option>
                            {Object.keys(parsedData[0]).filter(k => k !== 'id_temp').map(k => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Marca</label>
                          <select value={importMappings.marca} onChange={e => setImportMappings({...importMappings, marca: e.target.value})}>
                            <option value="">-- Ignorar --</option>
                            {Object.keys(parsedData[0]).filter(k => k !== 'id_temp').map(k => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Modelo</label>
                          <select value={importMappings.modelo} onChange={e => setImportMappings({...importMappings, modelo: e.target.value})}>
                            <option value="">-- Ignorar --</option>
                            {Object.keys(parsedData[0]).filter(k => k !== 'id_temp').map(k => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Especificações</label>
                          <select value={importMappings.especificacoes} onChange={e => setImportMappings({...importMappings, especificacoes: e.target.value})}>
                            <option value="">-- Ignorar --</option>
                            {Object.keys(parsedData[0]).filter(k => k !== 'id_temp').map(k => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Valor (R$)</label>
                          <select value={importMappings.valor} onChange={e => setImportMappings({...importMappings, valor: e.target.value})}>
                            <option value="">-- Ignorar --</option>
                            {Object.keys(parsedData[0]).filter(k => k !== 'id_temp').map(k => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Colaborador Nome</label>
                          <select value={importMappings.colaborador_nome} onChange={e => setImportMappings({...importMappings, colaborador_nome: e.target.value})}>
                            <option value="">-- Ignorar --</option>
                            {Object.keys(parsedData[0]).filter(k => k !== 'id_temp').map(k => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Setor Nome</label>
                          <select value={importMappings.setor_nome} onChange={e => setImportMappings({...importMappings, setor_nome: e.target.value})}>
                            <option value="">-- Ignorar --</option>
                            {Object.keys(parsedData[0]).filter(k => k !== 'id_temp').map(k => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Número de Série</label>
                          <select value={importMappings.numero_serie} onChange={e => setImportMappings({...importMappings, numero_serie: e.target.value})}>
                            <option value="">-- Ignorar --</option>
                            {Object.keys(parsedData[0]).filter(k => k !== 'id_temp').map(k => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Fornecedor</label>
                          <select value={importMappings.fornecedor} onChange={e => setImportMappings({...importMappings, fornecedor: e.target.value})}>
                            <option value="">-- Ignorar --</option>
                            {Object.keys(parsedData[0]).filter(k => k !== 'id_temp').map(k => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Data de Aquisição</label>
                          <select value={importMappings.data_aquisicao} onChange={e => setImportMappings({...importMappings, data_aquisicao: e.target.value})}>
                            <option value="">-- Ignorar --</option>
                            {Object.keys(parsedData[0]).filter(k => k !== 'id_temp').map(k => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Garantia Até</label>
                          <select value={importMappings.data_garantia} onChange={e => setImportMappings({...importMappings, data_garantia: e.target.value})}>
                            <option value="">-- Ignorar --</option>
                            {Object.keys(parsedData[0]).filter(k => k !== 'id_temp').map(k => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem'}}>
                        <div style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>
                          Encontradas <strong>{parsedData.length}</strong> linhas na aba.
                        </div>
                        <button className="btn-primary gradient-btn" onClick={handleConfirmImport}>
                          <Sparkles size={18} /> Confirmar e Processar Importação
                        </button>
                      </div>

                      {/* Preview Table */}
                      <div style={{overflowX: 'auto', marginTop: '1.5rem', border: '1px solid var(--border)', borderRadius: '8px', maxHeight: '300px'}}>
                        <table style={{fontSize: '0.85rem'}}>
                          <thead style={{position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'var(--bg-card)'}}>
                            <tr>
                              {Object.keys(parsedData[0]).filter(k => k !== 'id_temp').map(k => (
                                <th key={k} style={{padding: '0.5rem 1rem'}}>{k}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {parsedData.slice(0, 10).map((row, idx) => (
                              <tr key={idx}>
                                {Object.keys(row).filter(k => k !== 'id_temp').map(k => (
                                  <td key={k} style={{padding: '0.5rem 1rem', color: importMappings.tag_patrimonio === k ? 'var(--accent)' : 'inherit'}}>
                                    {String(row[k] || '-')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={{color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem', textAlign: 'right'}}>
                        * Exibindo no preview as 10 primeiras linhas.
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'contratos' ? (
          /* ============================================================
             ABA DE CONTRATOS DE TI
          ============================================================ */
          <>
            {/* Alertas críticos de contratos */}
            {(contratoStats.vencidos > 0 || contratoStats.vencendo_30d > 0) && (
              <div style={{display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap'}}>
                {contratoStats.vencidos > 0 && (
                  <div style={{flex: 1, minWidth: '260px', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.1rem', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '10px'}}>
                    <CalendarX2 size={20} color="#ef4444" style={{flexShrink: 0}} />
                    <div>
                      <div style={{fontWeight: '700', color: '#ef4444', fontSize: '0.9rem'}}>{contratoStats.vencidos} contrato{contratoStats.vencidos > 1 ? 's' : ''} vencido{contratoStats.vencidos > 1 ? 's' : ''}</div>
                      <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>Acione o fornecedor ou inicie o processo de renovação/substituição.</div>
                    </div>
                  </div>
                )}
                {contratoStats.vencendo_30d > 0 && (
                  <div style={{flex: 1, minWidth: '260px', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.1rem', backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: '10px'}}>
                    <AlertTriangle size={20} color="var(--warning)" style={{flexShrink: 0}} />
                    <div>
                      <div style={{fontWeight: '700', color: 'var(--warning)', fontSize: '0.9rem'}}>{contratoStats.vencendo_30d} contrato{contratoStats.vencendo_30d > 1 ? 's' : ''} vencendo em 30 dias</div>
                      <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>Negocie a renovação antecipadamente para evitar interrupção de serviços.</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* KPI Cards */}
            <div className="stats-grid" style={{marginBottom: '1rem'}}>
              <div className="stat-card">
                <div className="stat-label">Total de Contratos</div>
                <div className="stat-value">{contratoStats.total}</div>
                <ScrollText size={24} color="var(--accent)" style={{marginTop: 'auto'}} />
              </div>
              <div className="stat-card">
                <div className="stat-label">Contratos Ativos</div>
                <div className="stat-value" style={{color: '#22c55e'}}>{contratoStats.ativos}</div>
                <BadgeCheck size={24} color="#22c55e" style={{marginTop: 'auto'}} />
              </div>
              <div className="stat-card" style={{borderColor: contratoStats.vencendo_30d > 0 ? 'rgba(245,158,11,0.35)' : undefined}}>
                <div className="stat-label">Vencendo em 30 dias</div>
                <div className="stat-value" style={{color: contratoStats.vencendo_30d > 0 ? 'var(--warning)' : 'var(--text-main)'}}>{contratoStats.vencendo_30d}</div>
                <AlertTriangle size={24} color={contratoStats.vencendo_30d > 0 ? 'var(--warning)' : 'var(--text-muted)'} style={{marginTop: 'auto'}} />
              </div>
              <div className="stat-card" style={{borderColor: contratoStats.vencidos > 0 ? 'rgba(239,68,68,0.35)' : undefined}}>
                <div className="stat-label">Contratos Vencidos</div>
                <div className="stat-value" style={{color: contratoStats.vencidos > 0 ? '#ef4444' : 'var(--text-muted)'}}>{contratoStats.vencidos}</div>
                <CalendarX2 size={24} color={contratoStats.vencidos > 0 ? '#ef4444' : 'var(--text-muted)'} style={{marginTop: 'auto'}} />
              </div>
            </div>

            {/* Custo anual + card renovação */}
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem'}}>
              <div className="stat-card" style={{borderColor: 'rgba(139,92,246,0.3)'}}>
                <div className="stat-label">Custo Anual de Contratos Ativos</div>
                <div className="stat-value" style={{fontSize: '1.05rem', color: '#8b5cf6'}}>
                  R$ {(contratoStats.valor_anual_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <DollarSign size={20} color="#8b5cf6" style={{marginTop: 'auto'}} />
              </div>
              <div className="stat-card">
                <div className="stat-label">Em Renovação</div>
                <div className="stat-value" style={{fontSize: '1.5rem', color: 'var(--accent)'}}>{contratoStats.em_renovacao || 0}</div>
                <RefreshCw size={20} color="var(--accent)" style={{marginTop: 'auto'}} />
              </div>
              <div className="stat-card">
                <div className="stat-label">Cancelados</div>
                <div className="stat-value" style={{fontSize: '1.5rem', color: 'var(--text-muted)'}}>{contratoStats.cancelados || 0}</div>
                <X size={20} color="var(--text-muted)" style={{marginTop: 'auto'}} />
              </div>
            </div>

            {/* Barra de filtros */}
            <div className="filter-bar" style={{marginBottom: '1.5rem'}}>
              <div className="search-box">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Pesquisar contrato, fornecedor, responsável..."
                  value={filterContratoText}
                  onChange={e => setFilterContratoText(e.target.value)}
                />
              </div>
              <div className="filter-select">
                <Filter size={16} />
                <select value={filterContratoStatus} onChange={e => setFilterContratoStatus(e.target.value)}>
                  <option value="Todos">📋 Todos Status</option>
                  <option value="Ativo">✅ Ativo</option>
                  <option value="Vencido">❌ Vencido</option>
                  <option value="Em Renovação">🔄 Em Renovação</option>
                  <option value="Cancelado">🚫 Cancelado</option>
                </select>
              </div>
              <div className="filter-select">
                <Briefcase size={16} />
                <select value={filterContratoTipo} onChange={e => setFilterContratoTipo(e.target.value)}>
                  <option value="Todos">📂 Todos Tipos</option>
                  {CONTRATO_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="export-buttons">
                <button className="btn-secondary" onClick={exportContratosToExcel} title="Exportar Excel">
                  <FileSpreadsheet size={18} />
                </button>
              </div>
              <button className="btn-primary gradient-btn" onClick={() => { setContratoFormData(contratoFormDefault); setIsContratoModalOpen(true); }}>
                <Plus size={20} /> Novo Contrato
              </button>
            </div>

            {/* Tabela de contratos */}
            {filteredContratos.length === 0 ? (
              <div style={{textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '12px'}}>
                <ScrollText size={48} color="var(--border)" style={{marginBottom: '1rem'}} />
                <div style={{fontSize: '1rem', fontWeight: '600'}}>Nenhum contrato encontrado</div>
                <div style={{fontSize: '0.85rem', marginTop: '0.5rem'}}>Cadastre o primeiro contrato de TI usando o botão "Novo Contrato".</div>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Nº / ID</th>
                      <th>Contrato</th>
                      <th>Fornecedor</th>
                      <th>Vigência</th>
                      <th>Valor Mensal</th>
                      <th>Valor Anual</th>
                      <th>Status</th>
                      <th>Responsável</th>
                      <th style={{textAlign: 'center'}}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContratos.map(c => {
                      const hoje = new Date(); hoje.setHours(0,0,0,0);
                      const venc = c.data_vencimento ? new Date(c.data_vencimento + 'T00:00:00') : null;
                      const diasRestantes = venc ? Math.floor((venc - hoje) / 86400000) : null;
                      const vencBadge = diasRestantes === null ? null
                        : diasRestantes < 0 ? { text: `Venceu há ${Math.abs(diasRestantes)}d`, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' }
                        : diasRestantes <= 30 ? { text: `Vence em ${diasRestantes}d`, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' }
                        : diasRestantes <= 60 ? { text: `Vence em ${diasRestantes}d`, color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.3)' }
                        : null;
                      const statusClass = c.status === 'Ativo' ? 'status-ativo'
                        : c.status === 'Vencido' ? 'status-vencido'
                        : c.status === 'Em Renovação' ? 'status-em-renovação'
                        : 'status-cancelado';
                      return (
                        <tr key={c.id} className="table-row-hover">
                          <td>
                            <div style={{display: 'flex', flexDirection: 'column', gap: '0.2rem'}}>
                              {c.numero_contrato ? (
                                <strong style={{color: 'var(--accent)', fontSize: '0.82rem'}}>{c.numero_contrato}</strong>
                              ) : (
                                <span style={{color: 'var(--text-muted)', fontSize: '0.78rem', fontStyle: 'italic'}}>#{c.id}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{display: 'flex', flexDirection: 'column', gap: '0.25rem', maxWidth: '200px'}}>
                              <strong style={{fontSize: '0.88rem'}}>{c.titulo}</strong>
                              <span style={{display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', fontWeight: '600', padding: '1px 7px', borderRadius: '999px', backgroundColor: 'rgba(56,189,248,0.1)', color: 'var(--accent)', width: 'fit-content'}}>
                                <Briefcase size={10} />{c.tipo}
                              </span>
                              {c.renovacao_automatica && (
                                <span style={{display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', padding: '1px 6px', borderRadius: '999px', backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e', width: 'fit-content'}}>
                                  <RefreshCw size={9} /> Auto-renovação
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{display: 'flex', flexDirection: 'column', gap: '0.2rem'}}>
                              <div style={{display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600'}}>
                                <Building2 size={13} color="var(--accent)" />{c.fornecedor}
                              </div>
                              {c.contato_fornecedor && (
                                <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>{c.contato_fornecedor}</div>
                              )}
                              {c.telefone_fornecedor && (
                                <div style={{display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.73rem', color: 'var(--text-muted)'}}>
                                  <Phone size={10} />{c.telefone_fornecedor}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{display: 'flex', flexDirection: 'column', gap: '0.25rem'}}>
                              {c.data_inicio && (
                                <div style={{fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem'}}>
                                  <Calendar size={10} />Início: {new Date(c.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR')}
                                </div>
                              )}
                              {venc && (
                                <div style={{fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem'}}>
                                  <Calendar size={11} color={diasRestantes !== null && diasRestantes < 0 ? '#ef4444' : diasRestantes !== null && diasRestantes <= 30 ? '#f59e0b' : 'var(--text-muted)'} />
                                  {venc.toLocaleDateString('pt-BR')}
                                </div>
                              )}
                              {vencBadge && (
                                <span style={{display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', fontWeight: '700', padding: '2px 7px', borderRadius: '999px', backgroundColor: vencBadge.bg, color: vencBadge.color, border: `1px solid ${vencBadge.border}`, width: 'fit-content'}}>
                                  <Clock size={9} />{vencBadge.text}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{fontSize: '0.85rem'}}>
                            {c.valor_mensal != null
                              ? <span>R$ {Number(c.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              : <span style={{color: 'var(--text-muted)', opacity: 0.4}}>—</span>}
                          </td>
                          <td style={{fontSize: '0.85rem'}}>
                            {c.valor_anual != null
                              ? <strong style={{color: '#8b5cf6'}}>R$ {Number(c.valor_anual).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                              : c.valor_mensal != null
                                ? <span style={{color: 'var(--text-muted)', fontSize: '0.78rem'}}>≈ R$ {(Number(c.valor_mensal) * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                : <span style={{color: 'var(--text-muted)', opacity: 0.4}}>—</span>}
                          </td>
                          <td>
                            <span className={`status-badge ${statusClass}`}>
                              {c.status}
                            </span>
                          </td>
                          <td style={{fontSize: '0.83rem', color: c.responsavel_interno ? 'var(--text-main)' : 'var(--text-muted)'}}>
                            {c.responsavel_interno || <span style={{opacity: 0.4, fontStyle: 'italic'}}>—</span>}
                          </td>
                          <td style={{textAlign: 'center'}} onClick={e => e.stopPropagation()}>
                            <div style={{display: 'flex', justifyContent: 'center', gap: '0.25rem'}}>
                              <button className="btn-icon" onClick={() => openEditContrato(c)} title="Editar Contrato">
                                <Edit2 size={15} />
                              </button>
                              <button className="btn-icon" style={{color: '#ef4444'}} onClick={() => handleDeleteContrato(c.id)} title="Excluir Contrato">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : activeTab === 'aquisicao' ? (
          /* ============================================================
             ABA DE AQUISIÇÃO DE MATERIAL
          ============================================================ */
          <>
            {/* Alertas críticos */}
            {solicitacaoStats.em_aberto > 0 && (
              <div style={{display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap'}}>
                <div style={{flex: 1, minWidth: '260px', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.1rem', backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: '10px'}}>
                  <AlertTriangle size={20} color="var(--warning)" style={{flexShrink: 0}} />
                  <div>
                    <div style={{fontWeight: '700', color: 'var(--warning)', fontSize: '0.9rem'}}>{solicitacaoStats.em_aberto} solicitação{solicitacaoStats.em_aberto > 1 ? 'ões' : ''} em andamento</div>
                    <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>Valor comprometido: R$ {(solicitacaoStats.valor_comprometido || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                  </div>
                </div>
              </div>
            )}

            {/* KPI Cards */}
            <div className="stats-grid" style={{marginBottom: '1rem'}}>
              <div className="stat-card">
                <div className="stat-label">Total de Solicitações</div>
                <div className="stat-value">{solicitacaoStats.total}</div>
                <ClipboardList size={24} color="var(--accent)" style={{marginTop: 'auto'}} />
              </div>
              <div className="stat-card" style={{borderColor: solicitacaoStats.em_aberto > 0 ? 'rgba(245,158,11,0.3)' : undefined}}>
                <div className="stat-label">Em Aberto</div>
                <div className="stat-value" style={{color: solicitacaoStats.em_aberto > 0 ? 'var(--warning)' : 'var(--text-main)'}}>{solicitacaoStats.em_aberto}</div>
                <ListChecks size={24} color={solicitacaoStats.em_aberto > 0 ? 'var(--warning)' : 'var(--text-muted)'} style={{marginTop: 'auto'}} />
              </div>
              <div className="stat-card">
                <div className="stat-label">Recebidas</div>
                <div className="stat-value" style={{color: 'var(--success)'}}>{solicitacaoStats.recebidos}</div>
                <PackageCheck size={24} color="var(--success)" style={{marginTop: 'auto'}} />
              </div>
              <div className="stat-card">
                <div className="stat-label">Valor Total Gasto</div>
                <div className="stat-value" style={{fontSize: '1.1rem'}}>R$ {(solicitacaoStats.valor_gasto_total || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
                <TrendingDown size={24} color="#8b5cf6" style={{marginTop: 'auto'}} />
              </div>
            </div>

            {/* Charts */}
            <div className="dashboard-row" style={{marginBottom: '1.5rem'}}>
              <div className="chart-container">
                <h3>Gastos por Categoria (Recebidos)</h3>
                <div style={{height: '260px'}}>
                  {(solicitacaoStats.gastos_por_categoria || []).length > 0 ? (
                    <SafeChart>
                      <BarChart data={solicitacaoStats.gastos_por_categoria} margin={{top: 10, right: 20, left: 40, bottom: 20}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="categoria" stroke="#94a3b8" tick={{fontSize: 11}} />
                        <YAxis stroke="#94a3b8" tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{backgroundColor: '#1e293b', border: '1px solid var(--border)', borderRadius: '8px'}} formatter={v => `R$ ${v.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`} />
                        <Bar dataKey="valor" fill="#8b5cf6" radius={[4,4,0,0]} />
                      </BarChart>
                    </SafeChart>
                  ) : (
                    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--text-muted)',fontSize:'0.9rem'}}>
                      <Inbox size={32} style={{marginRight:'0.5rem', opacity: 0.4}} /> Nenhum material recebido ainda.
                    </div>
                  )}
                </div>
              </div>
              <div className="chart-container">
                <h3>Funil de Status das Solicitações</h3>
                <div style={{height: '260px'}}>
                  {solicitacaoStats.total > 0 ? (
                    <SafeChart>
                      <BarChart data={(solicitacaoStats.funil_status || []).filter(f => f.quantidade > 0)} layout="vertical" margin={{top: 5, right: 30, left: 100, bottom: 5}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" stroke="#94a3b8" allowDecimals={false} />
                        <YAxis type="category" dataKey="status" stroke="#94a3b8" tick={{fontSize: 11}} width={95} />
                        <Tooltip contentStyle={{backgroundColor: '#1e293b', border: '1px solid var(--border)', borderRadius: '8px'}} />
                        <Bar dataKey="quantidade" fill="var(--accent)" radius={[0,4,4,0]} />
                      </BarChart>
                    </SafeChart>
                  ) : (
                    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--text-muted)',fontSize:'0.9rem'}}>
                      <Inbox size={32} style={{marginRight:'0.5rem', opacity: 0.4}} /> Nenhuma solicitação cadastrada.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Filtros e Ações */}
            <div style={{display:'flex', gap:'0.75rem', flexWrap:'wrap', alignItems:'center', marginBottom:'1rem'}}>
              <div style={{position:'relative', flex:'1', minWidth:'200px'}}>
                <Search size={16} style={{position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)'}} />
                <input style={{paddingLeft:'2.2rem', width:'100%'}} placeholder="Buscar por título, nº, solicitante..." value={filterSolicitacaoText} onChange={e => setFilterSolicitacaoText(e.target.value)} />
              </div>
              <select value={filterSolicitacaoStatus} onChange={e => setFilterSolicitacaoStatus(e.target.value)} style={{minWidth:'160px'}}>
                <option value="Todos">Todos os Status</option>
                {SOLICITACAO_STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterSolicitacaoPrioridade} onChange={e => setFilterSolicitacaoPrioridade(e.target.value)} style={{minWidth:'140px'}}>
                <option value="Todos">Todas Prioridades</option>
                {SOLICITACAO_PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={filterSolicitacaoCategoria} onChange={e => setFilterSolicitacaoCategoria(e.target.value)} style={{minWidth:'150px'}}>
                <option value="Todos">Todas Categorias</option>
                {SOLICITACAO_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button className="btn-secondary" onClick={exportSolicitacoesToExcel} title="Exportar Excel">
                <FileSpreadsheet size={16} /> Excel
              </button>
              <button className="btn-primary gradient-btn" onClick={openCreateSolicitacao}>
                <PackagePlus size={16} /> Nova Solicitação
              </button>
            </div>

            {/* Info linha */}
            <div style={{fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:'0.75rem', display:'flex', gap:'1.5rem'}}>
              <span>{filteredSolicitacoes.length} solicitação{filteredSolicitacoes.length !== 1 ? 'ões' : ''} encontrada{filteredSolicitacoes.length !== 1 ? 's' : ''}</span>
              {filterSolicitacaoStatus === 'Todos' && (
                <>
                  <span style={{color:'var(--warning)'}}>Em Aberto: {solicitacaoStats.em_aberto}</span>
                  <span style={{color:'var(--success)'}}>Recebidas: {solicitacaoStats.recebidos}</span>
                </>
              )}
            </div>

            {/* Tabela */}
            {filteredSolicitacoes.length === 0 ? (
              <div style={{textAlign:'center', padding:'4rem', color:'var(--text-muted)', border:'1px dashed var(--border)', borderRadius:'12px'}}>
                <ShoppingCart size={40} style={{opacity:0.3, marginBottom:'0.75rem'}} />
                <div style={{fontWeight:'600', marginBottom:'0.25rem'}}>Nenhuma solicitação encontrada</div>
                <div style={{fontSize:'0.85rem'}}>Clique em "Nova Solicitação" para registrar uma requisição de material.</div>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Nº / Data</th>
                      <th>Título</th>
                      <th>Categoria</th>
                      <th>Prioridade</th>
                      <th>Solicitante</th>
                      <th>Status</th>
                      <th>Qtd</th>
                      <th>Valor Estimado</th>
                      <th>Previsão</th>
                      <th style={{textAlign:'center'}}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSolicitacoes.map(s => {
                      const priorColor = {Baixa:'#22c55e', Média:'#38bdf8', Alta:'#f59e0b', Crítica:'#ef4444'}[s.prioridade] || '#94a3b8';
                      const statusColor = {
                        'Rascunho': '#94a3b8',
                        'Aguard. Aprovação': '#f59e0b',
                        'Aprovado': '#22c55e',
                        'Em Cotação': '#38bdf8',
                        'Em Aquisição': '#8b5cf6',
                        'Recebido': '#22c55e',
                        'Cancelado': '#ef4444',
                      }[s.status] || '#94a3b8';
                      const statusBg = {
                        'Rascunho': 'rgba(148,163,184,0.1)',
                        'Aguard. Aprovação': 'rgba(245,158,11,0.1)',
                        'Aprovado': 'rgba(34,197,94,0.1)',
                        'Em Cotação': 'rgba(56,189,248,0.1)',
                        'Em Aquisição': 'rgba(139,92,246,0.1)',
                        'Recebido': 'rgba(34,197,94,0.12)',
                        'Cancelado': 'rgba(239,68,68,0.1)',
                      }[s.status] || 'rgba(148,163,184,0.1)';
                      return (
                        <tr key={s.id}>
                          <td>
                            <div style={{display:'flex', flexDirection:'column', gap:'2px'}}>
                              <span style={{fontWeight:'700', fontSize:'0.82rem', color:'var(--accent)', fontFamily:'monospace'}}>{s.numero_solicitacao}</span>
                              <span style={{fontSize:'0.72rem', color:'var(--text-muted)'}}>
                                {s.data_solicitacao ? new Date(s.data_solicitacao + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div style={{maxWidth:'220px'}}>
                              <div style={{fontWeight:'600', fontSize:'0.88rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{s.titulo}</div>
                              {s.centro_custo && <div style={{fontSize:'0.72rem', color:'var(--text-muted)'}}><Tag size={10} style={{marginRight:'3px'}} />{s.centro_custo}</div>}
                            </div>
                          </td>
                          <td>
                            <span style={{fontSize:'0.78rem', fontWeight:'600', padding:'2px 8px', borderRadius:'6px', backgroundColor:'rgba(37,99,235,0.1)', color:'var(--accent)', border:'1px solid rgba(37,99,235,0.2)'}}>
                              {s.categoria}
                            </span>
                          </td>
                          <td>
                            <span style={{fontSize:'0.78rem', fontWeight:'700', padding:'2px 8px', borderRadius:'6px', backgroundColor:`${priorColor}18`, color:priorColor, border:`1px solid ${priorColor}40`}}>
                              {s.prioridade}
                            </span>
                          </td>
                          <td style={{fontSize:'0.85rem', color: s.solicitante ? 'var(--text-main)' : 'var(--text-muted)'}}>
                            {s.solicitante || <span style={{opacity:0.4, fontStyle:'italic'}}>—</span>}
                          </td>
                          <td>
                            <span style={{display:'inline-flex', alignItems:'center', gap:'0.3rem', fontSize:'0.78rem', fontWeight:'700', padding:'3px 10px', borderRadius:'999px', backgroundColor:statusBg, color:statusColor, border:`1px solid ${statusColor}40`}}>
                              <CircleDot size={10} />
                              {s.status}
                            </span>
                          </td>
                          <td style={{textAlign:'center', fontWeight:'600'}}>{s.quantidade_solicitada || 1}</td>
                          <td style={{fontWeight:'600', fontSize:'0.88rem', color: s.valor_estimado ? 'var(--text-main)' : 'var(--text-muted)'}}>
                            {s.valor_estimado != null ? `R$ ${Number(s.valor_estimado).toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : <span style={{opacity:0.4}}>—</span>}
                          </td>
                          <td style={{fontSize:'0.83rem'}}>
                            {s.data_previsao_entrega ? new Date(s.data_previsao_entrega + 'T00:00:00').toLocaleDateString('pt-BR') : <span style={{color:'var(--text-muted)', opacity:0.4}}>—</span>}
                          </td>
                          <td style={{textAlign:'center'}} onClick={e => e.stopPropagation()}>
                            <div style={{display:'flex', justifyContent:'center', gap:'0.25rem'}}>
                              <button className="btn-icon" onClick={() => openEditSolicitacao(s)} title="Editar Solicitação">
                                <Edit2 size={15} />
                              </button>
                              <button className="btn-icon" style={{color:'#ef4444'}} onClick={() => handleDeleteSolicitacao(s.id)} title="Excluir Solicitação">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          /* Aba de Relatórios e Gráficos */
          <div className="reports-grid">
            <div className="chart-card full-width">
              <h3>Valor Total de Ativos por Setor</h3>
              <div style={{ height: '350px', width: '100%' }}>
                {reportValueBySector.length > 0 ? (
                  <SafeChart>
                    <BarChart data={reportValueBySector} margin={{ top: 20, right: 30, left: 40, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="setor" stroke="#94a3b8" angle={-45} textAnchor="end" height={80} />
                      <YAxis stroke="#94a3b8" tickFormatter={(val) => `R$ ${val}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid var(--border)', borderRadius: '8px' }}
                        formatter={(val) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      />
                      <Bar dataKey="valor" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </SafeChart>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                    Não existem informações de valores para apresentar.
                  </div>
                )}
              </div>
            </div>

            <div className="chart-card">
              <h3>Quantidade de Ativos por Categoria</h3>
              <div style={{ height: '300px' }}>
                {reportAssetsByType.length > 0 ? (
                  <SafeChart>
                    <PieChart>
                      <Pie
                        data={reportAssetsByType}
                        dataKey="quantidade"
                        nameKey="tipo"
                        cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label
                      >
                        {reportAssetsByType.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid var(--border)' }} />
                      <Legend />
                    </PieChart>
                  </SafeChart>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                    Nenhuma categoria cadastrada.
                  </div>
                )}
              </div>
            </div>

            <div className="chart-card">
              <h3>Status de Garantia dos Equipamentos</h3>
              <div style={{ height: '300px' }}>
                {reportGarantiaStatus.some(r => r.quantidade > 0) ? (
                  <SafeChart>
                    <PieChart>
                      <Pie
                        data={reportGarantiaStatus.filter(r => r.quantidade > 0)}
                        dataKey="quantidade"
                        nameKey="status"
                        cx="50%" cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={4}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {reportGarantiaStatus.filter(r => r.quantidade > 0).map((entry) => {
                          const colorMap = { 'Ativa': '#22c55e', 'Vencendo (30d)': '#f59e0b', 'Vencida': '#ef4444', 'Sem Registro': '#64748b' };
                          return <Cell key={entry.status} fill={colorMap[entry.status] || '#8b5cf6'} />;
                        })}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid var(--border)', borderRadius: '8px' }}
                        formatter={(val, name) => [`${val} equipamento${val !== 1 ? 's' : ''}`, name]}
                      />
                      <Legend />
                    </PieChart>
                  </SafeChart>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                    Nenhum dado de garantia cadastrado. Preencha as datas de garantia nos ativos.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- MODAL NOVO ATIVO --- */}
        {isModalOpen && (
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem'}}>
                <h2>Cadastrar Novo Ativo</h2>
                <X size={24} style={{cursor: 'pointer'}} onClick={() => setIsModalOpen(false)} />
              </div>
              <form onSubmit={handleCreateAtivo}>
                {formData.tipo !== 'TONER' ? (
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                    <div className="form-group">
                      <label style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}>
                        TAG Patrimônio *
                        <span style={{fontSize: '0.7rem', background: 'var(--accent)', color: '#fff', borderRadius: '4px', padding: '1px 6px', fontWeight: '600', letterSpacing: '0.02em'}}>AUTO</span>
                      </label>
                      <input required value={formData.tag_patrimonio} onChange={e => setFormData({...formData, tag_patrimonio: e.target.value})} placeholder="Gerado automaticamente..." />
                    </div>
                    <div className="form-group">
                      <label>Tipo de Equipamento</label>
                      <select value={formData.tipo} onChange={async e => {
                        const novoTipo = e.target.value;
                        const nextTag = await fetchNextTag(novoTipo);
                        setFormData({...formData, tipo: novoTipo, tag_patrimonio: nextTag});
                      }}>
                        <option value="NOTEBOOK">NOTEBOOK</option>
                        <option value="MONITOR">MONITOR</option>
                        <option value="DESKTOP">DESKTOP</option>
                        <option value="CELULAR">CELULAR</option>
                        <option value="IMPRESSORA">IMPRESSORA</option>
                        <option value="TONER">TONER DE IMPRESSORA</option>
                        <option value="LICENÇA">LICENÇA</option>
                        <option value="STARLINK">STARLINK</option>
                        <option value="OUTROS">OUTROS</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Tipo de Equipamento</label>
                    <select value={formData.tipo} onChange={async e => {
                      const novoTipo = e.target.value;
                      const nextTag = await fetchNextTag(novoTipo);
                      setFormData({...formData, tipo: novoTipo, tag_patrimonio: nextTag, quantidade: 1});
                    }}>
                      <option value="NOTEBOOK">NOTEBOOK</option>
                      <option value="MONITOR">MONITOR</option>
                      <option value="DESKTOP">DESKTOP</option>
                      <option value="CELULAR">CELULAR</option>
                      <option value="IMPRESSORA">IMPRESSORA</option>
                      <option value="TONER">TONER DE IMPRESSORA</option>
                      <option value="LICENÇA">LICENÇA</option>
                      <option value="STARLINK">STARLINK</option>
                      <option value="OUTROS">OUTROS</option>
                    </select>
                  </div>
                )}

                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Marca *</label>
                    <input required value={formData.marca} onChange={e => setFormData({...formData, marca: e.target.value})} placeholder="Ex: Dell" />
                  </div>
                  <div className="form-group">
                    <label>Modelo *</label>
                    <input required value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} placeholder="Ex: Latitude 3420" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Especificações / Descrição</label>
                  <textarea rows="2" value={formData.especificacoes} onChange={e => setFormData({...formData, especificacoes: e.target.value})} placeholder="Ex: i5, 16GB RAM, 512GB SSD" />
                </div>

                {['NOTEBOOK', 'DESKTOP'].includes(formData.tipo) && (
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                    <div className="form-group">
                      <label>Licença Windows</label>
                      <input value={formData.licenca_windows} onChange={e => setFormData({...formData, licenca_windows: e.target.value})} placeholder="Ex: Win 11 Pro" />
                    </div>
                    <div className="form-group">
                      <label>Licença Office</label>
                      <input value={formData.licenca_office} onChange={e => setFormData({...formData, licenca_office: e.target.value})} placeholder="Ex: Office 365" />
                    </div>
                  </div>
                )}

                {formData.tipo === 'CELULAR' && (
                  <div className="form-group">
                    <label>Número do Chip (SIM)</label>
                    <input value={formData.numero_chip} onChange={e => setFormData({...formData, numero_chip: e.target.value})} placeholder="Ex: (11) 99999-0000" />
                  </div>
                )}

                {formData.tipo !== 'TONER' && (
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                    <div className="form-group">
                      <label>Número de Série</label>
                      <input value={formData.numero_serie} onChange={e => setFormData({...formData, numero_serie: e.target.value})} placeholder="Ex: SN-ABC123456" />
                    </div>
                    <div className="form-group">
                      <label>Fornecedor</label>
                      <input value={formData.fornecedor} onChange={e => setFormData({...formData, fornecedor: e.target.value})} placeholder="Ex: Dell Brasil Ltda" />
                    </div>
                  </div>
                )}

                {formData.tipo !== 'TONER' && (
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                    <div className="form-group">
                      <label>Data de Aquisição</label>
                      <input type="date" value={formData.data_aquisicao} onChange={e => setFormData({...formData, data_aquisicao: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Garantia Até</label>
                      <input type="date" value={formData.data_garantia} onChange={e => setFormData({...formData, data_garantia: e.target.value})} />
                    </div>
                  </div>
                )}

                {formData.tipo === 'TONER' && (
                  <div className="form-group">
                    <label>Quantidade *</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={formData.quantidade}
                      onChange={e => setFormData({...formData, quantidade: e.target.value})}
                      placeholder="Ex: 10"
                    />
                  </div>
                )}

                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Valor (R$)</label>
                    <input type="number" step="0.01" value={formData.valor} onChange={e => setFormData({...formData, valor: e.target.value})} placeholder="0.00" />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                      <option value="Estoque">Estoque</option>
                      <option value="Em Uso">Em Uso</option>
                      <option value="Manutenção">Manutenção</option>
                      <option value="Descartado">Descartado</option>
                    </select>
                  </div>
                </div>

                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Localização</label>
                    <input value={formData.local_fisico} onChange={e => setFormData({...formData, local_fisico: e.target.value})} placeholder="Ex: Sede Central" />
                  </div>
                  <div className="form-group">
                    <label>Atribuir Colaborador</label>
                    <select value={formData.colaborador_id} onChange={e => setFormData({...formData, colaborador_id: e.target.value})}>
                      <option value="">Nenhum (Disponível)</option>
                      {colaboradores.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Observação</label>
                  <textarea rows="2" value={formData.observacao} onChange={e => setFormData({...formData, observacao: e.target.value})} placeholder="Anotações adicionais sobre o equipamento..." />
                </div>

                <button type="submit" className="btn-primary gradient-btn" style={{width: '100%', justifyContent: 'center', marginTop: '1rem'}}>
                  Salvar Equipamento
                </button>
              </form>
            </div>
          </div>
        )}

        {/* --- MODAL CRIAR SOLICITAÇÃO --- */}
        {isSolicitacaoModalOpen && (
          <div className="modal-overlay" onClick={() => setIsSolicitacaoModalOpen(false)}>
            <div className="modal" style={{maxWidth: '760px'}} onClick={e => e.stopPropagation()}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
                <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
                  <PackagePlus size={22} color="var(--accent)" />
                  <h2 style={{margin:0}}>Nova Solicitação de Aquisição</h2>
                </div>
                <X size={24} style={{cursor:'pointer'}} onClick={() => setIsSolicitacaoModalOpen(false)} />
              </div>
              <form onSubmit={handleCreateSolicitacao}>
                <div style={{display:'grid', gridTemplateColumns:'1fr 2fr', gap:'1rem'}}>
                  <div className="form-group">
                    <label>Nº Solicitação</label>
                    <input value={solicitacaoFormData.numero_solicitacao} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, numero_solicitacao: e.target.value})} placeholder="REQ-AVAN-001" />
                  </div>
                  <div className="form-group">
                    <label>Título *</label>
                    <input required value={solicitacaoFormData.titulo} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, titulo: e.target.value})} placeholder="Ex: Aquisição de 3 Notebooks para equipe de TI" />
                  </div>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem'}}>
                  <div className="form-group">
                    <label>Categoria *</label>
                    <select required value={solicitacaoFormData.categoria} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, categoria: e.target.value})}>
                      {SOLICITACAO_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Prioridade</label>
                    <select value={solicitacaoFormData.prioridade} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, prioridade: e.target.value})}>
                      {SOLICITACAO_PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Quantidade</label>
                    <input type="number" min="1" value={solicitacaoFormData.quantidade_solicitada} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, quantidade_solicitada: e.target.value})} />
                  </div>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem'}}>
                  <div className="form-group">
                    <label>Solicitante</label>
                    <input value={solicitacaoFormData.solicitante} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, solicitante: e.target.value})} placeholder="Nome do responsável" />
                  </div>
                  <div className="form-group">
                    <label>Centro de Custo</label>
                    <input value={solicitacaoFormData.centro_custo} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, centro_custo: e.target.value})} placeholder="Ex: TI / Obras / ADM" />
                  </div>
                  <div className="form-group">
                    <label>Valor Estimado (R$)</label>
                    <input type="number" step="0.01" value={solicitacaoFormData.valor_estimado} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, valor_estimado: e.target.value})} placeholder="0,00" />
                  </div>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                  <div className="form-group">
                    <label>Data da Solicitação</label>
                    <input type="date" value={solicitacaoFormData.data_solicitacao} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, data_solicitacao: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Previsão de Entrega</label>
                    <input type="date" value={solicitacaoFormData.data_previsao_entrega} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, data_previsao_entrega: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Justificativa de Negócio</label>
                  <textarea rows="2" value={solicitacaoFormData.justificativa} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, justificativa: e.target.value})} placeholder="Descreva por que este material é necessário e o impacto da não aquisição..." />
                </div>
                <div className="form-group">
                  <label>Descrição Técnica</label>
                  <textarea rows="2" value={solicitacaoFormData.descricao} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, descricao: e.target.value})} placeholder="Especificações técnicas, marca de referência, modelo sugerido..." />
                </div>
                <button type="submit" className="btn-primary gradient-btn" style={{width:'100%', justifyContent:'center', marginTop:'1rem'}}>
                  <PackagePlus size={16} /> Registrar Solicitação
                </button>
              </form>
            </div>
          </div>
        )}

        {/* --- MODAL EDITAR SOLICITAÇÃO --- */}
        {isSolicitacaoEditModalOpen && editingSolicitacao && (
          <div className="modal-overlay" onClick={() => setIsSolicitacaoEditModalOpen(false)}>
            <div className="modal" style={{maxWidth: '760px'}} onClick={e => e.stopPropagation()}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}>
                <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
                  <Edit2 size={22} color="var(--accent)" />
                  <h2 style={{margin:0}}>Editar Solicitação — <span style={{fontFamily:'monospace', color:'var(--accent)'}}>{editingSolicitacao.numero_solicitacao}</span></h2>
                </div>
                <X size={24} style={{cursor:'pointer'}} onClick={() => setIsSolicitacaoEditModalOpen(false)} />
              </div>
              <form onSubmit={handleUpdateSolicitacao}>
                <div style={{display:'grid', gridTemplateColumns:'1fr 2fr', gap:'1rem'}}>
                  <div className="form-group">
                    <label>Nº Solicitação</label>
                    <input value={solicitacaoFormData.numero_solicitacao} readOnly style={{opacity:0.6, cursor:'not-allowed'}} />
                  </div>
                  <div className="form-group">
                    <label>Título *</label>
                    <input required value={solicitacaoFormData.titulo} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, titulo: e.target.value})} />
                  </div>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem'}}>
                  <div className="form-group">
                    <label>Categoria *</label>
                    <select required value={solicitacaoFormData.categoria} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, categoria: e.target.value})}>
                      {SOLICITACAO_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Prioridade</label>
                    <select value={solicitacaoFormData.prioridade} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, prioridade: e.target.value})}>
                      {SOLICITACAO_PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={solicitacaoFormData.status} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, status: e.target.value})}>
                      {SOLICITACAO_STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem'}}>
                  <div className="form-group">
                    <label>Solicitante</label>
                    <input value={solicitacaoFormData.solicitante} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, solicitante: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Aprovador</label>
                    <input value={solicitacaoFormData.aprovador} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, aprovador: e.target.value})} placeholder="Nome do aprovador" />
                  </div>
                  <div className="form-group">
                    <label>Fornecedor Escolhido</label>
                    <input value={solicitacaoFormData.fornecedor_escolhido} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, fornecedor_escolhido: e.target.value})} placeholder="Nome do fornecedor" />
                  </div>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                  <div className="form-group">
                    <label>Centro de Custo</label>
                    <input value={solicitacaoFormData.centro_custo} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, centro_custo: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Quantidade</label>
                    <input type="number" min="1" value={solicitacaoFormData.quantidade_solicitada} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, quantidade_solicitada: e.target.value})} />
                  </div>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'1rem'}}>
                  <div className="form-group">
                    <label>Valor Estimado (R$)</label>
                    <input type="number" step="0.01" value={solicitacaoFormData.valor_estimado} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, valor_estimado: e.target.value})} placeholder="0,00" />
                  </div>
                  <div className="form-group">
                    <label>Valor Aprovado (R$)</label>
                    <input type="number" step="0.01" value={solicitacaoFormData.valor_aprovado} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, valor_aprovado: e.target.value})} placeholder="0,00" />
                  </div>
                  <div className="form-group">
                    <label>Valor Final Pago (R$)</label>
                    <input type="number" step="0.01" value={solicitacaoFormData.valor_final} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, valor_final: e.target.value})} placeholder="0,00" />
                  </div>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'1rem'}}>
                  <div className="form-group">
                    <label>Data Solicitação</label>
                    <input type="date" value={solicitacaoFormData.data_solicitacao} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, data_solicitacao: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Data Aprovação</label>
                    <input type="date" value={solicitacaoFormData.data_aprovacao} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, data_aprovacao: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Previsão de Entrega</label>
                    <input type="date" value={solicitacaoFormData.data_previsao_entrega} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, data_previsao_entrega: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Data Recebimento</label>
                    <input type="date" value={solicitacaoFormData.data_recebimento} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, data_recebimento: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Justificativa</label>
                  <textarea rows="2" value={solicitacaoFormData.justificativa} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, justificativa: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Observações</label>
                  <textarea rows="2" value={solicitacaoFormData.observacoes} onChange={e => setSolicitacaoFormData({...solicitacaoFormData, observacoes: e.target.value})} placeholder="Cotações recebidas, fornecedores avaliados, decisões tomadas..." />
                </div>
                <button type="submit" className="btn-primary gradient-btn" style={{width:'100%', justifyContent:'center', marginTop:'1rem'}}>
                  <ArrowRight size={16} /> Salvar Alterações
                </button>
              </form>
            </div>
          </div>
        )}

        {/* --- MODAL CRIAR CONTRATO --- */}
        {isContratoModalOpen && (
          <div className="modal-overlay" onClick={() => setIsContratoModalOpen(false)}>
            <div className="modal" style={{maxWidth: '720px'}} onClick={e => e.stopPropagation()}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                  <ScrollText size={22} color="var(--accent)" />
                  <h2 style={{margin: 0}}>Novo Contrato de TI</h2>
                </div>
                <X size={24} style={{cursor: 'pointer'}} onClick={() => setIsContratoModalOpen(false)} />
              </div>
              <form onSubmit={handleCreateContrato}>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Nº do Contrato</label>
                    <input value={contratoFormData.numero_contrato} onChange={e => setContratoFormData({...contratoFormData, numero_contrato: e.target.value})} placeholder="Ex: CTR-2025-001" />
                  </div>
                  <div className="form-group">
                    <label>Título do Contrato *</label>
                    <input required value={contratoFormData.titulo} onChange={e => setContratoFormData({...contratoFormData, titulo: e.target.value})} placeholder="Ex: Licença Microsoft 365 E3" />
                  </div>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Tipo de Contrato *</label>
                    <select required value={contratoFormData.tipo} onChange={e => setContratoFormData({...contratoFormData, tipo: e.target.value})}>
                      {CONTRATO_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Fornecedor *</label>
                    <input required value={contratoFormData.fornecedor} onChange={e => setContratoFormData({...contratoFormData, fornecedor: e.target.value})} placeholder="Ex: Microsoft Brasil Ltda" />
                  </div>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Contato no Fornecedor</label>
                    <input value={contratoFormData.contato_fornecedor} onChange={e => setContratoFormData({...contratoFormData, contato_fornecedor: e.target.value})} placeholder="Nome do contato" />
                  </div>
                  <div className="form-group">
                    <label>Telefone Fornecedor</label>
                    <input value={contratoFormData.telefone_fornecedor} onChange={e => setContratoFormData({...contratoFormData, telefone_fornecedor: e.target.value})} placeholder="(11) 9999-0000" />
                  </div>
                  <div className="form-group">
                    <label>E-mail Fornecedor</label>
                    <input type="email" value={contratoFormData.email_fornecedor} onChange={e => setContratoFormData({...contratoFormData, email_fornecedor: e.target.value})} placeholder="contato@fornecedor.com" />
                  </div>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Data de Início</label>
                    <input type="date" value={contratoFormData.data_inicio} onChange={e => setContratoFormData({...contratoFormData, data_inicio: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Data de Vencimento *</label>
                    <input type="date" required value={contratoFormData.data_vencimento} onChange={e => setContratoFormData({...contratoFormData, data_vencimento: e.target.value})} />
                  </div>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Valor Mensal (R$)</label>
                    <input type="number" step="0.01" value={contratoFormData.valor_mensal} onChange={e => setContratoFormData({...contratoFormData, valor_mensal: e.target.value})} placeholder="0,00" />
                  </div>
                  <div className="form-group">
                    <label>Valor Anual (R$)</label>
                    <input type="number" step="0.01" value={contratoFormData.valor_anual} onChange={e => setContratoFormData({...contratoFormData, valor_anual: e.target.value})} placeholder="0,00" />
                  </div>
                  <div className="form-group">
                    <label>Valor Total (R$)</label>
                    <input type="number" step="0.01" value={contratoFormData.valor_total} onChange={e => setContratoFormData({...contratoFormData, valor_total: e.target.value})} placeholder="0,00" />
                  </div>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={contratoFormData.status} onChange={e => setContratoFormData({...contratoFormData, status: e.target.value})}>
                      <option value="Ativo">Ativo</option>
                      <option value="Em Renovação">Em Renovação</option>
                      <option value="Cancelado">Cancelado</option>
                      <option value="Vencido">Vencido</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Responsável Interno</label>
                    <input value={contratoFormData.responsavel_interno} onChange={e => setContratoFormData({...contratoFormData, responsavel_interno: e.target.value})} placeholder="Ex: João Silva" />
                  </div>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Prazo de Aviso (dias antes do vencimento)</label>
                    <input type="number" min="0" max="365" value={contratoFormData.prazo_aviso_dias} onChange={e => setContratoFormData({...contratoFormData, prazo_aviso_dias: e.target.value})} />
                  </div>
                  <div className="form-group" style={{justifyContent: 'center', paddingTop: '0.5rem'}}>
                    <label style={{marginBottom: '0.5rem'}}>Renovação Automática</label>
                    <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '0.3rem'}}>
                      <input type="checkbox" id="renov_auto_create" checked={contratoFormData.renovacao_automatica} onChange={e => setContratoFormData({...contratoFormData, renovacao_automatica: e.target.checked})} style={{width: '18px', height: '18px', cursor: 'pointer'}} />
                      <label htmlFor="renov_auto_create" style={{cursor: 'pointer', fontWeight: '400', color: 'var(--text-muted)', margin: 0}}>Sim, renova automaticamente</label>
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label>Descrição / Objeto do Contrato</label>
                  <textarea rows="2" value={contratoFormData.descricao} onChange={e => setContratoFormData({...contratoFormData, descricao: e.target.value})} placeholder="Descreva o objeto principal deste contrato..." />
                </div>
                <div className="form-group">
                  <label>Observações</label>
                  <textarea rows="2" value={contratoFormData.observacoes} onChange={e => setContratoFormData({...contratoFormData, observacoes: e.target.value})} placeholder="Notas adicionais, cláusulas importantes, etc..." />
                </div>
                <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem'}}>
                  <button type="button" className="btn-secondary" onClick={() => setIsContratoModalOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary gradient-btn"><Plus size={16} /> Cadastrar Contrato</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- MODAL EDITAR CONTRATO --- */}
        {isContratoEditModalOpen && (
          <div className="modal-overlay" onClick={() => setIsContratoEditModalOpen(false)}>
            <div className="modal" style={{maxWidth: '720px'}} onClick={e => e.stopPropagation()}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                  <ScrollText size={22} color="var(--accent)" />
                  <h2 style={{margin: 0}}>Editar Contrato</h2>
                </div>
                <X size={24} style={{cursor: 'pointer'}} onClick={() => setIsContratoEditModalOpen(false)} />
              </div>
              <form onSubmit={handleUpdateContrato}>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Nº do Contrato</label>
                    <input value={contratoFormData.numero_contrato} onChange={e => setContratoFormData({...contratoFormData, numero_contrato: e.target.value})} placeholder="Ex: CTR-2025-001" />
                  </div>
                  <div className="form-group">
                    <label>Título do Contrato *</label>
                    <input required value={contratoFormData.titulo} onChange={e => setContratoFormData({...contratoFormData, titulo: e.target.value})} />
                  </div>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Tipo de Contrato *</label>
                    <select required value={contratoFormData.tipo} onChange={e => setContratoFormData({...contratoFormData, tipo: e.target.value})}>
                      {CONTRATO_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Fornecedor *</label>
                    <input required value={contratoFormData.fornecedor} onChange={e => setContratoFormData({...contratoFormData, fornecedor: e.target.value})} />
                  </div>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Contato no Fornecedor</label>
                    <input value={contratoFormData.contato_fornecedor} onChange={e => setContratoFormData({...contratoFormData, contato_fornecedor: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Telefone Fornecedor</label>
                    <input value={contratoFormData.telefone_fornecedor} onChange={e => setContratoFormData({...contratoFormData, telefone_fornecedor: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>E-mail Fornecedor</label>
                    <input type="email" value={contratoFormData.email_fornecedor} onChange={e => setContratoFormData({...contratoFormData, email_fornecedor: e.target.value})} />
                  </div>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Data de Início</label>
                    <input type="date" value={contratoFormData.data_inicio} onChange={e => setContratoFormData({...contratoFormData, data_inicio: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Data de Vencimento *</label>
                    <input type="date" required value={contratoFormData.data_vencimento} onChange={e => setContratoFormData({...contratoFormData, data_vencimento: e.target.value})} />
                  </div>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Valor Mensal (R$)</label>
                    <input type="number" step="0.01" value={contratoFormData.valor_mensal} onChange={e => setContratoFormData({...contratoFormData, valor_mensal: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Valor Anual (R$)</label>
                    <input type="number" step="0.01" value={contratoFormData.valor_anual} onChange={e => setContratoFormData({...contratoFormData, valor_anual: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Valor Total (R$)</label>
                    <input type="number" step="0.01" value={contratoFormData.valor_total} onChange={e => setContratoFormData({...contratoFormData, valor_total: e.target.value})} />
                  </div>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={contratoFormData.status} onChange={e => setContratoFormData({...contratoFormData, status: e.target.value})}>
                      <option value="Ativo">Ativo</option>
                      <option value="Em Renovação">Em Renovação</option>
                      <option value="Cancelado">Cancelado</option>
                      <option value="Vencido">Vencido</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Responsável Interno</label>
                    <input value={contratoFormData.responsavel_interno} onChange={e => setContratoFormData({...contratoFormData, responsavel_interno: e.target.value})} />
                  </div>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Prazo de Aviso (dias antes do vencimento)</label>
                    <input type="number" min="0" max="365" value={contratoFormData.prazo_aviso_dias} onChange={e => setContratoFormData({...contratoFormData, prazo_aviso_dias: e.target.value})} />
                  </div>
                  <div className="form-group" style={{paddingTop: '0.5rem'}}>
                    <label style={{marginBottom: '0.5rem'}}>Renovação Automática</label>
                    <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '0.3rem'}}>
                      <input type="checkbox" id="renov_auto_edit" checked={contratoFormData.renovacao_automatica} onChange={e => setContratoFormData({...contratoFormData, renovacao_automatica: e.target.checked})} style={{width: '18px', height: '18px', cursor: 'pointer'}} />
                      <label htmlFor="renov_auto_edit" style={{cursor: 'pointer', fontWeight: '400', color: 'var(--text-muted)', margin: 0}}>Sim, renova automaticamente</label>
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label>Descrição / Objeto do Contrato</label>
                  <textarea rows="2" value={contratoFormData.descricao} onChange={e => setContratoFormData({...contratoFormData, descricao: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Observações</label>
                  <textarea rows="2" value={contratoFormData.observacoes} onChange={e => setContratoFormData({...contratoFormData, observacoes: e.target.value})} />
                </div>
                <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem'}}>
                  <button type="button" className="btn-secondary" onClick={() => setIsContratoEditModalOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary gradient-btn"><Edit2 size={16} /> Salvar Alterações</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- MODAL EDITAR ATIVO --- */}
        {isEditModalOpen && (
          <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem'}}>
                <h2>Editar Ativo ({editingAsset?.tag_patrimonio})</h2>
                <X size={24} style={{cursor: 'pointer'}} onClick={() => setIsEditModalOpen(false)} />
              </div>
              <form onSubmit={handleUpdateAtivo}>
                {formData.tipo !== 'TONER' ? (
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                    <div className="form-group">
                      <label>TAG Patrimônio *</label>
                      <input value={formData.tag_patrimonio} readOnly style={{cursor: 'not-allowed', opacity: 0.6}} />
                    </div>
                    <div className="form-group">
                      <label>Tipo de Equipamento</label>
                      <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})}>
                        <option value="NOTEBOOK">NOTEBOOK</option>
                        <option value="MONITOR">MONITOR</option>
                        <option value="DESKTOP">DESKTOP</option>
                        <option value="CELULAR">CELULAR</option>
                        <option value="IMPRESSORA">IMPRESSORA</option>
                        <option value="TONER">TONER DE IMPRESSORA</option>
                        <option value="LICENÇA">LICENÇA</option>
                        <option value="STARLINK">STARLINK</option>
                        <option value="OUTROS">OUTROS</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Tipo de Equipamento</label>
                    <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})}>
                      <option value="NOTEBOOK">NOTEBOOK</option>
                      <option value="MONITOR">MONITOR</option>
                      <option value="DESKTOP">DESKTOP</option>
                      <option value="CELULAR">CELULAR</option>
                      <option value="IMPRESSORA">IMPRESSORA</option>
                      <option value="TONER">TONER DE IMPRESSORA</option>
                      <option value="LICENÇA">LICENÇA</option>
                      <option value="STARLINK">STARLINK</option>
                      <option value="OUTROS">OUTROS</option>
                    </select>
                  </div>
                )}

                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Marca *</label>
                    <input required value={formData.marca} onChange={e => setFormData({...formData, marca: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Modelo *</label>
                    <input required value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Especificações</label>
                  <textarea rows="2" value={formData.especificacoes} onChange={e => setFormData({...formData, especificacoes: e.target.value})} />
                </div>

                {['NOTEBOOK', 'DESKTOP'].includes(formData.tipo) && (
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                    <div className="form-group">
                      <label>Licença Windows</label>
                      <input value={formData.licenca_windows} onChange={e => setFormData({...formData, licenca_windows: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Licença Office</label>
                      <input value={formData.licenca_office} onChange={e => setFormData({...formData, licenca_office: e.target.value})} />
                    </div>
                  </div>
                )}

                {formData.tipo === 'CELULAR' && (
                  <div className="form-group">
                    <label>Número do Chip (SIM)</label>
                    <input value={formData.numero_chip} onChange={e => setFormData({...formData, numero_chip: e.target.value})} placeholder="Ex: (11) 99999-0000" />
                  </div>
                )}

                {formData.tipo !== 'TONER' && (
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                    <div className="form-group">
                      <label>Número de Série</label>
                      <input value={formData.numero_serie} onChange={e => setFormData({...formData, numero_serie: e.target.value})} placeholder="Ex: SN-ABC123456" />
                    </div>
                    <div className="form-group">
                      <label>Fornecedor</label>
                      <input value={formData.fornecedor} onChange={e => setFormData({...formData, fornecedor: e.target.value})} placeholder="Ex: Dell Brasil Ltda" />
                    </div>
                  </div>
                )}

                {formData.tipo !== 'TONER' && (
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                    <div className="form-group">
                      <label>Data de Aquisição</label>
                      <input type="date" value={formData.data_aquisicao} onChange={e => setFormData({...formData, data_aquisicao: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label>Garantia Até</label>
                      <input type="date" value={formData.data_garantia} onChange={e => setFormData({...formData, data_garantia: e.target.value})} />
                    </div>
                  </div>
                )}

                {formData.tipo === 'TONER' && (
                  <div className="form-group">
                    <label>Quantidade *</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={formData.quantidade}
                      onChange={e => setFormData({...formData, quantidade: e.target.value})}
                      placeholder="Ex: 10"
                    />
                  </div>
                )}

                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Valor (R$)</label>
                    <input type="number" step="0.01" value={formData.valor} onChange={e => setFormData({...formData, valor: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                      <option value="Estoque">Estoque</option>
                      <option value="Em Uso">Em Uso</option>
                      <option value="Manutenção">Manutenção</option>
                      <option value="Descartado">Descartado</option>
                    </select>
                  </div>
                </div>

                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Localização</label>
                    <input value={formData.local_fisico} onChange={e => setFormData({...formData, local_fisico: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Atribuir Colaborador</label>
                    <select value={formData.colaborador_id} onChange={e => setFormData({...formData, colaborador_id: e.target.value})}>
                      <option value="">Nenhum (Disponível)</option>
                      {colaboradores.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Observação</label>
                  <textarea rows="2" value={formData.observacao} onChange={e => setFormData({...formData, observacao: e.target.value})} placeholder="Anotações adicionais sobre o equipamento..." />
                </div>

                <button type="submit" className="btn-primary gradient-btn" style={{width: '100%', justifyContent: 'center', marginTop: '1rem'}}>
                  Atualizar Equipamento
                </button>
              </form>
            </div>
          </div>
        )}

        {/* --- MODAL CADASTRAR COLABORADOR --- */}
        {isColabCreateModalOpen && (
          <div className="modal-overlay" onClick={() => setIsColabCreateModalOpen(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem'}}>
                <h2>Cadastrar Colaborador</h2>
                <X size={24} style={{cursor: 'pointer'}} onClick={() => setIsColabCreateModalOpen(false)} />
              </div>
              <form onSubmit={handleCreateColaborador}>
                <div className="form-group">
                  <label>Nome Completo *</label>
                  <input required value={colabFormData.nome} onChange={e => setColabFormData({...colabFormData, nome: e.target.value})} placeholder="Ex: Roberto Martins" />
                </div>
                <div className="form-group">
                  <label>E-mail Corporativo</label>
                  <input type="email" value={colabFormData.email_corporativo} onChange={e => setColabFormData({...colabFormData, email_corporativo: e.target.value})} placeholder="Ex: roberto.martins@avancoconstrucoes.com.br" />
                </div>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Setor *</label>
                    <select required value={colabFormData.setor_id} onChange={e => setColabFormData({...colabFormData, setor_id: e.target.value})}>
                      <option value="">Selecione um Setor</option>
                      {setores.map(s => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={colabFormData.status} onChange={e => setColabFormData({...colabFormData, status: e.target.value})}>
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                      <option value="Férias">Férias</option>
                      <option value="Desligado">Desligado</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn-primary gradient-btn" style={{width: '100%', justifyContent: 'center', marginTop: '1rem'}}>
                  Salvar Colaborador
                </button>
              </form>
            </div>
          </div>
        )}

        {/* --- MODAL EDITAR COLABORADOR --- */}
        {isColabModalOpen && (
          <div className="modal-overlay" onClick={() => setIsColabModalOpen(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem'}}>
                <h2>Editar Colaborador</h2>
                <X size={24} style={{cursor: 'pointer'}} onClick={() => setIsColabModalOpen(false)} />
              </div>
              <form onSubmit={handleUpdateColaborador}>
                <div className="form-group">
                  <label>Nome Completo *</label>
                  <input required value={colabFormData.nome} onChange={e => setColabFormData({...colabFormData, nome: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>E-mail Corporativo</label>
                  <input type="email" value={colabFormData.email_corporativo} onChange={e => setColabFormData({...colabFormData, email_corporativo: e.target.value})} />
                </div>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>Setor *</label>
                    <select value={colabFormData.setor_id} onChange={e => setColabFormData({...colabFormData, setor_id: e.target.value})}>
                      <option value="">Selecione um Setor</option>
                      {setores.map(s => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={colabFormData.status} onChange={e => setColabFormData({...colabFormData, status: e.target.value})}>
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                      <option value="Férias">Férias</option>
                      <option value="Desligado">Desligado</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn-primary gradient-btn" style={{width: '100%', justifyContent: 'center', marginTop: '1rem'}}>
                  Atualizar Colaborador
                </button>
              </form>
            </div>
          </div>
        )}

        {/* --- GAVETA DE DETALHES DO ATIVO (SLIDE DRAWER) --- */}
        {isDrawerOpen && selectedAsset && (
          <>
            <div className="drawer-overlay" onClick={() => setIsDrawerOpen(false)} />
            <div className="drawer">
              <div className="drawer-header">
                <div>
                  <span style={{fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: '0.05em'}}>{selectedAsset.tipo}</span>
                  <h2 style={{fontSize: '1.4rem', fontWeight: '700', marginTop: '0.25rem'}}>{selectedAsset.tag_patrimonio}</h2>
                </div>
                <X size={24} style={{cursor: 'pointer', color: 'var(--text-muted)'}} onClick={() => setIsDrawerOpen(false)} />
              </div>

              <div className="drawer-content">
                {/* Especificações Técnicas */}
                <div className="drawer-section">
                  <h4>Especificações Técnicas</h4>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="label">Equipamento</span>
                      <span className="value">{selectedAsset.marca} {selectedAsset.modelo}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Local Físico</span>
                      <span className="value"><MapPin size={12} style={{marginRight: '4px', verticalAlign: 'middle'}} />{selectedAsset.local_fisico || 'Sede Central'}</span>
                    </div>
                    <div className="info-item" style={{gridColumn: '1 / -1'}}>
                      <span className="label">Descrição Completa</span>
                      <span className="value" style={{fontWeight: '400', fontSize: '0.85rem', color: 'var(--text-muted)'}}>{selectedAsset.especificacoes || 'Sem descrição técnica registrada.'}</span>
                    </div>
                  </div>
                </div>

                {/* Status e Licenças */}
                <div className="drawer-section">
                  <h4>Status & Software</h4>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="label">Status Atual</span>
                      <div>
                        <span className={`status-badge status-${selectedAsset.status.toLowerCase().replace(' ', '-')}`}>
                          {selectedAsset.status}
                        </span>
                      </div>
                    </div>
                    <div className="info-item">
                      <span className="label">Valor de Compra</span>
                      <span className="value" style={{color: 'var(--success)'}}>{selectedAsset.valor ? `R$ ${selectedAsset.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não Informado'}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Licença Windows</span>
                      <span className="value" style={{fontSize: '0.85rem', fontWeight: '500'}}>{selectedAsset.licenca_windows || '-'}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Licença Office</span>
                      <span className="value" style={{fontSize: '0.85rem', fontWeight: '500'}}>{selectedAsset.licenca_office || '-'}</span>
                    </div>
                    {selectedAsset.numero_serie && (
                      <div className="info-item">
                        <span className="label">Número de Série</span>
                        <span className="value" style={{fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--accent)'}}>{selectedAsset.numero_serie}</span>
                      </div>
                    )}
                    {selectedAsset.fornecedor && (
                      <div className="info-item">
                        <span className="label">Fornecedor</span>
                        <span className="value" style={{fontSize: '0.85rem'}}>{selectedAsset.fornecedor}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ciclo de Vida */}
                {(selectedAsset.data_aquisicao || selectedAsset.data_garantia) && (
                  <div className="drawer-section">
                    <h4>Ciclo de Vida</h4>
                    <div className="info-grid">
                      {selectedAsset.data_aquisicao && (
                        <div className="info-item">
                          <span className="label">Data de Aquisição</span>
                          <span className="value" style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}>
                            <Calendar size={12} color="var(--accent)" />
                            {new Date(selectedAsset.data_aquisicao + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      )}
                      {selectedAsset.data_garantia && (() => {
                        const hoje = new Date(); hoje.setHours(0,0,0,0);
                        const gar = new Date(selectedAsset.data_garantia + 'T00:00:00');
                        const diff = Math.floor((gar - hoje) / 86400000);
                        const badge = diff < 0
                          ? { text: 'Vencida', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', icon: <ShieldOff size={12} /> }
                          : diff <= 30
                          ? { text: `Vencendo em ${diff}d`, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', icon: <Shield size={12} /> }
                          : { text: 'Ativa', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', icon: <ShieldCheck size={12} /> };
                        return (
                          <div className="info-item">
                            <span className="label">Garantia Até</span>
                            <div style={{display: 'flex', flexDirection: 'column', gap: '0.35rem'}}>
                              <span className="value" style={{display: 'flex', alignItems: 'center', gap: '0.4rem'}}>
                                <Calendar size={12} color="var(--accent)" />
                                {gar.toLocaleDateString('pt-BR')}
                              </span>
                              <span style={{display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', fontWeight: '700', padding: '2px 8px', borderRadius: '999px', backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, width: 'fit-content'}}>
                                {badge.icon}{badge.text}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Colaborador Atribuído */}
                <div className="drawer-section">
                  <h4>Responsável Atual</h4>
                  {selectedAsset.colaborador ? (
                    <div style={{display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)'}}>
                      <div style={{backgroundColor: 'var(--primary)', color: 'white', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '1.1rem'}}>
                        {selectedAsset.colaborador.nome[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{fontWeight: '600', fontSize: '0.95rem'}}>{selectedAsset.colaborador.nome}</div>
                        <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>{selectedAsset.colaborador.email}</div>
                        <div style={{fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.25rem', fontWeight: '500'}}><Layers size={10} style={{marginRight: '4px'}} />Setor: {selectedAsset.colaborador.setor || 'N/A'}</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{textAlign: 'center', padding: '1.5rem', border: '1px dashed var(--border)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.9rem'}}>
                      Equipamento disponível em Estoque.
                    </div>
                  )}
                </div>

                {/* Linha do Tempo de Movimentação */}
                <div className="drawer-section">
                  <h4>Linha do Tempo de Movimentações</h4>
                  {assetHistory.length > 0 ? (
                    <div className="timeline">
                      {assetHistory.map(hist => (
                        <div className="timeline-item" key={hist.id}>
                          <div className="timeline-marker" />
                          <div className="timeline-content">
                            <span className="timeline-date">
                              <Clock size={10} style={{marginRight: '4px', verticalAlign: 'middle'}} />
                              {new Date(hist.data_alteracao).toLocaleDateString('pt-BR')} às {new Date(hist.data_alteracao).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                            </span>
                            <span className="timeline-desc">{hist.descricao}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{color: 'var(--text-muted)', fontSize: '0.85rem', paddingLeft: '0.5rem'}}>
                      Sem movimentações anteriores registradas no sistema.
                    </div>
                  )}
                </div>
              </div>

              <div className="drawer-footer">
                <button className="btn-secondary" style={{flex: 1, justifyContent: 'center'}} onClick={() => openEditAsset(selectedAsset)}>
                  <Edit2 size={16} /> Editar
                </button>
                <button className="btn-secondary" style={{flex: 1, justifyContent: 'center', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)'}} onClick={() => handleDeleteAtivo(selectedAsset.id)}>
                  <Trash2 size={16} /> Excluir
                </button>
              </div>
            </div>
          </>
        )}

        {/* --- SISTEMA FLUTUANTE DE NOTIFICAÇÕES TOASTS --- */}
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              {t.type === 'success' && <CheckCircle2 size={18} color="var(--success)" />}
              {t.type === 'error' && <X size={18} color="#ef4444" />}
              {t.type === 'warning' && <AlertTriangle size={18} color="var(--warning)" />}
              {t.type === 'info' && <Info size={18} color="var(--accent)" />}
              <span>{t.message}</span>
            </div>
          ))}
        </div>

        {/* --- ASSISTENTE VIRTUAL DE IA (CHAT FLUTUANTE) --- */}
        <button 
          className="chat-btn"
          onClick={() => setIsChatOpen(!isChatOpen)}
          title="Falar com Assistente de IA"
        >
          {isChatOpen ? <X size={24} /> : <MessageSquare size={24} />}
        </button>

        {isChatOpen && (
          <div className="chat-window">
            <div className="chat-header">
              <div className="chat-header-title">
                <Sparkles size={18} color="var(--accent)" />
                <span>Assistente IA Avanço</span>
              </div>
              <button 
                className="btn-icon"
                onClick={() => setIsChatOpen(false)}
                style={{padding: '0.25rem', borderRadius: '50%'}}
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="chat-messages">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`chat-msg ${msg.sender}`}>
                  {msg.text}
                </div>
              ))}
              
              {chatLoading && (
                <div className="chat-typing">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-form" onSubmit={handleSendChatMessage}>
              <input 
                type="text" 
                placeholder="Pergunte-me qualquer dúvida..." 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                disabled={chatLoading}
              />
              <button type="submit" disabled={chatLoading || !chatInput.trim()}>
                <Send size={16} />
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
