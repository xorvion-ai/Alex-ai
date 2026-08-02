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
  { id: "plumber", label: "plumber", osm: ["craft=plumber"] },
  { id: "tailor", label: "tailor", osm: ["craft=tailor", "shop=tailor", "shop=fabric"] },
  { id: "garage", label: "garage", osm: ["shop=car_repair", "amenity=car_repair", "shop=tyres"] },
  { id: "clinic", label: "clinic", osm: ["amenity=clinic", "amenity=doctors", "amenity=dentist"] },
  { id: "barber", label: "barber", osm: ["shop=hairdresser"] },
  { id: "sweet shop", label: "sweet shop", osm: ["shop=confectionery", "shop=bakery", "shop=pastry"] },
  { id: "cafe", label: "cafe", osm: ["amenity=cafe"] },
  { id: "gym", label: "gym", osm: ["leisure=fitness_centre", "shop=sports"] },
  { id: "grocery", label: "grocery", osm: ["shop=convenience", "shop=supermarket", "shop=greengrocer"] },
  { id: "electrician", label: "electrician", osm: ["craft=electrician"] },
  { id: "carpenter", label: "carpenter", osm: ["craft=carpenter"] },
  { id: "laundry", label: "laundry", osm: ["shop=laundry", "shop=dry_cleaning"] },
  { id: "optician", label: "optician", osm: ["shop=optician"] },
  { id: "jeweller", label: "jeweller", osm: ["shop=jewelry"] },
  { id: "furniture", label: "furniture", osm: ["shop=furniture"] },
  { id: "florist", label: "florist", osm: ["shop=florist"] },
  { id: "pet shop", label: "pet shop", osm: ["shop=pet"] },
  { id: "pharmacy", label: "pharmacy", osm: ["amenity=pharmacy", "shop=chemist"] },
  { id: "photo studio", label: "photo studio", osm: ["shop=photo", "craft=photographer"] },
  { id: "mobile repair", label: "mobile repair", osm: ["shop=mobile_phone"] },
  { id: "hardware", label: "hardware", osm: ["shop=hardware", "shop=doityourself"] },
  { id: "bakery", label: "bakery", osm: ["shop=bakery"] },
  { id: "butcher", label: "butcher", osm: ["shop=butcher", "shop=seafood"] },
  { id: "clothing", label: "clothing", osm: ["shop=clothes", "shop=boutique"] },
  { id: "shoe shop", label: "shoe shop", osm: ["shop=shoes", "craft=shoemaker"] },
  { id: "spa", label: "spa", osm: ["shop=massage", "leisure=spa", "shop=beauty"] },
  { id: "veterinary", label: "veterinary", osm: ["amenity=veterinary"] },
  { id: "car wash", label: "car wash", osm: ["amenity=car_wash", "shop=car_wash"] },
  { id: "bike repair", label: "bike / scooter repair", osm: ["shop=motorcycle_repair", "shop=bicycle", "shop=motorcycle"] },
  { id: "computer repair", label: "computer repair", osm: ["shop=computer", "shop=electronics"] },
  { id: "printing", label: "printing", osm: ["shop=copyshop", "shop=printing", "craft=printer"] },
  { id: "stationery", label: "stationery", osm: ["shop=stationery", "shop=books"] },
  { id: "gift shop", label: "gift shop", osm: ["shop=gift", "shop=toys"] },
  { id: "catering", label: "catering", osm: ["craft=caterer", "shop=deli"] },
  { id: "guest house", label: "guest house / hotel", osm: ["tourism=guest_house", "tourism=hotel", "tourism=hostel"] },
  { id: "travel agent", label: "travel agent", osm: ["shop=travel_agency"] },
  { id: "tuition", label: "tuition / coaching", osm: ["amenity=language_school", "amenity=driving_school", "office=educational_institution"] },
  { id: "dentist", label: "dentist", osm: ["amenity=dentist"] },
  { id: "interior", label: "interior / painter", osm: ["craft=painter", "craft=interior_decorator", "shop=interior_decoration"] },
  { id: "ac repair", label: "ac / appliance repair", osm: ["craft=hvac", "shop=appliance", "craft=electronics_repair"] },
  { id: "event", label: "event / decorator", osm: ["craft=event_venue", "shop=party", "office=event_management"] },
];

export function getCategory(id: string): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}
