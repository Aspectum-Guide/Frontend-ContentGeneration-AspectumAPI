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
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8443'

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
      sourcemap: true,
    },
  }
})
