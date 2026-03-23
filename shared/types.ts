export interface Listing {
  id: string;
  title: string;
  url: string;
  location: string;
  area_m2: number | null;
  category: string;
  dispozice: string | null;
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
