// Business categories: label used in Google text queries, selectors used for OSM Overpass.
// An OSM selector is `key=value` or `key=*`.

export type Category = {
  id: string;
  label: string;
  osm: string[];
};

export const CATEGORIES: Category[] = [
  { id: "any", label: "any", osm: ["shop=*", "craft=*", "amenity=restaurant", "amenity=cafe", "amenity=fast_food", "amenity=clinic", "amenity=dentist", "amenity=pharmacy", "amenity=car_repair"] },
  { id: "restaurant", label: "restaurant", osm: ["amenity=restaurant", "amenity=fast_food"] },
  { id: "salon", label: "salon", osm: ["shop=beauty", "shop=hairdresser"] },
  { id: "tailor", label: "tailor", osm: ["craft=tailor", "shop=tailor", "shop=fabric"] },
  { id: "clinic", label: "clinic", osm: ["amenity=clinic", "amenity=doctors", "amenity=dentist"] },
  { id: "sweet shop", label: "sweet shop", osm: ["shop=confectionery", "shop=bakery", "shop=pastry"] },
  { id: "cafe", label: "cafe", osm: ["amenity=cafe"] },
  { id: "driving school", label: "driving school", osm: ["amenity=driving_school"] },
  { id: "grocery", label: "grocery", osm: ["shop=convenience", "shop=supermarket", "shop=greengrocer"] },
  { id: "real estate", label: "real estate agent", osm: ["office=estate_agent", "shop=estate_agent"] },
  // Trades that take their bookings on WhatsApp: one owner, appointments or
  // orders by message, an Instagram page at most — the people most likely to
  // reply to a message and to want a site.
  { id: "makeup artist", label: "makeup artist", osm: ["shop=beauty"] },
  { id: "tattoo", label: "tattoo studio", osm: ["shop=tattoo"] },
  { id: "pet grooming", label: "pet grooming", osm: ["shop=pet_grooming"] },
  { id: "car rental", label: "car rental", osm: ["amenity=car_rental", "shop=car_rental"] },
  { id: "laundry", label: "laundry", osm: ["shop=laundry", "shop=dry_cleaning"] },
  { id: "optician", label: "optician", osm: ["shop=optician"] },
  { id: "jeweller", label: "jeweller", osm: ["shop=jewelry"] },
  { id: "furniture", label: "furniture", osm: ["shop=furniture"] },
  { id: "florist", label: "florist", osm: ["shop=florist"] },
  { id: "pet shop", label: "pet shop", osm: ["shop=pet"] },
  { id: "photo studio", label: "photo studio", osm: ["shop=photo", "craft=photographer"] },
  { id: "clothing", label: "clothing", osm: ["shop=clothes", "shop=boutique"] },
  { id: "spa", label: "spa", osm: ["shop=massage", "leisure=spa", "shop=beauty"] },
  { id: "veterinary", label: "veterinary", osm: ["amenity=veterinary"] },
  { id: "stationery", label: "stationery", osm: ["shop=stationery", "shop=books"] },
  { id: "gift shop", label: "gift shop", osm: ["shop=gift", "shop=toys"] },
  { id: "catering", label: "catering", osm: ["craft=caterer", "shop=deli"] },
  { id: "guest house", label: "guest house / hotel", osm: ["tourism=guest_house", "tourism=hotel", "tourism=hostel"] },
  { id: "travel agent", label: "travel agent", osm: ["shop=travel_agency"] },
  { id: "dentist", label: "dentist", osm: ["amenity=dentist"] },
  { id: "interior", label: "interior / painter", osm: ["craft=painter", "craft=interior_decorator", "shop=interior_decoration"] },
  { id: "event", label: "event / decorator", osm: ["craft=event_venue", "shop=party", "office=event_management"] },
];

export function getCategory(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}
