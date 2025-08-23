const fs = require('node:fs')
const path = require('node:path')

/**
 * Load a cached 0.7.6 compiler directly
 */
function loadCached076Compiler() {
  try {
    console.log('🔧 loadCached076Compiler called')

    const cachePath = path.join(
      process.cwd(),
      'solc-cache',
      'soljson-v0.7.6+commit.7338295f.js',
    )
    console.log('📂 Looking for cached compiler at:', cachePath)

    if (!fs.existsSync(cachePath)) {
      console.log('❌ Cached compiler file not found')
      return null
    }

    const stats = fs.statSync(cachePath)
    console.log('📦 Cached compiler file size:', stats.size, 'bytes')

    if (stats.size === 0) {
      console.log('❌ Cached compiler file is empty')
      return null
    }

    console.log('📥 Reading cached compiler content...')
    const soljsonContent = fs.readFileSync(cachePath, 'utf8')

    console.log('🔧 Creating sandbox for cached compiler...')
    const wrapper = require('solc/wrapper')
    const vm = require('node:vm')

    const sandbox = { Module: {} }
    vm.createContext(sandbox)

    console.log('🔧 Executing cached soljson...')
    vm.runInContext(soljsonContent, sandbox)

    console.log('🔧 Wrapping cached compiler...')
    const compiler = wrapper(sandbox.Module)

    console.log('✅ Successfully loaded cached 0.7.6 compiler!')
    console.log('📋 Cached compiler version:', compiler.version())

    return compiler
  } catch (_error) {
    return null
  }
}

module.exports = { loadCached076Compiler }
