// Injecte le hash git court dans la version du cache du service worker.
// Appelé après next build — met à jour out/sw.js (pas public/sw.js).
// Résultat : chaque déploiement produit un SW différent → cache invalidé automatiquement.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const swPath = path.join(__dirname, "..", "out", "sw.js");

if (!fs.existsSync(swPath)) {
  console.error("stamp-sw: out/sw.js introuvable — build Next.js manquant ?");
  process.exit(1);
}

let hash;
try {
  hash = execSync("git rev-parse --short HEAD", { stdio: ["pipe", "pipe", "ignore"] })
    .toString()
    .trim();
} catch {
  hash = Date.now().toString(36);
}

const content = fs.readFileSync(swPath, "utf8");
const updated = content.replace(
  /const STATIC_CACHE = "cc-static-[^"]+";/,
  `const STATIC_CACHE = "cc-static-${hash}";`
);

if (updated === content) {
  console.warn("stamp-sw: pattern STATIC_CACHE non trouvé dans out/sw.js");
  process.exit(1);
}

fs.writeFileSync(swPath, updated);
console.log(`✓ SW cache → cc-static-${hash}`);
