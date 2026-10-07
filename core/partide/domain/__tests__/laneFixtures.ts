// Test helper: fish helpers/geo.ts#destinationPoint (spherical), for placing casts by bearing.
const R = 6_371_000;
const toRad = (d: number) => (d * Math.PI) / 180;

export function destinationOf(origin: { lat: number; lng: number }, bearing: number, distanceM: number) {
  const δ = distanceM / R;
  const θ = toRad(bearing);
  const φ1 = toRad(origin.lat);
  const λ1 = toRad(origin.lng);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: (φ2 * 180) / Math.PI, lng: (λ2 * 180) / Math.PI };
}
