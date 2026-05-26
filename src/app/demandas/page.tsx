"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

export default function DemandasDashboard() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('sprint-dashboard-theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('sprint-dashboard-theme', nextTheme);
  };

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen flex flex-col antialiased transition-colors duration-500 font-sans relative overflow-hidden ${
      isDark ? 'bg-[#0a0a0c] text-[#f8f9fa]' : 'bg-surface-50 text-gray-800'
    }`}>
      {/* Background Radial Neon Glowing Effects */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[15%] left-[5%] w-[400px] h-[400px] rounded-full bg-[#00ACE7]/5 blur-[120px]" />
        <div className="absolute top-[30%] right-[10%] w-[500px] h-[500px] rounded-full bg-[#0F3A5F]/10 blur-[150px]" />
      </div>

      {/* Header */}
      <header className="bg-brand-900 text-white flex-none h-14 flex items-center justify-between px-6 border-b border-white/10 z-20" data-testid="top-header">
        {/* Lado Esquerdo: Logo + Título */}
        <div className="flex items-center space-x-4">
          <Sidebar theme={theme} />
          <div className="h-5 w-px bg-white/20"></div>
          <div 
            onClick={toggleTheme} 
            className="cursor-pointer hover:opacity-85 active:scale-95 transition-all flex items-center select-none"
            title="Alternar tema"
          >
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
            Demandas Dashboard
          </h1>
        </div>

        {/* Lado Direito: Ações rápidas */}
        <div className="flex items-center space-x-4 select-none">
          <button 
            onClick={toggleTheme}
            className="p-1.5 rounded-lg hover:bg-white/10 active:scale-90 flex items-center justify-center cursor-pointer text-white/80 hover:text-white transition-all"
            title="Alternar tema"
          >
            <span className="material-icons text-xl">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 z-10 select-none">
        <div className={`max-w-xl w-full p-8 md:p-12 border backdrop-blur-xl rounded-2xl shadow-3xl text-center flex flex-col items-center transition-all duration-500 transform hover:scale-[1.01] ${
          isDark 
            ? 'bg-[#141620]/60 border-white/5 shadow-black/40' 
            : 'bg-white/80 border-gray-100 shadow-gray-200/50'
        }`}>
          {/* Neon Animated Icon and Ring */}
          <div className="relative flex items-center justify-center mb-8">
            {/* Glow externo */}
            <div className={`absolute w-28 h-28 rounded-full border-2 border-dashed animate-[spin_20s_linear_infinite] ${
              isDark ? 'border-accent-500/20' : 'border-brand-700/20'
            }`}></div>
            <div className={`absolute w-24 h-24 rounded-full border border-double animate-[spin_8s_linear_infinite] ${
              isDark ? 'border-accent-400/40' : 'border-brand-800/40'
            }`}></div>
            
            {/* Círculo Interno com Efeito Glass */}
            <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-inner relative z-10 ${
              isDark ? 'bg-accent-500/10' : 'bg-brand-900/5'
            }`}>
              <span className={`material-icons text-4xl animate-[pulse_2s_infinite] ${
                isDark ? 'text-accent-400' : 'text-brand-900'
              }`}>
                construction
              </span>
            </div>
          </div>

          {/* Heading */}
          <h2 className={`text-2xl md:text-3xl font-extrabold tracking-wide mb-4 transition-colors duration-300 ${
            isDark ? 'text-white' : 'text-brand-900'
          }`}>
            Estou sendo criado
          </h2>

          {/* Subtext */}
          <p className={`text-xs md:text-sm leading-relaxed max-w-sm mb-10 transition-colors duration-300 ${
            isDark ? 'text-neutral-400' : 'text-gray-500'
          }`}>
            Estamos preparando um novo painel de demandas incrível e totalmente sob medida para o seu time. Em breve, esta área estará repleta de novas visões e insights inteligentes.
          </p>

          {/* Actions */}
          <Link 
            href="/"
            className={`px-6 py-3.5 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all duration-300 cursor-pointer active:scale-95 active:duration-75 ${
              isDark 
                ? 'bg-accent-500 hover:bg-accent-400 text-white shadow-lg shadow-accent-500/20 hover:shadow-accent-500/35 hover:-translate-y-0.5' 
                : 'bg-brand-900 hover:bg-brand-800 text-white shadow-lg shadow-brand-900/20 hover:shadow-brand-900/35 hover:-translate-y-0.5'
            }`}
          >
            <span className="material-icons text-base">arrow_back</span>
            <span>Voltar ao Dashboard</span>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className={`h-12 border-t flex items-center justify-center text-[10px] tracking-wider transition-all duration-300 ${
        isDark ? 'bg-black/20 border-neutral-900/60 text-neutral-500' : 'bg-gray-50/50 border-gray-100 text-gray-400'
      }`}>
        <span>South Tecnologia © 2026</span>
      </footer>
    </div>
  );
}
