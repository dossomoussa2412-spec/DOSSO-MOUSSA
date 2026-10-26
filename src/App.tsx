/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import {
  Bell,
  Compass,
  Download,
  Menu,
  Plus,
  RotateCcw,
  Shield,
  Truck,
  Wrench,
  X,
} from 'lucide-react';
import {
  ActiveWorkspaceView,
  AlertSeverity,
  AlertType,
  Engin,
  EnginStatus,
  FleetAlert,
  FleetBackupBundle,
  FuelDailyLog,
  GeofenceZone,
  MaintenanceRecord,
  NewEnginInput,
  NewFuelLogInput,
  NewMaintenanceInput,
} from './types/fleet';
import {
  GROUNDED_CI_HUBS,
  INITIAL_ALERTS,
  INITIAL_FLEET,
  INITIAL_FUEL_LOGS,
  INITIAL_GEOFENCES,
  INITIAL_MAINTENANCE_LOGS,
} from './data/seedFleet';
import {
  computeFleetMetrics,
  computeMaintenanceMetrics,
  computeNextMaintenanceHoursForEngin,
  evaluateMaintenanceLogs,
  stepEnginTelemetry,
  toggleEnginImmobilizer,
} from './utils/telemetry';
import { MapWorkspace } from './components/MapWorkspace';
import { FleetInventoryView } from './components/FleetInventoryView';
import { MaintenanceLogView } from './components/MaintenanceLogView';
import { GeofencingView } from './components/GeofencingView';
import { AlertsFuelView } from './components/AlertsFuelView';
import { ExportCenterView } from './components/ExportCenterView';
import { AddEnginModal } from './components/AddEnginModal';

const STORAGE_KEYS = {
  FLEET: 'ivoiretrack_fleet_v1',
  GEOFENCES: 'ivoiretrack_geofences_v1',
  ALERTS: 'ivoiretrack_alerts_v1',
  MAINTENANCE: 'ivoiretrack_maintenance_v1',
  FUEL_LOGS: 'ivoiretrack_fuel_logs_v1',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const VIEW_LABELS: Record<ActiveWorkspaceView, string> = {
  map: 'Carte & Suivi Live',
  fleet: "Parc d'Engins",
  maintenance: 'Carnet de Maintenance',
  geofencing: 'Géorepérage (Zones)',
  alerts: 'Alertes & Carburant',
  exports: 'Exports & Rapports',
};

export default function App() {
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);
  const [activeView, setActiveView] = useState<ActiveWorkspaceView>('map');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [simulationRunning, setSimulationRunning] = useState(true);

  const [fleet, setFleet] = useState<Engin[]>(() =>
    loadFromStorage<Engin[]>(STORAGE_KEYS.FLEET, INITIAL_FLEET)
  );
  const [geofences, setGeofences] = useState<GeofenceZone[]>(() =>
    loadFromStorage<GeofenceZone[]>(STORAGE_KEYS.GEOFENCES, INITIAL_GEOFENCES)
  );
  const [alerts, setAlerts] = useState<FleetAlert[]>(() =>
    loadFromStorage<FleetAlert[]>(STORAGE_KEYS.ALERTS, INITIAL_ALERTS)
  );
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceRecord[]>(() =>
    loadFromStorage<MaintenanceRecord[]>(STORAGE_KEYS.MAINTENANCE, INITIAL_MAINTENANCE_LOGS)
  );
  const [fuelLogs, setFuelLogs] = useState<FuelDailyLog[]>(() =>
    loadFromStorage<FuelDailyLog[]>(STORAGE_KEYS.FUEL_LOGS, INITIAL_FUEL_LOGS)
  );
  const [focusedMaintenanceEnginId, setFocusedMaintenanceEnginId] = useState<string | null>(
    null
  );
  const [selectedEnginId, setSelectedEnginId] = useState<string | null>(
    () => INITIAL_FLEET[0]?.id ?? null
  );

  // Listen to global Google Maps Platform Demo Key Quota Event (Case A)
  useEffect(() => {
    const handleQuota = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Persist changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.FLEET, JSON.stringify(fleet));
    } catch {
      // Ignore storage quota errors
    }
  }, [fleet]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.GEOFENCES, JSON.stringify(geofences));
    } catch {
      // Ignore
    }
  }, [geofences]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(alerts));
    } catch {
      // Ignore
    }
  }, [alerts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MAINTENANCE, JSON.stringify(maintenanceLogs));
    } catch {
      // Ignore
    }
  }, [maintenanceLogs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.FUEL_LOGS, JSON.stringify(fuelLogs));
    } catch {
      // Ignore
    }
  }, [fuelLogs]);

  // Live deterministic GPS telemetry loop (every 3.5s)
  useEffect(() => {
    if (!simulationRunning) return;
    let tick = 0;
    const interval = window.setInterval(() => {
      tick += 1;
      const nowIso = new Date().toISOString();
      setFleet((prev) => prev.map((engin) => stepEnginTelemetry(engin, tick, nowIso)));
    }, 3500);
    return () => window.clearInterval(interval);
  }, [simulationRunning]);

  const metrics = useMemo(() => computeFleetMetrics(fleet, alerts), [fleet, alerts]);
  const maintenanceSummary = useMemo(
    () => computeMaintenanceMetrics(evaluateMaintenanceLogs(maintenanceLogs, fleet)),
    [maintenanceLogs, fleet]
  );

  const handleToggleImmobilizer = useCallback((enginId: string, activate: boolean) => {
    const nowIso = new Date().toISOString();
    setFleet((prev) =>
      prev.map((engin) => {
        if (engin.id !== enginId) return engin;
        const updated = toggleEnginImmobilizer(engin, activate, nowIso);
        const newAlert: FleetAlert = {
          id: `alt-${Date.now()}`,
          enginId: engin.id,
          enginName: engin.name,
          plateOrSerial: engin.plateOrSerial,
          type: AlertType.COUPURE_MOTEUR,
          severity: activate ? AlertSeverity.CRITIQUE : AlertSeverity.INFO,
          title: activate
            ? `Coupe-circuit activé à distance sur ${engin.plateOrSerial}`
            : `Allumage moteur rétabli sur ${engin.plateOrSerial}`,
          description: activate
            ? `Commande GPRS/SMS envoyée via ${engin.simOperator}. Démarrage verrouillé.`
            : 'Relais coupe-circuit déverrouillé par le superviseur.',
          locationLabel: engin.locationLabel,
          timestampIso: nowIso,
          acknowledged: false,
        };
        setAlerts((curr) => [newAlert, ...curr]);
        return updated;
      })
    );
  }, []);

  const handleAddEngin = useCallback((input: NewEnginInput) => {
    const hub = GROUNDED_CI_HUBS.find((h) => h.id === input.hubId) ?? GROUNDED_CI_HUBS[0];
    const nowIso = new Date().toISOString();
    const created: Engin = {
      id: `eng-${Date.now()}`,
      name: input.name.trim(),
      plateOrSerial: input.plateOrSerial.trim().toUpperCase(),
      category: input.category,
      status: EnginStatus.STATIONNE,
      imei: input.imei.replace(/\s+/g, ''),
      trackerModel: input.trackerModel,
      simOperator: input.simOperator,
      gsmSignalPercent: 92,
      driverName: input.driverName.trim(),
      driverPhone: input.driverPhone.trim(),
      hubId: hub.id,
      locationLabel: `${hub.name}, ${hub.city}`,
      position: {
        lat: Number((hub.location.lat + 0.0025).toFixed(6)),
        lng: Number((hub.location.lng + 0.0025).toFixed(6)),
      },
      heading: 0,
      speedKmh: 0,
      ignitionOn: false,
      immobilizerActive: false,
      fuelLevelPercent: 100,
      fuelCapacityLiters: input.fuelCapacityLiters,
      engineHours: 0,
      odometerKm: 0,
      externalVoltage: 24.4,
      nextMaintenanceHours: 250,
      lastUpdateIso: nowIso,
      trail: [{ lat: hub.location.lat + 0.0025, lng: hub.location.lng + 0.0025 }],
    };

    setFleet((prev) => [created, ...prev]);
    setSelectedEnginId(created.id);
  }, []);

  const handleDeleteEngin = useCallback((enginId: string) => {
    setFleet((prev) => prev.filter((e) => e.id !== enginId));
    setSelectedEnginId((curr) => (curr === enginId ? null : curr));
  }, []);

  const handleLocateOnMap = useCallback((enginId: string) => {
    setSelectedEnginId(enginId);
    setActiveView('map');
  }, []);

  const handleOpenMaintenanceForEngin = useCallback((enginId: string) => {
    setFocusedMaintenanceEnginId(enginId);
    setActiveView('maintenance');
  }, []);

  const handleCompleteMaintenance = useCallback(
    (recordId: string) => {
      const targetRec = maintenanceLogs.find((r) => r.id === recordId);
      if (!targetRec) return;

      const engin = fleet.find((e) => e.id === targetRec.enginId);
      const nowIso = new Date().toISOString();

      const nextLogs = maintenanceLogs.map((rec) =>
        rec.id === recordId
          ? {
              ...rec,
              completed: true,
              completedAtEngineHours: engin ? engin.engineHours : rec.targetEngineHours,
              scheduledOrCompletedDateIso: nowIso,
            }
          : rec
      );
      setMaintenanceLogs(nextLogs);

      if (engin) {
        const nextThreshold = computeNextMaintenanceHoursForEngin(engin, nextLogs);
        setFleet((prev) =>
          prev.map((e) =>
            e.id === engin.id ? { ...e, nextMaintenanceHours: nextThreshold } : e
          )
        );
      }
    },
    [maintenanceLogs, fleet]
  );

  const handleAddMaintenance = useCallback(
    (input: NewMaintenanceInput) => {
      const engin = fleet.find((e) => e.id === input.enginId);
      const nowIso = new Date().toISOString();
      const created: MaintenanceRecord = {
        id: `mnt-${Date.now()}`,
        enginId: input.enginId,
        serviceType: input.serviceType,
        title: input.title.trim(),
        workshopOrTechnician: input.workshopOrTechnician.trim(),
        targetEngineHours: input.targetEngineHours,
        completedAtEngineHours: input.completed
          ? engin?.engineHours ?? input.targetEngineHours
          : undefined,
        scheduledOrCompletedDateIso: nowIso,
        costFcfa: input.costFcfa,
        notes: input.notes.trim(),
        completed: input.completed,
      };

      const nextLogs = [created, ...maintenanceLogs];
      setMaintenanceLogs(nextLogs);

      if (engin && !input.completed) {
        const nextThreshold = computeNextMaintenanceHoursForEngin(engin, nextLogs);
        setFleet((prev) =>
          prev.map((e) =>
            e.id === engin.id ? { ...e, nextMaintenanceHours: nextThreshold } : e
          )
        );
      }
    },
    [fleet, maintenanceLogs]
  );

  const handleDeleteMaintenance = useCallback((recordId: string) => {
    setMaintenanceLogs((prev) => prev.filter((r) => r.id !== recordId));
  }, []);

  const handleUpdateGeofenceRadius = useCallback((zoneId: string, radiusMeters: number) => {
    setGeofences((prev) =>
      prev.map((z) => (z.id === zoneId ? { ...z, radiusMeters } : z))
    );
  }, []);

  const handleToggleGeofenceActive = useCallback((zoneId: string) => {
    setGeofences((prev) =>
      prev.map((z) => (z.id === zoneId ? { ...z, active: !z.active } : z))
    );
  }, []);

  const handleCreateGeofence = useCallback((zoneData: Omit<GeofenceZone, 'id'>) => {
    const newZone: GeofenceZone = {
      ...zoneData,
      id: `geo-${Date.now()}`,
    };
    setGeofences((prev) => [newZone, ...prev]);
  }, []);

  const handleDeleteGeofence = useCallback((zoneId: string) => {
    setGeofences((prev) => prev.filter((z) => z.id !== zoneId));
  }, []);

  const handleAcknowledgeAlert = useCallback((alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
    );
  }, []);

  const handleAcknowledgeAll = useCallback(() => {
    setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
  }, []);

  const handleAddFuelLog = useCallback((input: NewFuelLogInput) => {
    const created: FuelDailyLog = {
      id: `flog-${Date.now()}`,
      enginId: input.enginId,
      dateIso: input.dateIso,
      litersConsumed: input.litersConsumed,
      distanceKm: input.distanceKm,
      engineHoursWorked: input.engineHoursWorked,
      refueledLiters: input.refueledLiters,
      stationOrNote: input.stationOrNote || undefined,
    };
    setFuelLogs((prev) => [created, ...prev]);
  }, []);

  const handleRestoreBackup = useCallback((bundle: FleetBackupBundle) => {
    setFleet(bundle.fleet);
    setGeofences(bundle.geofences);
    setAlerts(bundle.alerts);
    setMaintenanceLogs(bundle.maintenanceLogs);
    setFuelLogs(bundle.fuelLogs);
    setFocusedMaintenanceEnginId(null);
    setSelectedEnginId(bundle.fleet[0]?.id ?? null);
  }, []);

  const handleResetDemo = useCallback(() => {
    setFleet(INITIAL_FLEET);
    setGeofences(INITIAL_GEOFENCES);
    setAlerts(INITIAL_ALERTS);
    setMaintenanceLogs(INITIAL_MAINTENANCE_LOGS);
    setFuelLogs(INITIAL_FUEL_LOGS);
    setFocusedMaintenanceEnginId(null);
    setSelectedEnginId(INITIAL_FLEET[0]?.id ?? null);
  }, []);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  const navItems: Array<{
    id: ActiveWorkspaceView;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }> = [
    {
      id: 'map',
      label: 'Carte & Suivi Live',
      icon: <Compass className="w-4 h-4 shrink-0" aria-hidden="true" />,
    },
    {
      id: 'fleet',
      label: "Parc d'Engins",
      icon: <Truck className="w-4 h-4 shrink-0" aria-hidden="true" />,
      count: metrics.totalEngins,
    },
    {
      id: 'maintenance',
      label: 'Carnet Maintenance',
      icon: <Wrench className="w-4 h-4 shrink-0" aria-hidden="true" />,
      count: maintenanceSummary.overdueCount + maintenanceSummary.urgentPendingCount,
    },
    {
      id: 'geofencing',
      label: 'Géorepérage (Zones)',
      icon: <Shield className="w-4 h-4 shrink-0" aria-hidden="true" />,
      count: geofences.filter((g) => g.active).length,
    },
    {
      id: 'alerts',
      label: 'Alertes & Carburant',
      icon: <Bell className="w-4 h-4 shrink-0" aria-hidden="true" />,
      count: metrics.unacknowledgedAlertsCount,
    },
    {
      id: 'exports',
      label: 'Exports & Rapports',
      icon: <Download className="w-4 h-4 shrink-0" aria-hidden="true" />,
    },
  ];

  return (
    <APIProvider apiKey={apiKey} language="fr" region="CI">
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        {/* Mandatory Google Maps Platform Demo Key Quota Banner (Section 8 Case A) */}
        {gmpQuotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}

        <div className="flex-1 flex flex-col md:flex-row">
          {/* Desktop Sidebar Navigation (240px) */}
          <aside className="hidden md:flex md:w-[240px] shrink-0 flex-col bg-slate-900 text-slate-200 border-r border-slate-800 print:hidden">
            <div className="h-16 px-6 flex items-center border-b border-slate-800">
              <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
                IvoireTrack GPS
              </span>
            </div>

            <nav aria-label="Navigation principale" className="flex-1 p-4 space-y-1">
              {navItems.map((item) => {
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveView(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-orange-700 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      {item.icon}
                      <span>{item.label}</span>
                    </span>
                    {item.count !== undefined && item.count > 0 && (
                      <span className="font-mono text-xs tabular-nums opacity-90">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Regional Context & Demo Reset in Sidebar Footer */}
            <div className="p-4 border-t border-slate-800 space-y-3 text-xs text-slate-400">
              <div>
                <p className="font-semibold text-slate-200">Centre Opérationnel Abidjan</p>
                <p className="mt-0.5">
                  Couverture nationale CI · BTP, Transport, Mines, Agro-industrie & Livraison
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetDemo}
                className="w-full py-2 px-3 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white inline-flex items-center justify-center gap-2 text-xs font-medium cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                Réinitialiser données démo
              </button>
            </div>
          </aside>

          {/* Main Workspace Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Strict SaaS Top Bar Contract: Breadcrumb on Left, 1 Primary CTA on Right */}
            <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-8 shrink-0 print:hidden">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((v) => !v)}
                  aria-label="Ouvrir le menu de navigation"
                  aria-expanded={mobileMenuOpen}
                  className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {mobileMenuOpen ? (
                    <X className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <Menu className="w-5 h-5" aria-hidden="true" />
                  )}
                </button>
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <span className="font-semibold text-slate-500 whitespace-nowrap hidden sm:inline">
                    IvoireTrack Côte d’Ivoire
                  </span>
                  <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                    /
                  </span>
                  <h1 className="font-display font-bold text-slate-900 truncate">
                    {VIEW_LABELS[activeView]}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="py-2 px-4 rounded-lg bg-orange-700 hover:bg-orange-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Ajouter un engin
                </button>
              </div>
            </header>

            {/* Mobile Navigation Drawer */}
            {mobileMenuOpen && (
              <nav
                aria-label="Navigation mobile"
                className="md:hidden bg-slate-900 text-slate-200 px-4 py-3 border-b border-slate-800 space-y-1"
              >
                {navItems.map((item) => {
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveView(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
                        isActive ? 'bg-orange-700 text-white' : 'text-slate-300'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        {item.icon}
                        <span>{item.label}</span>
                      </span>
                      {item.count !== undefined && item.count > 0 && (
                        <span className="font-mono text-xs tabular-nums">{item.count}</span>
                      )}
                    </button>
                  );
                })}
              </nav>
            )}

            {/* Active Workspace View */}
            <main className="flex-1 min-w-0">
              {activeView === 'map' && (
                <MapWorkspace
                  fleet={fleet}
                  geofences={geofences}
                  hubs={GROUNDED_CI_HUBS}
                  selectedEnginId={selectedEnginId}
                  onSelectEngin={setSelectedEnginId}
                  onToggleImmobilizer={handleToggleImmobilizer}
                  onOpenMaintenanceLog={handleOpenMaintenanceForEngin}
                  simulationRunning={simulationRunning}
                  onToggleSimulation={() => setSimulationRunning((v) => !v)}
                />
              )}

              {activeView === 'fleet' && (
                <FleetInventoryView
                  fleet={fleet}
                  metrics={metrics}
                  onLocateOnMap={handleLocateOnMap}
                  onOpenMaintenanceLog={handleOpenMaintenanceForEngin}
                  onToggleImmobilizer={handleToggleImmobilizer}
                  onDeleteEngin={handleDeleteEngin}
                  onOpenAddModal={() => setIsAddModalOpen(true)}
                />
              )}

              {activeView === 'maintenance' && (
                <MaintenanceLogView
                  fleet={fleet}
                  maintenanceLogs={maintenanceLogs}
                  focusedEnginId={focusedMaintenanceEnginId}
                  onSelectFocusedEngin={setFocusedMaintenanceEnginId}
                  onCompleteMaintenance={handleCompleteMaintenance}
                  onAddMaintenance={handleAddMaintenance}
                  onDeleteMaintenance={handleDeleteMaintenance}
                  onLocateOnMap={handleLocateOnMap}
                />
              )}

              {activeView === 'geofencing' && (
                <GeofencingView
                  fleet={fleet}
                  geofences={geofences}
                  hubs={GROUNDED_CI_HUBS}
                  onUpdateGeofenceRadius={handleUpdateGeofenceRadius}
                  onToggleGeofenceActive={handleToggleGeofenceActive}
                  onCreateGeofence={handleCreateGeofence}
                  onDeleteGeofence={handleDeleteGeofence}
                />
              )}

              {activeView === 'alerts' && (
                <AlertsFuelView
                  alerts={alerts}
                  fleet={fleet}
                  fuelLogs={fuelLogs}
                  onAddFuelLog={handleAddFuelLog}
                  onAcknowledgeAlert={handleAcknowledgeAlert}
                  onAcknowledgeAll={handleAcknowledgeAll}
                  onLocateEngin={handleLocateOnMap}
                  onOpenMaintenanceForEngin={handleOpenMaintenanceForEngin}
                />
              )}

              {activeView === 'exports' && (
                <ExportCenterView
                  fleet={fleet}
                  geofences={geofences}
                  alerts={alerts}
                  maintenanceLogs={maintenanceLogs}
                  fuelLogs={fuelLogs}
                  onRestoreBackup={handleRestoreBackup}
                />
              )}
            </main>
          </div>
        </div>

        {/* Add Engin Modal */}
        <AddEnginModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          existingFleet={fleet}
          hubs={GROUNDED_CI_HUBS}
          onAddEngin={handleAddEngin}
        />
      </div>
    </APIProvider>
  );
}
