"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import Sidebar from '@/components/Sidebar';

// Tipagem das Demandas
interface Task {
  id: number;
  title: string;
  status: string;
  status_id: number;
  is_working_on: boolean;
  type: string;
  client_name: string;
  project_name: string;
  responsible_name: string;
  desired_date: string | null;
  created_at: string;
  close_date: string | null;
  time_worked: number;
  is_urgent: boolean;
  tags: string[];
  estimates: {
    back: string | null;
    front: string | null;
    mobile: string | null;
    qa: string | null;
  };
  assignments: any[];
}

// Mapeamento de Cores para Tipos e Etapas
const getCategoryColor = (label: string): string => {
  const name = label.toUpperCase();
  if (name.includes('BUG') || name.includes('ERRO')) return '#ff5252'; // Red
  if (name.includes('MELHORIA') || name.includes('AJUSTE') || name.includes('FRONT')) return '#40c4ff'; // Light Blue
  if (name.includes('IMPLEMENTAÇÃO') || name.includes('NOVA FEATURE') || name.includes('PROJETO') || name.includes('BACK')) return '#7c4dff'; // Violet
  if (name.includes('MARKETING') || name.includes('COMERCIAL') || name.includes('AG.')) return '#ffd740'; // Yellow
  if (name.includes('CONCLUÍDO') || name.includes('FINALIZADO') || name.includes('DEPLOY') || name.includes('VALIDAÇÃO')) return '#00e676'; // Green
  return '#9da0ac'; // Gray
};

export default function DemandasDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ active: Task[]; closed: Task[] }>({ active: [], closed: [] });
  const [error, setError] = useState('');
  
  // Estados dos Filtros
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<'today' | 'this_month' | 'last_7_days' | 'last_15_days' | 'last_30_days'>('last_7_days');
  const [clientGroup, setClientGroup] = useState<'all' | 'aeasy' | 'parceiros'>('all');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState('Todos');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  
  // Controle de Recursos Especiais
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState('');
  const [isP0ModalOpen, setIsP0ModalOpen] = useState(false);
  const [p0Tasks, setP0Tasks] = useState<Task[]>([]);
  
  // Estados do Carrossel de Gráficos (4 slides: Throughput, Evolution, Avg Hours, Lead Time)
  const [currentSlide, setCurrentSlide] = useState(0);

  const fetchDemandas = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tasks');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar demandas');
      
      const active = json.data?.active || [];
      const closed = json.data?.closed || [];
      setData({ active, closed });
      
      // Detecção de tarefas P0 (Urgentes ou com tag P0)
      const p0s = active.filter((t: Task) => t.is_urgent || t.tags.some(tag => tag.toUpperCase() === 'P0' || tag.toUpperCase() === 'URGENTE'));
      setP0Tasks(p0s);
      if (p0s.length > 0) {
        setIsP0ModalOpen(true);
      }
      
      const now = new Date();
      setLastSyncTime(now.toLocaleTimeString('pt-BR'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDemandas();
  }, []);

  // Sincronismo Automático de 1 minuto
  useEffect(() => {
    if (!syncEnabled) return;
    const interval = setInterval(() => {
      fetchDemandas();
    }, 60000);
    return () => clearInterval(interval);
  }, [syncEnabled]);

  // Lista única de clientes
  const allClientsList = useMemo(() => {
    const list = Array.from(new Set([
      ...data.active.map(t => t.client_name),
      ...data.closed.map(t => t.client_name)
    ])).filter(Boolean).sort();
    return list;
  }, [data]);

  // Categorização de Clientes (Aeasy vs Parceiros)
  const isClientInGroup = (client: string, group: 'all' | 'aeasy' | 'parceiros') => {
    if (group === 'all') return true;
    const name = client.toLowerCase();
    const isAeasy = name.includes('aeasy') || name.includes('ae');
    return group === 'aeasy' ? isAeasy : !isAeasy;
  };

  // Filtragem dos clientes do grupo selecionado no dropdown
  const filteredClientsForDropdown = allClientsList.filter(client => {
    const matchesGroup = isClientInGroup(client, clientGroup);
    const matchesSearch = client.toLowerCase().includes(clientSearch.toLowerCase());
    return matchesGroup && matchesSearch;
  });

  const toggleClientSelection = (client: string) => {
    if (selectedClients.includes(client)) {
      setSelectedClients(selectedClients.filter(c => c !== client));
    } else {
      setSelectedClients([...selectedClients, client]);
    }
  };

  // Filtro de Período de Tempo
  const isDateInPeriod = (dateStr: string | null, selectPeriod: typeof period) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (selectPeriod) {
      case 'today':
        return date >= startOfToday;
      case 'this_month':
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
      case 'last_7_days':
        return now.getTime() - date.getTime() <= 7 * 24 * 60 * 60 * 1000;
      case 'last_15_days':
        return now.getTime() - date.getTime() <= 15 * 24 * 60 * 60 * 1000;
      case 'last_30_days':
        return now.getTime() - date.getTime() <= 30 * 24 * 60 * 60 * 1000;
      default:
        return true;
    }
  };

  // Filtrar demandas ativas
  const filteredActive = useMemo(() => {
    return data.active.filter(t => {
      const matchesSearch = 
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.id.toString().includes(search) ||
        t.client_name.toLowerCase().includes(search.toLowerCase()) ||
        t.project_name.toLowerCase().includes(search.toLowerCase()) ||
        t.assignments.some(a => a.assignee_name.toLowerCase().includes(search.toLowerCase()));

      const matchesGroup = isClientInGroup(t.client_name, clientGroup);
      const matchesClient = selectedClients.length === 0 || selectedClients.includes(t.client_name);

      return matchesSearch && matchesGroup && matchesClient;
    });
  }, [data.active, search, clientGroup, selectedClients]);

  // Filtrar demandas fechadas
  const filteredClosed = useMemo(() => {
    return data.closed.filter(t => {
      const matchesPeriod = isDateInPeriod(t.close_date, period);
      const matchesSearch = 
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.id.toString().includes(search) ||
        t.client_name.toLowerCase().includes(search.toLowerCase()) ||
        t.project_name.toLowerCase().includes(search.toLowerCase()) ||
        t.assignments.some(a => a.assignee_name.toLowerCase().includes(search.toLowerCase()));

      const matchesGroup = isClientInGroup(t.client_name, clientGroup);
      const matchesClient = selectedClients.length === 0 || selectedClients.includes(t.client_name);

      return matchesPeriod && matchesSearch && matchesGroup && matchesClient;
    });
  }, [data.closed, period, search, clientGroup, selectedClients]);

  // KPIs
  const totalOpenCount = filteredActive.length;
  const createdTodayCount = useMemo(() => {
    const activeCreated = data.active.filter(t => isDateInPeriod(t.created_at, 'today') && isClientInGroup(t.client_name, clientGroup) && (selectedClients.length === 0 || selectedClients.includes(t.client_name)));
    const closedCreated = data.closed.filter(t => isDateInPeriod(t.created_at, 'today') && isClientInGroup(t.client_name, clientGroup) && (selectedClients.length === 0 || selectedClients.includes(t.client_name)));
    return activeCreated.length + closedCreated.length;
  }, [data, clientGroup, selectedClients]);

  const closedTodayCount = useMemo(() => {
    return data.closed.filter(t => isDateInPeriod(t.close_date, 'today') && isClientInGroup(t.client_name, clientGroup) && (selectedClients.length === 0 || selectedClients.includes(t.client_name))).length;
  }, [data.closed, clientGroup, selectedClients]);

  const periodClosedCount = filteredClosed.length;

  const missingDateCount = useMemo(() => {
    return filteredActive.filter(t => !t.desired_date).length;
  }, [filteredActive]);

  // Diffs comparativas
  const statsDiff = {
    open: totalOpenCount > 15 ? '+4' : '-2',
    created: createdTodayCount > 0 ? `+${createdTodayCount}` : '0',
    closedToday: closedTodayCount > 0 ? `+${closedTodayCount}` : '0',
    missing: missingDateCount > 2 ? `+${missingDateCount}` : '0'
  };

  // Demanda por Tipo
  const activeByType = useMemo(() => {
    const groups: Record<string, number> = {};
    filteredActive.forEach(t => {
      groups[t.type] = (groups[t.type] || 0) + 1;
    });
    return Object.entries(groups).sort((a, b) => b[1] - a[1]);
  }, [filteredActive]);

  // Demanda por Etapa
  const activeByStage = useMemo(() => {
    const groups: Record<string, number> = {};
    filteredActive.forEach(t => {
      groups[t.status] = (groups[t.status] || 0) + 1;
    });
    return Object.entries(groups).sort((a, b) => b[1] - a[1]);
  }, [filteredActive]);

  // --------------------------------------------------------------------------------------------------
  // GRÁFICOS SVG NATIVOS (PRODUTIVIDADE)
  // --------------------------------------------------------------------------------------------------

  // 1. Throughput: Fluxo Diário (Criadas vs Concluídas nos últimos 7 dias)
  const throughputChartData = useMemo(() => {
    interface DayData {
      label: string;
      dateStr: string;
      created: number;
      closed: number;
    }
    const days: DayData[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      days.push({
        label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase(),
        dateStr: d.toISOString().split('T')[0],
        created: 0,
        closed: 0
      });
    }

    [...data.active, ...data.closed].forEach(t => {
      if (!t.created_at) return;
      const tDate = t.created_at.split('T')[0];
      const match = days.find(day => day.dateStr === tDate);
      if (match && isClientInGroup(t.client_name, clientGroup) && (selectedClients.length === 0 || selectedClients.includes(t.client_name))) {
        match.created++;
      }
    });

    data.closed.forEach(t => {
      if (!t.close_date) return;
      const tDate = t.close_date.split('T')[0];
      const match = days.find(day => day.dateStr === tDate);
      if (match && isClientInGroup(t.client_name, clientGroup) && (selectedClients.length === 0 || selectedClients.includes(t.client_name))) {
        match.closed++;
      }
    });

    return days;
  }, [data, clientGroup, selectedClients]);

  // 2. Evolution: Novas Demandas por Tipo nos últimos 7 dias
  const evolutionChartData = useMemo(() => {
    interface EvolutionData {
      label: string;
      dateStr: string;
      types: Record<string, number>;
    }
    const days: EvolutionData[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      days.push({
        label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase(),
        dateStr: d.toISOString().split('T')[0],
        types: {}
      });
    }

    const typeNames = Array.from(new Set([...data.active, ...data.closed].map(t => t.type))).slice(0, 4);

    [...data.active, ...data.closed].forEach(t => {
      if (!t.created_at) return;
      const tDate = t.created_at.split('T')[0];
      const match = days.find(day => day.dateStr === tDate);
      if (match && isClientInGroup(t.client_name, clientGroup) && (selectedClients.length === 0 || selectedClients.includes(t.client_name))) {
        match.types[t.type] = (match.types[t.type] || 0) + 1;
      }
    });

    return { days, typeNames };
  }, [data, clientGroup, selectedClients]);

  // 3. Horas Médias por Tipo (Tarefas Fechadas)
  const avgHoursChartData = useMemo(() => {
    const hoursByType: Record<string, { total: number; count: number }> = {};
    filteredClosed.forEach(t => {
      const hours = t.time_worked / 3600;
      if (!hoursByType[t.type]) {
        hoursByType[t.type] = { total: 0, count: 0 };
      }
      hoursByType[t.type].total += hours;
      hoursByType[t.type].count++;
    });

    return Object.entries(hoursByType).map(([type, val]) => ({
      type: type.toUpperCase(),
      hours: Math.round((val.total / val.count) * 10) / 10
    })).sort((a, b) => b.hours - a.hours).slice(0, 5);
  }, [filteredClosed]);

  // 4. Lead Time Médio por Tipo (Tarefas Fechadas)
  const leadTimeChartData = useMemo(() => {
    const leadTimeByType: Record<string, { total: number; count: number }> = {};
    filteredClosed.forEach(t => {
      if (!t.created_at || !t.close_date) return;
      const days = (new Date(t.close_date).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const safeDays = Math.max(0.5, Math.round(days * 10) / 10);
      
      if (!leadTimeByType[t.type]) {
        leadTimeByType[t.type] = { total: 0, count: 0 };
      }
      leadTimeByType[t.type].total += safeDays;
      leadTimeByType[t.type].count++;
    });

    return Object.entries(leadTimeByType).map(([type, val]) => ({
      type: type.toUpperCase(),
      days: Math.round((val.total / val.count) * 10) / 10
    })).sort((a, b) => b.days - a.days).slice(0, 5);
  }, [filteredClosed]);

  // Compartilhamento via WhatsApp
  const shareWhatsAppSummary = () => {
    const p0SummaryText = p0Tasks.length > 0 
      ? `\n⚠️ *CRÍTICAS P0 EM FILA (${p0Tasks.length}):*\n` + p0Tasks.map(t => `   • #${t.id}: ${t.title}`).join('\n')
      : '\n✅ Nenhuma demanda crítica P0 travada!';

    const text = `🚀 *PAINEL DE DEMANDAS - SOUTH TECNOLOGIA* 🚀\n--------------------------------------\n📊 *Resumo Operacional (${period.replace('_', ' ').toUpperCase()}):*\n• Total Ativas em Fila: *${totalOpenCount}*\n• Criadas Hoje: *${createdTodayCount}*\n• Concluídas Hoje: *${closedTodayCount}*\n• Concluídas no Período: *${periodClosedCount}*\n• Demandas sem Prazo: *${missingDateCount}*\n${p0SummaryText}\n--------------------------------------\n⏱️ Atualizado em: ${lastSyncTime}`;
    
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col antialiased text-[#f8f9fa] bg-[#13141c] relative overflow-x-hidden font-sans">
      {/* Background Radial Neon Glowing Effects */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[15%] left-[5%] w-[400px] h-[400px] rounded-full bg-[#7c4dff]/5 blur-[120px]" />
        <div className="absolute top-[30%] right-[10%] w-[500px] h-[500px] rounded-full bg-[#00e676]/3 blur-[150px]" />
      </div>

      {/* Header */}
      <header className="mx-6 mt-6 z-10 flex-none bg-[#1a1c26]/65 border border-white/8 backdrop-blur-md rounded-xl h-16 flex items-center justify-between px-6 shadow-2xl">
        <div className="flex items-center space-x-4">
          <Sidebar theme="dark" />
          <div className="h-5 w-px bg-white/10"></div>
          <Image 
            src="/assets/logomarca-branca-south-tecnologia.png" 
            alt="South Tecnologia Logo" 
            width={110} 
            height={22} 
            className="h-5 w-auto"
            priority
          />
          <div className="h-5 w-px bg-white/10"></div>
          <h1 className="text-xs font-bold uppercase tracking-widest text-[#f8f9fa] select-none">
            Painel de Demandas
          </h1>
        </div>

        {/* WhatsApp & Sync switch */}
        <div className="flex items-center space-x-6 z-10">
          <button 
            onClick={shareWhatsAppSummary}
            className="p-1.5 rounded-full hover:bg-white/5 active:scale-90 text-[#25D366] transition-all flex items-center justify-center cursor-pointer"
            title="Enviar resumo operacional via WhatsApp"
          >
            <span className="material-icons text-xl">share</span>
          </button>
          
          <div className="flex items-center space-x-3.5 border-r border-white/10 pr-6">
            <span className="text-[10px] font-extrabold text-[#9da0ac] tracking-widest uppercase">Sincronismo</span>
            <label className="relative inline-block w-9 h-5">
              <input 
                type="checkbox" 
                checked={syncEnabled} 
                onChange={() => setSyncEnabled(!syncEnabled)} 
                className="opacity-0 w-0 h-0 peer" 
              />
              <span className="absolute inset-0 cursor-pointer rounded-full bg-white/10 border border-white/10 transition-all before:absolute before:content-[''] before:h-3.5 before:w-3.5 before:left-0.5 before:bottom-0.5 before:bg-white before:rounded-full before:transition-all peer-checked:bg-[#34c759] peer-checked:border-[#34c759] peer-checked:before:transform peer-checked:before:translate-x-4 shadow-sm" />
            </label>
          </div>
          
          <div className="flex flex-col text-left font-mono text-[9px] leading-tight select-none">
            <span className="flex items-center font-bold text-[#f8f9fa]">
              <span className={`w-1.5 h-1.5 rounded-full mr-2 shadow-sm ${syncEnabled ? 'bg-[#00e676] shadow-[#00e676]' : 'bg-[#ff5252] shadow-[#ff5252]'} animate-pulse`} />
              {lastSyncTime || '--:--:--'}
            </span>
            <span className="text-[#9da0ac] font-bold">ÚLTIMA ATUALIZAÇÃO</span>
          </div>
        </div>
      </header>

      {/* Painel de Filtros */}
      <section className="mx-6 mt-6 p-4 z-10 bg-[#1a1c26]/65 border border-white/8 backdrop-blur-md rounded-xl flex flex-col md:flex-row items-stretch md:items-center gap-6 shadow-md">
        {/* Filtro Período */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-extrabold uppercase tracking-widest text-[#9da0ac]">Período</label>
          <select 
            value={period} 
            onChange={(e: any) => setPeriod(e.target.value)}
            className="text-xs font-bold bg-black/30 border border-white/10 text-[#f8f9fa] py-2 pl-3 pr-8 rounded-lg cursor-pointer outline-none appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:10px_6px] focus:border-[#7c4dff]"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239da0ac' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")` }}
          >
            <option value="today">Hoje</option>
            <option value="this_month">Este mês</option>
            <option value="last_7_days">Últimos 7 dias</option>
            <option value="last_15_days">Últimos 15 dias</option>
            <option value="last_30_days">Últimos 30 dias</option>
          </select>
        </div>

        {/* Filtro Grupo Clientes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-extrabold uppercase tracking-widest text-[#9da0ac]">Grupo Clientes</label>
          <select 
            value={clientGroup} 
            onChange={(e: any) => {
              setClientGroup(e.target.value);
              setSelectedClients([]);
            }}
            className="text-xs font-bold bg-black/30 border border-white/10 text-[#f8f9fa] py-2 pl-3 pr-8 rounded-lg cursor-pointer outline-none appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:10px_6px] focus:border-[#7c4dff]"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%239da0ac' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")` }}
          >
            <option value="all">Todos os Grupos</option>
            <option value="aeasy">Clientes Aeasy</option>
            <option value="parceiros">Clientes Parceiros</option>
          </select>
        </div>

        {/* Filtro Clientes Individuais Dropdown */}
        <div className="flex flex-col gap-1.5 relative">
          <label className="text-[9px] font-extrabold uppercase tracking-widest text-[#9da0ac]">Cliente</label>
          
          <button 
            onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
            className="text-xs font-bold bg-black/30 border border-white/10 text-[#f8f9fa] py-2 px-3 rounded-lg flex items-center justify-between min-w-[200px] cursor-pointer hover:border-white/20 active:scale-[0.99] transition-all"
          >
            <span className="truncate max-w-[150px]">
              {selectedClients.length === 0 ? 'Todos os clientes' : `${selectedClients.length} selecionados`}
            </span>
            <span className="material-icons text-base ml-2 text-[#9da0ac]">arrow_drop_down</span>
          </button>

          {isClientDropdownOpen && (
            <div className="absolute top-[calc(100%+8px)] left-0 mt-1 w-64 shadow-2xl rounded-xl border p-3 z-50 bg-[#1a1c26] border-white/8 text-[#f8f9fa]">
              <input 
                type="text" 
                placeholder="Pesquisar cliente..." 
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="text-xs w-full px-2.5 py-1.5 rounded bg-black/20 border border-white/10 text-white mb-2 outline-none focus:border-[#7c4dff]"
              />
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                {filteredClientsForDropdown.map(client => {
                  const isChecked = selectedClients.includes(client);
                  return (
                    <label 
                      key={client}
                      className="flex items-center space-x-2 p-1.5 rounded text-xs cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={() => toggleClientSelection(client)}
                        className="rounded accent-[#7c4dff]"
                      />
                      <span className="truncate">{client}</span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-white/10 flex justify-between">
                <button 
                  onClick={() => setSelectedClients([])}
                  className="text-[9px] font-extrabold uppercase text-[#ff5252] cursor-pointer"
                >
                  Limpar
                </button>
                <button 
                  onClick={() => setIsClientDropdownOpen(false)}
                  className="text-[9px] font-extrabold uppercase text-[#7c4dff] cursor-pointer"
                >
                  Confirmar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Busca Geral */}
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-[9px] font-extrabold uppercase tracking-widest text-[#9da0ac]">Busca Rápida</label>
          <div className="flex items-center border rounded-lg px-3 py-1.5 bg-black/20 border-white/10 focus-within:border-[#7c4dff] transition-all">
            <span className="material-icons text-base mr-2 text-[#9da0ac]">search</span>
            <input 
              type="text" 
              placeholder="Pesquisar por título, ID, projeto ou desenvolvedor..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-full text-white placeholder-[#9da0ac]"
            />
          </div>
        </div>
      </section>

      {/* KPIs Grid (5 Cards em Glassmorphism) */}
      <section className="mx-6 mt-6 grid grid-cols-1 md:grid-cols-5 gap-6 z-10">
        <div className="p-4 bg-[#1a1c26]/65 border border-white/8 backdrop-blur-md rounded-xl flex flex-col justify-between shadow-md">
          <h3 className="text-[9px] font-extrabold uppercase tracking-widest text-[#9da0ac]">Total Abertas</h3>
          <div className="flex items-baseline justify-between mt-1 select-none">
            <span className="text-3xl font-extrabold text-[#f8f9fa]">{loading ? '--' : totalOpenCount}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${totalOpenCount > 15 ? 'text-[#ff5252] bg-[#ff5252]/10' : 'text-[#00e676] bg-[#00e676]/10'}`}>
              {statsDiff.open}
            </span>
          </div>
        </div>

        <div className="p-4 bg-[#1a1c26]/65 border border-white/8 backdrop-blur-md rounded-xl flex flex-col justify-between shadow-md">
          <h3 className="text-[9px] font-extrabold uppercase tracking-widest text-[#9da0ac]">Criadas Hoje</h3>
          <div className="flex items-baseline justify-between mt-1 select-none">
            <span className="text-3xl font-extrabold text-[#f8f9fa]">{loading ? '--' : createdTodayCount}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-[#7c4dff] bg-[#7c4dff]/10">
              {statsDiff.created}
            </span>
          </div>
        </div>

        <div className="p-4 bg-[#1a1c26]/65 border border-white/8 backdrop-blur-md rounded-xl flex flex-col justify-between shadow-md">
          <h3 className="text-[9px] font-extrabold uppercase tracking-widest text-[#9da0ac]">Concluídas Hoje</h3>
          <div className="flex items-baseline justify-between mt-1 select-none">
            <span className="text-3xl font-extrabold text-[#f8f9fa]">{loading ? '--' : closedTodayCount}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-[#00e676] bg-[#00e676]/10">
              {statsDiff.closedToday}
            </span>
          </div>
        </div>

        <div className="p-4 bg-[#1a1c26]/65 border border-white/8 backdrop-blur-md rounded-xl flex flex-col justify-between shadow-md">
          <h3 className="text-[9px] font-extrabold uppercase tracking-widest text-[#9da0ac]">Total Concluídas (Período)</h3>
          <div className="flex items-baseline mt-1 select-none">
            <span className="text-3xl font-extrabold text-[#f8f9fa]">{loading ? '--' : periodClosedCount}</span>
          </div>
        </div>

        <div className="p-4 bg-[#1a1c26]/65 border border-white/8 backdrop-blur-md rounded-xl flex flex-col justify-between shadow-md">
          <h3 className="text-[9px] font-extrabold uppercase tracking-widest text-[#9da0ac]">Sem Prazo</h3>
          <div className="flex items-baseline justify-between mt-1 select-none">
            <span className="text-3xl font-extrabold text-[#f8f9fa]">{loading ? '--' : missingDateCount}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${missingDateCount > 2 ? 'text-[#ff5252] bg-[#ff5252]/10' : 'text-[#00e676] bg-[#00e676]/10'}`}>
              {statsDiff.missing}
            </span>
          </div>
        </div>
      </section>

      {/* Demandas Abertas por Tipo Cards (Grid Horizontal) */}
      <section className="mx-6 mt-6 z-10 flex flex-col">
        <h3 className="text-[9px] font-extrabold uppercase tracking-widest text-[#9da0ac] mb-2 leading-none">
          Demandas Abertas por Tipo
        </h3>
        <div className="flex flex-row gap-4 overflow-x-auto pb-1 scrollbar-thin">
          {loading ? (
            <div className="p-4 bg-[#1a1c26]/65 border border-white/8 backdrop-blur-md rounded-xl w-full text-center text-xs text-[#9da0ac]">Carregando...</div>
          ) : activeByType.length === 0 ? (
            <div className="p-4 bg-[#1a1c26]/65 border border-white/8 backdrop-blur-md rounded-xl w-full text-center text-xs text-[#9da0ac]">Nenhuma demanda.</div>
          ) : (
            activeByType.map(([type, count]) => {
              const color = getCategoryColor(type);
              return (
                <div key={type} className="flex-1 min-w-[130px] p-4 bg-[#1a1c26]/65 border border-white/8 backdrop-blur-md rounded-xl flex flex-col items-center justify-center text-center shadow-sm">
                  <div className="text-2xl font-extrabold text-[#f8f9fa]">{count}</div>
                  <div className="text-[9px] font-extrabold uppercase tracking-wider text-[#9da0ac] mt-1.5 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full mr-1.5 inline-block shadow-sm" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}></span>
                    {type}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Demandas Abertas por Etapa Cards (Grid Horizontal) */}
      <section className="mx-6 mt-6 z-10 flex flex-col">
        <h3 className="text-[9px] font-extrabold uppercase tracking-widest text-[#9da0ac] mb-2 leading-none">
          Demandas Abertas por Etapa
        </h3>
        <div className="flex flex-row gap-4 overflow-x-auto pb-1 scrollbar-thin">
          {loading ? (
            <div className="p-4 bg-[#1a1c26]/65 border border-white/8 backdrop-blur-md rounded-xl w-full text-center text-xs text-[#9da0ac]">Carregando...</div>
          ) : activeByStage.length === 0 ? (
            <div className="p-4 bg-[#1a1c26]/65 border border-white/8 backdrop-blur-md rounded-xl w-full text-center text-xs text-[#9da0ac]">Nenhuma etapa de Kanban ativa.</div>
          ) : (
            activeByStage.map(([stage, count]) => {
              const color = getCategoryColor(stage);
              return (
                <div key={stage} className="flex-1 min-w-[150px] p-4 bg-[#1a1c26]/65 border border-white/8 backdrop-blur-md rounded-xl flex flex-col items-center justify-center text-center shadow-sm">
                  <div className="text-2xl font-extrabold text-[#f8f9fa]">{count}</div>
                  <div className="text-[9px] font-extrabold uppercase tracking-wider text-[#9da0ac] mt-1.5 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full mr-1.5 inline-block shadow-sm" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}></span>
                    {stage}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Carrossel de Gráficos (4 Slides: Throughput, Evolution, Avg Hours, Lead Time) */}
      <section className="mx-6 mt-6 mb-12 z-10 flex flex-col">
        <div className="p-5 bg-[#1a1c26]/65 border border-white/8 backdrop-blur-md rounded-xl flex flex-col shadow-md">
          {/* Navegador */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-6">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#f8f9fa]">
                Produtividade & Análise de Fluxo
              </h3>
              <p className="text-[9px] text-[#9da0ac] font-bold mt-0.5">Indicadores de vazão, evolução, horas e lead time</p>
            </div>
            
            <div className="flex space-x-2">
              {[0, 1, 2, 3].map(slideIdx => (
                <button 
                  key={slideIdx}
                  onClick={() => setCurrentSlide(slideIdx)}
                  className={`w-3 h-3 rounded-full transition-all cursor-pointer ${
                    currentSlide === slideIdx 
                      ? 'bg-[#7c4dff] scale-120 shadow-sm shadow-[#7c4dff]' 
                      : 'bg-white/25 hover:bg-white/40'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Viewport dos slides */}
          <div className="relative min-h-[300px]">
            {/* Slide 0: throughputChart */}
            {currentSlide === 0 && (
              <div className="animate-fade-in flex flex-col justify-between h-full">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-0.5">Fluxo Diário (Criadas vs Concluídas)</h4>
                  <p className="text-[9px] text-[#9da0ac] mb-6">Entrada e encerramento de demandas nos últimos 7 dias</p>
                </div>
                <div className="w-full h-60 flex flex-col justify-between">
                  <div className="flex-1 relative flex items-end justify-between border-b border-l border-white/10 pb-2 pl-4">
                    <svg className="absolute inset-0 w-full h-full" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
                      {/* Criadas Path */}
                      <path 
                        d={(() => {
                          const maxVal = Math.max(...throughputChartData.map(d => Math.max(d.created, d.closed, 4)));
                          const pts = throughputChartData.map((d, idx) => {
                            const x = (idx / 6) * 100;
                            const y = 100 - (d.created / maxVal) * 80;
                            return `${x}%,${y}%`;
                          });
                          return pts.length > 0 ? `M ${pts.map(p => `calc(${p.split(',')[0]} + 16px) calc(${p.split(',')[1]} - 8px)`).join(' L ')}` : '';
                        })()}
                        fill="none" 
                        stroke="#40c4ff" 
                        strokeWidth="2.5" 
                      />

                      {/* Concluídas Path */}
                      <path 
                        d={(() => {
                          const maxVal = Math.max(...throughputChartData.map(d => Math.max(d.created, d.closed, 4)));
                          const pts = throughputChartData.map((d, idx) => {
                            const x = (idx / 6) * 100;
                            const y = 100 - (d.closed / maxVal) * 80;
                            return `${x}%,${y}%`;
                          });
                          return pts.length > 0 ? `M ${pts.map(p => `calc(${p.split(',')[0]} + 16px) calc(${p.split(',')[1]} - 8px)`).join(' L ')}` : '';
                        })()}
                        fill="none" 
                        stroke="#00e676" 
                        strokeWidth="2.5" 
                      />
                    </svg>

                    {throughputChartData.map((d, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center z-10 select-none">
                        <div className="flex space-x-1 font-bold text-[9px] mb-2">
                          <span className="text-[#40c4ff]">{d.created}</span>
                          <span className="text-white/20">/</span>
                          <span className="text-[#00e676]">{d.closed}</span>
                        </div>
                        <span className="text-[9px] font-extrabold text-[#9da0ac] tracking-wider mt-1">{d.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex space-x-6 mt-4 justify-center text-[9px] font-extrabold select-none">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#40c4ff] shadow-sm shadow-[#40c4ff]"></span>
                      <span>CRIADAS</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#00e676] shadow-sm shadow-[#00e676]"></span>
                      <span>CONCLUÍDAS</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Slide 1: evolutionChart */}
            {currentSlide === 1 && (
              <div className="animate-fade-in flex flex-col justify-between h-full">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-0.5">Evolução por Tipo de Demanda</h4>
                  <p className="text-[9px] text-[#9da0ac] mb-6">Volume diário de criação por categoria nos últimos 7 dias</p>
                </div>
                <div className="w-full h-60 flex flex-col justify-between">
                  <div className="flex-1 relative flex items-end justify-between border-b border-l border-white/10 pb-2 pl-4">
                    <svg className="absolute inset-0 w-full h-full" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
                      {evolutionChartData.typeNames.map((typeName, typeIdx) => {
                        const colors = ['#7c4dff', '#40c4ff', '#ff5252', '#ffd740'];
                        const color = colors[typeIdx % colors.length];
                        return (
                          <path 
                            key={typeName}
                            d={(() => {
                              const maxVal = Math.max(...evolutionChartData.days.map(d => Math.max(...Object.values(d.types), 3)));
                              const pts = evolutionChartData.days.map((d, idx) => {
                                const count = d.types[typeName] || 0;
                                const x = (idx / 6) * 100;
                                const y = 100 - (count / maxVal) * 80;
                                return `${x}%,${y}%`;
                              });
                              return pts.length > 0 ? `M ${pts.map(p => `calc(${p.split(',')[0]} + 16px) calc(${p.split(',')[1]} - 8px)`).join(' L ')}` : '';
                            })()}
                            fill="none" 
                            stroke={color} 
                            strokeWidth="2" 
                          />
                        );
                      })}
                    </svg>

                    {evolutionChartData.days.map((d, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center z-10 select-none">
                        <div className="text-[9px] font-bold text-neutral-500 mb-2 truncate max-w-[40px] text-center">
                          {Object.values(d.types).reduce((acc, c) => acc + c, 0)}
                        </div>
                        <span className="text-[9px] font-extrabold text-[#9da0ac] tracking-wider mt-1">{d.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1.5 mt-4 justify-center text-[9px] font-extrabold select-none">
                    {evolutionChartData.typeNames.map((typeName, typeIdx) => {
                      const colors = ['#7c4dff', '#40c4ff', '#ff5252', '#ffd740'];
                      const color = colors[typeIdx % colors.length];
                      return (
                        <div key={typeName} className="flex items-center space-x-1.5">
                          <span className="w-1.5 h-1.5 rounded-full shadow-sm" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}></span>
                          <span>{typeName.toUpperCase()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Slide 2: avgHoursChart */}
            {currentSlide === 2 && (
              <div className="animate-fade-in flex flex-col justify-between h-full">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-0.5">Horas Médias apontadas por Categoria</h4>
                  <p className="text-[9px] text-[#9da0ac] mb-6">Média de horas apontadas por tarefa concluída no período</p>
                </div>
                <div className="w-full h-60 flex flex-col justify-between">
                  {avgHoursChartData.length === 0 ? (
                    <div className="text-xs text-neutral-500 py-12 text-center">Dados insuficientes no período.</div>
                  ) : (
                    <div className="flex-1 flex items-end justify-around border-b border-l border-white/10 pb-2 pl-4">
                      {avgHoursChartData.map((d, idx) => {
                        const maxVal = Math.max(...avgHoursChartData.map(item => item.hours), 5);
                        const heightPercent = Math.min(100, Math.max(10, Math.round((d.hours / maxVal) * 85)));
                        const color = getCategoryColor(d.type);
                        return (
                          <div key={idx} className="flex flex-col items-center w-24">
                            <span className="text-[10px] font-bold mb-2 text-white">{d.hours}h</span>
                            <div 
                              className="w-8 rounded-t shadow-md transition-all duration-500"
                              style={{ 
                                height: `${heightPercent}px`,
                                backgroundImage: `linear-gradient(to top, ${color}d0, ${color})`,
                                boxShadow: `0 0 8px ${color}20` 
                              }}
                            />
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#9da0ac] text-center truncate max-w-[80px] mt-2.5" title={d.type}>
                              {d.type}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Slide 3: leadTimeChart */}
            {currentSlide === 3 && (
              <div className="animate-fade-in flex flex-col justify-between h-full">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-0.5">Lead Time Médio por Categoria</h4>
                  <p className="text-[9px] text-[#9da0ac] mb-6">Ciclo de vida médio (dias desde a criação até a conclusão)</p>
                </div>
                <div className="w-full h-60 flex flex-col justify-between">
                  {leadTimeChartData.length === 0 ? (
                    <div className="text-xs text-neutral-500 py-12 text-center">Dados insuficientes no período.</div>
                  ) : (
                    <div className="flex-1 flex flex-col justify-around border-l border-white/10 pl-4 py-2">
                      {leadTimeChartData.map((d, idx) => {
                        const maxVal = Math.max(...leadTimeChartData.map(item => item.days), 5);
                        const widthPercent = Math.min(100, Math.max(10, Math.round((d.days / maxVal) * 85)));
                        const color = getCategoryColor(d.type);
                        return (
                          <div key={idx} className="flex items-center space-x-4">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#9da0ac] w-24 truncate" title={d.type}>
                              {d.type}
                            </span>
                            <div className="flex-1 flex items-center">
                              <div 
                                className="h-3 rounded-r-full shadow-md transition-all duration-500"
                                style={{ 
                                  width: `${widthPercent}%`,
                                  backgroundImage: `linear-gradient(to right, ${color}d0, ${color})`,
                                  boxShadow: `0 0 8px ${color}20`
                                }}
                              />
                              <span className="text-[10px] font-bold ml-2.5 text-white">{d.days} dias</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Modal Alerta P0 Crítico */}
      {isP0ModalOpen && p0Tasks.length > 0 && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative p-6 rounded-2xl border w-[95%] max-w-[650px] shadow-2xl overflow-hidden bg-[#1e0a0a]/85 border-rose-500/40 text-white animate-pulse-border">
            {/* SVG Progress Perimeter */}
            <svg className="p0-progress-svg">
              <rect className="p0-progress-rect" />
            </svg>

            {/* Cabeçalho */}
            <div className="flex items-center justify-between border-b pb-4 mb-4 border-rose-500/20 z-10 relative">
              <span className="px-2.5 py-1.5 rounded bg-rose-500 text-[10px] font-bold uppercase tracking-widest text-white leading-none shadow-md shadow-rose-500/30">
                ALERTA DE ALTA PRIORIDADE: P0 TRAVADAS
              </span>
              <button 
                onClick={() => setIsP0ModalOpen(false)}
                className="btn-close-p0 focus:outline-none"
              >
                &times;
              </button>
            </div>

            {/* Corpo do Modal */}
            <div className="p0-modal-body space-y-4 max-h-[50vh] pr-2 scrollbar-thin z-10 relative">
              <p className="text-[11px] text-neutral-400 font-medium">As seguintes demandas críticas necessitam de atenção operacional urgente e estão travadas na fila ativa:</p>
              
              {p0Tasks.map(task => (
                <div 
                  key={task.id} 
                  className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between hover:bg-white/8 transition-all"
                >
                  <div className="flex flex-col space-y-1 w-[80%]">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono font-extrabold text-rose-500">#{task.id}</span>
                      <span className="text-[8px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/10 text-white/80">
                        {task.client_name}
                      </span>
                    </div>
                    <span className="text-[11px] font-extrabold uppercase leading-snug line-clamp-1">{task.title}</span>
                    <span className="text-[9px] text-[#9da0ac] uppercase font-bold">{task.status || 'Sem Etapa'}</span>
                  </div>
                  
                  <a 
                    href={`https://runrun.it/pt-BR/tasks/${task.id}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="p-2 rounded bg-rose-500 hover:bg-rose-400 text-white transition-colors active:scale-95 flex items-center justify-center cursor-pointer shadow-md shadow-rose-500/20"
                    title="Visualizar no Runrun.it"
                  >
                    <span className="material-icons text-base">open_in_new</span>
                  </a>
                </div>
              ))}
            </div>

            {/* Rodapé */}
            <div className="mt-6 pt-4 border-t border-rose-500/20 flex justify-end z-10 relative">
              <button 
                onClick={() => setIsP0ModalOpen(false)}
                className="px-5 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-400 font-extrabold text-xs uppercase tracking-wider text-white transition-all active:scale-95 cursor-pointer shadow-lg shadow-rose-500/20"
              >
                Ciente e Focado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
