const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 모든 고객사 조회
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM customers ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 특정 고객사 조회
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Customer not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 고객사 등록
router.post('/', async (req, res) => {
    // ★★★★ 모든 필드들을 추출하도록 수정 ★★★★
    const { 
        name, 
        business_registration_number,
        address,
        establishment_date,
        representative_name
    } = req.body;
    
    try {
        const [result] = await db.query(
            `INSERT INTO customers (
                name, business_registration_number, address, establishment_date, representative_name
            ) VALUES (?, ?, ?, ?, ?)`,
            [name, business_registration_number, address, establishment_date, representative_name]
        );
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 고객사 수정
router.put('/:id', async (req, res) => {
    // ★★★★ 모든 필드들을 추출하도록 수정 ★★★★
    const { 
        name, 
        business_registration_number,
        address,
        establishment_date,
        representative_name
    } = req.body;
    
    try {
        await db.query(
            `UPDATE customers SET 
                name = ?, business_registration_number = ?, address = ?, establishment_date = ?, representative_name = ?
             WHERE id = ?`,
            [name, business_registration_number, address, establishment_date, representative_name, req.params.id] 
        );
        res.json({ message: 'Customer updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 고객사 삭제
router.delete('/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
        res.json({ message: 'Customer deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;



