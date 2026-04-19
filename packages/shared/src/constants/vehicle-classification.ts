/** Grupos da espécie (finalidade) — alinhado a referências tipo GOV.BR / DENATRAN. */
export type VehicleSpeciesGroupKey =
  | "passenger"
  | "cargo"
  | "mixed"
  | "special"
  | "competition";

export const VEHICLE_SPECIES: ReadonlyArray<{
  value: string;
  group: VehicleSpeciesGroupKey;
}> = [
  { value: "PASSENGER_MOTONETA", group: "passenger" },
  { value: "PASSENGER_MOTORCYCLE", group: "passenger" },
  { value: "PASSENGER_TRICYCLE", group: "passenger" },
  { value: "PASSENGER_QUADRICYCLE", group: "passenger" },
  { value: "PASSENGER_AUTOMOBILE", group: "passenger" },
  { value: "PASSENGER_UTILITY", group: "passenger" },
  { value: "PASSENGER_MICROBUS", group: "passenger" },
  { value: "PASSENGER_BUS", group: "passenger" },
  { value: "CARGO_PICKUP", group: "cargo" },
  { value: "CARGO_TRUCK", group: "cargo" },
  { value: "MIXED_PICKUP", group: "mixed" },
  { value: "SPECIAL_AMBULANCE", group: "special" },
  { value: "SPECIAL_FIRE", group: "special" },
  { value: "SPECIAL_FUNERAL", group: "special" },
  { value: "SPECIAL_MOTORHOME", group: "special" },
  { value: "SPECIAL_TOW", group: "special" },
  { value: "SPECIAL_COLLECTION", group: "special" },
  { value: "COMPETITION_RACING", group: "competition" },
] as const;

/** Tipos de carroceria (carros de passeio e derivados). */
export const VEHICLE_BODY_TYPES = [
  "BODY_HATCH",
  "BODY_SEDAN",
  "BODY_SUV",
  "BODY_PICKUP",
  "BODY_MINIVAN",
  "BODY_STATION_WAGON",
  "BODY_COUPE",
] as const;

/** Tração / forma de propulsão. */
export const VEHICLE_TRACTIONS = [
  "TRACTION_AUTOMOTOR",
  "TRACTION_ELECTRIC",
  "TRACTION_HUMAN",
  "TRACTION_ANIMAL",
  "TRACTION_TRAILER",
] as const;

/** Categoria de uso (particular, aluguel, etc.). */
export const VEHICLE_USE_CATEGORIES = [
  "USE_PRIVATE",
  "USE_RENTAL",
  "USE_OFFICIAL",
  "USE_LEARNING",
] as const;

export const VEHICLE_SPECIES_VALUES: string[] = VEHICLE_SPECIES.map((s) => s.value);

export const VEHICLE_BODY_TYPE_VALUES: string[] = [...VEHICLE_BODY_TYPES];

export const VEHICLE_TRACTION_VALUES: string[] = [...VEHICLE_TRACTIONS];

export const VEHICLE_USE_CATEGORY_VALUES: string[] = [...VEHICLE_USE_CATEGORIES];

export function isVehicleSpeciesValue(v: string): boolean {
  return VEHICLE_SPECIES_VALUES.includes(v);
}

export function isVehicleBodyTypeValue(v: string): boolean {
  return VEHICLE_BODY_TYPE_VALUES.includes(v);
}

export function isVehicleTractionValue(v: string): boolean {
  return VEHICLE_TRACTION_VALUES.includes(v);
}

export function isVehicleUseCategoryValue(v: string): boolean {
  return VEHICLE_USE_CATEGORY_VALUES.includes(v);
}
