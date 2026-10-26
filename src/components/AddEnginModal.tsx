import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  Engin,
  EnginCategory,
  GroundedHub,
  NewEnginInput,
  SimOperator,
  ValidationErrors,
} from '../types/fleet';
import { CATEGORY_LABELS, validateNewEnginInput } from '../utils/telemetry';

interface AddEnginModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingFleet: Engin[];
  hubs: GroundedHub[];
  onAddEngin: (input: NewEnginInput) => void;
}

export function AddEnginModal({
  isOpen,
  onClose,
  existingFleet,
  hubs,
  onAddEngin,
}: AddEnginModalProps) {
  const [name, setName] = useState('');
  const [plateOrSerial, setPlateOrSerial] = useState('');
  const [category, setCategory] = useState<EnginCategory>(EnginCategory.POIDS_LOURDS);
  const [imei, setImei] = useState('');
  const [trackerModel, setTrackerModel] = useState('Teltonika FMB920 + Coupe-circuit');
  const [simOperator, setSimOperator] = useState<SimOperator>(SimOperator.ORANGE_CI);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [hubId, setHubId] = useState(hubs[0]?.id ?? 'hub-paa');
  const [fuelCapacityLiters, setFuelCapacityLiters] = useState<string>('300');
  const [errors, setErrors] = useState<ValidationErrors>({});

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedFuel = Number(fuelCapacityLiters);
    const candidate: NewEnginInput = {
      name,
      plateOrSerial,
      category,
      imei: imei.replace(/\s+/g, ''),
      trackerModel: trackerModel.trim() || 'Teltonika FMB920',
      simOperator,
      driverName,
      driverPhone,
      hubId,
      fuelCapacityLiters: parsedFuel,
    };

    const validationErrors = validateNewEnginInput(candidate, existingFleet);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    onAddEngin(candidate);
    setName('');
    setPlateOrSerial('');
    setImei('');
    setDriverName('');
    setDriverPhone('');
    setFuelCapacityLiters('300');
    setErrors({});
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-engin-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="add-engin-dialog-title" className="text-base font-bold text-slate-900">
              Enregistrer un nouvel engin GPS
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Association d’un boîtier GSM/GPS pour suivi en Côte d’Ivoire
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre d'enregistrement"
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="engin-name-input"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Désignation de l’engin *
              </label>
              <input
                id="engin-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Chargeuse Caterpillar 950 GC ou Camion Benne Actros"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
              {errors.name && <p className="mt-1 text-xs text-red-700">{errors.name}</p>}
            </div>

            <div>
              <label
                htmlFor="engin-category-select"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Catégorie d’engin *
              </label>
              <select
                id="engin-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as EnginCategory)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-600"
              >
                {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="engin-plate-input"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Immatriculation CI / N° Série *
              </label>
              <input
                id="engin-plate-input"
                type="text"
                value={plateOrSerial}
                onChange={(e) => setPlateOrSerial(e.target.value)}
                placeholder="Ex: 7412 KP 01 ou CAT-BKE-14"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
              {errors.plateOrSerial && (
                <p className="mt-1 text-xs text-red-700">{errors.plateOrSerial}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="engin-imei-input"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                N° IMEI du boîtier GPS (15 chiffres) *
              </label>
              <input
                id="engin-imei-input"
                type="text"
                inputMode="numeric"
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                placeholder="864259050000123"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
              {errors.imei && <p className="mt-1 text-xs text-red-700">{errors.imei}</p>}
            </div>

            <div>
              <label
                htmlFor="engin-sim-select"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Opérateur carte SIM M2M *
              </label>
              <select
                id="engin-sim-select"
                value={simOperator}
                onChange={(e) => setSimOperator(e.target.value as SimOperator)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-600"
              >
                <option value={SimOperator.ORANGE_CI}>Orange CI</option>
                <option value={SimOperator.MTN_CI}>MTN CI</option>
                <option value={SimOperator.MOOV_AFRICA}>Moov Africa</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="engin-hub-select"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Base ou chantier de rattachement *
              </label>
              <select
                id="engin-hub-select"
                value={hubId}
                onChange={(e) => setHubId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-600"
              >
                {hubs.map((hub) => (
                  <option key={hub.id} value={hub.id}>
                    {hub.name} ({hub.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="engin-fuel-input"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Capacité réservoir (Litres) *
              </label>
              <input
                id="engin-fuel-input"
                type="number"
                min={5}
                max={5000}
                value={fuelCapacityLiters}
                onChange={(e) => setFuelCapacityLiters(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
              {errors.fuelCapacityLiters && (
                <p className="mt-1 text-xs text-red-700">{errors.fuelCapacityLiters}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="engin-driver-input"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Chauffeur / Opérateur attitré *
              </label>
              <input
                id="engin-driver-input"
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Ex: Touré Ibrahim"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
              {errors.driverName && (
                <p className="mt-1 text-xs text-red-700">{errors.driverName}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="engin-phone-input"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Téléphone Côte d’Ivoire (10 chiffres) *
              </label>
              <input
                id="engin-phone-input"
                type="tel"
                value={driverPhone}
                onChange={(e) => setDriverPhone(e.target.value)}
                placeholder="+225 07 48 12 90 33"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
              {errors.driverPhone && (
                <p className="mt-1 text-xs text-red-700">{errors.driverPhone}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="engin-tracker-input"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Modèle de balise & accessoires
              </label>
              <input
                id="engin-tracker-input"
                type="text"
                value={trackerModel}
                onChange={(e) => setTrackerModel(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm font-semibold cursor-pointer whitespace-nowrap"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="py-2 px-4 rounded-lg bg-orange-700 hover:bg-orange-800 text-white text-sm font-semibold cursor-pointer whitespace-nowrap"
            >
              Enregistrer l’engin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
