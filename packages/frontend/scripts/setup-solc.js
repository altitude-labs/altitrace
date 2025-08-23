#!/usr/bin/env node

/**
 * Setup script to preinstall Solidity compiler versions
 * This downloads soljson files for 0.7.x versions to enable offline compilation
 */

const fs = require('node:fs')
const path = require('node:path')
const https = require('node:https')

// Directory to store cached compiler binaries
const SOLC_CACHE_DIR = path.join(__dirname, '..', 'solc-cache')

// Versions to preinstall
const VERSIONS_TO_PREINSTALL = [
  {
    version: '0.7.6',
    filename: 'soljson-v0.7.6+commit.7338295f.js',
    url: 'https://binaries.soliditylang.org/bin/soljson-v0.7.6+commit.7338295f.js',
  },
  {
    version: '0.7.5',
    filename: 'soljson-v0.7.5+commit.eb77ed65.js',
    url: 'https://binaries.soliditylang.org/bin/soljson-v0.7.5+commit.eb77ed65.js',
  },
  {
    version: '0.7.4',
    filename: 'soljson-v0.7.4+commit.3f05b770.js',
    url: 'https://binaries.soliditylang.org/bin/soljson-v0.7.4+commit.3f05b770.js',
  },
]

/**
 * Download a file from URL to local path
 */
function downloadFile(url, localPath) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading ${path.basename(url)}...`)

    const file = fs.createWriteStream(localPath)

    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(
            new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`),
          )
          return
        }

        response.pipe(file)

        file.on('finish', () => {
          file.close()
          console.log(`✅ Downloaded ${path.basename(localPath)}`)
          resolve()
        })

        file.on('error', (err) => {
          fs.unlink(localPath, () => {}) // Delete incomplete file
          reject(err)
        })
      })
      .on('error', reject)
  })
}

/**
 * Main setup function
 */
async function setup() {
  console.log('🚀 Setting up Solidity compiler cache...')

  // Create cache directory if it doesn't exist
  if (!fs.existsSync(SOLC_CACHE_DIR)) {
    fs.mkdirSync(SOLC_CACHE_DIR, { recursive: true })
    console.log(`📁 Created cache directory: ${SOLC_CACHE_DIR}`)
  }

  // Download each version
  const downloadPromises = VERSIONS_TO_PREINSTALL.map(async (versionInfo) => {
    const localPath = path.join(SOLC_CACHE_DIR, versionInfo.filename)

    // Skip if already exists
    if (fs.existsSync(localPath)) {
      console.log(`⏭️  Skipping ${versionInfo.version} (already exists)`)
      return
    }

    try {
      await downloadFile(versionInfo.url, localPath)
    } catch (_error) {}
  })

  await Promise.all(downloadPromises)

  // Create manifest file
  const manifest = {
    cachedVersions: VERSIONS_TO_PREINSTALL.reduce((acc, v) => {
      const localPath = path.join(SOLC_CACHE_DIR, v.filename)
      if (fs.existsSync(localPath)) {
        acc[v.version] = {
          filename: v.filename,
          path: localPath,
          url: v.url,
          cachedAt: new Date().toISOString(),
        }
      }
      return acc
    }, {}),
    setupAt: new Date().toISOString(),
  }

  const manifestPath = path.join(SOLC_CACHE_DIR, 'manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  const cachedCount = Object.keys(manifest.cachedVersions).length
  console.log(
    `🎉 Setup complete! Cached ${cachedCount}/${VERSIONS_TO_PREINSTALL.length} compiler versions`,
  )

  if (cachedCount > 0) {
    console.log(
      '📦 Cached versions:',
      Object.keys(manifest.cachedVersions).join(', '),
    )
  }
}

// Run setup if called directly
if (require.main === module) {
  setup().catch((_error) => {
    process.exit(1)
  })
}

module.exports = { setup, SOLC_CACHE_DIR }
