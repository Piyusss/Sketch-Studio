'use strict';

// Push schema.sql to NeonDB — no psql needed.
// Usage (from project root): npm run db:push

const path = require('path');
const fs   = require('fs');

// Load env from project root .env
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
if (!url || url.startsWith('PASTE')) {
  console.error('ERROR: DATABASE_URL is not set in .env');
  process.exit(1);
}

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('Connecting to NeonDB…');
    await client.query(schema);
    console.log('✓ Schema pushed successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Schema push failed:', err.message);
  process.exit(1);
});
