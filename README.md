# Subject Repository Template — Wikipefia

This is a **sample subject content repository** for [Wikipefia](https://github.com/org/wikipefia). It demonstrates every available feature: full tri-lingual content, all MDX components, all config fields, and CI/CD workflows for automated validation and deployment.

## Quick Start

1. **Use this template** → click "Use this template" on GitHub to create your own subject repo.
2. **Edit `config.json`** → fill in your subject's metadata (slug, name, teachers, categories, etc.).
3. **Write articles** → add MDX files under `articles/{locale}/`. Each locale must have a `_front.mdx`.
4. **Register in main repo** → add your repo to `content-sources.json` in the Wikipefia main repository.
5. **Push to main** → the `notify-main.yml` workflow will trigger a rebuild of the Wikipefia site.

## Repository Structure

```
subject-repo-template/
├── config.json                     # Subject metadata (schema-validated)
├── articles/
│   ├── en/                         # English articles
│   │   ├── _front.mdx              # Required: subject overview / front page
│   │   ├── introduction.mdx        # Beginner article
│   │   ├── core-concepts.mdx       # Intermediate article (with prerequisites)
│   │   ├── advanced-topics.mdx     # Advanced article (with prerequisites + tutors)
│   │   └── practice-problems.mdx   # Interactive article (Quiz, CodePlayground)
│   ├── ru/                         # Russian articles
│   │   ├── _front.mdx
│   │   ├── introduction.mdx
│   │   ├── core-concepts.mdx
│   │   └── advanced-topics.mdx
│   └── cz/                         # Czech articles
│       ├── _front.mdx
│       └── introduction.mdx
├── assets/                         # Images, diagrams, etc.
│   └── .gitkeep
├── scripts/
│   └── validate-content.ts         # Local content validation script
├── package.json                    # Validation dependencies
├── tsconfig.json                   # TypeScript config for scripts
└── .github/
    └── workflows/
        ├── validate.yml            # CI: validates content on every PR
        └── notify-main.yml        # CD: triggers main repo rebuild on push to main
```

## Config Schema

`config.json` must conform to the `SubjectConfig` Zod schema. All fields are documented below:

| Field                 | Type                           | Required | Description                                                                                                       |
| --------------------- | ------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------- |
| `slug`                | `string`                       | Yes      | URL-safe identifier (`^[a-z0-9-]+$`). Must be globally unique across all subjects, teachers, and system articles. |
| `name`                | `LocalizedString`              | Yes      | Display name in all locales (`{ ru, en, cz }`).                                                                   |
| `description`         | `LocalizedString`              | Yes      | Short description in all locales.                                                                                 |
| `teachers`            | `string[]`                     | Yes      | Array of teacher slugs who teach this subject.                                                                    |
| `keywords`            | `LocalizedKeywords`            | Yes      | Search keywords per locale (`{ ru: [...], en: [...], cz: [...] }`).                                               |
| `categories`          | `Category[]`                   | Yes      | Article groupings. Each has `slug`, `name`, and `articles[]`.                                                     |
| `metadata.semester`   | `number`                       | No       | Semester number (e.g., `1`, `2`).                                                                                 |
| `metadata.credits`    | `number`                       | No       | ECTS credits.                                                                                                     |
| `metadata.difficulty` | `"easy" \| "medium" \| "hard"` | No       | Overall course difficulty.                                                                                        |
| `metadata.department` | `LocalizedString`              | No       | Department name in all locales.                                                                                   |

## Article Frontmatter Schema

Every `.mdx` file must have YAML frontmatter conforming to `ArticleFrontmatter`:

```yaml
---
title:
  ru: "Заголовок"
  en: "Title"
  cz: "Název"
slug: "article-slug" # Must match filename (without .mdx)
author: "teacher-slug" # Optional: teacher who wrote it
keywords:
  ru: ["ключевое слово"]
  en: ["keyword"]
  cz: ["klíčové slovo"]
created: "2025-01-01" # ISO date, required
updated: "2025-06-01" # ISO date, optional
difficulty: "beginner" # Optional: beginner | intermediate | advanced
estimatedReadTime: 10 # Optional: minutes
prerequisites: # Optional: other article slugs in this subject
  - "introduction"
tutors: # Optional: teacher slugs who can tutor this topic
  - "ivan-petrov"
---
```

## Available MDX Components

These custom components are available in all articles:

| Component               | Usage                    | Description                             |
| ----------------------- | ------------------------ | --------------------------------------- |
| `<Callout type="info">` | Info/Warning/Error boxes | `type`: `info`, `warning`, `error`      |
| `<Quiz>`                | Interactive quiz         | Multiple choice questions with feedback |
| `<Tabs>`                | Tabbed content panels    | Group related content under tabs        |
| `<MathBlock>`           | LaTeX math display       | Rendered math equations                 |
| `<CodePlayground>`      | Editable code            | Interactive code editor                 |
| `<Collapse>`            | Expandable section       | Click to reveal hidden content          |
| `<Figure>`              | Image with caption       | `src`, `alt`, `caption` props           |

Standard Markdown features: GFM tables, inline/block math (`$...$` / `$$...$$`), fenced code blocks with syntax highlighting, blockquotes, and footnotes.

## Localization Rules

- Every locale must have `_front.mdx` (the subject's front page).
- Articles don't need to exist in every locale — the site falls back: requested → `en` → `ru`.
- All frontmatter strings (title, keywords) must include all 3 locales (`ru`, `en`, `cz`).

## CI/CD

### Validation (on PRs)

The `validate.yml` workflow runs on every PR and checks:

- `config.json` validates against the SubjectConfig Zod schema
- All MDX frontmatter validates against ArticleFrontmatter schema
- Every locale has a `_front.mdx`
- Articles referenced in `config.json` categories exist as MDX files
- No duplicate article slugs across categories

### Deployment Trigger (on push to main)

The `notify-main.yml` workflow fires a `repository_dispatch` event to the main Wikipefia repo, triggering a full site rebuild with fresh content.

## Local Development

```bash
# Install validation dependencies
pnpm install

# Run content validation locally
pnpm validate

# Check TypeScript
pnpm typecheck
```
