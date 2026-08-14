// Distance caps enforced client-side, before any Mapbox Directions call is
// made — protects API cost from an unbounded route (e.g. two points at
// opposite ends of the Philippines). The total cap is a safety rail that
// applies to every user; the per-leg cap is what a paid tier lifts.
export const ROUTE_LIMITS = {
  totalKm: 500,
  legKm: {
    free: 5,
    paid: 50,
  },
  maxSavedRoutesFree: 5,
  maxActiveGroupRunsFree: 1,
  maxRsvpsFree: 10,
} as const;
