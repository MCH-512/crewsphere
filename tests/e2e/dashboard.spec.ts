
import { test, expect } from '@playwright/test';

test.describe('Dashboard and Core Features E2E', () => {

  test.beforeEach(async ({ page }) => {
    // Mock user session or log in before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@crewsphere.app');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
  });

  test('Admin dashboard shows real-time stats and weekly trends', async ({ page }) => {
    await page.goto('/admin');

    await expect(page.getByText('Admin Dashboard')).toBeVisible();

    // Check for stat cards
    await expect(page.getByText('Flight Management')).toBeVisible();
    await expect(page.getByText('User Requests')).toBeVisible();

    // Check for the weekly trends chart
    await expect(page.getByText('Weekly Activity Trends')).toBeVisible();
    // Verify the chart canvas is rendered
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('Crew member can navigate to their schedule and see activities', async ({ page }) => {
    await page.goto('/my-schedule');
    await expect(page.getByText('My Schedule')).toBeVisible();

    // Assuming there's an activity on the calendar
    const today = new Date();
    const day = today.getDate();
    
    // Click on today's date in the calendar
    await page.getByRole('gridcell', { name: String(day), exact: true }).click();
    
    // Check if the activity details appear
    await expect(page.getByText('No activities scheduled for this day.')).not.toBeVisible();
  });

  test('User can access the toolbox and open a tool', async ({ page }) => {
    await page.goto('/toolbox');
    await expect(page.getByText('Toolbox')).toBeVisible();
    
    // Click on the FTL Calculator
    await page.getByRole('link', { name: 'EASA FTL Calculator' }).click();
    
    await expect(page).toHaveURL('/toolbox/ftl-calculator');
    await expect(page.getByText('EASA FTL Calculator')).toBeVisible();
  });

});
