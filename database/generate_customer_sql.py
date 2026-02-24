# ★★★★ 추가: JPG 파일명에서 회사명을 추출하여 SQL INSERT 문 생성 ★★★★
import os
from pathlib import Path

# JPG 폴더 경로
JPG_DIR = Path(__file__).parent.parent / "5.업체_사업자등록증_JPG"
OUTPUT_FILE = Path(__file__).parent / "customers_all.sql"

# 이미 상세 정보가 추출된 회사명 목록 (사업자등록번호가 있는 회사)
ALREADY_EXTRACTED = [
    '가이아시스템', '강원전자', '거전산업', '건영씨엔씨', '경남테크노파크',
    '경동사', '경동이앤에스', '경북테크노파크', '경주풍력', '계원산업',
    '고경3호태양광', '고려특운', '공진', '광명목재', '광명토탈엔지니어링',
    '광민솔라', '국립한국해양대학교', '금강오토텍', '금산1호 태양광발전소',
    '금호1호 태양광발전소', '기드텍', '길산전', '김택동.송명희태양광발전소',
    '나우공조시스템', '남구재활용센터', '남전사', '내동태양광발전소',
    '노벨리스코리아', '누리기전', '대하인터내셔널', '디베랴', '디엠테크윈',
    '다래이앤씨', '다만테크', '다보코퍼레이션', '다성태양광발전소',
    '다스코리아', '다안일렉트레이드', '다영자동화기기', '다온', '다온플러스',
    '다우코퍼레이션', '다운전자', '다이후쿠코리아', '다임테크', '대건소프트',
    '대경엔지니어링', '대관령풍력주식회사', '대광 ENG',
    '다미인테리어'  # 손상된 파일 - 건너뛰기
]

def clean_company_name(filename):
    """파일명에서 회사명 정리"""
    # .jpg 제거
    name = filename.replace('.jpg', '')
    # 불필요한 문자열 제거
    name = name.replace('사업자등록증', '').replace('(주소변경)', '')
    name = name.replace('2023 ', '').replace('2024년', '').replace('(2)', '')
    name = name.strip()
    return name

def generate_sql():
    """파일명에서 회사명을 추출하여 SQL 생성"""
    
    companies = []
    
    # 모든 하위 폴더 순회
    for subdir in sorted(JPG_DIR.iterdir()):
        if subdir.is_dir():
            for jpg_file in sorted(subdir.glob("*.jpg")):
                company_name = clean_company_name(jpg_file.name)
                
                # 이미 추출된 회사는 건너뛰기
                skip = False
                for extracted in ALREADY_EXTRACTED:
                    if extracted in company_name or company_name in extracted:
                        skip = True
                        break
                
                if not skip:
                    companies.append(company_name)
    
    # SQL 파일 생성
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write("-- ★★★★ 추가: 파일명에서 추출한 나머지 회사 데이터 (회사명만) ★★★★\n")
        f.write("-- 사업자등록번호, 주소, 개업일, 대표자는 추후 업데이트 필요\n\n")
        
        # 50개씩 배치로 INSERT
        batch_size = 50
        for i in range(0, len(companies), batch_size):
            batch = companies[i:i+batch_size]
            
            f.write(f"-- 배치 {i//batch_size + 1}\n")
            f.write("INSERT INTO customers (name) VALUES\n")
            
            values = []
            for name in batch:
                # SQL 이스케이프
                escaped_name = name.replace("'", "''")
                values.append(f"('{escaped_name}')")
            
            f.write(",\n".join(values))
            f.write("\nON DUPLICATE KEY UPDATE name = VALUES(name);\n\n")
    
    print(f"✅ SQL 파일 생성 완료: {OUTPUT_FILE}")
    print(f"📊 총 {len(companies)}개 회사 추가")

if __name__ == "__main__":
    generate_sql()

