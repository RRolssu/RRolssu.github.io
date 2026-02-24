const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// 파일 업로드 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads/projects'));
    },
    filename: (req, file, cb) => {
        // 원본 파일명을 최대한 유지하면서 충돌 방지
        const ext = path.extname(file.originalname);
        const nameWithoutExt = path.basename(file.originalname, ext);
        
        // 특수문자는 언더스코어로 변경 (안전성)
        const safeName = nameWithoutExt.replace(/[<>:"/\\|?*]/g, '_');
        
        let finalName = `${safeName}${ext}`;
        let counter = 1;
        
        // 파일 존재 여부 확인하고 번호 추가
        while (fs.existsSync(path.join(__dirname, '../../uploads/projects', finalName))) {
            finalName = `${safeName}(${counter})${ext}`;
            counter++;
        }
        
        cb(null, finalName);
    }
});
const upload = multer({ storage });

// 모든 프로젝트 조회 (고객사 정보 포함)
router.get('/', async (req, res) => {
    try {
        const query = `
            SELECT p.*, c.name as customer_name 
            FROM projects p 
            JOIN customers c ON p.customer_id = c.id 
            ORDER BY p.created_at DESC
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ★★★★ 추가: 프로젝트 및 자료 통합 검색 ★★★★
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim() === '') {
            return res.json({ projects: [], documents: [] });
        }
        
        const searchTerm = `%${q}%`;
        
        // 프로젝트 검색
        const [projects] = await db.query(`
            SELECT p.*, c.name as customer_name 
            FROM projects p 
            JOIN customers c ON p.customer_id = c.id 
            WHERE p.project_code LIKE ? 
               OR p.name LIKE ? 
               OR c.name LIKE ?
               OR p.product_type LIKE ?
            ORDER BY p.created_at DESC
        `, [searchTerm, searchTerm, searchTerm, searchTerm]);
        
        // 프로젝트 자료(문서) 검색
        const [documents] = await db.query(`
            SELECT pd.*, p.project_code, p.name as project_name, c.name as customer_name
            FROM project_documents pd
            JOIN projects p ON pd.project_id = p.id
            JOIN customers c ON p.customer_id = c.id
            WHERE pd.title LIKE ?
               OR pd.description LIKE ?
               OR pd.doc_type LIKE ?
               OR pd.uploader_name LIKE ?
            ORDER BY pd.uploaded_at DESC
        `, [searchTerm, searchTerm, searchTerm, searchTerm]);
        
        res.json({ projects, documents });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 프로젝트 등록
router.post('/', async (req, res) => {
    const { project_code, name, customer_id, product_type, status } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO projects (project_code, name, customer_id, product_type, status) VALUES (?, ?, ?, ?, ?)',
            [project_code, name, customer_id, product_type, '진행']
        );
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;


router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT p.*, c.name as customer_name 
            FROM projects p 
            JOIN customers c ON p.customer_id = c.id 
            WHERE p.id = ?
        `, [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Project not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 프로젝트 수정
router.put('/:id', async (req, res) => {
    const { project_code, name, customer_id, product_type, status } = req.body;
    try {
        await db.query(
            'UPDATE projects SET project_code = ?, name = ?, customer_id = ?, product_type = ?, status = ? WHERE id = ?',
            [project_code, name, customer_id, product_type, status, req.params.id]
        );
        res.json({ message: 'Project updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 프로젝트 삭제
router.delete('/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM projects WHERE id = ?', [req.params.id]);
        res.json({ message: 'Project deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 프로젝트 문서 목록 조회
router.get('/:id/documents', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT * FROM project_documents 
            WHERE project_id = ? 
            ORDER BY uploaded_at DESC
        `, [req.params.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 프로젝트 문서 업로드
router.post('/:id/documents', upload.single('file'), async (req, res) => {
    try {
        const { doc_type, title, description, version, uploader_name, uploader_dept } = req.body;
        const file_path = req.file ? `/uploads/projects/${req.file.filename}` : null;
        
        const [result] = await db.query(`
            INSERT INTO project_documents 
            (project_id, doc_type, title, description, file_path, version, uploader_name, uploader_dept)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [req.params.id, doc_type, title, description, file_path, version, uploader_name, uploader_dept]);
        
        res.json({ id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id/documents/:documentId', async (req, res) => {
    try {
        // 먼저 문서 정보 가져오기 (파일 경로 확인용)
        const [rows] = await db.query('SELECT file_path FROM project_documents WHERE id = ? AND project_id = ?', 
            [req.params.documentId, req.params.id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Document not found' });
        }
        
        // 파일이 있으면 삭제
        if (rows[0].file_path) {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(process.cwd(), 'public', rows[0].file_path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        // 데이터베이스에서 삭제
        await db.query('DELETE FROM project_documents WHERE id = ? AND project_id = ?', 
            [req.params.documentId, req.params.id]);
        
        res.json({ message: 'Document deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});