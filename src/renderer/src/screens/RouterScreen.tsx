import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import {
  RouterInfo,
  ProviderAccount,
  ComboConfig,
  RequestLogEntry,
  AnalyticsSummary,
  PricingSnapshot,
  ProviderType,
} from '../../../shared/types';
import {
  Play,
  Square,
  Plus,
  Key,
  CheckCircle2,
  XCircle,
  Coins,
  FileText,
  Trash2,
  Activity,
  Layers,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

export const RouterScreen: React.FC = () => {
  const { theme, t } = useAppStore();
  const isObsidian = theme === 'obsidian';

  const [activeTab, setActiveTab] = useState<'overview' | 'providers' | 'combos' | 'logs' | 'pricing'>('overview');
  const [routerInfo, setRouterInfo] = useState<RouterInfo | null>(null);
  const [providers, setProviders] = useState<ProviderAccount[]>([]);
  const [combos, setCombos] = useState<ComboConfig[]>([]);
  const [logs, setLogs] = useState<RequestLogEntry[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [pricing, setPricing] = useState<PricingSnapshot[]>([]);

  // Add Provider Modal State
  const [isAddProviderOpen, setIsAddProviderOpen] = useState(false);
  const [newProviderType, setNewProviderType] = useState<ProviderType>('google-ai-studio');
  const [newProviderName, setNewProviderName] = useState('Google AI Studio (Gemini)');
  const [newProviderKey, setNewProviderKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; latencyMs: number; error?: string } | null>(null);

  // Load all M2 data from Electron backend
  const loadData = async () => {
    if (!window.stratos) return;
    try {
      const [rInfo, pList, cList, lList, aSummary, prList] = await Promise.all([
        window.stratos.router.getStatus(),
        window.stratos.providers.list(),
        window.stratos.combos.list(),
        window.stratos.logs.query({ limit: 50 }),
        window.stratos.analytics.get(),
        window.stratos.pricing.get(),
      ]);
      setRouterInfo(rInfo);
      setProviders(pList);
      setCombos(cList);
      setLogs(lList);
      setAnalytics(aSummary);
      setPricing(prList);
    } catch (err) {
      console.error('[RouterScreen] Failed to load data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000); // Polling every 4s for fresh logs & router stats
    return () => clearInterval(interval);
  }, []);

  const handleToggleRouter = async () => {
    if (!window.stratos || !routerInfo) return;
    if (routerInfo.status === 'active') {
      const updated = await window.stratos.router.stop();
      setRouterInfo(updated);
    } else {
      const updated = await window.stratos.router.start();
      setRouterInfo(updated);
    }
  };

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.stratos || !newProviderName.trim()) return;

    await window.stratos.providers.save({
      providerType: newProviderType,
      name: newProviderName.trim(),
      apiKey: newProviderKey.trim() || undefined,
    });

    setNewProviderName('');
    setNewProviderKey('');
    setIsAddProviderOpen(false);
    loadData();
  };

  const handleTestProvider = async (providerId: string) => {
    if (!window.stratos) return;
    setTestingId(providerId);
    setTestResult(null);
    try {
      const result = await window.stratos.providers.test(providerId);
      setTestResult({ id: providerId, ...result });
      loadData();
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteProvider = async (providerId: string) => {
    if (!window.stratos) return;
    if (confirm('Hapus provider ini beserta kredensial tersimpannya?')) {
      await window.stratos.providers.delete(providerId);
      loadData();
    }
  };

  const handleClearLogs = async () => {
    if (!window.stratos) return;
    if (confirm(t.router.logs.confirmClear)) {
      await window.stratos.logs.clear();
      loadData();
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fadeIn">
      {/* Top Header & Service Status Banner */}
      <div className={`p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isObsidian ? 'bg-obsidian-surface border-obsidian-border text-obsidian-text' : 'bg-white border-nordic-border text-nordic-text'
      }`}>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight">{t.router.title}</h1>
            <span className="text-xs px-2 py-0.5 rounded font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Zero-Mock Loopback Router
            </span>
          </div>
          <p className={`text-xs mt-1 ${isObsidian ? 'text-obsidian-muted' : 'text-nordic-muted'}`}>
            {t.router.subtitle}
          </p>
        </div>

        {/* Loopback Service Status Pill & Controls */}
        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-mono ${
            routerInfo?.status === 'active'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${routerInfo?.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>
              {routerInfo?.status === 'active'
                ? `127.0.0.1:${routerInfo.port}`
                : t.router.serviceStopped}
            </span>
          </div>

          <button
            onClick={handleToggleRouter}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center space-x-1.5 transition-colors ${
              routerInfo?.status === 'active'
                ? 'bg-rose-600/10 border-rose-500/30 text-rose-400 hover:bg-rose-600/20'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
            }`}
          >
            {routerInfo?.status === 'active' ? (
              <>
                <Square className="w-3.5 h-3.5" />
                <span>{t.router.stopService}</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>{t.router.startService}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className={`px-6 border-b flex space-x-1 ${
        isObsidian ? 'bg-obsidian-bg border-obsidian-border' : 'bg-nordic-bg border-nordic-border'
      }`}>
        {(['overview', 'providers', 'combos', 'logs', 'pricing'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all capitalize ${
              activeTab === tab
                ? 'border-blue-500 text-blue-500 font-semibold'
                : isObsidian
                ? 'border-transparent text-obsidian-muted hover:text-obsidian-text'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {t.router.tabs[tab]}
          </button>
        ))}
      </div>

      {/* Main Tab Content Viewport */}
      <div className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* --- TAB 1: OVERVIEW & ANALYTICS --- */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 4 Essential Metric Cards (PRD 4.2) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Card 1: Total Requests */}
              <div className={`p-4 rounded-xl border ${
                isObsidian ? 'bg-obsidian-surface border-obsidian-border' : 'bg-white border-nordic-border shadow-sm'
              }`}>
                <div className="flex items-center justify-between text-xs text-obsidian-muted mb-2">
                  <span>{t.router.metrics.totalRequests}</span>
                  <Activity className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold font-mono">{analytics?.totalRequests || 0}</div>
                <div className="flex items-center space-x-2 text-[11px] mt-2 text-obsidian-subtle">
                  <span className="text-emerald-500 font-semibold">{analytics?.successCount || 0} OK</span>
                  <span>•</span>
                  <span className="text-rose-500 font-semibold">{analytics?.failureCount || 0} Fail</span>
                </div>
              </div>

              {/* Card 2: Input Tokens */}
              <div className={`p-4 rounded-xl border ${
                isObsidian ? 'bg-obsidian-surface border-obsidian-border' : 'bg-white border-nordic-border shadow-sm'
              }`}>
                <div className="flex items-center justify-between text-xs text-obsidian-muted mb-2">
                  <span>{t.router.metrics.inputTokens}</span>
                  <FileText className="w-4 h-4 text-purple-500" />
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight">
                  {(analytics?.totalInputTokens || 0).toLocaleString()}
                </div>
                <div className="text-[11px] mt-2 text-obsidian-subtle">Prompt & system context</div>
              </div>

              {/* Card 3: Output Tokens */}
              <div className={`p-4 rounded-xl border ${
                isObsidian ? 'bg-obsidian-surface border-obsidian-border' : 'bg-white border-nordic-border shadow-sm'
              }`}>
                <div className="flex items-center justify-between text-xs text-obsidian-muted mb-2">
                  <span>{t.router.metrics.outputTokens}</span>
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight">
                  {(analytics?.totalOutputTokens || 0).toLocaleString()}
                </div>
                <div className="text-[11px] mt-2 text-obsidian-subtle">Generated completions</div>
              </div>

              {/* Card 4: Actual Cost vs Ref Value */}
              <div className={`p-4 rounded-xl border ${
                isObsidian ? 'bg-obsidian-surface border-obsidian-border' : 'bg-white border-nordic-border shadow-sm'
              }`}>
                <div className="flex items-center justify-between text-xs text-obsidian-muted mb-2">
                  <span>{t.router.metrics.actualCost}</span>
                  <Coins className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold font-mono tracking-tight text-emerald-400">
                  ${(analytics?.actualCost || 0).toFixed(4)}
                </div>
                <div className="text-[11px] mt-2 text-obsidian-subtle">
                  Ref Value: ${(analytics?.referenceValue || 0).toFixed(4)}
                </div>
              </div>
            </div>

            {/* Quick Provider Overview List */}
            <div className={`p-5 rounded-xl border space-y-3 ${
              isObsidian ? 'bg-obsidian-surface border-obsidian-border' : 'bg-white border-nordic-border shadow-sm'
            }`}>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-obsidian-muted">
                  Provider Aktif ({providers.length})
                </h3>
                <button
                  onClick={() => setActiveTab('providers')}
                  className="text-xs text-blue-500 hover:underline"
                >
                  Kelola Provider &rarr;
                </button>
              </div>

              {providers.length === 0 ? (
                <div className="text-xs py-4 text-center text-obsidian-muted">
                  {t.router.providers.noProviders}
                </div>
              ) : (
                <div className="divide-y divide-obsidian-border/50 text-xs">
                  {providers.map((p) => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`w-2 h-2 rounded-full ${p.isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <span className="font-semibold">{p.name}</span>
                        <span className="font-mono text-obsidian-muted text-[11px]">({p.providerType})</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-mono text-obsidian-muted">{p.maskedKey || 'No Key'}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] ${
                          p.isConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
                        }`}>
                          {p.isConnected ? 'Online' : 'Standby'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 2: PROVIDERS & ACCOUNTS --- */}
        {activeTab === 'providers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">{t.router.providers.title}</h2>
                <p className="text-xs text-obsidian-muted">{t.router.providers.maskNotice}</p>
              </div>
              <button
                onClick={() => setIsAddProviderOpen(true)}
                className="px-3.5 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.router.providers.addProvider}</span>
              </button>
            </div>

            {/* Providers Grid */}
            <div className="grid md:grid-cols-2 gap-4">
              {providers.map((p) => (
                <div
                  key={p.id}
                  className={`p-5 rounded-xl border space-y-3 ${
                    isObsidian ? 'bg-obsidian-surface border-obsidian-border' : 'bg-white border-nordic-border shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-sm">{p.name}</h3>
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${
                          p.isConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {p.isConnected ? t.router.providers.statusConnected : t.router.providers.statusDisconnected}
                        </span>
                      </div>
                      <div className="text-[11px] text-obsidian-muted mt-0.5">Tipe: {p.providerType}</div>
                    </div>

                    <button
                      onClick={() => handleDeleteProvider(p.id)}
                      className="p-1 text-obsidian-muted hover:text-rose-400 transition-colors"
                      title="Hapus Provider"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-obsidian-muted">API Key:</span>
                      <span className="font-mono text-obsidian-text">{p.maskedKey || 'Belum diisi'}</span>
                    </div>
                    {p.lastTestedAt && (
                      <div className="flex justify-between text-[11px] text-obsidian-subtle">
                        <span>Terakhir Diuji:</span>
                        <span>{new Date(p.lastTestedAt).toLocaleTimeString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Test Feedback Notice */}
                  {testResult?.id === p.id && (
                    <div className={`p-2.5 rounded-lg text-xs flex items-center space-x-2 ${
                      testResult.success
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {testResult.success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                      <span className="truncate">
                        {testResult.success
                          ? `${t.router.providers.testSuccess} (latency: ${testResult.latencyMs}ms)`
                          : testResult.error}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleTestProvider(p.id)}
                      disabled={testingId === p.id}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border flex items-center space-x-1.5 ${
                        isObsidian
                          ? 'bg-obsidian-elevated border-obsidian-border hover:bg-obsidian-border/50 text-obsidian-text'
                          : 'bg-slate-50 border-nordic-border hover:bg-slate-100 text-nordic-text'
                      }`}
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>{testingId === p.id ? t.common.loading : t.common.test}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- TAB 3: COMBOS & ROUTING POLICIES --- */}
        {activeTab === 'combos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">{t.router.combos.title}</h2>
                <p className="text-xs text-obsidian-muted">Perutean deterministik dan batas retry bertahap (ADR-009).</p>
              </div>
            </div>

            {combos.length === 0 ? (
              <div className={`p-8 rounded-xl border text-center space-y-2 ${
                isObsidian ? 'bg-obsidian-surface border-obsidian-border' : 'bg-white border-nordic-border'
              }`}>
                <Layers className="w-8 h-8 text-obsidian-muted mx-auto" />
                <div className="font-semibold text-xs">{t.router.combos.noCombos}</div>
                <p className="text-xs text-obsidian-muted max-w-sm mx-auto">
                  Kebijakan combo memungkinkan Anda mengurutkan fallback model utama dan model sekunder jika terjadi limit atau kegagalan.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {combos.map((c) => (
                  <div
                    key={c.id}
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      isObsidian ? 'bg-obsidian-surface border-obsidian-border' : 'bg-white border-nordic-border'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-sm">{c.name}</span>
                        {c.isDefault && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                            {t.router.combos.defaultBadge}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-obsidian-muted mt-1">
                        Kandidat: {c.candidates.map((k) => `${k.providerId}/${k.modelId}`).join(' &rarr; ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- TAB 4: REQUEST LOGS & TOKEN INSPECTOR --- */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">{t.router.logs.title}</h2>
                <p className="text-xs text-obsidian-muted">
                  Audit transparansi lengkap tanpa kebocoran kunci rahasia (SEC-006).
                </p>
              </div>
              {logs.length > 0 && (
                <button
                  onClick={handleClearLogs}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 border border-rose-500/20"
                >
                  {t.router.logs.clearLogs}
                </button>
              )}
            </div>

            {logs.length === 0 ? (
              <div className={`p-8 rounded-xl border text-center text-xs text-obsidian-muted ${
                isObsidian ? 'bg-obsidian-surface border-obsidian-border' : 'bg-white border-nordic-border'
              }`}>
                {t.router.logs.noLogs}
              </div>
            ) : (
              <div className={`rounded-xl border overflow-hidden ${
                isObsidian ? 'bg-obsidian-surface border-obsidian-border' : 'bg-white border-nordic-border'
              }`}>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b text-[11px] uppercase tracking-wider ${
                      isObsidian ? 'bg-obsidian-bg/50 border-obsidian-border text-obsidian-muted' : 'bg-slate-50 border-nordic-border text-nordic-muted'
                    }`}>
                      <th className="p-3">{t.router.logs.correlationId}</th>
                      <th className="p-3">{t.router.logs.model}</th>
                      <th className="p-3">{t.router.logs.status}</th>
                      <th className="p-3">{t.router.logs.tokens}</th>
                      <th className="p-3">{t.router.logs.duration}</th>
                      <th className="p-3">Biaya Riil</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-obsidian-border/50">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-blue-500/5 transition-colors">
                        <td className="p-3 font-mono text-obsidian-muted">{log.correlationId}</td>
                        <td className="p-3 font-medium">
                          <span className="font-semibold">{log.providerId}</span>
                          <span className="text-obsidian-subtle"> / {log.modelId}</span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                            log.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="p-3 font-mono">
                          {log.inputTokens || 0} &darr; / {log.outputTokens || 0} &uarr;
                        </td>
                        <td className="p-3 font-mono text-obsidian-muted">{log.durationMs}ms</td>
                        <td className="p-3 font-mono text-emerald-400">
                          ${(log.actualCost || 0).toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* --- TAB 5: PRICING CATALOG --- */}
        {activeTab === 'pricing' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold">{t.router.pricing.title}</h2>
              <p className="text-xs text-obsidian-muted">{t.router.pricing.subtitle}</p>
            </div>

            <div className={`rounded-xl border overflow-hidden ${
              isObsidian ? 'bg-obsidian-surface border-obsidian-border' : 'bg-white border-nordic-border'
            }`}>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className={`border-b text-[11px] uppercase tracking-wider ${
                    isObsidian ? 'bg-obsidian-bg/50 border-obsidian-border text-obsidian-muted' : 'bg-slate-50 border-nordic-border text-nordic-muted'
                  }`}>
                    <th className="p-3">{t.router.pricing.model}</th>
                    <th className="p-3">{t.router.pricing.inputCost}</th>
                    <th className="p-3">{t.router.pricing.outputCost}</th>
                    <th className="p-3">{t.router.pricing.source}</th>
                    <th className="p-3">{t.router.pricing.effectiveDate}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-border/50">
                  {pricing.map((p, idx) => (
                    <tr key={idx} className="hover:bg-blue-500/5 transition-colors">
                      <td className="p-3 font-medium">
                        <span className="font-semibold">{p.providerId}</span>
                        <span className="text-obsidian-subtle"> / {p.modelId}</span>
                      </td>
                      <td className="p-3 font-mono text-emerald-400">${p.inputPricePerMillion.toFixed(2)}</td>
                      <td className="p-3 font-mono text-blue-400">${p.outputPricePerMillion.toFixed(2)}</td>
                      <td className="p-3 text-obsidian-muted truncate max-w-xs">{p.source}</td>
                      <td className="p-3 font-mono text-obsidian-muted">{p.effectiveDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center space-x-2 text-xs text-obsidian-muted pt-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              <span>{t.router.pricing.note}</span>
            </div>
          </div>
        )}
      </div>

      {/* --- ADD PROVIDER MODAL --- */}
      {isAddProviderOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-xl ${
            isObsidian ? 'bg-obsidian-surface border-obsidian-border text-obsidian-text' : 'bg-white border-nordic-border text-nordic-text'
          }`}>
            <h3 className="text-base font-bold mb-4">{t.router.providers.addProvider}</h3>
            <form onSubmit={handleSaveProvider} className="space-y-4 text-xs">
              <div>
                <label className="block mb-1.5 font-medium">{t.router.providers.providerType}</label>
                <select
                  value={newProviderType}
                  onChange={(e) => {
                    const selected = e.target.value as ProviderType;
                    setNewProviderType(selected);
                    if (!newProviderName || newProviderName.startsWith('Google') || newProviderName.startsWith('OpenRouter') || newProviderName.startsWith('Groq') || newProviderName.startsWith('DeepSeek') || newProviderName.startsWith('Local')) {
                      if (selected === 'google-ai-studio') setNewProviderName('Google AI Studio (Gemini)');
                      else if (selected === 'openrouter') setNewProviderName('OpenRouter Account');
                      else if (selected === 'groq') setNewProviderName('Groq Cloud');
                      else if (selected === 'deepseek') setNewProviderName('DeepSeek Account');
                      else if (selected === 'mock') setNewProviderName('Local Mock Provider');
                    }
                  }}
                  className={`w-full p-2.5 rounded-lg border outline-none font-medium ${
                    isObsidian
                      ? 'bg-obsidian-bg border-obsidian-border text-white'
                      : 'bg-slate-50 border-nordic-border text-slate-900'
                  }`}
                >
                  <option value="google-ai-studio">Google AI Studio (Gemini API Resmi)</option>
                  <option value="openrouter">OpenRouter API (Multi-provider)</option>
                  <option value="groq">Groq Cloud API (Llama 3.3 / Fast)</option>
                  <option value="deepseek">DeepSeek API (V3 / R1)</option>
                  <option value="mock">Local Mock Provider (Offline Testing)</option>
                </select>
              </div>

              <div>
                <label className="block mb-1.5 font-medium">{t.router.providers.accountName}</label>
                <input
                  type="text"
                  required
                  placeholder={
                    newProviderType === 'google-ai-studio'
                      ? 'e.g. Google AI Studio (Gemini)'
                      : newProviderType === 'groq'
                      ? 'e.g. Groq Cloud Account'
                      : newProviderType === 'deepseek'
                      ? 'e.g. DeepSeek Account'
                      : 'e.g. OpenRouter Account'
                  }
                  value={newProviderName}
                  onChange={(e) => setNewProviderName(e.target.value)}
                  className={`w-full p-2.5 rounded-lg border outline-none ${
                    isObsidian ? 'bg-obsidian-bg border-obsidian-border text-white' : 'bg-slate-50 border-nordic-border text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block mb-1.5 font-medium">{t.router.providers.apiKey}</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    placeholder={
                      newProviderType === 'google-ai-studio'
                        ? 'AIzaSy... (API Key dari aistudio.google.com)'
                        : newProviderType === 'groq'
                        ? 'gsk_... (API Key dari console.groq.com)'
                        : newProviderType === 'deepseek'
                        ? 'sk-... (API Key dari platform.deepseek.com)'
                        : newProviderType === 'mock'
                        ? 'mock-key (opsional)'
                        : 'sk-or-v1-... (API Key dari openrouter.ai)'
                    }
                    value={newProviderKey}
                    onChange={(e) => setNewProviderKey(e.target.value)}
                    className={`w-full p-2.5 rounded-lg border outline-none pr-10 font-mono ${
                      isObsidian ? 'bg-obsidian-bg border-obsidian-border text-white' : 'bg-slate-50 border-nordic-border text-slate-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-2.5 text-obsidian-muted hover:text-obsidian-text"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-obsidian-subtle mt-1">{t.router.providers.maskNotice}</p>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddProviderOpen(false)}
                  className="px-4 py-2 rounded-lg border text-obsidian-muted hover:text-obsidian-text"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
