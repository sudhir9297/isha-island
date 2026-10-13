import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

function saveSceneCapture() {
  return {
    name: 'save-local-scene-capture',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/__capture') return next()
        if (req.method !== 'POST' || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) {
          res.writeHead(403); res.end(); return
        }
        if (!req.headers['content-type']?.startsWith('video/webm')) {
          res.writeHead(415); res.end(); return
        }
        const chunks = []; let bytes = 0, rejected = false
        req.on('data', chunk => {
          bytes += chunk.length
          if (bytes > 40 * 1024 * 1024) {
            if (!rejected) { rejected = true; res.writeHead(413); res.end() }
          } else if (!rejected) chunks.push(chunk)
        })
        req.on('end', async () => {
          if (rejected) return
          try {
            const folder = resolve(server.config.root, '_ref')
            const filename = `native-scene-${Date.now()}.webm`
            await mkdir(folder, { recursive: true })
            await writeFile(resolve(folder, filename), Buffer.concat(chunks))
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ filename, bytes }))
          } catch {
            res.writeHead(500); res.end('Could not save capture')
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), saveSceneCapture()],
  server: { forwardConsole: false },
})
