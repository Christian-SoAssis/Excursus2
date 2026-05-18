import { defineConfig } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  use: {
    launchOptions: {
      // Electron app path — built with --debug flag
      executablePath: path.join(
        __dirname,
        'src-tauri/target/debug/excursus2'
      ),
    },
  },
})
