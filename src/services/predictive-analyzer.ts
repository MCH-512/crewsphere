// src/services/predictive-analyzer.ts
'use server';

import { ALERT_RULES, type AlertRule } from '@/lib/alert-rules';
import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';

const EmptySchema = z.object({});

// In a real scenario, you would import a Prisma or Firestore client.
// We simulate fetching historical data.

interface SimulatedAlertHistory {
  key: string;
  triggeredAt: Date;
  resolvedAt: Date | null;
}

// This function simulates fetching data from a database like Firestore or Prisma.
// It generates a more realistic, dynamic dataset than a hardcoded array.
async function getAlertHistory(): Promise<SimulatedAlertHistory[]> {
  console.log("...Simulating fetch of historical alert data...");
  
  const history: SimulatedAlertHistory[] = [];
  const now = new Date();
  
  // Helper to create a date `days` ago
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // --- Simulate PENDING_REQUESTS: A noisy, frequently triggered rule ---
  // Generate about 12-18 alerts over 90 days.
  for (let i = 0; i < 15; i++) {
    const triggerDay = Math.random() * 90; // Random day in the last 90 days
    const resolutionHours = 4 + Math.random() * 20; // Resolves between 4 and 24 hours
    const triggeredAt = daysAgo(triggerDay);
    history.push({
      key: 'PENDING_REQUESTS',
      triggeredAt: triggeredAt,
      resolvedAt: new Date(triggeredAt.getTime() + resolutionHours * 60 * 60 * 1000),
    });
  }

  // --- Simulate PENDING_DOC_VALIDATIONS: A less frequent rule ---
  // Generate about 2-5 alerts over 90 days.
  for (let i = 0; i < 3; i++) {
    const triggerDay = Math.random() * 90;
    const resolutionHours = 1 + Math.random() * 4; // Resolves quickly
    const triggeredAt = daysAgo(triggerDay);
    history.push({
      key: 'PENDING_DOC_VALIDATIONS',
      triggeredAt: triggeredAt,
      resolvedAt: new Date(triggeredAt.getTime() + resolutionHours * 60 * 60 * 1000),
    });
  }

  // --- Simulate FAILED_SWAPS: A rare or well-tuned rule ---
  // One old alert outside the recent analysis window.
  history.push({
    key: 'FAILED_SWAPS',
    triggeredAt: daysAgo(100),
    resolvedAt: daysAgo(99),
  });

  return history;
}


export async function generateOptimizedAlertRules() {
  EmptySchema.parse({}); // Zod validation
  console.log("🧠 Analyzing 90-day alert history to find optimization opportunities...");

  const alerts = await getAlertHistory();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const recentAlerts = alerts.filter(a => a.triggeredAt >= ninetyDaysAgo && a.resolvedAt);

  const ruleImprovements: { key: string; oldRule: Partial<AlertRule>; newRule: Partial<AlertRule>; reason: string }[] = [];

  for (const [key, currentRule] of Object.entries(ALERT_RULES)) {
    const relevantAlerts = recentAlerts.filter(a => a.key === key);
    if (relevantAlerts.length < 5) {
        console.log(`- Rule [${key}] has too few data points (${relevantAlerts.length}) in the last 90 days. Skipping.`);
        continue;
    };

    const avgResolutionTime = Math.round(
      relevantAlerts.reduce((sum, a) => sum + (a.resolvedAt!.getTime() - a.triggeredAt.getTime()), 0) / relevantAlerts.length
    ) / (1000 * 60 * 60); // in hours

    // Average number of alerts per week over the 90-day period (approx 12.8 weeks)
    const avgWeeklyFrequency = Math.ceil(relevantAlerts.length / 12.8);

    let newThreshold = currentRule.threshold;
    let newTimeoutHours = currentRule.timeoutHours;
    let reason = "";

    // --- AI-like Heuristic Logic ---
    // If alerts are very frequent, it might be too sensitive.
    if (avgWeeklyFrequency > 8) {
      newThreshold = Math.ceil(currentRule.threshold * 1.5); // Increase threshold by 50% to reduce noise
      reason = `High frequency (${avgWeeklyFrequency}/week). Suggesting increased threshold to reduce alert fatigue.`;
    
    // If alerts are somewhat frequent and take a long time to resolve, the threshold might be too high (detecting problems too late).
    } else if (avgWeeklyFrequency > 3 && avgResolutionTime > (currentRule.timeoutHours || 24) / 2) {
      newThreshold = Math.max(1, Math.floor(currentRule.threshold * 0.75)); // Lower threshold by 25% for earlier detection
      if(newTimeoutHours) newTimeoutHours = Math.max(1, Math.floor(newTimeoutHours * 0.75)); // Make it critical sooner
      reason = `Moderate frequency (${avgWeeklyFrequency}/week) and slow resolution (${avgResolutionTime.toFixed(1)}h). Suggesting earlier detection.`;

    // If alerts are rare and resolve very quickly, the threshold might be too low.
    } else if (avgWeeklyFrequency < 2 && avgResolutionTime < 1) {
      newThreshold = Math.ceil(currentRule.threshold * 1.2); // Increase threshold slightly
      reason = `Low frequency (${avgWeeklyFrequency}/week) and very fast resolution (${avgResolutionTime.toFixed(1)}h). Suggesting slightly reduced sensitivity.`;
    }

    if (newThreshold !== currentRule.threshold || newTimeoutHours !== currentRule.timeoutHours) {
      ruleImprovements.push({
        key,
        oldRule: { threshold: currentRule.threshold, timeoutHours: currentRule.timeoutHours },
        newRule: { threshold: newThreshold, timeoutHours: newTimeoutHours ? Math.round(newTimeoutHours) : undefined },
        reason,
      });
    } else {
        console.log(`- Rule [${key}] is performing optimally. No changes recommended.`);
    }
  }
  
  console.log(`✅ Analysis complete. Found ${ruleImprovements.length} potential improvement(s).`);

  if (ruleImprovements.length > 0) {
    const reportPath = path.join(process.cwd(), 'suggested-optimizations.json');
    const report = {
        generatedAt: new Date().toISOString(),
        summary: `${ruleImprovements.length} rule optimization(s) suggested based on 90-day performance analysis.`,
        optimizations: ruleImprovements
    };
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`💾 Suggestions written to ${reportPath}`);
  }

  return ruleImprovements;
}