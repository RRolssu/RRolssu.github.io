const express = require('express');
const router = express.Router();
const db = require('../config/db');

const multer = require('multer');
const path = require('path');
const fs = require('fs');





const uploadDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadDir)){
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
    } catch (e) {
        console.error('Failed to create upload directory:', e);
    }
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        //  원본 파일명 + 중복 시 (1), (2) 추가 
        const ext = path.extname(file.originalname);
        const nameWithoutExt = path.basename(file.originalname, ext);
        
        // 특수문자는 언더스코어로 변경 (안전성)
        const safeName = nameWithoutExt.replace(/[<>:"/\\|?*]/g, '_');
        
        let finalName = `${safeName}${ext}`;
        let counter = 1;
        
        // 파일 존재 여부 확인하고 번호 추가
        while (fs.existsSync(path.join(uploadDir, finalName))) {
            finalName = `${safeName}(${counter})${ext}`;
            counter++;
        }
        
        cb(null, finalName);
    }
});
const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        // 한글 파일명 인코딩 처리
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
        cb(null, true);
    }
});



// 모든 컴플레인 조회 (프로젝트, 고객사 정보 포함)
router.get('/', async (req, res) => {
    try {
        const query = `
            SELECT cp.*, p.name as project_name, c.name as customer_name 
            FROM complaints cp 
            JOIN projects p ON cp.project_id = p.id 
            JOIN customers c ON p.customer_id = c.id 
            ORDER BY cp.created_at DESC
        `;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 컴플레인 등록
router.post('/', async (req, res) => {
    const { 
        project_id, title, manager_name, received_date, 
        description, customer_request
        // severity 제거
    } = req.body;
    
    try {
        const currentYear = new Date().getFullYear().toString().slice(-2); // '26'
        const [rows] = await db.query('SELECT COUNT(*) as count FROM complaints WHERE YEAR(created_at) = YEAR(CURDATE())');
        const sequence = String(rows[0].count + 1).padStart(3, '0'); // '001', '002'...
        const complaint_no = `P1000-${currentYear}-${sequence}`;

        const [result] = await db.query(
            `INSERT INTO complaints (
                complaint_no, project_id, title, manager_name, received_date, 
                description, customer_request
                -- severity 제거
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [complaint_no, project_id, title, manager_name, received_date, 
            description, customer_request]
        );
        res.status(201).json({ id: result.insertId, ...req.body });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 특정 컴플레인의 상세 정보 조회 (ISO 정보 포함)
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT cp.*, p.name as project_name, c.name as customer_name 
            FROM complaints cp 
            JOIN projects p ON cp.project_id = p.id 
            JOIN customers c ON p.customer_id = c.id 
            WHERE cp.id = ?
        `, [req.params.id]);
        
        if (rows.length === 0) return res.status(404).json({ message: 'Complaint not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 컴플레인 수정 (기본 정보 업데이트)
router.put('/:id', async (req, res) => {
    const { 
        project_id, title, manager_name, received_date, 
        description, customer_request
        // severity 제거
    } = req.body;

    try {
        await db.query(
            `UPDATE complaints SET 
                project_id = ?, title = ?, manager_name = ?, received_date = ?, 
                description = ?, customer_request = ?
                -- severity 제거
             WHERE id = ?`,
            [project_id, title, manager_name, received_date, 
             description, customer_request, req.params.id]
        );
        res.json({ message: 'Complaint updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id/actions/:actionId', upload.array('attachments', 10), async (req, res) => {
    try {
        const { 
            action_type, manager_name, 
            title, content, expected_date, actual_date, man_hours, cost 
        } = req.body;
        
        // 기존 조치 정보 가져오기
        const [existingRows] = await db.query('SELECT * FROM complaint_actions WHERE id = ? AND complaint_id = ?', 
            [req.params.actionId, req.params.id]);
        if (existingRows.length === 0) {
            return res.status(404).json({ error: '조치 이력을 찾을 수 없습니다.' });
        }
        
        const existing = existingRows[0];
        
        // 첨부파일 처리
        let attachment_path = existing.attachment_path;
        
        // 기존 파일 목록 가져오기
        let currentFiles = [];
        if (attachment_path) {
            try {
                currentFiles = JSON.parse(attachment_path);
                if (!Array.isArray(currentFiles)) currentFiles = [attachment_path];
            } catch (e) {
                currentFiles = [attachment_path];
            }
        }
        
        // 새 파일 추가
        if (req.files && req.files.length > 0) {
            const newFiles = req.files.map(file => `/uploads/complaints/${file.filename}`);
            currentFiles.push(...newFiles);
        }
        
        attachment_path = currentFiles.length > 0 ? JSON.stringify(currentFiles) : null;
        
        await db.query(`
            UPDATE complaint_actions 
            SET action_type = ?, manager_name = ?, title = ?, content = ?, 
                expected_date = ?, actual_date = ?, man_hours = ?, cost = ?, attachment_path = ?
            WHERE id = ? AND complaint_id = ?
        `, [
            action_type || existing.action_type,
            manager_name || existing.manager_name,
            title || existing.title,
            content || existing.content,
            expected_date || existing.expected_date,
            actual_date || existing.actual_date,
            man_hours || existing.man_hours,
            cost || existing.cost,
            attachment_path,
            req.params.actionId,
            req.params.id
        ]);
        
        res.json({ message: '조치 이력이 수정되었습니다.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
// 컴플레인 CAPA 업데이트
// router.put('/:id/capa', async (req, res) => {
//     const { root_cause, corrective_action, preventive_action } = req.body;
//     try {
//         await db.query(
//             'UPDATE complaints SET root_cause = ?, corrective_action = ?, preventive_action = ? WHERE id = ?',
//             [root_cause, corrective_action, preventive_action, req.params.id]
//         );
//         res.json({ message: 'CAPA updated' });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });

// 조치 이력 추가
router.post('/:id/actions', upload.array('attachments', 10), async (req, res) => {
    const complaint_id = req.params.id;
    const { 
        action_no, action_type, manager_name, 
        title, content, expected_date, actual_date, man_hours, cost 
    } = req.body;

    // 다중 파일 경로를 JSON 배열로 저장
    let attachment_path = null;
    if (req.files && req.files.length > 0) {
        const filePaths = req.files.map(file => '/uploads/' + file.filename);
        attachment_path = JSON.stringify(filePaths);
    }

    try {
        const safeExpectedDate = expected_date || null;
        const safeActualDate = actual_date || null;
        const safeManHours = man_hours || null;
        const safeCost = cost || null;

        // 조치 이력 추가
        const [result] = await db.query(
            `INSERT INTO complaint_actions (
                complaint_id, action_no, action_type, manager_name,
                title, content, expected_date, actual_date, man_hours, cost, attachment_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [
                complaint_id, action_no, action_type, manager_name, 
                title, content, safeExpectedDate, safeActualDate, safeManHours, safeCost, 
                attachment_path 
            ]
        );
        
        const actionId = result.insertId;

        //  수정: 조치 담당자의 부서 정보 가져오기 및 팀장 찾기 로직 
        let deptManagerId = null;
        let deptManagerName = null;
        if (manager_name) {
            const [employeeRows] = await db.query(
                `SELECT id, name, department FROM employees WHERE name = ? AND is_active = TRUE LIMIT 1`,
                [manager_name]
            );
            
            if (employeeRows.length > 0) {
                const employee = employeeRows[0];
                //  수정: 같은 부서의 팀장(is_admin = true) 찾기 
                const [deptManagerRows] = await db.query(
                    `SELECT id, name FROM employees 
                     WHERE department = ? 
                     AND is_admin = TRUE
                     AND is_active = TRUE
                     LIMIT 1`,
                    [employee.department]
                );
                
                if (deptManagerRows.length > 0) {
                    deptManagerId = deptManagerRows[0].id;
                    deptManagerName = deptManagerRows[0].name;
                }
            }
        }

        //  수정: 팀장 결재 요청 생성 (조치 추가 시점에서는 팀장 결재만) 
        if (deptManagerId) {
            await db.query(
                `INSERT INTO action_approvals (action_id, approval_level, approver_id, approver_name, status)
                 VALUES (?, 1, ?, ?, 'pending')`,
                [actionId, deptManagerId, deptManagerName]
            );
        }
        
        res.status(201).json({ id: actionId, ...req.body, attachment_path });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id/actions/:actionId/approvals', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT * FROM action_approvals 
             WHERE action_id = ? 
             ORDER BY approval_level ASC`,
            [req.params.actionId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const jwt = require('jsonwebtoken');
//  추가: 결재 승인/반려 API 
router.post('/:id/actions/:actionId/approve', async (req, res) => {
    try {
        //  JWT 토큰 검증 
        const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
        
        if (!token) {
            return res.status(401).json({ error: '로그인이 필요합니다.' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        //  사용자 정보 조회 
        const [userRows] = await db.query(
            'SELECT id, name, is_admin, is_superadmin FROM employees WHERE id = ? AND is_active = TRUE',
            [decoded.id]
        );
        
        if (userRows.length === 0) {
            return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
        }
        
        const user = userRows[0];

        const { approval_level, status, comment } = req.body;
        
        // 현재 결재 정보 확인
        const [approvalRows] = await db.query(
            `SELECT * FROM action_approvals 
             WHERE action_id = ? AND approval_level = ?`,
            [req.params.actionId, approval_level]
        );
        
        if (approvalRows.length === 0) {
            return res.status(404).json({ error: '결재 정보를 찾을 수 없습니다.' });
        }
        
        const approval = approvalRows[0];
        
        //  수정: 권한 확인 로직 (권한 기반으로 변경) 
        if (approval_level === 1) {
            // 팀장 결재: 팀장 권한이 있는 사용자만 가능
            if (!user.is_admin) {
                return res.status(403).json({ error: '팀장 권한이 필요합니다.' });
            }
        } else if (approval_level === 2) {
            // 대표이사 결재: 관리자 권한이 있는 사용자만 가능
            if (!user.is_superadmin) {
                return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
            }
        }
        
        // 결재자 ID 확인 (추가 보안)
        if (approval.approver_id != user.id) {
            return res.status(403).json({ error: '이 결재를 처리할 권한이 없습니다.' });
        }
        
        // 결재 처리
        await db.query(
            `UPDATE action_approvals 
             SET status = ?, comment = ?, approved_at = NOW()
             WHERE action_id = ? AND approval_level = ?`,
            [status, comment || null, req.params.actionId, approval_level]
        );
        
        //  추가: 팀장 결재 승인 시 대표이사 결재 요청 생성 
        if (approval_level === 1 && status === 'approved') {
            // 대표이사 찾기
            const [ceoRows] = await db.query(
                `SELECT id, name FROM employees 
                 WHERE is_superadmin = TRUE 
                 AND is_active = TRUE 
                 LIMIT 1`
            );
            
            if (ceoRows.length > 0 && ceoRows[0].id != user.id) { // 대표이사와 팀장이 다른 경우
                await db.query(
                    `INSERT INTO action_approvals (action_id, approval_level, approver_id, approver_name, status)
                     VALUES (?, 2, ?, ?, 'pending')`,
                    [req.params.actionId, ceoRows[0].id, ceoRows[0].name]
                );
            }
        }
        
        res.json({ message: '결재가 처리되었습니다.' });
    } catch (err) {
        console.error(err);
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: '인증 토큰이 유효하지 않습니다.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// 조치 이력 조회
router.get('/:id/actions', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM complaint_actions WHERE complaint_id = ? ORDER BY created_at ASC', [req.params.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 컴플레인 삭제
router.delete('/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM complaints WHERE id = ?', [req.params.id]);
        res.json({ message: 'Complaint deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 조치 이력 삭제
router.delete('/:id/actions/:actionId', async (req, res) => {
    try {
        await db.query('DELETE FROM complaint_actions WHERE id = ? AND complaint_id = ?', 
            [req.params.actionId, req.params.id]);
        res.json({ message: 'Action deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
module.exports = router;
