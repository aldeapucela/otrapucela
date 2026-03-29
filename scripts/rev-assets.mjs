import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const distRoot = path.join(projectRoot, "dist");
const jsSourceRoot = path.join(projectRoot, "src", "assets", "js");
const jsOutputRoot = path.join(distRoot, "assets", "js");
const cssSourcePath = path.join(distRoot, "assets", "styles", "main.css");
const cssOutputRoot = path.join(distRoot, "assets", "styles");
const manifestPath = path.join(distRoot, "assets", "manifest.json");

function buildFingerprint(contents) {
  return createHash("sha256").update(contents).digest("hex").slice(0, 10);
}

async function ensureDirectory(directoryPath) {
  await mkdir(directoryPath, { recursive: true });
}

async function removeOldFingerprintedFiles(directoryPath, baseName) {
  const entries = await readdir(directoryPath, { withFileTypes: true });

  await Promise.all(entries.map(async (entry) => {
    if (!entry.isFile()) {
      return;
    }

    if (!entry.name.startsWith(`${baseName}.`)) {
      return;
    }

    await rm(path.join(directoryPath, entry.name));
  }));
}

async function revFile(sourcePath, outputDirectory, { baseName, extension }) {
  const contents = await readFile(sourcePath);
  const fingerprint = buildFingerprint(contents);
  const outputFileName = `${baseName}.${fingerprint}.${extension}`;
  const outputPath = path.join(outputDirectory, outputFileName);

  await ensureDirectory(outputDirectory);
  await removeOldFingerprintedFiles(outputDirectory, baseName);
  await writeFile(outputPath, contents);

  return outputFileName;
}

async function revJavaScriptFiles() {
  const manifestEntries = {};
  const entries = await readdir(jsSourceRoot, { withFileTypes: true });
  const sourceFiles = entries
    .filter((entry) => entry.isFile() && path.extname(entry.name) === ".js")
    .map((entry) => entry.name);
  const sourceContents = new Map();
  const fingerprintedNames = new Map();

  await ensureDirectory(jsOutputRoot);

  for (const fileName of sourceFiles) {
    const sourcePath = path.join(jsSourceRoot, fileName);
    const contents = await readFile(sourcePath, "utf8");
    const baseName = path.basename(fileName, ".js");
    const fingerprint = buildFingerprint(contents);
    const outputFileName = `${baseName}.${fingerprint}.js`;

    sourceContents.set(fileName, contents);
    fingerprintedNames.set(fileName, outputFileName);
  }

  for (const fileName of sourceFiles) {
    const baseName = path.basename(fileName, ".js");
    const outputFileName = fingerprintedNames.get(fileName);
    const sourceContentsValue = sourceContents.get(fileName) ?? "";
    const rewrittenContents = sourceContentsValue.replace(
      /from\s+("|')(\.\/[^"']+\.js)\1/g,
      (fullMatch, quote, importPath) => {
        const importedFileName = importPath.replace(/^\.\//, "");
        const rewrittenFileName = fingerprintedNames.get(importedFileName);

        if (!rewrittenFileName) {
          return fullMatch;
        }

        return `from ${quote}./${rewrittenFileName}${quote}`;
      }
    );

    await removeOldFingerprintedFiles(jsOutputRoot, baseName);
    await writeFile(path.join(jsOutputRoot, outputFileName), rewrittenContents);
    manifestEntries[`assets/js/${fileName}`] = `/assets/js/${outputFileName}`;
  }

  return manifestEntries;
}

async function revCssFile() {
  const outputFileName = await revFile(cssSourcePath, cssOutputRoot, {
    baseName: "main",
    extension: "css"
  });

  return {
    "assets/styles/main.css": `/assets/styles/${outputFileName}`
  };
}

async function main() {
  const cssManifest = await revCssFile();
  const jsManifest = await revJavaScriptFiles();
  const manifest = {
    ...cssManifest,
    ...jsManifest
  };

  await ensureDirectory(path.dirname(manifestPath));
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

await main();
