import {
  AlertSeverity,
  AlertType,
  Engin,
  EnginCategory,
  EnginStatus,
  FleetAlert,
  FleetBackupBundle,
  FuelConsumptionStatus,
  FuelDailyLog,
  FuelLogValidationErrors,
  FuelPeriodPreset,
  FuelRateUnit,
  GeofenceZone,
  LatLngPoint,
  MaintenanceRecord,
  MaintenanceServiceType,
  MaintenanceStatus,
  MaintenanceValidationErrors,
  NewEnginInput,
  NewFuelLogInput,
  NewMaintenanceInput,
  ValidationErrors,
} from '../types/fleet';

const EARTH_RADIUS_METERS = 6371000;

export const CATEGORY_LABELS: Record<EnginCategory, string> = {
  [EnginCategory.BTP_MINES]: 'BTP & Mines',
  [EnginCategory.POIDS_LOURDS]: 'Poids Lourds',
  [EnginCategory.AGRICOLE]: 'Agricole & Forestier',
  [EnginCategory.LEGER_UTILITAIRE]: 'Léger & 4x4',
  [EnginCategory.MOTO_TRICYCLE]: 'Motos & Tricycles',
  [EnginCategory.GROUPE_REMORQUE]: 'Groupes & Remorques',
};

export const STATUS_LABELS: Record<EnginStatus, string> = {
  [EnginStatus.EN_MOUVEMENT]: 'En mouvement',
  [EnginStatus.RALENTI_CHANTIER]: 'En travail / Ralenti',
  [EnginStatus.STATIONNE]: 'Stationné',
  [EnginStatus.COUPE_CIRCUIT]: 'Moteur coupé (Anti-vol)',
  [EnginStatus.ALERTE]: 'Alerte active',
};

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Computes exact great-circle distance in meters between two WGS84 coordinates.
 */
export function haversineDistanceMeters(a: LatLngPoint, b: LatLngPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Checks whether an engin position lies within a circular geofence zone.
 */
export function isPointInGeofence(point: LatLngPoint, zone: GeofenceZone): boolean {
  if (!zone.active || zone.radiusMeters <= 0) return false;
  return haversineDistanceMeters(point, zone.center) <= zone.radiusMeters;
}

export interface GeofenceContainmentSummary {
  zoneId: string;
  zoneName: string;
  insideEnginIds: string[];
  outsideCount: number;
}

/**
 * Evaluates which engins are currently inside each active geofence.
 */
export function evaluateFleetGeofences(
  fleet: Engin[],
  zones: GeofenceZone[]
): GeofenceContainmentSummary[] {
  return zones.map((zone) => {
    const insideEnginIds = fleet
      .filter((engin) => isPointInGeofence(engin.position, zone))
      .map((engin) => engin.id);
    return {
      zoneId: zone.id,
      zoneName: zone.name,
      insideEnginIds,
      outsideCount: Math.max(0, fleet.length - insideEnginIds.length),
    };
  });
}

/**
 * Validates form input for registering a new engin in Côte d'Ivoire.
 * Never substitutes fallback values for empty/invalid fields.
 */
export function validateNewEnginInput(
  input: NewEnginInput,
  existingFleet: Engin[]
): ValidationErrors {
  const errors: ValidationErrors = {};

  const trimmedName = input.name.trim();
  if (trimmedName.length < 3) {
    errors.name = 'Veuillez saisir une désignation d’engin valide (au moins 3 caractères).';
  }

  const trimmedPlate = input.plateOrSerial.trim();
  if (trimmedPlate.length < 4) {
    errors.plateOrSerial =
      'Saisissez l’immatriculation CI (ex: 4821 KP 01) ou le numéro de série chantier.';
  } else if (
    existingFleet.some(
      (e) => e.plateOrSerial.trim().toLowerCase() === trimmedPlate.toLowerCase()
    )
  ) {
    errors.plateOrSerial = 'Cette immatriculation ou ce numéro de série est déjà enregistré.';
  }

  const cleanImei = input.imei.replace(/\s+/g, '');
  if (!/^\d{15}$/.test(cleanImei)) {
    errors.imei = 'Le numéro IMEI du traceur GPS doit comporter exactement 15 chiffres.';
  } else if (existingFleet.some((e) => e.imei === cleanImei)) {
    errors.imei = 'Ce boîtier IMEI est déjà affecté à un autre engin du parc.';
  }

  if (input.driverName.trim().length < 3) {
    errors.driverName = 'Indiquez le nom du conducteur ou responsable de site.';
  }

  const cleanPhone = input.driverPhone.trim();
  if (!/^(\+225\s?)?\d{2}(\s?\d{2}){4}$/.test(cleanPhone)) {
    errors.driverPhone =
      'Format téléphone ivoirien attendu à 10 chiffres (ex: +225 07 48 12 90 33).';
  }

  if (
    !Number.isFinite(input.fuelCapacityLiters) ||
    input.fuelCapacityLiters < 5 ||
    input.fuelCapacityLiters > 5000
  ) {
    errors.fuelCapacityLiters = 'La capacité réservoir doit être comprise entre 5 L et 5 000 L.';
  }

  return errors;
}

export interface FleetMetrics {
  totalEngins: number;
  movingCount: number;
  workingIdleCount: number;
  immobilizedCount: number;
  unacknowledgedAlertsCount: number;
  averageFuelPercent: number;
  totalFuelLitersAvailable: number;
  maintenanceDueSoonCount: number;
}

/**
 * Computes top-level KPI metrics across the fleet.
 */
export function computeFleetMetrics(fleet: Engin[], alerts: FleetAlert[]): FleetMetrics {
  const totalEngins = fleet.length;
  if (totalEngins === 0) {
    return {
      totalEngins: 0,
      movingCount: 0,
      workingIdleCount: 0,
      immobilizedCount: 0,
      unacknowledgedAlertsCount: alerts.filter((a) => !a.acknowledged).length,
      averageFuelPercent: 0,
      totalFuelLitersAvailable: 0,
      maintenanceDueSoonCount: 0,
    };
  }

  let movingCount = 0;
  let workingIdleCount = 0;
  let immobilizedCount = 0;
  let fuelPercentSum = 0;
  let totalFuelLitersAvailable = 0;
  let maintenanceDueSoonCount = 0;

  for (const engin of fleet) {
    if (engin.immobilizerActive || engin.status === EnginStatus.COUPE_CIRCUIT) {
      immobilizedCount += 1;
    } else if (engin.speedKmh > 10 && engin.ignitionOn) {
      movingCount += 1;
    } else if (engin.ignitionOn) {
      workingIdleCount += 1;
    }

    fuelPercentSum += engin.fuelLevelPercent;
    totalFuelLitersAvailable += (engin.fuelLevelPercent / 100) * engin.fuelCapacityLiters;

    if (engin.nextMaintenanceHours - engin.engineHours <= 60) {
      maintenanceDueSoonCount += 1;
    }
  }

  return {
    totalEngins,
    movingCount,
    workingIdleCount,
    immobilizedCount,
    unacknowledgedAlertsCount: alerts.filter((a) => !a.acknowledged).length,
    averageFuelPercent: Math.round(fuelPercentSum / totalEngins),
    totalFuelLitersAvailable: Math.round(totalFuelLitersAvailable),
    maintenanceDueSoonCount,
  };
}

/**
 * Advances live GPS telemetry by one deterministic tick for active/moving engins.
 */
export function stepEnginTelemetry(engin: Engin, tickIndex: number, nowIso: string): Engin {
  if (engin.immobilizerActive || !engin.ignitionOn) {
    return {
      ...engin,
      speedKmh: 0,
    };
  }

  if (engin.category === EnginCategory.GROUPE_REMORQUE) {
    return {
      ...engin,
      engineHours: Number((engin.engineHours + 0.01).toFixed(2)),
      lastUpdateIso: nowIso,
    };
  }

  // Convert heading & speed into small realistic displacement (~3 seconds of travel)
  const speedVariation = ((tickIndex % 3) - 1) * 2;
  const nextSpeed = Math.max(
    engin.status === EnginStatus.RALENTI_CHANTIER ? 3 : 18,
    Math.min(92, engin.speedKmh + speedVariation)
  );

  const distanceMeters = (nextSpeed * 1000 * 3) / 3600;
  const headingRad = toRadians(engin.heading);
  const deltaLat = (distanceMeters * Math.cos(headingRad)) / EARTH_RADIUS_METERS * (180 / Math.PI);
  const deltaLng =
    ((distanceMeters * Math.sin(headingRad)) /
      (EARTH_RADIUS_METERS * Math.cos(toRadians(engin.position.lat)))) *
    (180 / Math.PI);

  const nextPos: LatLngPoint = {
    lat: Number((engin.position.lat + deltaLat).toFixed(6)),
    lng: Number((engin.position.lng + deltaLng).toFixed(6)),
  };

  const nextTrail = [...engin.trail.slice(-14), nextPos];

  return {
    ...engin,
    position: nextPos,
    speedKmh: nextSpeed,
    odometerKm: Number((engin.odometerKm + distanceMeters / 1000).toFixed(2)),
    engineHours: Number((engin.engineHours + 0.01).toFixed(2)),
    lastUpdateIso: nowIso,
    trail: nextTrail,
  };
}

/**
 * Toggles the remote engine immobilizer relay (Coupe-circuit anti-vol GPRS/SMS).
 */
export function toggleEnginImmobilizer(
  engin: Engin,
  activateImmobilizer: boolean,
  nowIso: string
): Engin {
  if (activateImmobilizer) {
    return {
      ...engin,
      immobilizerActive: true,
      ignitionOn: false,
      speedKmh: 0,
      status: EnginStatus.COUPE_CIRCUIT,
      lastUpdateIso: nowIso,
    };
  }
  return {
    ...engin,
    immobilizerActive: false,
    ignitionOn: false,
    speedKmh: 0,
    status: EnginStatus.STATIONNE,
    lastUpdateIso: nowIso,
  };
}

/**
 * Formats fleet inventory into a UTF-8 CSV string ready for download.
 */
export function exportFleetToCsv(fleet: Engin[]): string {
  const headers = [
    'ID',
    'Designation',
    'Immatriculation_Serie',
    'Categorie',
    'Statut',
    'IMEI',
    'Operateur_SIM',
    'Conducteur',
    'Telephone',
    'Localisation',
    'Latitude',
    'Longitude',
    'Vitesse_kmh',
    'Carburant_pct',
    'Carburant_Litres',
    'Heures_Moteur',
    'Kilometrage_km',
  ];

  const escapeCsvCell = (val: string | number): string => {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = fleet.map((e) => {
    const liters = Math.round((e.fuelLevelPercent / 100) * e.fuelCapacityLiters);
    return [
      e.id,
      e.name,
      e.plateOrSerial,
      CATEGORY_LABELS[e.category],
      STATUS_LABELS[e.status],
      e.imei,
      e.simOperator,
      e.driverName,
      e.driverPhone,
      e.locationLabel,
      e.position.lat,
      e.position.lng,
      e.speedKmh,
      e.fuelLevelPercent,
      liters,
      e.engineHours.toFixed(1),
      Math.round(e.odometerKm),
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceServiceType, string> = {
  [MaintenanceServiceType.VIDANGE_MOTEUR]: 'Vidange & Filtration Moteur',
  [MaintenanceServiceType.HYDRAULIQUE_FILTRES]: 'Circuit Hydraulique & Filtres',
  [MaintenanceServiceType.FREINAGE_TRANSMISSION]: 'Freinage, Pont & Transmission',
  [MaintenanceServiceType.SONDE_BALISE_GPS]: 'Balise GPS, Sonde & Électricité',
  [MaintenanceServiceType.REVISION_GENERALE]: 'Révision Générale Constructeur',
};

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  [MaintenanceStatus.OVERDUE]: 'En retard',
  [MaintenanceStatus.PENDING]: 'À venir',
  [MaintenanceStatus.COMPLETED]: 'Terminée',
};

export interface EvaluatedMaintenanceRecord extends MaintenanceRecord {
  status: MaintenanceStatus;
  enginName: string;
  plateOrSerial: string;
  category: EnginCategory;
  currentEngineHours: number;
  /** Positive means remaining hours before target; negative means hours overdue */
  hoursDelta: number;
  isUrgentPending: boolean;
}

/**
 * Derives maintenance status (`OVERDUE`, `PENDING`, `COMPLETED`) directly from live engine hours.
 */
export function deriveMaintenanceStatus(
  record: Pick<MaintenanceRecord, 'completed' | 'targetEngineHours'>,
  currentEngineHours: number
): MaintenanceStatus {
  if (record.completed) {
    return MaintenanceStatus.COMPLETED;
  }
  if (currentEngineHours >= record.targetEngineHours) {
    return MaintenanceStatus.OVERDUE;
  }
  return MaintenanceStatus.PENDING;
}

/**
 * Enriches maintenance records with live engin horameter readings and sorts:
 * 1. Overdue (most overdue first), 2. Pending (closest due first), 3. Completed (most recent first).
 */
export function evaluateMaintenanceLogs(
  records: MaintenanceRecord[],
  fleet: Engin[]
): EvaluatedMaintenanceRecord[] {
  const fleetMap = new Map<string, Engin>(fleet.map((e) => [e.id, e]));

  const evaluated: EvaluatedMaintenanceRecord[] = [];
  for (const rec of records) {
    const engin = fleetMap.get(rec.enginId);
    if (!engin) continue;

    const status = deriveMaintenanceStatus(rec, engin.engineHours);
    const hoursDelta = Number((rec.targetEngineHours - engin.engineHours).toFixed(1));
    evaluated.push({
      ...rec,
      status,
      enginName: engin.name,
      plateOrSerial: engin.plateOrSerial,
      category: engin.category,
      currentEngineHours: engin.engineHours,
      hoursDelta,
      isUrgentPending: status === MaintenanceStatus.PENDING && hoursDelta <= 50,
    });
  }

  const priorityRank: Record<MaintenanceStatus, number> = {
    [MaintenanceStatus.OVERDUE]: 0,
    [MaintenanceStatus.PENDING]: 1,
    [MaintenanceStatus.COMPLETED]: 2,
  };

  return evaluated.sort((a, b) => {
    if (priorityRank[a.status] !== priorityRank[b.status]) {
      return priorityRank[a.status] - priorityRank[b.status];
    }
    if (a.status === MaintenanceStatus.COMPLETED) {
      return b.scheduledOrCompletedDateIso.localeCompare(a.scheduledOrCompletedDateIso);
    }
    return a.hoursDelta - b.hoursDelta;
  });
}

export interface MaintenanceSummaryMetrics {
  overdueCount: number;
  pendingCount: number;
  urgentPendingCount: number;
  completedCount: number;
  completedCostFcfa: number;
  plannedOrOverdueCostFcfa: number;
}

export function computeMaintenanceMetrics(
  evaluated: EvaluatedMaintenanceRecord[]
): MaintenanceSummaryMetrics {
  let overdueCount = 0;
  let pendingCount = 0;
  let urgentPendingCount = 0;
  let completedCount = 0;
  let completedCostFcfa = 0;
  let plannedOrOverdueCostFcfa = 0;

  for (const item of evaluated) {
    if (item.status === MaintenanceStatus.OVERDUE) {
      overdueCount += 1;
      plannedOrOverdueCostFcfa += item.costFcfa;
    } else if (item.status === MaintenanceStatus.PENDING) {
      pendingCount += 1;
      if (item.isUrgentPending) urgentPendingCount += 1;
      plannedOrOverdueCostFcfa += item.costFcfa;
    } else {
      completedCount += 1;
      completedCostFcfa += item.costFcfa;
    }
  }

  return {
    overdueCount,
    pendingCount,
    urgentPendingCount,
    completedCount,
    completedCostFcfa,
    plannedOrOverdueCostFcfa,
  };
}

/**
 * Validates input when logging or scheduling a maintenance operation.
 */
export function validateNewMaintenanceInput(
  input: NewMaintenanceInput,
  fleet: Engin[]
): MaintenanceValidationErrors {
  const errors: MaintenanceValidationErrors = {};

  if (!input.enginId || !fleet.some((e) => e.id === input.enginId)) {
    errors.enginId = 'Veuillez sélectionner un engin valide du parc.';
  }

  if (input.title.trim().length < 4) {
    errors.title = 'Indiquez l’intitulé de l’opération (au moins 4 caractères).';
  }

  if (input.workshopOrTechnician.trim().length < 3) {
    errors.workshopOrTechnician = 'Précisez l’atelier ou le technicien intervenant.';
  }

  if (!Number.isFinite(input.targetEngineHours) || input.targetEngineHours <= 0) {
    errors.targetEngineHours = 'Le seuil horamètre doit être un nombre supérieur à 0 h.';
  }

  if (!Number.isFinite(input.costFcfa) || input.costFcfa < 0) {
    errors.costFcfa = 'Le coût en FCFA doit être supérieur ou égal à 0.';
  }

  return errors;
}

/**
 * Computes the next maintenance target hours for an engin based on remaining open logs
 * or a default +250 h interval.
 */
export function computeNextMaintenanceHoursForEngin(
  engin: Engin,
  records: MaintenanceRecord[]
): number {
  const openTargets = records
    .filter((r) => r.enginId === engin.id && !r.completed)
    .map((r) => r.targetEngineHours)
    .sort((a, b) => a - b);

  if (openTargets.length > 0) {
    return openTargets[0];
  }
  return Math.ceil((engin.engineHours + 250) / 50) * 50;
}

export const DIESEL_PRICE_FCFA_PER_LITER = 715;

export interface EnginFuelBenchmark {
  unit: FuelRateUnit;
  nominalRate: number;
  unitLabel: string;
}

const SPECIFIC_ENGIN_BENCHMARKS: Record<string, { unit: FuelRateUnit; nominalRate: number }> = {
  'eng-01': { unit: 'L_100KM', nominalRate: 38.0 },
  'eng-02': { unit: 'L_HOUR', nominalRate: 18.5 },
  'eng-03': { unit: 'L_100KM', nominalRate: 42.0 },
  'eng-04': { unit: 'L_HOUR', nominalRate: 7.5 },
  'eng-05': { unit: 'L_HOUR', nominalRate: 21.0 },
  'eng-06': { unit: 'L_100KM', nominalRate: 9.5 },
  'eng-07': { unit: 'L_100KM', nominalRate: 4.8 },
  'eng-08': { unit: 'L_HOUR', nominalRate: 16.0 },
};

const CATEGORY_DEFAULT_BENCHMARKS: Record<
  EnginCategory,
  { unit: FuelRateUnit; nominalRate: number }
> = {
  [EnginCategory.POIDS_LOURDS]: { unit: 'L_100KM', nominalRate: 39.0 },
  [EnginCategory.LEGER_UTILITAIRE]: { unit: 'L_100KM', nominalRate: 9.5 },
  [EnginCategory.MOTO_TRICYCLE]: { unit: 'L_100KM', nominalRate: 4.8 },
  [EnginCategory.BTP_MINES]: { unit: 'L_HOUR', nominalRate: 19.5 },
  [EnginCategory.AGRICOLE]: { unit: 'L_HOUR', nominalRate: 7.5 },
  [EnginCategory.GROUPE_REMORQUE]: { unit: 'L_HOUR', nominalRate: 16.0 },
};

export function getEnginFuelBenchmark(engin: Engin): EnginFuelBenchmark {
  const spec =
    SPECIFIC_ENGIN_BENCHMARKS[engin.id] ?? CATEGORY_DEFAULT_BENCHMARKS[engin.category];
  return {
    unit: spec.unit,
    nominalRate: spec.nominalRate,
    unitLabel: spec.unit === 'L_100KM' ? 'L/100 km' : 'L/h',
  };
}

export interface FuelPeriodBounds {
  startIso: string;
  endIso: string;
  dayCount: number;
}

/**
 * Resolves inclusive YYYY-MM-DD start and end bounds for a preset or custom date window.
 */
export function resolveFuelPeriodBounds(
  preset: FuelPeriodPreset,
  referenceTodayIso: string,
  customStartIso?: string,
  customEndIso?: string
): FuelPeriodBounds {
  const dayMs = 24 * 60 * 60 * 1000;
  if (preset === 'CUSTOM' && customStartIso && customEndIso) {
    const sorted =
      customStartIso <= customEndIso
        ? [customStartIso, customEndIso]
        : [customEndIso, customStartIso];
    const startMs = Date.parse(`${sorted[0]}T00:00:00Z`);
    const endMs = Date.parse(`${sorted[1]}T00:00:00Z`);
    const days = Number.isFinite(startMs) && Number.isFinite(endMs)
      ? Math.max(1, Math.round((endMs - startMs) / dayMs) + 1)
      : 1;
    return {
      startIso: sorted[0],
      endIso: sorted[1],
      dayCount: days,
    };
  }

  const daysMap: Record<Exclude<FuelPeriodPreset, 'CUSTOM'>, number> = {
    '7D': 7,
    '15D': 15,
    '30D': 30,
    '90D': 90,
  };
  const days = preset === 'CUSTOM' ? 30 : daysMap[preset];
  const endMs = Date.parse(`${referenceTodayIso}T00:00:00Z`);
  const startIso = new Date(endMs - (days - 1) * dayMs).toISOString().slice(0, 10);

  return {
    startIso,
    endIso: referenceTodayIso,
    dayCount: days,
  };
}

export interface EvaluatedEnginFuelConsumption {
  enginId: string;
  enginName: string;
  plateOrSerial: string;
  category: EnginCategory;
  driverName: string;
  locationLabel: string;
  unit: FuelRateUnit;
  unitLabel: string;
  nominalRate: number;
  activeDaysCount: number;
  totalLitersConsumed: number;
  totalRefueledLiters: number;
  totalDistanceKm: number;
  totalEngineHoursWorked: number;
  avgLitersPer100Km: number | null;
  avgLitersPerHour: number | null;
  primaryAverageRate: number | null;
  expectedLiters: number;
  excessLiters: number;
  deviationPercent: number;
  totalCostFcfa: number;
  excessCostFcfa: number;
  status: FuelConsumptionStatus;
  dailyLogs: FuelDailyLog[];
}

export const FUEL_STATUS_LABELS: Record<FuelConsumptionStatus, string> = {
  [FuelConsumptionStatus.SURCONSOMMATION]: 'Surconsommation',
  [FuelConsumptionStatus.VIGILANCE]: 'Vigilance',
  [FuelConsumptionStatus.CONFORME]: 'Conforme',
  [FuelConsumptionStatus.SANS_ACTIVITE]: 'Aucune activité',
};

/**
 * Computes average fuel consumption per engin over [startIso, endIso] and flags overconsumption.
 */
export function evaluateFleetFuelConsumption(
  fleet: Engin[],
  logs: FuelDailyLog[],
  startIso: string,
  endIso: string,
  overconsumptionThresholdPct = 15,
  dieselPriceFcfa = DIESEL_PRICE_FCFA_PER_LITER
): EvaluatedEnginFuelConsumption[] {
  const logsByEngin = new Map<string, FuelDailyLog[]>();
  for (const log of logs) {
    if (log.dateIso < startIso || log.dateIso > endIso) continue;
    const list = logsByEngin.get(log.enginId);
    if (list) {
      list.push(log);
    } else {
      logsByEngin.set(log.enginId, [log]);
    }
  }

  const vigilanceFloor = Math.max(5, Number((overconsumptionThresholdPct * 0.55).toFixed(1)));

  const results: EvaluatedEnginFuelConsumption[] = fleet.map((engin) => {
    const benchmark = getEnginFuelBenchmark(engin);
    const enginLogs = (logsByEngin.get(engin.id) ?? [])
      .slice()
      .sort((a, b) => a.dateIso.localeCompare(b.dateIso));

    const uniqueDates = new Set(enginLogs.map((l) => l.dateIso));
    const totalLitersConsumed = Number(
      enginLogs.reduce((acc, l) => acc + l.litersConsumed, 0).toFixed(1)
    );
    const totalRefueledLiters = Math.round(
      enginLogs.reduce((acc, l) => acc + l.refueledLiters, 0)
    );
    const totalDistanceKm = Number(
      enginLogs.reduce((acc, l) => acc + l.distanceKm, 0).toFixed(1)
    );
    const totalEngineHoursWorked = Number(
      enginLogs.reduce((acc, l) => acc + l.engineHoursWorked, 0).toFixed(1)
    );

    const avgLitersPer100Km =
      totalDistanceKm > 0
        ? Number(((totalLitersConsumed / totalDistanceKm) * 100).toFixed(1))
        : null;
    const avgLitersPerHour =
      totalEngineHoursWorked > 0
        ? Number((totalLitersConsumed / totalEngineHoursWorked).toFixed(1))
        : null;

    const primaryAverageRate =
      benchmark.unit === 'L_100KM' ? avgLitersPer100Km : avgLitersPerHour;

    const expectedLiters =
      benchmark.unit === 'L_100KM'
        ? Number(((totalDistanceKm / 100) * benchmark.nominalRate).toFixed(1))
        : Number((totalEngineHoursWorked * benchmark.nominalRate).toFixed(1));

    let status = FuelConsumptionStatus.SANS_ACTIVITE;
    let deviationPercent = 0;
    let excessLiters = 0;

    if (primaryAverageRate !== null && expectedLiters > 0) {
      deviationPercent = Number(
        (((primaryAverageRate - benchmark.nominalRate) / benchmark.nominalRate) * 100).toFixed(
          1
        )
      );
      excessLiters = Math.max(
        0,
        Number((totalLitersConsumed - expectedLiters).toFixed(1))
      );

      if (deviationPercent >= overconsumptionThresholdPct) {
        status = FuelConsumptionStatus.SURCONSOMMATION;
      } else if (deviationPercent >= vigilanceFloor) {
        status = FuelConsumptionStatus.VIGILANCE;
      } else {
        status = FuelConsumptionStatus.CONFORME;
      }
    }

    return {
      enginId: engin.id,
      enginName: engin.name,
      plateOrSerial: engin.plateOrSerial,
      category: engin.category,
      driverName: engin.driverName,
      locationLabel: engin.locationLabel,
      unit: benchmark.unit,
      unitLabel: benchmark.unitLabel,
      nominalRate: benchmark.nominalRate,
      activeDaysCount: uniqueDates.size,
      totalLitersConsumed,
      totalRefueledLiters,
      totalDistanceKm,
      totalEngineHoursWorked,
      avgLitersPer100Km,
      avgLitersPerHour,
      primaryAverageRate,
      expectedLiters,
      excessLiters,
      deviationPercent,
      totalCostFcfa: Math.round(totalLitersConsumed * dieselPriceFcfa),
      excessCostFcfa: Math.round(excessLiters * dieselPriceFcfa),
      status,
      dailyLogs: enginLogs,
    };
  });

  const statusOrder: Record<FuelConsumptionStatus, number> = {
    [FuelConsumptionStatus.SURCONSOMMATION]: 0,
    [FuelConsumptionStatus.VIGILANCE]: 1,
    [FuelConsumptionStatus.CONFORME]: 2,
    [FuelConsumptionStatus.SANS_ACTIVITE]: 3,
  };

  return results.sort((a, b) => {
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return b.deviationPercent - a.deviationPercent;
  });
}

export interface FuelConsumptionFleetSummary {
  totalLitersConsumed: number;
  totalRefueledLiters: number;
  totalCostFcfa: number;
  overconsumingCount: number;
  vigilanceCount: number;
  conformeCount: number;
  totalExcessLiters: number;
  totalExcessCostFcfa: number;
  averageDeviationPercent: number;
}

export function computeFuelConsumptionSummary(
  rows: EvaluatedEnginFuelConsumption[]
): FuelConsumptionFleetSummary {
  let totalLitersConsumed = 0;
  let totalRefueledLiters = 0;
  let totalCostFcfa = 0;
  let overconsumingCount = 0;
  let vigilanceCount = 0;
  let conformeCount = 0;
  let totalExcessLiters = 0;
  let totalExcessCostFcfa = 0;
  let activeCount = 0;
  let deviationSum = 0;

  for (const row of rows) {
    totalLitersConsumed += row.totalLitersConsumed;
    totalRefueledLiters += row.totalRefueledLiters;
    totalCostFcfa += row.totalCostFcfa;
    totalExcessLiters += row.excessLiters;
    totalExcessCostFcfa += row.excessCostFcfa;

    if (row.status === FuelConsumptionStatus.SURCONSOMMATION) {
      overconsumingCount += 1;
      activeCount += 1;
      deviationSum += row.deviationPercent;
    } else if (row.status === FuelConsumptionStatus.VIGILANCE) {
      vigilanceCount += 1;
      activeCount += 1;
      deviationSum += row.deviationPercent;
    } else if (row.status === FuelConsumptionStatus.CONFORME) {
      conformeCount += 1;
      activeCount += 1;
      deviationSum += row.deviationPercent;
    }
  }

  return {
    totalLitersConsumed: Math.round(totalLitersConsumed),
    totalRefueledLiters: Math.round(totalRefueledLiters),
    totalCostFcfa: Math.round(totalCostFcfa),
    overconsumingCount,
    vigilanceCount,
    conformeCount,
    totalExcessLiters: Number(totalExcessLiters.toFixed(1)),
    totalExcessCostFcfa: Math.round(totalExcessCostFcfa),
    averageDeviationPercent:
      activeCount > 0 ? Number((deviationSum / activeCount).toFixed(1)) : 0,
  };
}

/**
 * Validates form input when logging a manual fuel probe / refueling record.
 */
export function validateNewFuelLogInput(
  input: NewFuelLogInput,
  fleet: Engin[]
): FuelLogValidationErrors {
  const errors: FuelLogValidationErrors = {};
  const engin = fleet.find((e) => e.id === input.enginId);

  if (!engin) {
    errors.enginId = 'Veuillez sélectionner un engin valide du parc.';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateIso.trim())) {
    errors.dateIso = 'Indiquez une date de relevé valide (AAAA-MM-JJ).';
  }

  if (
    !Number.isFinite(input.litersConsumed) ||
    input.litersConsumed <= 0 ||
    input.litersConsumed > 5000
  ) {
    errors.litersConsumed =
      'Le volume consommé doit être compris entre 0,5 L et 5 000 L.';
  }

  if (engin) {
    const benchmark = getEnginFuelBenchmark(engin);
    if (
      benchmark.unit === 'L_100KM' &&
      (!Number.isFinite(input.distanceKm) || input.distanceKm <= 0)
    ) {
      errors.activity =
        'Renseignez la distance parcourue (> 0 km) pour calculer la moyenne en L/100 km.';
    } else if (
      benchmark.unit === 'L_HOUR' &&
      (!Number.isFinite(input.engineHoursWorked) || input.engineHoursWorked <= 0)
    ) {
      errors.activity =
        'Renseignez la durée horamètre (> 0 h) pour calculer la moyenne en L/h.';
    }
  }

  if (
    !Number.isFinite(input.refueledLiters) ||
    input.refueledLiters < 0 ||
    input.refueledLiters > 5000
  ) {
    errors.refueledLiters = 'Le volume ravitaillé doit être compris entre 0 L et 5 000 L.';
  }

  return errors;
}

/**
 * Exports the evaluated fuel consumption table for a period into a UTF-8 CSV string.
 */
export function exportFuelConsumptionToCsv(
  rows: EvaluatedEnginFuelConsumption[],
  startIso: string,
  endIso: string
): string {
  const headers = [
    'Periode_Debut',
    'Periode_Fin',
    'Immatriculation_Serie',
    'Engin',
    'Categorie',
    'Statut_Consommation',
    'Moyenne_Mesuree',
    'Seuil_Nominal',
    'Unite',
    'Ecart_Pct',
    'Volume_Consomme_L',
    'Surconsommation_Estimee_L',
    'Cout_Total_FCFA',
    'Surcout_Estime_FCFA',
    'Distance_km',
    'Heures_Moteur_h',
  ];

  const escapeCsvCell = (val: string | number): string => {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = rows.map((r) =>
    [
      startIso,
      endIso,
      r.plateOrSerial,
      r.enginName,
      CATEGORY_LABELS[r.category],
      FUEL_STATUS_LABELS[r.status],
      r.primaryAverageRate ?? 0,
      r.nominalRate,
      r.unitLabel,
      r.deviationPercent,
      r.totalLitersConsumed,
      r.excessLiters,
      r.totalCostFcfa,
      r.excessCostFcfa,
      r.totalDistanceKm,
      r.totalEngineHoursWorked,
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return [headers.join(','), ...lines].join('\n');
}

/**
 * Formats evaluated maintenance logs into a UTF-8 CSV string for Excel / reporting.
 */
export function exportMaintenanceToCsv(evaluated: EvaluatedMaintenanceRecord[]): string {
  const headers = [
    'ID',
    'Statut',
    'Immatriculation_Serie',
    'Engin',
    'Categorie',
    'Type_Intervention',
    'Intitule',
    'Atelier_Technicien',
    'Horametre_Actuel_h',
    'Seuil_Cible_h',
    'Ecart_Horametre_h',
    'Cout_FCFA',
    'Date_Prevue_Ou_Cloture',
  ];

  const escapeCsvCell = (val: string | number): string => {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = evaluated.map((rec) =>
    [
      rec.id,
      MAINTENANCE_STATUS_LABELS[rec.status],
      rec.plateOrSerial,
      rec.enginName,
      CATEGORY_LABELS[rec.category],
      MAINTENANCE_TYPE_LABELS[rec.serviceType],
      rec.title,
      rec.workshopOrTechnician,
      rec.currentEngineHours.toFixed(1),
      rec.targetEngineHours,
      rec.hoursDelta.toFixed(1),
      rec.costFcfa,
      rec.scheduledOrCompletedDateIso.slice(0, 10),
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

export const ALERT_TYPE_EXPORT_LABELS: Record<AlertType, string> = {
  [AlertType.SIPHONAGE_CARBURANT]: 'Siphonage carburant',
  [AlertType.SORTIE_ZONE]: 'Sortie / Entrée de zone',
  [AlertType.EXCES_VITESSE]: 'Excès de vitesse',
  [AlertType.COUPURE_MOTEUR]: 'Coupe-circuit moteur',
  [AlertType.BATTERIE_EXTERNE]: 'Maintenance & Batterie',
};

export const ALERT_SEVERITY_EXPORT_LABELS: Record<AlertSeverity, string> = {
  [AlertSeverity.CRITIQUE]: 'Critique',
  [AlertSeverity.ATTENTION]: 'Attention',
  [AlertSeverity.INFO]: 'Information',
};

/**
 * Formats security and fuel alerts into a UTF-8 CSV string.
 */
export function exportAlertsToCsv(alerts: FleetAlert[]): string {
  const headers = [
    'ID',
    'Horodatage_ISO',
    'Severite',
    'Type_Alerte',
    'Immatriculation_Serie',
    'Engin',
    'Titre',
    'Localisation',
    'Statut_Acquittement',
  ];

  const escapeCsvCell = (val: string | number): string => {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = alerts.map((a) =>
    [
      a.id,
      a.timestampIso,
      ALERT_SEVERITY_EXPORT_LABELS[a.severity],
      ALERT_TYPE_EXPORT_LABELS[a.type],
      a.plateOrSerial,
      a.enginName,
      a.title,
      a.locationLabel,
      a.acknowledged ? 'Acquittée' : 'Non acquittée',
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Serializes the complete operational state of IvoireTrack GPS into a formatted JSON backup.
 */
export function serializeFleetBackupJson(payload: {
  exportedAtIso: string;
  fleet: Engin[];
  geofences: GeofenceZone[];
  alerts: FleetAlert[];
  maintenanceLogs: MaintenanceRecord[];
  fuelLogs: FuelDailyLog[];
}): string {
  const bundle: FleetBackupBundle = {
    application: 'IvoireTrack GPS',
    version: 1,
    exportedAtIso: payload.exportedAtIso,
    fleet: payload.fleet,
    geofences: payload.geofences,
    alerts: payload.alerts,
    maintenanceLogs: payload.maintenanceLogs,
    fuelLogs: payload.fuelLogs,
  };
  return JSON.stringify(bundle, null, 2);
}

/**
 * Parses and strictly validates an imported JSON backup file before restoring state.
 */
export function parseFleetBackupJson(
  rawJson: string
): { ok: true; data: FleetBackupBundle } | { ok: false; error: string } {
  if (!rawJson.trim()) {
    return { ok: false, error: 'Le fichier ou contenu JSON fourni est vide.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      ok: false,
      error: 'Format JSON invalide. Vérifiez que le fichier provient bien d’IvoireTrack GPS.',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Structure de sauvegarde non reconnue.' };
  }

  const candidate = parsed as Partial<FleetBackupBundle>;
  if (
    candidate.application !== 'IvoireTrack GPS' ||
    !Array.isArray(candidate.fleet) ||
    !Array.isArray(candidate.geofences) ||
    !Array.isArray(candidate.alerts) ||
    !Array.isArray(candidate.maintenanceLogs) ||
    !Array.isArray(candidate.fuelLogs)
  ) {
    return {
      ok: false,
      error:
        'Ce fichier JSON ne contient pas les tables requises (parc, zones, maintenance, carburant, alertes).',
    };
  }

  const hasValidFleetItems = candidate.fleet.every(
    (item) =>
      item &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      typeof item.plateOrSerial === 'string' &&
      item.position &&
      typeof item.position.lat === 'number' &&
      typeof item.position.lng === 'number'
  );

  if (!hasValidFleetItems) {
    return {
      ok: false,
      error: 'Les fiches engins du fichier de sauvegarde sont incomplètes ou altérées.',
    };
  }

  return {
    ok: true,
    data: {
      application: 'IvoireTrack GPS',
      version: 1,
      exportedAtIso:
        typeof candidate.exportedAtIso === 'string'
          ? candidate.exportedAtIso
          : new Date().toISOString(),
      fleet: candidate.fleet,
      geofences: candidate.geofences,
      alerts: candidate.alerts,
      maintenanceLogs: candidate.maintenanceLogs,
      fuelLogs: candidate.fuelLogs,
    },
  };
}


