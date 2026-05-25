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
        <div className="logo" onClick={() => setActiveTab('dashboard')}>
          <svg viewBox="30 28 232 54" width="180" height="42" style={{ display: 'block', flexShrink: 0 }}>
            <path d="M 41 39 L 57 39 L 58 40 L 57 41 L 51 41 L 50 42 L 47 42 L 46 43 L 45 43 L 41 47 L 41 50 L 42 51 L 42 52 L 48 58 L 49 58 L 52 61 L 53 61 L 55 63 L 54 64 L 53 64 L 52 63 L 51 63 L 50 62 L 49 62 L 48 61 L 47 61 L 46 60 L 45 60 L 43 58 L 42 58 L 41 57 L 40 57 L 35 52 L 35 51 L 34 50 L 34 49 L 33 48 L 33 45 L 34 44 L 34 43 L 36 41 L 37 41 L 38 40 L 40 40 Z M 59 40 L 61 40 Z M 250 56 L 250 58 L 249 59 L 249 60 L 248 61 L 248 63 L 247 64 L 247 65 L 246 66 L 247 66 L 249 64 L 253 64 L 254 65 L 254 66 L 255 66 L 255 64 L 254 63 L 254 61 L 253 60 L 253 59 L 252 58 L 252 57 L 251 56 Z M 231 57 L 231 61 L 234 61 L 235 62 L 236 62 L 237 63 L 237 64 L 236 65 L 230 65 L 231 66 L 237 66 L 238 65 L 238 62 L 237 61 L 234 61 L 232 59 L 232 58 L 233 57 L 236 57 L 237 58 L 238 57 L 237 57 L 236 56 L 233 56 L 232 57 Z M 251 58 L 252 59 L 252 61 L 253 62 L 253 63 L 252 64 L 250 64 L 249 63 L 249 61 L 250 60 L 250 59 Z M 56 63 L 57 63 L 59 65 L 58 66 L 57 66 L 56 65 L 55 65 L 54 64 L 55 63 Z M 60 65 L 61 66 L 60 67 L 59 67 L 58 66 L 59 65 Z M 62 66 L 63 67 L 62 68 L 61 68 L 60 67 L 61 66 Z M 67 70 L 68 70 L 69 71 L 71 71 L 72 72 L 74 72 L 75 73 L 75 73 L 74 72 L 73 72 L 72 71 L 71 71 L 70 70 L 69 70 L 68 69 L 67 69 L 66 68 L 65 68 L 64 67 L 63 67 L 62 66 L 61 66 L 60 65 L 59 65 L 57 63 L 55 63 L 53 61 L 52 61 L 49 58 L 48 58 L 42 52 L 42 51 L 41 50 L 41 47 L 45 43 L 46 43 L 47 42 L 50 42 L 51 41 L 57 41 L 58 40 L 58 40 L 57 39 L 41 39 L 40 40 L 38 40 L 37 41 L 36 41 L 34 43 L 34 44 L 33 45 L 33 48 L 34 49 L 34 50 L 35 51 L 35 52 L 40 57 L 41 57 L 42 58 L 43 58 L 45 60 L 46 60 L 47 61 L 48 61 L 49 62 L 50 62 L 51 63 L 52 63 L 53 64 L 54 64 L 55 65 L 56 65 L 57 66 L 58 66 L 59 67 L 60 67 L 61 68 L 63 68 L 64 69 L 65 69 L 66 70 Z" fill="#fcae17" />
            <path d="M 92 30 L 93 30 L 94 31 L 94 65 L 93 66 L 88 66 L 87 65 L 87 48 L 86 47 L 83 47 L 82 48 L 81 48 L 79 50 L 78 50 L 77 51 L 76 51 L 75 52 L 74 52 L 73 53 L 72 53 L 71 54 L 70 54 L 69 55 L 68 55 L 67 56 L 66 56 L 65 57 L 64 57 L 63 58 L 62 58 L 61 59 L 60 59 L 59 60 L 58 60 L 57 61 L 55 61 L 53 59 L 55 57 L 56 57 L 59 54 L 60 54 L 62 52 L 63 52 L 66 49 L 67 49 L 70 46 L 71 46 L 74 43 L 75 43 L 78 40 L 79 40 L 82 37 L 83 37 L 86 34 L 87 34 L 90 31 L 91 31 Z M 100 43 L 103 43 L 104 44 L 104 45 L 105 46 L 105 47 L 106 48 L 106 50 L 107 51 L 107 52 L 108 53 L 108 55 L 109 56 L 109 57 L 110 58 L 111 58 L 112 57 L 112 55 L 113 54 L 113 53 L 114 52 L 114 50 L 115 49 L 115 47 L 116 46 L 116 45 L 117 44 L 120 44 L 121 45 L 121 47 L 120 48 L 120 49 L 119 50 L 119 52 L 118 53 L 118 55 L 117 56 L 117 57 L 116 58 L 116 60 L 115 61 L 115 62 L 114 63 L 114 65 L 113 66 L 108 66 L 106 64 L 106 62 L 105 61 L 105 60 L 104 59 L 104 57 L 103 56 L 103 55 L 102 54 L 102 52 L 101 51 L 101 50 L 100 49 L 100 47 L 99 46 L 99 44 Z M 131 43 L 140 43 L 141 44 L 142 44 L 144 46 L 144 48 L 145 49 L 145 61 L 147 63 L 147 65 L 146 66 L 142 66 L 140 64 L 139 65 L 138 65 L 137 66 L 127 66 L 124 63 L 124 61 L 123 60 L 123 59 L 124 58 L 124 56 L 127 53 L 129 53 L 130 52 L 139 52 L 140 51 L 140 50 L 138 48 L 137 48 L 136 47 L 133 47 L 132 48 L 129 48 L 128 49 L 126 47 L 126 45 L 127 44 L 130 44 Z M 161 43 L 168 43 L 169 44 L 170 44 L 172 46 L 172 49 L 173 50 L 173 65 L 172 66 L 168 66 L 167 65 L 167 50 L 165 48 L 160 48 L 159 49 L 158 49 L 157 50 L 157 52 L 156 53 L 156 65 L 155 66 L 152 66 L 151 65 L 151 45 L 152 44 L 155 44 L 156 45 L 157 45 L 158 44 L 160 44 Z M 184 43 L 193 43 L 194 44 L 195 44 L 197 46 L 197 47 L 194 50 L 192 48 L 186 48 L 183 51 L 183 59 L 186 62 L 191 62 L 192 61 L 193 61 L 194 60 L 195 61 L 196 61 L 197 62 L 197 63 L 195 65 L 194 65 L 193 66 L 184 66 L 183 65 L 181 65 L 179 63 L 179 62 L 178 61 L 178 59 L 177 58 L 177 51 L 178 50 L 178 48 L 179 47 L 179 46 L 180 45 L 181 45 L 182 44 L 183 44 Z M 207 43 L 216 43 L 217 44 L 219 44 L 222 47 L 222 48 L 223 49 L 223 52 L 224 53 L 224 57 L 223 58 L 223 61 L 219 65 L 218 65 L 217 66 L 207 66 L 206 65 L 204 65 L 202 63 L 202 62 L 201 61 L 201 59 L 200 58 L 200 51 L 201 50 L 201 48 L 202 47 L 202 46 L 203 45 L 204 45 L 205 44 L 206 44 Z M 98 44 L 99 45 L 99 46 L 100 47 L 100 49 L 101 50 L 101 51 L 102 52 L 102 54 L 103 55 L 103 56 L 104 57 L 104 59 L 105 60 L 105 61 L 106 62 L 106 64 L 107 65 L 107 66 L 113 66 L 114 65 L 114 63 L 115 62 L 115 61 L 116 60 L 116 58 L 117 57 L 117 56 L 118 55 L 118 53 L 119 52 L 119 50 L 120 49 L 120 48 L 121 47 L 121 45 L 122 44 L 117 44 L 116 45 L 116 46 L 115 47 L 115 49 L 114 50 L 114 52 L 113 53 L 113 54 L 112 55 L 112 57 L 111 58 L 110 58 L 109 57 L 109 56 L 108 55 L 108 53 L 107 52 L 107 51 L 106 50 L 106 48 L 105 47 L 105 46 L 104 45 L 104 44 L 103 43 L 100 43 L 99 44 Z M 151 44 L 151 66 L 156 66 L 156 53 L 157 52 L 157 50 L 158 49 L 159 49 L 160 48 L 165 48 L 167 50 L 167 65 L 168 66 L 173 66 L 173 50 L 172 49 L 172 46 L 170 44 L 169 44 L 168 43 L 161 43 L 160 44 L 158 44 L 157 45 L 156 45 L 155 44 L 152 44 Z M 212 47 L 213 48 L 215 48 L 218 51 L 218 59 L 216 61 L 215 61 L 214 62 L 209 62 L 206 59 L 206 58 L 205 57 L 205 53 L 206 52 L 206 51 L 209 48 L 211 48 Z M 132 55 L 139 55 L 140 56 L 140 58 L 139 59 L 139 60 L 137 62 L 130 62 L 129 61 L 129 60 L 128 59 L 128 58 L 130 56 L 131 56 Z M 53 60 L 54 60 L 55 61 L 57 61 L 58 60 L 59 60 L 60 59 L 61 59 L 62 58 L 63 58 L 64 57 L 65 57 L 66 56 L 67 56 L 68 55 L 69 55 L 70 54 L 71 54 L 72 53 L 73 53 L 74 52 L 75 52 L 76 51 L 77 51 L 78 50 L 79 50 L 81 48 L 82 48 L 83 47 L 86 47 L 87 48 L 87 66 L 94 66 L 94 31 L 93 30 L 92 30 L 91 31 L 90 31 L 87 34 L 86 34 L 83 37 L 82 37 L 79 40 L 78 40 L 75 43 L 74 43 L 71 46 L 70 46 L 67 49 L 66 49 L 63 52 L 62 52 L 60 54 L 59 54 L 56 57 L 55 57 L 53 59 Z M 47 63 L 49 63 L 50 64 L 48 66 L 47 66 L 46 67 L 45 67 L 44 66 L 46 64 Z M 51 64 L 50 64 L 49 63 L 47 63 L 44 66 L 43 66 L 40 69 L 39 69 L 37 71 L 38 71 L 39 70 L 40 70 L 41 69 L 42 69 L 43 68 L 44 68 L 45 67 L 46 67 L 47 66 L 48 66 L 49 65 L 50 65 Z M 197 64 L 197 62 L 196 61 L 195 61 L 194 60 L 193 61 L 192 61 L 191 62 L 186 62 L 183 59 L 183 51 L 186 48 L 192 48 L 194 50 L 197 47 L 197 45 L 196 45 L 195 44 L 194 44 L 193 43 L 184 43 L 183 44 L 182 44 L 181 45 L 180 45 L 179 46 L 179 47 L 178 48 L 178 50 L 177 51 L 177 58 L 178 59 L 178 61 L 179 62 L 179 63 L 181 65 L 183 65 L 184 66 L 193 66 L 194 65 L 195 65 L 196 64 Z M 186 70 L 186 79 L 187 79 L 188 78 L 189 78 L 190 77 L 191 77 L 193 75 L 194 75 L 194 74 L 192 72 L 191 72 L 190 71 L 189 71 L 188 70 L 187 70 Z" fill="#ffffff" />
          </svg>
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
