
// collector_bigquery.js
const { BigQuery } = require('@google-cloud/bigquery');

class Collector {
  constructor(config) {
    this.config = config;
    this.bq = new BigQuery({ projectId: config.projectId });
    this.lastTimestamp = null; // simple cursor; persist in production
  }

  async fetchRecentErrors() {
    // Query BigQuery for recent high-severity events
    const dataset = this.config.bigQuery.dataset;
    const table = this.config.bigQuery.table;
    // only fetch events after lastTimestamp
    const tsCondition = this.lastTimestamp ? `AND timestamp > TIMESTAMP('${this.lastTimestamp}')` : '';
    const sql = `
      SELECT timestamp, service, severity, message, metadata, signature
      FROM \`${this.config.projectId}.${dataset}.${table}\`
      WHERE severity IN ('ERROR','CRITICAL') ${tsCondition}
      ORDER BY timestamp DESC
      LIMIT 10
    `;
    const [rows] = await this.bq.query({ query: sql, location: 'US' });
    if (rows.length) {
      this.lastTimestamp = rows[0].timestamp;
    }
    // Map rows into event objects
    return rows.map(r => ({
      timestamp: r.timestamp,
      service: r.service,
      severity: r.severity,
      message: r.message,
      metadata: r.metadata || {},
      signature: r.signature || (r.service + '::' + (r.message||'').slice(0,120))
    }));
  }
}

module.exports = Collector;
