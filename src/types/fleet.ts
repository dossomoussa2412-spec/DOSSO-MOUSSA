export enum EnginCategory {
  BTP_MINES = 'BTP_MINES',
  POIDS_LOURDS = 'POIDS_LOURDS',
  AGRICOLE = 'AGRICOLE',
  LEGER_UTILITAIRE = 'LEGER_UTILITAIRE',
  MOTO_TRICYCLE = 'MOTO_TRICYCLE',
  GROUPE_REMORQUE = 'GROUPE_REMORQUE',
}

export enum EnginStatus {
  EN_MOUVEMENT = 'EN_MOUVEMENT',
  RALENTI_CHANTIER = 'RALENTI_CHANTIER',
  STATIONNE = 'STATIONNE',
  COUPE_CIRCUIT = 'COUPE_CIRCUIT',
  ALERTE = 'ALERTE',
}

export enum SimOperator {
  ORANGE_CI = 'Orange CI',
  MTN_CI = 'MTN CI',
  MOOV_AFRICA = 'Moov Africa',
}

export enum AlertSeverity {
  CRITIQUE = 'CRITIQUE',
  ATTENTION = 'ATTENTION',
  INFO = 'INFO',
}

export enum AlertType {
  SIPHONAGE_CARBURANT = 'SIPHONAGE_CARBURANT',
  SORTIE_ZONE = 'SORTIE_ZONE',
  EXCES_VITESSE = 'EXCES_VITESSE',
  COUPURE_MOTEUR = 'COUPURE_MOTEUR',
  BATTERIE_EXTERNE = 'BATTERIE_EXTERNE',
}

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface GroundedHub {
  id: string;
  placeId: string;
  name: string;
  city: string;
  formattedAddress: string;
  location: LatLngPoint;
}

export interface Engin {
  id: string;
  name: string;
  plateOrSerial: string;
  category: EnginCategory;
  status: EnginStatus;
  imei: string;
  trackerModel: string;
  simOperator: SimOperator;
  gsmSignalPercent: number;
  driverName: string;
  driverPhone: string;
  hubId: string;
  locationLabel: string;
  position: LatLngPoint;
  heading: number;
  speedKmh: number;
  ignitionOn: boolean;
  immobilizerActive: boolean;
  fuelLevelPercent: number;
  fuelCapacityLiters: number;
  engineHours: number;
  odometerKm: number;
  externalVoltage: number;
  nextMaintenanceHours: number;
  lastUpdateIso: string;
  trail: LatLngPoint[];
}

export interface GeofenceZone {
  id: string;
  name: string;
  hubId: string;
  city: string;
  center: LatLngPoint;
  radiusMeters: number;
  alertOnExit: boolean;
  alertOnEntry: boolean;
  speedLimitKmh: number;
  active: boolean;
}

export interface FleetAlert {
  id: string;
  enginId: string;
  enginName: string;
  plateOrSerial: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  locationLabel: string;
  timestampIso: string;
  acknowledged: boolean;
}

export interface NewEnginInput {
  name: string;
  plateOrSerial: string;
  category: EnginCategory;
  imei: string;
  trackerModel: string;
  simOperator: SimOperator;
  driverName: string;
  driverPhone: string;
  hubId: string;
  fuelCapacityLiters: number;
}

export interface ValidationErrors {
  name?: string;
  plateOrSerial?: string;
  imei?: string;
  driverName?: string;
  driverPhone?: string;
  fuelCapacityLiters?: string;
}

export interface RouteSummary {
  originName: string;
  destinationName: string;
  distanceKm: number;
  durationMinutes: number;
}

export enum MaintenanceStatus {
  OVERDUE = 'OVERDUE',
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
}

export enum MaintenanceServiceType {
  VIDANGE_MOTEUR = 'VIDANGE_MOTEUR',
  HYDRAULIQUE_FILTRES = 'HYDRAULIQUE_FILTRES',
  FREINAGE_TRANSMISSION = 'FREINAGE_TRANSMISSION',
  SONDE_BALISE_GPS = 'SONDE_BALISE_GPS',
  REVISION_GENERALE = 'REVISION_GENERALE',
}

export interface MaintenanceRecord {
  id: string;
  enginId: string;
  serviceType: MaintenanceServiceType;
  title: string;
  workshopOrTechnician: string;
  targetEngineHours: number;
  completedAtEngineHours?: number;
  scheduledOrCompletedDateIso: string;
  costFcfa: number;
  notes: string;
  completed: boolean;
}

export interface NewMaintenanceInput {
  enginId: string;
  serviceType: MaintenanceServiceType;
  title: string;
  workshopOrTechnician: string;
  targetEngineHours: number;
  costFcfa: number;
  notes: string;
  completed: boolean;
}

export interface MaintenanceValidationErrors {
  enginId?: string;
  title?: string;
  workshopOrTechnician?: string;
  targetEngineHours?: string;
  costFcfa?: string;
}

export type FuelRateUnit = 'L_100KM' | 'L_HOUR';

export type FuelPeriodPreset = '7D' | '15D' | '30D' | '90D' | 'CUSTOM';

export enum FuelConsumptionStatus {
  SURCONSOMMATION = 'SURCONSOMMATION',
  VIGILANCE = 'VIGILANCE',
  CONFORME = 'CONFORME',
  SANS_ACTIVITE = 'SANS_ACTIVITE',
}

export interface FuelDailyLog {
  id: string;
  enginId: string;
  /** YYYY-MM-DD */
  dateIso: string;
  litersConsumed: number;
  distanceKm: number;
  engineHoursWorked: number;
  refueledLiters: number;
  stationOrNote?: string;
}

export interface NewFuelLogInput {
  enginId: string;
  dateIso: string;
  litersConsumed: number;
  distanceKm: number;
  engineHoursWorked: number;
  refueledLiters: number;
  stationOrNote: string;
}

export interface FuelLogValidationErrors {
  enginId?: string;
  dateIso?: string;
  litersConsumed?: string;
  activity?: string;
  refueledLiters?: string;
}

export interface FleetBackupBundle {
  application: 'IvoireTrack GPS';
  version: 1;
  exportedAtIso: string;
  fleet: Engin[];
  geofences: GeofenceZone[];
  alerts: FleetAlert[];
  maintenanceLogs: MaintenanceRecord[];
  fuelLogs: FuelDailyLog[];
}

export type ActiveWorkspaceView =
  | 'map'
  | 'fleet'
  | 'maintenance'
  | 'geofencing'
  | 'alerts'
  | 'exports';


