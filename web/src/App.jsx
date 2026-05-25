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
  Send
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_BASE_URL = 'http://127.0.0.1:8000';

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
  const [stats, setStats] = useState({ total_ativos: 0, ativos_em_uso: 0, ativos_estoque: 0, valor_total: 0 });
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
    setor_nome: ''
  });

  // Reports State
  const [reportValueBySector, setReportValueBySector] = useState([]);
  const [reportAssetsByType, setReportAssetsByType] = useState([]);

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
    valor: '',
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
      setChatMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'system-error',
        text: 'Desculpe, ocorreu um erro de conexão com o Assistente de IA. Verifique se o servidor FastAPI está ativo.'
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
        const [resValSector, resAssetsType] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/reports/valor-por-setor`),
          axios.get(`${API_BASE_URL}/api/reports/ativos-por-tipo`)
        ]);
        setReportValueBySector(resValSector.data);
        setReportAssetsByType(resAssetsType.data);
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
      valor: ativo.valor || '',
      colaborador_id: ativo.colaborador_id || ''
    });
    setIsEditModalOpen(true);
  };

  const handleCreateAtivo = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };
      if (!payload.colaborador_id) delete payload.colaborador_id;
      else payload.colaborador_id = parseInt(payload.colaborador_id);
      if (payload.valor) payload.valor = parseFloat(payload.valor);
      else payload.valor = null;
      
      await axios.post(`${API_BASE_URL}/api/ativos`, payload);
      showToast("Equipamento cadastrado com sucesso!", "success");
      setIsModalOpen(false);
      setFormData({
        tag_patrimonio: '', tipo: 'NOTEBOOK', marca: '', modelo: '', 
        especificacoes: '', local_fisico: 'Sede Central', status: 'Estoque',
        licenca_windows: '', licenca_office: '', valor: '', colaborador_id: ''
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

        // Limpeza e Parse de Valores Monetários do BRL
        let valor = null;
        if (valorRaw) {
          const cleanVal = String(valorRaw).replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
          valor = parseFloat(cleanVal);
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
          setor_nome: String(setor || '').trim()
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
    const ws = XLSX.utils.json_to_sheet(ativos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ativos");
    XLSX.writeFile(wb, "Inventario_TI_Avanco.xlsx");
    showToast("Exportação Excel efetuada com sucesso!", "success");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Inventário de T.I - Avanço Construções", 14, 15);
    const tableColumn = ["TAG", "Tipo", "Equipamento", "Local", "Status", "Valor"];
    const tableRows = ativos.map(a => [
      a.tag_patrimonio, 
      a.tipo, 
      `${a.marca} ${a.modelo}`, 
      a.local_fisico, 
      a.status,
      a.valor ? `R$ ${a.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'
    ]);
    
    autoTable(doc, { 
      head: [tableColumn], 
      body: tableRows, 
      startY: 20,
      theme: 'grid',
      headStyles: { fillColor: '#2563eb' },
      styles: { fontSize: 9 }
    });
    doc.save("Inventario_TI_Avanco.pdf");
    showToast("Exportação PDF efetuada com sucesso!", "success");
  };

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

  return (
    <div className="app-container">
      {/* Sidebar de Navegação Lateral */}
      <aside className="sidebar">
        <div className="logo">
          <Box size={28} />
          <span>ITAM Avanço</span>
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
            className={`nav-item ${activeTab === 'relatorios' ? 'active' : ''}`}
            onClick={() => setActiveTab('relatorios')}
          >
            <BarChart3 size={20} />
            Relatórios
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header>
          <h1>
            {activeTab === 'dashboard' ? 'Dashboard de Inventário' : 
             activeTab === 'ativos' ? 'Gestão de Equipamentos' :
             activeTab === 'colaboradores' ? 'Gestão de Colaboradores' : 
             activeTab === 'importar' ? 'Importação Inteligente Excel' : 'Relatórios Estratégicos'}
          </h1>
          <p className="subtitle">Bem-vindo ao sistema de controle de ativos de T.I. Avanço Construções.</p>
        </header>

        {loading && activeTab !== 'importar' ? (
          <div style={{display: 'flex', justifyContent: 'center', padding: '5rem', color: 'var(--text-muted)'}}>
             Carregando informações do servidor...
          </div>
        ) : activeTab === 'dashboard' ? (
          <>
            {/* KPI Cards Grid */}
            <div className="stats-grid">
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
                <div className="stat-label">Valor Total do Ativo</div>
                <div className="stat-value">R$ {stats.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <FileText size={24} color="#8b5cf6" style={{marginTop: 'auto'}} />
              </div>
            </div>

            <div className="dashboard-row">
              <div className="chart-container">
                <h3>Distribuição por Marca</h3>
                <div style={{ height: '300px' }}>
                  {getBrandData().length > 0 ? (
                    <SafeChart>
                      <PieChart>
                        <Pie
                          data={getBrandData()}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {getBrandData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid var(--border)', borderRadius: '8px' }} 
                          itemStyle={{ color: 'white' }}
                        />
                        <Legend />
                      </PieChart>
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
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ativos.slice(0, 5).map(ativo => (
                        <tr key={ativo.id} className="table-row-hover" onClick={() => handleOpenDrawer(ativo)}>
                          <td><strong style={{color: 'var(--accent)'}}>{ativo.tag_patrimonio}</strong></td>
                          <td>{ativo.marca} {ativo.modelo}</td>
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

              <button className="btn-primary gradient-btn" onClick={() => {
                setFormData({
                  tag_patrimonio: '', tipo: 'NOTEBOOK', marca: '', modelo: '', 
                  especificacoes: '', local_fisico: 'Sede Central', status: 'Estoque',
                  licenca_windows: '', licenca_office: '', valor: '', colaborador_id: ''
                });
                setIsModalOpen(true);
              }}>
                <Plus size={20} /> Novo Ativo
              </button>
            </div>

            <div style={{display: 'flex', gap: '1rem', marginBottom: '1.5rem'}}>
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
            </div>

            {/* Tabela de Equipamentos Geral */}
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th onClick={() => requestSort('tag_patrimonio')}>TAG {sortConfig.key === 'tag_patrimonio' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('tipo')}>Tipo {sortConfig.key === 'tipo' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('marca')}>Equipamento {sortConfig.key === 'marca' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('colaborador')}>Colaborador {sortConfig.key === 'colaborador' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th>Setor</th>
                    <th onClick={() => requestSort('local_fisico')}>Local {sortConfig.key === 'local_fisico' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('status')}>Status {sortConfig.key === 'status' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th onClick={() => requestSort('valor')}>Valor {sortConfig.key === 'valor' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                    <th style={{textAlign: 'center'}}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAtivos.map(ativo => (
                    <tr key={ativo.id} className="table-row-hover" onClick={() => handleOpenDrawer(ativo)}>
                      <td style={{color: 'var(--accent)', fontWeight: '600'}}>{ativo.tag_patrimonio}</td>
                      <td>
                        <span className="type-badge">{ativo.tipo || 'N/A'}</span>
                      </td>
                      <td>
                        <div style={{fontWeight: '500'}}>{ativo.marca} {ativo.modelo}</div>
                        <div style={{color: 'var(--text-muted)', fontSize: '0.75rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{ativo.especificacoes}</div>
                      </td>
                      <td>
                        <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                          <Users size={14} color={ativo.colaborador ? 'var(--accent)' : 'var(--text-muted)'} />
                          {ativo.colaborador?.nome || <span style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>Disponível</span>}
                        </div>
                      </td>
                      <td>{ativo.colaborador?.setor || '-'}</td>
                      <td>{ativo.local_fisico}</td>
                      <td>
                        <span className={`status-badge status-${ativo.status.toLowerCase().replace(' ', '-')}`}>
                          {ativo.status}
                        </span>
                      </td>
                      <td style={{fontWeight: '600', color: 'var(--text-main)'}}>
                        {ativo.valor ? `R$ ${ativo.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td style={{textAlign: 'center'}} onClick={(e) => e.stopPropagation()}>
                        <div style={{display: 'flex', justifyContent: 'center', gap: '0.5rem'}}>
                          <button className="btn-icon" onClick={() => openEditAsset(ativo)} title="Editar Ativo">
                            <Edit2 size={16} />
                          </button>
                          <button className="btn-icon" style={{color: '#ef4444'}} onClick={() => handleDeleteAtivo(ativo.id)} title="Excluir Ativo">
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
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>TAG Patrimônio *</label>
                    <input required value={formData.tag_patrimonio} onChange={e => setFormData({...formData, tag_patrimonio: e.target.value})} placeholder="Ex: AVN-123" />
                  </div>
                  <div className="form-group">
                    <label>Tipo de Equipamento</label>
                    <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})}>
                      <option value="NOTEBOOK">NOTEBOOK</option>
                      <option value="MONITOR">MONITOR</option>
                      <option value="DESKTOP">DESKTOP</option>
                      <option value="CELULAR">CELULAR</option>
                      <option value="IMPRESSORA">IMPRESSORA</option>
                      <option value="OUTROS">OUTROS</option>
                    </select>
                  </div>
                </div>

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

                <button type="submit" className="btn-primary gradient-btn" style={{width: '100%', justifyContent: 'center', marginTop: '1rem'}}>
                  Salvar Equipamento
                </button>
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
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                  <div className="form-group">
                    <label>TAG Patrimônio *</label>
                    <input required value={formData.tag_patrimonio} onChange={e => setFormData({...formData, tag_patrimonio: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Tipo de Equipamento</label>
                    <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})}>
                      <option value="NOTEBOOK">NOTEBOOK</option>
                      <option value="MONITOR">MONITOR</option>
                      <option value="DESKTOP">DESKTOP</option>
                      <option value="CELULAR">CELULAR</option>
                      <option value="IMPRESSORA">IMPRESSORA</option>
                      <option value="OUTROS">OUTROS</option>
                    </select>
                  </div>
                </div>

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
                  </div>
                </div>

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
