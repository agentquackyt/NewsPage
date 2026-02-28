import { use } from "marked";

const flavortown_key = Bun.env.FLAVORTOWN_KEY;
if (!flavortown_key) {
    throw new Error("FLAVORTOWN_KEY environment variable is not set");
}

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

async function getUserData(): Promise<FlavortownUser | FlavortownError> {
    const res = await fetch('https://flavortown.hackclub.com/api/v1/users/me', {
        headers: {
            'Authorization': `Bearer ${flavortown_key}`
        }
    });
    const data = await res.json();
    return data;
}


async function getProject(id: number): Promise<FlavortownProject | FlavortownError> {

    const res = await fetch(`https://flavortown.hackclub.com/api/v1/projects/${id}`, {
        headers: {
            'Authorization': `Bearer ${flavortown_key}`
        }
    });
    const data = await res.json();
    return data;

}

async function getDevlog(id: number): Promise<FlavortownDevlogList | FlavortownError> {
    // https://flavortown.hackclub.com/api/v1/projects/${id}/devlogs
    const res = await fetch(`https://flavortown.hackclub.com/api/v1/projects/${id}/devlogs`, {
        headers: {
            'Authorization': `Bearer ${flavortown_key}`
        }
    });
    const data = await res.json();
    return data;
}

async function init() {
    const userData = await getUserData();
    // Check if userData is an error
    if ((userData as FlavortownError).error) {
        console.error("Error fetching user data:", (userData as FlavortownError).error);
        return;
    }
    const user = userData as FlavortownUser;
    console.log("User display name: ", user.display_name);
    for (const projectId of user.project_ids) {
        const projectData = await getProject(projectId);
        if ((projectData as FlavortownError).error) {
            console.error("Error fetching project data:", (projectData as FlavortownError).error);
            continue;
        }
        const project = projectData as FlavortownProject;

        const devlogData = await getDevlog(project.id);
        if ((devlogData as FlavortownError).error) {
            console.error("Error fetching devlog data:", (devlogData as FlavortownError).error);
            continue;
        }
        const devlogs = devlogData as FlavortownDevlogList;
        console.log(`Project "${project.title}" has ${devlogs.pagination.total_count} devlogs.`);

        articles.push({
            project,
            devlogs
        });
    }
    renderArticles();
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
    console.log("Rendering articles");
    console.log("Articles count:", articles.length);

    // For every project, generate a article markdown file with the project title as the title, and the devlogs as the content

    for (const article of articles) {
        console.log(`Project: ${article.project.title}`);
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
    }
}

init();