import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Download,
  Fuel,
  MapPin,
  MinusCircle,
  Plus,
  Search,
  Wrench,
  X,
} from 'lucide-react';
import {
  Engin,
  EnginCategory,
  FuelConsumptionStatus,
  FuelDailyLog,
  FuelLogValidationErrors,
  FuelPeriodPreset,
  NewFuelLogInput,
} from '../types/fleet';
import {
  CATEGORY_LABELS,
  DIESEL_PRICE_FCFA_PER_LITER,
  EvaluatedEnginFuelConsumption,
  computeFuelConsumptionSummary,
  evaluateFleetFuelConsumption,
  exportFuelConsumptionToCsv,
  getEnginFuelBenchmark,
  resolveFuelPeriodBounds,
  validateNewFuelLogInput,
} from '../utils/telemetry';
import { REFERENCE_TODAY_ISO } from '../data/seedFleet';
import { CategoryIcon } from './EnginIcons';

interface FuelConsumptionPanelProps {
  fleet: Engin[];
  fuelLogs: FuelDailyLog[];
  onAddFuelLog: (input: NewFuelLogInput) => void;
  onLocateEngin: (enginId: string) => void;
  onOpenMaintenanceForEngin: (enginId: string) => void;
}

const PERIOD_PRESET_LABELS: Array<{ id: FuelPeriodPreset; label: string }> = [
  { id: '7D', label: '7 derniers jours' },
  { id: '15D', label: '15 derniers jours' },
  { id: '30D', label: '30 derniers jours' },
  { id: '90D', label: '90 derniers jours' },
  { id: 'CUSTOM', label: 'Période personnalisée' },
];

export function FuelConsumptionPanel({
  fleet,
  fuelLogs,
  onAddFuelLog,
  onLocateEngin,
  onOpenMaintenanceForEngin,
}: FuelConsumptionPanelProps) {
  const [periodPreset, setPeriodPreset] = useState<FuelPeriodPreset>('30D');
  const [customStartIso, setCustomStartIso] = useState('2026-09-27');
  const [customEndIso, setCustomEndIso] = useState(REFERENCE_TODAY_ISO);
  const [thresholdPct, setThresholdPct] = useState<number>(15);
  const [statusFilter, setStatusFilter] = useState<'ALL' | FuelConsumptionStatus>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | EnginCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedEnginId, setInspectedEnginId] = useState<string | null>(null);

  // Modal state for adding a manual fuel log / refill
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formEnginId, setFormEnginId] = useState<string>(fleet[0]?.id ?? '');
  const [formDateIso, setFormDateIso] = useState<string>(REFERENCE_TODAY_ISO);
  const [formLitersConsumed, setFormLitersConsumed] = useState<string>('');
  const [formDistanceKm, setFormDistanceKm] = useState<string>('');
  const [formEngineHours, setFormEngineHours] = useState<string>('');
  const [formRefueledLiters, setFormRefueledLiters] = useState<string>('0');
  const [formStationNote, setFormStationNote] = useState<string>('');
  const [formErrors, setFormErrors] = useState<FuelLogValidationErrors>({});

  const periodBounds = useMemo(
    () =>
      resolveFuelPeriodBounds(
        periodPreset,
        REFERENCE_TODAY_ISO,
        customStartIso,
        customEndIso
      ),
    [periodPreset, customStartIso, customEndIso]
  );

  const evaluatedRows = useMemo(
    () =>
      evaluateFleetFuelConsumption(
        fleet,
        fuelLogs,
        periodBounds.startIso,
        periodBounds.endIso,
        thresholdPct,
        DIESEL_PRICE_FCFA_PER_LITER
      ),
    [fleet, fuelLogs, periodBounds.startIso, periodBounds.endIso, thresholdPct]
  );

  const summary = useMemo(
    () => computeFuelConsumptionSummary(evaluatedRows),
    [evaluatedRows]
  );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return evaluatedRows.filter((row) => {
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && row.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        row.enginName.toLowerCase().includes(q) ||
        row.plateOrSerial.toLowerCase().includes(q) ||
        row.driverName.toLowerCase().includes(q) ||
        row.locationLabel.toLowerCase().includes(q)
      );
    });
  }, [evaluatedRows, statusFilter, categoryFilter, searchQuery]);

  const activeInspectedRow = useMemo(() => {
    if (inspectedEnginId) {
      const match = evaluatedRows.find((r) => r.enginId === inspectedEnginId);
      if (match) return match;
    }
    return evaluatedRows[0] ?? null;
  }, [evaluatedRows, inspectedEnginId]);

  const handleExportCsv = () => {
    const csv = exportFuelConsumptionToCsv(
      filteredRows,
      periodBounds.startIso,
      periodBounds.endIso
    );
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `consommation-carburant-${periodBounds.startIso}-${periodBounds.endIso}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const openFuelModal = (preselectedEnginId?: string) => {
    const targetId = preselectedEnginId ?? activeInspectedRow?.enginId ?? fleet[0]?.id ?? '';
    setFormEnginId(targetId);
    setFormDateIso(REFERENCE_TODAY_ISO);
    setFormLitersConsumed('');
    setFormDistanceKm('');
    setFormEngineHours('');
    setFormRefueledLiters('0');
    setFormStationNote('');
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleSubmitFuelLog = (e: React.FormEvent) => {
    e.preventDefault();
    const candidate: NewFuelLogInput = {
      enginId: formEnginId,
      dateIso: formDateIso.trim(),
      litersConsumed: formLitersConsumed.trim() === '' ? NaN : Number(formLitersConsumed),
      distanceKm: formDistanceKm.trim() === '' ? 0 : Number(formDistanceKm),
      engineHoursWorked: formEngineHours.trim() === '' ? 0 : Number(formEngineHours),
      refueledLiters: formRefueledLiters.trim() === '' ? NaN : Number(formRefueledLiters),
      stationOrNote: formStationNote.trim(),
    };

    const validation = validateNewFuelLogInput(candidate, fleet);
    if (Object.keys(validation).length > 0) {
      setFormErrors(validation);
      return;
    }

    onAddFuelLog(candidate);
    setInspectedEnginId(candidate.enginId);
    setIsModalOpen(false);
    setFormErrors({});
  };

  const formatSignedPct = (pct: number) => `${pct > 0 ? '+' : ''}${pct.toFixed(1)} %`;

  const renderStatusLabel = (row: EvaluatedEnginFuelConsumption) => {
    if (row.status === FuelConsumptionStatus.SURCONSOMMATION) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
          <AlertOctagon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Surconsommation ({formatSignedPct(row.deviationPercent)})
        </span>
      );
    }
    if (row.status === FuelConsumptionStatus.VIGILANCE) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Vigilance ({formatSignedPct(row.deviationPercent)})
        </span>
      );
    }
    if (row.status === FuelConsumptionStatus.CONFORME) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Conforme ({formatSignedPct(row.deviationPercent)})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 whitespace-nowrap">
        <MinusCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Aucune activité sur la période
      </span>
    );
  };

  const selectedFormEngin = fleet.find((e) => e.id === formEnginId) ?? null;
  const selectedFormBenchmark = selectedFormEngin
    ? getEnginFuelBenchmark(selectedFormEngin)
    : null;

  return (
    <div className="space-y-8">
      {/* Period & Threshold Control Header */}
      <section
        aria-label="Sélection de la période d'analyse carburant"
        className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
      >
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">
              Calcul de consommation moyenne & détection des surconsommations
            </h2>
            <p className="text-xs text-slate-500">
              Période analysée :{' '}
              <span className="font-mono tabular-nums font-medium text-slate-800">
                du {new Date(`${periodBounds.startIso}T00:00:00Z`).toLocaleDateString('fr-FR')}{' '}
                au {new Date(`${periodBounds.endIso}T00:00:00Z`).toLocaleDateString('fr-FR')}
              </span>{' '}
              ({periodBounds.dayCount} jour{periodBounds.dayCount > 1 ? 's' : ''}) · Tarif réf.
              gasoil CI :{' '}
              <span className="font-mono tabular-nums font-medium text-slate-800">
                {DIESEL_PRICE_FCFA_PER_LITER} FCFA/L
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              className="py-2 px-3.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              Exporter CSV
            </button>
            <button
              type="button"
              onClick={() => openFuelModal()}
              className="py-2 px-4 rounded-lg bg-orange-700 hover:bg-orange-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Enregistrer un relevé
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
          {/* Period Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Période de calcul"
              className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              {PERIOD_PRESET_LABELS.map((preset) => {
                const active = periodPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setPeriodPreset(preset.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {periodPreset === 'CUSTOM' && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label htmlFor="fuel-start-date" className="font-medium text-slate-600">
                  Du
                </label>
                <input
                  id="fuel-start-date"
                  type="date"
                  value={customStartIso}
                  max={REFERENCE_TODAY_ISO}
                  onChange={(e) => setCustomStartIso(e.target.value)}
                  className="px-2.5 py-1.5 font-mono tabular-nums text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                />
                <label htmlFor="fuel-end-date" className="font-medium text-slate-600">
                  au
                </label>
                <input
                  id="fuel-end-date"
                  type="date"
                  value={customEndIso}
                  max={REFERENCE_TODAY_ISO}
                  onChange={(e) => setCustomEndIso(e.target.value)}
                  className="px-2.5 py-1.5 font-mono tabular-nums text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                />
              </div>
            )}
          </div>

          {/* Overconsumption Tolerance Selector */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="overconsumption-threshold-select"
              className="text-xs font-medium text-slate-600 whitespace-nowrap"
            >
              Seuil d’alerte surconsommation :
            </label>
            <select
              id="overconsumption-threshold-select"
              value={thresholdPct}
              onChange={(e) => setThresholdPct(Number(e.target.value))}
              className="py-1.5 px-2.5 text-xs font-mono tabular-nums font-semibold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
            >
              <option value={10}>+10 % vs réf. constructeur</option>
              <option value={15}>+15 % vs réf. constructeur</option>
              <option value={20}>+20 % vs réf. constructeur</option>
            </select>
          </div>
        </div>
      </section>

      {/* 4-Column Fleet Fuel Analytics KPI Strip */}
      <section
        aria-label="Indicateurs clés de consommation sur la période"
        className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
      >
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Engins en surconsommation</p>
          <p
            className={`mt-1 text-2xl font-bold font-mono tabular-nums ${
              summary.overconsumingCount > 0 ? 'text-red-700' : 'text-slate-900'
            }`}
          >
            {summary.overconsumingCount}{' '}
            <span className="text-sm font-normal text-slate-500">/ {fleet.length}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Dont {summary.vigilanceCount} sous vigilance (&ge;{' '}
            {Math.max(5, Math.round(thresholdPct * 0.55))} %)
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">
            Volume consommé ({periodBounds.dayCount} j)
          </p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {summary.totalLitersConsumed.toLocaleString('fr-FR')} L
          </p>
          <p className="mt-1 text-xs font-mono tabular-nums text-slate-500">
            Ravitaillé : {summary.totalRefueledLiters.toLocaleString('fr-FR')} L
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Volume excédentaire estimé</p>
          <p
            className={`mt-1 text-2xl font-bold font-mono tabular-nums ${
              summary.totalExcessLiters > 0 ? 'text-red-700' : 'text-slate-900'
            }`}
          >
            +{summary.totalExcessLiters.toLocaleString('fr-FR')} L
          </p>
          <p className="mt-1 text-xs font-mono tabular-nums text-slate-500">
            Écart moyen parc : {formatSignedPct(summary.averageDeviationPercent)}
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Surcoût lié aux écarts</p>
          <p
            className={`mt-1 text-xl font-bold font-mono tabular-nums ${
              summary.totalExcessCostFcfa > 0 ? 'text-red-700' : 'text-slate-900'
            }`}
          >
            +{summary.totalExcessCostFcfa.toLocaleString('fr-FR')} FCFA
          </p>
          <p className="mt-1 text-xs font-mono tabular-nums text-slate-500">
            Budget total : {summary.totalCostFcfa.toLocaleString('fr-FR')} FCFA
          </p>
        </div>
      </section>

      {/* Filter Bar & Per-Engin Consumption Table */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative min-w-[230px] max-w-xs flex-1">
              <label htmlFor="fuel-engin-search" className="sr-only">
                Rechercher un engin ou conducteur
              </label>
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="fuel-engin-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Plaque CI, engin, conducteur..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
            </div>

            <div>
              <label htmlFor="fuel-category-filter" className="sr-only">
                Filtrer par catégorie d’engin
              </label>
              <select
                id="fuel-category-filter"
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(e.target.value as 'ALL' | EnginCategory)
                }
                className="py-2 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
              >
                <option value="ALL">Toutes catégories</option>
                {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
                  <option key={cat} value={cat}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            role="group"
            aria-label="Filtrer par diagnostic de consommation"
            className="flex flex-wrap items-center gap-1.5"
          >
            {[
              { id: 'ALL' as const, label: `Tous (${evaluatedRows.length})` },
              {
                id: FuelConsumptionStatus.SURCONSOMMATION,
                label: `Surconsommation (${summary.overconsumingCount})`,
              },
              {
                id: FuelConsumptionStatus.VIGILANCE,
                label: `Vigilance (${summary.vigilanceCount})`,
              },
              {
                id: FuelConsumptionStatus.CONFORME,
                label: `Conforme (${summary.conformeCount})`,
              },
            ].map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {filteredRows.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-base font-bold text-slate-900">
                Aucun engin ne correspond aux filtres sélectionnés
              </p>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Modifiez le filtre de diagnostic ou élargissez la période d’analyse pour comparer
                les moyennes de consommation.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setCategoryFilter('ALL');
                  setSearchQuery('');
                }}
                className="py-2 px-4 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-3.5 whitespace-nowrap">Diagnostic & Écart</th>
                    <th className="py-3 px-3.5 min-w-[210px]">Engin & Conducteur</th>
                    <th className="py-3 px-3.5 text-right whitespace-nowrap">
                      Moyenne Mesurée / Réf.
                    </th>
                    <th className="py-3 px-3.5 text-right whitespace-nowrap">
                      Activité ({periodBounds.dayCount} j)
                    </th>
                    <th className="py-3 px-3.5 text-right whitespace-nowrap">
                      Volume & Surcoût (FCFA)
                    </th>
                    <th className="py-3 px-3.5 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredRows.map((row) => {
                    const isSelected = activeInspectedRow?.enginId === row.enginId;
                    const ratioPct =
                      row.primaryAverageRate !== null
                        ? Math.min(
                            100,
                            Math.max(
                              12,
                              Math.round((row.primaryAverageRate / (row.nominalRate * 1.35)) * 100)
                            )
                          )
                        : 0;

                    return (
                      <tr
                        key={row.enginId}
                        onClick={() => setInspectedEnginId(row.enginId)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-orange-50/40'
                            : row.status === FuelConsumptionStatus.SURCONSOMMATION
                            ? 'bg-red-50/20 hover:bg-red-50/35'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3.5 px-3.5 align-top whitespace-nowrap">
                          {renderStatusLabel(row)}
                          <p className="text-slate-500 font-mono tabular-nums mt-1">
                            {row.activeDaysCount} jour{row.activeDaysCount > 1 ? 's' : ''} d’activité
                          </p>
                        </td>

                        <td className="py-3.5 px-3.5 align-top min-w-[210px]">
                          <div className="flex items-start gap-2">
                            <span className="text-slate-600 mt-0.5 shrink-0">
                              <CategoryIcon category={row.category} className="w-4 h-4" />
                            </span>
                            <div>
                              <p className="font-semibold text-slate-900">{row.enginName}</p>
                              <p className="font-mono text-slate-600 tabular-nums mt-0.5">
                                {row.plateOrSerial} · {CATEGORY_LABELS[row.category]}
                              </p>
                              <p className="text-slate-500 mt-0.5">{row.driverName}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3.5 align-top text-right font-mono tabular-nums whitespace-nowrap">
                          {row.primaryAverageRate !== null ? (
                            <>
                              <div>
                                <span
                                  className={`text-sm font-bold ${
                                    row.status === FuelConsumptionStatus.SURCONSOMMATION
                                      ? 'text-red-700'
                                      : row.status === FuelConsumptionStatus.VIGILANCE
                                      ? 'text-amber-700'
                                      : 'text-slate-900'
                                  }`}
                                >
                                  {row.primaryAverageRate.toFixed(1)} {row.unitLabel}
                                </span>
                              </div>
                              <p className="text-slate-500 mt-0.5">
                                Réf. : {row.nominalRate.toFixed(1)} {row.unitLabel}
                              </p>
                              <div className="w-24 ml-auto mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    row.status === FuelConsumptionStatus.SURCONSOMMATION
                                      ? 'bg-red-600'
                                      : row.status === FuelConsumptionStatus.VIGILANCE
                                      ? 'bg-amber-600'
                                      : 'bg-emerald-600'
                                  }`}
                                  style={{ width: `${ratioPct}%` }}
                                />
                              </div>
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3.5 align-top text-right font-mono tabular-nums whitespace-nowrap">
                          <p className="font-semibold text-slate-900">
                            {row.totalEngineHoursWorked.toFixed(1)} h moteur
                          </p>
                          <p className="text-slate-500 mt-0.5">
                            {row.totalDistanceKm > 0
                              ? `${Math.round(row.totalDistanceKm).toLocaleString('fr-FR')} km`
                              : 'Poste fixe (0 km)'}
                          </p>
                        </td>

                        <td className="py-3.5 px-3.5 align-top text-right font-mono tabular-nums whitespace-nowrap">
                          <p className="font-semibold text-slate-900">
                            {row.totalLitersConsumed.toLocaleString('fr-FR')} L ·{' '}
                            {row.totalCostFcfa.toLocaleString('fr-FR')} FCFA
                          </p>
                          {row.excessLiters > 0 ? (
                            <p className="text-red-700 font-medium mt-0.5">
                              +{row.excessLiters.toLocaleString('fr-FR')} L (+
                              {row.excessCostFcfa.toLocaleString('fr-FR')} FCFA)
                            </p>
                          ) : (
                            <p className="text-emerald-700 mt-0.5">Dans la norme (0 FCFA)</p>
                          )}
                        </td>

                        <td
                          className="py-3.5 px-3.5 align-top text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInspectedEnginId(row.enginId)}
                              aria-label={`Analyser la courbe journalière de ${row.enginName}`}
                              className={`px-2.5 py-1.5 rounded-md font-semibold inline-flex items-center gap-1 cursor-pointer ${
                                isSelected
                                  ? 'bg-slate-900 text-white'
                                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
                              Courbe
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenMaintenanceForEngin(row.enginId)}
                              aria-label={`Ouvrir le carnet de maintenance de ${row.enginName}`}
                              className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                              <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onLocateEngin(row.enginId)}
                              aria-label={`Localiser ${row.enginName} sur la carte`}
                              className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                              <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Per-Engin Daily Consumption Curve & Refueling Log Inspector */}
      {activeInspectedRow && (
        <section
          aria-label={`Profil journalier de consommation pour ${activeInspectedRow.enginName}`}
          className="bg-white border border-slate-200 rounded-xl overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500">
                Profil journalier sonde carburant · {activeInspectedRow.plateOrSerial} ·{' '}
                {activeInspectedRow.locationLabel}
              </p>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                {activeInspectedRow.enginName}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
              <div>
                <span className="text-slate-500">Moyenne période : </span>
                <strong className="text-slate-900">
                  {activeInspectedRow.primaryAverageRate !== null
                    ? `${activeInspectedRow.primaryAverageRate.toFixed(1)} ${activeInspectedRow.unitLabel}`
                    : '—'}
                </strong>
              </div>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <div>
                <span className="text-slate-500">Seuil nominal : </span>
                <strong className="text-slate-900">
                  {activeInspectedRow.nominalRate.toFixed(1)} {activeInspectedRow.unitLabel}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => openFuelModal(activeInspectedRow.enginId)}
                className="py-1.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-sans font-semibold text-slate-800 cursor-pointer whitespace-nowrap"
              >
                + Ajouter un relevé sur cet engin
              </button>
            </div>
          </div>

          {activeInspectedRow.dailyLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Aucun relevé journalier enregistré pour cet engin sur la plage de dates choisie.
            </div>
          ) : (
            <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left 7 cols: Daily Consumption Bar Chart (up to last 30 active days) */}
              <div className="lg:col-span-7 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">
                    Évolution journalière ({activeInspectedRow.unitLabel}) —{' '}
                    {Math.min(30, activeInspectedRow.dailyLogs.length)} derniers jours actifs
                  </span>
                  <span className="font-mono tabular-nums text-slate-500">
                    Réf. {activeInspectedRow.nominalRate.toFixed(1)} {activeInspectedRow.unitLabel}
                  </span>
                </div>

                {(() => {
                  const recentLogs = activeInspectedRow.dailyLogs.slice(-30);
                  const dailyRates = recentLogs.map((log) => {
                    const rate =
                      activeInspectedRow.unit === 'L_100KM'
                        ? log.distanceKm > 0
                          ? (log.litersConsumed / log.distanceKm) * 100
                          : 0
                        : log.engineHoursWorked > 0
                        ? log.litersConsumed / log.engineHoursWorked
                        : 0;
                    return { log, rate: Number(rate.toFixed(1)) };
                  });
                  const maxRate = Math.max(
                    activeInspectedRow.nominalRate * 1.45,
                    ...dailyRates.map((d) => d.rate),
                    1
                  );

                  return (
                    <div className="pt-2">
                      <div className="h-36 flex items-end gap-1.5 border-b border-slate-200 pb-1">
                        {dailyRates.map(({ log, rate }) => {
                          const heightPct = Math.max(8, Math.round((rate / maxRate) * 100));
                          const devPct =
                            ((rate - activeInspectedRow.nominalRate) /
                              activeInspectedRow.nominalRate) *
                            100;
                          const isOver = devPct >= thresholdPct;
                          const isWarn = !isOver && devPct >= Math.max(5, thresholdPct * 0.55);

                          return (
                            <div
                              key={log.id}
                              title={`${log.dateIso} : ${rate} ${activeInspectedRow.unitLabel} (${log.litersConsumed} L)`}
                              className="flex-1 h-full flex flex-col justify-end items-center group"
                            >
                              <div
                                className={`w-full rounded-t-xs transition-opacity group-hover:opacity-80 ${
                                  isOver
                                    ? 'bg-red-600'
                                    : isWarn
                                    ? 'bg-amber-500'
                                    : 'bg-slate-800'
                                }`}
                                style={{ height: `${heightPct}%` }}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 mt-1.5">
                        <span>{recentLogs[0]?.dateIso}</span>
                        <span>
                          Rouge : &ge; +{thresholdPct}% · Ambre : vigilance · Ardoise : conforme
                        </span>
                        <span>{recentLogs[recentLogs.length - 1]?.dateIso}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Right 5 cols: Recent Refueling & Probe Events for Inspected Engin */}
              <div className="lg:col-span-5 space-y-2.5">
                <p className="text-xs font-semibold text-slate-800">
                  Derniers relevés sonde & pleins carburant
                </p>
                <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
                  {activeInspectedRow.dailyLogs
                    .slice()
                    .reverse()
                    .slice(0, 4)
                    .map((log) => (
                      <div
                        key={log.id}
                        className="px-3.5 py-2.5 flex items-start justify-between gap-3 text-xs"
                      >
                        <div>
                          <p className="font-mono tabular-nums font-semibold text-slate-900">
                            {new Date(`${log.dateIso}T00:00:00Z`).toLocaleDateString('fr-FR')} ·{' '}
                            {log.litersConsumed.toFixed(1)} L consommés
                          </p>
                          <p className="text-slate-500 mt-0.5">
                            {log.stationOrNote ??
                              `Activité normale (${log.engineHoursWorked} h${
                                log.distanceKm > 0 ? ` · ${log.distanceKm} km` : ''
                              })`}
                          </p>
                        </div>
                        {log.refueledLiters > 0 && (
                          <span className="font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                            +{log.refueledLiters} L plein
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Modal: Enregistrer un relevé carburant / plein */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-fuel-log-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <Fuel className="w-4 h-4 text-orange-700 shrink-0" aria-hidden="true" />
                <div>
                  <h2
                    id="add-fuel-log-dialog-title"
                    className="text-base font-bold text-slate-900"
                  >
                    Enregistrer un relevé carburant ou ravitaillement
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mise à jour immédiate de la moyenne de consommation de l’engin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Fermer la fenêtre de relevé carburant"
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmitFuelLog} noValidate className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="flog-engin-select"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Engin concerné *
                  </label>
                  <select
                    id="flog-engin-select"
                    value={formEnginId}
                    onChange={(e) => setFormEnginId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  >
                    {fleet.map((e) => {
                      const bench = getEnginFuelBenchmark(e);
                      return (
                        <option key={e.id} value={e.id}>
                          {e.plateOrSerial} — {e.name} (Réf. {bench.nominalRate} {bench.unitLabel})
                        </option>
                      );
                    })}
                  </select>
                  {formErrors.enginId && (
                    <p className="mt-1 text-xs text-red-700">{formErrors.enginId}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="flog-date-input"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Date du relevé *
                  </label>
                  <input
                    id="flog-date-input"
                    type="date"
                    value={formDateIso}
                    max={REFERENCE_TODAY_ISO}
                    onChange={(e) => setFormDateIso(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                  {formErrors.dateIso && (
                    <p className="mt-1 text-xs text-red-700">{formErrors.dateIso}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="flog-consumed-input"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Gasoil consommé (Litres) *
                  </label>
                  <input
                    id="flog-consumed-input"
                    type="number"
                    min={0.5}
                    step="0.5"
                    value={formLitersConsumed}
                    onChange={(e) => setFormLitersConsumed(e.target.value)}
                    placeholder="Ex: 115"
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                  {formErrors.litersConsumed && (
                    <p className="mt-1 text-xs text-red-700">{formErrors.litersConsumed}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="flog-distance-input"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Distance parcourue (km)
                    {selectedFormBenchmark?.unit === 'L_100KM' ? ' *' : ''}
                  </label>
                  <input
                    id="flog-distance-input"
                    type="number"
                    min={0}
                    step="1"
                    value={formDistanceKm}
                    onChange={(e) => setFormDistanceKm(e.target.value)}
                    placeholder={
                      selectedFormBenchmark?.unit === 'L_100KM' ? 'Ex: 210' : '0 si chantier fixe'
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="flog-hours-input"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Heures moteur travaillées (h)
                    {selectedFormBenchmark?.unit === 'L_HOUR' ? ' *' : ''}
                  </label>
                  <input
                    id="flog-hours-input"
                    type="number"
                    min={0}
                    step="0.5"
                    value={formEngineHours}
                    onChange={(e) => setFormEngineHours(e.target.value)}
                    placeholder="Ex: 7.5"
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>

                {formErrors.activity && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-red-700">{formErrors.activity}</p>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="flog-refueled-input"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Plein / Appoint effectué (Litres)
                  </label>
                  <input
                    id="flog-refueled-input"
                    type="number"
                    min={0}
                    step="1"
                    value={formRefueledLiters}
                    onChange={(e) => setFormRefueledLiters(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                  {formErrors.refueledLiters && (
                    <p className="mt-1 text-xs text-red-700">{formErrors.refueledLiters}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="flog-station-input"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Station ou observation sonde
                  </label>
                  <input
                    id="flog-station-input"
                    type="text"
                    value={formStationNote}
                    onChange={(e) => setFormStationNote(e.target.value)}
                    placeholder="Ex: TotalEnergies Vridi / Sonde LLS"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2 px-4 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm font-semibold cursor-pointer whitespace-nowrap"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 rounded-lg bg-orange-700 hover:bg-orange-800 text-white text-sm font-semibold cursor-pointer whitespace-nowrap"
                >
                  Enregistrer le relevé
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
