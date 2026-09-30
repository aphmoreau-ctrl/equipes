/**
 * Genere les icones PNG de l'application a partir de « outils/icone-source.svg ».
 *
 * A relancer uniquement si le dessin de l'icone change :
 *     npm run icones
 *
 * Les PNG produits sont versionnes dans le depot : la construction du site
 * n'a donc pas besoin de « sharp », qui reste un outil de developpement.
 */
import { readFile, writeFile, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const racine = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(racine, 'outils', 'icone-source.svg')
const destination = join(racine, 'public')

const aProduire = [
  { fichier: 'icone-192.png', taille: 192, usage: 'Android / navigateurs' },
  { fichier: 'icone-512.png', taille: 512, usage: 'Android, ecran de demarrage' },
  { fichier: 'apple-touch-icon.png', taille: 180, usage: 'ecran d accueil iPhone / iPad' },
  { fichier: 'favicon-32.png', taille: 32, usage: 'onglet du navigateur' },
]

const svg = await readFile(source)

for (const { fichier, taille, usage } of aProduire) {
  const png = await sharp(svg, { density: 600 })
    .resize(taille, taille, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toBuffer()
  await writeFile(join(destination, fichier), png)
  console.log(`  ${fichier.padEnd(22)} ${String(taille).padStart(3)} px   ${usage}`)
}

// Le SVG sert aussi de favicon : il reste net a n'importe quelle taille.
await copyFile(source, join(destination, 'favicon.svg'))
console.log(`  ${'favicon.svg'.padEnd(22)} vectoriel   onglet du navigateur`)
console.log('\nIcones generees dans public/.')
