const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); //  추가: JWT 모듈 
const axios = require('axios'); //  추가: axios 모듈 (Django API 호출용) 

// 통합 로그인 (Django 세션 생성 포함)
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: '이메일과 비밀번호를 입력하세요.' });
        }
        
        // 사용자 조회
        const [rows] = await pool.query(
            'SELECT * FROM employees WHERE email = ? AND is_active = TRUE',
            [email]
        );
        
        if (rows.length === 0) {
            return res.status(401).json({ error: '이메일 또는 비밀번호가 일치하지 않습니다.' });
        }
        
        const user = rows[0];
        
        // 비밀번호 확인
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: '이메일 또는 비밀번호가 일치하지 않습니다.' });
        }
        
        //  추가: Django 세션 생성 (Django API 호출) 
        let djangoSessionKey = null;
        try {
            const djangoResponse = await axios.post(
                `${process.env.DJANGO_API_URL || 'http://localhost:8000'}/api/auth/create-session/`,
                { email, password },
                { 
                    timeout: 5000,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            if (djangoResponse.data && djangoResponse.data.session_key) {
                djangoSessionKey = djangoResponse.data.session_key;
            }
        } catch (err) {
            console.error('Django 세션 생성 실패:', err.message);
            // Django 세션 생성 실패해도 계속 진행 (Complain만 사용 가능)
        }
        
        //  추가: JWT 토큰 생성 (Complain 시스템용) 
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                name: user.name
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );
        
        // 로그인 성공 - 사용자 정보 반환 (비밀번호 제외)
        const userInfo = {
            id: user.id,
            email: user.email,
            name: user.name,
            position: user.position,
            department: user.department,
            is_admin: user.is_admin,
            is_superadmin: user.is_superadmin
        };
        
        res.json({ 
            success: true, 
            message: '로그인 성공',
            user: userInfo,
            token: token, //  추가: JWT 토큰 (Complain 시스템용) 
            djangoSession: djangoSessionKey //  추가: Django 세션 키 
        });
        
    } catch (err) {
        console.error('로그인 실패:', err);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 로그아웃 (클라이언트에서 세션/localStorage 삭제하면 됨)
router.post('/logout', (req, res) => {
    res.json({ success: true, message: '로그아웃 성공' });
});

// 현재 사용자 정보 조회 (세션 확인용)
router.get('/me', async (req, res) => {
    try {
        //  변경: JWT 토큰 검증 방식으로 변경 
        const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
        
        if (!token) {
            return res.status(401).json({ error: '로그인이 필요합니다.' });
        }
        
        // JWT 토큰 검증
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        const [rows] = await pool.query(
            'SELECT id, email, name, position, department, is_admin, is_superadmin FROM employees WHERE id = ? AND is_active = TRUE',
            [decoded.id]
        );
        
        if (rows.length === 0) {
            return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
        }
        
        res.json(rows[0]);
    } catch (err) {
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: '인증 토큰이 유효하지 않습니다.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// 초기 비밀번호 해시 생성 (개발용)
router.get('/hash/:password', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.params.password, 10);
        res.json({ hash: hashedPassword });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;