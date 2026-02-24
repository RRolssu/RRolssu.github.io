const fs = require('fs');
const path = require('path');
const db = require('./db');
const bcrypt = require('bcrypt');

async function initDB() {
    try {
        const schemaPath = path.join(__dirname, '../../database/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // 여러 쿼리를 실행하기 위해 split (세미콜론 기준)
        const queries = schemaSql.split(';').filter(query => query.trim() !== '');

        for (const query of queries) {
            await db.query(query);
        }
        
        // ★★★★ 추가: 구성원 초기 데이터 시딩 ★★★★
        await seedEmployees();

    } catch (err) {
        console.error('Database initialization failed:', err);
    }
}

// ★★★★ 추가: 구성원 데이터 시딩 함수 ★★★★
async function seedEmployees() {
    try {
        // 이미 데이터가 있는지 확인
        const [existing] = await db.query('SELECT COUNT(*) as count FROM employees');
        if (existing[0].count > 0) {
            console.log('Employees already seeded, skipping...');
            return;
        }

        // 비밀번호 해시 생성 (1234)
        const hashedPassword = await bcrypt.hash('1234', 10);
        
        // 구성원 데이터
        const employees = [
            // 대표이사
            { email: '1000@inter-mac.co.kr', name: '천성관', position: '대표이사', department: null, is_admin: true, is_superadmin: true },
            // 관리자 계정
            { email: 'intermac', name: 'Admin', position: null, department: null, is_admin: true, is_superadmin: true },
            // 임원
            { email: 'cojang@inter-mac.co.kr', name: '장창옥', position: '이사', department: null, is_admin: false, is_superadmin: false },
            { email: 'kimiskra@inter-mac.co.kr', name: '김지용', position: '전무', department: null, is_admin: false, is_superadmin: false },
            { email: 'jdcmbc@hanmail.net', name: '정동춘', position: '실장', department: null, is_admin: false, is_superadmin: false },
            // 경영지원팀
            { email: 'usd@inter-mac.co.kr', name: '엄순덕', position: '부장', department: '경영지원팀', is_admin: false, is_superadmin: false },
            { email: 'dek1012@inter-mac.co.kr', name: '도은경', position: '대리', department: '경영지원팀', is_admin: false, is_superadmin: false },
            { email: 'jihye@inter-mac.co.kr', name: '황지혜', position: '사원', department: '경영지원팀', is_admin: false, is_superadmin: false },
            // 기획팀
            { email: 'dudn@inter-mac.co.kr', name: '김미성', position: '과장', department: '기획팀', is_admin: false, is_superadmin: false },
            { email: 'dbgn363@inter-mac.co.kr', name: '이동기', position: '대리', department: '기획팀', is_admin: false, is_superadmin: false },
            { email: 'chan00@inter-mac.co.kr', name: '임현찬', position: '사원', department: '기획팀', is_admin: false, is_superadmin: false },
            // 기술지원팀
            { email: 'byeom@inter-mac.co.kr', name: '엄병용', position: '차장', department: '기술지원팀', is_admin: false, is_superadmin: false },
            { email: 'dhyun@inter-mac.co.kr', name: '신대현', position: '대리', department: '기술지원팀', is_admin: false, is_superadmin: false },
            // 생산기술팀
            { email: '1007@inter-mac.co.kr', name: '편재성', position: '부장', department: '생산기술팀', is_admin: false, is_superadmin: false },
            { email: 'ahn0006@inter-mac.co.kr', name: '안영태', position: '과장', department: '생산기술팀', is_admin: false, is_superadmin: false },
            { email: 'ojh@inter-mac.co.kr', name: '오정훈', position: '대리', department: '생산기술팀', is_admin: false, is_superadmin: false },
            { email: 'th.eom@inter-mac.co.kr', name: '엄태호', position: '주임', department: '생산기술팀', is_admin: false, is_superadmin: false },
            { email: 'kja79@inter-mac.co.kr', name: '김지애', position: '사원', department: '생산기술팀', is_admin: false, is_superadmin: false },
            { email: 'kyj79@inter-mac.co.kr', name: '김윤정', position: '사원', department: '생산기술팀', is_admin: false, is_superadmin: false },
            { email: 'myeongsu@inter-mac.co.kr', name: '김명수', position: '사원', department: '생산기술팀', is_admin: false, is_superadmin: false },
            { email: 'dlwlgus41@inter-mac.co.kr', name: '이지유', position: '사원', department: '생산기술팀', is_admin: false, is_superadmin: false },
            // 품질관리팀
            { email: 'ytlim@inter-mac.co.kr', name: '임윤택', position: '과장', department: '품질관리팀', is_admin: false, is_superadmin: false },
            { email: 'miwora@inter-mac.co.kr', name: '강남훈', position: '대리', department: '품질관리팀', is_admin: false, is_superadmin: false },
            { email: 'xellos7624@inter-mac.co.kr', name: '박준범', position: '주임', department: '품질관리팀', is_admin: false, is_superadmin: false },
            { email: 'jhes1010@inter-mac.co.kr', name: '정종훈', position: '사원', department: '품질관리팀', is_admin: false, is_superadmin: false },
            { email: 'eun419@inter-mac.co.kr', name: '이가은', position: '사원', department: '품질관리팀', is_admin: false, is_superadmin: false },
            // 소프트웨어개발팀
            { email: 'dotmh94@inter-mac.co.kr', name: '최해창', position: '대리', department: '소프트웨어개발팀', is_admin: false, is_superadmin: false },
            { email: 'ryechan2028@inter-mac.co.kr', name: '류예찬', position: '주임', department: '소프트웨어개발팀', is_admin: false, is_superadmin: false },
            { email: 'cmc9804@inter-mac.co.kr', name: '최민철', position: '사원', department: '소프트웨어개발팀', is_admin: false, is_superadmin: false },
            { email: 'dongkyu5258@inter-mac.co.kr', name: '이동규', position: '사원', department: '소프트웨어개발팀', is_admin: false, is_superadmin: false },
            { email: 'junhoo@inter-mac.co.kr', name: '박준후', position: '사원', department: '소프트웨어개발팀', is_admin: false, is_superadmin: false },
            { email: 'wks12wks@inter-mac.co.kr', name: '이태수', position: '사원', department: '소프트웨어개발팀', is_admin: false, is_superadmin: false },
            // 하드웨어개발팀
            { email: 'kim86@inter-mac.co.kr', name: '김정우', position: '과장', department: '하드웨어개발팀', is_admin: false, is_superadmin: false },
            { email: 'nh0201@inter-mac.co.kr', name: '김나현', position: '대리', department: '하드웨어개발팀', is_admin: false, is_superadmin: false },
            { email: 'dud2@inter-mac.co.kr', name: '정다영', position: '대리', department: '하드웨어개발팀', is_admin: false, is_superadmin: false },
            { email: 'ryeori@inter-mac.co.kr', name: '김상렬', position: '대리', department: '하드웨어개발팀', is_admin: false, is_superadmin: false },
            { email: 'mentor0203@inter-mac.co.kr', name: '김태규', position: '사원', department: '하드웨어개발팀', is_admin: false, is_superadmin: false },
            { email: 'dlwjddk1@inter-mac.co.kr', name: '이정아', position: '사원', department: '하드웨어개발팀', is_admin: false, is_superadmin: false },
            { email: 'sy9176@inter-mac.co.kr', name: '이소연', position: '사원', department: '하드웨어개발팀', is_admin: false, is_superadmin: false }
        ];

        // 데이터 삽입
        for (const emp of employees) {
            await db.query(`
                INSERT INTO employees (email, password, name, position, department, is_active, is_admin, is_superadmin)
                VALUES (?, ?, ?, ?, ?, TRUE, ?, ?)
            `, [emp.email, hashedPassword, emp.name, emp.position, emp.department, emp.is_admin, emp.is_superadmin]);
        }

        console.log('Employees seeded successfully!');
    } catch (err) {
        console.error('Error seeding employees:', err);
    }
}

module.exports = initDB;