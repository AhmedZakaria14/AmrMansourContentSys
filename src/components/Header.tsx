import { LogOut, Scale } from 'lucide-react';
import { FIRM_NAME } from '../types/content';

export type ActivePage = 'today' | 'archive';

interface HeaderProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  onSignOut: () => void;
}

export function Header({ activePage, onNavigate, onSignOut }: HeaderProps) {
  return (
    <header className="bg-[#0B192C] text-white border-b border-[#C9A45C]/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 md:gap-8">
        {/* Zone 1: Brand lockup (single line) */}
        <button
          type="button"
          onClick={() => onNavigate('today')}
          className="flex items-center gap-3 text-right min-w-0 shrink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A45C] rounded"
        >
          <span
            className="w-9 h-9 rounded-lg bg-[#132944] border border-[#C9A45C]/40 flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <Scale className="w-5 h-5 text-[#C9A45C]" />
          </span>
          <span className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
            {FIRM_NAME}
          </span>
        </button>

        {/* Zone 2: Clean typographic navigation links (desktop) */}
        <nav aria-label="التنقل الرئيسي" className="hidden md:flex items-center gap-7 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('today')}
            aria-current={activePage === 'today' ? 'page' : undefined}
            className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C9A45C] rounded ${
              activePage === 'today'
                ? 'text-[#E7C986]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            الرئيسية
            {activePage === 'today' && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 -bottom-[17px] h-0.5 bg-[#C9A45C]"
              />
            )}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('archive')}
            aria-current={activePage === 'archive' ? 'page' : undefined}
            className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C9A45C] rounded ${
              activePage === 'archive'
                ? 'text-[#E7C986]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            الأرشيف
            {activePage === 'archive' && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 -bottom-[17px] h-0.5 bg-[#C9A45C]"
              />
            )}
          </button>
        </nav>

        {/* Zone 3: Single primary header action (Sign out) */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] text-xs sm:text-sm font-medium text-slate-100 bg-[#132944] hover:bg-[#1E3A5F] border border-[#C9A45C]/30 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A45C]"
          >
            <LogOut className="w-4 h-4 text-[#C9A45C]" aria-hidden="true" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>

      {/* Mobile navigation strip (in-flow, non-sticky) */}
      <nav
        aria-label="التنقل على الجوال"
        className="md:hidden border-t border-white/10 bg-[#0E2038] px-4 flex items-center gap-6"
      >
        <button
          type="button"
          onClick={() => onNavigate('today')}
          aria-current={activePage === 'today' ? 'page' : undefined}
          className={`py-3 min-h-[44px] text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activePage === 'today'
              ? 'border-[#C9A45C] text-[#E7C986]'
              : 'border-transparent text-slate-300'
          }`}
        >
          الرئيسية
        </button>
        <button
          type="button"
          onClick={() => onNavigate('archive')}
          aria-current={activePage === 'archive' ? 'page' : undefined}
          className={`py-3 min-h-[44px] text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activePage === 'archive'
              ? 'border-[#C9A45C] text-[#E7C986]'
              : 'border-transparent text-slate-300'
          }`}
        >
          الأرشيف
        </button>
      </nav>
    </header>
  );
}
