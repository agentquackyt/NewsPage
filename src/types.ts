export interface ArticleMeta {
  id: string;
  title: string;
  date: string;
  description: string;
  thumbnail?: string;
  filename: string;
}

export interface SiteConfig {
  title: string;
  theme: "guardian" | "times" | "tagesschau" | "tech";
  description: string;
}

export const DEFAULT_CONFIG: SiteConfig = {
  title: "NewsPage",
  theme: "tech",
  description: "A dynamic news page",
};
