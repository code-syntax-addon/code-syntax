import {spawnSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {fileURLToPath, pathToFileURL} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);
const PROJECTS = ["codemirror", "theme", "docs", "slides"];
const LIBRARIES = ["codemirror", "theme"];
const ADD_ONS = ["docs", "slides"];
const BUILD_DIRECTORY = ".clasp-build";
const DEPLOYABLE_EXTENSIONS = new Set([".gs", ".html", ".js", ".ts"]);
const DEPLOYABLE_FILES = new Set([
  ".clasp.json",
  ".claspignore",
  "appsscript.json",
  "tsconfig.json",
]);

function fail(message) {
  throw new Error(message);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || ROOT,
    encoding: "utf8",
    env: {...process.env, NO_COLOR: "1"},
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (options.capture) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
    fail(`${command} exited with status ${result.status}`);
  }
  return result;
}

function git(args, capture = true) {
  return run("git", args, {capture}).stdout.trim();
}

function splitProjects(value) {
  return value.split(/[\s,]+/).filter(Boolean);
}

function validateProjects(projects) {
  for (const project of projects) {
    if (!PROJECTS.includes(project)) {
      fail(`Unknown project '${project}'. Expected one of: ${PROJECTS.join(", ")}`);
    }
  }
  return PROJECTS.filter(project => projects.includes(project));
}

export function projectForPath(filePath) {
  const normalized = filePath.replaceAll("\\", "/").replace(/^\.\//, "");
  const [project, ...parts] = normalized.split("/");
  if (!PROJECTS.includes(project) || parts.length === 0) return null;
  const relative = parts.join("/");
  const basename = path.posix.basename(relative);
  if (DEPLOYABLE_FILES.has(basename)) return project;
  if (relative.endsWith(".d.ts")) return null;
  if (DEPLOYABLE_EXTENSIONS.has(path.posix.extname(relative))) return project;
  return null;
}

function changedFiles(since) {
  if (!since) fail("Specify a comparison ref with SINCE=<git-ref> or select PROJECTS explicitly.");
  const tracked = splitLines(git([
    "diff", "--name-only", "--diff-filter=ACDMRTUXB", since, "--",
  ]));
  const untracked = splitLines(git([
    "ls-files", "--others", "--exclude-standard",
  ]));
  return [...new Set([...tracked, ...untracked])];
}

function splitLines(value) {
  return value ? value.split("\n").filter(Boolean) : [];
}

export function projectsForPaths(paths) {
  const found = new Set(paths.map(projectForPath).filter(Boolean));
  return PROJECTS.filter(project => found.has(project));
}

export function releasePlan(changedProjects) {
  const direct = validateProjects(changedProjects);
  const release = new Set(direct);
  if (direct.some(project => LIBRARIES.includes(project))) {
    for (const addOn of ADD_ONS) release.add(addOn);
  }
  return PROJECTS.filter(project => release.has(project));
}

function parseArguments(argv) {
  const options = {
    all: false,
    allowDirty: false,
    deploy: false,
    description: process.env.DESCRIPTION || "",
    docsDeployment: process.env.DOCS_DEPLOYMENT_ID || "",
    projects: null,
    since: "",
    slidesDeployment: process.env.SLIDES_DEPLOYMENT_ID || "",
  };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--all") options.all = true;
    else if (argument === "--allow-dirty") options.allowDirty = true;
    else if (argument === "--deploy") options.deploy = true;
    else if (argument === "--description") options.description = argv[++index] || "";
    else if (argument === "--docs-deployment") options.docsDeployment = argv[++index] || "";
    else if (argument === "--projects") options.projects = splitProjects(argv[++index] || "");
    else if (argument === "--since") options.since = argv[++index] || "";
    else if (argument === "--slides-deployment") options.slidesDeployment = argv[++index] || "";
    else fail(`Unknown option '${argument}'`);
  }
  return options;
}

function selectedProjects(options) {
  if (options.all) return [...PROJECTS];
  if (options.projects !== null) return validateProjects(options.projects);
  return projectsForPaths(changedFiles(options.since));
}

function defaultDescription() {
  const shortCommit = git(["rev-parse", "--short", "HEAD"]);
  const subject = git(["log", "-1", "--format=%s"]);
  return `${shortCommit} ${subject}`;
}

async function walk(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    if (entry.name === "node_modules" || entry.name === BUILD_DIRECTORY) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(entryPath));
    else result.push(entryPath);
  }
  return result;
}

export async function buildProject(project) {
  const sourceDirectory = path.join(ROOT, project);
  const buildDirectory = path.join(sourceDirectory, BUILD_DIRECTORY);
  fs.rmSync(buildDirectory, {recursive: true, force: true});
  fs.mkdirSync(buildDirectory, {recursive: true});

  const projectConfig = JSON.parse(fs.readFileSync(
      path.join(sourceDirectory, ".clasp.json"), "utf8"));
  projectConfig.rootDir = ".";
  if (projectConfig.filePushOrder) {
    projectConfig.filePushOrder = projectConfig.filePushOrder.map(
        file => file.replace(/\.ts$/, ".js"));
  }
  fs.writeFileSync(
      path.join(buildDirectory, ".clasp.json"),
      `${JSON.stringify(projectConfig, null, 2)}\n`);
  fs.writeFileSync(
      path.join(buildDirectory, ".claspignore"),
      "**/**\n!appsscript.json\n!*.gs\n!*.html\n!*.js\n!**/*.gs\n!**/*.html\n!**/*.js\n");

  const sourceFiles = await walk(sourceDirectory);
  const outputs = new Set();
  let transpile = null;
  for (const sourcePath of sourceFiles) {
    const relativePath = path.relative(sourceDirectory, sourcePath);
    const basename = path.basename(relativePath);
    const extension = path.extname(relativePath);
    if (basename !== "appsscript.json" &&
        ![".gs", ".html", ".js", ".ts"].includes(extension)) {
      continue;
    }
    let outputPath = path.join(buildDirectory, relativePath);
    let contents = fs.readFileSync(sourcePath, "utf8");
    if (extension === ".ts") {
      if (!transpile) transpile = (await import("ts2gas")).default;
      outputPath = outputPath.slice(0, -3) + ".js";
      contents = transpile(contents);
    }
    if (outputs.has(outputPath)) {
      fail(`Multiple sources produce ${path.relative(ROOT, outputPath)}`);
    }
    outputs.add(outputPath);
    fs.mkdirSync(path.dirname(outputPath), {recursive: true});
    fs.writeFileSync(outputPath, contents);
  }
  console.log(`Built ${project}/${BUILD_DIRECTORY}`);
  return buildDirectory;
}

export function cleanProject(project) {
  fs.rmSync(path.join(ROOT, project, BUILD_DIRECTORY), {
    recursive: true,
    force: true,
  });
}

async function clasp(project, args, capture = false) {
  const buildDirectory = await buildProject(project);
  return run("npx", [
    "--no-install", "clasp",
    "--project", path.join(buildDirectory, ".clasp.json"),
    "--ignore", path.join(buildDirectory, ".claspignore"),
    ...args,
  ], {
    capture,
    cwd: buildDirectory,
  });
}

async function push(project) {
  console.log(`\n==> Pushing ${project}`);
  await clasp(project, ["push", "--force"]);
}

async function createVersion(project, description) {
  console.log(`\n==> Creating ${project} version`);
  const result = await clasp(project, ["version", description], true);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  const output = `${result.stdout}\n${result.stderr}`;
  const match = output.match(/Created version\s+(\d+)\./);
  if (!match) fail(`Could not determine the new ${project} version from clasp output.`);
  return Number(match[1]);
}

function updateLibraryReferences(library, version) {
  for (const addOn of ADD_ONS) {
    const manifestPath = path.join(ROOT, addOn, "appsscript.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const libraries = manifest.dependencies?.libraries || [];
    const dependency = libraries.find(entry => entry.userSymbol === library);
    if (!dependency) fail(`${addOn}/appsscript.json does not reference ${library}`);
    dependency.version = String(version);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Updated ${addOn}/appsscript.json: ${library} -> ${version}`);
  }
}

async function deploy(project, version, description, deploymentId) {
  console.log(`\n==> Updating ${project} deployment ${deploymentId}`);
  await clasp(project, [
    "deploy",
    "--versionNumber", String(version),
    "--description", description,
    "--deploymentId", deploymentId,
  ]);
}

function dirtyDeployableFiles() {
  const paths = new Set([
    ...splitLines(git(["diff", "--name-only"])),
    ...splitLines(git(["diff", "--cached", "--name-only"])),
    ...splitLines(git(["ls-files", "--others", "--exclude-standard"])),
  ]);
  return [...paths].filter(projectForPath).sort();
}

function ensureCleanRelease(options) {
  if (options.allowDirty) return;
  const dirty = dirtyDeployableFiles();
  if (dirty.length === 0) return;
  fail(
      "Release projects contain uncommitted files:\n" +
      dirty.map(file => `  ${file}`).join("\n") +
      "\nCommit them first, or intentionally use ALLOW_DIRTY=1.");
}

function printPlan(direct) {
  const plan = releasePlan(direct);
  console.log(`Changed projects: ${direct.length ? direct.join(" ") : "(none)"}`);
  console.log(`Release order: ${plan.length ? plan.join(" -> ") : "(nothing to release)"}`);
  const changedLibraries = direct.filter(project => LIBRARIES.includes(project));
  if (changedLibraries.length) {
    console.log(
        `Dependent add-ons will be released after ${changedLibraries.join(" and ")} ` +
        "versions are written to their manifests.");
  }
  return plan;
}

function validateDeployments(plan, options) {
  if (!options.deploy) return;
  if (plan.includes("docs") && !options.docsDeployment) {
    fail("DOCS_DEPLOYMENT_ID is required to update the Docs deployment.");
  }
  if (plan.includes("slides") && !options.slidesDeployment) {
    fail("SLIDES_DEPLOYMENT_ID is required to update the Slides deployment.");
  }
}

async function release(direct, options) {
  ensureCleanRelease(options);
  const plan = printPlan(direct);
  if (plan.length === 0) return;
  validateDeployments(plan, options);
  const description = options.description || defaultDescription();
  const versions = {};

  for (const library of LIBRARIES) {
    if (!plan.includes(library)) continue;
    await push(library);
    versions[library] = await createVersion(library, description);
    updateLibraryReferences(library, versions[library]);
  }

  for (const addOn of ADD_ONS) {
    if (!plan.includes(addOn)) continue;
    await push(addOn);
    versions[addOn] = await createVersion(addOn, description);
    if (options.deploy) {
      const deploymentId = addOn === "docs"
        ? options.docsDeployment
        : options.slidesDeployment;
      await deploy(addOn, versions[addOn], description, deploymentId);
    }
  }

  console.log("\nCreated Apps Script versions:");
  for (const project of plan) console.log(`  ${project}: ${versions[project]}`);
  if (plan.some(project => LIBRARIES.includes(project))) {
    console.log("\nThe add-on manifests were updated with the new library versions.");
    console.log("Review and commit docs/appsscript.json and slides/appsscript.json.");
  }
  if (!options.deploy && plan.some(project => ADD_ONS.includes(project))) {
    console.log("\nDeployments were not changed. Use make release-deploy with explicit IDs when needed.");
  }
}

function showUsage() {
  console.log(`Usage: node tools/apps-script.mjs <command> [options]

Commands:
  build      Transpile TypeScript and stage deployable files
  clean      Remove generated staging directories
  plan       Show directly changed projects and dependency-expanded release order
  push       Push selected projects without creating versions
  release    Push, version, update library references, and optionally deploy
  status     Run clasp status for selected projects
  versions   Run clasp versions for selected projects

Selection options:
  --since <git-ref>       Detect deployable changes since a Git ref
  --projects <list>       Select a comma- or space-separated project list
  --all                   Select all projects

Release options:
  --description <text>
  --allow-dirty
  --deploy
  --docs-deployment <id>
  --slides-deployment <id>`);
}

async function main(argv) {
  const [command, ...optionArguments] = argv;
  if (!command || command === "help" || command === "--help") {
    showUsage();
    return;
  }
  const options = parseArguments(optionArguments);
  const direct = selectedProjects(options);
  if (command === "build") {
    for (const project of direct) await buildProject(project);
  } else if (command === "clean") {
    for (const project of direct) cleanProject(project);
  } else if (command === "plan") {
    printPlan(direct);
  } else if (command === "push") {
    if (direct.length === 0) console.log("No changed Apps Script projects to push.");
    for (const project of direct) await push(project);
  } else if (command === "release") {
    await release(direct, options);
  } else if (command === "status" || command === "versions") {
    for (const project of direct) {
      console.log(`\n==> ${project}`);
      await clasp(project, [command]);
    }
  } else {
    fail(`Unknown command '${command}'`);
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  try {
    await main(process.argv.slice(2));
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  }
}
