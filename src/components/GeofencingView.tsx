import React, { useMemo, useState } from 'react';
import { AdvancedMarker, Circle, Map } from '@vis.gl/react-google-maps';
import { CheckCircle2, Plus, Shield, Trash2 } from 'lucide-react';
import { Engin, GeofenceZone, GroundedHub } from '../types/fleet';
import { evaluateFleetGeofences } from '../utils/telemetry';
import { CategoryIcon } from './EnginIcons';

interface GeofencingViewProps {
  fleet: Engin[];
  geofences: GeofenceZone[];
  hubs: GroundedHub[];
  onUpdateGeofenceRadius: (zoneId: string, radiusMeters: number) => void;
  onToggleGeofenceActive: (zoneId: string) => void;
  onCreateGeofence: (zone: Omit<GeofenceZone, 'id'>) => void;
  onDeleteGeofence: (zoneId: string) => void;
}

export function GeofencingView({
  fleet,
  geofences,
  hubs,
  onUpdateGeofenceRadius,
  onToggleGeofenceActive,
  onCreateGeofence,
  onDeleteGeofence,
}: GeofencingViewProps) {
  const [selectedZoneId, setSelectedZoneId] = useState<string>(geofences[0]?.id ?? '');
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneHubId, setNewZoneHubId] = useState(hubs[4]?.id ?? hubs[0]?.id ?? '');
  const [newZoneRadius, setNewZoneRadius] = useState('2500');
  const [newZoneSpeed, setNewZoneSpeed] = useState('50');
  const [formError, setFormError] = useState<string | null>(null);

  const containment = useMemo(
    () => evaluateFleetGeofences(fleet, geofences),
    [fleet, geofences]
  );

  const focusedZone = useMemo(
    () => geofences.find((z) => z.id === selectedZoneId) ?? geofences[0] ?? null,
    [geofences, selectedZoneId]
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newZoneName.trim();
    if (trimmed.length < 3) {
      setFormError('Saisissez un nom de zone d’au moins 3 caractères.');
      return;
    }
    const radius = Number(newZoneRadius);
    if (!Number.isFinite(radius) || radius < 200 || radius > 50000) {
      setFormError('Le rayon doit être compris entre 200 m et 50 000 m.');
      return;
    }
    const speed = Number(newZoneSpeed);
    if (!Number.isFinite(speed) || speed < 15 || speed > 130) {
      setFormError('La vitesse maximale doit être comprise entre 15 et 130 km/h.');
      return;
    }

    const hub = hubs.find((h) => h.id === newZoneHubId) ?? hubs[0];
    if (!hub) return;

    setFormError(null);
    onCreateGeofence({
      name: trimmed,
      hubId: hub.id,
      city: hub.city,
      center: hub.location,
      radiusMeters: radius,
      alertOnExit: true,
      alertOnEntry: true,
      speedLimitKmh: speed,
      active: true,
    });
    setNewZoneName('');
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Active Zones & Creation Form */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Périmètres de sécurité actifs ({geofences.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Détection automatique d’entrée/sortie de chantier, port ou plantation
                </p>
              </div>
            </div>

            {geofences.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Aucune zone configurée. Créez votre premier périmètre ci-dessous.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {geofences.map((zone) => {
                  const stats = containment.find((c) => c.zoneId === zone.id);
                  const insideEngins = fleet.filter((e) =>
                    stats?.insideEnginIds.includes(e.id)
                  );
                  const isFocused = focusedZone?.id === zone.id;

                  return (
                    <div
                      key={zone.id}
                      className={`p-5 transition-colors ${
                        isFocused ? 'bg-orange-50/40' : 'bg-white'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <button
                            type="button"
                            onClick={() => setSelectedZoneId(zone.id)}
                            className="text-left text-sm font-bold text-slate-900 hover:text-orange-700 cursor-pointer"
                          >
                            {zone.name}
                          </button>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {zone.city} · Seuil vitesse{' '}
                            <span className="font-mono tabular-nums">
                              {zone.speedLimitKmh} km/h
                            </span>{' '}
                            ·{' '}
                            <span className="font-semibold text-slate-700">
                              {insideEngins.length} engin(s) présent(s)
                            </span>
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={zone.active}
                              onChange={() => onToggleGeofenceActive(zone.id)}
                              className="rounded border-slate-300 text-orange-600 focus:ring-orange-600"
                            />
                            {zone.active ? 'Surveillance active' : 'Suspendue'}
                          </label>
                          <button
                            type="button"
                            onClick={() => onDeleteGeofence(zone.id)}
                            aria-label={`Supprimer la zone ${zone.name}`}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      {/* Radius Control */}
                      <div className="mt-4 flex items-center gap-4">
                        <label
                          htmlFor={`radius-slider-${zone.id}`}
                          className="text-xs font-medium text-slate-600 whitespace-nowrap"
                        >
                          Rayon de contrôle :
                        </label>
                        <input
                          id={`radius-slider-${zone.id}`}
                          type="range"
                          min={500}
                          max={15000}
                          step={250}
                          value={zone.radiusMeters}
                          onChange={(e) =>
                            onUpdateGeofenceRadius(zone.id, Number(e.target.value))
                          }
                          className="flex-1 accent-orange-600 cursor-pointer"
                        />
                        <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums w-20 text-right">
                          {(zone.radiusMeters / 1000).toFixed(2)} km
                        </span>
                      </div>

                      {/* Engins detected inside */}
                      <div className="mt-3 text-xs text-slate-600">
                        {insideEngins.length === 0 ? (
                          <span className="text-slate-400">
                            Aucun engin détecté dans ce rayon actuellement.
                          </span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              Dans la zone :
                            </span>
                            {insideEngins.map((eng, idx) => (
                              <React.Fragment key={eng.id}>
                                {idx > 0 && <span aria-hidden="true">·</span>}
                                <span className="font-mono text-slate-800">
                                  {eng.plateOrSerial} ({eng.name})
                                </span>
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Add New Geofence Form */}
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-4 h-4 text-orange-700" aria-hidden="true" />
              Créer une nouvelle zone géorepérée en Côte d’Ivoire
            </h3>
            <form onSubmit={handleCreate} noValidate className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="new-geofence-name"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Nom du périmètre *
                  </label>
                  <input
                    id="new-geofence-name"
                    type="text"
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    placeholder="Ex: Chantier Voirie Yamoussoukro"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-geofence-hub"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Point d’ancrage géographique *
                  </label>
                  <select
                    id="new-geofence-hub"
                    value={newZoneHubId}
                    onChange={(e) => setNewZoneHubId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  >
                    {hubs.map((hub) => (
                      <option key={hub.id} value={hub.id}>
                        {hub.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="new-geofence-radius"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Rayon (mètres) *
                  </label>
                  <input
                    id="new-geofence-radius"
                    type="number"
                    min={200}
                    max={50000}
                    value={newZoneRadius}
                    onChange={(e) => setNewZoneRadius(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-geofence-speed"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Limite vitesse interne (km/h) *
                  </label>
                  <input
                    id="new-geofence-speed"
                    type="number"
                    min={15}
                    max={130}
                    value={newZoneSpeed}
                    onChange={(e) => setNewZoneSpeed(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  />
                </div>
              </div>

              {formError && <p className="text-xs text-red-700">{formError}</p>}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="py-2 px-4 rounded-lg bg-orange-700 hover:bg-orange-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Activer la zone
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Right Column: Interactive Map Preview of Selected Geofence */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">
              Aperçu cartographique : {focusedZone?.name ?? 'Côte d’Ivoire'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cliquez sur un périmètre à gauche pour centrer l’inspection
            </p>
          </div>
          <div className="h-[460px] w-full">
            <Map
              key={focusedZone?.id ?? 'default-geo'}
              mapId="DEMO_MAP_ID"
              defaultCenter={focusedZone?.center ?? { lat: 6.45, lng: -5.25 }}
              defaultZoom={focusedZone ? 12 : 7}
              gestureHandling="greedy"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              className="w-full h-full"
            >
              {geofences
                .filter((z) => z.active)
                .map((zone) => (
                  <Circle
                    key={zone.id}
                    center={zone.center}
                    radius={zone.radiusMeters}
                    strokeColor={zone.id === focusedZone?.id ? '#C2410C' : '#475569'}
                    strokeOpacity={0.85}
                    strokeWeight={2}
                    fillColor={zone.id === focusedZone?.id ? '#EA580C' : '#64748B'}
                    fillOpacity={0.16}
                  />
                ))}

              {fleet.map((engin) => (
                <AdvancedMarker
                  key={engin.id}
                  position={engin.position}
                  title={`${engin.name} (${engin.plateOrSerial})`}
                >
                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 text-white border border-white shadow-sm text-[11px] font-mono tabular-nums">
                    <CategoryIcon category={engin.category} className="w-3 h-3 shrink-0" />
                    <span>{engin.plateOrSerial}</span>
                  </div>
                </AdvancedMarker>
              ))}
            </Map>
          </div>
        </div>
      </div>
    </div>
  );
}
