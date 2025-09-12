
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
      await runAxe(page, route);
    });
  }
});
