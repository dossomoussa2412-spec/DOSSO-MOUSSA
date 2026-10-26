import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  BarChart3,
  Bell,
  Check,
  CheckCheck,
  Download,
  Info,
  MapPin,
} from 'lucide-react';
import {
  AlertSeverity,
  AlertType,
  Engin,
  EnginCategory,
  FleetAlert,
  FuelDailyLog,
  NewFuelLogInput,
} from '../types/fleet';
import {
  CATEGORY_LABELS,
  computeFuelConsumptionSummary,
  evaluateFleetFuelConsumption,
  exportAlertsToCsv,
  resolveFuelPeriodBounds,
} from '../utils/telemetry';
import { REFERENCE_TODAY_ISO } from '../data/seedFleet';
import { FuelConsumptionPanel } from './FuelConsumptionPanel';

interface AlertsFuelViewProps {
  alerts: FleetAlert[];
  fleet: Engin[];
  fuelLogs: FuelDailyLog[];
  onAddFuelLog: (input: NewFuelLogInput) => void;
  onAcknowledgeAlert: (alertId: string) => void;
  onAcknowledgeAll: () => void;
  onLocateEngin: (enginId: string) => void;
  onOpenMaintenanceForEngin: (enginId: string) => void;
}

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  [AlertType.SIPHONAGE_CARBURANT]: 'Siphonage carburant',
  [AlertType.SORTIE_ZONE]: 'Géorepérage (Zone)',
  [AlertType.EXCES_VITESSE]: 'Excès de vitesse',
  [AlertType.COUPURE_MOTEUR]: 'Coupe-circuit moteur',
  [AlertType.BATTERIE_EXTERNE]: 'Maintenance & Batterie',
};

export function AlertsFuelView({
  alerts,
  fleet,
  fuelLogs,
  onAddFuelLog,
  onAcknowledgeAlert,
  onAcknowledgeAll,
  onLocateEngin,
  onOpenMaintenanceForEngin,
}: AlertsFuelViewProps) {
  const [subView, setSubView] = useState<'alerts_probes' | 'consumption'>('alerts_probes');
  const [filterType, setFilterType] = useState<'ALL' | AlertType>('ALL');
  const [onlyUnread, setOnlyUnread] = useState(false);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (onlyUnread && a.acknowledged) return false;
      if (filterType !== 'ALL' && a.type !== filterType) return false;
      return true;
    });
  }, [alerts, filterType, onlyUnread]);

  const unreadCount = useMemo(
    () => alerts.filter((a) => !a.acknowledged).length,
    [alerts]
  );

  const default30dSummary = useMemo(() => {
    const bounds = resolveFuelPeriodBounds('30D', REFERENCE_TODAY_ISO);
    const rows = evaluateFleetFuelConsumption(
      fleet,
      fuelLogs,
      bounds.startIso,
      bounds.endIso,
      15
    );
    return computeFuelConsumptionSummary(rows);
  }, [fleet, fuelLogs]);

  // Fuel & Horameter breakdown by EnginCategory
  const categoryBreakdown = useMemo(() => {
    const categories = Object.values(EnginCategory);
    return categories
      .map((cat) => {
        const items = fleet.filter((e) => e.category === cat);
        const totalCap = items.reduce((acc, e) => acc + e.fuelCapacityLiters, 0);
        const currentLiters = items.reduce(
          (acc, e) => acc + (e.fuelLevelPercent / 100) * e.fuelCapacityLiters,
          0
        );
        const totalHours = items.reduce((acc, e) => acc + e.engineHours, 0);
        return {
          category: cat,
          label: CATEGORY_LABELS[cat],
          count: items.length,
          currentLiters: Math.round(currentLiters),
          totalCap,
          fillPct: totalCap > 0 ? Math.round((currentLiters / totalCap) * 100) : 0,
          totalHours: Number(totalHours.toFixed(1)),
        };
      })
      .filter((row) => row.count > 0);
  }, [fleet]);

  const renderSeverityLabel = (severity: AlertSeverity) => {
    switch (severity) {
      case AlertSeverity.CRITIQUE:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 whitespace-nowrap">
            <AlertOctagon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            Critique
          </span>
        );
      case AlertSeverity.ATTENTION:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 whitespace-nowrap">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            Attention
          </span>
        );
      case AlertSeverity.INFO:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 whitespace-nowrap">
            <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            Information
          </span>
        );
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Sub-view Switcher within Alertes & Carburant */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div
          role="tablist"
          aria-label="Vues Alertes et Carburant"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-200/75 rounded-lg"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subView === 'alerts_probes'}
            onClick={() => setSubView('alerts_probes')}
            className={`px-3.5 py-2 rounded-md text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subView === 'alerts_probes'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bell className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Journal d’alertes & Sondes ({unreadCount})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subView === 'consumption'}
            onClick={() => setSubView('consumption')}
            className={`px-3.5 py-2 rounded-md text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subView === 'consumption'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              Consommation & Surconsommations ({default30dSummary.overconsumingCount})
            </span>
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Suivi télémétrique sondes capacitives LLS, CAN-Bus et alertes sécurité
        </p>
      </div>

      {subView === 'consumption' ? (
        <FuelConsumptionPanel
          fleet={fleet}
          fuelLogs={fuelLogs}
          onAddFuelLog={onAddFuelLog}
          onLocateEngin={onLocateEngin}
          onOpenMaintenanceForEngin={onOpenMaintenanceForEngin}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 7 columns: Security & Fuel Incident Feed */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Journal de sécurité & alertes ({unreadCount} non acquittée
                {unreadCount > 1 ? 's' : ''})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Surveillance anti-siphonage, survitesse, batterie et sorties de zone
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const csv = exportAlertsToCsv(filteredAlerts);
                  const blob = new Blob([`\uFEFF${csv}`], {
                    type: 'text/csv;charset=utf-8;',
                  });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `ivoiretrack-alertes-${REFERENCE_TODAY_ISO}.csv`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                }}
                className="py-1.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                Exporter CSV
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onAcknowledgeAll}
                  className="py-1.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  Tout acquitter
                </button>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer ${
                  filterType === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                Toutes
              </button>
              {Object.entries(ALERT_TYPE_LABELS).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilterType(type as AlertType)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer ${
                    filterType === type
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={onlyUnread}
                onChange={(e) => setOnlyUnread(e.target.checked)}
                className="rounded border-slate-300 text-orange-600 focus:ring-orange-600"
              />
              Non lues uniquement
            </label>
          </div>

          {/* Alert Rows (Hairline Dividers, Zero Thick Left Accent Bars) */}
          {filteredAlerts.length === 0 ? (
            <div className="p-10 text-center space-y-1">
              <p className="text-sm font-semibold text-slate-800">Aucune alerte dans cette vue</p>
              <p className="text-xs text-slate-500">
                Toutes les sondes carburant et balises GPS fonctionnent normalement.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-5 transition-colors ${
                    alert.acknowledged ? 'bg-white opacity-75' : 'bg-orange-50/25'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-500">
                        {renderSeverityLabel(alert.severity)}
                        <span aria-hidden="true">·</span>
                        <span>{ALERT_TYPE_LABELS[alert.type]}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono font-semibold text-slate-800 tabular-nums">
                          {alert.plateOrSerial}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {new Date(alert.timestampIso).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900">{alert.title}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">{alert.description}</p>
                      <p className="text-xs text-slate-500 pt-0.5">
                        {alert.enginName} — {alert.locationLabel}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {!alert.acknowledged ? (
                        <button
                          type="button"
                          onClick={() => onAcknowledgeAlert(alert.id)}
                          aria-label={`Acquitter l'alerte ${alert.title}`}
                          className="py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          Acquitter
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-700 font-medium">Acquittée</span>
                      )}

                      <button
                        type="button"
                        onClick={() => onLocateEngin(alert.enginId)}
                        className="text-xs text-orange-700 hover:text-orange-800 font-medium inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <MapPin className="w-3 h-3" aria-hidden="true" />
                        Inspecter engin
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right 5 columns: Fuel Probes & Engine Hours Summary by Category */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">
              Bilan Sondes Carburant & Horamètres
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Stock mesuré dans les cuves et cumul d’heures par famille d’engins
            </p>
          </div>

          <div className="divide-y divide-slate-200">
            {categoryBreakdown.map((item) => (
              <div key={item.category} className="p-5 space-y-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{item.label}</h3>
                    <p className="text-xs text-slate-500">
                      {item.count} engin{item.count > 1 ? 's' : ''} · Cumul{' '}
                      <span className="font-mono tabular-nums font-medium text-slate-700">
                        {item.totalHours.toLocaleString('fr-FR')} h
                      </span>
                    </p>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <span className="text-sm font-bold text-slate-900">
                      {item.currentLiters.toLocaleString('fr-FR')} L
                    </span>
                    <span className="text-xs text-slate-500">
                      {' '}
                      / {item.totalCap.toLocaleString('fr-FR')} L ({item.fillPct}%)
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-transform ${
                      item.fillPct <= 30 ? 'bg-red-600' : 'bg-slate-800'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(4, item.fillPct))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-600">
              <strong className="font-mono tabular-nums text-red-700">
                {default30dSummary.overconsumingCount} engin
                {default30dSummary.overconsumingCount > 1 ? 's' : ''}
              </strong>{' '}
              en surconsommation sur les 30 derniers jours
            </p>
            <button
              type="button"
              onClick={() => setSubView('consumption')}
              className="py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
              Analyser consommations
            </button>
          </div>
        </section>
      </div>
      )}
    </div>
  );
}
