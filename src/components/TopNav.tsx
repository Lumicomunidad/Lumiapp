import React from 'react';
import { LumiLogo } from './LumiLogo';
import type { AppSectionId, LumiUser } from '../types/lumi';

interface TopNavProps {
  activeSection: AppSectionId;
  user: LumiUser | null;
  guestName: string;
  onNavigate: (section: AppSectionId) => void;
  onOpenAccount: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeSection,
  user,
  guestName,
  onNavigate,
  onOpenAccount,
}) => {
  const navItems: Array<{ id: AppSectionId; label: string }> = [
    { id: 'home', label: 'Inicio' },
    { id: 'mensajes', label: 'Mensajes' },
    { id: 'traductor', label: 'Traductor' },
    { id: 'calendario', label: 'Calendario' },
    { id: 'certificados', label: 'Certificados' },
    { id: 'audiolibros', label: 'Audiolibros' },
    { id: 'lumicube', label: 'LumiCube' },
  ];

  const accountLabel = user
    ? user.name
    : guestName
      ? `${guestName} · Crear cuenta`
      : 'Crear cuenta';

  return (
    <header className="sticky top-0 z-30 border-b border-[#E9E5D9] bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:gap-8 sm:px-6 sm:py-3">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="shrink-0 whitespace-nowrap rounded-lg px-1 py-0.5 text-left"
          aria-label="Ir al inicio de Lumi"
        >
          <LumiLogo size="sm" />
        </button>

        <nav
          aria-label="Navegación principal"
          className="hidden items-center gap-6 md:flex"
        >
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`shrink-0 whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-[#EE7A13] font-semibold text-[#202020]'
                    : 'border-transparent text-[#555555] hover:border-[#EE7A13]/40 hover:text-[#202020]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onOpenAccount}
            className="min-h-[40px] shrink-0 whitespace-nowrap rounded-xl bg-[#F5DF91] px-3.5 py-2 text-xs font-semibold text-[#202020] hover:bg-[#EDD37A] sm:min-h-[44px] sm:px-4 sm:text-sm"
          >
            {accountLabel}
          </button>
        </div>
      </div>

      {/* Navegación móvil compacta */}
      <nav
        aria-label="Navegación móvil"
        className="flex gap-1.5 overflow-x-auto border-t border-[#F2EFE6] px-3 py-1.5 md:hidden"
      >
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`min-h-[40px] shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-xs font-semibold ${
                isActive
                  ? 'bg-[#FFF9E9] text-[#202020] ring-1 ring-[#D9BF68]'
                  : 'text-[#555555] hover:bg-[#F7F5EE]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
