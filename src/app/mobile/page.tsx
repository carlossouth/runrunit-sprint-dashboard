"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { parseEstimate, formatTime, getRoleAssignments } from '../page';

export default function MobileDashboard() {
  const router = useRouter();
  
  // States
  const [sprintId, setSprintId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [activeTab, setActiveTab] = useState<'all' | 'back' | 'front' | 'mob' | 'qa'>('all');
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  // 1. Detecção inversa (Desktop ➔ Rota Raiz)
  useEffect(() => {
    const isMobileDevice = () => {
      if (typeof window === 'undefined') return false;
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileUA = /android|iphone|ipad|ipod|iemobile|opera mini/i.test(userAgent);
      const isSmallScreen = window.innerWidth < 768;
      return isMobileUA || isSmallScreen;
    };

    if (!isMobileDevice()) {
      router.push('/');
    }
  }, [router]);

  // 2. Carrega configurações e dados do localStorage no mount
  useEffect(() => {
    // Sincroniza Tema
    const savedTheme = localStorage.getItem('sprint-dashboard-theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
    }

    // Busca dados se houver Sprint ID salva
    const savedSprint = localStorage.getItem('sprint-dashboard-id');
    if (savedSprint) {
      setSprintId(savedSprint);
      fetchSprintData(savedSprint);
    }
  }, []);

  // 3. Alternar tema sincronizado com localStorage
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('sprint-dashboard-theme', nextTheme);
  };

  // 4. Busca dados da API real
  const fetchSprintData = async (id: string) => {
    const targetId = id.trim();
    if (!targetId) return;

    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`/api/sprint/${targetId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao buscar dados da Sprint');
      
      setData(json.data || []);
      localStorage.setItem('sprint-dashboard-id', targetId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Executa busca no formulário móvel
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSprintData(sprintId);
  };

  // 5. Cálculos de KPIs em Tempo Real (Lógica IDÊNTICA ao Desktop)
  let totalPrev = 0;
  let totalExec = 0;
  let completedPrev = 0;
  let completedTasks = 0;
  let overLimitCount = {
    back: 0,
    front: 0,
    mobile: 0,
    qa: 0
  };

  data.forEach(task => {
    const backE = parseEstimate(task.estimates.back);
    const frontE = parseEstimate(task.estimates.front);
    const mobileE = parseEstimate(task.estimates.mobile);
    const qaE = parseEstimate(task.estimates.qa);
    
    const taskPrev = backE + frontE + mobileE + qaE;
    totalPrev += taskPrev;

    const stageNum = parseInt(task.status, 10);
    const isCompletedStage = !isNaN(stageNum) && stageNum >= 15;
    if (isCompletedStage) {
      completedPrev += taskPrev;
      completedTasks++;
    }

    const backAssigs = getRoleAssignments(task.assignments, ['back', 'dev'], ['qa', 'test', 'front', 'mobile']);
    const frontAssigs = getRoleAssignments(task.assignments, ['front']);
    const mobileAssigs = getRoleAssignments(task.assignments, ['mobile']);
    const qaAssigs = getRoleAssignments(task.assignments, ['qa', 'test']);

    const backExec = backAssigs.reduce((acc, a) => acc + (a.time_worked_seconds || 0), 0);
    const frontExec = frontAssigs.reduce((acc, a) => acc + (a.time_worked_seconds || 0), 0);
    const mobileExec = mobileAssigs.reduce((acc, a) => acc + (a.time_worked_seconds || 0), 0);
    const qaExec = qaAssigs.reduce((acc, a) => acc + (a.time_worked_seconds || 0), 0);

    const taskExec = backExec + frontExec + mobileExec + qaExec;
    totalExec += taskExec;

    if (!isCompletedStage) {
      if (backExec > backE && backE > 0) overLimitCount.back++;
      if (frontExec > frontE && frontE > 0) overLimitCount.front++;
      if (mobileExec > mobileE && mobileE > 0) overLimitCount.mobile++;
      if (qaExec > qaE && qaE > 0) overLimitCount.qa++;
    }
  });

  let progressPercent = 0;
  if (totalPrev > 0) {
    progressPercent = Math.min(100, Math.round((completedPrev / totalPrev) * 100));
  } else if (data.length > 0) {
    progressPercent = Math.round((completedTasks / data.length) * 100);
  }

  const totalAlerts = overLimitCount.back + overLimitCount.front + overLimitCount.mobile + overLimitCount.qa;

  // 6. Helper para verificar se a demanda pertence a uma disciplina (Filtro das Abas)
  const hasDiscipline = (task: any, discipline: string): boolean => {
    if (discipline === 'all') return true;
    
    if (discipline === 'back') {
      const backE = parseEstimate(task.estimates.back);
      const backAssigs = getRoleAssignments(task.assignments, ['back', 'dev'], ['qa', 'test', 'front', 'mobile']);
      const backExec = backAssigs.reduce((acc, a) => acc + (a.time_worked_seconds || 0), 0);
      return backE > 0 || backExec > 0;
    }
    
    if (discipline === 'front') {
      const frontE = parseEstimate(task.estimates.front);
      const frontAssigs = getRoleAssignments(task.assignments, ['front']);
      const frontExec = frontAssigs.reduce((acc, a) => acc + (a.time_worked_seconds || 0), 0);
      return frontE > 0 || frontExec > 0;
    }
    
    if (discipline === 'mob') {
      const mobileE = parseEstimate(task.estimates.mobile);
      const mobileAssigs = getRoleAssignments(task.assignments, ['mobile']);
      const mobileExec = mobileAssigs.reduce((acc, a) => acc + (a.time_worked_seconds || 0), 0);
      return mobileE > 0 || mobileExec > 0;
    }
    
    if (discipline === 'qa') {
      const qaE = parseEstimate(task.estimates.qa);
      const qaAssigs = getRoleAssignments(task.assignments, ['qa', 'test']);
      const qaExec = qaAssigs.reduce((acc, a) => acc + (a.time_worked_seconds || 0), 0);
      return qaE > 0 || qaExec > 0;
    }
    
    return false;
  };

  // Alterna expansão de card de forma limpa (estilo sanfona)
  const handleCardToggle = (taskId: number) => {
    setExpandedTaskId(prevId => (prevId === taskId ? null : taskId));
  };

  const filteredTasks = data
    .filter(task => hasDiscipline(task, activeTab))
    .sort((a, b) => (a.status || '').localeCompare(b.status || ''));

  return (
    <div className={`min-h-screen w-full flex flex-col transition-colors duration-300 ${theme === 'dark' ? 'dark bg-surface-950 text-neutral-100' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* App Header (Identidade Visual South) */}
      <header className="bg-brand-900 text-white flex-none h-12 flex items-center justify-between px-4 border-b border-white/10 select-none sticky top-0 z-40">
        <div className="flex items-center space-x-2.5">
          <div onClick={toggleTheme} className="cursor-pointer hover:opacity-85 active:scale-95 transition-all flex items-center" title="Clique para alternar o tema">
            <span className="font-extrabold text-[10px] tracking-wider uppercase bg-white/15 px-2 py-0.5 rounded-md">SOUTH</span>
          </div>
          <div className="h-3.5 w-px bg-white/20"></div>
          <h1 className="font-sans font-semibold text-[10px] tracking-widest uppercase">Sprint Dash</h1>
        </div>
        
        {/* Theme button */}
        <button onClick={toggleTheme} className="w-7 h-7 rounded-full bg-black/20 hover:bg-black/35 active:scale-90 transition-all flex items-center justify-center text-xs">
          <span>{theme === 'light' ? '🌙' : '☀️'}</span>
        </button>
      </header>

      {/* Top Tabs (Navegação de disciplinas) */}
      <div className="flex-none border-b select-none transition-colors duration-300 bg-white dark:bg-[#121214] border-gray-100 dark:border-neutral-900/60 sticky top-12 z-30 shadow-sm shadow-slate-100/10">
        <div className="flex space-x-2 overflow-x-auto scrollbar-hide py-2.5 px-4" id="tabs-container">
          <button 
            onClick={() => setActiveTab('all')} 
            className={`px-3.5 py-1.5 border rounded-full text-[10.5px] font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'all' 
                ? 'bg-gradient-to-r from-accent-500 to-accent-600 text-white border-transparent shadow-sm shadow-accent-500/20' 
                : 'border-slate-100 dark:border-neutral-800/80 text-slate-500 dark:text-neutral-400 bg-transparent'
            }`}
          >
            Todas
          </button>
          <button 
            onClick={() => setActiveTab('back')} 
            className={`px-3.5 py-1.5 border rounded-full text-[10.5px] font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'back' 
                ? 'bg-gradient-to-r from-accent-500 to-accent-600 text-white border-transparent shadow-sm shadow-accent-500/20' 
                : 'border-slate-100 dark:border-neutral-800/80 text-slate-500 dark:text-neutral-400 bg-transparent'
            }`}
          >
            Back-end
          </button>
          <button 
            onClick={() => setActiveTab('front')} 
            className={`px-3.5 py-1.5 border rounded-full text-[10.5px] font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'front' 
                ? 'bg-gradient-to-r from-accent-500 to-accent-600 text-white border-transparent shadow-sm shadow-accent-500/20' 
                : 'border-slate-100 dark:border-neutral-800/80 text-slate-500 dark:text-neutral-400 bg-transparent'
            }`}
          >
            Front-end
          </button>
          <button 
            onClick={() => setActiveTab('mob')} 
            className={`px-3.5 py-1.5 border rounded-full text-[10.5px] font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'mob' 
                ? 'bg-gradient-to-r from-accent-500 to-accent-600 text-white border-transparent shadow-sm shadow-accent-500/20' 
                : 'border-slate-100 dark:border-neutral-800/80 text-slate-500 dark:text-neutral-400 bg-transparent'
            }`}
          >
            Mobile
          </button>
          <button 
            onClick={() => setActiveTab('qa')} 
            className={`px-3.5 py-1.5 border rounded-full text-[10.5px] font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
              activeTab === 'qa' 
                ? 'bg-gradient-to-r from-accent-500 to-accent-600 text-white border-transparent shadow-sm shadow-accent-500/20' 
                : 'border-slate-100 dark:border-neutral-800/80 text-slate-500 dark:text-neutral-400 bg-transparent'
            }`}
          >
            QA & Teste
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-grow p-4 pb-24 space-y-4">
        
        {/* Formulário de Busca Móvel (Caso não haja dados ou para trocar a sprint do mobile) */}
        <div className="w-full">
          <form onSubmit={handleSearchSubmit} className="flex space-x-2">
            <input 
              type="text" 
              placeholder="Pesquisar Sprint ID..." 
              value={sprintId}
              onChange={(e) => setSprintId(e.target.value)}
              className={`flex-grow text-xs font-bold px-3.5 py-2.5 rounded-xl border outline-none transition-all ${
                theme === 'dark' 
                  ? 'bg-[#121214] border-neutral-800 text-white focus:border-accent-500' 
                  : 'bg-white border-slate-200 text-slate-800 focus:border-accent-500'
              }`}
            />
            <button 
              type="submit" 
              disabled={loading}
              className={`bg-accent-500 hover:bg-accent-400 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center shadow-md active:scale-95 ${loading ? 'opacity-70' : ''}`}
            >
              {loading ? '...' : 'Buscar'}
            </button>
          </form>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-medium leading-relaxed">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="animate-spin rounded-full h-7 w-7 border-2 border-accent-500 border-t-transparent"></div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Carregando Sprint...</span>
          </div>
        )}

        {!loading && data.length === 0 && !error && (
          <div className="text-center py-12 px-6">
            <span className="text-3xl block mb-2">🔍</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Nenhuma Sprint selecionada</h3>
            <p className="text-[11px] text-slate-400 mt-1">Insira um Sprint ID válido no campo acima para visualizar os indicadores em tempo real.</p>
          </div>
        )}

        {!loading && data.length > 0 && (
          <>
            {/* KPI Ribbon Mobile Cards */}
            <div className="grid grid-cols-2 gap-3 select-none">
              <div className="p-3 border rounded-2xl flex flex-col justify-between transition-all bg-white dark:bg-[#121214] border-gray-100 dark:border-neutral-900/60 shadow-sm shadow-slate-100/50 dark:shadow-none">
                <span className="text-[9.5px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Progresso</span>
                <span className="font-bold text-emerald-500 dark:text-emerald-400 text-[13px] tracking-tight mt-1.5">{progressPercent}% Concluído</span>
              </div>
              <div className="p-3 border rounded-2xl flex flex-col justify-between transition-all bg-white dark:bg-[#121214] border-gray-100 dark:border-neutral-900/60 shadow-sm shadow-slate-100/50 dark:shadow-none">
                <span className="text-[9.5px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">Atenção</span>
                <span className={`font-bold text-[13px] tracking-tight mt-1.5 flex items-center ${totalAlerts > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400'}`}>
                  {totalAlerts > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 animate-pulse"></span>}
                  {totalAlerts} {totalAlerts === 1 ? 'Estouro Crítico' : 'Estouros Críticos'}
                </span>
              </div>
            </div>

            {/* List of filtered demands */}
            <div className="space-y-3">
              {filteredTasks.map(task => {
                const backE = parseEstimate(task.estimates.back);
                const frontE = parseEstimate(task.estimates.front);
                const mobileE = parseEstimate(task.estimates.mobile);
                const qaE = parseEstimate(task.estimates.qa);

                const backAssigs = getRoleAssignments(task.assignments, ['back', 'dev'], ['qa', 'test', 'front', 'mobile']);
                const frontAssigs = getRoleAssignments(task.assignments, ['front']);
                const mobileAssigs = getRoleAssignments(task.assignments, ['mobile']);
                const qaAssigs = getRoleAssignments(task.assignments, ['qa', 'test']);

                const backExec = backAssigs.reduce((acc, a) => acc + (a.time_worked_seconds || 0), 0);
                const frontExec = frontAssigs.reduce((acc, a) => acc + (a.time_worked_seconds || 0), 0);
                const mobileExec = mobileAssigs.reduce((acc, a) => acc + (a.time_worked_seconds || 0), 0);
                const qaExec = qaAssigs.reduce((acc, a) => acc + (a.time_worked_seconds || 0), 0);

                const isWorking = task.is_working_on === true;
                const isExpanded = expandedTaskId === task.id;

                // Ordena alocados para renderizar na seção expandida
                const allAssignees = [...backAssigs, ...frontAssigs, ...mobileAssigs, ...qaAssigs];

                return (
                  <div 
                    key={task.id} 
                    onClick={() => handleCardToggle(task.id)}
                    className={`border rounded-2xl p-4 space-y-3 relative cursor-pointer transition-all bg-white dark:bg-[#121214] shadow-sm hover:shadow-md dark:shadow-none ${
                      isExpanded 
                        ? 'border-accent-500 dark:border-accent-500/50 ring-1 ring-accent-500/20' 
                        : 'border-gray-100 dark:border-neutral-900/60'
                    }`}
                  >
                    {/* Card Top Info */}
                    <div className="flex items-start justify-between min-w-0">
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span className="text-[11px] font-bold text-accent-500 tracking-wide">#{task.id}</span>
                          
                          {isWorking && (
                            <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/15 select-none">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-done opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-status-done"></span>
                              </span>
                              <span className="text-[8.5px] font-bold text-status-done uppercase tracking-wider leading-none">Em execução</span>
                            </span>
                          )}
                        </div>
                        
                        <h3 className="font-semibold text-[13px] leading-snug mt-1.5 text-slate-800 dark:text-neutral-100 tracking-tight truncate" title={task.title}>
                          {task.title}
                        </h3>
                      </div>
                      
                      {/* Etapa Badge */}
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 text-slate-500 bg-slate-100 dark:text-neutral-400 dark:bg-neutral-800/80 max-w-[90px] truncate" title={task.status}>
                        {task.status || 'Sem Etapa'}
                      </span>
                    </div>

                    {/* Progress Lines inside Card */}
                    <div className="space-y-3 border-t pt-3 border-slate-50 dark:border-neutral-800/40 select-none">
                      {/* Renderiza apenas se houver previsão ou execução na área para manter o card limpo */}
                      {(backE > 0 || backExec > 0) && (
                        <DisciplineProgressBar 
                          title="Back-end" 
                          exec={backExec} 
                          prev={backE} 
                          theme={theme}
                          stageCompleted={parseInt(task.status, 10) >= 15}
                        />
                      )}
                      {(frontE > 0 || frontExec > 0) && (
                        <DisciplineProgressBar 
                          title="Front-end" 
                          exec={frontExec} 
                          prev={frontE} 
                          theme={theme}
                          stageCompleted={parseInt(task.status, 10) >= 15}
                        />
                      )}
                      {(mobileE > 0 || mobileExec > 0) && (
                        <DisciplineProgressBar 
                          title="Mobile" 
                          exec={mobileExec} 
                          prev={mobileE} 
                          theme={theme}
                          stageCompleted={parseInt(task.status, 10) >= 15}
                        />
                      )}
                      {(qaE > 0 || qaExec > 0) && (
                        <DisciplineProgressBar 
                          title="QA / Teste" 
                          exec={qaExec} 
                          prev={qaE} 
                          theme={theme}
                          stageCompleted={parseInt(task.status, 10) >= 15}
                        />
                      )}
                    </div>

                    {/* Expanded details */}
                    <div 
                      className="hidden-info overflow-hidden transition-all duration-300 space-y-3"
                      style={{ 
                        maxHeight: isExpanded ? '600px' : '0px', 
                        opacity: isExpanded ? 1 : 0,
                        marginTop: isExpanded ? '12px' : '0px'
                      }}
                    >
                      <div className="h-[1px] bg-slate-50 dark:bg-neutral-800/40"></div>
                      <span className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500 block mb-1">Profissionais Alocados</span>
                      
                      {allAssignees.length === 0 ? (
                        <p className="text-[10px] text-slate-400 dark:text-neutral-500">Nenhum profissional apontou horas nesta demanda.</p>
                      ) : (
                        <div className="space-y-3">
                          {allAssignees.map((assignee, idx) => (
                            <div key={idx} className="flex items-center space-x-3">
                              <div className="relative shrink-0 select-none">
                                <img 
                                  src={assignee.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(assignee.assignee_name)}&background=e2e8f0`} 
                                  className={`w-8 h-8 rounded-full border shadow-sm ${
                                    assignee.is_working_on 
                                      ? 'border-emerald-500/40' 
                                      : 'border-slate-100 dark:border-neutral-800'
                                  }`} 
                                  alt={assignee.assignee_name} 
                                />
                                {assignee.is_working_on && (
                                  <span className="absolute bottom-0 right-0 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-done opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-status-done"></span>
                                  </span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-1.5">
                                  <span className={`text-[12px] font-semibold truncate ${assignee.is_working_on ? 'text-emerald-500' : 'text-slate-700 dark:text-neutral-300'}`}>
                                    {assignee.assignee_name}
                                  </span>
                                  {assignee.is_working_on && (
                                    <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-status-done tracking-wider select-none">
                                      PLAY
                                    </span>
                                  )}
                                </div>
                                <span className="text-[9.5px] uppercase text-slate-400 dark:text-neutral-500 tracking-wider truncate block">
                                  {assignee.role || 'Sem Função'}
                                </span>
                              </div>
                              <span className={`text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full ${
                                assignee.is_working_on
                                  ? 'text-emerald-500 bg-emerald-500/5'
                                  : 'text-slate-600 dark:text-neutral-400 bg-slate-100 dark:bg-neutral-800/80'
                              }`}>
                                {formatTime(assignee.time_worked_seconds || 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Opcional: Link direto para abrir no Runrun.it */}
                      <div className="pt-2">
                        <a 
                          href={`https://runrun.it/pt-BR/tasks/${task.id}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="flex items-center justify-center w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900/60 dark:hover:bg-neutral-800 text-[11px] font-semibold text-accent-500 rounded-xl transition-all"
                        >
                          Ver no Runrun.it ↗
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

      </main>

      {/* Footer Tabbar Mobile */}
      <footer className="fixed bottom-0 left-0 right-0 h-14 border-t flex items-center justify-around select-none z-45 px-4 bg-white/90 dark:bg-[#121214]/95 backdrop-blur-md border-gray-100 dark:border-neutral-900/60">
        <button onClick={() => router.push('/')} className="flex flex-col items-center justify-center w-full h-full text-slate-400 dark:text-neutral-500 hover:text-accent-500 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
          <span className="text-[9px] font-bold uppercase tracking-widest mt-1">Desktop</span>
        </button>
        <button className="flex flex-col items-center justify-center w-full h-full text-accent-500">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg>
          <span className="text-[9px] font-bold uppercase tracking-widest mt-1">Sprint</span>
        </button>
      </footer>
    </div>
  );
}

// Subcomponente de barra de progresso móvel
interface DisciplineProgressProps {
  title: string;
  exec: number;
  prev: number;
  theme: 'light' | 'dark';
  stageCompleted: boolean;
}

function DisciplineProgressBar({ title, exec, prev, theme, stageCompleted }: DisciplineProgressProps) {
  const isOver = exec > prev && prev > 0;
  const noEstimateButExec = prev === 0 && exec > 0;
  const progress = prev > 0 ? Math.min(100, (exec / prev) * 100) : (exec > 0 ? 100 : 0);

  let labelText = '';
  let colorClasses = '';
  let barGradient = 'from-accent-500 to-sky-400';

  if (stageCompleted) {
    labelText = 'FINALIZADO';
    colorClasses = 'text-status-done';
    barGradient = 'from-emerald-500 to-emerald-400';
  } else if (isOver) {
    labelText = '[ESTOURO CRÍTICO]';
    colorClasses = 'text-rose-500 dark:text-rose-400';
    barGradient = 'from-rose-500 to-red-600';
  } else if (noEstimateButExec) {
    labelText = '[VERIFICAR ESTIMATIVA]';
    colorClasses = 'text-amber-500 dark:text-amber-400';
    barGradient = 'from-amber-500 to-yellow-400';
  } else if (progress === 100) {
    labelText = '[COMPLETO]';
    colorClasses = 'text-status-done';
    barGradient = 'from-emerald-500 to-emerald-400';
  } else if (progress > 80) {
    labelText = '[RISCO IMINENTE]';
    colorClasses = 'text-orange-500 dark:text-orange-400';
    barGradient = 'from-orange-500 to-amber-500';
  } else if (progress === 0) {
    labelText = '[Aguardando]';
    colorClasses = 'text-slate-400 dark:text-neutral-500';
    barGradient = 'from-slate-300 to-slate-200 dark:from-neutral-700 dark:to-neutral-800';
  } else {
    labelText = '[Em Andamento]';
    colorClasses = 'text-accent-500 dark:text-accent-400';
  }

  return (
    <div className="space-y-1 text-[9.5px]">
      <div className="flex justify-between font-semibold">
        <span className={`${colorClasses} uppercase tracking-wider`}>
          {title} <span className="text-[8.5px] font-normal lowercase">{labelText}</span>
        </span>
        <span className={`font-mono text-[11px] ${isOver && !stageCompleted ? 'text-rose-500 font-semibold' : 'text-slate-600 dark:text-neutral-300 font-medium'}`}>
          {formatTime(exec)} <span className="text-slate-400 font-normal">/ {formatTime(prev)}</span>
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-neutral-800/80">
        <div className={`bg-gradient-to-r ${barGradient} h-full rounded-full transition-all duration-500`} style={{ width: `${progress}%` }}></div>
      </div>
    </div>
  );
}
