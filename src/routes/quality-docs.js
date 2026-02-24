// ★★★★ 추가: 품질문서 관리 API ★★★★
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ★★★★ 수정: 기본 업로드 폴더 및 5개 분류 폴더 생성 ★★★★
const baseUploadDir = path.join(__dirname, '../../uploads/quality-docs');
const categoryFolders = {
    '인증/심사': 'certification',
    '품질 경영': 'quality-management',
    '검사/시험': 'inspection',
    '고객 요구 사항서': 'customer-requirements',
    '부적합 보고서': 'nonconformance'
};

// 기본 폴더 및 분류별 폴더 생성
if (!fs.existsSync(baseUploadDir)) {
    fs.mkdirSync(baseUploadDir, { recursive: true });
}
Object.values(categoryFolders).forEach(folderName => {
    const folderPath = path.join(baseUploadDir, folderName);
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
});

// ★★★★ 수정: 파일 업로드 설정 - 분류별 폴더에 저장 ★★★★
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, baseUploadDir);
    },
    filename: (req, file, cb) => {
        if (!req.originalFileNames) req.originalFileNames = [];
        let originalName = file.originalname || 'file';
        // ★★★★ 추가: 한글 파일명 인코딩 처리 (접수와 동일) ★★★★
        try {
            if (originalName && typeof originalName === 'string') {
                try {
                    const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
                    if (decoded && decoded !== originalName && decoded.length > 0) {
                        if (/[\uAC00-\uD7A3]/.test(decoded) || decoded.length !== originalName.length) {
                            originalName = decoded;
                        }
                    }
                } catch (decodeErr) {}
            }
        } catch (e) {
            console.log('파일명 인코딩 처리 중 오류:', e.message);
        }
        req.originalFileNames.push({ index: req.originalFileNames.length, name: originalName });
        const ext = path.extname(originalName) || '';
        const nameWithoutExt = path.basename(originalName, ext);
        const safeName = nameWithoutExt.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
        let finalName = `${safeName}${ext}`;
        let counter = 1;
        while (fs.existsSync(path.join(baseUploadDir, finalName))) {
            finalName = `${safeName}(${counter++})${ext}`;
        }
        cb(null, finalName);
    }
});
const upload = multer({ storage });

// 루트 카테고리 목록
const ROOT_CATEGORIES = ['인증/심사', '품질 경영', '검사/시험', '고객 요구 사항서', '부적합 보고서'];

// 초기 루트 폴더 생성 (없으면)
async function ensureRootFolders() {
    try {
        for (const category of ROOT_CATEGORIES) {
            const [existing] = await db.query(
                'SELECT id FROM quality_folders WHERE name = ? AND parent_id IS NULL',
                [category]
            );
            if (existing.length === 0) {
                await db.query(
                    'INSERT INTO quality_folders (name, parent_id, root_category) VALUES (?, NULL, ?)',
                    [category, category]
                );
            }
        }
    } catch (err) {
        console.error('Error ensuring root folders:', err);
    }
}
ensureRootFolders();

// 모든 폴더 조회 (트리 구조)
router.get('/folders', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT * FROM quality_folders ORDER BY parent_id, name
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 특정 폴더의 하위 폴더 및 파일 조회
router.get('/folders/:id/contents', async (req, res) => {
    try {
        const folderId = req.params.id;
        
        // 하위 폴더 조회
        const [folders] = await db.query(`
            SELECT id, name, 'folder' as type, created_at 
            FROM quality_folders 
            WHERE parent_id = ? 
            ORDER BY name
        `, [folderId]);
        
        // 폴더 내 파일 조회
        const [files] = await db.query(`
            SELECT id, file_name as name, file_path, file_size, uploader_name, 'file' as type, created_at 
            FROM quality_documents 
            WHERE folder_id = ? 
            ORDER BY file_name
        `, [folderId]);
        
        res.json({
            folders,
            files,
            contents: [...folders, ...files]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 폴더 생성
router.post('/folders', async (req, res) => {
    try {
        const { name, parent_id } = req.body;
        
        if (!name || !parent_id) {
            return res.status(400).json({ error: '폴더 이름과 상위 폴더가 필요합니다.' });
        }
        
        // 상위 폴더의 root_category 가져오기
        const [parentFolder] = await db.query(
            'SELECT root_category FROM quality_folders WHERE id = ?',
            [parent_id]
        );
        
        const rootCategory = parentFolder.length > 0 ? parentFolder[0].root_category : null;
        
        const [result] = await db.query(
            'INSERT INTO quality_folders (name, parent_id, root_category) VALUES (?, ?, ?)',
            [name, parent_id, rootCategory]
        );
        
        res.status(201).json({ id: result.insertId, name, parent_id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 폴더 이름 변경
router.put('/folders/:id', async (req, res) => {
    try {
        const { name } = req.body;
        
        // 루트 폴더인지 확인 (루트 폴더는 이름 변경 불가)
        const [folder] = await db.query(
            'SELECT parent_id FROM quality_folders WHERE id = ?',
            [req.params.id]
        );
        
        if (folder.length > 0 && folder[0].parent_id === null) {
            return res.status(400).json({ error: '루트 분류 폴더는 이름을 변경할 수 없습니다.' });
        }
        
        await db.query(
            'UPDATE quality_folders SET name = ? WHERE id = ?',
            [name, req.params.id]
        );
        
        res.json({ message: 'Folder renamed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 폴더 삭제
router.delete('/folders/:id', async (req, res) => {
    try {
        // 루트 폴더인지 확인
        const [folder] = await db.query(
            'SELECT parent_id FROM quality_folders WHERE id = ?',
            [req.params.id]
        );
        
        if (folder.length > 0 && folder[0].parent_id === null) {
            return res.status(400).json({ error: '루트 분류 폴더는 삭제할 수 없습니다.' });
        }
        
        // 폴더 내 파일들 삭제
        const [files] = await db.query(
            'SELECT file_path FROM quality_documents WHERE folder_id = ?',
            [req.params.id]
        );
        
        for (const file of files) {
            const filePath = path.join(__dirname, '../..', file.file_path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        await db.query('DELETE FROM quality_folders WHERE id = ?', [req.params.id]);
        res.json({ message: 'Folder deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ★★★★ 수정: 파일 업로드 - 분류별 폴더에 저장 ★★★★
router.post('/folders/:id/files', upload.array('files', 20), async (req, res) => {
    try {
        const folderId = req.params.id;
        const uploaderName = req.body.uploader_name || '사용자';
        const uploadedFiles = [];
        
        // 해당 폴더의 root_category 조회
        const [folderInfo] = await db.query(
            'SELECT root_category FROM quality_folders WHERE id = ?',
            [folderId]
        );
        
        const rootCategory = folderInfo.length > 0 ? folderInfo[0].root_category : null;
        const targetSubfolder = categoryFolders[rootCategory] || '';
        const targetDir = targetSubfolder ? path.join(baseUploadDir, targetSubfolder) : baseUploadDir;
        
        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            // ★★★★ 추가: 디코딩된 원본 파일명 사용 (한글 깨짐 방지) ★★★★
            let displayName = file.originalname;
            if (req.originalFileNames && req.originalFileNames[i]) {
                displayName = req.originalFileNames[i].name;
            }
            // 파일을 분류별 폴더로 이동
            const sourcePath = path.join(baseUploadDir, file.filename);
            const destPath = path.join(targetDir, file.filename);
            
            if (sourcePath !== destPath && fs.existsSync(sourcePath)) {
                fs.renameSync(sourcePath, destPath);
            }
            
            const relativePath = targetSubfolder 
                ? `/uploads/quality-docs/${targetSubfolder}/${file.filename}`
                : `/uploads/quality-docs/${file.filename}`;
            
            const [result] = await db.query(`
                INSERT INTO quality_documents (folder_id, file_name, file_path, file_size, uploader_name)
                VALUES (?, ?, ?, ?, ?)
            `, [folderId, displayName, relativePath, file.size, uploaderName]);
            
            uploadedFiles.push({
                id: result.insertId,
                file_name: displayName,
                file_path: relativePath
            });
        }
        
        res.status(201).json({ files: uploadedFiles });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 파일 삭제
router.delete('/files/:id', async (req, res) => {
    try {
        const [file] = await db.query(
            'SELECT file_path FROM quality_documents WHERE id = ?',
            [req.params.id]
        );
        
        if (file.length === 0) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        // 실제 파일 삭제
        const filePath = path.join(__dirname, '../..', file[0].file_path);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        await db.query('DELETE FROM quality_documents WHERE id = ?', [req.params.id]);
        res.json({ message: 'File deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 파일 이름 변경
router.put('/files/:id', async (req, res) => {
    try {
        const { name } = req.body;
        await db.query(
            'UPDATE quality_documents SET file_name = ? WHERE id = ?',
            [name, req.params.id]
        );
        res.json({ message: 'File renamed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 폴더 복사
router.post('/folders/:id/copy', async (req, res) => {
    try {
        const { target_folder_id } = req.body;
        const sourceFolderId = req.params.id;
        
        // 원본 폴더 정보 가져오기
        const [sourceFolder] = await db.query(
            'SELECT * FROM quality_folders WHERE id = ?',
            [sourceFolderId]
        );
        
        if (sourceFolder.length === 0) {
            return res.status(404).json({ error: 'Source folder not found' });
        }
        
        // 대상 폴더의 root_category 가져오기
        const [targetFolder] = await db.query(
            'SELECT root_category FROM quality_folders WHERE id = ?',
            [target_folder_id]
        );
        
        // 새 폴더 생성
        const [result] = await db.query(
            'INSERT INTO quality_folders (name, parent_id, root_category) VALUES (?, ?, ?)',
            [`${sourceFolder[0].name} - 복사본`, target_folder_id, targetFolder[0]?.root_category || sourceFolder[0].root_category]
        );
        
        res.json({ id: result.insertId, message: 'Folder copied' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ★★★★ 수정: 파일 복사 - 분류별 폴더에 저장 ★★★★
router.post('/files/:id/copy', async (req, res) => {
    try {
        const { target_folder_id } = req.body;
        const sourceFileId = req.params.id;
        
        // 원본 파일 정보 가져오기
        const [sourceFile] = await db.query(
            'SELECT * FROM quality_documents WHERE id = ?',
            [sourceFileId]
        );
        
        if (sourceFile.length === 0) {
            return res.status(404).json({ error: 'Source file not found' });
        }
        
        // 대상 폴더의 root_category 조회
        const [targetFolderInfo] = await db.query(
            'SELECT root_category FROM quality_folders WHERE id = ?',
            [target_folder_id]
        );
        
        const rootCategory = targetFolderInfo.length > 0 ? targetFolderInfo[0].root_category : null;
        const targetSubfolder = categoryFolders[rootCategory] || '';
        const targetDir = targetSubfolder ? path.join(baseUploadDir, targetSubfolder) : baseUploadDir;
        
        // 파일 복사
        const ext = path.extname(sourceFile[0].file_name);
        const nameWithoutExt = path.basename(sourceFile[0].file_name, ext);
        const newFileName = `${nameWithoutExt} - 복사본${ext}`;
        const newPhysicalFileName = `${Date.now()}-${path.basename(sourceFile[0].file_path)}`;
        
        const sourcePath = path.join(__dirname, '../..', sourceFile[0].file_path);
        const destPath = path.join(targetDir, newPhysicalFileName);
        
        const newFilePath = targetSubfolder 
            ? `/uploads/quality-docs/${targetSubfolder}/${newPhysicalFileName}`
            : `/uploads/quality-docs/${newPhysicalFileName}`;
        
        if (fs.existsSync(sourcePath)) {
            fs.copyFileSync(sourcePath, destPath);
        }
        
        const [result] = await db.query(`
            INSERT INTO quality_documents (folder_id, file_name, file_path, file_size, uploader_name)
            VALUES (?, ?, ?, ?, ?)
        `, [target_folder_id, newFileName, newFilePath, sourceFile[0].file_size, sourceFile[0].uploader_name]);
        
        res.json({ id: result.insertId, message: 'File copied' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

