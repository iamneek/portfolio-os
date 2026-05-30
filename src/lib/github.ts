import "server-only";

import type { BlogPost, FailureEntry, PortfolioData, Profile, Project } from "@/lib/types";

const API_BASE = "https://api.github.com";
const RAW_BASE = "https://raw.githubusercontent.com";

const DEFAULT_REVALIDATE_SECONDS = 900;

const sampleProfile: Profile = {
  name: "Your Name",
  login: "your-github",
  bio: "Designer, builder, and curious debugger.",
  url: "https://github.com/",
  avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
  followers: 0,
  following: 0,
  publicRepos: 0,
};

const sampleProjects: Project[] = [
  {
    id: 1,
    name: "sample-desktop-shell",
    description: "A hand-drawn monochrome desktop shell experiment.",
    url: "https://github.com/",
    homepage: null,
    language: "TypeScript",
    stars: 0,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: "sample-blog-engine",
    description: "Markdown-driven writing flow synced from GitHub.",
    url: "https://github.com/",
    homepage: null,
    language: "MDX",
    stars: 0,
    updatedAt: new Date().toISOString(),
  },
];

const sampleBlogs: BlogPost[] = [
  {
    id: 1,
    title: "First sketch",
    summary: "Documenting the process of translating desktop nostalgia into a portfolio UI.",
    url: "https://github.com/",
    path: "content/blog/first-sketch.md",
    updatedAt: new Date().toISOString(),
  },
];

const sampleFailures: FailureEntry[] = [
  {
    id: 1,
    title: "Over-animated shell",
    summary: "Too many moving parts hurt readability, so the motion system was simplified.",
    url: "https://github.com/",
    state: "closed",
    updatedAt: new Date().toISOString(),
  },
];

type RepoApi = {
  id: number;
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  pushed_at: string;
  fork: boolean;
};

type UserApi = {
  name: string | null;
  login: string;
  bio: string | null;
  html_url: string;
  avatar_url: string;
  followers: number;
  following: number;
  public_repos: number;
};

type IssueApi = {
  id: number;
  title: string;
  body: string | null;
  html_url: string;
  state: "open" | "closed";
  updated_at: string;
  pull_request?: unknown;
};

type TreeItemApi = {
  path: string;
  type: "blob" | "tree";
};

type TreeApi = {
  tree: TreeItemApi[];
};

type SearchIssueResponse = {
  items: IssueApi[];
};

function getConfig() {
  const username = process.env.GITHUB_USERNAME?.trim() ?? "";
  const token = process.env.GITHUB_TOKEN?.trim() ?? "";
  const blogRepo = process.env.GITHUB_BLOG_REPO?.trim() ?? username;
  const blogPath = process.env.GITHUB_BLOG_PATH?.trim() ?? "content/blog";
  const failureRepo = process.env.GITHUB_FAILURE_REPO?.trim() ?? blogRepo;
  const failureLabel = process.env.GITHUB_FAILURE_LABEL?.trim() ?? "failure";

  return {
    username,
    token,
    blogRepo,
    blogPath,
    failureRepo,
    failureLabel,
  };
}

function githubHeaders(token: string): HeadersInit {
  if (!token) {
    return {
      Accept: "application/vnd.github+json",
    };
  }

  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
  };
}

async function fetchGithub<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: githubHeaders(token),
    next: { revalidate: DEFAULT_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status}) for ${url}`);
  }

  return (await response.json()) as T;
}

function toProject(repo: RepoApi): Project {
  return {
    id: repo.id,
    name: repo.name,
    description: repo.description ?? "No description yet.",
    url: repo.html_url,
    homepage: repo.homepage,
    language: repo.language ?? "Unknown",
    stars: repo.stargazers_count,
    updatedAt: repo.pushed_at,
  };
}

function toProfile(user: UserApi): Profile {
  return {
    name: user.name ?? user.login,
    login: user.login,
    bio: user.bio ?? "No bio added yet.",
    url: user.html_url,
    avatarUrl: user.avatar_url,
    followers: user.followers,
    following: user.following,
    publicRepos: user.public_repos,
  };
}

function summarizeMarkdown(content: string): string {
  const text = content
    .replace(/^---[\s\S]*?---/m, "")
    .replace(/^#\s+.+$/gm, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[>*_#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text.slice(0, 160) || "No summary available.";
}

function titleFromPath(path: string): string {
  const file = path.split("/").pop() ?? path;
  const withoutExt = file.replace(/\.mdx?$/i, "");
  return withoutExt
    .split(/[-_]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function fetchBlogs(
  owner: string,
  repo: string,
  pathPrefix: string,
  token: string,
): Promise<BlogPost[]> {
  const tree = await fetchGithub<TreeApi>(`${API_BASE}/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, token);

  const markdownFiles = tree.tree
    .filter((item) => item.type === "blob")
    .map((item) => item.path)
    .filter((path) => path.startsWith(pathPrefix) && /\.mdx?$/i.test(path))
    .slice(0, 12);

  const entries = await Promise.all(
    markdownFiles.map(async (path, index) => {
      const rawUrl = `${RAW_BASE}/${owner}/${repo}/HEAD/${path}`;
      const response = await fetch(rawUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        next: { revalidate: DEFAULT_REVALIDATE_SECONDS },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch markdown ${path}`);
      }

      const content = await response.text();

      return {
        id: index + 1,
        title: titleFromPath(path),
        summary: summarizeMarkdown(content),
        url: `https://github.com/${owner}/${repo}/blob/HEAD/${path}`,
        path,
        updatedAt: new Date().toISOString(),
      };
    }),
  );

  return entries;
}

async function fetchFailures(owner: string, repo: string, label: string, token: string): Promise<FailureEntry[]> {
  const q = encodeURIComponent(`repo:${owner}/${repo} is:issue label:${label}`);
  const result = await fetchGithub<SearchIssueResponse>(`${API_BASE}/search/issues?q=${q}&per_page=20`, token);

  return result.items
    .filter((issue) => !issue.pull_request)
    .map((issue) => ({
      id: issue.id,
      title: issue.title,
      summary: summarizeMarkdown(issue.body ?? ""),
      url: issue.html_url,
      state: issue.state,
      updatedAt: issue.updated_at,
    }));
}

async function fetchProjects(username: string, token: string): Promise<Project[]> {
  const repos = await fetchGithub<RepoApi[]>(`${API_BASE}/users/${username}/repos?sort=updated&per_page=12`, token);

  return repos.filter((repo) => !repo.fork).map(toProject);
}

export async function getPortfolioData(): Promise<PortfolioData> {
  const { username, token, blogRepo, blogPath, failureRepo, failureLabel } = getConfig();

  if (!username) {
    return {
      profile: sampleProfile,
      projects: sampleProjects,
      blogs: sampleBlogs,
      failures: sampleFailures,
      warnings: [],
    };
  }

  const warnings: string[] = [];

  try {
    const [profile, projects] = await Promise.all([
      fetchGithub<UserApi>(`${API_BASE}/users/${username}`, token).then(toProfile),
      fetchProjects(username, token),
    ]);

    const [blogsResult, failuresResult] = await Promise.allSettled([
      fetchBlogs(username, blogRepo, blogPath, token),
      fetchFailures(username, failureRepo, failureLabel, token),
    ]);

    const blogs = blogsResult.status === "fulfilled" ? blogsResult.value : sampleBlogs;
    const failures = failuresResult.status === "fulfilled" ? failuresResult.value : sampleFailures;

    if (blogsResult.status === "rejected") {
      warnings.push("Could not load blog markdown from GitHub. Using sample blog items.");
    }

    if (failuresResult.status === "rejected") {
      warnings.push("Could not load failure issues from GitHub. Using sample failure items.");
    }

    return {
      profile,
      projects: projects.length > 0 ? projects : sampleProjects,
      blogs,
      failures,
      warnings,
    };
  } catch {
    return {
      profile: sampleProfile,
      projects: sampleProjects,
      blogs: sampleBlogs,
      failures: sampleFailures,
      warnings: ["GitHub API could not be reached. Check token permissions and rate limits."],
    };
  }
}
