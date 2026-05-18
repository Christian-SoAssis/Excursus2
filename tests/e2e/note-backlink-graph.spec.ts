import { test, expect } from '@playwright/test'

// Full E2E requires a compiled Tauri debug binary at src-tauri/target/debug/excursus2
// Build with: npm run tauri build -- --debug
test.describe('note backlink creates graph edge', () => {
  test.skip(true, 'requires built Tauri binary — run: npm run tauri build -- --debug')

  test('backlink inserted via [[ picker appears as graph edge', async ({ page }) => {
    // 1. Navigate to app (Tauri loads at tauri://localhost)
    await page.goto('tauri://localhost')

    // 2. Create first note
    await page.getByTestId('new-note-btn').click()
    await page.getByPlaceholder('Título').fill('Note A')
    await page.keyboard.press('Enter')

    // 3. Create second note
    await page.getByTestId('new-note-btn').click()
    await page.getByPlaceholder('Título').fill('Note B')

    // 4. Open Note A in editor
    await page.getByText('Note A').click()

    // 5. Type [[ to trigger backlink picker
    const editor = page.locator('.ProseMirror')
    await editor.click()
    await editor.type('[[')

    // 6. Wait for picker to appear and pick Note B
    await page.waitForSelector('[data-testid="backlink-picker"]')
    await page.getByText('Note B').click()

    // 7. Wait for debounced save (800ms + buffer)
    await page.waitForTimeout(1200)

    // 8. Switch to Graph mode
    await page.getByTestId('mode-graph').click()

    // 9. Verify an SVG edge line exists
    await expect(page.locator('svg line')).toBeVisible()
  })
})
