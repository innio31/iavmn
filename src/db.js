// src/db.js
// MySQL connection pool. All models import this and use parameterized queries.

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: 'Z',
});

/**
 * Run a query with parameterized values.
 * @param {string} sql     SQL with ? placeholders
 * @param {Array}  params
 * @returns {Promise<Array>} rows
 */
export const query = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

/**
 * Run a callback inside a transaction.
 * Auto-commits on success, rolls back on error.
 * @param {(conn: import('mysql2/promise').PoolConnection) => Promise<any>} callback
 */
export const withTransaction = async (callback) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

export default pool;