"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

// Helper to convert Runrun.it "HH:MM" or seconds to total SECONDS
export function parseEstimate(val: string | number | null): number {
  if (!val) return 0;
  if (typeof val === 'number') {
    return val; // assumed seconds
  }
  if (val.includes(':')) {
    const parts = val.split(':').map(Number);
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    const s = parts[2] || 0;
    return (h * 3600) + (m * 60) + s;
  }
  const numeric = parseInt(val.replace(/\D/g, ''), 10);
  return isNaN(numeric) ? 0 : numeric * 3600;
}

// Format seconds into HH:MM:SS
export function formatTime(totalSeconds: number): string {
  if (!totalSeconds || isNaN(totalSeconds)) return "00:00:00";
  const isNegative = totalSeconds < 0;
  const absSeconds = Math.abs(totalSeconds);
  const h = Math.floor(absSeconds / 3600);
  const m = Math.floor((absSeconds % 3600) / 60);
  const s = Math.floor(absSeconds % 60);
  const sign = isNegative ? "-" : "";
  return `${sign}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Filter assignments by role keywords
export function getRoleAssignments(assignments: any[], roleKeywords: string[], excludeKeywords: string[] = []) {
  return assignments.filter(a => {
    const r = a.role?.toLowerCase() || '';
    const hasRole = roleKeywords.some(kw => r.includes(kw));
    const hasExclude = excludeKeywords.some(kw => r.includes(kw));
    return hasRole && !hasExclude;
  });
}

export default function Dashboard() {
  const router = useRouter();
  const [sprintId, setSprintId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Redirecionamento inteligente para Mobile
  useEffect(() => {
    const isMobileDevice = () => {
      if (typeof window === 'undefined') return false;
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileUA = /android|iphone|ipad|ipod|iemobile|opera mini/i.test(userAgent);
      const isSmallScreen = window.innerWidth < 768;
      return isMobileUA || isSmallScreen;
    };

    if (isMobileDevice()) {
      router.push('/mobile');
    }
  }, [router]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('sprint-dashboard-theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
    }

    // Carrega historico no mount
    const savedHistory = localStorage.getItem('sprint-dashboard-history');
    if (savedHistory) {
      setSearchHistory(JSON.parse(savedHistory));
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('sprint-dashboard-theme', nextTheme);
  };

  const clearHistory = () => {
    localStorage.removeItem('sprint-dashboard-history');
    setSearchHistory([]);
  };

  // Optional auto-fetch on mount using persisted sprint ID
  useEffect(() => {
    const savedSprint = localStorage.getItem('sprint-dashboard-id');
    if (savedSprint) {
      setSprintId(savedSprint);
      handleSearch(undefined, savedSprint);
    }
  }, []);

  const handleSearch = async (e?: React.FormEvent, customId?: string) => {
    if (e) e.preventDefault();
    const idToSearch = (customId || sprintId).trim();
    if (!idToSearch) return;

    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`/api/sprint/${idToSearch}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro ao buscar sprint');
      
      setData(json.data || []);
      
      // Salva no localStorage e gerencia historico
      localStorage.setItem('sprint-dashboard-id', idToSearch);
      
      const saved = localStorage.getItem('sprint-dashboard-history');
      let history: string[] = saved ? JSON.parse(saved) : [];
      history = history.filter(h => h !== idToSearch);
      history.unshift(idToSearch);
      history = history.slice(0, 5);
      localStorage.setItem('sprint-dashboard-history', JSON.stringify(history));
      setSearchHistory(history);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // KPI Calculations (in seconds)
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

  let typeCounts: Record<string, number> = {};

  let breakdown = {
    back: { prev: 0, exec: 0 },
    front: { prev: 0, exec: 0 },
    mobile: { prev: 0, exec: 0 },
    qa: { prev: 0, exec: 0 },
  };

  data.forEach(task => {
    // Agrupa e conta por tipo de demanda
    const taskType = task.type || 'Sem tipo';
    typeCounts[taskType] = (typeCounts[taskType] || 0) + 1;

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

    breakdown.back.prev += backE;
    breakdown.front.prev += frontE;
    breakdown.mobile.prev += mobileE;
    breakdown.qa.prev += qaE;

    let taskExec = 0;

    const backAssigs = getRoleAssignments(task.assignments, ['back', 'dev'], ['qa', 'test', 'front', 'mobile']);
    const frontAssigs = getRoleAssignments(task.assignments, ['front']);
    const mobileAssigs = getRoleAssignments(task.assignments, ['mobile']);
    const qaAssigs = getRoleAssignments(task.assignments, ['qa', 'test']);

    const backExec = backAssigs.reduce((acc, a) => acc + (a.time_worked_seconds || 0), 0);
    const frontExec = frontAssigs.reduce((acc, a) => acc + (a.time_worked_seconds || 0), 0);
    const mobileExec = mobileAssigs.reduce((acc, a) => acc + (a.time_worked_seconds || 0), 0);
    const qaExec = qaAssigs.reduce((acc, a) => acc + (a.time_worked_seconds || 0), 0);

    breakdown.back.exec += backExec;
    breakdown.front.exec += frontExec;
    breakdown.mobile.exec += mobileExec;
    breakdown.qa.exec += qaExec;

    taskExec += backExec + frontExec + mobileExec + qaExec;

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
    // Fallback caso as demandas não tenham tempo estimado (conta pela quantidade de demandas)
    progressPercent = Math.round((completedTasks / data.length) * 100);
  }

  // Ordena os tipos de demandas por quantidade decrescente
  const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className={`h-screen flex flex-col antialiased overflow-hidden ${theme === 'dark' ? 'bg-[#0a0a0c] text-neutral-100' : 'bg-surface-50 text-gray-800'}`}>
      <header className="bg-brand-900 text-white flex-none h-14 flex items-center justify-between px-6 border-b border-white/10" data-testid="top-header">
        {/* Lado Esquerdo: Logo + Título */}
        <div className="flex items-center space-x-6">
          <div className="cursor-pointer hover:opacity-80 active:scale-95 transition-all flex items-center select-none" onClick={toggleTheme} title="Clique para alternar o tema (Claro / Escuro)">
            <Image 
              src="/assets/logomarca-branca-south-tecnologia.png" 
              alt="South Tecnologia Logo" 
              width={120} 
              height={24} 
              className="h-6 w-auto"
              priority
            />
          </div>
          <div className="h-5 w-px bg-white/20"></div>
          
          <h1 className="font-sans font-extrabold text-sm tracking-widest text-white uppercase select-none">
            Sprint Dashboard
          </h1>
        </div>

        {/* Lado Direito: Campo de Busca com Historico Dropdown */}
        <div className="flex items-center relative" onBlur={(e) => {
          // Fecha o historico apenas se o foco foi para um elemento fora desta div container
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setShowHistory(false);
          }
        }}>
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
            setShowHistory(false);
          }} className="flex items-center space-x-2">
            <div className="relative flex items-center bg-black/20 rounded border border-white/20 focus-within:border-accent-500 focus-within:bg-black/40 transition-all duration-300">
              <div className="pl-2 pr-1 text-white/50">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
              <input 
                type="text" 
                data-testid="search-sprint-input" 
                aria-label="Pesquisar ID da Sprint" 
                placeholder="PESQUISAR SPRINT ID..." 
                value={sprintId}
                onChange={(e) => setSprintId(e.target.value)}
                onFocus={() => setShowHistory(true)}
                className="bg-transparent border-none outline-none text-xs font-bold text-white placeholder-white/50 py-1.5 pr-2 w-32 focus:w-48 transition-all duration-300 uppercase"
              />
              
              {/* Dropdown de Historico */}
              {showHistory && searchHistory.length > 0 && (
                <div className={`absolute top-full right-0 mt-2 w-56 shadow-2xl rounded border py-2 z-50 text-[10px] backdrop-blur-md ${theme === 'dark' ? 'bg-[#121214]/95 border-neutral-800 text-neutral-300' : 'bg-white/95 border-gray-200 text-gray-700'}`}>
                  <div className={`px-3 py-1 font-bold text-[8px] uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-500' : 'text-gray-400'}`}>
                    Pesquisas Recentes
                  </div>
                  <div className="mt-1 max-h-40 overflow-y-auto">
                    {searchHistory.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSprintId(item);
                          handleSearch(undefined, item);
                          setShowHistory(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 font-bold transition-colors flex items-center justify-between group ${theme === 'dark' ? 'hover:bg-neutral-800/80 hover:text-white' : 'hover:bg-gray-100 hover:text-brand-900'}`}
                      >
                        <span className="truncate">{item}</span>
                        <span className={`text-[7px] font-extrabold opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider ${theme === 'dark' ? 'text-accent-400' : 'text-accent-500'}`}>
                          Buscar ↗
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className={`border-t mt-1.5 pt-1.5 px-3 flex justify-between items-center ${theme === 'dark' ? 'border-neutral-800' : 'border-gray-100'}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault(); // Evita perder foco antes de computar clique
                        clearHistory();
                      }}
                      className="text-[8px] font-extrabold text-rose-500 hover:text-rose-400 transition-colors uppercase tracking-widest"
                    >
                      Limpar histórico
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className={`bg-accent-500 hover:bg-accent-400 text-white text-xs font-bold py-1.5 px-3 rounded transition-colors flex items-center uppercase ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading && (
                <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {loading ? 'Buscando...' : 'Pesquisar'}
            </button>
          </form>
        </div>
      </header>

      <div className={`flex-none h-12 flex items-center px-6 text-sm relative z-30 shadow-sm transition-colors duration-300 ${theme === 'dark' ? 'bg-[#121214] border-b border-neutral-800/80 text-neutral-200' : 'bg-white border-b border-gray-200 text-gray-800'}`} data-testid="kpi-ribbon">
        <div className="flex items-center space-x-8">
          
          <div className="relative group cursor-pointer">
            <div className="flex items-center">
              <span className={`mr-2 text-xs uppercase font-bold tracking-wider ${theme === 'dark' ? 'text-neutral-400' : 'text-gray-500'}`}>Horas Totais:</span>
              <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-brand-900'}`} data-testid="kpi-total-hours">
                <span className={`text-[10px] mr-1 uppercase ${theme === 'dark' ? 'text-neutral-400' : 'text-gray-500'}`}>Exec:</span> {formatTime(totalExec)} <span className="text-gray-400 font-normal mx-1">/</span> <span className="text-[10px] text-gray-400 mr-1 uppercase">Prev:</span> <span className={`font-normal ${theme === 'dark' ? 'text-neutral-300' : 'text-gray-500'}`}>{formatTime(totalPrev)}</span> <span className="text-gray-400 font-normal mx-1">/</span> <span className="text-[10px] text-gray-400 mr-1 uppercase">Dif:</span> <span className={totalExec - totalPrev > 0 ? 'text-rose-500' : (totalExec - totalPrev < 0 ? 'text-emerald-500' : '')}>{totalExec - totalPrev > 0 ? `+${formatTime(totalExec - totalPrev)}` : formatTime(totalExec - totalPrev)}</span>
              </span>
            </div>
            <div className={`absolute top-full left-0 mt-2 w-80 shadow-lg border rounded-md p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 ${theme === 'dark' ? 'bg-[#1a1a1f] border-neutral-800 text-neutral-300' : 'bg-white border-gray-200 text-gray-600'}`}>
              <h3 className={`text-xs font-bold mb-2 border-b pb-1 ${theme === 'dark' ? 'text-white border-neutral-800' : 'text-brand-900 border-gray-100'}`}>Distribuição de Horas</h3>
              <table className="w-full text-[10px] font-mono text-left border-collapse">
                <thead>
                  <tr className={`border-b text-[8px] uppercase tracking-wider ${theme === 'dark' ? 'border-neutral-800 text-neutral-500' : 'border-gray-100 text-gray-400'}`}>
                    <th className="pb-1.5 font-bold">Área</th>
                    <th className="pb-1.5 font-bold text-right">Exec</th>
                    <th className="pb-1.5 font-bold text-right">Prev</th>
                    <th className="pb-1.5 font-bold text-right">Dif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-transparent">
                  {Object.entries(breakdown).map(([key, value]) => {
                    const diff = value.exec - value.prev;
                    const diffColor = diff > 0 && value.prev > 0 ? 'text-rose-500 font-bold' : (diff < 0 ? 'text-emerald-500' : '');
                    const label = key === 'back' ? 'BACK-END' : key === 'front' ? 'FRONT-END' : key === 'mobile' ? 'MOBILE' : 'QA/TESTE';
                    return (
                      <tr key={key} className={`${theme === 'dark' ? 'hover:bg-neutral-800/40' : 'hover:bg-gray-50'}`}>
                        <td className={`py-1.5 ${theme === 'dark' ? 'text-neutral-400' : 'text-gray-500'}`}>{label}</td>
                        <td className="py-1.5 text-right font-bold">{formatTime(value.exec)}</td>
                        <td className="py-1.5 text-right text-gray-400">{formatTime(value.prev)}</td>
                        <td className={`py-1.5 text-right ${diffColor}`}>{diff > 0 ? `+${formatTime(diff)}` : formatTime(diff)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`h-4 w-px ${theme === 'dark' ? 'bg-neutral-800' : 'bg-gray-300'}`}></div>

          <div className="relative group cursor-pointer">
            <div className="flex items-center">
              <span className={`mr-2 text-xs uppercase font-bold tracking-wider ${theme === 'dark' ? 'text-neutral-400' : 'text-gray-500'}`}>Demandas:</span>
              <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-brand-900'}`} data-testid="kpi-total-demands">
                <span className={`text-[10px] mr-1 uppercase ${theme === 'dark' ? 'text-neutral-400' : 'text-gray-500'}`}>Total:</span> {data.length} <span className="text-gray-400 font-normal mx-1">/</span> <span className={`text-[10px] mr-1 uppercase ${theme === 'dark' ? 'text-neutral-400' : 'text-gray-500'}`}>Concluídas:</span> <span className={`font-normal ${theme === 'dark' ? 'text-neutral-300' : 'text-gray-500'}`}>{completedTasks}</span>
              </span>
            </div>
            {data.length > 0 && (
              <div className={`absolute top-full left-0 mt-2 w-64 shadow-lg border rounded-md p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 ${theme === 'dark' ? 'bg-[#1a1a1f] border-neutral-800 text-neutral-300' : 'bg-white border-gray-200 text-gray-600'}`}>
                <h3 className={`text-xs font-bold mb-2 border-b pb-1 uppercase ${theme === 'dark' ? 'text-white border-neutral-800' : 'text-brand-900 border-gray-100'}`}>Tipos de Demandas</h3>
                <div className="space-y-1.5 text-[10px] font-mono mb-2">
                  {sortedTypes.map(([type, count]) => {
                    const percentage = data.length > 0 ? Math.round((count / data.length) * 100) : 0;
                    return (
                      <div key={type} className="flex justify-between items-center">
                        <span className={`truncate mr-2 uppercase ${theme === 'dark' ? 'text-neutral-400' : 'text-gray-500'}`} title={type}>{type}:</span>
                        <span className={`font-bold flex-shrink-0 ${theme === 'dark' ? 'text-white' : 'text-brand-900'}`}>
                          {count} <span className={`text-[8px] font-normal ${theme === 'dark' ? 'text-neutral-500' : 'text-gray-400'}`}>({percentage}%)</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className={`mt-2 pt-2 border-t text-[8px] leading-relaxed ${theme === 'dark' ? 'border-neutral-800 text-neutral-500' : 'border-gray-100 text-gray-400'}`}>
                  * Demandas a partir da etapa <strong>15 - Agendar Deploy</strong> são consideradas concluídas.
                </div>
              </div>
            )}
          </div>

          <div className={`h-4 w-px ${theme === 'dark' ? 'bg-neutral-800' : 'bg-gray-300'}`}></div>
          <div className="flex items-center relative group/kpi cursor-help">
            <span className={`${theme === 'dark' ? 'text-neutral-400' : 'text-gray-500'} mr-2 text-xs uppercase font-bold tracking-wider border-b border-dashed ${theme === 'dark' ? 'border-neutral-600' : 'border-gray-400'}`}>Progresso Geral:</span>
            <span className="font-bold text-status-done uppercase text-xs" data-testid="kpi-progress">{progressPercent}% Concluído</span>
            
            <div className={`absolute top-full left-0 mt-2 w-72 shadow-lg border rounded-md p-3 opacity-0 invisible group-hover/kpi:opacity-100 group-hover/kpi:visible transition-all duration-200 z-50 ${theme === 'dark' ? 'bg-[#1a1a1f] border-neutral-800 text-neutral-300' : 'bg-white border-gray-200 text-gray-600'}`}>
              <div className="text-xs font-medium leading-relaxed">
                Calculado com base no tempo previsto das demandas que já atingiram a etapa <strong>15 - Agendar Deploy</strong> (ou superior) em relação ao total previsto da sprint.
              </div>
            </div>
          </div>
          <div className={`h-4 w-px ${theme === 'dark' ? 'bg-neutral-800' : 'bg-gray-300'}`}></div>
          <div className="flex items-center relative group/kpi cursor-help">
            <span className={`${theme === 'dark' ? 'text-neutral-400' : 'text-gray-500'} mr-2 text-xs uppercase font-bold tracking-wider border-b border-dashed ${theme === 'dark' ? 'border-neutral-600' : 'border-gray-400'}`}>Atenção:</span>
            <span className={`font-bold flex items-center whitespace-nowrap uppercase ${(overLimitCount.back + overLimitCount.front + overLimitCount.mobile + overLimitCount.qa) > 0 ? (theme === 'dark' ? 'text-rose-400/60' : 'text-rose-500/65') : (theme === 'dark' ? 'text-neutral-500' : 'text-gray-400')}`} data-testid="kpi-alerts">
              {(overLimitCount.back + overLimitCount.front + overLimitCount.mobile + overLimitCount.qa) > 0 && <span className="w-2 h-2 rounded-full bg-rose-400/35 mr-2 animate-pulse flex-shrink-0"></span>}
              {overLimitCount.back} Back, {overLimitCount.front} Front, {overLimitCount.mobile} APP, {overLimitCount.qa} QA Ultrapassou estimativa
            </span>
            
            <div className={`absolute top-full left-0 mt-2 w-80 shadow-lg border rounded-md p-3 opacity-0 invisible group-hover/kpi:opacity-100 group-hover/kpi:visible transition-all duration-200 z-50 ${theme === 'dark' ? 'bg-[#1a1a1f] border-neutral-800 text-neutral-300' : 'bg-white border-gray-200 text-gray-600'}`}>
              <div className="text-xs font-medium leading-relaxed">
                Exibe a quantidade de demandas ativas (em andamento) onde o tempo apontado (<strong>Executado</strong>) por uma determinada disciplina excedeu a sua respectiva estimativa de horas (<strong>Previsto</strong>).
                <br/><br/>
                O cálculo avalia o estouro de forma isolada para cada área de atuação (Back, Front, APP, QA). <strong>Demandas a partir da etapa "15 - Agendar Deploy" (inclusive) não são contabilizadas neste indicador</strong>.
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className={`flex-1 overflow-auto relative z-10 transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0a0a0c] text-neutral-100' : 'bg-surface-50 text-gray-800'}`} data-testid="main-content">
        <div className="min-w-[1100px]">
          <div className={`grid grid-cols-[minmax(200px,2fr)_minmax(150px,1fr)_1fr_1fr_1fr_1fr] sticky top-0 z-20 px-8 py-4 text-[10px] font-bold uppercase tracking-widest shadow-sm transition-colors duration-300 ${theme === 'dark' ? 'bg-[#121214] border-b border-neutral-800/80 text-neutral-500' : 'bg-white border-b border-gray-200 text-gray-400'}`}>
            <div>Identificador da Demanda</div>
            <div className="pr-8">Etapa Atual</div>
            <div className="pr-8">Back-end [INV/PRV]</div>
            <div className="pr-8">Front-end [INV/PRV]</div>
            <div className="pr-8">Mobile [INV/PRV]</div>
            <div className="pr-8">QA & Teste [INV/PRV]</div>
          </div>

          <div className="text-xs flex flex-col pb-10" data-testid="demand-list">
            {error && <div className="p-6 text-red-500">{error}</div>}
            {!loading && data.length === 0 && !error && (
              <div className={`p-6 ${theme === 'dark' ? 'text-neutral-500' : 'text-gray-400'}`}>Nenhuma demanda encontrada para esta sprint.</div>
            )}
            
            {data.slice().sort((a, b) => (a.status || '').localeCompare(b.status || '')).map(task => {
              const backAssigs = getRoleAssignments(task.assignments, ['back', 'dev'], ['qa', 'test', 'front', 'mobile']);
              const frontAssigs = getRoleAssignments(task.assignments, ['front']);
              const mobileAssigs = getRoleAssignments(task.assignments, ['mobile']);
              const qaAssigs = getRoleAssignments(task.assignments, ['qa', 'test']);

              const isWorking = task.is_working_on === true;

              const bgClass = isWorking
                ? (theme === 'dark' ? 'bg-emerald-500/5 hover:bg-emerald-500/8' : 'bg-emerald-500/5 hover:bg-emerald-500/10')
                : (theme === 'dark' ? 'hover:bg-[#18181c]/60' : 'hover:bg-gray-50/50');

              const borderBottomClass = isWorking
                ? (theme === 'dark' ? 'border-b border-emerald-500/20' : 'border-b border-emerald-500/10')
                : (theme === 'dark' ? 'border-b border-neutral-800/40' : 'border-b border-gray-200');

              const borderLeftClass = isWorking
                ? 'border-l-4 border-l-status-done'
                : 'border-l-4 border-l-transparent';

              return (
                <div key={task.id} className={`grid grid-cols-[minmax(200px,2fr)_minmax(150px,1fr)_1fr_1fr_1fr_1fr] pr-8 pl-[28px] py-3 transition-all items-center ${borderLeftClass} ${bgClass} ${borderBottomClass}`}>
                  
                  <div className="pr-4 flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <a href={`https://runrun.it/pt-BR/tasks/${task.id}`} target="_blank" rel="noreferrer" className={`block text-sm font-bold transition-colors leading-tight ${theme === 'dark' ? 'text-neutral-500 hover:text-white' : 'text-gray-400 hover:text-brand-900'}`}>
                        #{task.id}
                      </a>
                      {isWorking && (
                        <span className="inline-flex items-center space-x-1.5 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 select-none">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-done opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-status-done"></span>
                          </span>
                          <span className="text-[8px] font-extrabold text-status-done uppercase tracking-widest leading-none">
                            Em execução
                          </span>
                        </span>
                      )}
                    </div>
                    <a href={`https://runrun.it/pt-BR/tasks/${task.id}`} target="_blank" rel="noreferrer" className={`block text-xs font-bold leading-snug transition-colors mt-0.5 truncate uppercase ${theme === 'dark' ? 'text-neutral-200 hover:text-accent-400' : 'text-brand-900 hover:text-accent-500'}`} title={task.title}>
                      {task.title}
                    </a>
                  </div>

                  <div className="pr-8 truncate flex items-center" title={task.status}>
                    <span className={`text-[9px] font-bold px-2 py-1 rounded truncate max-w-full uppercase tracking-wider ${theme === 'dark' ? 'text-neutral-400 bg-neutral-800' : 'text-gray-500 bg-gray-100'}`}>
                      {task.status || 'Sem Etapa'}
                    </span>
                  </div>
                  
                  <ProgressBar
                    title="BACK-END"
                    estimate={parseEstimate(task.estimates.back)}
                    assignees={backAssigs}
                    theme={theme}
                  />
                  <ProgressBar
                    title="FRONT-END"
                    estimate={parseEstimate(task.estimates.front)}
                    assignees={frontAssigs}
                    theme={theme}
                  />
                  <ProgressBar
                    title="MOBILE"
                    estimate={parseEstimate(task.estimates.mobile)}
                    assignees={mobileAssigs}
                    theme={theme}
                  />
                  <ProgressBar
                    title="QA / TESTE"
                    estimate={parseEstimate(task.estimates.qa)}
                    assignees={qaAssigs}
                    theme={theme}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

function ProgressBar({ title, estimate, assignees, theme }: { title: string, estimate: number, assignees: any[], theme: 'light' | 'dark' }) {
  if (estimate === 0 && assignees.length === 0) {
    return (
      <div className="pr-8 flex items-center h-full">
        <span className={`font-bold text-[9px] uppercase tracking-widest ${theme === 'dark' ? 'text-neutral-700' : 'text-gray-300'}`}>
          -- N/A --
        </span>
      </div>
    );
  }

  const execSeconds = assignees.reduce((sum, a) => sum + (a.time_worked_seconds || 0), 0);
  const progress = estimate > 0 ? Math.min(100, (execSeconds / estimate) * 100) : (execSeconds > 0 ? 100 : 0);
  const isOver = execSeconds > estimate && estimate > 0;
  const noEstimateButExec = estimate === 0 && execSeconds > 0;

  let barColor = 'bg-accent-500';
  let textColor = theme === 'dark' ? 'text-neutral-100' : 'text-brand-900';
  let statusText = '';
  let statusColor = '';

  if (isOver) {
    barColor = 'bg-rose-400/55';
    textColor = theme === 'dark' ? 'text-rose-400/75' : 'text-rose-500/80';
    statusText = '⚠️ ULTRAPASSOU ESTIMATIVA';
    statusColor = theme === 'dark' ? 'text-rose-400/75' : 'text-rose-500/80';
  } else if (noEstimateButExec) {
    barColor = 'bg-accent-500';
    textColor = 'text-accent-500';
    statusText = 'VERIFICAR ESTIMATIVA';
    statusColor = 'text-accent-500';
  } else if (progress === 100) {
    barColor = 'bg-status-done';
    textColor = 'text-status-done';
    statusText = 'FINALIZADO';
    statusColor = 'text-status-done';
  } else if (progress > 80) {
    barColor = 'bg-orange-400';
    textColor = theme === 'dark' ? 'text-orange-400' : 'text-orange-500';
    statusText = 'RISCO IMINENTE';
    statusColor = theme === 'dark' ? 'text-orange-400' : 'text-orange-500';
  } else if (progress === 0) {
    textColor = theme === 'dark' ? 'text-neutral-500' : 'text-gray-400';
    statusText = '-- AGUARDANDO --';
    statusColor = theme === 'dark' ? 'text-neutral-700' : 'text-gray-300';
  }

  return (
    <div className="pr-8 relative group/bar cursor-pointer focus:outline-none flex flex-col justify-center" tabIndex={0}>
      <div className="flex justify-between items-end mb-1">
        <span className={`text-sm font-bold leading-none ${textColor}`}>{formatTime(execSeconds)}</span>
        <span className="text-[10px] font-semibold text-gray-400 leading-none">{formatTime(estimate)}</span>
      </div>
      
      <div className={`relative w-full h-[2px] mb-1 ${theme === 'dark' ? 'bg-neutral-800' : 'bg-gray-200'}`}>
        <div className={`absolute top-0 left-0 h-full ${barColor} transition-all`} style={{ width: `${progress}%` }}></div>
      </div>
      
      <div className={`text-[8px] font-bold uppercase tracking-widest ${statusColor} leading-none`}>
        {statusText}
      </div>
      
      {/* Tooltip for Multiple Devs */}
      {assignees.length > 0 && (
        <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 shadow-lg border rounded-md p-3 opacity-0 invisible group-hover/bar:opacity-100 group-hover/bar:visible group-focus/bar:opacity-100 group-focus/bar:visible transition-all duration-200 z-50 ${theme === 'dark' ? 'bg-[#1a1a1f] border-neutral-800 text-neutral-300' : 'bg-white border-gray-200 text-gray-600'}`}>
          
          <div className="space-y-3 mb-3">
            {assignees.map((assignee, idx) => (
              <div key={idx} className="flex items-center space-x-3">
                <div className="relative flex-shrink-0">
                  <img src={assignee.avatar || 'https://ui-avatars.com/api/?name=User&background=e2e8f0'} className={`w-8 h-8 rounded-full border ${assignee.is_working_on ? 'border-status-done shadow-sm shadow-emerald-500/40' : (theme === 'dark' ? 'border-neutral-800' : 'border-gray-200')}`} alt={assignee.assignee_name} />
                  {assignee.is_working_on && (
                    <span className="absolute bottom-0 right-0 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-done opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-status-done"></span>
                    </span>
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center space-x-1.5">
                    <div className={`text-xs font-bold leading-tight truncate uppercase ${assignee.is_working_on ? 'text-status-done' : (theme === 'dark' ? 'text-white' : 'text-brand-900')}`}>{assignee.assignee_name}</div>
                    {assignee.is_working_on && (
                      <span className="text-[7px] font-extrabold uppercase px-1 py-0.5 rounded bg-emerald-500/10 text-status-done animate-pulse border border-emerald-500/20">
                        PLAY
                      </span>
                    )}
                  </div>
                  <div className={`text-[9px] uppercase tracking-wide truncate ${theme === 'dark' ? 'text-neutral-400' : 'text-gray-500'}`}>{assignee.role}</div>
                </div>
                <div className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${theme === 'dark' ? 'text-neutral-300 bg-neutral-800' : 'text-gray-600 bg-gray-100'}`}>
                  {formatTime(assignee.time_worked_seconds || 0)}
                </div>
              </div>
            ))}
          </div>

          <div className={`rounded p-1.5 text-[10px] font-mono flex justify-between uppercase ${theme === 'dark' ? 'bg-[#151518] border-t border-neutral-800 text-neutral-400' : 'bg-gray-50 border-t border-gray-100 text-gray-500'}`}>
            <span>EXEC / PREV:</span>
            <span className={`font-bold ${isOver ? 'text-status-wait-api' : 'text-status-done'}`}>
              {formatTime(execSeconds)} / {formatTime(estimate)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
