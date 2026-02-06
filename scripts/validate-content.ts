#!/usr/bin/env node
/**
 * validate-content.ts — Content validation script for subject repositories.
 *
 * Validates:
 *   1. config.json against the SubjectConfig Zod schema
 *   2. All MDX frontmatter against ArticleFrontmatter schema
 *   3. Structural requirements (_front.mdx in each locale dir)
 *   4. Articles referenced in categories exist as MDX files
 *   5. No duplicate article slugs across categories
 *   6. Slug consistency (frontmatter slug matches filename)
 *
 * Run: pnpm validate
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import path from "path";
import { z } from "zod/v4";
import matter from "gray-matter";

// ── Constants ──────────────────────────────────────────

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, "config.json");
const ARTICLES_DIR = path.join(ROOT, "articles");
const LOCALES = ["ru", "en", "cz"] as const;

// ── Zod Schemas (mirrors main repo's lib/schemas/) ────

const LocalizedString = z.object({
  ru: z.string(),
  en: z.string(),
  cz: z.string(),
});

const LocalizedKeywords = z.object({
  ru: z.array(z.string()),
  en: z.array(z.string()),
  cz: z.array(z.string()),
});

const SubjectConfig = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: LocalizedString,
  description: LocalizedString,
  teachers: z.array(z.string()),
  keywords: LocalizedKeywords,
  categories: z.array(
    z.object({
      slug: z.string(),
      name: LocalizedString,
      articles: z.array(z.string()),
    })
  ),
  metadata: z
    .object({
      semester: z.number().optional(),
      credits: z.number().optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      department: LocalizedString.optional(),
    })
    .optional(),
});

const ArticleFrontmatter = z.object({
  title: LocalizedString,
  slug: z.string().regex(/^[a-z0-9_-]+$/),
  author: z.string().optional(),
  keywords: LocalizedKeywords,
  created: z.string(),
  updated: z.string().optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  estimatedReadTime: z.number().optional(),
  prerequisites: z.array(z.string()).optional(),
  tutors: z.array(z.string()).optional(),
});

// ── Utilities ──────────────────────────────────────────

let errorCount = 0;
let warnCount = 0;

function logError(msg: string) {
  console.error(`  ✗ ERROR: ${msg}`);
  errorCount++;
}

function logWarn(msg: string) {
  console.warn(`  ⚠ WARN:  ${msg}`);
  warnCount++;
}

function logOk(msg: string) {
  console.log(`  ✓ ${msg}`);
}

function listMdxFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(
    (f) => f.endsWith(".mdx") && statSync(path.join(dir, f)).isFile()
  );
}

// ── Step 1: Validate config.json ───────────────────────

function validateConfig(): z.infer<typeof SubjectConfig> | null {
  console.log("\n▸ Validating config.json...");

  if (!existsSync(CONFIG_PATH)) {
    logError("config.json not found at repository root");
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch (e) {
    logError(`config.json is not valid JSON: ${e}`);
    return null;
  }

  const result = SubjectConfig.safeParse(raw);
  if (!result.success) {
    logError("config.json schema validation failed:");
    for (const issue of result.error.issues) {
      logError(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    return null;
  }

  logOk(`config.json is valid (slug: "${result.data.slug}")`);

  // Check slug matches directory name convention
  const dirName = path.basename(ROOT);
  if (
    dirName !== result.data.slug &&
    dirName !== `subject-${result.data.slug}` &&
    dirName !== "subject-repo-template"
  ) {
    logWarn(
      `Directory name "${dirName}" doesn't match slug "${result.data.slug}". ` +
        `Convention: directory should be named "${result.data.slug}" or "subject-${result.data.slug}".`
    );
  }

  return result.data;
}

// ── Step 2: Validate structure ─────────────────────────

function validateStructure(): void {
  console.log("\n▸ Validating repository structure...");

  if (!existsSync(ARTICLES_DIR)) {
    logError("articles/ directory not found");
    return;
  }

  // Check which locales have directories
  const localeDirs = LOCALES.filter((l) =>
    existsSync(path.join(ARTICLES_DIR, l))
  );

  if (localeDirs.length === 0) {
    logError(
      "No locale directories found in articles/. " +
        `Expected at least one of: ${LOCALES.join(", ")}`
    );
    return;
  }

  logOk(`Found locale directories: ${localeDirs.join(", ")}`);

  // Check _front.mdx in each locale
  let hasFront = false;
  for (const locale of localeDirs) {
    const frontPath = path.join(ARTICLES_DIR, locale, "_front.mdx");
    if (existsSync(frontPath)) {
      logOk(`articles/${locale}/_front.mdx exists`);
      hasFront = true;
    } else {
      logError(
        `articles/${locale}/_front.mdx is missing (required for each locale directory)`
      );
    }
  }

  if (!hasFront) {
    logError(
      "No _front.mdx found in any locale. At least one locale must have _front.mdx."
    );
  }
}

// ── Step 3: Validate frontmatter ───────────────────────

function validateFrontmatter(): void {
  console.log("\n▸ Validating MDX frontmatter...");

  for (const locale of LOCALES) {
    const localeDir = path.join(ARTICLES_DIR, locale);
    if (!existsSync(localeDir)) continue;

    const files = listMdxFiles(localeDir);
    for (const file of files) {
      const filePath = path.join(localeDir, file);
      const raw = readFileSync(filePath, "utf-8");

      // Parse frontmatter
      let parsed;
      try {
        parsed = matter(raw);
      } catch (e) {
        logError(`articles/${locale}/${file}: Failed to parse frontmatter: ${e}`);
        continue;
      }

      const fm = parsed.data;

      // Validate against schema
      const result = ArticleFrontmatter.safeParse(fm);
      if (!result.success) {
        logError(`articles/${locale}/${file}: Frontmatter schema validation failed:`);
        for (const issue of result.error.issues) {
          logError(`  ${issue.path.join(".")}: ${issue.message}`);
        }
        continue;
      }

      // Check slug matches filename
      const expectedSlug = path.basename(file, ".mdx");
      if (result.data.slug !== expectedSlug) {
        logError(
          `articles/${locale}/${file}: Frontmatter slug "${result.data.slug}" ` +
            `does not match filename "${expectedSlug}"`
        );
        continue;
      }

      logOk(`articles/${locale}/${file} — valid`);
    }
  }
}

// ── Step 4: Cross-validate config ↔ articles ───────────

function crossValidate(config: z.infer<typeof SubjectConfig>): void {
  console.log("\n▸ Cross-validating config.json ↔ articles...");

  // Collect all article slugs from all locales
  const allArticleSlugs = new Set<string>();
  for (const locale of LOCALES) {
    const localeDir = path.join(ARTICLES_DIR, locale);
    if (!existsSync(localeDir)) continue;
    const files = listMdxFiles(localeDir);
    for (const file of files) {
      const slug = path.basename(file, ".mdx");
      if (slug !== "_front") {
        allArticleSlugs.add(slug);
      }
    }
  }

  // Check articles referenced in categories exist
  const referencedSlugs = new Set<string>();
  for (const cat of config.categories) {
    for (const articleSlug of cat.articles) {
      // Check for duplicates across categories
      if (referencedSlugs.has(articleSlug)) {
        logError(
          `Article "${articleSlug}" is listed in multiple categories. ` +
            `Each article should belong to only one category.`
        );
      }
      referencedSlugs.add(articleSlug);

      if (!allArticleSlugs.has(articleSlug)) {
        logError(
          `Category "${cat.slug}" references article "${articleSlug}" ` +
            `but no ${articleSlug}.mdx found in any locale`
        );
      } else {
        logOk(
          `Category "${cat.slug}" → "${articleSlug}" exists`
        );
      }
    }
  }

  // Warn about articles not referenced in any category
  for (const slug of allArticleSlugs) {
    if (!referencedSlugs.has(slug)) {
      logWarn(
        `Article "${slug}" exists as MDX file but is not listed in any category in config.json`
      );
    }
  }

  // Validate prerequisites reference valid articles
  console.log("\n▸ Validating article prerequisites...");
  for (const locale of LOCALES) {
    const localeDir = path.join(ARTICLES_DIR, locale);
    if (!existsSync(localeDir)) continue;

    const files = listMdxFiles(localeDir);
    for (const file of files) {
      const filePath = path.join(localeDir, file);
      const raw = readFileSync(filePath, "utf-8");
      const { data: fm } = matter(raw);

      if (fm.prerequisites && Array.isArray(fm.prerequisites)) {
        for (const prereq of fm.prerequisites) {
          if (!allArticleSlugs.has(prereq) && prereq !== "_front") {
            logWarn(
              `articles/${locale}/${file}: prerequisite "${prereq}" ` +
                `does not match any article in this subject`
            );
          }
        }
      }
    }
  }
}

// ── Main ───────────────────────────────────────────────

function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  WIKIPEFIA SUBJECT CONTENT VALIDATOR         ║");
  console.log("╚══════════════════════════════════════════════╝");

  // Step 1: Validate config
  const config = validateConfig();

  // Step 2: Validate structure
  validateStructure();

  // Step 3: Validate frontmatter
  validateFrontmatter();

  // Step 4: Cross-validate (only if config is valid)
  if (config) {
    crossValidate(config);
  }

  // Summary
  console.log("\n" + "─".repeat(48));
  if (errorCount > 0) {
    console.error(
      `\n✗ Validation FAILED: ${errorCount} error(s), ${warnCount} warning(s)\n`
    );
    process.exit(1);
  } else if (warnCount > 0) {
    console.log(
      `\n✓ Validation passed with ${warnCount} warning(s)\n`
    );
  } else {
    console.log("\n✓ Validation passed — all checks green!\n");
  }
}

main();
