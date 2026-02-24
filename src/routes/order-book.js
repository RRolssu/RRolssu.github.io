const express = require('express');
const router = express.Router();
const pool = require('../config/db');

//  수주대장 조회 (연도별, 최신 데이터) 
router.get('/', async (req, res) => {
    try {
        const yearParam = req.query.year ? parseInt(req.query.year) : null;
        let query = 'SELECT id, year, headers_json, rows_json, row_count, merge_cells_json, body_styles_json, imported_at FROM order_book_imports';
        let params = [];
        
        if (yearParam) {
            query += ' WHERE year = ?';
            params.push(yearParam);
        }
        query += ' ORDER BY imported_at DESC LIMIT 1';
        const [rows] = await pool.query(query, params);
        if (rows.length === 0) {
            return res.json({ headers: [], rows: [], rowCount: 0, mergeCells: [], bodyStyles: [], year: null });
        }
        const r = rows[0];
        let mergeCells = [];
        if (r.merge_cells_json) {
            try {
                mergeCells = JSON.parse(r.merge_cells_json);
            } catch (e) { /* ignore */ }
        }
        let bodyStyles = [];
        if (r.body_styles_json) {
            try {
                bodyStyles = JSON.parse(r.body_styles_json);
            } catch (e) { /* ignore */ }
        }
        res.json({
            headers: JSON.parse(r.headers_json),
            rows: JSON.parse(r.rows_json),
            rowCount: r.row_count,
            mergeCells,
            bodyStyles,
            importedAt: r.imported_at,
            year: r.year
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//  엑셀 import 또는 편집본 저장 (경영관리용) 
router.post('/', async (req, res) => {
    try {
        const { headers, rows, mergeCells, bodyStyles, year } = req.body;
        if (year == null || year === '') {
            return res.status(400).json({ error: '연도(year)가 필요합니다.' });
        }
        const yearNum = parseInt(year);
        if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
            return res.status(400).json({ error: '올바른 연도를 선택해주세요.' });
        }
        if (!Array.isArray(headers)) {
            return res.status(400).json({ error: 'headers는 배열이어야 합니다.' });
        }
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ error: 'rows 배열이 필요합니다.' });
        }
        const headersJson = JSON.stringify(headers);
        const rowsJson = JSON.stringify(rows);
        const rowCount = rows.length;
        const mergeCellsJson = Array.isArray(mergeCells) ? JSON.stringify(mergeCells) : null;
        const bodyStylesJson = Array.isArray(bodyStyles) ? JSON.stringify(bodyStyles) : null;

        await pool.query(
            'INSERT INTO order_book_imports (year, headers_json, rows_json, row_count, merge_cells_json, body_styles_json) VALUES (?, ?, ?, ?, ?, ?)',
            [yearNum, headersJson, rowsJson, rowCount, mergeCellsJson, bodyStylesJson]
        );
        res.json({ success: true, rowCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/years', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT DISTINCT year FROM order_book_imports ORDER BY year DESC'
        );
        res.json({ years: rows.map(r => r.year) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;