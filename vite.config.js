import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'child_process'

function getGitCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

function getGitDate() {
  try {
    return execSync('git log -1 --format=%ci', { encoding: 'utf-8' }).trim().slice(0, 10)
  } catch {
    return 'unknown'
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8443'

  // .env.local (VITE_API_URL pointed at dev2/dev for local hot-reload) is
  // meant for `npm run dev` only, but Vite loads it for `vite build` too —
  // it has bitten a production deploy on dev3 twice in one session (the
  // baked-in absolute URL breaks CORS on every host but the one it names).
  // Fail loudly instead of shipping it a third time.
  if (command === 'build' && mode === 'production' && env.VITE_API_URL) {
    throw new Error(
      `VITE_API_URL is set to "${env.VITE_API_URL}" for a production build — ` +
      'this gets baked into the bundle and breaks every deploy target except ' +
      'the one it names (CORS). Unset it (rename .env.local aside) before ' +
      'building for deploy; the app already falls back to a same-origin ' +
      "relative '/api/v1' when it's unset, which is what every host's Caddy " +
      'proxy expects.'
    )
  }

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(getGitCommit()),
      __APP_BUILD_DATE__: JSON.stringify(getGitDate()),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 17000,
      allowedHosts: ['admin.dev.aspectum-guide.com', 'admin.dev2.aspectum-guide.com'],
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: 'dist',
      // 'hidden': maps are generated but the bundle carries no sourceMappingURL,
      // so browsers/devtools never auto-fetch them in prod (they're still on
      // disk for local upload to an error tracker, and nginx denies *.map too).
      sourcemap: mode === 'production' ? 'hidden' : true,
    },
    test: {
      environment: 'jsdom',
      globals: true,
    },
  }
})
