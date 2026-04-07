import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const runExecFile = promisify(execFile)

function fetchLiveApiPlugin() {
  return {
    name: 'fetch-live-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'POST' || req.url !== '/api/fetch-live') return next()
        try {
          const { stdout, stderr } = await runExecFile('node', ['scripts/fetch-live-rankings.mjs'], {
            cwd: process.cwd(),
          })
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: true, stdout, stderr }))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(
            JSON.stringify({
              ok: false,
              message: err?.message || 'fetch-live failed',
              stdout: err?.stdout || '',
              stderr: err?.stderr || '',
            }),
          )
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), fetchLiveApiPlugin()],
  server: {
    host: true,
  },
})
