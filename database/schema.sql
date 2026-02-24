-- 1. 고객사 테이블 (Customer Management)
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '회사명 (상호)',
    business_registration_number VARCHAR(20) COMMENT '사업자등록번호 (예: 303-25-93610)',
    address VARCHAR(300) COMMENT '사업장 소재지',
    establishment_date DATE COMMENT '개업 연월일',
    representative_name VARCHAR(50) COMMENT '대표자명',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_business_reg_num (business_registration_number)
);

-- 2. 프로젝트 테이블 (Project Management)
CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_code VARCHAR(50) NOT NULL UNIQUE COMMENT '프로젝트 코드 (예: AC24-200)',
    name VARCHAR(200) NOT NULL COMMENT '프로젝트명',
    customer_id INT NOT NULL COMMENT '고객사 ID (Foreign Key)',
    product_type VARCHAR(50) COMMENT '제품유형 (예: 수소연료전지)',
    status VARCHAR(20) DEFAULT 'In Progress' COMMENT '상태 (진행중/완료)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL COMMENT '프로젝트 ID (Foreign Key)',
    doc_type VARCHAR(50) NOT NULL COMMENT '문서 유형 (도면/사양서/요구사항/S/W버전 등)',
    title VARCHAR(200) NOT NULL COMMENT '문서 제목',
    description TEXT COMMENT '설명',
    file_path VARCHAR(500) COMMENT '파일 경로',
    version VARCHAR(50) COMMENT '버전 (S/W 버전 관리용)',
    uploader_name VARCHAR(50) NOT NULL COMMENT '올린 사람',
    uploader_dept VARCHAR(50) COMMENT '올린 사람 부서',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '업로드 날짜',
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 3. 컴플레인 테이블 (Complaint Details)
CREATE TABLE IF NOT EXISTS complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_no VARCHAR(50) NOT NULL UNIQUE COMMENT '컴플레인 번호 (예: CP-20251210-01)',
    project_id INT NOT NULL COMMENT '프로젝트 ID (Foreign Key)',
    
    -- 기본 정보
    title VARCHAR(200) NOT NULL COMMENT '제목 (예: PDU볼트 파손)',
    status VARCHAR(20) DEFAULT '접수' COMMENT '현재 상태 (접수, 진행중, 조치완료 등)',
    manager_name VARCHAR(50) COMMENT '현재 담당자',
    received_date DATE NOT NULL COMMENT '접수일',
    
    -- 상세 내용
    description TEXT COMMENT '상세 내용',
    customer_request TEXT COMMENT '고객 요청사항',
    
    -- ISO 9001 CAPA 정보 제거됨
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- 4. 조치 이력 테이블 (Action History)
CREATE TABLE IF NOT EXISTS complaint_actions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    complaint_id INT NOT NULL COMMENT '컴플레인 ID (Foreign Key)',
    action_no VARCHAR(50) COMMENT '조치 번호 (예: ACT-CP-20251210-01-01)',
    
    action_type VARCHAR(50) NOT NULL COMMENT '조치 유형 (접수, 분석, 조치 등)',
    status_change VARCHAR(50) COMMENT '상태 변경 (예: 접수 -> 진행중)',
    manager_name VARCHAR(50) COMMENT '조치 담당자',
    
    title VARCHAR(200) NOT NULL COMMENT '조치 제목',
    content TEXT NOT NULL COMMENT '조치 내용',
    
    expected_date DATE COMMENT '예정 완료일',
    actual_date DATE COMMENT '실제 완료일',
    
    man_hours DECIMAL(10, 1) COMMENT '투입 공수 (시간)',
    cost DECIMAL(15, 2) COMMENT '소요 비용 (원)',
    
    attachment_path VARCHAR(255) COMMENT '첨부파일 경로',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS receptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reception_no VARCHAR(50) NOT NULL UNIQUE COMMENT '접수 번호 (예: REC-20251210-01)',
    
    -- 기본 정보
    title VARCHAR(200) NOT NULL COMMENT '제목',
    reception_date DATE NOT NULL COMMENT '접수일',
    department VARCHAR(50) NOT NULL COMMENT '접수 부서',
    receptionist VARCHAR(50) NOT NULL COMMENT '접수자',
    customer_name VARCHAR(100) NOT NULL COMMENT '고객명',
    
    -- 요청 기한
    deadline DATE COMMENT '요청 기한',
    is_urgent BOOLEAN DEFAULT FALSE COMMENT '긴급 여부',
    
    -- 내용
    content TEXT NOT NULL COMMENT '내용',
    
    -- 파일 첨부
    attachment_path VARCHAR(500) COMMENT '첨부파일 경로',
    
    -- 접수 경로 (메일/유선/현장발생)
    reception_channel ENUM('메일', '유선', '현장발생') NOT NULL COMMENT '접수 경로',
    
    -- 부서 확인 상태
    dept_confirmed BOOLEAN DEFAULT FALSE COMMENT '특정 부서 확인 여부',
    dept_confirmed_by VARCHAR(50) COMMENT '확인한 사람',
    dept_confirmed_at TIMESTAMP COMMENT '확인 날짜',
    
    -- 컴플레인으로 이동 여부
    moved_to_complaint BOOLEAN DEFAULT FALSE COMMENT '컴플레인으로 이동 여부',
    complaint_id INT COMMENT '연결된 컴플레인 ID',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

--  품질문서 폴더 테이블 
CREATE TABLE IF NOT EXISTS quality_folders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL COMMENT '폴더명',
    parent_id INT COMMENT '상위 폴더 ID (NULL이면 루트 분류)',
    root_category VARCHAR(50) COMMENT '루트 분류 (인증/심사, 품질 경영, 검사/시험, 고객 요구 사항서, 부적합 보고서)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES quality_folders(id) ON DELETE CASCADE
);

--  품질문서 파일 테이블 
CREATE TABLE IF NOT EXISTS quality_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    folder_id INT NOT NULL COMMENT '폴더 ID',
    file_name VARCHAR(255) NOT NULL COMMENT '파일명',
    file_path VARCHAR(500) NOT NULL COMMENT '파일 경로',
    file_size BIGINT COMMENT '파일 크기 (bytes)',
    uploader_name VARCHAR(50) COMMENT '업로더 이름',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (folder_id) REFERENCES quality_folders(id) ON DELETE CASCADE
);

--  회사 구성원 테이블 (Employees) 
CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE COMMENT '이메일 (로그인 ID)',
    password VARCHAR(255) NOT NULL COMMENT '비밀번호 (해시)',
    name VARCHAR(50) NOT NULL COMMENT '이름',
    position VARCHAR(50) COMMENT '직급 (대표이사, 전무, 이사, 부장, 차장, 과장, 대리, 주임, 사원 등)',
    department VARCHAR(50) COMMENT '부서',
    phone VARCHAR(20) COMMENT '전화번호',
    is_active BOOLEAN DEFAULT TRUE COMMENT '활성 상태',
    is_admin BOOLEAN DEFAULT FALSE COMMENT '관리자 여부',
    is_superadmin BOOLEAN DEFAULT FALSE COMMENT '슈퍼관리자 여부',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_department (department)
);

-- 수주대장 테이블
CREATE TABLE IF NOT EXISTS order_book_imports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    year INT NOT NULL COMMENT '연도 (2024, 2025, 2026)',
    headers_json TEXT NOT NULL,
    rows_json LONGTEXT NOT NULL,
    row_count INT NOT NULL,
    merge_cells_json TEXT NULL COMMENT 'Handsontable mergeCells 배열 JSON',
    body_styles_json LONGTEXT NULL COMMENT '셀별 배경색 등 스타일 배열 JSON',
    INDEX idx_year (year)
);



