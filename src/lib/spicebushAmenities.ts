/**
 * Spicebush amenity display grouping [zoe, 2026-10-01].
 *
 * HostAway syncs ~90 raw amenity tags per villa, mixing villa features
 * (dishwasher) with area activities (antiquing) and trivia (toilet). This maps
 * raw tags to a short consolidated list, split into villa features, resort
 * amenities, and nearby activities. Display only: search facets still use the
 * raw tags. A consolidated label shows only if the villa has at least one of
 * its source tags. Tags mapped to null are dropped as noise. Any raw tag not in
 * the map falls through to "Other" so a new HostAway tag is never silently lost.
 */

export type AmenitySection = "villa" | "resort" | "nearby";

type Rule = { label: string; section: AmenitySection; group: string } | null;

const K = "Kitchen & Dining";
const L = "Comfort & Living";
const B = "Bath & Laundry";
const O = "Outdoor & Parking";
const S = "Safety & Policies";

const v = (label: string, group: string): Rule => ({ label, section: "villa", group });
const r = (label: string): Rule => ({ label, section: "resort", group: "Resort Amenities" });
const n = (label: string): Rule => ({ label, section: "nearby", group: "Nearby Activities" });

const RULES: Record<string, Rule> = {
  // Kitchen & Dining
  "kitchen": v("Fully equipped kitchen", K),
  "cooking basics": v("Fully equipped kitchen", K),
  "kitchen utensils": v("Fully equipped kitchen", K),
  "baking sheet": v("Fully equipped kitchen", K),
  "oven": v("Oven and stove", K),
  "stove": v("Oven and stove", K),
  "refrigerator": v("Refrigerator with ice maker", K),
  "freezer": v("Refrigerator with ice maker", K),
  "ice maker": v("Refrigerator with ice maker", K),
  "dishwasher": v("Dishwasher", K),
  "microwave": v("Microwave", K),
  "coffee/tea maker": v("Coffee maker and kettle", K),
  "electric kettle": v("Coffee maker and kettle", K),
  "toaster": v("Toaster and blender", K),
  "blender": v("Toaster and blender", K),
  "dining area": v("Dining area", K),
  "dining room": v("Dining area", K),
  "dining table": v("Dining area", K),

  // Comfort & Living
  "air conditioning": v("Air conditioning and heating", L),
  "heating": v("Air conditioning and heating", L),
  "ceiling fan": v("Ceiling fans", L),
  "smart tv": v("Smart TV with cable", L),
  "tv": v("Smart TV with cable", L),
  "cable tv": v("Smart TV with cable", L),
  "free wifi": v("Free WiFi", L),
  "internet": v("Free WiFi", L),
  "wireless": v("Free WiFi", L),
  "laptop friendly workspace": v("Laptop-friendly workspace", L),
  "room darkening shades": v("Room darkening shades", L),
  "linens": v("Linens and extra pillows", L),
  "extra pillows and blankets": v("Linens and extra pillows", L),
  "clothing storage": null,
  "hangers": null,

  // Bath & Laundry
  "towels": v("Towels", B),
  "shampoo": v("Shampoo and shower gel", B),
  "shower gel": v("Shampoo and shower gel", B),
  "essentials": v("Shampoo and shower gel", B),
  "hair dryer": v("Hair dryer", B),
  "tub": v("Bathtub", B),
  "washing machine": v("Washer and dryer", B),
  "dryer": v("Washer and dryer", B),
  "iron": v("Iron and ironing board", B),
  "iron board": v("Iron and ironing board", B),
  "drying rack for clothing": null,
  "shower": null,
  "toilet": null,
  "hot water": null,

  // Outdoor & Parking
  "balcony": v("Balcony", O),
  "outdoor furniture": v("Outdoor furniture and loungers", O),
  "outdoor sunloungers": v("Outdoor furniture and loungers", O),
  "outdoor grill": v("Outdoor grill", O),
  "barbeque utensils": v("Outdoor grill", O),
  "water view": v("Water view", O),
  "waterfront": v("Water view", O),
  "lake": v("Water view", O),
  "golf course view": v("Golf course view", O),
  "private entrance": v("Private entrance", O),
  "free parking": v("Free parking", O),
  "street parking": v("Free parking", O),

  // Safety & Policies
  "smoke detector": v("Smoke and carbon monoxide detectors", S),
  "carbon monoxide detector": v("Smoke and carbon monoxide detectors", S),
  "fire extinguisher": v("Fire extinguisher", S),
  "suitable for children": v("Kid and infant friendly", S),
  "suitable for infants": v("Kid and infant friendly", S),
  "long term stays allowed": v("Long-term stays allowed", S),

  // Resort amenities (shared, on property)
  "swimming pool": r("Community pool"),
  "heated swimming pool": r("Community pool"),
  "communal swimming pool": r("Community pool"),
  "pool": r("Community pool"),
  "fire pit": r("Fire pit"),
  "gym": null, // only 2 villas tagged, unverified [viktor, 2026-10-01]
  "resort": null,

  // Nearby activities (Sea Pines and Hilton Head Island)
  "beach": n("Beach"),
  "near ocean": n("Beach"),
  "swimming": null,
  "boating": n("Boating and marina"),
  "marina": n("Boating and marina"),
  "paddle boating": n("Kayaking, paddleboarding, and water sports"),
  "water sports": n("Kayaking, paddleboarding, and water sports"),
  "bird watching": n("Bird watching and wildlife"),
  "wildlife viewing": n("Bird watching and wildlife"),
  "eco tourism": n("Bird watching and wildlife"),
  "tennis": n("Tennis"),
  "horseback riding": n("Horseback riding"),
  "shopping": n("Shopping and outlets"),
  "outlet shopping": n("Shopping and outlets"),
  "antiquing": n("Museums and antiquing"),
  "museums": n("Museums and antiquing"),
  "health beauty spa": n("Spas"),
};

const VILLA_GROUP_ORDER = [K, L, B, O, S, "Other"];

export type AmenityGroup = { group: string; items: string[] };
export type GroupedAmenities = Record<AmenitySection, AmenityGroup[]>;

export function groupSpicebushAmenities(tags: string[]): GroupedAmenities {
  const buckets = new Map<string, { section: AmenitySection; items: string[] }>();
  for (const tag of tags) {
    const key = tag.trim().toLowerCase();
    const rule = key in RULES ? RULES[key] : v(tag.trim(), "Other");
    if (!rule) continue;
    const b = buckets.get(rule.group) ?? { section: rule.section, items: [] };
    if (!b.items.includes(rule.label)) b.items.push(rule.label);
    buckets.set(rule.group, b);
  }
  const out: GroupedAmenities = { villa: [], resort: [], nearby: [] };
  for (const [group, b] of buckets) out[b.section].push({ group, items: b.items });
  out.villa.sort((a, b) => VILLA_GROUP_ORDER.indexOf(a.group) - VILLA_GROUP_ORDER.indexOf(b.group));
  return out;
}
