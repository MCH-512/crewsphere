// src/services/predictive-analyzer.ts
'use server';

import { ALERT_RULES, type AlertRule } from '@/lib/alert-rules';
// In a real scenario, you would import a Prisma or Firestore client.
// We simulate fetching historical data.

interface SimulatedAlertHistory {
  key: string;
  triggeredAt: Date;
  resolvedAt: Date | null;
}

// Simulate fetching data from a database like Firestore or Prisma
async function getAlertHistory(): Promise<SimulatedAlertHistory[]> {
  // This is mock data. In a real app, this would be a database query.
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return [
    // Simulate a noisy rule: many alerts, slow resolution
    ...Array.from({ length: 15 }, (_, i) => ({
      key: 'PENDING_REQUESTS',
      triggeredAt: daysAgo(i * 5),
      resolvedAt: new Date(daysAgo(i * 5).getTime() + 8 * 60 * 60 * 1000), // 8-hour resolution
    })),
    // Simulate a quiet rule
    ...Array.from({ length: 2 }, (_, i) => ({
      key: 'PENDING_DOC_VALIDATIONS',
      triggeredAt: daysAgo(i * 30),
      resolvedAt: new Date(daysAgo(i * 30).getTime() + 1 * 60 * 60 * 1000), // 1-hour resolution
    })),
     // Simulate a rule with no recent data
    {
      key: 'FAILED_SWAPS',
      triggeredAt: daysAgo(100),
      resolvedAt: daysAgo(99),
    }
  ];
}


export async function generateOptimizedAlertRules() {
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

    // Average number of alerts per week over the 90-day period (approx 12 weeks)
    const avgWeeklyFrequency = Math.ceil(relevantAlerts.length / 12);

    let newThreshold = currentRule.threshold;
    let newTimeoutHours = currentRule.timeoutHours;
    let reason = "";

    // If alerts are too frequent AND take a long time to resolve, the threshold might be too high (detects problem too late)
    if (avgWeeklyFrequency > 5 && avgResolutionTime > 6) {
      newThreshold = Math.max(1, Math.floor(currentRule.threshold * 0.8)); // Lower threshold to detect earlier
      if(newTimeoutHours) newTimeoutHours = Math.max(1, Math.floor(newTimeoutHours / 2)); // Make it critical sooner
      reason = `High frequency (${avgWeeklyFrequency}/week) and slow resolution (${avgResolutionTime.toFixed(1)}h). Suggesting earlier detection.`;
    }
    // If alerts are rare and resolve quickly, the threshold might be too low (too sensitive)
    else if (avgWeeklyFrequency < 2 && avgResolutionTime < 1) {
      newThreshold = Math.ceil(currentRule.threshold * 1.2); // Increase threshold to reduce noise
      reason = `Low frequency (${avgWeeklyFrequency}/week) and fast resolution (${avgResolutionTime.toFixed(1)}h). Suggesting reduced sensitivity.`;
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
  return ruleImprovements;
}
