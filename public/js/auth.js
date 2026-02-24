// ★★★★ 공통 인증 JavaScript ★★★★

// 현재 로그인한 사용자 정보 가져오기
function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch {
        return null;
    }
}

// 로그인 체크 - 로그인 안되어있으면 로그인 페이지로 이동
function requireLogin() {
    const user = getCurrentUser();
    if (!user) {
        location.href = '/login.html';
        return false;
    }
    return true;
}

// 로그아웃
function logout() {
    if (confirm('로그아웃 하시겠습니까?')) {
        localStorage.removeItem('user');
        localStorage.removeItem('jwt_token'); 
        localStorage.removeItem('django_session'); 
        location.href = '/login.html';
    }
}

// 사용자 정보 표시 (네비게이션 바)
function displayUserInfo() {
    const user = getCurrentUser();
    if (!user) return;
    
    // 사용자 이름 표시 요소 찾기
    const userNameSpan = document.querySelector('.navbar .dropdown span');
    if (userNameSpan) {
        userNameSpan.textContent = user.name || '사용자';
    }
    
    // Admin 링크 표시/숨김 (관리자만)
    const adminLink = document.querySelector('a[href="/admin.html"]');
    if (adminLink && !user.is_superadmin) {
        adminLink.parentElement.style.display = 'none';
    }
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
    // 로그인 페이지가 아닌 경우에만 체크
    if (!window.location.pathname.includes('login.html')) {
        if (!requireLogin()) return;
        displayUserInfo();
    }
});

