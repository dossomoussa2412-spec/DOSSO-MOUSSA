import React, { useMemo, useState } from 'react';
import { Download, Lock, MapPin, Plus, Search, Trash2, Unlock, Wrench } from 'lucide-react';
import { Engin, EnginCategory, EnginStatus } from '../types/fleet';
import {
  CATEGORY_LABELS,
  FleetMetrics,
  exportFleetToCsv,
} from '../utils/telemetry';
import { CategoryIcon, StatusIndicator } from './EnginIcons';

interface FleetInventoryViewProps {
  fleet: Engin[];
  metrics: FleetMetrics;
  onLocateOnMap: (enginId: string) => void;
  onOpenMaintenanceLog: (enginId: string) => void;
  onToggleImmobilizer: (enginId: string, activate: boolean) => void;
  onDeleteEngin: (enginId: string) => void;
  onOpenAddModal: () => void;
}

export function FleetInventoryView({
  fleet,
  metrics,
  onLocateOnMap,
  onOpenMaintenanceLog,
  onToggleImmobilizer,
  onDeleteEngin,
  onOpenAddModal,
}: FleetInventoryViewProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | EnginCategory>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | EnginStatus>('ALL');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fleet.filter((e) => {
      if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;
      if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.plateOrSerial.toLowerCase().includes(q) ||
        e.imei.includes(q) ||
        e.driverName.toLowerCase().includes(q) ||
        e.locationLabel.toLowerCase().includes(q)
      );
    });
  }, [fleet, search, categoryFilter, statusFilter]);

  const handleDownloadCsv = () => {
    const csvContent = exportFleetToCsv(filtered);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ivoiretrack-parc-engins-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-8">
      {/* Structured 4-Column Stat Strip (Single-Elevation Hairline Grid, No Nested Cards) */}
      <section
        aria-label="Indicateurs globaux du parc"
        className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
      >
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Total engins équipés</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {metrics.totalEngins}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {metrics.movingCount} en route · {metrics.workingIdleCount} en travail chantier
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Volume carburant sondé</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {metrics.totalFuelLitersAvailable.toLocaleString('fr-FR')} L
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Moyenne remplissage : {metrics.averageFuelPercent}%
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Coupe-circuits engagés</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {metrics.immobilizedCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">Relais démarrage bloqués à distance</p>
        </div>
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Maintenances proches (&le; 60 h)</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {metrics.maintenanceDueSoonCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">Suivi préventif par horamètre</p>
        </div>
      </section>

      {/* Filter & Export Toolbar */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <label htmlFor="inventory-search" className="sr-only">
                Rechercher dans l’inventaire
              </label>
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="inventory-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher plaque CI, IMEI, engin, chauffeur..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
            </div>

            <div>
              <label htmlFor="inventory-category-filter" className="sr-only">
                Filtrer par catégorie
              </label>
              <select
                id="inventory-category-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | EnginCategory)}
                className="py-2 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-600"
              >
                <option value="ALL">Toutes les catégories</option>
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="inventory-status-filter" className="sr-only">
                Filtrer par statut
              </label>
              <select
                id="inventory-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | EnginStatus)}
                className="py-2 px-3 text-sm bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-600"
              >
                <option value="ALL">Tous les statuts</option>
                <option value={EnginStatus.EN_MOUVEMENT}>En mouvement</option>
                <option value={EnginStatus.RALENTI_CHANTIER}>En travail / Ralenti</option>
                <option value={EnginStatus.STATIONNE}>Stationné</option>
                <option value={EnginStatus.COUPE_CIRCUIT}>Moteur coupé</option>
                <option value={EnginStatus.ALERTE}>Alerte active</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={filtered.length === 0}
            className="py-2 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Exporter CSV ({filtered.length})
          </button>
        </div>

        {/* High-Density Data Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-base font-bold text-slate-900">Aucun engin trouvé</p>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Aucun engin ne correspond aux critères sélectionnés, ou votre parc est vide.
              </p>
              <div className="pt-2 flex items-center justify-center gap-3">
                {(search || categoryFilter !== 'ALL' || statusFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setCategoryFilter('ALL');
                      setStatusFilter('ALL');
                    }}
                    className="py-2 px-4 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenAddModal}
                  className="py-2 px-4 rounded-lg bg-orange-700 hover:bg-orange-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Ajouter un engin
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Engin & Catégorie</th>
                    <th className="py-3 px-4">Plaque / Boîtier IMEI</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4">Localisation & Chauffeur</th>
                    <th className="py-3 px-4 text-right">Vitesse</th>
                    <th className="py-3 px-4 text-right">Carburant</th>
                    <th className="py-3 px-4 text-right">Horamètre</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {filtered.map((engin) => {
                    const liters = Math.round(
                      (engin.fuelLevelPercent / 100) * engin.fuelCapacityLiters
                    );
                    const hoursRemaining = Math.round(
                      engin.nextMaintenanceHours - engin.engineHours
                    );
                    return (
                      <tr key={engin.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className="text-slate-600 shrink-0">
                              <CategoryIcon category={engin.category} className="w-4 h-4" />
                            </span>
                            <div>
                              <p className="font-semibold text-slate-900">{engin.name}</p>
                              <p className="text-slate-500">
                                {CATEGORY_LABELS[engin.category]} · {engin.simOperator}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums">
                          <p className="font-semibold text-slate-900">{engin.plateOrSerial}</p>
                          <p className="text-slate-500">{engin.imei}</p>
                        </td>
                        <td className="py-3 px-4">
                          <StatusIndicator status={engin.status} />
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-800">{engin.locationLabel}</p>
                          <p className="text-slate-500">
                            {engin.driverName} · {engin.driverPhone}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 font-semibold whitespace-nowrap">
                          {engin.speedKmh} km/h
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                          <span
                            className={
                              engin.fuelLevelPercent <= 25
                                ? 'text-red-700 font-semibold'
                                : 'text-slate-900 font-semibold'
                            }
                          >
                            {engin.fuelLevelPercent}%
                          </span>
                          <span className="block text-slate-500">
                            {liters} / {engin.fuelCapacityLiters} L
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                          <span className="font-semibold text-slate-900">
                            {engin.engineHours.toFixed(1)} h
                          </span>
                          <span
                            className={`block ${
                              hoursRemaining <= 60 ? 'text-amber-700 font-semibold' : 'text-slate-500'
                            }`}
                          >
                            Rév. dans {hoursRemaining} h
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onLocateOnMap(engin.id)}
                              aria-label={`Localiser ${engin.name} sur la carte`}
                              className="px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1 font-medium cursor-pointer"
                            >
                              <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                              Carte
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenMaintenanceLog(engin.id)}
                              aria-label={`Ouvrir le carnet de maintenance de ${engin.name}`}
                              className="px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1 font-medium cursor-pointer"
                            >
                              <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                              Suivi h
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onToggleImmobilizer(engin.id, !engin.immobilizerActive)
                              }
                              aria-label={
                                engin.immobilizerActive
                                  ? `Rétablir moteur de ${engin.name}`
                                  : `Couper moteur de ${engin.name}`
                              }
                              className={`p-1.5 rounded-md border cursor-pointer ${
                                engin.immobilizerActive
                                  ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                  : 'border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-700'
                              }`}
                            >
                              {engin.immobilizerActive ? (
                                <Unlock className="w-3.5 h-3.5" aria-hidden="true" />
                              ) : (
                                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteEngin(engin.id)}
                              aria-label={`Supprimer ${engin.name} du parc`}
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
    </div>
  );
}
