import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFleetMetrics,
  computeFuelConsumptionSummary,
  computeMaintenanceMetrics,
  computeNextMaintenanceHoursForEngin,
  deriveMaintenanceStatus,
  evaluateFleetFuelConsumption,
  evaluateFleetGeofences,
  evaluateMaintenanceLogs,
  exportAlertsToCsv,
  exportFleetToCsv,
  exportFuelConsumptionToCsv,
  exportMaintenanceToCsv,
  haversineDistanceMeters,
  isPointInGeofence,
  parseFleetBackupJson,
  resolveFuelPeriodBounds,
  serializeFleetBackupJson,
  stepEnginTelemetry,
  toggleEnginImmobilizer,
  validateNewEnginInput,
  validateNewFuelLogInput,
  validateNewMaintenanceInput,
} from './telemetry';
import {
  INITIAL_ALERTS,
  INITIAL_FLEET,
  INITIAL_FUEL_LOGS,
  INITIAL_GEOFENCES,
  INITIAL_MAINTENANCE_LOGS,
  REFERENCE_TODAY_ISO,
} from '../data/seedFleet';
import {
  EnginCategory,
  EnginStatus,
  FuelConsumptionStatus,
  MaintenanceServiceType,
  MaintenanceStatus,
  SimOperator,
} from '../types/fleet';

test('haversineDistanceMeters returns 0 for identical coordinates and accurate distance across Abidjan', () => {
  const paa = { lat: 5.2795558, lng: -3.9737778 };
  const plateau = { lat: 5.3325471, lng: -4.023869 };

  assert.equal(haversineDistanceMeters(paa, paa), 0);

  const dist = haversineDistanceMeters(paa, plateau);
  // Port Autonome d'Abidjan to Plateau is ~8.1 km
  assert.ok(dist > 7000 && dist < 9500, `Expected ~8.1km, got ${dist}m`);
});

test('isPointInGeofence and evaluateFleetGeofences accurately detect engins inside CI zones', () => {
  const paaZone = INITIAL_GEOFENCES[0]; // Port Autonome d'Abidjan, radius 3500m
  assert.equal(isPointInGeofence(INITIAL_FLEET[0].position, paaZone), true);
  assert.equal(isPointInGeofence(INITIAL_FLEET[4].position, paaZone), false); // Korhogo engin

  const disabledZone = { ...paaZone, active: false };
  assert.equal(isPointInGeofence(INITIAL_FLEET[0].position, disabledZone), false);

  const summary = evaluateFleetGeofences(INITIAL_FLEET, INITIAL_GEOFENCES);
  assert.equal(summary.length, INITIAL_GEOFENCES.length);
  const paaSummary = summary.find((s) => s.zoneId === 'geo-paa');
  assert.ok(paaSummary?.insideEnginIds.includes('eng-01'));
});

test('validateNewEnginInput enforces strict Ivorian phone, 15-digit IMEI, and uniqueness rules', () => {
  const invalidErrors = validateNewEnginInput(
    {
      name: 'AB',
      plateOrSerial: '4821 KP 01', // Duplicate plate from INITIAL_FLEET
      category: EnginCategory.AGRICOLE,
      imei: '12345',
      trackerModel: 'Teltonika FMB920',
      simOperator: SimOperator.ORANGE_CI,
      driverName: 'Ko',
      driverPhone: '074812', // Invalid length
      hubId: 'hub-daloa',
      fuelCapacityLiters: 0,
    },
    INITIAL_FLEET
  );

  assert.ok(invalidErrors.name);
  assert.ok(invalidErrors.plateOrSerial);
  assert.ok(invalidErrors.imei);
  assert.ok(invalidErrors.driverName);
  assert.ok(invalidErrors.driverPhone);
  assert.ok(invalidErrors.fuelCapacityLiters);

  const validErrors = validateNewEnginInput(
    {
      name: 'Tracteur Massey Ferguson 4708',
      plateOrSerial: '7731 AG 01',
      category: EnginCategory.AGRICOLE,
      imei: '869900112233445',
      trackerModel: 'Teltonika FMB920',
      simOperator: SimOperator.MTN_CI,
      driverName: 'Koffi Kouamé Denis',
      driverPhone: '+225 05 44 21 89 10',
      hubId: 'hub-daloa',
      fuelCapacityLiters: 120,
    },
    INITIAL_FLEET
  );

  assert.deepEqual(validErrors, {});
});

test('toggleEnginImmobilizer cuts engine, drops speed to 0, and sets COUPE_CIRCUIT status', () => {
  const movingTruck = INITIAL_FLEET[0];
  assert.ok(movingTruck.speedKmh > 0);

  const immobilized = toggleEnginImmobilizer(movingTruck, true, '2026-10-26T13:00:00Z');
  assert.equal(immobilized.immobilizerActive, true);
  assert.equal(immobilized.ignitionOn, false);
  assert.equal(immobilized.speedKmh, 0);
  assert.equal(immobilized.status, EnginStatus.COUPE_CIRCUIT);

  // Stepping telemetry while immobilized keeps position static and speed 0
  const afterTick = stepEnginTelemetry(immobilized, 1, '2026-10-26T13:00:03Z');
  assert.equal(afterTick.speedKmh, 0);
  assert.deepEqual(afterTick.position, immobilized.position);

  const restored = toggleEnginImmobilizer(immobilized, false, '2026-10-26T13:05:00Z');
  assert.equal(restored.immobilizerActive, false);
  assert.equal(restored.status, EnginStatus.STATIONNE);
});

test('computeFleetMetrics and exportFleetToCsv produce accurate numerical summaries', () => {
  const metrics = computeFleetMetrics(INITIAL_FLEET, INITIAL_ALERTS);
  assert.equal(metrics.totalEngins, 8);
  assert.equal(metrics.unacknowledgedAlertsCount, 3);
  assert.ok(metrics.totalFuelLitersAvailable > 1000);

  const csv = exportFleetToCsv(INITIAL_FLEET);
  const lines = csv.split('\n');
  assert.equal(lines.length, 9); // 1 header + 8 engins
  assert.ok(lines[0].includes('Immatriculation_Serie'));
  assert.ok(lines[1].includes('4821 KP 01'));
});

test('evaluateMaintenanceLogs classifies overdue, pending, and completed alerts from engine hours', () => {
  assert.equal(
    deriveMaintenanceStatus({ completed: false, targetEngineHours: 6400 }, 6412.8),
    MaintenanceStatus.OVERDUE
  );
  assert.equal(
    deriveMaintenanceStatus({ completed: false, targetEngineHours: 1500 }, 1480.0),
    MaintenanceStatus.PENDING
  );
  assert.equal(
    deriveMaintenanceStatus({ completed: true, targetEngineHours: 3000 }, 3194.2),
    MaintenanceStatus.COMPLETED
  );

  const evaluated = evaluateMaintenanceLogs(INITIAL_MAINTENANCE_LOGS, INITIAL_FLEET);
  const summary = computeMaintenanceMetrics(evaluated);

  assert.equal(summary.overdueCount, 2);
  assert.equal(summary.pendingCount, 5);
  assert.equal(summary.completedCount, 3);
  // First sorted items must be OVERDUE
  assert.equal(evaluated[0].status, MaintenanceStatus.OVERDUE);
  assert.ok(evaluated[0].hoursDelta < 0);
});

test('validateNewMaintenanceInput and computeNextMaintenanceHoursForEngin enforce strict rules', () => {
  const invalid = validateNewMaintenanceInput(
    {
      enginId: '',
      serviceType: MaintenanceServiceType.VIDANGE_MOTEUR,
      title: 'Ab',
      workshopOrTechnician: 'A',
      targetEngineHours: -10,
      costFcfa: -500,
      notes: '',
      completed: false,
    },
    INITIAL_FLEET
  );
  assert.ok(invalid.enginId);
  assert.ok(invalid.title);
  assert.ok(invalid.workshopOrTechnician);
  assert.ok(invalid.targetEngineHours);
  assert.ok(invalid.costFcfa);

  const valid = validateNewMaintenanceInput(
    {
      enginId: 'eng-01',
      serviceType: MaintenanceServiceType.VIDANGE_MOTEUR,
      title: 'Vidange 5 250 h moteur Sinotruk',
      workshopOrTechnician: 'Atelier Vridi Abidjan',
      targetEngineHours: 5250,
      costFcfa: 320000,
      notes: 'Huile 15W40',
      completed: false,
    },
    INITIAL_FLEET
  );
  assert.deepEqual(valid, {});

  // Completing eng-03's only open overdue task advances its nextMaintenanceHours automatically
  const eng03 = INITIAL_FLEET.find((e) => e.id === 'eng-03')!;
  const updatedLogs = INITIAL_MAINTENANCE_LOGS.map((m) =>
    m.id === 'mnt-01' ? { ...m, completed: true } : m
  );
  const nextTarget = computeNextMaintenanceHoursForEngin(eng03, updatedLogs);
  assert.ok(nextTarget > eng03.engineHours);
});

test('evaluateFleetFuelConsumption calculates 30-day & 7-day averages and detects overconsumption', () => {
  const bounds30 = resolveFuelPeriodBounds('30D', REFERENCE_TODAY_ISO);
  assert.equal(bounds30.dayCount, 30);
  assert.equal(bounds30.endIso, '2026-10-26');
  assert.equal(bounds30.startIso, '2026-09-27');

  const rows30 = evaluateFleetFuelConsumption(
    INITIAL_FLEET,
    INITIAL_FUEL_LOGS,
    bounds30.startIso,
    bounds30.endIso,
    15
  );
  const summary30 = computeFuelConsumptionSummary(rows30);

  // Grumier Actros (eng-03, L/100km) and Pelle Cat 320 GC (eng-02, L/h) are in SURCONSOMMATION at +15%
  assert.equal(summary30.overconsumingCount, 2);
  assert.equal(summary30.vigilanceCount, 2);
  assert.equal(summary30.conformeCount, 4);
  assert.ok(summary30.totalExcessLiters > 100);
  assert.ok(summary30.totalExcessCostFcfa > 70000);

  // Sorted with SURCONSOMMATION first
  assert.equal(rows30[0].status, FuelConsumptionStatus.SURCONSOMMATION);
  assert.equal(rows30[0].enginId, 'eng-03');
  assert.equal(rows30[0].unit, 'L_100KM');
  assert.ok((rows30[0].primaryAverageRate ?? 0) > rows30[0].nominalRate);

  // Lowering threshold from 15% to 10% promotes KOM-KRH-88 and WW 6319 CI into SURCONSOMMATION
  const rowsStrict = evaluateFleetFuelConsumption(
    INITIAL_FLEET,
    INITIAL_FUEL_LOGS,
    bounds30.startIso,
    bounds30.endIso,
    10
  );
  assert.equal(computeFuelConsumptionSummary(rowsStrict).overconsumingCount, 4);

  // 7-day window has lower total volume than 30-day window
  const bounds7 = resolveFuelPeriodBounds('7D', REFERENCE_TODAY_ISO);
  const rows7 = evaluateFleetFuelConsumption(
    INITIAL_FLEET,
    INITIAL_FUEL_LOGS,
    bounds7.startIso,
    bounds7.endIso,
    15
  );
  assert.ok(
    computeFuelConsumptionSummary(rows7).totalLitersConsumed <
      summary30.totalLitersConsumed
  );

  // Custom reversed date bounds auto-normalize cleanly
  const customBounds = resolveFuelPeriodBounds(
    'CUSTOM',
    REFERENCE_TODAY_ISO,
    '2026-10-20',
    '2026-10-10'
  );
  assert.equal(customBounds.startIso, '2026-10-10');
  assert.equal(customBounds.endIso, '2026-10-20');
  assert.equal(customBounds.dayCount, 11);
});

test('validateNewFuelLogInput enforces activity metric per machine unit and exports CSV', () => {
  // Road truck (eng-01, L_100KM) requires distanceKm > 0
  const invalidRoad = validateNewFuelLogInput(
    {
      enginId: 'eng-01',
      dateIso: 'bad-date',
      litersConsumed: 0,
      distanceKm: 0,
      engineHoursWorked: 5,
      refueledLiters: -10,
      stationOrNote: '',
    },
    INITIAL_FLEET
  );
  assert.ok(invalidRoad.dateIso);
  assert.ok(invalidRoad.litersConsumed);
  assert.ok(invalidRoad.activity);
  assert.ok(invalidRoad.refueledLiters);

  // Stationary generator (eng-08, L_HOUR) accepts distanceKm = 0 as long as engineHoursWorked > 0
  const validGen = validateNewFuelLogInput(
    {
      enginId: 'eng-08',
      dateIso: '2026-10-26',
      litersConsumed: 64,
      distanceKm: 0,
      engineHoursWorked: 4,
      refueledLiters: 100,
      stationOrNote: 'Appoint cuve Bouaké',
    },
    INITIAL_FLEET
  );
  assert.deepEqual(validGen, {});

  const bounds30 = resolveFuelPeriodBounds('30D', REFERENCE_TODAY_ISO);
  const rows30 = evaluateFleetFuelConsumption(
    INITIAL_FLEET,
    INITIAL_FUEL_LOGS,
    bounds30.startIso,
    bounds30.endIso
  );
  const csv = exportFuelConsumptionToCsv(rows30, bounds30.startIso, bounds30.endIso);
  assert.ok(csv.includes('Surconsommation_Estimee_L'));
  assert.ok(csv.includes('9104 GT 01'));
});

test('exportMaintenanceToCsv, exportAlertsToCsv, and JSON backup round-trip work deterministically', () => {
  const evaluatedMnt = evaluateMaintenanceLogs(INITIAL_MAINTENANCE_LOGS, INITIAL_FLEET);
  const mntCsv = exportMaintenanceToCsv(evaluatedMnt);
  assert.equal(mntCsv.split('\n').length, INITIAL_MAINTENANCE_LOGS.length + 1);
  assert.ok(mntCsv.includes('Horametre_Actuel_h'));
  assert.ok(mntCsv.includes('CAT-CI-320-09'));

  const alertsCsv = exportAlertsToCsv(INITIAL_ALERTS);
  assert.equal(alertsCsv.split('\n').length, INITIAL_ALERTS.length + 1);
  assert.ok(alertsCsv.includes('Siphonage carburant'));

  const backupJson = serializeFleetBackupJson({
    exportedAtIso: '2026-10-26T14:00:00Z',
    fleet: INITIAL_FLEET,
    geofences: INITIAL_GEOFENCES,
    alerts: INITIAL_ALERTS,
    maintenanceLogs: INITIAL_MAINTENANCE_LOGS,
    fuelLogs: INITIAL_FUEL_LOGS,
  });

  const parsedOk = parseFleetBackupJson(backupJson);
  assert.equal(parsedOk.ok, true);
  if (parsedOk.ok) {
    assert.equal(parsedOk.data.fleet.length, INITIAL_FLEET.length);
    assert.equal(parsedOk.data.fuelLogs.length, INITIAL_FUEL_LOGS.length);
  }

  const parsedBad = parseFleetBackupJson('{"application":"Other"}');
  assert.equal(parsedBad.ok, false);

  const parsedMalformed = parseFleetBackupJson('not-json');
  assert.equal(parsedMalformed.ok, false);
});


