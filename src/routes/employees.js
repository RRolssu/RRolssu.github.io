// ★★★★ 신규 파일: 회사 구성원 API 라우트 ★★★★
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcrypt');

// 구성원 목록 조회
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT id, email, name, position, department, phone, is_active, is_admin, is_superadmin, created_at
            FROM employees 
            ORDER BY 
                CASE position 
                    WHEN '대표이사' THEN 1
                    WHEN '전무' THEN 2
                    WHEN '이사' THEN 3
                    WHEN '실장' THEN 4
                    WHEN '부장' THEN 5
                    WHEN '차장' THEN 6
                    WHEN '과장' THEN 7
                    WHEN '대리' THEN 8
                    WHEN '주임' THEN 9
                    WHEN '사원' THEN 10
                    ELSE 11
                END,
                department,
                name
        `);
        res.json(rows);
    } catch (err) {
        console.error('구성원 목록 조회 실패:', err);
        res.status(500).json({ error: err.message });
    }
});

// 구성원 상세 조회
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, email, name, position, department, is_active, is_admin, is_superadmin, created_at FROM employees WHERE id = ?', 
            [req.params.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: '구성원을 찾을 수 없습니다.' });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 신규 구성원 등록
router.post('/', async (req, res) => {
    try {
        const { email, password, name, position, department, phone, is_active, is_admin, is_superadmin } = req.body;
        
        // 비밀번호 해시 (기본값: 1234)
        const hashedPassword = await bcrypt.hash(password || '1234', 10);
        
        const [result] = await pool.query(`
            INSERT INTO employees 
            (email, password, name, position, department, phone, is_active, is_admin, is_superadmin)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            email, 
            hashedPassword, 
            name, 
            position || null, 
            department || null, 
            phone || null,
            is_active !== false, 
            is_admin === true || is_admin === 'true', 
            is_superadmin === true || is_superadmin === 'true'
        ]);
        
        res.json({ id: result.insertId, message: '구성원이 등록되었습니다.' });
    } catch (err) {
        console.error('구성원 등록 실패:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: '이미 등록된 이메일입니다.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// 구성원 정보 수정
router.put('/:id', async (req, res) => {
    try {
        const { email, name, position, department, phone, is_active, is_admin, is_superadmin } = req.body;
        
        await pool.query(`
            UPDATE employees 
            SET email = ?, name = ?, position = ?, department = ?, 
                phone = ?, is_active = ?, is_admin = ?, is_superadmin = ?
            WHERE id = ?
        `, [
            email, 
            name, 
            position || null, 
            department || null, 
            phone || null,
            is_active !== false && is_active !== 'false',
            is_admin === true || is_admin === 'true',
            is_superadmin === true || is_superadmin === 'true',
            req.params.id
        ]);
        
        res.json({ message: '구성원 정보가 수정되었습니다.' });
    } catch (err) {
        console.error('구성원 수정 실패:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: '이미 등록된 이메일입니다.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// 비밀번호 초기화 (1234로 리셋)
router.patch('/:id/reset-password', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash('1234', 10);
        
        await pool.query(
            'UPDATE employees SET password = ? WHERE id = ?',
            [hashedPassword, req.params.id]
        );
        
        res.json({ message: '비밀번호가 1234로 초기화되었습니다.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 비밀번호 변경 (나중에 개인이 변경할 때 사용)
router.patch('/:id/change-password', async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        
        // 현재 비밀번호 확인
        const [rows] = await pool.query('SELECT password FROM employees WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: '구성원을 찾을 수 없습니다.' });
        }
        
        const isMatch = await bcrypt.compare(current_password, rows[0].password);
        if (!isMatch) {
            return res.status(400).json({ error: '현재 비밀번호가 일치하지 않습니다.' });
        }
        
        // 새 비밀번호 해시 및 저장
        const hashedPassword = await bcrypt.hash(new_password, 10);
        await pool.query(
            'UPDATE employees SET password = ? WHERE id = ?',
            [hashedPassword, req.params.id]
        );
        
        res.json({ message: '비밀번호가 변경되었습니다.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 구성원 삭제
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM employees WHERE id = ?', [req.params.id]);
        res.json({ message: '구성원이 삭제되었습니다.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 부서 목록 조회 (셀렉트박스용)
router.get('/list/departments', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT DISTINCT department 
            FROM employees 
            WHERE department IS NOT NULL AND department != ''
            ORDER BY department
        `);
        res.json(rows.map(r => r.department));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

