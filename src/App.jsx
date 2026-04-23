import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, FolderKanban, PlusCircle, PieChart, 
  Search, Edit, Trash2, Eye, 
  Copy, Check, Clock, User, Tag, X, FileJson, ChevronRight, 
  History, Briefcase, Paperclip, LogOut, ShieldCheck, Users, Lock, Mail, Globe,
  MessageSquare, AlertCircle, Send, Bell, MessageCircle
} from 'lucide-react';
import { supabase } from './lib/supabase';

// --- CONFIGURAÇÕES ---
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "bruno123";

const STATUS_CONFIG = {
  planning: { label: 'Planejamento', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
  awaiting_info: { label: 'Aguardando Info', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: AlertCircle },
  development: { label: 'Desenvolvimento', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: LayoutDashboard },
  testing: { label: 'Testes', color: 'bg-rose-100 text-rose-800 border-rose-200', icon: Search },
  completed: { label: 'Concluído', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: Check }
};

const DEPARTMENTS = [
  'Logística',
  'Comercial',
  'Diretoria',
  'Financeiro/Faturamento',
  'RH/DP',
  'Projetos',
  'Serviços Gerais'
];

// Função para converter snake_case para camelCase
const toCamelCase = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  
  return Object.keys(obj).reduce((acc, key) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    acc[camelKey] = toCamelCase(obj[key]);
    return acc;
  }, {});
};

// Função para converter camelCase para snake_case
const toSnakeCase = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  
  return Object.keys(obj).reduce((acc, key) => {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    acc[snakeKey] = toSnakeCase(obj[key]);
    return acc;
  }, {});
};

export default function App() {
  // Estados de Autenticação e Perfil
  const [userRole, setUserRole] = useState(localStorage.getItem('ai_manager_role') || null);
  const [userEmail, setUserEmail] = useState(localStorage.getItem('ai_manager_email') || '');
  
  // Estados de Dados e UI
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('projects');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Modals e Forms
  const [editingProject, setEditingProject] = useState(null);
  const [viewingProject, setViewingProject] = useState(null);
  const [viewingHistory, setViewingHistory] = useState(null);
  const [viewingComments, setViewingComments] = useState(null);
  const [toast, setToast] = useState(null);

  // Contador de projetos que precisam de atenção
  const pendingAttentionCount = projects.filter(p => {
    if (userRole === 'admin') {
      return p.attentionFor === 'admin';
    } else {
      return p.requesterEmail?.toLowerCase() === userEmail.toLowerCase() && p.attentionFor === 'requester';
    }
  }).length;

  // --- EFEITOS (SUPABASE REALTIME) ---
  useEffect(() => {
    fetchProjects();

    const channel = supabase
      .channel('projects-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects'
        },
        (payload) => {
          console.log('Realtime update:', payload);
          
          if (payload.eventType === 'INSERT') {
            setProjects(prev => [toCamelCase(payload.new), ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setProjects(prev => 
              prev.map(p => p.id === payload.new.id ? toCamelCase(payload.new) : p)
            );
            // Atualiza o projeto sendo visualizado se for o mesmo
            if (viewingProject && viewingProject.id === payload.new.id) {
              setViewingProject(toCamelCase(payload.new));
            }
            if (viewingComments && viewingComments.id === payload.new.id) {
              setViewingComments(toCamelCase(payload.new));
            }
          } else if (payload.eventType === 'DELETE') {
            setProjects(prev => prev.filter(p => p.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      setProjects(data.map(toCamelCase));
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      showToast('Erro ao conectar com o banco de dados.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === 'admin') setActiveTab('dashboard');
    else if (userRole === 'requester') setActiveTab('projects');
  }, [userRole]);

  // --- FUNÇÕES UTILITÁRIAS ---
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const copyToClipboard = (text, customMessage = 'Copiado para a área de transferência!') => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) showToast(customMessage);
      else showToast('Falha ao copiar', 'error');
    } catch (err) {
      console.error('Erro no fallback de cópia', err);
      showToast('Erro ao copiar', 'error');
    }
    document.body.removeChild(textArea);
  };

  // --- LOGIN / LOGOUT ---
  const handleLoginAdmin = (e) => {
    e.preventDefault();
    const password = e.currentTarget.elements.password.value;
    
    if (password === ADMIN_PASSWORD) {
      const role = 'admin';
      const email = 'admin@sistema.com';
      
      localStorage.setItem('ai_manager_role', role);
      localStorage.setItem('ai_manager_email', email);
      
      setUserRole(role);
      setUserEmail(email);
    } else {
      showToast('Senha incorreta! Tente novamente.', 'error');
    }
  };

  const handleLoginRequester = (e) => {
    e.preventDefault();
    const email = (e.currentTarget.elements.email.value || '').trim().toLowerCase();
    
    if (!email) {
      showToast('Preencha seu e-mail corporativo.', 'error');
      return;
    }

    const role = 'requester';
    localStorage.setItem('ai_manager_role', role);
    localStorage.setItem('ai_manager_email', email);
    
    setUserRole(role);
    setUserEmail(email);
  };

  const handleLogout = () => {
    localStorage.removeItem('ai_manager_role');
    localStorage.removeItem('ai_manager_email');
    setUserRole(null);
    setUserEmail('');
    setActiveTab('projects');
  };

  // --- OPERAÇÕES DE DADOS (SUPABASE) ---
  const handleSaveProject = async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const formObj = Object.fromEntries(formData.entries());
    
    if (userRole === 'requester') {
      formObj.requesterEmail = userEmail;
      formObj.status = editingProject ? editingProject.status : 'planning';
    }

    const projectData = { 
      ...formObj, 
      owner: 'Bruno Andrade',
      status: formObj.status || (editingProject ? editingProject.status : 'planning')
    };

    try {
      if (editingProject) {
        const newVersion = {
          version: (editingProject.versions || []).length + 1,
          date: new Date().toISOString(),
          changes: userRole === 'admin' ? 'Atualização técnica do projeto' : 'Atualização da solicitação',
          prompt: editingProject.prompt || '',
          code: editingProject.code || ''
        };
        
        const updatedProject = {
          ...projectData,
          versions: [...(editingProject.versions || []), newVersion]
        };

        const { error } = await supabase
          .from('projects')
          .update(toSnakeCase(updatedProject))
          .eq('id', editingProject.id);

        if (error) throw error;
        showToast('Projeto atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('projects')
          .insert([toSnakeCase(projectData)]);

        if (error) throw error;
        showToast('Solicitação criada com sucesso!');
      }

      setEditingProject(null);
      setActiveTab('projects');

    } catch (error) {
      console.error("Erro ao salvar:", error);
      showToast('Erro ao salvar os dados na nuvem', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este projeto?')) {
      try {
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', id);

        if (error) throw error;
        showToast('Projeto excluído');
      } catch (error) {
        console.error("Erro ao excluir:", error);
        showToast('Erro ao excluir projeto', 'error');
      }
    }
  };

  // --- SISTEMA DE COMENTÁRIOS ---
  const handleSendComment = async (projectId, message, requestInfo = false) => {
    if (!message.trim()) return;

    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newComment = {
      id: crypto.randomUUID(),
      author: userRole === 'admin' ? 'Bruno Andrade (Admin)' : userEmail,
      role: userRole,
      message: message.trim(),
      date: new Date().toISOString(),
      isInfoRequest: requestInfo
    };

    const updatedComments = [...(project.comments || []), newComment];
    
    // Define quem precisa prestar atenção
    const attentionFor = userRole === 'admin' ? 'requester' : 'admin';
    
    // Se admin está solicitando info, muda o status
    const newStatus = requestInfo ? 'awaiting_info' : project.status;

    try {
      const { error } = await supabase
        .from('projects')
        .update({
          comments: updatedComments,
          attention_for: attentionFor,
          needs_attention: true,
          status: newStatus
        })
        .eq('id', projectId);

      if (error) throw error;
      
      showToast(requestInfo ? 'Solicitação de informações enviada!' : 'Comentário enviado!');
    } catch (error) {
      console.error("Erro ao enviar comentário:", error);
      showToast('Erro ao enviar comentário', 'error');
    }
  };

  const handleMarkAsRead = async (projectId) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          needs_attention: false,
          attention_for: null
        })
        .eq('id', projectId);

      if (error) throw error;
    } catch (error) {
      console.error("Erro ao marcar como lido:", error);
    }
  };

  // --- COMPONENTES DA INTERFACE ---
  const CodeBlock = ({ label, content }) => (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-semibold text-slate-700">{label}</h4>
        {content && (
          <button 
            onClick={() => copyToClipboard(content)}
            className="text-xs flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors"
          >
            <Copy size={14} /> Copiar
          </button>
        )}
      </div>
      <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto border border-slate-700">
        <pre className="text-slate-300 font-mono text-sm whitespace-pre-wrap">{content || <span className="text-slate-600 italic">Vazio</span>}</pre>
      </div>
    </div>
  );

  // Badge de atenção
  const AttentionBadge = ({ project, small = false }) => {
    const needsMyAttention = (userRole === 'admin' && project.attentionFor === 'admin') ||
                             (userRole === 'requester' && project.attentionFor === 'requester');
    
    if (!needsMyAttention) return null;
    
    return (
      <span className={`inline-flex items-center gap-1 bg-red-500 text-white rounded-full animate-pulse ${small ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs'}`}>
        <Bell size={small ? 10 : 12} />
        {!small && (userRole === 'admin' ? 'Resposta recebida' : 'Ação necessária')}
      </span>
    );
  };

  // Loading state
  if (loading && !userRole) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // TELA DE LOGIN
  if (!userRole) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 selection:bg-blue-200">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-4xl w-full animate-in zoom-in-95 flex flex-col md:flex-row gap-8">
          
          <div className="md:w-1/3 flex flex-col justify-center items-center text-center md:border-r border-slate-100 md:pr-8">
            <div className="bg-blue-600 w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-lg text-white">
              <FolderKanban size={40} />
            </div>
            <h1 className="text-3xl font-bold text-slate-800 leading-tight mb-3">IA Project<br/>Manager</h1>
            <p className="text-slate-500 text-sm">Gestão centralizada de demandas, prompts e soluções baseadas em Inteligência Artificial.</p>
          </div>

          <div className="md:w-2/3 flex flex-col gap-6 justify-center">
            
            <div className="p-6 border border-slate-200 rounded-xl bg-slate-50 hover:border-emerald-300 transition-colors shadow-sm">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4 text-lg">
                <Users className="text-emerald-600"/> Acesso do Solicitante
              </h3>
              <form onSubmit={handleLoginRequester} className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="email" name="email" placeholder="seu.email@empresa.com" required
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm"
                  />
                </div>
                <button type="submit" className="py-2.5 px-6 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm flex justify-center items-center gap-2 shadow-sm whitespace-nowrap">
                  Acessar Projetos <ChevronRight size={16} />
                </button>
              </form>
            </div>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-medium uppercase tracking-wider">Acesso Restrito</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <div className="p-6 border border-slate-200 rounded-xl bg-white hover:border-blue-300 transition-colors">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
                <ShieldCheck className="text-blue-600"/> Gestor do Sistema (Bruno)
              </h3>
              <form onSubmit={handleLoginAdmin} className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="password" name="password" placeholder="Senha de Acesso" required
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                  />
                </div>
                <button type="submit" className="py-2.5 px-6 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium text-sm whitespace-nowrap shadow-sm">
                  Entrar
                </button>
              </form>
            </div>

          </div>
        </div>
      </div>
    );
  }

  const renderDashboard = () => {
    const stats = {
      total: projects.length,
      awaitingInfo: projects.filter(p => p.status === 'awaiting_info').length,
      dev: projects.filter(p => p.status === 'development').length,
      done: projects.filter(p => p.status === 'completed').length,
      needsAttention: projects.filter(p => p.attentionFor === 'admin').length
    };

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</h3>
            </div>
            <div className="bg-blue-100 p-2.5 rounded-lg text-blue-600"><FolderKanban size={20} /></div>
          </div>
          
          {stats.needsAttention > 0 && (
            <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-5 flex items-center justify-between animate-pulse">
              <div>
                <p className="text-xs font-medium text-red-600 uppercase tracking-wider">Aguardando Você</p>
                <h3 className="text-2xl font-bold text-red-700 mt-1">{stats.needsAttention}</h3>
              </div>
              <div className="bg-red-100 p-2.5 rounded-lg text-red-600"><Bell size={20} /></div>
            </div>
          )}
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Aguard. Info</p>
              <h3 className="text-2xl font-bold text-purple-600 mt-1">{stats.awaitingInfo}</h3>
            </div>
            <div className="bg-purple-100 p-2.5 rounded-lg text-purple-600"><AlertCircle size={20} /></div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Em Dev</p>
              <h3 className="text-2xl font-bold text-amber-600 mt-1">{stats.dev}</h3>
            </div>
            <div className="bg-amber-100 p-2.5 rounded-lg text-amber-600"><Clock size={20} /></div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Concluídos</p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">{stats.done}</h3>
            </div>
            <div className="bg-emerald-100 p-2.5 rounded-lg text-emerald-600"><Check size={20} /></div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <h2 className="text-lg font-semibold text-slate-800">Atividade Recente</h2>
            <button onClick={() => setActiveTab('projects')} className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center">
              Ver todos <ChevronRight size={16} />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {projects.slice(0, 5).map(project => (
              <div key={project.id} className="p-5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold text-slate-800 truncate">{project.name}</h3>
                    <AttentionBadge project={project} small />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    {project.requesterEmail && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail size={14} /> {project.requesterEmail}
                      </span>
                    )}
                    <span className="flex items-center gap-1 whitespace-nowrap"><Clock size={14} /> {formatDate(project.updatedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${STATUS_CONFIG[project.status]?.color || ''}`}>
                    {STATUS_CONFIG[project.status]?.label || project.status}
                  </span>
                  <button 
                    onClick={() => setViewingComments(project)}
                    className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="Comentários"
                  >
                    <MessageCircle size={18} />
                  </button>
                </div>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="p-8 text-center text-slate-500">Nenhum projeto encontrado.</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderProjectForm = () => {
    const isEdit = !!editingProject;
    const p = editingProject || {};

    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-4xl mx-auto animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">
            {isEdit 
              ? (userRole === 'admin' ? 'Atualizar Execução do Projeto' : 'Editar Solicitação') 
              : 'Nova Solicitação de Projeto'}
          </h2>
          {isEdit && (
            <button type="button" onClick={() => { setEditingProject(null); setActiveTab('projects'); }} className="text-slate-400 hover:text-slate-600">
              <X size={24} />
            </button>
          )}
        </div>

        <form onSubmit={handleSaveProject} className="space-y-6">
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Dados da Solicitação</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-mail do Solicitante</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input type="email" name="requesterEmail" defaultValue={p.requesterEmail || (userRole === 'requester' ? userEmail : '')} 
                    required placeholder="email@empresa.com"
                    readOnly={userRole === 'requester'}
                    className={`w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all ${userRole === 'requester' ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-white border-slate-300'}`} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Departamento</label>
                <select name="department" defaultValue={p.department || ''} required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white">
                  <option value="" disabled>Selecione um departamento</option>
                  {DEPARTMENTS.map(dep => (
                    <option key={dep} value={dep}>{dep}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Projeto</label>
              <input type="text" name="name" defaultValue={p.name} required placeholder="Ex: Automação de Planilha de Vendas"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição Curta</label>
              <input type="text" name="description" defaultValue={p.description} required placeholder="O que este projeto deve fazer em uma frase?"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Premissas e Objetivos</label>
              <textarea name="premises" defaultValue={p.premises} rows="3" placeholder="Quais são as regras de negócio? O que precisa ser entregue no final?"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-y"></textarea>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                <Paperclip size={16} className="text-slate-500" />
                Link da Pasta/Arquivos (Google Drive, OneDrive, etc.)
              </label>
              <input type="url" name="fileLink" defaultValue={p.fileLink || ''} placeholder="https://drive.google.com/..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
          </div>

          {isEdit && userRole === 'admin' && (
            <div className="mt-8 pt-6 border-t border-slate-200 space-y-6">
              <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                <ShieldCheck size={16}/> Área Técnica (Admin)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status do Projeto</label>
                  <select name="status" defaultValue={p.status || 'planning'}
                    className="w-full px-4 py-2 border border-blue-200 bg-blue-50 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-700">
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                      <option key={key} value={key}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tecnologias (separadas por vírgula)</label>
                  <input type="text" name="technologies" defaultValue={p.technologies} placeholder="Ex: ChatGPT, Python, Excel"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex justify-between">Prompt Utilizado</label>
                  <textarea name="prompt" defaultValue={p.prompt} rows="8" placeholder="Cole o prompt principal aqui..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm bg-slate-50"></textarea>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Código Gerado / Resposta</label>
                  <textarea name="code" defaultValue={p.code} rows="8" placeholder="Cole o código ou resposta gerada..."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm bg-slate-50"></textarea>
                </div>
              </div>
            </div>
          )}

          <div className="pt-6 flex justify-end gap-3 border-t border-slate-100 mt-6">
            {isEdit && (
              <button type="button" onClick={() => { setEditingProject(null); setActiveTab('projects'); }}
                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium">
                Cancelar
              </button>
            )}
            <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm flex items-center gap-2">
              <Check size={18} /> {isEdit ? 'Salvar Alterações' : 'Criar Solicitação'}
            </button>
          </div>
        </form>
      </div>
    );
  };

  const renderProjects = () => {
    const isGlobalView = activeTab === 'global' || userRole === 'admin';
    const baseProjects = isGlobalView 
      ? projects 
      : projects.filter(p => p.requesterEmail && p.requesterEmail.toLowerCase() === userEmail.toLowerCase());

    const filtered = baseProjects.filter(p => {
      const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (p.technologies && p.technologies.toLowerCase().includes(searchTerm.toLowerCase())) ||
                            (p.requesterEmail && p.requesterEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
                            (p.department && p.department.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    return (
      <div className="space-y-6 animate-in fade-in">
        {/* Barra de Ferramentas */}
        <div className="flex flex-col md:flex-row justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-1 gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar projetos..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            >
              <option value="all">Todos os Status</option>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Alerta para solicitante com projetos pendentes */}
        {userRole === 'requester' && pendingAttentionCount > 0 && (
          <div className="bg-purple-50 text-purple-800 p-4 rounded-xl text-sm flex items-start gap-3 border border-purple-200 animate-pulse">
             <AlertCircle className="mt-0.5 shrink-0" size={20} />
             <div>
               <strong>Atenção!</strong> Você tem <strong>{pendingAttentionCount} projeto(s)</strong> aguardando sua resposta. 
               O administrador solicitou mais informações. Clique no ícone de <MessageCircle size={14} className="inline" /> para responder.
             </div>
          </div>
        )}

        {/* Informação sobre a Visão Global */}
        {activeTab === 'global' && userRole === 'requester' && (
          <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm flex items-start gap-3 border border-blue-200">
             <Globe className="mt-0.5 shrink-0" size={18} />
             <p>
               <strong>Visão Global:</strong> Você está visualizando o mural de projetos de toda a empresa. 
               Isso ajuda a entender as prioridades atuais em desenvolvimento. 
               <em> Projetos que não pertencem a você estão disponíveis apenas no modo de leitura.</em>
             </p>
          </div>
        )}

        {/* Grid de Projetos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map(project => {
            const canEdit = userRole === 'admin' || (project.requesterEmail && project.requesterEmail.toLowerCase() === userEmail.toLowerCase());
            const needsMyAttention = (userRole === 'admin' && project.attentionFor === 'admin') ||
                                     (userRole === 'requester' && project.attentionFor === 'requester');

            return (
              <div key={project.id} className={`bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow flex flex-col h-full overflow-hidden ${needsMyAttention ? 'border-purple-300 ring-2 ring-purple-200' : !canEdit ? 'border-slate-200 opacity-90' : 'border-slate-300'}`}>
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg text-slate-800 truncate" title={project.name}>{project.name}</h3>
                      </div>
                      <AttentionBadge project={project} />
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium border whitespace-nowrap ml-2 ${STATUS_CONFIG[project.status]?.color || ''}`}>
                      {STATUS_CONFIG[project.status]?.label || project.status}
                    </span>
                  </div>
                  <p className="text-slate-600 text-sm mb-4 line-clamp-2">{project.description}</p>
                  
                  <div className="space-y-2 mt-auto">
                    {project.requesterEmail && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Mail size={14} className={canEdit ? "text-emerald-600" : "text-slate-400"} /> 
                        <span className="truncate">
                          Solici.: <span className={`font-medium ${canEdit ? 'text-slate-700' : 'text-slate-500'}`}>{project.requesterEmail}</span>
                        </span>
                      </div>
                    )}
                    {project.department && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Briefcase size={14} className="text-amber-600" /> <span className="truncate">{project.department}</span>
                      </div>
                    )}
                    {project.technologies && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Tag size={14} /> <span className="truncate">{project.technologies}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Clock size={14} /> {formatDate(project.updatedAt)}
                    </div>
                    {(project.comments?.length > 0) && (
                      <div className="flex items-center gap-2 text-xs text-purple-600">
                        <MessageCircle size={14} /> {project.comments.length} comentário(s)
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="bg-slate-50 border-t border-slate-100 p-3 flex justify-between gap-2">
                  <button onClick={() => setViewingProject(project)} className="flex-1 flex justify-center items-center gap-1 px-2 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100 rounded transition-colors">
                    <Eye size={16} /> Ver
                  </button>
                  {canEdit && (
                    <button onClick={() => { setEditingProject(project); setActiveTab('new'); }} className="flex-1 flex justify-center items-center gap-1 px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded transition-colors">
                      <Edit size={16} /> Editar
                    </button>
                  )}
                  <button 
                    onClick={() => { 
                      setViewingComments(project);
                      if (needsMyAttention) handleMarkAsRead(project.id);
                    }} 
                    className={`flex-1 flex justify-center items-center gap-1 px-2 py-1.5 text-sm font-medium rounded transition-colors ${needsMyAttention ? 'text-purple-700 bg-purple-100 hover:bg-purple-200' : 'text-purple-600 hover:bg-purple-100'}`} 
                    title="Comentários"
                  >
                    <MessageCircle size={16} />
                    {needsMyAttention && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                  </button>
                  <button onClick={() => setViewingHistory(project)} className="flex justify-center items-center px-2 py-1.5 text-sm font-medium text-amber-600 hover:bg-amber-100 rounded transition-colors" title="Histórico">
                    <History size={16} />
                  </button>
                  {userRole === 'admin' && (
                    <button onClick={() => handleDelete(project.id)} className="flex justify-center items-center px-2 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-100 rounded transition-colors">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {filtered.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
            <FileJson className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <h3 className="text-lg font-medium text-slate-900">Nenhum projeto encontrado</h3>
            <p className="mt-1 text-sm text-slate-500">
              {!isGlobalView ? 'Você ainda não fez nenhuma solicitação.' : 'Ajuste os filtros ou crie um novo projeto.'}
            </p>
            <button onClick={() => setActiveTab('new')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium inline-flex items-center gap-2">
              <PlusCircle size={18} /> Nova Solicitação
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderAnalytics = () => {
    const statusCount = projects.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {});
    const techCount = {};
    projects.forEach(p => {
      if (p.technologies) {
        p.technologies.split(',').forEach(t => {
          const clean = t.trim();
          if (clean) techCount[clean] = (techCount[clean] || 0) + 1;
        });
      }
    });
    const sortedTechs = Object.entries(techCount).sort((a, b) => b[1] - a[1]).slice(0, 8);

    return (
      <div className="space-y-6 animate-in fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <PieChart size={20} className="text-blue-600"/> Distribuição por Status
            </h3>
            <div className="space-y-4">
              {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                const count = statusCount[key] || 0;
                const percentage = projects.length ? Math.round((count / projects.length) * 100) : 0;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700">{config.label}</span>
                      <span className="text-slate-500">{count} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full ${config.color.split(' ')[0].replace('bg-', 'bg-').replace('100', '500')}`} style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
              <Tag size={20} className="text-blue-600"/> Top Tecnologias
            </h3>
            <div className="space-y-4">
              {sortedTechs.length > 0 ? sortedTechs.map(([tech, count]) => {
                const max = sortedTechs[0][1];
                const percentage = Math.round((count / max) * 100);
                return (
                  <div key={tech}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700">{tech}</span>
                      <span className="text-slate-500">{count} projetos</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                )
              }) : <p className="text-slate-500 text-sm">Nenhum dado de tecnologia disponível.</p>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- RENDERIZAÇÃO PRINCIPAL ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-200">
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-5 ${toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'}`}>
          {toast.type === 'error' ? <X size={18} /> : <Check size={18} />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* Header & Navigation */}
      <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg"><LayoutDashboard size={24} /></div>
              <div className="hidden sm:block">
                <h1 className="font-bold text-xl leading-none">IA Project Manager</h1>
                <span className="text-xs text-slate-400">
                  {userRole === 'admin' ? 'Acesso Administrativo' : 'Portal do Solicitante'}
                </span>
              </div>
            </div>
            
            <nav className="hidden md:flex gap-1 items-center">
              {userRole === 'admin' ? (
                <>
                  <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-md font-medium text-sm transition-colors relative ${activeTab === 'dashboard' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                    Dashboard
                    {pendingAttentionCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                        {pendingAttentionCount}
                      </span>
                    )}
                  </button>
                  <button onClick={() => setActiveTab('projects')} className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'projects' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Todos os Projetos</button>
                </>
              ) : (
                <>
                  <button onClick={() => setActiveTab('projects')} className={`px-4 py-2 rounded-md font-medium text-sm transition-colors relative ${activeTab === 'projects' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                    Meus Projetos
                    {pendingAttentionCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
                        {pendingAttentionCount}
                      </span>
                    )}
                  </button>
                  <button onClick={() => setActiveTab('global')} className={`px-4 py-2 rounded-md font-medium text-sm transition-colors flex items-center gap-1 ${activeTab === 'global' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                     <Globe size={16} /> Visão Global
                  </button>
                </>
              )}
              
              <button onClick={() => { setEditingProject(null); setActiveTab('new'); }} className={`px-4 py-2 rounded-md font-medium text-sm transition-colors flex items-center gap-2 ${activeTab === 'new' ? 'bg-blue-600 text-white' : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white'}`}><PlusCircle size={16}/> Novo</button>
              
              {userRole === 'admin' && (
                <button onClick={() => setActiveTab('analytics')} className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${activeTab === 'analytics' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Relatórios</button>
              )}
              
              <div className="w-px h-6 bg-slate-700 mx-2"></div>
              
              <div className="flex items-center gap-3 ml-2">
                <div className="flex flex-col text-right">
                  {userRole === 'admin' ? (
                     <span className="text-sm font-medium text-slate-200 leading-tight flex items-center gap-1 justify-end"><User size={14}/> Bruno Andrade</span>
                  ) : (
                     <span className="text-sm font-medium text-slate-200 leading-tight flex items-center gap-1 justify-end"><Mail size={14}/> {userEmail}</span>
                  )}
                </div>
                <button onClick={handleLogout} className="text-slate-400 hover:text-rose-400 transition-colors p-2" title="Sair do Perfil">
                  <LogOut size={18} />
                </button>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <div className="md:hidden bg-slate-800 text-white flex overflow-x-auto p-2 gap-2 shadow-inner">
        {userRole === 'admin' ? (
           <button onClick={() => setActiveTab('dashboard')} className={`relative flex-1 py-2 px-3 rounded text-sm font-medium whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-slate-700' : 'text-slate-300'}`}>
             Dash
             {pendingAttentionCount > 0 && (
               <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                 {pendingAttentionCount}
               </span>
             )}
           </button>
        ) : (
           <button onClick={() => setActiveTab('projects')} className={`relative flex-1 py-2 px-3 rounded text-sm font-medium whitespace-nowrap ${activeTab === 'projects' ? 'bg-slate-700' : 'text-slate-300'}`}>
             Meus
             {pendingAttentionCount > 0 && (
               <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                 {pendingAttentionCount}
               </span>
             )}
           </button>
        )}
        <button onClick={() => setActiveTab(userRole === 'admin' ? 'projects' : 'global')} className={`flex-1 py-2 px-3 rounded text-sm font-medium whitespace-nowrap ${(activeTab === 'projects' && userRole === 'admin') || activeTab === 'global' ? 'bg-slate-700' : 'text-slate-300'}`}>
          {userRole === 'admin' ? 'Projetos' : 'Global'}
        </button>
        <button onClick={() => { setEditingProject(null); setActiveTab('new'); }} className={`flex-1 py-2 px-3 rounded text-sm font-medium whitespace-nowrap bg-blue-600/30 text-blue-300`}>+ Novo</button>
        <button onClick={handleLogout} className="flex-1 py-2 px-3 rounded text-sm font-medium whitespace-nowrap text-rose-400">Sair</button>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && userRole === 'admin' && renderDashboard()}
        {(activeTab === 'projects' || activeTab === 'global') && renderProjects()}
        {activeTab === 'new' && renderProjectForm()}
        {activeTab === 'analytics' && userRole === 'admin' && renderAnalytics()}
      </main>

      {/* MODAL: Visualizar Projeto */}
      {viewingProject && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-center p-4 sm:p-6 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-200 flex justify-between items-start bg-slate-50">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold text-slate-800">{viewingProject.name}</h2>
                  <AttentionBadge project={viewingProject} />
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_CONFIG[viewingProject.status]?.color || ''}`}>
                    {STATUS_CONFIG[viewingProject.status]?.label || viewingProject.status}
                  </span>
                  {viewingProject.requesterEmail && (
                    <span className="flex items-center gap-1 text-emerald-600"><Mail size={14}/> {viewingProject.requesterEmail}</span>
                  )}
                  {viewingProject.department && (
                    <span className="flex items-center gap-1 text-amber-600"><Briefcase size={14}/> {viewingProject.department}</span>
                  )}
                  <span className="flex items-center gap-1"><Clock size={14}/> Atualizado: {formatDate(viewingProject.updatedAt)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setViewingProject(null)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-8">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Descrição</h4>
                <p className="text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-100">{viewingProject.description}</p>
              </div>

              {viewingProject.fileLink && (
                <div className="mb-8">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Arquivos e Anexos</h4>
                  <a href={viewingProject.fileLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 text-sm font-medium">
                    <Paperclip size={16} /> Acessar Pasta do Projeto
                  </a>
                </div>
              )}

              {viewingProject.premises && (
                <div className="mb-8">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">Premissas e Objetivos</h4>
                  <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 text-slate-700 whitespace-pre-wrap text-sm">
                    {viewingProject.premises}
                  </div>
                </div>
              )}

              {(viewingProject.prompt || viewingProject.code) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 pt-6 border-t border-slate-200">
                  <h3 className="col-span-full text-sm font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <ShieldCheck size={16}/> Resolução Técnica
                  </h3>
                  {viewingProject.prompt && <CodeBlock label="Prompt Utilizado" content={viewingProject.prompt} />}
                  {viewingProject.code && <CodeBlock label="Código / Resposta Gerada" content={viewingProject.code} />}
                </div>
              )}

              {viewingProject.technologies && (
                <div className="mt-4 flex gap-2 items-center">
                  <Tag size={16} className="text-slate-400" />
                  <div className="flex flex-wrap gap-2">
                    {viewingProject.technologies.split(',').map((tech, i) => (
                      <span key={i} className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-xs font-medium text-slate-600">
                        {tech.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between gap-3">
              <button 
                onClick={() => { 
                  setViewingProject(null); 
                  setViewingComments(viewingProject); 
                }} 
                className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <MessageCircle size={16} /> Comentários ({viewingProject.comments?.length || 0})
              </button>
              {(userRole === 'admin' || (viewingProject.requesterEmail && viewingProject.requesterEmail.toLowerCase() === userEmail.toLowerCase())) && (
                <button onClick={() => { 
                  const p = viewingProject; 
                  setViewingProject(null); 
                  setEditingProject(p); 
                  setActiveTab('new'); 
                }} className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium flex items-center gap-2">
                  <Edit size={16} /> Editar Projeto
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Comentários */}
      {viewingComments && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-center p-4 sm:p-6 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-purple-50 to-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <MessageCircle className="text-purple-600" size={24} />
                  Comunicação do Projeto
                </h2>
                <p className="text-sm text-slate-500 mt-1">{viewingComments.name}</p>
              </div>
              <button onClick={() => setViewingComments(null)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
              {viewingComments.comments && viewingComments.comments.length > 0 ? (
                viewingComments.comments.map((comment) => (
                  <div 
                    key={comment.id} 
                    className={`p-4 rounded-xl ${
                      comment.role === 'admin' 
                        ? 'bg-blue-50 border border-blue-200 ml-4' 
                        : 'bg-white border border-slate-200 mr-4'
                    } ${comment.isInfoRequest ? 'ring-2 ring-purple-300' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${comment.role === 'admin' ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                          {comment.role === 'admin' ? 'A' : comment.author.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{comment.author}</p>
                          <p className="text-xs text-slate-500">{formatDate(comment.date)}</p>
                        </div>
                      </div>
                      {comment.isInfoRequest && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full flex items-center gap-1">
                          <AlertCircle size={12} /> Solicitação de Info
                        </span>
                      )}
                    </div>
                    <p className="text-slate-700 text-sm whitespace-pre-wrap pl-10">{comment.message}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <MessageSquare className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                  <p className="text-slate-500">Nenhum comentário ainda.</p>
                  <p className="text-xs text-slate-400 mt-1">Use o campo abaixo para iniciar a comunicação.</p>
                </div>
              )}
            </div>
            
            {/* Form de novo comentário */}
            <div className="p-4 border-t border-slate-200 bg-white">
              <form onSubmit={(e) => {
                e.preventDefault();
                const message = e.target.message.value;
                const requestInfo = e.target.requestInfo?.checked || false;
                handleSendComment(viewingComments.id, message, requestInfo);
                e.target.reset();
              }} className="space-y-3">
                <textarea 
                  name="message" 
                  rows="3" 
                  required
                  placeholder={userRole === 'admin' ? "Escreva uma mensagem ou solicite mais informações..." : "Responda à solicitação ou adicione informações..."}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all resize-none text-sm"
                ></textarea>
                
                <div className="flex justify-between items-center">
                  {userRole === 'admin' && (
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-purple-600 transition-colors">
                      <input type="checkbox" name="requestInfo" className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500" />
                      <AlertCircle size={16} />
                      Marcar como solicitação de informações
                    </label>
                  )}
                  {userRole !== 'admin' && <div></div>}
                  
                  <button type="submit" className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm flex items-center gap-2 shadow-sm">
                    <Send size={16} /> Enviar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Histórico de Versões */}
      {viewingHistory && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-center items-center p-4 sm:p-6 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Histórico de Versões</h2>
                <p className="text-sm text-slate-500">{viewingHistory.name}</p>
              </div>
              <button onClick={() => setViewingHistory(null)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              {viewingHistory.versions && viewingHistory.versions.length > 0 ? (
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                  {[...viewingHistory.versions].reverse().map((v, i) => (
                    <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-blue-100 text-blue-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                        <History size={18} />
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-800">Versão {v.version}</span>
                          <span className="text-xs text-slate-500">{formatDate(v.date)}</span>
                        </div>
                        <p className="text-sm text-slate-600 mb-3">{v.changes}</p>
                        
                        <details className="text-sm group/details">
                          <summary className="cursor-pointer font-medium text-blue-600 hover:text-blue-800 select-none">
                            Ver Prompt/Código
                          </summary>
                          <div className="mt-3 space-y-3">
                             <div className="bg-slate-900 rounded p-3 overflow-x-auto">
                                <div className="text-xs text-slate-400 mb-1">Prompt:</div>
                                <pre className="text-slate-300 font-mono text-xs whitespace-pre-wrap">{v.prompt || 'N/A'}</pre>
                             </div>
                             <div className="bg-slate-900 rounded p-3 overflow-x-auto">
                                <div className="text-xs text-slate-400 mb-1">Código:</div>
                                <pre className="text-slate-300 font-mono text-xs whitespace-pre-wrap">{v.code || 'N/A'}</pre>
                             </div>
                          </div>
                        </details>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <History className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                  <p className="text-slate-500">Nenhuma versão anterior registrada para este projeto.</p>
                  <p className="text-xs text-slate-400 mt-1">As versões são salvas automaticamente quando você edita um projeto.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
