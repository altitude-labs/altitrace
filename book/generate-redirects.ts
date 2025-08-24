#!/usr/bin/env bun
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { basePath, redirects } from './redirects.config'

function generateRedirectHtml(targetPath: string): string {
    return `<!DOCTYPE html>
  <html>
  <head>
      <meta charset="utf-8">
      <title>Redirecting...</title>
      <meta http-equiv="refresh" content="0; URL=${targetPath}">
      <link rel="canonical" href="${targetPath}">
  </head>
  <body>
      <script>
          window.location.href = "${targetPath}";
      </script>
      <p>Altitrace documentation has been migrated to new docs. If you are not redirected please <a href="${targetPath}">click here</a>.</p>
  </body>
  </html>`
  }

Object.entries(redirects).forEach(([from, to]) => {
  const fromPath = from.replace(/^\//, '')
  
  const paths = [fromPath]
  if (!fromPath.endsWith('.html')) {
    paths.push(`${fromPath}.html`)
  }
  
  paths.forEach(path => {
    const filePath = join('./docs/dist', path)
    
    if (!path.includes('.')) {
      const indexPath = join('./docs/dist', path, 'index.html')
      mkdirSync(dirname(indexPath), { recursive: true })
      writeFileSync(indexPath, generateRedirectHtml(to))
    } else {
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, generateRedirectHtml(to))
    }
  })
})

console.log('✅ Redirect files generated successfully!')