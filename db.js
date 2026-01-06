const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: false,
});

async function waitForDB() {
  while (true) {
    try {
      await pool.query('SELECT 1');
      console.log('✅ Database connected');
      break;
    } catch (err) {
      console.error('⏳ Database not ready, retrying in 5s...');
      await new Promise(res => setTimeout(res, 5000));
    }
  }
}

module.exports = { pool, waitForDB };
