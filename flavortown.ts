import { ask, header, hint, info, success, error as uiError } from "./src/lib/ui";

// Get the user from token
//  curl 'https://flavortown.hackclub.com/api/v1/users/{id}' \
//      --header 'Authorization: Bearer YOUR_SECRET_TOKEN'


interface FlavortownUser {
    id: number;
    slack_id: string;
    display_name: string;
    avatar: string;
    project_ids: number[];
    cookies: any; // not sure what this is
    vote_count: number;
    like_count: number;
    devlog_seconds_total: number;
    devlog_seconds_today: number;
}


interface FlavortownProject {
    id: number;
    title: string;
    description: string;
    repo_url: string;
    demo_url: string;
    readme_url: string;
    ai_declaration: string;
    ship_status: string;
    devlog_ids: number[];
    banner_url: string | null;
    created_at: string; // ISO date string
    updated_at: string; // ISO date string
}

interface FlavortownDevlogList {
    id: number;
    name: string;
    description: string;
    devlogs: FlavortownDevlog[];
    pagination: {
        current_page: number;
        total_pages: number;
        total_count: number;
        next_page: number | null;
    };
}

interface FlavortownDevlog {
    id: number;
    body: string;
    comments_count: number;
    duration_seconds: number;
    likes_count: number;
    scrapbook_url: string;
    created_at: string; // ISO date string
    updated_at: string; // ISO date string
    media: {
        url: string;
        content_type: string;
    }[];
    comments: {
        id: number;
        author: {
            id: number;
            display_name: string;
            avatar: string;
        };
        body: string;
        created_at: string; // ISO date string
        updated_at: string; // ISO date string
    }[];
}

interface FlavortownError {
    error: string;
}


let articles: {
    project: FlavortownProject;
    devlogs: FlavortownDevlogList;
}[] = [];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function formatTrackedTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

async function fetchWithKey(url: string, key: string): Promise<any> {
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${key}` }
    });
    return res.json();
}

let getUserData:  () => Promise<FlavortownUser | FlavortownError>        = () => Promise.reject("not initialised");
let getProjectFn: (id: number) => Promise<FlavortownProject | FlavortownError>     = () => Promise.reject("not initialised");
let getDevlogFn:  (id: number) => Promise<FlavortownDevlogList | FlavortownError>  = () => Promise.reject("not initialised");

async function init() {
    header("Flavortown Importer");
    hint("Import Hack Club Flavortown projects as NewsPage articles.\n");

    const flavortown_key = await ask("Flavortown API key: ");
    if (!flavortown_key) {
        uiError("API key cannot be empty.");
        process.exit(1);
    }

    getUserData   = () => fetchWithKey("https://flavortown.hackclub.com/api/v1/users/me", flavortown_key);
    getProjectFn  = (id) => fetchWithKey(`https://flavortown.hackclub.com/api/v1/projects/${id}`, flavortown_key);
    getDevlogFn   = (id) => fetchWithKey(`https://flavortown.hackclub.com/api/v1/projects/${id}/devlogs`, flavortown_key);

    info("Fetching user data…");
    const userData = await getUserData();
    if ((userData as FlavortownError).error) {
        uiError("Error fetching user data: " + (userData as FlavortownError).error);
        return;
    }
    const user = userData as FlavortownUser;
    success(`Signed in as ${user.display_name}`);

    for (const projectId of user.project_ids) {
        const projectData = await getProjectFn(projectId);
        if ((projectData as FlavortownError).error) {
            uiError("Error fetching project data: " + (projectData as FlavortownError).error);
            continue;
        }
        const project = projectData as FlavortownProject;

        const devlogData = await getDevlogFn(project.id);
        if ((devlogData as FlavortownError).error) {
            uiError("Error fetching devlog data: " + (devlogData as FlavortownError).error);
            continue;
        }
        const devlogs = devlogData as FlavortownDevlogList;
        info(`Project "${project.title}" — ${devlogs.pagination.total_count} devlog(s)`);

        articles.push({ project, devlogs });
    }
    renderArticles();

    // Implement press any key to exit
    info("\nPress any key to exit.");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", process.exit.bind(process, 0));
}

function generateArticleHeader(article: {
    project: FlavortownProject;
}) {
return `---
id: ${slugify(article.project.title)}
title: ${article.project.title}
date: ${article.project.created_at}
description: ${article.project.description}
thumbnail: ${"https://flavortown.hackclub.com" + (article.project.banner_url || "/assets/default-banner-3d4e1b67.png")}
---
`;
}

function renderArticles() {
    header("Writing Articles");
    info(`${articles.length} article(s) to write…`);

    // For every project, generate a article markdown file with the project title as the title, and the devlogs as the content

    for (const article of articles) {
        info(`Writing "${article.project.title}"…`);
        let markdown = generateArticleHeader(article);
        for (const devlog of article.devlogs.devlogs) {
            markdown += `\n\n## ${formatTrackedTime(devlog.duration_seconds)} - ${new Date(devlog.created_at).toLocaleDateString()}\n\n`;
            markdown += `${devlog.body}\n\n`;
            for (const media of devlog.media) {
                if (media.content_type.startsWith("image/")) {
                    markdown += `![${article.project.title}](${"https://flavortown.hackclub.com" + media.url})\n\n`;
                } else if (media.content_type.startsWith("video/")) {
                    markdown += `<video controls src="${"https://flavortown.hackclub.com" + media.url}"></video>\n\n`;
                }
            }
        }
        
        Bun.write(`./articles/${slugify(article.project.title)}.md`, markdown);
        success(`Wrote articles/${slugify(article.project.title)}.md`);
    }
}

init();