export interface ScrapedBase {
  id: string | number;
  type: string;
  th_level: number;
  title: string;
  detail_url: string;
  preview_image_url: string;
  full_image_url: string | null;
  game_copy_link: string | null;
  has_link: boolean;
  year: number | null;
  updated: boolean;
  rating_out_of_5: number;
  views: number;
  views_raw: string;
  tags: string[];
  votes?: number;
  hotScore?: number;
  recentDownloads?: number;
}

export interface ScrapeResult {
  th_level: number;
  scraped_at: string;
  total_bases: number;
  groups: Record<string, ScrapedBase[]>;
}
