import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  Circle,
  Map,
  Polyline,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  Clock,
  Compass,
  Fuel,
  Gauge,
  Lock,
  MapPin,
  Navigation,
  Pause,
  Play,
  Radio,
  Route as RouteIcon,
  Search,
  ShieldAlert,
  Unlock,
  Wrench,
  X,
} from 'lucide-react';
import {
  Engin,
  EnginCategory,
  EnginStatus,
  GeofenceZone,
  GroundedHub,
  RouteSummary,
} from '../types/fleet';
import { CATEGORY_LABELS } from '../utils/telemetry';
import { CategoryIcon, StatusIndicator } from './EnginIcons';

interface MapWorkspaceProps {
  fleet: Engin[];
  geofences: GeofenceZone[];
  hubs: GroundedHub[];
  selectedEnginId: string | null;
  onSelectEngin: (id: string | null) => void;
  onToggleImmobilizer: (enginId: string, activate: boolean) => void;
  onOpenMaintenanceLog: (enginId: string) => void;
  simulationRunning: boolean;
  onToggleSimulation: () => void;
}

function checkAndDispatchQuotaError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('QuotaExceeded')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

/**
 * Imperative wrapper for Google Maps Places API (New) PlaceAutocompleteElement
 * restricted to Côte d'Ivoire ('ci') per CF8 & CF10.
 */
function IvoryCoastPlaceSearch() {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!map || !placesLib || !containerRef.current) return;

    const PlaceAutocompleteCtor = (
      placesLib as unknown as {
        PlaceAutocompleteElement?: new (opts?: Record<string, unknown>) => HTMLElement & {
          includedRegionCodes?: string[];
        };
      }
    ).PlaceAutocompleteElement;

    if (!PlaceAutocompleteCtor) return;

    const autocompleteEl = new PlaceAutocompleteCtor({
      internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
    });
    autocompleteEl.includedRegionCodes = ['ci'];
    autocompleteEl.setAttribute('placeholder', 'Rechercher une ville ou un site en CI...');

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(autocompleteEl);

    const handleSelect = (event: Event) => {
      const selectEvent = event as unknown as {
        placePrediction?: {
          toPlace: () => {
            location?: { lat: () => number; lng: () => number } | null;
            viewport?: unknown;
            fetchFields: (opts: { fields: string[] }) => Promise<void>;
          };
        };
      };
      const prediction = selectEvent.placePrediction;
      if (!prediction) return;

      const place = prediction.toPlace();
      place
        .fetchFields({
          fields: ['location', 'viewport', 'displayName', 'formattedAddress'],
        })
        .then(() => {
          if (place.viewport) {
            map.fitBounds(place.viewport as Parameters<typeof map.fitBounds>[0]);
          } else if (place.location) {
            map.setCenter(place.location as unknown as Parameters<typeof map.setCenter>[0]);
            map.setZoom(14);
          }
        })
        .catch((err: unknown) => {
          console.error('Erreur recherche lieu Google Places:', err);
          checkAndDispatchQuotaError(err);
        });
    };

    autocompleteEl.addEventListener('gmp-select', handleSelect);
    return () => {
      autocompleteEl.removeEventListener('gmp-select', handleSelect);
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [map, placesLib]);

  return (
    <div
      ref={containerRef}
      aria-label="Recherche d'adresse Google Maps en Côte d'Ivoire"
      className="w-full sm:w-80 md:w-96 rounded-lg overflow-hidden"
    />
  );
}

/**
 * Handles camera pan when user selects an engin and renders live Routes API polylines.
 */
interface MapPolylineHandle {
  setMap: (mapInstance: unknown) => void;
  setOptions: (opts: {
    strokeColor: string;
    strokeWeight: number;
    strokeOpacity: number;
  }) => void;
}

function MapControllerAndRouting({
  selectedEngin,
  destinationHub,
  onRouteComputed,
  onRouteError,
}: {
  selectedEngin: Engin | null;
  destinationHub: GroundedHub | null;
  onRouteComputed: (summary: RouteSummary | null) => void;
  onRouteError: (msg: string | null) => void;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<MapPolylineHandle[]>([]);
  const lastSelectedIdRef = useRef<string | null>(null);

  // Pan smoothly when a new engin is selected
  useEffect(() => {
    if (!map || !selectedEngin) return;
    if (lastSelectedIdRef.current !== selectedEngin.id) {
      lastSelectedIdRef.current = selectedEngin.id;
      map.panTo(selectedEngin.position);
      const currentZoom = map.getZoom() ?? 7;
      if (currentZoom < 11) {
        map.setZoom(12);
      }
    }
  }, [map, selectedEngin]);

  // Compute route using modern Routes API (`Route.computeRoutes`)
  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!map || !routesLib || !selectedEngin || !destinationHub) {
      onRouteComputed(null);
      return;
    }

    onRouteError(null);
    let cancelled = false;

    const RouteClass = (
      routesLib as unknown as {
        Route?: {
          computeRoutes: (req: Record<string, unknown>) => Promise<{
            routes?: Array<{
              distanceMeters?: number;
              durationMillis?: number;
              viewport?: unknown;
              createPolylines: () => MapPolylineHandle[];
            }>;
          }>;
        };
      }
    ).Route;

    if (!RouteClass) {
      onRouteError('Module Routes API indisponible.');
      return;
    }

    RouteClass.computeRoutes({
      origin: selectedEngin.position,
      destination: destinationHub.location,
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    })
      .then(({ routes }) => {
        if (cancelled) return;
        const primary = routes?.[0];
        if (!primary) {
          onRouteError('Aucun itinéraire routier trouvé vers cette destination.');
          onRouteComputed(null);
          return;
        }

        const created = primary.createPolylines();
        created.forEach((poly) => {
          poly.setOptions({
            strokeColor: '#C2410C',
            strokeWeight: 5,
            strokeOpacity: 0.9,
          });
          poly.setMap(map);
        });
        polylinesRef.current = created;

        if (primary.viewport) {
          map.fitBounds(primary.viewport as Parameters<typeof map.fitBounds>[0], 56);
        }

        onRouteComputed({
          originName: selectedEngin.name,
          destinationName: destinationHub.name,
          distanceKm: Number(((primary.distanceMeters ?? 0) / 1000).toFixed(1)),
          durationMinutes: Math.max(1, Math.round((primary.durationMillis ?? 0) / 60000)),
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('Erreur calcul itinéraire Routes API:', err);
        checkAndDispatchQuotaError(err);
        onRouteError("Impossible de calculer l'itinéraire routier pour le moment.");
        onRouteComputed(null);
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, routesLib, selectedEngin?.id, destinationHub?.id, onRouteComputed, onRouteError]);

  return null;
}

const CATEGORY_FILTER_OPTIONS: Array<{ value: 'ALL' | EnginCategory; label: string }> = [
  { value: 'ALL', label: 'Tous' },
  { value: EnginCategory.POIDS_LOURDS, label: 'Poids Lourds' },
  { value: EnginCategory.BTP_MINES, label: 'BTP & Mines' },
  { value: EnginCategory.AGRICOLE, label: 'Agricole' },
  { value: EnginCategory.LEGER_UTILITAIRE, label: 'Légers 4x4' },
  { value: EnginCategory.MOTO_TRICYCLE, label: 'Motos' },
  { value: EnginCategory.GROUPE_REMORQUE, label: 'Groupes' },
];

export function MapWorkspace({
  fleet,
  geofences,
  hubs,
  selectedEnginId,
  onSelectEngin,
  onToggleImmobilizer,
  onOpenMaintenanceLog,
  simulationRunning,
  onToggleSimulation,
}: MapWorkspaceProps) {
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | EnginCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showGeofencesOnMap, setShowGeofencesOnMap] = useState(true);
  const [mobilePane, setMobilePane] = useState<'map' | 'list' | 'inspector'>('map');
  const [confirmCutOffId, setConfirmCutOffId] = useState<string | null>(null);
  const [targetHubId, setTargetHubId] = useState<string>('');
  const [activeRouteHub, setActiveRouteHub] = useState<GroundedHub | null>(null);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  const filteredFleet = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return fleet.filter((engin) => {
      if (categoryFilter !== 'ALL' && engin.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        engin.name.toLowerCase().includes(q) ||
        engin.plateOrSerial.toLowerCase().includes(q) ||
        engin.driverName.toLowerCase().includes(q) ||
        engin.locationLabel.toLowerCase().includes(q)
      );
    });
  }, [fleet, categoryFilter, searchQuery]);

  const selectedEngin = useMemo(
    () => fleet.find((e) => e.id === selectedEnginId) ?? null,
    [fleet, selectedEnginId]
  );

  // Reset active route when switching engins
  useEffect(() => {
    setConfirmCutOffId(null);
    setActiveRouteHub(null);
    setRouteSummary(null);
    setRouteError(null);
  }, [selectedEnginId]);

  const handleComputeRoute = useCallback(() => {
    const hub = hubs.find((h) => h.id === targetHubId) ?? hubs[0] ?? null;
    setActiveRouteHub(hub);
  }, [hubs, targetHubId]);

  const markerColorForStatus = (status: EnginStatus): string => {
    switch (status) {
      case EnginStatus.EN_MOUVEMENT:
        return 'bg-emerald-700 text-white border-white';
      case EnginStatus.RALENTI_CHANTIER:
        return 'bg-amber-600 text-white border-white';
      case EnginStatus.COUPE_CIRCUIT:
        return 'bg-rose-700 text-white border-white';
      case EnginStatus.ALERTE:
        return 'bg-red-700 text-white border-white';
      case EnginStatus.STATIONNE:
        return 'bg-slate-800 text-white border-white';
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] min-h-[600px] bg-white">
      {/* Mobile Segmented Switcher (Carte / Liste / Fiche Engin) */}
      <div className="lg:hidden px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setMobilePane('map')}
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer ${
            mobilePane === 'map'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-200'
          }`}
        >
          Carte GPS
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('list')}
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer ${
            mobilePane === 'list'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-200'
          }`}
        >
          Engins ({filteredFleet.length})
        </button>
        {selectedEngin && (
          <button
            type="button"
            onClick={() => setMobilePane('inspector')}
            className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer ${
              mobilePane === 'inspector'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            Fiche ({selectedEngin.plateOrSerial})
          </button>
        )}
      </div>

      {/* Left Fleet Telemetry List Panel */}
      <section
        aria-label="Liste des engins en suivi temps réel"
        className={`${
          mobilePane === 'list' ? 'flex' : 'hidden'
        } lg:flex w-full lg:w-[340px] xl:w-[360px] shrink-0 border-r border-slate-200 flex-col bg-white flex-1 lg:flex-initial h-full`}
      >
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Engins actifs ({filteredFleet.length}/{fleet.length})
              </h2>
              <p className="text-xs text-slate-500">
                Réseau multi-opérateurs Orange · MTN · Moov
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleSimulation}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                simulationRunning
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              {simulationRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                  Flux GPS actif
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  Reprendre flux
                </>
              )}
            </button>
          </div>

          {/* Search input */}
          <div className="relative">
            <label htmlFor="map-fleet-search" className="sr-only">
              Rechercher un engin, une plaque ou un chauffeur
            </label>
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="map-fleet-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Plaque CI, engin, chauffeur, ville..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:bg-white"
            />
          </div>

          {/* Interactive Category Filter Tabs (Wrapped so zero categories clip) */}
          <div
            role="group"
            aria-label="Filtrer par catégorie d'engin"
            className="flex flex-wrap items-center gap-1.5"
          >
            {CATEGORY_FILTER_OPTIONS.map((opt) => {
              const active = categoryFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCategoryFilter(opt.value)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Engin Rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
          {filteredFleet.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-800">Aucun engin correspondant</p>
              <p className="text-xs text-slate-500">
                Modifiez votre recherche ou réinitialisez le filtre de catégorie.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('ALL');
                  setSearchQuery('');
                }}
                className="mt-2 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:text-orange-800 underline cursor-pointer"
              >
                Afficher tous les engins
              </button>
            </div>
          ) : (
            filteredFleet.map((engin) => {
              const isSelected = engin.id === selectedEnginId;
              const fuelLiters = Math.round(
                (engin.fuelLevelPercent / 100) * engin.fuelCapacityLiters
              );
              return (
                <button
                  key={engin.id}
                  type="button"
                  onClick={() => {
                    onSelectEngin(engin.id);
                    setMobilePane('inspector');
                  }}
                  className={`w-full text-left p-3.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-600 ${
                    isSelected ? 'bg-orange-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-slate-700 shrink-0">
                        <CategoryIcon category={engin.category} className="w-4 h-4" />
                      </span>
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {engin.name}
                      </span>
                    </div>
                    <StatusIndicator status={engin.status} />
                  </div>

                  {/* Clean Zero-Pill Metadata line with typographic separators */}
                  <div className="mt-1.5 flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-xs text-slate-600">
                    <span className="font-mono font-semibold text-slate-800 tabular-nums">
                      {engin.plateOrSerial}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{CATEGORY_LABELS[engin.category]}</span>
                    <span aria-hidden="true">·</span>
                    <span>{engin.simOperator}</span>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span className="truncate">{engin.locationLabel}</span>
                    <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums text-slate-800">
                      <span>{engin.speedKmh} km/h</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          engin.fuelLevelPercent <= 25 ? 'text-red-700 font-semibold' : ''
                        }
                      >
                        {engin.fuelLevelPercent}% ({fuelLiters} L)
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Center Interactive Google Map */}
      <div
        className={`${
          mobilePane === 'map' ? 'flex' : 'hidden'
        } lg:flex flex-1 relative flex-col min-w-0 min-h-[460px] h-full`}
      >
        {/* Map Toolbar Overlay */}
        <div className="p-3 bg-white/95 backdrop-blur-xs border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 z-10">
          <IvoryCoastPlaceSearch />

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={showGeofencesOnMap}
                onChange={(e) => setShowGeofencesOnMap(e.target.checked)}
                className="rounded border-slate-300 text-orange-600 focus:ring-orange-600"
              />
              Afficher zones géorepérées ({geofences.filter((g) => g.active).length})
            </label>
          </div>
        </div>

        {/* Sized Google Map Container (CF2 compliance) */}
        <div className="flex-1 relative w-full h-full min-h-[380px]" data-testid="ivoire-google-map">
          <Map
            mapId="DEMO_MAP_ID"
            defaultCenter={{ lat: 6.45, lng: -5.25 }}
            defaultZoom={7}
            gestureHandling="greedy"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            className="w-full h-full"
          >
            <MapControllerAndRouting
              selectedEngin={selectedEngin}
              destinationHub={activeRouteHub}
              onRouteComputed={setRouteSummary}
              onRouteError={setRouteError}
            />

            {/* Active Geofence Circles */}
            {showGeofencesOnMap &&
              geofences
                .filter((z) => z.active)
                .map((zone) => (
                  <Circle
                    key={zone.id}
                    center={zone.center}
                    radius={zone.radiusMeters}
                    strokeColor="#C2410C"
                    strokeOpacity={0.75}
                    strokeWeight={2}
                    fillColor="#EA580C"
                    fillOpacity={0.12}
                  />
                ))}

            {/* Selected Engin Recent GPS Trail */}
            {selectedEngin && selectedEngin.trail.length > 1 && (
              <Polyline
                path={selectedEngin.trail}
                strokeColor="#0F172A"
                strokeOpacity={0.75}
                strokeWeight={3}
              />
            )}

            {/* Fleet Advanced Markers */}
            {filteredFleet.map((engin) => {
              const isSelected = engin.id === selectedEnginId;
              return (
                <AdvancedMarker
                  key={engin.id}
                  position={engin.position}
                  title={`${engin.name} (${engin.plateOrSerial})`}
                  zIndex={isSelected ? 50 : 10}
                  onClick={() => {
                    onSelectEngin(engin.id);
                    setMobilePane('inspector');
                  }}
                >
                  <div
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md border-2 shadow-md transition-transform ${markerColorForStatus(
                      engin.status
                    )} ${isSelected ? 'scale-110 ring-2 ring-orange-500' : ''}`}
                  >
                    <CategoryIcon category={engin.category} className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-mono text-[11px] font-semibold tabular-nums whitespace-nowrap">
                      {engin.plateOrSerial}
                    </span>
                  </div>
                </AdvancedMarker>
              );
            })}
          </Map>
        </div>
      </div>

      {/* Right Docked Telemetry & Security Inspector Panel (Unobstructed Map Canvas) */}
      {selectedEngin && (
        <aside
          aria-label={`Détails télémétriques de ${selectedEngin.name}`}
          className={`${
            mobilePane === 'inspector' ? 'flex' : 'hidden'
          } lg:flex w-full lg:w-[350px] xl:w-[370px] shrink-0 border-l border-slate-200 bg-white flex-col overflow-y-auto p-5 space-y-4 h-full`}
        >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">
                    {CATEGORY_LABELS[selectedEngin.category]} · {selectedEngin.trackerModel}
                  </p>
                  <h3 className="text-base font-bold text-slate-900 truncate mt-0.5">
                    {selectedEngin.name}
                  </h3>
                  <p className="text-xs font-mono font-semibold text-slate-700 tabular-nums mt-0.5">
                    {selectedEngin.plateOrSerial} · IMEI {selectedEngin.imei}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectEngin(null)}
                  aria-label="Fermer la fiche engin"
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {/* Telemetry Grid (Tabular Numerals, Hairline Border) */}
              <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5" aria-hidden="true" /> Vitesse & Cap
                  </span>
                  <p className="font-mono font-semibold text-sm text-slate-900 tabular-nums mt-0.5">
                    {selectedEngin.speedKmh} km/h · {selectedEngin.heading}°
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 flex items-center gap-1">
                    <Fuel className="w-3.5 h-3.5" aria-hidden="true" /> Niveau Carburant
                  </span>
                  <p className="font-mono font-semibold text-sm text-slate-900 tabular-nums mt-0.5">
                    {selectedEngin.fuelLevelPercent}% (
                    {Math.round(
                      (selectedEngin.fuelLevelPercent / 100) * selectedEngin.fuelCapacityLiters
                    )}{' '}
                    / {selectedEngin.fuelCapacityLiters} L)
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" /> Horamètre / Odo
                  </span>
                  <p className="font-mono font-semibold text-sm text-slate-900 tabular-nums mt-0.5">
                    {selectedEngin.engineHours.toFixed(1)} h ·{' '}
                    {Math.round(selectedEngin.odometerKm).toLocaleString('fr-FR')} km
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 flex items-center gap-1">
                    <Radio className="w-3.5 h-3.5" aria-hidden="true" /> Réseau GSM & Tension
                  </span>
                  <p className="font-mono font-semibold text-sm text-slate-900 tabular-nums mt-0.5">
                    {selectedEngin.simOperator} ({selectedEngin.gsmSignalPercent}%) ·{' '}
                    {selectedEngin.externalVoltage.toFixed(1)} V
                  </p>
                </div>
              </div>

              {/* Driver & Position Coordinates */}
              <div className="space-y-1 text-xs text-slate-600">
                <p>
                  <span className="font-semibold text-slate-800">Opérateur / Chauffeur :</span>{' '}
                  {selectedEngin.driverName} ({selectedEngin.driverPhone})
                </p>
                <p className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                  <span>{selectedEngin.locationLabel}</span>
                </p>
                <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                  GPS : {selectedEngin.position.lat.toFixed(5)},{' '}
                  {selectedEngin.position.lng.toFixed(5)}
                </p>
                <div className="pt-1.5">
                  <button
                    type="button"
                    onClick={() => onOpenMaintenanceLog(selectedEngin.id)}
                    className="w-full py-2 px-3 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Wrench className="w-3.5 h-3.5 text-orange-700" aria-hidden="true" />
                    Carnet de maintenance ({selectedEngin.engineHours.toFixed(1)} h /{' '}
                    {selectedEngin.nextMaintenanceHours} h)
                  </button>
                </div>
              </div>

              {/* Remote Engine Immobilizer (Coupe-circuit Anti-vol GPRS/SMS) */}
              <div className="pt-2 border-t border-slate-200">
                {selectedEngin.immobilizerActive ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      Relais coupe-circuit verrouillé — Démarrage bloqué
                    </p>
                    <button
                      type="button"
                      onClick={() => onToggleImmobilizer(selectedEngin.id, false)}
                      className="w-full py-2 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Unlock className="w-3.5 h-3.5" aria-hidden="true" />
                      Rétablir l’allumage moteur
                    </button>
                  </div>
                ) : confirmCutOffId === selectedEngin.id ? (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 space-y-2.5">
                    <p className="text-xs text-rose-900 font-medium flex items-start gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                      Confirmer l’envoi de la commande coupe-circuit GPRS/SMS vers{' '}
                      <span className="font-mono font-semibold">
                        {selectedEngin.plateOrSerial}
                      </span>{' '}
                      ?
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onToggleImmobilizer(selectedEngin.id, true);
                          setConfirmCutOffId(null);
                        }}
                        className="flex-1 py-2 px-3 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Confirmer coupure
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmCutOffId(null)}
                        className="py-2 px-3 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmCutOffId(selectedEngin.id)}
                    className="w-full py-2 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                    Coupure moteur à distance (Anti-vol)
                  </button>
                )}
              </div>

              {/* Google Maps Routes API Calculator */}
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <label
                  htmlFor="route-destination-hub"
                  className="block text-xs font-semibold text-slate-800"
                >
                  Calculer l’itinéraire routier vers un site CI
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="route-destination-hub"
                    value={targetHubId || (hubs[0]?.id ?? '')}
                    onChange={(e) => setTargetHubId(e.target.value)}
                    className="flex-1 min-w-0 py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
                  >
                    {hubs.map((hub) => (
                      <option key={hub.id} value={hub.id}>
                        {hub.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleComputeRoute}
                    className="py-1.5 px-3 rounded-lg bg-orange-700 hover:bg-orange-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    <RouteIcon className="w-3.5 h-3.5" aria-hidden="true" />
                    Tracer
                  </button>
                </div>

                {routeError && (
                  <p className="text-xs text-red-700 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    {routeError}
                  </p>
                )}

                {routeSummary && (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">
                        Vers {routeSummary.destinationName}
                      </p>
                      <p className="font-mono text-slate-700 tabular-nums mt-0.5">
                        {routeSummary.distanceKm} km · env. {routeSummary.durationMinutes} min
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveRouteHub(null);
                        setRouteSummary(null);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 underline whitespace-nowrap cursor-pointer"
                    >
                      Effacer
                    </button>
                  </div>
                )}
              </div>
        </aside>
      )}
    </div>
  );
}
