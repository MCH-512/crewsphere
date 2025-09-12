import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const testRoutes = ['/', '/admin', '/my-schedule', '/toolbox', '/training'];

async function runAxe(page: Page, route: string) {
  await page.goto(route);
  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  expect(accessibilityScanResults.violations).toEqual([]);
}

test.describe('Accessibility Tests (WCAG 2.1 AA)', () => {
  for (const route of testRoutes) {
    test(`Page ${route} should have no detectable accessibility violations`, async ({ page }) => {
      // Login before running accessibility tests on protected routes
      if (route !== '/login' && route !== '/signup') {
        await page.goto('/login');
        await page.fill('input[name="email"]', 'admin@crewsphere.app');
        await page.fill('input[name="password"]', 'password123');
        await page.click('button[type="submit"]');
        await page.waitForURL('**/');
      }
      await runAxe(page, route);
    });
  }
});
