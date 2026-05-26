"use client";

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  theme?: 'light' | 'dark';
}

export default function Sidebar({ theme = 'dark' }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const toggleSidebar = () => setIsOpen(!isOpen);

  const menuItems = [
    {
      name: 'Sprint Dashboard',
      path: '/',
      icon: 'dashboard',
      description: 'Acompanhamento de Sprints e prazos'
    },
    {
      name: 'Demandas Dashboard',
      path: '/demandas',
      icon: 'list_alt',
      description: 'Visão geral de todas as demandas'
    }
  ];

  const isDark = theme === 'dark';

  return (
    <>
      {/* Botão Hambúrguer */}
      <button
        onClick={toggleSidebar}
        aria-label="Abrir menu"
        className={`flex items-center justify-center p-2 rounded-lg transition-all duration-300 active:scale-90 select-none cursor-pointer focus:outline-none ${
          isDark 
            ? 'text-white/80 hover:text-white hover:bg-white/10' 
            : 'text-white/80 hover:text-white hover:bg-white/10'
        }`}
      >
        <span className="material-icons text-2xl">menu</span>
      </button>

      {/* Backdrop (Fundo Escuro com Blur) */}
      {isOpen && (
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
        />
      )}

      {/* Gaveta Lateral (Drawer) */}
      <div
        className={`fixed top-0 left-0 h-full w-80 z-50 shadow-2xl transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          isDark 
            ? 'bg-[#0e0e11]/95 border-r border-neutral-800/60 text-neutral-100' 
            : 'bg-white/98 border-r border-gray-200 text-gray-800'
        }`}
      >
        {/* Cabeçalho da Gaveta */}
        <div className={`h-16 flex items-center justify-between px-6 border-b ${
          isDark ? 'border-neutral-800/80 bg-black/20' : 'border-gray-100 bg-gray-50/50'
        }`}>
          <div className="flex items-center space-x-3">
            <Image 
              src={isDark ? "/assets/logomarca-branca-south-tecnologia.png" : "/assets/logomarca-branca-south-tecnologia.png"} 
              alt="South Tecnologia Logo" 
              width={100} 
              height={20} 
              className={`h-5 w-auto ${!isDark ? 'brightness-0 opacity-80' : ''}`}
            />
          </div>
          <button
            onClick={toggleSidebar}
            aria-label="Fechar menu"
            className={`p-1.5 rounded-full transition-all active:scale-90 hover:rotate-90 duration-300 cursor-pointer ${
              isDark ? 'hover:bg-neutral-800 text-neutral-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
            }`}
          >
            <span className="material-icons text-xl">close</span>
          </button>
        </div>

        {/* Links do Menu */}
        <div className="p-4 space-y-2">
          <div className={`px-3 py-1 text-[9px] font-bold uppercase tracking-widest ${
            isDark ? 'text-neutral-500' : 'text-gray-400'
          }`}>
            Navegação do Projeto
          </div>
          
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`group flex items-center px-4 py-3.5 rounded-xl transition-all duration-300 relative overflow-hidden ${
                    isActive
                      ? (isDark 
                          ? 'bg-accent-500/10 text-accent-400' 
                          : 'bg-brand-900/5 text-brand-900')
                      : (isDark 
                          ? 'hover:bg-neutral-800/50 text-neutral-300 hover:text-white' 
                          : 'hover:bg-gray-50 text-gray-600 hover:text-brand-900')
                  }`}
                >
                  {/* Ícone com Efeito */}
                  <span className={`material-icons text-xl mr-3.5 transition-transform duration-300 group-hover:scale-110 ${
                    isActive 
                      ? (isDark ? 'text-accent-400' : 'text-brand-900') 
                      : (isDark ? 'text-neutral-500 group-hover:text-neutral-300' : 'text-gray-400 group-hover:text-gray-600')
                  }`}>
                    {item.icon}
                  </span>
                  
                  {/* Texto */}
                  <div className="flex flex-col">
                    <span className="text-xs font-bold tracking-wide uppercase">{item.name}</span>
                    <span className={`text-[9px] mt-0.5 ${
                      isDark ? 'text-neutral-500 group-hover:text-neutral-400' : 'text-gray-400 group-hover:text-gray-500'
                    }`}>
                      {item.description}
                    </span>
                  </div>

                  {/* Indicador de Hover Dinâmico */}
                  <span className={`absolute right-4 text-[10px] font-bold opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300 ${
                    isDark ? 'text-accent-400/80' : 'text-brand-900/80'
                  }`}>
                    ➔
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Rodapé da Gaveta */}
        <div className={`absolute bottom-0 inset-x-0 p-6 border-t text-[10px] text-center font-mono ${
          isDark ? 'border-neutral-800/60 text-neutral-500 bg-black/10' : 'border-gray-100 text-gray-400 bg-gray-50/30'
        }`}>
          <div>South Tecnologia © 2026</div>
          <div className="mt-0.5 text-[8px] tracking-wider uppercase opacity-60">Sprint Dashboard v2.0</div>
        </div>
      </div>
    </>
  );
}
