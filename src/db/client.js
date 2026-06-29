require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error:', err);
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('DB query executed', { text: text.slice(0, 80), duration, rows: res.rowCount });
  return res;
}

async function getClient() {
  return pool.connect();
}

async function writeJobResult(bullId, queueName, status, result, error) {
  const text = `
    INSERT INTO jobs (bull_id, queue_name, type, payload, status, result, error)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (bull_id) DO UPDATE
      SET status = EXCLUDED.status,
          result = EXCLUDED.result,
          error = EXCLUDED.error,
          updated_at = NOW()
    RETURNING id
  `;
  try {
    await pool.query(text, [bullId, queueName, queueName, '{}', status, result ? JSON.stringify(result) : null, error || null]);
  } catch (err) {
    console.error('Failed to write job result to DB:', err.message);
  }
}

async function insertJob(bullId, queueName, type, payload) {
  const text = `
    INSERT INTO jobs (bull_id, queue_name, type, payload, status)
    VALUES ($1, $2, $3, $4, 'queued')
    ON CONFLICT DO NOTHING
    RETURNING id
  `;
  try {
    const res = await pool.query(text, [bullId, queueName, type, JSON.stringify(payload)]);
    return res.rows[0];
  } catch (err) {
    console.error('Failed to insert job into DB:', err.message);
  }
}

async function appendJobLog(bullId, level, message, metadata) {
  const text = `
    INSERT INTO job_logs (job_id, level, message, metadata)
    SELECT id, $2, $3, $4 FROM jobs WHERE bull_id = $1
  `;
  try {
    await pool.query(text, [bullId, level, message, metadata ? JSON.stringify(metadata) : null]);
  } catch (err) {
    console.error('Failed to append job log:', err.message);
  }
}

module.exports = { query, getClient, pool, writeJobResult, insertJob, appendJobLog };
