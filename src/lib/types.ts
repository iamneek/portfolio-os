export type Project = {
  id: number;
  name: string;
  description: string;
  url: string;
  homepage: string | null;
  language: string;
  stars: number;
  updatedAt: string;
};

export type BlogPost = {
  id: number;
  title: string;
  summary: string;
  url: string;
  path: string;
  updatedAt: string;
};

export type FailureEntry = {
  id: number;
  title: string;
  summary: string;
  url: string;
  state: "open" | "closed";
  updatedAt: string;
};

export type Profile = {
  name: string;
  login: string;
  bio: string;
  url: string;
  avatarUrl: string;
  followers: number;
  following: number;
  publicRepos: number;
};

export type PortfolioData = {
  profile: Profile;
  projects: Project[];
  blogs: BlogPost[];
  failures: FailureEntry[];
  warnings: string[];
};
