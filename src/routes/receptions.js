const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadDir = path.join(process.cwd(), 'uploads', 'receptions');

if (!fs.existsSync(uploadDir)){
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
    } catch (e) {
        console.error('Failed to create upload directory:', e);
    }
}

// ★★★★ 수정: 한글 파일명 안전 처리 (타임스탬프 기반 파일명 사용) ★★★★
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // 업로드 디렉토리 확인 및 생성
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // ★★★★ 수정: 원본 파일명 사용, 중복 시 (1), (2) 추가 ★★★★
        
        // 원본 파일명을 req 객체에 저장 (나중에 DB 저장 시 사용)
        if (!req.originalFileNames) {
            req.originalFileNames = [];
        }
        
        let originalName = file.originalname || 'file';
        
        // ★★★★ 수정: 한글 파일명 인코딩 처리 ★★★★
        try {
            if (originalName && typeof originalName === 'string') {
                try {
                    const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
                    if (decoded && decoded !== originalName && decoded.length > 0) {
                        if (/[\uAC00-\uD7A3]/.test(decoded) || decoded.length !== originalName.length) {
                            originalName = decoded;
                        }
                    }
                } catch (decodeErr) {
                    // 디코딩 실패 시 원본 사용
                }
            }
        } catch (e) {
            console.log('파일명 인코딩 처리 중 오류:', e.message);
        }
        
        // 원본 파일명 저장 (DB 저장 시 사용)
        req.originalFileNames.push({
            index: req.originalFileNames.length,
            name: originalName
        });
        
        // 확장자 추출
        const ext = path.extname(originalName) || '';
        const nameWithoutExt = path.basename(originalName, ext);
        
        // ★★★★ 수정: 원본 파일명 사용, 특수문자만 제거 (한글은 유지) ★★★★
        // Windows 파일 시스템에서 허용되지 않는 문자만 제거
        const safeName = nameWithoutExt.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
        
        let finalName = `${safeName}${ext}`;
        let counter = 1;
        
        // ★★★★ 수정: 중복 체크 - 같은 이름이 있으면 (1), (2) 추가 ★★★★
        while (fs.existsSync(path.join(uploadDir, finalName))) {
            finalName = `${safeName}(${counter++})${ext}`;
        }
        
        cb(null, finalName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 },  // 50MB 제한
    fileFilter: function (req, file, cb) {
        // 모든 파일 허용
        cb(null, true);
    },
    // ★★★★ 추가: multer 에러 핸들링 ★★★★
    onError: function(err, next) {
        console.error('Multer 에러:', err);
        next(err);
    }
});

//  추가: 파일 존재 여부 확인 헬퍼 함수 
function filterExistingFiles(attachmentPath) {
    if (!attachmentPath) return [];
    try {
        let files = JSON.parse(attachmentPath);
        if (!Array.isArray(files)) {
            // 단일 문자열 경로인 경우 (하위 호환)
            if (typeof files === 'string') {
                const fullPath = path.join(process.cwd(), files.startsWith('/') ? files.substring(1) : files);
                return fs.existsSync(fullPath) ? [files] : [];
            }
            // 단일 객체인 경우 배열로 변환
            files = [files];
        }
        
        return files.filter(fileItem => {
            // ★★★★ 수정: 객체 배열 처리 ★★★★
            let filePath;
            if (typeof fileItem === 'string') {
                // 문자열 경로인 경우 (하위 호환)
                filePath = fileItem;
            } else if (fileItem && typeof fileItem === 'object') {
                // 객체인 경우 path 또는 filename 사용
                filePath = fileItem.path || fileItem.filename;
                if (!filePath) return false;
            } else {
                return false;
            }
            
            // 파일 경로 정규화
            const normalizedPath = filePath.replace(/\\/g, '/');
            const relativePath = normalizedPath.startsWith('/') ? normalizedPath.substring(1) : normalizedPath;
            const fullPath = path.join(process.cwd(), relativePath);
            
            const exists = fs.existsSync(fullPath);
            
            // 디버깅 로그 (필요시)
            if (!exists) {
                console.log(`파일을 찾을 수 없습니다: ${fullPath}`);
                console.log(`저장된 경로: ${filePath}`);
            }
            
            return exists;
        });
    } catch (e) {
        // JSON 파싱 실패 시 단일 문자열 경로로 처리
        if (typeof attachmentPath === 'string') {
            const fullPath = path.join(process.cwd(), attachmentPath.startsWith('/') ? attachmentPath.substring(1) : attachmentPath);
            return fs.existsSync(fullPath) ? [attachmentPath] : [];
        }
        console.error('attachmentPath 파싱 실패:', e);
        return [];
    }
}

// 접수 목록 조회
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM receptions ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//  수정: 접수 상세 조회 - 실제 파일 존재 여부 검증 
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM receptions WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: '접수를 찾을 수 없습니다.' });
        }
        const reception = rows[0];
        
        // 실제 존재하는 파일만 필터링
        if (reception.attachment_path) {
            try {
                const files = JSON.parse(reception.attachment_path);
                const existingFiles = files.filter(fileItem => {
                    let filePath;
                    if (typeof fileItem === 'string') {
                        filePath = fileItem;
                    } else if (fileItem && typeof fileItem === 'object') {
                        filePath = fileItem.path || fileItem.filename;
                        if (!filePath) return false;
                    } else {
                        return false;
                    }
                    
                    const normalizedPath = filePath.replace(/\\/g, '/');
                    const relativePath = normalizedPath.startsWith('/') ? normalizedPath.substring(1) : normalizedPath;
                    const fullPath = path.join(process.cwd(), relativePath);
                    
                    return fs.existsSync(fullPath);
                });
                
                reception.attachment_path = existingFiles.length > 0 ? JSON.stringify(existingFiles) : null;
                
                // DB 동기화 (실제 파일이 없는 경로 제거)
                if (reception.attachment_path !== rows[0].attachment_path) {
                    await pool.query('UPDATE receptions SET attachment_path = ? WHERE id = ?', 
                        [reception.attachment_path, req.params.id]);
                }
            } catch (parseErr) {
                console.error('attachment_path 파싱 오류:', parseErr);
                // 파싱 실패 시 기존 값 유지
            }
        }
        
        res.json(reception);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ★★★★ 추가: 이미지 업로드 엔드포인트 (클립보드 이미지용) ★★★★
const imageUploadDir = path.join(process.cwd(), 'uploads', 'receptions', 'images');
if (!fs.existsSync(imageUploadDir)) {
    try {
        fs.mkdirSync(imageUploadDir, { recursive: true });
    } catch (e) {
        console.error('Failed to create image upload directory:', e);
    }
}

const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, imageUploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.png';
        const name = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
        cb(null, name);
    }
});

const imageUpload = multer({ 
    storage: imageStorage,
    limits: { fileSize: 5 * 1024 * 1024 }  // 5MB 제한
});

router.post('/upload-image', imageUpload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '이미지 파일이 없습니다.' });
    }
    res.json({ url: `/uploads/receptions/images/${req.file.filename}` });
});

// 신규 접수 등록
router.post('/', async (req, res, next) => {
    // ★★★★ 수정: multer 미들웨어를 래핑하여 에러 핸들링 ★★★★
    upload.array('attachments', 10)(req, res, (multerErr) => {
        if (multerErr) {
            console.error('Multer 에러:', multerErr);
            if (multerErr instanceof multer.MulterError) {
                return res.status(400).json({ 
                    error: multerErr.message || '파일 업로드에 실패했습니다.',
                    code: multerErr.code
                });
            }
            return res.status(500).json({ 
                error: multerErr.message || '파일 업로드 중 오류가 발생했습니다.'
            });
        }
        // 에러가 없으면 다음으로 진행
        next();
    });
}, async (req, res) => {
    try {
        const { title, reception_date, department, receptionist, customer_name, 
                deadline, is_urgent, content, customer_request, reception_channel } = req.body;
        
        // ★★★★ 수정: reception_channel을 JSON 배열로 처리 ★★★★
        let channelValue = reception_channel;
        try {
            // JSON 문자열인 경우 파싱
            if (typeof reception_channel === 'string' && reception_channel.startsWith('[')) {
                const parsed = JSON.parse(reception_channel);
                channelValue = Array.isArray(parsed) ? JSON.stringify(parsed) : reception_channel;
            } else if (Array.isArray(reception_channel)) {
                channelValue = JSON.stringify(reception_channel);
            } else if (!reception_channel) {
                // 값이 없는 경우 에러
                return res.status(400).json({ error: '접수 경로를 선택해주세요.' });
            }
        } catch (e) {
            // JSON 파싱 실패 시 단일 값으로 처리 (하위 호환)
            console.log('reception_channel 파싱 실패, 단일 값으로 처리:', e.message);
            channelValue = reception_channel;
        }
        
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const [countResult] = await pool.query(
            'SELECT COUNT(*) as cnt FROM receptions WHERE DATE(created_at) = CURDATE()'
        );
        const seq = String(countResult[0].cnt + 1).padStart(2, '0');
        const reception_no = `REC-${today}-${seq}`;
        
        // ★★★★ 수정: 첨부파일 경로 처리 (원본 파일명 정보 포함) ★★★★
        let attachment_path = null;
        if (req.files && req.files.length > 0) {
            const fileInfo = req.files.map((file, index) => {
                // 원본 파일명 가져오기
                let originalName = '파일';
                
                if (req.originalFileNames && req.originalFileNames[index]) {
                    originalName = req.originalFileNames[index].name;
                } else if (file.originalname) {
                    originalName = file.originalname;
                    // 한글 파일명 인코딩 처리 시도
                    try {
                        const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
                        if (decoded && decoded !== originalName && !decoded.includes('')) {
                            originalName = decoded;
                        }
                    } catch (e) {
                        // 디코딩 실패 시 원본 사용
                    }
                }
                
                return {
                    filename: file.filename,  // 저장된 파일명 (원본 파일명 기반 또는 타임스탬프)
                    originalname: originalName,  // 원본 파일명
                    path: `/uploads/receptions/${file.filename}`
                };
            });
            attachment_path = JSON.stringify(fileInfo);
        }
        
        const [result] = await pool.query(`
            INSERT INTO receptions 
            (reception_no, title, reception_date, department, receptionist, customer_name, 
             deadline, is_urgent, content, customer_request, attachment_path, reception_channel)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [reception_no, title, reception_date, department, receptionist, customer_name,
            deadline || null, is_urgent === '1' || is_urgent === 1, content, customer_request || null, attachment_path, channelValue]);
        
        res.json({ id: result.insertId, reception_no });
    } catch (err) {
        console.error('접수 등록 에러:', err);  // ★★★★ 추가: 에러 로그 출력 ★★★★
        console.error('에러 스택:', err.stack);  // ★★★★ 추가: 스택 트레이스 출력 ★★★★
        console.error('에러 상세:', {
            message: err.message,
            code: err.code,
            errno: err.errno,
            sqlMessage: err.sqlMessage,
            sqlState: err.sqlState
        });
        
        // ★★★★ 수정: 항상 JSON 형태로 에러 반환 (HTML 에러 페이지 방지) ★★★★
        if (!res.headersSent) {
            // SQL 에러인 경우 더 자세한 정보 제공
            if (err.code && err.code.startsWith('ER_')) {
                return res.status(500).json({ 
                    error: '데이터베이스 오류가 발생했습니다. reception_channel 컬럼이 TEXT 타입인지 확인해주세요.',
                    sqlError: err.sqlMessage || err.message,
                    hint: 'ALTER TABLE receptions MODIFY COLUMN reception_channel TEXT; 실행 필요'
                });
            }
            
            return res.status(500).json({ 
                error: err.message || '접수 등록에 실패했습니다.',
                code: err.code,
                details: process.env.NODE_ENV === 'development' ? err.stack : undefined
            });
        }
    }
});

//  수정: 접수 정보 수정 - 코드 간소화 및 버그 수정 
router.put('/:id', upload.array('attachments', 10), async (req, res) => {
    try {
        const { dept_confirmed, title, content, department, receptionist, 
                customer_name, deadline, is_urgent, reception_channel, filesToRemove } = req.body;
        
        const [currentRows] = await pool.query('SELECT * FROM receptions WHERE id = ?', [req.params.id]);
        if (currentRows.length === 0) {
            return res.status(404).json({ error: '접수를 찾을 수 없습니다.' });
        }
        const currentReception = currentRows[0];
        
        const updates = [];
        const values = [];
        
        if (dept_confirmed !== undefined) {
            updates.push('dept_confirmed = ?');
            values.push(dept_confirmed);
            updates.push(dept_confirmed ? 'dept_confirmed_at = NOW()' : 'dept_confirmed_at = NULL');
        }
        if (title !== undefined) { updates.push('title = ?'); values.push(title); }
        if (content !== undefined) { updates.push('content = ?'); values.push(content); }
        if (department !== undefined) { updates.push('department = ?'); values.push(department); }
        if (receptionist !== undefined) { updates.push('receptionist = ?'); values.push(receptionist); }
        if (customer_name !== undefined) { updates.push('customer_name = ?'); values.push(customer_name); }
        if (deadline !== undefined) { 
            updates.push('deadline = ?'); 
            values.push(deadline === '' || deadline === 'null' ? null : deadline); 
        }
        if (is_urgent !== undefined) { 
            updates.push('is_urgent = ?'); 
            values.push(is_urgent === 'true' || is_urgent === true || is_urgent === '1' ? 1 : 0); 
        }
        if (reception_channel !== undefined) { updates.push('reception_channel = ?'); values.push(reception_channel); }
        
        // 첨부파일 처리
        let currentAttachments = filterExistingFiles(currentReception.attachment_path);
        
        // 삭제할 파일들 처리
        if (filesToRemove) {
            try {
                const filesToDelete = JSON.parse(filesToRemove);
                for (const filePath of filesToDelete) {
                    const fullPath = path.join(process.cwd(), filePath.startsWith('/') ? filePath.substring(1) : filePath);
                    if (fs.existsSync(fullPath)) {
                        fs.unlinkSync(fullPath);
                    }
                    currentAttachments = currentAttachments.filter(f => f !== filePath);
                }
            } catch (e) {
                console.error('filesToRemove 파싱 실패:', e);
            }
        }
        
        // 새 파일들 추가
        if (req.files?.length > 0) {
            currentAttachments.push(...req.files.map(f => `/uploads/receptions/${f.filename}`));
        }
        
        //  수정: 첨부파일 업데이트 로직 수정 
        updates.push('attachment_path = ?');
        values.push(currentAttachments.length > 0 ? JSON.stringify(currentAttachments) : null);
        
        if (updates.length === 0) {
            return res.status(400).json({ error: '수정할 내용이 없습니다.' });
        }
        
        values.push(req.params.id);
        await pool.query(`UPDATE receptions SET ${updates.join(', ')} WHERE id = ?`, values);
        res.json({ success: true });
    } catch (err) {
        console.error('Update error:', err);
        res.status(500).json({ error: err.message });
    }
});

//  수정: 접수 삭제 - currentAttachments 버그 수정 
router.delete('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM receptions WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: '접수를 찾을 수 없습니다.' });
        }
        const reception = rows[0];
        
        // 첨부파일 삭제
        if (reception.attachment_path) {
            const filesToDelete = filterExistingFiles(reception.attachment_path);
            for (const filePath of filesToDelete) {
                try {
                    const fullPath = path.join(process.cwd(), filePath.startsWith('/') ? filePath.substring(1) : filePath);
                    if (fs.existsSync(fullPath)) {
                        fs.unlinkSync(fullPath);
                    }
                } catch (e) {
                    console.error('파일 삭제 실패:', e);
                }
            }
        }
        
        await pool.query('DELETE FROM receptions WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 부서 확인 처리
router.patch('/:id/confirm', async (req, res) => {
    try {
        const { confirmed_by } = req.body;
        
        //  추가: 현재 접수 정보 조회 
        const [receptionRows] = await pool.query('SELECT * FROM receptions WHERE id = ?', [req.params.id]);
        if (receptionRows.length === 0) {
            return res.status(404).json({ error: '접수를 찾을 수 없습니다.' });
        }
        const reception = receptionRows[0];
        
        // QC 확인 처리
        await pool.query(`
            UPDATE receptions 
            SET dept_confirmed = TRUE, dept_confirmed_by = ?, dept_confirmed_at = NOW()
            WHERE id = ?
        `, [confirmed_by, req.params.id]);
        
        //  추가: QC 확인 시 자동으로 컴플레인 생성 
        if (!reception.moved_to_complaint) {
            // 기본 프로젝트 찾기 (고객명으로 검색 또는 기본 프로젝트 사용)
            let projectId = null;
            const [projectRows] = await pool.query(`
                SELECT p.id FROM projects p 
                JOIN customers c ON p.customer_id = c.id 
                WHERE c.name LIKE ? LIMIT 1
            `, [`%${reception.customer_name}%`]);
            
            if (projectRows.length > 0) {
                projectId = projectRows[0].id;
            } else {
                // 기본 프로젝트가 없으면 첫 번째 프로젝트 사용 또는 에러 처리
                const [defaultProject] = await pool.query('SELECT id FROM projects LIMIT 1');
                if (defaultProject.length > 0) {
                    projectId = defaultProject[0].id;
                }
            }
            
            if (projectId) {
                // 컴플레인 번호 생성
                const currentYear = new Date().getFullYear().toString().slice(-2);
                const [countResult] = await pool.query('SELECT COUNT(*) as count FROM complaints WHERE YEAR(created_at) = YEAR(CURDATE())');
                const sequence = String(countResult[0].count + 1).padStart(3, '0');
                const complaintNo = `P1000-${currentYear}-${sequence}`;
                
                // 컴플레인 생성
                const [complaintResult] = await pool.query(`
                    INSERT INTO complaints (
                        complaint_no, project_id, title, manager_name, received_date, 
                        description, customer_request
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    complaintNo, projectId, reception.title, confirmed_by || 'QC담당자', 
                    reception.reception_date, reception.content, reception.customer_request || reception.content
                ]);
                
                // 접수에 컴플레인 ID 연결 및 이동 플래그 설정
                await pool.query(`
                    UPDATE receptions 
                    SET moved_to_complaint = TRUE, complaint_id = ? 
                    WHERE id = ?
                `, [complaintResult.insertId, req.params.id]);
                
                res.json({ 
                    success: true, 
                    complaint_created: true, 
                    complaint_id: complaintResult.insertId,
                    complaint_no: complaintNo 
                });
            } else {
                res.json({ success: true, complaint_created: false, message: '프로젝트를 찾을 수 없어 컴플레인을 생성하지 못했습니다.' });
            }
        } else {
            res.json({ success: true, complaint_created: false, message: '이미 컴플레인으로 이동된 접수입니다.' });
        }
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;