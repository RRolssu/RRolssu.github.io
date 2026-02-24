const mysql = require('mysql2');
const path = require('path');
// .env 파일의 위치를 명시적으로 지정 (프로젝트 루트)
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true // DATE 타입을 문자열로 반환
});

const promisePool = pool.promise();

// 연결 테스트
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Successfully connected to MySQL database');
    connection.release();
  }
});

module.exports = promisePool;



