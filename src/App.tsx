import { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { ModuleA_TaxShield } from './components/ModuleA_TaxShield';
import { ModuleB_AmortizationRecast } from './components/ModuleB_AmortizationRecast';
import { ModuleC_OpportunityCost } from './components/ModuleC_OpportunityCost';
import { ModuleD_CemaRefinance } from './components/ModuleD_CemaRefinance';
import { ModuleTaxReturn } from './components/ModuleTaxReturn';
import { AuditValidationModal } from './components/AuditValidationModal';
import { LockScreen } from './components/LockScreen';
import { TAX_PROFILES, DEFAULT_TAX_RETURN_INPUTS } from './constants/financialData';
import type { LumpSumStrategyMode, TaxProfile, TaxReturnInputs } from './types/financial';
import { simulateAmortization, calculateTaxReturnRates, formatPercent } from './utils/financialCalculations';
import { FileText, Calculator } from 'lucide-react';

export function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return (
      localStorage.getItem('bergen_arm_auth') === 'authorized' ||
      sessionStorage.getItem('bergen_arm_auth') === 'authorized'
    );
  });

  // Tax Return Inputs & Persistence
  const [taxReturnInputs, setTaxReturnInputs] = useState<TaxReturnInputs>(() => {
    try {
      const saved = localStorage.getItem('bergen_tax_return_inputs');
      if (saved) {
        return { ...DEFAULT_TAX_RETURN_INPUTS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Error loading stored tax return inputs', e);
    }
    return DEFAULT_TAX_RETURN_INPUTS;
  });

  // Global Strategy & Financial State
  const [lumpSum, setLumpSum] = useState<number>(0);
  const [extraMonthly, setExtraMonthly] = useState<number>(0);
  const [strategyMode, setStrategyMode] = useState<LumpSumStrategyMode>('maintain_flat');
  const [stopAt750k, setStopAt750k] = useState<boolean>(false);
  const [resetRate, setResetRate] = useState<number>(0.1075); // 10.750% max first reset / lifetime cap

  // Active Tax Profile (auto-calculated from stored tax return if available)
  const [taxProfile, setTaxProfile] = useState<TaxProfile>(() => {
    try {
      const saved = localStorage.getItem('bergen_tax_return_inputs');
      if (saved) {
        const parsed: TaxReturnInputs = { ...DEFAULT_TAX_RETURN_INPUTS, ...JSON.parse(saved) };
        const analysis = calculateTaxReturnRates(parsed);
        return analysis.appliedProfile;
      }
    } catch (e) {
      console.error('Error computing tax profile from storage', e);
    }
    return TAX_PROFILES.profile_a;
  });

  const [activeTab, setActiveTab] = useState<string>('unified');
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);

  // Compute live strategy simulation
  const simulation = useMemo(() => {
    return simulateAmortization({
      lumpSum,
      extraMonthly,
      strategyMode,
      stopAt750k,
      resetRate,
      taxProfile,
    });
  }, [lumpSum, extraMonthly, strategyMode, stopAt750k, resetRate, taxProfile]);

  const handleApplyStrategy = (
    newLump: number,
    newExtra: number,
    newStrategyMode: LumpSumStrategyMode = 'maintain_flat'
  ) => {
    setLumpSum(newLump);
    setExtraMonthly(newExtra);
    setStrategyMode(newStrategyMode);
  };

  const handleSaveTaxReturnInputs = (newInputs: TaxReturnInputs) => {
    setTaxReturnInputs(newInputs);
    try {
      localStorage.setItem('bergen_tax_return_inputs', JSON.stringify(newInputs));
    } catch (e) {
      console.error('Error saving tax return inputs to storage', e);
    }
    const analysis = calculateTaxReturnRates(newInputs);
    setTaxProfile(analysis.appliedProfile);
  };

  const handleResetTaxProfile = () => {
    try {
      localStorage.removeItem('bergen_tax_return_inputs');
    } catch (e) {
      console.error('Error removing tax return inputs from storage', e);
    }
    setTaxReturnInputs(DEFAULT_TAX_RETURN_INPUTS);
    setTaxProfile(TAX_PROFILES.profile_a);
  };


  const handleLock = () => {
    localStorage.removeItem('bergen_arm_auth');
    sessionStorage.removeItem('bergen_arm_auth');
    setIsAuthenticated(false);
  };


  // If not authenticated, render password lock screen
  if (!isAuthenticated) {
    return <LockScreen onUnlock={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans selection:bg-blue-600/30">
      {/* Sticky Institutional Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuditModal={() => setIsAuditModalOpen(true)}
        onLock={handleLock}
        isReturnDriven={Boolean(taxProfile.isReturnDriven)}
      />

      {/* Main Interactive Work Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Loan Context Briefing Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3 rounded-xl bg-slate-900/40 border border-white/5 text-xs text-slate-400 gap-2">
          <div className="flex items-center space-x-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-medium">Audit Reference Model Active:</span>
            <span>Wells Fargo Loan #0813684933 (10/6m SOFR ARM)</span>
          </div>
          <div className="flex items-center space-x-3 flex-wrap">
            <span>
              Fixed Margin: <strong className="text-slate-200">5.750%</strong> (107 mos)
            </span>
            <span className="text-slate-600">•</span>
            <button
              onClick={() => setActiveTab('moduleTax')}
              className="flex items-center space-x-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer group"
              title="Click to calibrate from Form 1040 & IT-201"
            >
              <Calculator className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
              <span>
                Active Tax Rates:{' '}
                <strong className={taxProfile.isReturnDriven ? 'text-emerald-400' : 'text-blue-300'}>
                  {formatPercent(taxProfile.federalRate, 1)} Fed / {formatPercent(taxProfile.nysRate, 2)} NYS / {formatPercent(taxProfile.nycRate, 2)} NYC
                </strong>{' '}
                ({taxProfile.isReturnDriven ? 'Return-Driven' : 'Preset'})
              </span>
            </button>

          </div>
        </div>

        {/* Tab 1: Unified Command Center View */}
        {activeTab === 'unified' && (
          <div className="space-y-8">
            <section>
              <ModuleA_TaxShield
                simulation={simulation}
                taxProfile={taxProfile}
                lumpSum={lumpSum}
                onSelectTier1Preset={() => setLumpSum(90532.21)}
              />
            </section>

            <section>
              <ModuleB_AmortizationRecast
                lumpSum={lumpSum}
                setLumpSum={setLumpSum}
                strategyMode={strategyMode}
                setStrategyMode={setStrategyMode}
                extraMonthly={extraMonthly}
                setExtraMonthly={setExtraMonthly}
                stopAt750k={stopAt750k}
                setStopAt750k={setStopAt750k}
                resetRate={resetRate}
                setResetRate={setResetRate}
                simulation={simulation}
                taxProfile={taxProfile}
              />
            </section>

            <section>
              <ModuleC_OpportunityCost
                taxProfile={taxProfile}
                setTaxProfile={setTaxProfile}
                lumpSum={lumpSum}
                extraMonthly={extraMonthly}
                taxReturnInputs={taxReturnInputs}
              />
            </section>

            <section>
              <ModuleD_CemaRefinance />
            </section>
          </div>
        )}

        {/* Tab 2: Module A Focus */}
        {activeTab === 'moduleA' && (
          <ModuleA_TaxShield
            simulation={simulation}
            taxProfile={taxProfile}
            lumpSum={lumpSum}
            onSelectTier1Preset={() => setLumpSum(90532.21)}
          />
        )}

        {/* Tab 3: Module B Focus */}
        {activeTab === 'moduleB' && (
          <ModuleB_AmortizationRecast
            lumpSum={lumpSum}
            setLumpSum={setLumpSum}
            strategyMode={strategyMode}
            setStrategyMode={setStrategyMode}
            extraMonthly={extraMonthly}
            setExtraMonthly={setExtraMonthly}
            stopAt750k={stopAt750k}
            setStopAt750k={setStopAt750k}
            resetRate={resetRate}
            setResetRate={setResetRate}
            simulation={simulation}
            taxProfile={taxProfile}
          />
        )}

        {/* Tab 4: Module C Focus */}
        {activeTab === 'moduleC' && (
          <ModuleC_OpportunityCost
            taxProfile={taxProfile}
            setTaxProfile={setTaxProfile}
            lumpSum={lumpSum}
            extraMonthly={extraMonthly}
            taxReturnInputs={taxReturnInputs}
          />
        )}


        {/* Tab 5: Module D Focus */}
        {activeTab === 'moduleD' && <ModuleD_CemaRefinance />}

        {/* Tab 6: Module Tax Return Intake & Calibration */}
        {activeTab === 'moduleTax' && (
          <ModuleTaxReturn
            taxReturnInputs={taxReturnInputs}
            onSaveInputs={handleSaveTaxReturnInputs}
            activeTaxProfile={taxProfile}
            onResetToBaseline={handleResetTaxProfile}
            onNavigateToTab={setActiveTab}
          />
        )}
      </main>


      {/* Institutional Footer */}
      <footer className="border-t border-white/10 bg-[#090D15] mt-12 py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="font-semibold text-slate-300">
                Bergen Street Jumbo ARM & Capital Allocation Optimizer
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Property: 323 Bergen St Apt 408W, Brooklyn, NY 11217 • Samantha Martin (Wells Fargo Loan #0813684933)
              </div>
            </div>
            <div className="flex items-center space-x-4 text-[11px]">
              <button
                onClick={() => setIsAuditModalOpen(true)}
                className="hover:text-slate-300 transition-colors cursor-pointer text-emerald-400 flex items-center space-x-1"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Verify Mathematical Audit</span>
              </button>
              <span>•</span>
              <span>IRC §163(h)(3) & NY Form IT-196 Compliant</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed border-t border-white/5 pt-4">
            Disclaimer: For institutional private wealth planning and financial modeling purposes only. Calculations reflect verified 30-day SOFR ARM parameters, Kings County statutory recording taxes, and New York state/city tax law decoupled mortgage interest deduction limitations as of October 2026. Consult certified tax advisors and mortgage lenders before executing contractual recasts or refinances.
          </p>
        </div>
      </footer>

      {/* Audit Validation Modal */}
      <AuditValidationModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        onApplyStrategy={handleApplyStrategy}
      />
    </div>
  );
}

export default App;
