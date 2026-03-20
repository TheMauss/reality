export interface Listing {
  id: string;
  title: string;
  url: string;
  location: string;
  area_m2: number | null;
  category: string;
  price: number;
  first_seen_at: Date;
}

export interface PriceHistory {
  listing_id: string;
  price: number;
  recorded_at: Date;
}

export interface PriceDrop {
  listing_id: string;
  old_price: number;
  new_price: number;
  drop_pct: number;
  detected_at: Date;
}

export interface User {
  _id?: string;
  email: string;
  plan: "free" | "pro";
  telegram_id?: string;
  created_at: Date;
}

export interface AlertConfig {
  user_id: string;
  filters: {
    location?: string;
    category?: string;
    min_drop_pct?: number;
  };
}

export interface Watchdog {
  id: number;
  user_id: number;
  name: string;
  active: number;
  category: string | null;
  region_id: number | null;
  district_id: number | null;
  location: string | null;
  price_min: number | null;
  price_max: number | null;
  area_min: number | null;
  area_max: number | null;
  keywords: string | null; // JSON array
  watch_new: number;
  watch_drops: number;
  watch_drops_min_pct: number;
  watch_underpriced: number;
  watch_underpriced_pct: number;
  watch_returned: number;
  notify_email: number;
  notify_telegram: number;
  notify_frequency: "instant" | "daily" | "weekly";
  created_at: string;
  updated_at: string;
}

export interface WatchdogMatch {
  id: number;
  watchdog_id: number;
  listing_id: string;
  match_type: "new" | "drop" | "underpriced" | "returned";
  match_detail: string | null; // JSON
  notified: number;
  created_at: string;
}

export interface ScrapeEvents {
  newListings: ParsedListing[];
  priceDrops: { listing: ParsedListing; oldPrice: number; newPrice: number; dropPct: number }[];
  returnedListings: ParsedListing[];
}

export interface ParsedListing {
  id: string;
  title: string;
  url: string;
  location: string;
  area_m2: number | null;
  category: string;
  price: number;
  lat: number | null;
  lon: number | null;
  region_id: number | null;
  district_id: number | null;
  description?: string | null;
  image_url?: string | null;
}
