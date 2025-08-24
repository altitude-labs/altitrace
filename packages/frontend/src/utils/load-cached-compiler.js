const fs = require('node:fs')
const path = require('node:path')

/**
 * Load a cached 0.7.6 compiler directly
 */
function loadCached076Compiler() {
  try {
    const cachePath = path.join(
      process.cwd(),
      'solc-cache',
      'soljson-v0.7.6+commit.7338295f.js',
    )

    if (!fs.existsSync(cachePath)) {
      return null
    }

    const stats = fs.statSync(cachePath)

    if (stats.size === 0) {
      return null
    }

    const soljsonContent = fs.readFileSync(cachePath, 'utf8')

    const wrapper = require('solc/wrapper')
    const vm = require('node:vm')

    const sandbox = { Module: {} }
    vm.createContext(sandbox)

    vm.runInContext(soljsonContent, sandbox)

    const compiler = wrapper(sandbox.Module)

    return compiler
  } catch (_error) {
    return null
  }
}

module.exports = { loadCached076Compiler }
