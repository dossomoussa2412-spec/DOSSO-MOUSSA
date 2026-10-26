import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Download,
  MapPin,
  Plus,
  Search,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  Engin,
  MaintenanceRecord,
  MaintenanceServiceType,
  MaintenanceStatus,
  MaintenanceValidationErrors,
  NewMaintenanceInput,
} from '../types/fleet';
import {
  CATEGORY_LABELS,
  EvaluatedMaintenanceRecord,
  MAINTENANCE_TYPE_LABELS,
  computeMaintenanceMetrics,
  evaluateMaintenanceLogs,
  exportMaintenanceToCsv,
  validateNewMaintenanceInput,
} from '../utils/telemetry';
import { CategoryIcon } from './EnginIcons';

interface MaintenanceLogViewProps {
  fleet: Engin[];
  maintenanceLogs: MaintenanceRecord[];
  focusedEnginId: string | null;
  onSelectFocusedEngin: (enginId: string | null) => void;
  onCompleteMaintenance: (recordId: string) => void;
  onAddMaintenance: (input: NewMaintenanceInput) => void;
  onDeleteMaintenance: (recordId: string) => void;
  onLocateOnMap: (enginId: string) => void;
}

export function MaintenanceLogView({
  fleet,
  maintenanceLogs,
  focusedEnginId,
  onSelectFocusedEngin,
  onCompleteMaintenance,
  onAddMaintenance,
  onDeleteMaintenance,
  onLocateOnMap,
}: MaintenanceLogViewProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | MaintenanceStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal Form State
  const [formEnginId, setFormEnginId] = useState<string>(
    focusedEnginId ?? fleet[0]?.id ?? ''
  );
  const [formServiceType, setFormServiceType] = useState<MaintenanceServiceType>(
    MaintenanceServiceType.VIDANGE_MOTEUR
  );
  const [formTitle, setFormTitle] = useState('');
  const [formWorkshop, setFormWorkshop] = useState('');
  const [formTargetHours, setFormTargetHours] = useState('');
  const [formCostFcfa, setFormCostFcfa] = useState('250000');
  const [formNotes, setFormNotes] = useState('');
  const [formCompleted, setFormCompleted] = useState(false);
  const [formErrors, setFormErrors] = useState<MaintenanceValidationErrors>({});

  const allEvaluated = useMemo(
    () => evaluateMaintenanceLogs(maintenanceLogs, fleet),
    [maintenanceLogs, fleet]
  );

  const scopedToEngin = useMemo(() => {
    if (!focusedEnginId) return allEvaluated;
    return allEvaluated.filter((item) => item.enginId === focusedEnginId);
  }, [allEvaluated, focusedEnginId]);

  const metrics = useMemo(
    () => computeMaintenanceMetrics(scopedToEngin),
    [scopedToEngin]
  );

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scopedToEngin.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.enginName.toLowerCase().includes(q) ||
        item.plateOrSerial.toLowerCase().includes(q) ||
        item.workshopOrTechnician.toLowerCase().includes(q) ||
        MAINTENANCE_TYPE_LABELS[item.serviceType].toLowerCase().includes(q)
      );
    });
  }, [scopedToEngin, statusFilter, searchQuery]);

  const focusedEngin = useMemo(
    () => (focusedEnginId ? fleet.find((e) => e.id === focusedEnginId) ?? null : null),
    [fleet, focusedEnginId]
  );

  const openNewMaintenanceModal = () => {
    const defaultEngin =
      (focusedEnginId ? fleet.find((e) => e.id === focusedEnginId) : fleet[0]) ?? null;
    setFormEnginId(defaultEngin?.id ?? '');
    setFormTargetHours(
      defaultEngin ? String(Math.ceil((defaultEngin.engineHours + 250) / 50) * 50) : '1000'
    );
    setFormTitle('');
    setFormWorkshop('');
    setFormNotes('');
    setFormCompleted(false);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleEnginChangeInModal = (nextId: string) => {
    setFormEnginId(nextId);
    const eng = fleet.find((e) => e.id === nextId);
    if (eng) {
      setFormTargetHours(String(Math.ceil((eng.engineHours + 250) / 50) * 50));
    }
  };

  const handleExportMaintenanceCsv = () => {
    const csv = exportMaintenanceToCsv(filteredRecords);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ivoiretrack-maintenance-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSubmitNewMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    const candidate: NewMaintenanceInput = {
      enginId: formEnginId,
      serviceType: formServiceType,
      title: formTitle,
      workshopOrTechnician: formWorkshop,
      targetEngineHours: Number(formTargetHours),
      costFcfa: Number(formCostFcfa),
      notes: formNotes,
      completed: formCompleted,
    };

    const validation = validateNewMaintenanceInput(candidate, fleet);
    if (Object.keys(validation).length > 0) {
      setFormErrors(validation);
      return;
    }

    onAddMaintenance(candidate);
    setIsModalOpen(false);
    setFormErrors({});
  };

  const renderStatusIndicator = (rec: EvaluatedMaintenanceRecord) => {
    if (rec.status === MaintenanceStatus.OVERDUE) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
          <AlertOctagon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          En retard (+{Math.abs(rec.hoursDelta).toFixed(1)} h dépassées)
        </span>
      );
    }
    if (rec.status === MaintenanceStatus.PENDING) {
      if (rec.isUrgentPending) {
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            À venir proche (dans {rec.hoursDelta.toFixed(1)} h)
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          À venir (dans {rec.hoursDelta.toFixed(1)} h)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Terminée (à {(rec.completedAtEngineHours ?? rec.targetEngineHours).toFixed(1)} h)
      </span>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-8">
      {/* Structured 4-Column Horameter Maintenance KPI Strip */}
      <section
        aria-label="Synthèse des alertes et coûts de maintenance"
        className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
      >
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Alertes en retard (Overdue)</p>
          <p
            className={`mt-1 text-2xl font-bold font-mono tabular-nums ${
              metrics.overdueCount > 0 ? 'text-red-700' : 'text-slate-900'
            }`}
          >
            {metrics.overdueCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">Seuil horamètre moteur dépassé</p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Entretiens à venir (Pending)</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {metrics.pendingCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Dont {metrics.urgentPendingCount} échéance(s) &le; 50 h moteur
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Interventions terminées</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {metrics.completedCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">Historique atelier clôturé</p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Coût prévisionnel / réalisé</p>
          <p className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900">
            {metrics.plannedOrOverdueCostFcfa.toLocaleString('fr-FR')} FCFA
          </p>
          <p className="mt-1 text-xs font-mono tabular-nums text-slate-500">
            Réalisé : {metrics.completedCostFcfa.toLocaleString('fr-FR')} FCFA
          </p>
        </div>
      </section>

      {/* Focused Engin Banner when inspecting a single machine's history */}
      {focusedEngin && (
        <section
          aria-label={`Fiche horamètre de ${focusedEngin.name}`}
          className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="p-2.5 rounded-lg bg-slate-100 text-slate-800 shrink-0">
              <CategoryIcon category={focusedEngin.category} className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">
                Carnet individuel · {CATEGORY_LABELS[focusedEngin.category]} ·{' '}
                {focusedEngin.locationLabel}
              </p>
              <h2 className="text-base font-bold text-slate-900 truncate">
                {focusedEngin.name} ({focusedEngin.plateOrSerial})
              </h2>
              <p className="text-xs font-mono tabular-nums text-slate-700 mt-0.5">
                Horamètre actuel : <strong>{focusedEngin.engineHours.toFixed(1)} h</strong> ·
                Prochain seuil : <strong>{focusedEngin.nextMaintenanceHours} h</strong> ·
                Kilométrage : {Math.round(focusedEngin.odometerKm).toLocaleString('fr-FR')} km
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onLocateOnMap(focusedEngin.id)}
              className="py-2 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
              Voir sur la carte
            </button>
            <button
              type="button"
              onClick={() => onSelectFocusedEngin(null)}
              className="py-2 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 cursor-pointer whitespace-nowrap"
            >
              Afficher tout le parc
            </button>
          </div>
        </section>
      )}

      {/* Filter Toolbar & Primary Action */}
      <section className="space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {/* Per-Engin Selector */}
            <div className="min-w-[250px]">
              <label htmlFor="maintenance-engin-select" className="sr-only">
                Filtrer l’historique par engin
              </label>
              <select
                id="maintenance-engin-select"
                value={focusedEnginId ?? 'ALL'}
                onChange={(e) =>
                  onSelectFocusedEngin(e.target.value === 'ALL' ? null : e.target.value)
                }
                className="w-full py-2 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
              >
                <option value="ALL">Tous les engins ({fleet.length})</option>
                {fleet.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.plateOrSerial} — {e.name} ({e.engineHours.toFixed(1)} h)
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <label htmlFor="maintenance-search-input" className="sr-only">
                Rechercher un entretien ou atelier
              </label>
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="maintenance-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Atelier, opération, plaque CI..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
            </div>

            {/* Status Filter Segmented Buttons */}
            <div
              role="group"
              aria-label="Filtrer par état d'avancement"
              className="flex flex-wrap items-center gap-1.5"
            >
              {[
                { id: 'ALL' as const, label: `Toutes (${scopedToEngin.length})` },
                {
                  id: MaintenanceStatus.OVERDUE,
                  label: `En retard (${metrics.overdueCount})`,
                },
                {
                  id: MaintenanceStatus.PENDING,
                  label: `À venir (${metrics.pendingCount})`,
                },
                {
                  id: MaintenanceStatus.COMPLETED,
                  label: `Terminées (${metrics.completedCount})`,
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

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportMaintenanceCsv}
              className="py-2 px-3.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              Exporter CSV
            </button>
            <button
              type="button"
              onClick={openNewMaintenanceModal}
              className="py-2 px-4 rounded-lg bg-orange-700 hover:bg-orange-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Planifier un entretien
            </button>
          </div>
        </div>

        {/* Maintenance History & Service Alerts Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {filteredRecords.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-base font-bold text-slate-900">
                Aucune fiche d’entretien à afficher
              </p>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Aucune opération ne correspond aux filtres actifs pour cette sélection d’engins.
              </p>
              <div className="pt-2 flex items-center justify-center gap-3">
                {(statusFilter !== 'ALL' || searchQuery || focusedEnginId) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('ALL');
                      setSearchQuery('');
                      onSelectFocusedEngin(null);
                    }}
                    className="py-2 px-4 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
                <button
                  type="button"
                  onClick={openNewMaintenanceModal}
                  className="py-2 px-4 rounded-lg bg-orange-700 hover:bg-orange-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Planifier un entretien
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">État & Échéance Horamètre</th>
                    <th className="py-3 px-4">Engin</th>
                    <th className="py-3 px-4">Intervention & Atelier</th>
                    <th className="py-3 px-4 text-right">Horamètre (Actuel / Cible)</th>
                    <th className="py-3 px-4 text-right">Coût (FCFA)</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filteredRecords.map((rec) => {
                    const ratioPct = Math.min(
                      100,
                      Math.max(
                        8,
                        Math.round((rec.currentEngineHours / rec.targetEngineHours) * 100)
                      )
                    );
                    return (
                      <tr
                        key={rec.id}
                        className={`transition-colors ${
                          rec.status === MaintenanceStatus.OVERDUE
                            ? 'bg-red-50/25 hover:bg-red-50/40'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3.5 px-4 align-top">
                          {renderStatusIndicator(rec)}
                          <p className="text-slate-500 font-mono tabular-nums mt-1">
                            {rec.completed ? 'Clôturé le ' : 'Prévu le '}
                            {new Date(rec.scheduledOrCompletedDateIso).toLocaleDateString(
                              'fr-FR'
                            )}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 align-top">
                          <div className="flex items-start gap-2">
                            <span className="text-slate-600 mt-0.5 shrink-0">
                              <CategoryIcon category={rec.category} className="w-4 h-4" />
                            </span>
                            <div>
                              <button
                                type="button"
                                onClick={() => onSelectFocusedEngin(rec.enginId)}
                                className="font-semibold text-slate-900 hover:text-orange-700 text-left cursor-pointer"
                              >
                                {rec.enginName}
                              </button>
                              <p className="font-mono text-slate-600 tabular-nums mt-0.5">
                                {rec.plateOrSerial} · {CATEGORY_LABELS[rec.category]}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 align-top max-w-md">
                          <p className="font-semibold text-slate-900">{rec.title}</p>
                          <p className="text-slate-600 mt-0.5">
                            {MAINTENANCE_TYPE_LABELS[rec.serviceType]} ·{' '}
                            <span className="font-medium text-slate-800">
                              {rec.workshopOrTechnician}
                            </span>
                          </p>
                          {rec.notes && (
                            <p className="text-slate-500 mt-1 leading-relaxed">{rec.notes}</p>
                          )}
                        </td>

                        <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums whitespace-nowrap">
                          <div>
                            <span className="font-semibold text-slate-900">
                              {rec.currentEngineHours.toFixed(1)} h
                            </span>
                            <span className="text-slate-500">
                              {' '}
                              / {rec.targetEngineHours.toLocaleString('fr-FR')} h
                            </span>
                          </div>
                          {!rec.completed && (
                            <div className="w-28 ml-auto mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  rec.status === MaintenanceStatus.OVERDUE
                                    ? 'bg-red-600'
                                    : rec.isUrgentPending
                                    ? 'bg-amber-600'
                                    : 'bg-slate-800'
                                }`}
                                style={{ width: `${ratioPct}%` }}
                              />
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                          {rec.costFcfa.toLocaleString('fr-FR')} FCFA
                        </td>

                        <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {!rec.completed && (
                              <button
                                type="button"
                                onClick={() => onCompleteMaintenance(rec.id)}
                                aria-label={`Valider l'intervention ${rec.title} sur ${rec.plateOrSerial}`}
                                className="px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                Valider
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onLocateOnMap(rec.enginId)}
                              aria-label={`Localiser ${rec.enginName} sur la carte`}
                              className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                              <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteMaintenance(rec.id)}
                              aria-label={`Supprimer l'entrée de maintenance ${rec.title}`}
                              className="p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
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

      {/* Accessible Modal to Schedule or Record a Maintenance Operation */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-maintenance-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <Wrench className="w-4 h-4 text-orange-700 shrink-0" aria-hidden="true" />
                <div>
                  <h2
                    id="add-maintenance-dialog-title"
                    className="text-base font-bold text-slate-900"
                  >
                    Planifier ou enregistrer un entretien moteur
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Suivi préventif basé sur le compteur horamètre GPS de l’engin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Fermer la fenêtre d'entretien"
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmitNewMaintenance} noValidate className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="mnt-engin-select"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Engin concerné *
                  </label>
                  <select
                    id="mnt-engin-select"
                    value={formEnginId}
                    onChange={(e) => handleEnginChangeInModal(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  >
                    {fleet.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.plateOrSerial} — {e.name} (Horamètre actuel : {e.engineHours.toFixed(1)}{' '}
                        h)
                      </option>
                    ))}
                  </select>
                  {formErrors.enginId && (
                    <p className="mt-1 text-xs text-red-700">{formErrors.enginId}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="mnt-title-input"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Intitulé de l’intervention *
                  </label>
                  <input
                    id="mnt-title-input"
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Ex: Vidange 5 250 h, remplacement filtres gasoil & hydraulique"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                  {formErrors.title && (
                    <p className="mt-1 text-xs text-red-700">{formErrors.title}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="mnt-type-select"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Famille d’intervention *
                  </label>
                  <select
                    id="mnt-type-select"
                    value={formServiceType}
                    onChange={(e) =>
                      setFormServiceType(e.target.value as MaintenanceServiceType)
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  >
                    {Object.entries(MAINTENANCE_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="mnt-workshop-input"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Atelier ou technicien *
                  </label>
                  <input
                    id="mnt-workshop-input"
                    type="text"
                    value={formWorkshop}
                    onChange={(e) => setFormWorkshop(e.target.value)}
                    placeholder="Ex: Tractafric Abidjan / Atelier Vridi"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                  {formErrors.workshopOrTechnician && (
                    <p className="mt-1 text-xs text-red-700">
                      {formErrors.workshopOrTechnician}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="mnt-hours-input"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Seuil horamètre cible (heures) *
                  </label>
                  <input
                    id="mnt-hours-input"
                    type="number"
                    min={1}
                    step="0.5"
                    value={formTargetHours}
                    onChange={(e) => setFormTargetHours(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                  {formErrors.targetEngineHours && (
                    <p className="mt-1 text-xs text-red-700">
                      {formErrors.targetEngineHours}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="mnt-cost-input"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Coût estimé ou facturé (FCFA) *
                  </label>
                  <input
                    id="mnt-cost-input"
                    type="number"
                    min={0}
                    step={5000}
                    value={formCostFcfa}
                    onChange={(e) => setFormCostFcfa(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                  {formErrors.costFcfa && (
                    <p className="mt-1 text-xs text-red-700">{formErrors.costFcfa}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="mnt-notes-input"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Observations techniques / Pièces remplacées
                  </label>
                  <textarea
                    id="mnt-notes-input"
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Références filtres, grade d’huile, rapport sonde carburant..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formCompleted}
                      onChange={(e) => setFormCompleted(e.target.checked)}
                      className="rounded border-slate-300 text-orange-600 focus:ring-orange-600"
                    />
                    Marquer comme intervention déjà effectuée et clôturée
                  </label>
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
                  Enregistrer la fiche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
