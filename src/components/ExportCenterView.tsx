import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileJson,
  FileSpreadsheet,
  Printer,
  Upload,
} from 'lucide-react';
import {
  Engin,
  FleetAlert,
  FleetBackupBundle,
  FuelDailyLog,
  FuelPeriodPreset,
  GeofenceZone,
  MaintenanceRecord,
} from '../types/fleet';
import {
  DIESEL_PRICE_FCFA_PER_LITER,
  computeFleetMetrics,
  computeFuelConsumptionSummary,
  computeMaintenanceMetrics,
  evaluateFleetFuelConsumption,
  evaluateMaintenanceLogs,
  exportAlertsToCsv,
  exportFleetToCsv,
  exportFuelConsumptionToCsv,
  exportMaintenanceToCsv,
  parseFleetBackupJson,
  resolveFuelPeriodBounds,
  serializeFleetBackupJson,
} from '../utils/telemetry';
import { REFERENCE_TODAY_ISO } from '../data/seedFleet';

interface ExportCenterViewProps {
  fleet: Engin[];
  geofences: GeofenceZone[];
  alerts: FleetAlert[];
  maintenanceLogs: MaintenanceRecord[];
  fuelLogs: FuelDailyLog[];
  onRestoreBackup: (bundle: FleetBackupBundle) => void;
}

type ExportDatasetKey = 'fleet_csv' | 'fuel_csv' | 'maintenance_csv' | 'alerts_csv' | 'backup_json';

export function ExportCenterView({
  fleet,
  geofences,
  alerts,
  maintenanceLogs,
  fuelLogs,
  onRestoreBackup,
}: ExportCenterViewProps) {
  const [fuelPreset, setFuelPreset] = useState<Exclude<FuelPeriodPreset, 'CUSTOM'>>('30D');
  const [previewKey, setPreviewKey] = useState<ExportDatasetKey>('fuel_csv');
  const [copied, setCopied] = useState(false);
  const [lastExportNotice, setLastExportNotice] = useState<string | null>(null);
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fleetMetrics = useMemo(() => computeFleetMetrics(fleet, alerts), [fleet, alerts]);
  const evaluatedMaintenance = useMemo(
    () => evaluateMaintenanceLogs(maintenanceLogs, fleet),
    [maintenanceLogs, fleet]
  );
  const maintenanceSummary = useMemo(
    () => computeMaintenanceMetrics(evaluatedMaintenance),
    [evaluatedMaintenance]
  );

  const fuelBounds = useMemo(
    () => resolveFuelPeriodBounds(fuelPreset, REFERENCE_TODAY_ISO),
    [fuelPreset]
  );
  const evaluatedFuel = useMemo(
    () =>
      evaluateFleetFuelConsumption(
        fleet,
        fuelLogs,
        fuelBounds.startIso,
        fuelBounds.endIso,
        15,
        DIESEL_PRICE_FCFA_PER_LITER
      ),
    [fleet, fuelLogs, fuelBounds.startIso, fuelBounds.endIso]
  );
  const fuelSummary = useMemo(
    () => computeFuelConsumptionSummary(evaluatedFuel),
    [evaluatedFuel]
  );

  const buildDatasetPayload = (
    key: ExportDatasetKey
  ): { filename: string; mimeType: string; content: string; title: string; rowCount: number } => {
    const today = REFERENCE_TODAY_ISO;
    switch (key) {
      case 'fleet_csv': {
        const content = exportFleetToCsv(fleet);
        return {
          filename: `ivoiretrack-parc-engins-${today}.csv`,
          mimeType: 'text/csv;charset=utf-8;',
          content,
          title: 'Inventaire complet du Parc GPS (CSV Excel)',
          rowCount: fleet.length,
        };
      }
      case 'fuel_csv': {
        const content = exportFuelConsumptionToCsv(
          evaluatedFuel,
          fuelBounds.startIso,
          fuelBounds.endIso
        );
        return {
          filename: `ivoiretrack-consommation-${fuelBounds.startIso}-${fuelBounds.endIso}.csv`,
          mimeType: 'text/csv;charset=utf-8;',
          content,
          title: `Bilan Consommation & Surconsommations — ${fuelBounds.dayCount} jours (CSV)`,
          rowCount: evaluatedFuel.length,
        };
      }
      case 'maintenance_csv': {
        const content = exportMaintenanceToCsv(evaluatedMaintenance);
        return {
          filename: `ivoiretrack-carnet-maintenance-${today}.csv`,
          mimeType: 'text/csv;charset=utf-8;',
          content,
          title: 'Carnet de Maintenance Horamètre (CSV Excel)',
          rowCount: evaluatedMaintenance.length,
        };
      }
      case 'alerts_csv': {
        const content = exportAlertsToCsv(alerts);
        return {
          filename: `ivoiretrack-journal-alertes-${today}.csv`,
          mimeType: 'text/csv;charset=utf-8;',
          content,
          title: 'Journal Sécurité & Alertes Sonde/GPS (CSV)',
          rowCount: alerts.length,
        };
      }
      case 'backup_json': {
        const content = serializeFleetBackupJson({
          exportedAtIso: new Date().toISOString(),
          fleet,
          geofences,
          alerts,
          maintenanceLogs,
          fuelLogs,
        });
        return {
          filename: `ivoiretrack-sauvegarde-complete-${today}.json`,
          mimeType: 'application/json;charset=utf-8;',
          content,
          title: 'Sauvegarde intégrale IvoireTrack GPS (JSON)',
          rowCount:
            fleet.length +
            geofences.length +
            alerts.length +
            maintenanceLogs.length +
            fuelLogs.length,
        };
      }
    }
  };

  const activePreviewPayload = useMemo(
    () => buildDatasetPayload(previewKey),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previewKey, fleet, geofences, alerts, evaluatedMaintenance, evaluatedFuel, fuelBounds]
  );

  const handleDownload = (key: ExportDatasetKey) => {
    const payload = buildDatasetPayload(key);
    setPreviewKey(key);
    const prefix = payload.mimeType.startsWith('text/csv') ? '\uFEFF' : '';
    const blob = new Blob([prefix + payload.content], { type: payload.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = payload.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setLastExportNotice(
      `Export généré : ${payload.filename} (${payload.rowCount} enregistrements)`
    );
  };

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(activePreviewPayload.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback textarea copy for restricted contexts
      const textarea = document.createElement('textarea');
      textarea.value = activePreviewPayload.content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const result = parseFleetBackupJson(raw);
      if (!result.ok) {
        setImportFeedback({ type: 'error', message: result.error });
      } else {
        onRestoreBackup(result.data);
        setImportFeedback({
          type: 'success',
          message: `Sauvegarde restaurée : ${result.data.fleet.length} engins, ${result.data.maintenanceLogs.length} fiches maintenance et ${result.data.fuelLogs.length} relevés carburant chargés.`,
        });
      }
    } catch {
      setImportFeedback({
        type: 'error',
        message: 'Impossible de lire le fichier sélectionné.',
      });
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-8 print:p-0 print:space-y-6">
      {/* Print-Only Header for PDF / Paper Executive Report */}
      <div className="hidden print:block border-b border-slate-300 pb-4">
        <h1 className="text-xl font-bold text-slate-900">
          IvoireTrack GPS — Rapport d’Exploitation Parc & Carburant (Côte d’Ivoire)
        </h1>
        <p className="text-xs text-slate-600 font-mono tabular-nums mt-1">
          Édité le {new Date().toLocaleDateString('fr-FR')} · Période carburant analysée :{' '}
          {fuelBounds.startIso} au {fuelBounds.endIso} ({fuelBounds.dayCount} jours)
        </p>
      </div>

      {/* 4-Column Exportable Data Summary Strip */}
      <section
        aria-label="Volume des données prêtes à l'exportation"
        className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200"
      >
        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Parc d’engins équipés</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {fleet.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {fleetMetrics.movingCount} en route · {fleetMetrics.totalFuelLitersAvailable} L en cuve
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">
            Bilan carburant ({fuelBounds.dayCount} j)
          </p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {fuelSummary.totalLitersConsumed.toLocaleString('fr-FR')} L
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {fuelSummary.overconsumingCount} engin(s) en surconsommation
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Fiches maintenance horamètre</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {evaluatedMaintenance.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {maintenanceSummary.overdueCount} en retard · {maintenanceSummary.pendingCount} à venir
          </p>
        </div>

        <div className="p-5">
          <p className="text-xs font-medium text-slate-500">Relevés & Alertes archivés</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {(fuelLogs.length + alerts.length).toLocaleString('fr-FR')}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {fuelLogs.length} relevés sonde · {alerts.length} alertes sécurité
          </p>
        </div>
      </section>

      {lastExportNotice && (
        <div
          role="status"
          className="bg-emerald-50/70 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-xs text-emerald-900 print:hidden"
        >
          <span className="inline-flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
            {lastExportNotice}
          </span>
          <span className="text-emerald-700 font-mono tabular-nums">UTF-8 compatible Excel</span>
        </div>
      )}

      {/* Main Export & Backup Catalog */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start print:block">
        {/* Left 7 cols: Downloadable Reports & Full Backup */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden print:hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Exporter vos rapports d’exploitation (CSV, PDF & JSON)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Téléchargement direct pour Microsoft Excel, Google Sheets, impression PDF ou
                archivage complet
              </p>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="py-2 px-3.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              Imprimer / PDF
            </button>
          </div>

          <div className="divide-y divide-slate-200">
            {/* 1. Fuel Consumption & Overconsumption CSV */}
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-orange-700 shrink-0" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Bilan Consommation & Surconsommations Carburant
                  </h3>
                </div>
                <p className="text-xs text-slate-600">
                  Moyennes mesurées (L/100 km et L/h), écarts constructeur, volumes excédentaires
                  et surcoûts en FCFA.
                </p>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-xs text-slate-500 mr-1">Période :</span>
                  {(
                    [
                      { id: '7D', label: '7 j' },
                      { id: '15D', label: '15 j' },
                      { id: '30D', label: '30 j' },
                      { id: '90D', label: '90 j' },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setFuelPreset(p.id);
                        setPreviewKey('fuel_csv');
                      }}
                      className={`px-2 py-0.5 rounded text-xs font-mono tabular-nums font-semibold cursor-pointer ${
                        fuelPreset === p.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewKey('fuel_csv')}
                  className="py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  Aperçu
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload('fuel_csv')}
                  aria-label="Télécharger le bilan consommation carburant en CSV"
                  className="py-2 px-3.5 rounded-lg bg-orange-700 hover:bg-orange-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Exporter CSV
                </button>
              </div>
            </div>

            {/* 2. Fleet Inventory CSV */}
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-slate-700 shrink-0" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Inventaire complet du Parc d’Engins ({fleet.length} machines)
                  </h3>
                </div>
                <p className="text-xs text-slate-600">
                  Immatriculations CI, boîtiers IMEI, opérateurs SIM, positions GPS WGS84, niveaux
                  de cuve, horamètres et conducteurs.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewKey('fleet_csv')}
                  className="py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  Aperçu
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload('fleet_csv')}
                  aria-label="Télécharger l'inventaire du parc en CSV"
                  className="py-2 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Exporter CSV
                </button>
              </div>
            </div>

            {/* 3. Maintenance Log CSV */}
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-slate-700 shrink-0" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Carnet de Maintenance & Alertes Horamètre ({evaluatedMaintenance.length} fiches)
                  </h3>
                </div>
                <p className="text-xs text-slate-600">
                  Interventions en retard, échéances à venir et historique atelier clôturé avec
                  coûts en FCFA.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewKey('maintenance_csv')}
                  className="py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  Aperçu
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload('maintenance_csv')}
                  aria-label="Télécharger le carnet de maintenance en CSV"
                  className="py-2 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Exporter CSV
                </button>
              </div>
            </div>

            {/* 4. Security & Fuel Incident Alerts CSV */}
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-slate-700 shrink-0" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Journal de Sécurité & Incidents ({alerts.length} événements)
                  </h3>
                </div>
                <p className="text-xs text-slate-600">
                  Alertes anti-siphonage, excès de vitesse, sorties de géorepérage et commandes
                  coupe-circuit.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewKey('alerts_csv')}
                  className="py-2 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  Aperçu
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload('alerts_csv')}
                  aria-label="Télécharger le journal des alertes en CSV"
                  className="py-2 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Exporter CSV
                </button>
              </div>
            </div>

            {/* 5. Complete JSON Backup & Restore */}
            <div className="p-5 space-y-3 bg-slate-50/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileJson className="w-4 h-4 text-orange-700 shrink-0" aria-hidden="true" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Sauvegarde intégrale & Restauration (JSON)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600">
                    Archive complète transférable d’un poste superviseur à un autre (engins, zones,
                    maintenance, relevés carburant).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <label className="py-2 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Importer JSON</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleImportFile}
                      className="sr-only"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => handleDownload('backup_json')}
                    aria-label="Télécharger la sauvegarde complète en JSON"
                    className="py-2 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    Exporter JSON
                  </button>
                </div>
              </div>

              {importFeedback && (
                <p
                  className={`text-xs font-medium ${
                    importFeedback.type === 'error' ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  {importFeedback.message}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Right 5 cols: Live File Preview & One-Click Clipboard Copy */}
        <section
          aria-label="Aperçu direct des données exportées"
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden print:hidden"
        >
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 truncate">
                {activePreviewPayload.title}
              </h2>
              <p className="text-xs font-mono tabular-nums text-slate-500 mt-0.5 truncate">
                {activePreviewPayload.filename} · {activePreviewPayload.rowCount} entrées
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopyPreview}
              className="py-1.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                  <span className="text-emerald-700">Copié</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copier</span>
                </>
              )}
            </button>
          </div>

          <div className="p-4 bg-slate-950 text-slate-100">
            <pre className="text-[11px] leading-relaxed font-mono tabular-nums overflow-x-auto max-h-[410px] overflow-y-auto">
              {activePreviewPayload.content}
            </pre>
          </div>

          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 text-xs text-slate-600">
            <span>Astuce : collez directement dans Excel ou Google Sheets</span>
            <button
              type="button"
              onClick={() => handleDownload(previewKey)}
              className="font-semibold text-orange-700 hover:text-orange-800 cursor-pointer whitespace-nowrap"
            >
              Télécharger ce fichier
            </button>
          </div>
        </section>
      </div>

      {/* Printable Executive Synthesis Table (Visible on Screen & Print/PDF) */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden print:border-slate-300">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Synthèse exécutive imprimable — Parc, Carburant ({fuelBounds.dayCount} j) &
              Maintenance
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Récapitulatif consolidé par engin pour visa d’exploitation ou archivage PDF
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 font-semibold text-slate-600">
                <th className="py-3 px-4">Engin & Immatriculation</th>
                <th className="py-3 px-4">Localisation</th>
                <th className="py-3 px-4 text-right">Horamètre / Seuil</th>
                <th className="py-3 px-4 text-right">Moyenne ({fuelBounds.dayCount} j)</th>
                <th className="py-3 px-4 text-right">Volume & Surcoût</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {evaluatedFuel.map((row) => {
                const engin = fleet.find((e) => e.id === row.enginId);
                return (
                  <tr key={row.enginId} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{row.enginName}</p>
                      <p className="font-mono tabular-nums text-slate-500">{row.plateOrSerial}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{row.locationLabel}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      {engin ? `${engin.engineHours.toFixed(1)} h / ${engin.nextMaintenanceHours} h` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      <span className="font-semibold text-slate-900">
                        {row.primaryAverageRate !== null
                          ? `${row.primaryAverageRate.toFixed(1)} ${row.unitLabel}`
                          : '—'}
                      </span>{' '}
                      <span className="text-slate-500">
                        ({row.deviationPercent > 0 ? '+' : ''}
                        {row.deviationPercent.toFixed(1)}%)
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      <span className="font-semibold text-slate-900">
                        {row.totalLitersConsumed.toLocaleString('fr-FR')} L
                      </span>
                      {row.excessCostFcfa > 0 && (
                        <span className="text-red-700 font-medium">
                          {' '}
                          · +{row.excessCostFcfa.toLocaleString('fr-FR')} FCFA
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
