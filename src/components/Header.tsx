import {
  Building2,
  FileCheck2,
  ShieldCheck,
  Sliders,
  TrendingUp,
  Landmark,
  Layers,
  Calculator,
} from 'lucide-react';
import { BASELINE_LOAN } from '../constants/financialData';
import { formatCurrency } from '../utils/financialCalculations';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAuditModal: () => void;
  onLock: () => void;
  isReturnDriven?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenAuditModal,
  onLock,
  isReturnDriven,
}) => {
  const tabs = [
    { id: 'unified', label: 'Command Center', icon: Layers },
    { id: 'moduleA', label: 'Debt Stack & Tax Shield', icon: ShieldCheck },
    { id: 'moduleB', label: 'Recast & Reset Stress-Test', icon: Sliders },
    { id: 'moduleC', label: 'Alternative Opportunity Cost', icon: TrendingUp },
    { id: 'moduleD', label: 'NYC CEMA & Relationship Refi', icon: Landmark },
    { id: 'moduleTax', label: 'Tax Return & Rate Engine', icon: Calculator, badge: isReturnDriven },
  ];


  return (
    <header className="border-b border-white/10 bg-[#0B0F19]/90 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Left: Branding & Loan Identity */}
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600/30 to-blue-900/50 border border-blue-500/30 text-blue-400 shadow-lg shadow-blue-950/40">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  Bergen Street Jumbo ARM & Capital Allocation Optimizer
                </h1>
                <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Wells Fargo Home Mortgage
                </span>
              </div>
              <div className="flex items-center space-x-3 text-xs text-slate-400 mt-0.5 flex-wrap">
                <span>Borrower: <strong className="text-slate-200">{BASELINE_LOAN.borrowerName}</strong></span>
                <span className="text-slate-600">•</span>
                <span>Loan #: <strong className="text-slate-200">{BASELINE_LOAN.loanNumber}</strong></span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-300">{BASELINE_LOAN.propertyAddress}</span>
              </div>
            </div>
          </div>

          {/* Right: Quick Loan Stat Pill & Audit Verification Action */}
          <div className="flex items-center space-x-2.5 self-end lg:self-center flex-wrap">
            <div className="hidden sm:flex flex-col text-right pr-1">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Post-10/01 Balance</span>
              <span className="text-sm font-mono-numbers font-semibold text-emerald-400">
                {formatCurrency(BASELINE_LOAN.activeStartingBalance)}
              </span>
            </div>
            <div className="hidden sm:block h-7 w-[1px] bg-slate-800" />
            <button
              onClick={onOpenAuditModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer shadow-sm hover:shadow-emerald-950/50"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Audit Verifier</span>
            </button>
            <button
              onClick={onLock}
              title="Lock portal"
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Lock</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 mt-3 overflow-x-auto scrollbar-none pt-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer relative ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    title="Active tax return numbers powering model"
                    className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30 animate-pulse ml-0.5"
                  />
                )}
              </button>

            );
          })}
        </div>
      </div>
    </header>
  );
};
