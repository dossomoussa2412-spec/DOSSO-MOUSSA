import React from 'react';
import {
  AlertTriangle,
  Bike,
  Car,
  HardHat,
  Lock,
  Navigation,
  PauseCircle,
  Power,
  Tractor,
  Truck,
} from 'lucide-react';
import { EnginCategory, EnginStatus } from '../types/fleet';

export function CategoryIcon({
  category,
  className = 'w-4 h-4',
}: {
  category: EnginCategory;
  className?: string;
}) {
  switch (category) {
    case EnginCategory.POIDS_LOURDS:
      return <Truck className={className} aria-hidden="true" />;
    case EnginCategory.BTP_MINES:
      return <HardHat className={className} aria-hidden="true" />;
    case EnginCategory.AGRICOLE:
      return <Tractor className={className} aria-hidden="true" />;
    case EnginCategory.LEGER_UTILITAIRE:
      return <Car className={className} aria-hidden="true" />;
    case EnginCategory.MOTO_TRICYCLE:
      return <Bike className={className} aria-hidden="true" />;
    case EnginCategory.GROUPE_REMORQUE:
      return <Power className={className} aria-hidden="true" />;
  }
}

export function StatusIndicator({ status }: { status: EnginStatus }) {
  switch (status) {
    case EnginStatus.EN_MOUVEMENT:
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 whitespace-nowrap">
          <Navigation className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          En mouvement
        </span>
      );
    case EnginStatus.RALENTI_CHANTIER:
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 whitespace-nowrap">
          <HardHat className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          En travail
        </span>
      );
    case EnginStatus.STATIONNE:
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 whitespace-nowrap">
          <PauseCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Stationné
        </span>
      );
    case EnginStatus.COUPE_CIRCUIT:
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 whitespace-nowrap">
          <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Moteur coupé
        </span>
      );
    case EnginStatus.ALERTE:
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          Alerte active
        </span>
      );
  }
}
