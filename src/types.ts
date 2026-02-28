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
  theme: "guardian" | "times" | "tagesschau";
  description: string;
}

export const DEFAULT_CONFIG: SiteConfig = {
  title: "NewsPage",
  theme: "guardian",
  description: "A dynamic news page",
};
