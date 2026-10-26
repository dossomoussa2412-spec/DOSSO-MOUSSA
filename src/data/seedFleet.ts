import {
  AlertSeverity,
  AlertType,
  Engin,
  EnginCategory,
  EnginStatus,
  FleetAlert,
  FuelDailyLog,
  GeofenceZone,
  GroundedHub,
  MaintenanceRecord,
  MaintenanceServiceType,
  SimOperator,
} from '../types/fleet';

// Coordinates, Place IDs, and formatted addresses retrieved directly via Google Maps Places API (New)
export const GROUNDED_CI_HUBS: GroundedHub[] = [
  {
    id: 'hub-paa',
    placeId: 'ChIJq6qqZdHrwQ8R5qQ5xiZy6b4',
    name: "Port Autonome d'Abidjan",
    city: 'Abidjan (Treichville / Vridi)',
    formattedAddress: "Direction générale du port autonome d'abidjan, Bd du Port, Abidjan",
    location: { lat: 5.2795558, lng: -3.9737778 },
  },
  {
    id: 'hub-yopougon',
    placeId: 'ChIJOzqsFSS_wQ8R9yM8H7QHzF8',
    name: 'Yopougon Zone Industrielle',
    city: 'Abidjan (Yopougon)',
    formattedAddress: 'Yopougon zone industrielle, Abidjan',
    location: { lat: 5.3252258, lng: -4.019603 },
  },
  {
    id: 'hub-plateau',
    placeId: 'ChIJU2U2MaHrwQ8R6sY0U-hHZ7s',
    name: 'Le Plateau — Centre Affaires',
    city: 'Abidjan (Le Plateau)',
    formattedAddress: 'Le Plateau, Abidjan',
    location: { lat: 5.3325471, lng: -4.023869 },
  },
  {
    id: 'hub-sanpedro',
    placeId: 'ChIJvTuvngUTlg8RSGG-73p9mCk',
    name: 'Port Autonome de San-Pédro (PASP)',
    city: 'San-Pédro',
    formattedAddress: 'P9RH+VMQ, Boulevard de la République, San-Pédro',
    location: { lat: 4.7422112, lng: -6.6207717 },
  },
  {
    id: 'hub-yamoussoukro',
    placeId: 'ChIJ90XJQTqRuA8R3u4jFhofcCE',
    name: 'Base Logistique Yamoussoukro',
    city: 'Yamoussoukro',
    formattedAddress: 'Yamoussoukro',
    location: { lat: 6.8162741, lng: -5.2743629 },
  },
  {
    id: 'hub-bouake',
    placeId: 'ChIJezOhRxD_xw8R6w9BHhGA9G0',
    name: 'Corridor Nord — Dépôt Bouaké',
    city: 'Bouaké',
    formattedAddress: 'Bouaké',
    location: { lat: 7.690466, lng: -5.0390536 },
  },
  {
    id: 'hub-daloa',
    placeId: 'ChIJtQZqT4HXuw8RrYvEPz6uFsg',
    name: 'Coopérative Agricole Daloa',
    city: 'Daloa',
    formattedAddress: 'Daloa',
    location: { lat: 6.8883341, lng: -6.4396888 },
  },
  {
    id: 'hub-korhogo',
    placeId: 'ChIJm1JSPHnJtQ8Rn_bfCeLalrs',
    name: 'Site Minier & Cotonnier Korhogo',
    city: 'Korhogo',
    formattedAddress: 'Korhogo',
    location: { lat: 9.4669337, lng: -5.6142558 },
  },
];

export const INITIAL_FLEET: Engin[] = [
  {
    id: 'eng-01',
    name: 'Tracteur Routier Sinotruk Howo 371',
    plateOrSerial: '4821 KP 01',
    category: EnginCategory.POIDS_LOURDS,
    status: EnginStatus.EN_MOUVEMENT,
    imei: '864259051284910',
    trackerModel: 'Teltonika FMB920 + Sonde LLS',
    simOperator: SimOperator.ORANGE_CI,
    gsmSignalPercent: 94,
    driverName: 'Kouassi Yao Serge',
    driverPhone: '+225 07 48 12 90 33',
    hubId: 'hub-paa',
    locationLabel: "Port Autonome d'Abidjan, Bd du Port",
    position: { lat: 5.2795558, lng: -3.9737778 },
    heading: 318,
    speedKmh: 58,
    ignitionOn: true,
    immobilizerActive: false,
    fuelLevelPercent: 78,
    fuelCapacityLiters: 600,
    engineHours: 4820.5,
    odometerKm: 184320,
    externalVoltage: 27.8,
    nextMaintenanceHours: 5000,
    lastUpdateIso: '2026-10-26T12:34:10Z',
    trail: [
      { lat: 5.2738, lng: -3.9682 },
      { lat: 5.2764, lng: -3.9711 },
      { lat: 5.2795558, lng: -3.9737778 },
    ],
  },
  {
    id: 'eng-02',
    name: 'Pelle Hydraulique Caterpillar 320 GC',
    plateOrSerial: 'CAT-CI-320-09',
    category: EnginCategory.BTP_MINES,
    status: EnginStatus.RALENTI_CHANTIER,
    imei: '864259057731042',
    trackerModel: 'Teltonika FMC130 CAN-Bus',
    simOperator: SimOperator.MTN_CI,
    gsmSignalPercent: 86,
    driverName: 'Koné Bakary',
    driverPhone: '+225 05 55 81 04 29',
    hubId: 'hub-yamoussoukro',
    locationLabel: 'Chantier Voirie Yamoussoukro',
    position: { lat: 6.8162741, lng: -5.2743629 },
    heading: 90,
    speedKmh: 4,
    ignitionOn: true,
    immobilizerActive: false,
    fuelLevelPercent: 62,
    fuelCapacityLiters: 410,
    engineHours: 3194.2,
    odometerKm: 4120,
    externalVoltage: 28.1,
    nextMaintenanceHours: 3250,
    lastUpdateIso: '2026-10-26T12:35:02Z',
    trail: [
      { lat: 6.8155, lng: -5.2752 },
      { lat: 6.8159, lng: -5.2748 },
      { lat: 6.8162741, lng: -5.2743629 },
    ],
  },
  {
    id: 'eng-03',
    name: 'Grumier Mercedes-Benz Actros 3344',
    plateOrSerial: '9104 GT 01',
    category: EnginCategory.POIDS_LOURDS,
    status: EnginStatus.ALERTE,
    imei: '864259059918273',
    trackerModel: 'Ruptela Pro5 + Capteur Bouchon',
    simOperator: SimOperator.ORANGE_CI,
    gsmSignalPercent: 88,
    driverName: 'Bamba Souleymane',
    driverPhone: '+225 07 09 64 31 18',
    hubId: 'hub-sanpedro',
    locationLabel: 'Port Autonome de San-Pédro (PASP)',
    position: { lat: 4.7422112, lng: -6.6207717 },
    heading: 185,
    speedKmh: 0,
    ignitionOn: false,
    immobilizerActive: false,
    fuelLevelPercent: 24,
    fuelCapacityLiters: 550,
    engineHours: 6412.8,
    odometerKm: 249810,
    externalVoltage: 24.3,
    nextMaintenanceHours: 6500,
    lastUpdateIso: '2026-10-26T12:33:48Z',
    trail: [
      { lat: 4.7485, lng: -6.6231 },
      { lat: 4.7451, lng: -6.6219 },
      { lat: 4.7422112, lng: -6.6207717 },
    ],
  },
  {
    id: 'eng-04',
    name: 'Tracteur Agricole John Deere 5075E',
    plateOrSerial: 'AGRI-DL-218',
    category: EnginCategory.AGRICOLE,
    status: EnginStatus.EN_MOUVEMENT,
    imei: '864259053301948',
    trackerModel: 'Coban TK303G Étanche IP67',
    simOperator: SimOperator.MOOV_AFRICA,
    gsmSignalPercent: 79,
    driverName: 'Zadi Gnahoré Éric',
    driverPhone: '+225 01 41 28 77 50',
    hubId: 'hub-daloa',
    locationLabel: 'Périmètre Cacaoyer Daloa',
    position: { lat: 6.8883341, lng: -6.4396888 },
    heading: 45,
    speedKmh: 19,
    ignitionOn: true,
    immobilizerActive: false,
    fuelLevelPercent: 81,
    fuelCapacityLiters: 110,
    engineHours: 1480.0,
    odometerKm: 19450,
    externalVoltage: 13.9,
    nextMaintenanceHours: 1500,
    lastUpdateIso: '2026-10-26T12:34:55Z',
    trail: [
      { lat: 6.8851, lng: -6.4422 },
      { lat: 6.8868, lng: -6.4409 },
      { lat: 6.8883341, lng: -6.4396888 },
    ],
  },
  {
    id: 'eng-05',
    name: 'Chargeuse sur Pneus Komatsu WA380',
    plateOrSerial: 'KOM-KRH-88',
    category: EnginCategory.BTP_MINES,
    status: EnginStatus.RALENTI_CHANTIER,
    imei: '864259054410293',
    trackerModel: 'Teltonika FMC650 Satellite/GSM',
    simOperator: SimOperator.ORANGE_CI,
    gsmSignalPercent: 82,
    driverName: 'Coulibaly Adama',
    driverPhone: '+225 07 77 32 10 94',
    hubId: 'hub-korhogo',
    locationLabel: 'Carrière & Site Minier Korhogo',
    position: { lat: 9.4669337, lng: -5.6142558 },
    heading: 120,
    speedKmh: 9,
    ignitionOn: true,
    immobilizerActive: false,
    fuelLevelPercent: 54,
    fuelCapacityLiters: 380,
    engineHours: 5112.4,
    odometerKm: 11290,
    externalVoltage: 28.0,
    nextMaintenanceHours: 5250,
    lastUpdateIso: '2026-10-26T12:34:30Z',
    trail: [
      { lat: 9.4651, lng: -5.6162 },
      { lat: 9.4661, lng: -5.6151 },
      { lat: 9.4669337, lng: -5.6142558 },
    ],
  },
  {
    id: 'eng-06',
    name: 'Pick-up Toyota Hilux 4x4 Double Cabine',
    plateOrSerial: '2290 LX 01',
    category: EnginCategory.LEGER_UTILITAIRE,
    status: EnginStatus.EN_MOUVEMENT,
    imei: '864259056192837',
    trackerModel: 'Concox GT06N Coupe-Circuit',
    simOperator: SimOperator.MTN_CI,
    gsmSignalPercent: 98,
    driverName: 'N’Guessan Ahou Martine',
    driverPhone: '+225 05 04 99 18 22',
    hubId: 'hub-plateau',
    locationLabel: 'Le Plateau, Abidjan',
    position: { lat: 5.3325471, lng: -4.023869 },
    heading: 15,
    speedKmh: 46,
    ignitionOn: true,
    immobilizerActive: false,
    fuelLevelPercent: 69,
    fuelCapacityLiters: 80,
    engineHours: 920.6,
    odometerKm: 54210,
    externalVoltage: 14.1,
    nextMaintenanceHours: 1000,
    lastUpdateIso: '2026-10-26T12:35:12Z',
    trail: [
      { lat: 5.3279, lng: -4.0258 },
      { lat: 5.3301, lng: -4.0247 },
      { lat: 5.3325471, lng: -4.023869 },
    ],
  },
  {
    id: 'eng-07',
    name: 'Tricycle Cargo Apsonic 250cc Livraison',
    plateOrSerial: 'WW 6319 CI',
    category: EnginCategory.MOTO_TRICYCLE,
    status: EnginStatus.EN_MOUVEMENT,
    imei: '864259058827164',
    trackerModel: 'Wanway S20 Mini Relais 12V',
    simOperator: SimOperator.MOOV_AFRICA,
    gsmSignalPercent: 91,
    driverName: 'Diallo Mamadou',
    driverPhone: '+225 01 52 63 84 11',
    hubId: 'hub-yopougon',
    locationLabel: 'Yopougon Zone Industrielle, Abidjan',
    position: { lat: 5.3252258, lng: -4.019603 },
    heading: 265,
    speedKmh: 34,
    ignitionOn: true,
    immobilizerActive: false,
    fuelLevelPercent: 48,
    fuelCapacityLiters: 18,
    engineHours: 615.3,
    odometerKm: 18740,
    externalVoltage: 13.4,
    nextMaintenanceHours: 700,
    lastUpdateIso: '2026-10-26T12:35:08Z',
    trail: [
      { lat: 5.3264, lng: -4.0161 },
      { lat: 5.3258, lng: -4.0179 },
      { lat: 5.3252258, lng: -4.019603 },
    ],
  },
  {
    id: 'eng-08',
    name: 'Groupe Électrogène Caterpillar DE110E2 (110 kVA)',
    plateOrSerial: 'GEN-BKE-110K',
    category: EnginCategory.GROUPE_REMORQUE,
    status: EnginStatus.STATIONNE,
    imei: '864259050049182',
    trackerModel: 'Teltonika FMB140 + Sonde Niveau Cuve',
    simOperator: SimOperator.ORANGE_CI,
    gsmSignalPercent: 89,
    driverName: 'Poste Garde Dépôt Bouaké',
    driverPhone: '+225 07 88 45 12 00',
    hubId: 'hub-bouake',
    locationLabel: 'Dépôt Logistique Bouaké',
    position: { lat: 7.690466, lng: -5.0390536 },
    heading: 0,
    speedKmh: 0,
    ignitionOn: false,
    immobilizerActive: false,
    fuelLevelPercent: 85,
    fuelCapacityLiters: 250,
    engineHours: 2340.0,
    odometerKm: 0,
    externalVoltage: 12.8,
    nextMaintenanceHours: 2500,
    lastUpdateIso: '2026-10-26T12:34:00Z',
    trail: [{ lat: 7.690466, lng: -5.0390536 }],
  },
];

export const INITIAL_GEOFENCES: GeofenceZone[] = [
  {
    id: 'geo-paa',
    name: "Périmètre Portuaire d'Abidjan",
    hubId: 'hub-paa',
    city: 'Abidjan',
    center: { lat: 5.2795558, lng: -3.9737778 },
    radiusMeters: 3500,
    alertOnExit: true,
    alertOnEntry: false,
    speedLimitKmh: 60,
    active: true,
  },
  {
    id: 'geo-yop',
    name: 'Zone Industrielle Yopougon',
    hubId: 'hub-yopougon',
    city: 'Abidjan',
    center: { lat: 5.3252258, lng: -4.019603 },
    radiusMeters: 2800,
    alertOnExit: true,
    alertOnEntry: true,
    speedLimitKmh: 50,
    active: true,
  },
  {
    id: 'geo-sanpedro',
    name: 'Terminal Grumier Port de San-Pédro',
    hubId: 'hub-sanpedro',
    city: 'San-Pédro',
    center: { lat: 4.7422112, lng: -6.6207717 },
    radiusMeters: 3000,
    alertOnExit: true,
    alertOnEntry: false,
    speedLimitKmh: 45,
    active: true,
  },
  {
    id: 'geo-korhogo',
    name: 'Concession Minière & Engins Korhogo',
    hubId: 'hub-korhogo',
    city: 'Korhogo',
    center: { lat: 9.4669337, lng: -5.6142558 },
    radiusMeters: 4500,
    alertOnExit: true,
    alertOnEntry: false,
    speedLimitKmh: 40,
    active: true,
  },
];

export const INITIAL_ALERTS: FleetAlert[] = [
  {
    id: 'alt-01',
    enginId: 'eng-03',
    enginName: 'Grumier Mercedes-Benz Actros 3344',
    plateOrSerial: '9104 GT 01',
    type: AlertType.SIPHONAGE_CARBURANT,
    severity: AlertSeverity.CRITIQUE,
    title: 'Chute brutale de carburant détectée (-42 L en 6 min)',
    description:
      'Sonde capacitive cuve principale : baisse anormale moteur coupé au stationnement Terminal San-Pédro.',
    locationLabel: 'Port Autonome de San-Pédro (PASP)',
    timestampIso: '2026-10-26T12:18:00Z',
    acknowledged: false,
  },
  {
    id: 'alt-02',
    enginId: 'eng-01',
    enginName: 'Tracteur Routier Sinotruk Howo 371',
    plateOrSerial: '4821 KP 01',
    type: AlertType.EXCES_VITESSE,
    severity: AlertSeverity.ATTENTION,
    title: 'Dépassement seuil vitesse poids lourd (86 km/h / seuil 80 km/h)',
    description: 'Enregistré pendant 90 secondes sur la voie express de Vridi avant décélération.',
    locationLabel: "Port Autonome d'Abidjan, Bd du Port",
    timestampIso: '2026-10-26T11:52:00Z',
    acknowledged: false,
  },
  {
    id: 'alt-03',
    enginId: 'eng-04',
    enginName: 'Tracteur Agricole John Deere 5075E',
    plateOrSerial: 'AGRI-DL-218',
    type: AlertType.BATTERIE_EXTERNE,
    severity: AlertSeverity.ATTENTION,
    title: 'Échéance maintenance horamètre proche (reste 20 h)',
    description: 'Révision hydraulique et filtres prévue à 1 500 h moteur sur la coopérative de Daloa.',
    locationLabel: 'Périmètre Cacaoyer Daloa',
    timestampIso: '2026-10-26T10:40:00Z',
    acknowledged: false,
  },
  {
    id: 'alt-04',
    enginId: 'eng-07',
    enginName: 'Tricycle Cargo Apsonic 250cc Livraison',
    plateOrSerial: 'WW 6319 CI',
    type: AlertType.SORTIE_ZONE,
    severity: AlertSeverity.INFO,
    title: 'Entrée confirmée dans Zone Industrielle Yopougon',
    description: 'Passage du périmètre logistique enregistré via SIM Moov Africa.',
    locationLabel: 'Yopougon Zone Industrielle, Abidjan',
    timestampIso: '2026-10-26T09:15:00Z',
    acknowledged: true,
  },
];

export const INITIAL_MAINTENANCE_LOGS: MaintenanceRecord[] = [
  {
    id: 'mnt-01',
    enginId: 'eng-03', // Grumier Actros currently at 6412.8 h -> OVERDUE (+12.8 h)
    serviceType: MaintenanceServiceType.FREINAGE_TRANSMISSION,
    title: 'Vidange pont arrière, filtration gasoil & contrôle freins grumier',
    workshopOrTechnician: 'Atelier Poids Lourds Port de San-Pédro',
    targetEngineHours: 6400,
    scheduledOrCompletedDateIso: '2026-10-24T08:00:00Z',
    costFcfa: 485000,
    notes: 'Intervention prioritaire suite usage intensif piste forestière San-Pédro.',
    completed: false,
  },
  {
    id: 'mnt-02',
    enginId: 'eng-02', // Pelle Cat 320 GC currently at 3194.2 h -> OVERDUE (+14.2 h)
    serviceType: MaintenanceServiceType.HYDRAULIQUE_FILTRES,
    title: 'Remplacement filtres hydrauliques haute pression & graissage flèche',
    workshopOrTechnician: 'Tractafric Equipment — Antenne Yamoussoukro',
    targetEngineHours: 3180,
    scheduledOrCompletedDateIso: '2026-10-25T09:30:00Z',
    costFcfa: 620000,
    notes: 'Kit de filtration Cat d’origine disponible au dépôt chantier.',
    completed: false,
  },
  {
    id: 'mnt-03',
    enginId: 'eng-04', // Tracteur John Deere currently at 1480.0 h -> PENDING (20.0 h left)
    serviceType: MaintenanceServiceType.REVISION_GENERALE,
    title: 'Révision périodique 1 500 h : huile moteur, prise de force & injecteurs',
    workshopOrTechnician: 'Coopérative Mécanique Agricole Daloa',
    targetEngineHours: 1500,
    scheduledOrCompletedDateIso: '2026-10-29T08:00:00Z',
    costFcfa: 245000,
    notes: 'Prévoir immobilisation d’une demi-journée avant campagne cacao.',
    completed: false,
  },
  {
    id: 'mnt-04',
    enginId: 'eng-01', // Tracteur Routier Sinotruk currently at 4820.5 h -> PENDING (179.5 h left)
    serviceType: MaintenanceServiceType.VIDANGE_MOTEUR,
    title: 'Entretien complet 5 000 h + étalonnage sonde carburant LLS',
    workshopOrTechnician: 'Centre Technique Vridi — Port d’Abidjan',
    targetEngineHours: 5000,
    scheduledOrCompletedDateIso: '2026-11-10T08:30:00Z',
    costFcfa: 390000,
    notes: 'Vérifier également le faisceau du relais coupe-circuit GPRS.',
    completed: false,
  },
  {
    id: 'mnt-05',
    enginId: 'eng-05', // Chargeuse Komatsu WA380 currently at 5112.4 h -> PENDING (137.6 h left)
    serviceType: MaintenanceServiceType.HYDRAULIQUE_FILTRES,
    title: 'Vidange convertisseur de couple & inspection godet carrière',
    workshopOrTechnician: 'BIA Côte d’Ivoire — Équipe Mobile Korhogo',
    targetEngineHours: 5250,
    scheduledOrCompletedDateIso: '2026-11-06T07:30:00Z',
    costFcfa: 740000,
    notes: 'Analyse d’huile programmée sur site minier.',
    completed: false,
  },
  {
    id: 'mnt-06',
    enginId: 'eng-06', // Pick-up Hilux currently at 920.6 h -> PENDING (79.4 h left)
    serviceType: MaintenanceServiceType.VIDANGE_MOTEUR,
    title: 'Vidange 1 000 h moteur 2.8D, filtre à air tropicalisé & plaquettes avant',
    workshopOrTechnician: 'CFAO Motors Abidjan — Boulevard de Marseille',
    targetEngineHours: 1000,
    scheduledOrCompletedDateIso: '2026-11-02T10:00:00Z',
    costFcfa: 165000,
    notes: 'Véhicule de liaison supervision Abidjan.',
    completed: false,
  },
  {
    id: 'mnt-07',
    enginId: 'eng-08', // Groupe Électrogène Cat currently at 2340.0 h -> PENDING (160.0 h left)
    serviceType: MaintenanceServiceType.SONDE_BALISE_GPS,
    title: 'Test en charge 2 500 h, remplacement préfiltre gasoil & batterie 12V',
    workshopOrTechnician: 'Électro-Diesel Bouaké',
    targetEngineHours: 2500,
    scheduledOrCompletedDateIso: '2026-11-15T09:00:00Z',
    costFcfa: 210000,
    notes: 'Contrôle sonde niveau cuve 250 L inclus.',
    completed: false,
  },
  {
    id: 'mnt-08',
    enginId: 'eng-01',
    serviceType: MaintenanceServiceType.VIDANGE_MOTEUR,
    title: 'Vidange moteur 15W40 & remplacement filtres air/huile (4 500 h)',
    workshopOrTechnician: 'Centre Technique Vridi — Port d’Abidjan',
    targetEngineHours: 4500,
    completedAtEngineHours: 4496.5,
    scheduledOrCompletedDateIso: '2026-09-18T15:20:00Z',
    costFcfa: 310000,
    notes: 'RAS. Pression d’huile nominale et balise Teltonika FMB920 vérifiée.',
    completed: true,
  },
  {
    id: 'mnt-09',
    enginId: 'eng-02',
    serviceType: MaintenanceServiceType.REVISION_GENERALE,
    title: 'Révision 3 000 h : train de chaînes, galets & vidange réducteurs',
    workshopOrTechnician: 'Tractafric Equipment Marcory, Abidjan',
    targetEngineHours: 3000,
    completedAtEngineHours: 3002.0,
    scheduledOrCompletedDateIso: '2026-09-29T17:00:00Z',
    costFcfa: 890000,
    notes: 'Tension chenilles ajustée avant transfert chantier Yamoussoukro.',
    completed: true,
  },
  {
    id: 'mnt-10',
    enginId: 'eng-07', // Tricycle Apsonic currently at 615.3 h
    serviceType: MaintenanceServiceType.FREINAGE_TRANSMISSION,
    title: 'Vidange boîte/pont tricycle 600 h & réglage mâchoires arrière',
    workshopOrTechnician: 'Atelier Apsonic Yopougon Industrielle',
    targetEngineHours: 600,
    completedAtEngineHours: 598.4,
    scheduledOrCompletedDateIso: '2026-10-14T11:45:00Z',
    costFcfa: 38000,
    notes: 'Batterie auxiliaire balise Wanway S20 testée à 100%.',
    completed: true,
  },
];

export const REFERENCE_TODAY_ISO = '2026-10-26';

interface SeedFuelProfile {
  enginId: string;
  baseDistanceKm: number;
  baseHours: number;
  baseLiters: number;
  recent7dMultiplier: number;
  restEveryNDays: number;
  refuelEveryNDays: number;
  refuelStation: string;
}

const SEED_FUEL_PROFILES: SeedFuelProfile[] = [
  {
    // Nominal 38.0 L/100km -> ~37.5 L/100km (CONFORME)
    enginId: 'eng-01',
    baseDistanceKm: 240,
    baseHours: 6.4,
    baseLiters: 90.0,
    recent7dMultiplier: 1.01,
    restEveryNDays: 7,
    refuelEveryNDays: 5,
    refuelStation: 'TotalEnergies Vridi Port Abidjan',
  },
  {
    // Nominal 18.5 L/h -> ~22.3 L/h (+20.5% SURCONSOMMATION: ralenti prolongé & filtre hydraulique)
    enginId: 'eng-02',
    baseDistanceKm: 11,
    baseHours: 7.4,
    baseLiters: 163.5,
    recent7dMultiplier: 1.04,
    restEveryNDays: 6,
    refuelEveryNDays: 2,
    refuelStation: 'Cuve Mobile Chantier Yamoussoukro',
  },
  {
    // Nominal 42.0 L/100km -> ~52.8 L/100km (+25.7% SURCONSOMMATION: piste forestière + chute cuve San-Pédro)
    enginId: 'eng-03',
    baseDistanceKm: 185,
    baseHours: 6.3,
    baseLiters: 96.2,
    recent7dMultiplier: 1.08,
    restEveryNDays: 7,
    refuelEveryNDays: 4,
    refuelStation: 'Shell Vivo Terminal Grumier San-Pédro',
  },
  {
    // Nominal 7.5 L/h -> ~7.3 L/h (CONFORME)
    enginId: 'eng-04',
    baseDistanceKm: 34,
    baseHours: 5.6,
    baseLiters: 40.9,
    recent7dMultiplier: 0.99,
    restEveryNDays: 5,
    refuelEveryNDays: 3,
    refuelStation: 'Dépôt Coopérative Agricole Daloa',
  },
  {
    // Nominal 21.0 L/h -> ~23.5 L/h (+11.9% VIGILANCE à +15%, SURCONSOMMATION à +10%)
    enginId: 'eng-05',
    baseDistanceKm: 16,
    baseHours: 6.8,
    baseLiters: 159.8,
    recent7dMultiplier: 1.02,
    restEveryNDays: 6,
    refuelEveryNDays: 2,
    refuelStation: 'Soute Gasoil Carrière Korhogo',
  },
  {
    // Nominal 9.5 L/100km -> ~9.3 L/100km (CONFORME)
    enginId: 'eng-06',
    baseDistanceKm: 118,
    baseHours: 3.9,
    baseLiters: 11.0,
    recent7dMultiplier: 1.0,
    restEveryNDays: 7,
    refuelEveryNDays: 6,
    refuelStation: 'Petro Ivoire Le Plateau Abidjan',
  },
  {
    // Nominal 4.8 L/100km -> ~5.35 L/100km (+11.5% VIGILANCE: embouteillages livraison Yopougon)
    enginId: 'eng-07',
    baseDistanceKm: 68,
    baseHours: 4.3,
    baseLiters: 3.64,
    recent7dMultiplier: 1.02,
    restEveryNDays: 7,
    refuelEveryNDays: 4,
    refuelStation: 'TotalEnergies Yopougon Zone Industrielle',
  },
  {
    // Nominal 16.0 L/h -> ~15.7 L/h (CONFORME, 0 km car groupe électrogène fixe)
    enginId: 'eng-08',
    baseDistanceKm: 0,
    baseHours: 4.2,
    baseLiters: 65.9,
    recent7dMultiplier: 0.98,
    restEveryNDays: 3,
    refuelEveryNDays: 4,
    refuelStation: 'Livraison Citerne Dépôt Bouaké',
  },
];

function buildDeterministicFuelLogs(): FuelDailyLog[] {
  const logs: FuelDailyLog[] = [];
  const endMs = Date.parse(`${REFERENCE_TODAY_ISO}T00:00:00Z`);
  const dayMs = 24 * 60 * 60 * 1000;

  for (let daysAgo = 89; daysAgo >= 0; daysAgo -= 1) {
    const dateIso = new Date(endMs - daysAgo * dayMs).toISOString().slice(0, 10);

    SEED_FUEL_PROFILES.forEach((profile, pIdx) => {
      // Deterministic rest day pattern per machine
      if ((daysAgo + pIdx * 2) % profile.restEveryNDays === 0 && daysAgo !== 0) {
        return;
      }

      const wave = 1 + (((daysAgo * 7 + pIdx * 3) % 9) - 4) * 0.022;
      const recentFactor = daysAgo < 7 ? profile.recent7dMultiplier : 1;

      const distanceKm =
        profile.baseDistanceKm > 0
          ? Number((profile.baseDistanceKm * wave).toFixed(1))
          : 0;
      const engineHoursWorked = Number((profile.baseHours * wave).toFixed(1));
      let litersConsumed = Number(
        (profile.baseLiters * wave * recentFactor).toFixed(1)
      );

      // Explicit siphonage spike on Grumier Actros (eng-03) on reference day 2026-10-26 (+42 L)
      let stationOrNote: string | undefined;
      if (profile.enginId === 'eng-03' && daysAgo === 0) {
        litersConsumed = Number((litersConsumed + 42).toFixed(1));
        stationOrNote = 'Anomalie sonde LLS (-42 L à l’arrêt) + roulage grumier';
      }

      const isRefuelDay = (daysAgo + pIdx) % profile.refuelEveryNDays === 0;
      const refueledLiters = isRefuelDay
        ? Math.round(litersConsumed * (profile.refuelEveryNDays * 0.82))
        : 0;

      if (isRefuelDay && !stationOrNote) {
        stationOrNote = `Plein enregistré — ${profile.refuelStation}`;
      }

      logs.push({
        id: `flog-${profile.enginId}-${dateIso}`,
        enginId: profile.enginId,
        dateIso,
        litersConsumed,
        distanceKm,
        engineHoursWorked,
        refueledLiters,
        stationOrNote,
      });
    });
  }

  return logs;
}

export const INITIAL_FUEL_LOGS: FuelDailyLog[] = buildDeterministicFuelLogs();

