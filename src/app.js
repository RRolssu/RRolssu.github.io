const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser'); // bodyParser 불러오기
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') }); // .env 파일 경로 명시

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public'))); // Serve static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads'))); 

// Routes
const customerRoutes = require('./routes/customers');
const projectRoutes = require('./routes/projects');
const complaintRoutes = require('./routes/complaints');
const receptionRoutes = require('./routes/receptions');
//  추가: 구성원 및 인증 라우트 
const employeeRoutes = require('./routes/employees');
const authRoutes = require('./routes/auth');
//  추가: 품질문서 라우트 
const qualityDocsRoutes = require('./routes/quality-docs');
const orderBookRoutes = require('./routes/order-book');

app.use('/api/receptions', receptionRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/complaints', complaintRoutes);
//  추가: 구성원 및 인증 API 등록 
app.use('/api/employees', employeeRoutes);
app.use('/api/auth', authRoutes);
//  추가: 품질문서 API 등록 
app.use('/api/quality-docs', qualityDocsRoutes);
app.use('/api/order-book', orderBookRoutes);
// Base route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

app.get('/projects', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/projects.html'));
});

app.get('/complaints', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/complaints.html'));
});

app.get('/customers', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/customers.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.get('/order-book', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/수주대장.html'));
});

app.get('/reception', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/접수.html'));
});

app.get('/quality-docs', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/품질문서.html'));
});

app.get('/measurement-tools', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/측정기관리.html'));
});

app.get('/management', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/경영관리.html'));
});
app.get('/change-management', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/변경관리.html'));
});
// 프로젝트 디테일 페이지 (쿼리 파라미터 포함)
app.get('/project_detail', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/project_detail.html'));
});

app.get('/complaint_detail', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/complaint_detail.html'));
});

app.get('/reception_detail', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/reception_detail.html'));
});

//  추가: 에러 핸들링 미들웨어 (항상 JSON 반환) 
app.use((err, req, res, next) => {
  console.error('서버 에러:', err);
  console.error('에러 스택:', err.stack);
  
  // 이미 응답이 전송되었는지 확인
  if (res.headersSent) {
    return next(err);
  }
  
  // JSON 형태로 에러 반환
  res.status(err.status || 500).json({
    error: err.message || '서버 오류가 발생했습니다.',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({ error: '요청한 리소스를 찾을 수 없습니다.' });
});

// Start server
const initDB = require('./config/init_db');
const serverPort = process.env.PORT || 3000;
initDB().then(() => {
  app.listen(serverPort, '0.0.0.0', () => {
    console.log(`Server is running on port ${serverPort}`);
    console.log(`Server accessible at http://0.0.0.0:${serverPort}`);
});
});

