/**
 * Computes available facet values for each filter dimension.
 * For each dimension, applies ALL OTHER active filters and returns
 * which values in that dimension would produce results.
 */

export interface FacetProperty {
  _id: string;
  communitySlug: string;
  bedrooms: number;
  hasBookingUrl: boolean;
  hasRentalWeeks?: boolean;
  hasSaleWeeks?: boolean;
  availableWeeks: number[];
  amenities: string[]; // e.g. ["pool","hot_tub","tennis","grill"]
}

export interface AvailableFacets {
  communities: Set<string>;
  weeks: Set<number>;
  bedrooms: Set<number>;
  hasRent: boolean;
  hasBuy: boolean;
  amenities: Set<string>;
}

interface ActiveFilters {
  communitySlugs: string[];
  weekNumbers: number[];
  bedroomValues: number[];
  listingTypes: string[];
  amenities: string[];
}

function matchesListingType(p: FacetProperty, types: string[]): boolean {
  if (types.length === 0) return true;
  const wantRent = types.includes("rent");
  const wantBuy = types.includes("buy");
  if (wantRent && wantBuy) return true;
  if (wantRent) return p.hasRentalWeeks ?? p.hasBookingUrl;
  if (wantBuy) return p.hasSaleWeeks ?? p.availableWeeks.length > 0;
  return true;
}

function matchesCommunity(p: FacetProperty, slugs: string[]): boolean {
  if (slugs.length === 0) return true;
  return slugs.includes(p.communitySlug);
}

function matchesBedrooms(p: FacetProperty, beds: number[]): boolean {
  if (beds.length === 0) return true;
  const minBed = Math.min(...beds);
  return p.bedrooms >= minBed;
}

function matchesWeeks(p: FacetProperty, weeks: number[]): boolean {
  if (weeks.length === 0) return true;
  return p.availableWeeks.some((w) => weeks.includes(w));
}

function matchesAmenities(p: FacetProperty, amenities: string[]): boolean {
  if (amenities.length === 0) return true;
  return amenities.every((a) => p.amenities.includes(a));
}

export function computeFacets(
  allProperties: FacetProperty[],
  filters: ActiveFilters
): AvailableFacets {
  const { communitySlugs, weekNumbers, bedroomValues, listingTypes, amenities } = filters;

  // For communities: apply all filters EXCEPT community
  const forCommunities = allProperties.filter(
    (p) =>
      matchesListingType(p, listingTypes) &&
      matchesBedrooms(p, bedroomValues) &&
      matchesWeeks(p, weekNumbers) &&
      matchesAmenities(p, amenities)
  );
  const communities = new Set(forCommunities.map((p) => p.communitySlug));

  // For weeks: apply all filters EXCEPT weeks
  const forWeeks = allProperties.filter(
    (p) =>
      matchesListingType(p, listingTypes) &&
      matchesCommunity(p, communitySlugs) &&
      matchesBedrooms(p, bedroomValues) &&
      matchesAmenities(p, amenities)
  );
  const weeks = new Set<number>();
  forWeeks.forEach((p) => p.availableWeeks.forEach((w) => weeks.add(w)));

  // For bedrooms: apply all filters EXCEPT bedrooms
  const forBedrooms = allProperties.filter(
    (p) =>
      matchesListingType(p, listingTypes) &&
      matchesCommunity(p, communitySlugs) &&
      matchesWeeks(p, weekNumbers) &&
      matchesAmenities(p, amenities)
  );
  const bedroomSet = new Set<number>();
  forBedrooms.forEach((p) => {
    for (let b = 1; b <= 4; b++) {
      if (p.bedrooms >= b) bedroomSet.add(b);
    }
  });

  // For listing type: apply all filters EXCEPT listing type
  const forType = allProperties.filter(
    (p) =>
      matchesCommunity(p, communitySlugs) &&
      matchesBedrooms(p, bedroomValues) &&
      matchesWeeks(p, weekNumbers) &&
      matchesAmenities(p, amenities)
  );
  const hasRent = forType.some((p) => p.hasRentalWeeks ?? p.hasBookingUrl);
  const hasBuy = forType.some((p) => p.hasSaleWeeks ?? p.availableWeeks.length > 0);

  // For amenities: apply all filters EXCEPT amenities
  const forAmenities = allProperties.filter(
    (p) =>
      matchesListingType(p, listingTypes) &&
      matchesCommunity(p, communitySlugs) &&
      matchesBedrooms(p, bedroomValues) &&
      matchesWeeks(p, weekNumbers)
  );
  const amenitySet = new Set<string>();
  forAmenities.forEach((p) => p.amenities.forEach((a) => amenitySet.add(a)));

  return { communities, weeks, bedrooms: bedroomSet, hasRent, hasBuy, amenities: amenitySet };
}
