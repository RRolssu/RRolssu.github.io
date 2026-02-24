
function loadNavbar() {
    fetch('/nav.html')
        .then(response => response.text())
        .then(data => {
            document.getElementById('navbar-container').innerHTML = data;
            
            const currentPage = window.location.pathname;
            const navLinks = document.querySelectorAll('.navbar-nav .nav-link');

            navLinks.forEach(link => {
                const isDropdownToggle = link.classList.contains('dropdown-toggle');

                if (isDropdownToggle) {
                    const dropdownMenu = link.nextElementSibling;
                    if (dropdownMenu) {
                        const dropdownItems = dropdownMenu.querySelectorAll('a.dropdown-item');
                        let isChildActive = false;
                        dropdownItems.forEach(item => {
                            if (new URL(item.href).pathname === currentPage) {
                                isChildActive = true;
                            }
                        });

                        if (isChildActive) {
                            link.classList.add('active');
                        } else {
                            link.classList.remove('active');
                        }
                    }
                } else {
                    const linkPath = new URL(link.href).pathname;
                    if (link.getAttribute('href') !== '#' && linkPath === currentPage) {
                        link.classList.add('active');
                    } else {
                        link.classList.remove('active');
                    }
                }
            });

            // After navbar is loaded, also initialize auth-related functionalities
            const user = getCurrentUser();
            if (user) {
                const userNameDisplay = document.getElementById('userNameDisplay');
                if (userNameDisplay) {
                    userNameDisplay.textContent = user.name || '사용자';
                }
                
                const adminLink = document.querySelector('a.dropdown-item[href="/admin"]');
                if (adminLink && user && !user.is_superadmin) {
                    adminLink.parentElement.style.display = 'none';
                }
                const managementNav = document.getElementById('nav-management');
                const canSeeManagement = user && (user.name === '황지혜' || user.name === 'Admin');
                if (managementNav && user && !canSeeManagement) {
                    managementNav.style.display = 'none';
                }
            }
        })
        .catch(error => {
            console.error('Error loading the navbar:', error);
        });
}

function openChangePasswordModal() {
    const user = getCurrentUser();
    if (!user) {
        alert('로그인이 필요합니다.');
        return;
    }
    
    const modalHtml = `
        <div class="modal fade" id="changePasswordModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title"><i class="bi bi-key me-2"></i>비밀번호 변경</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="changePasswordForm">
                            <div class="mb-3">
                                <label class="form-label">현재 비밀번호 <span class="text-danger">*</span></label>
                                <input type="password" class="form-control" id="currentPassword" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">새 비밀번호 <span class="text-danger">*</span></label>
                                <input type="password" class="form-control" id="newPassword" required minlength="4">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">새 비밀번호 확인 <span class="text-danger">*</span></label>
                                <input type="password" class="form-control" id="confirmPassword" required minlength="4">
                            </div>
                            <button type="submit" class="btn btn-primary w-100">변경</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 기존 모달 제거
    const existingModal = document.getElementById('changePasswordModal');
    if (existingModal) existingModal.remove();
    
    // 모달 추가
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 폼 제출 이벤트
    document.getElementById('changePasswordForm').onsubmit = async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (newPassword !== confirmPassword) {
            alert('새 비밀번호가 일치하지 않습니다.');
            return;
        }
        
        try {
            const res = await fetch(`/api/employees/${user.id}/change-password`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
            });
            
            const result = await res.json();
            
            if (res.ok) {
                alert('비밀번호가 변경되었습니다.');
                bootstrap.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
                document.getElementById('changePasswordForm').reset();
            } else {
                alert(result.error || '비밀번호 변경에 실패했습니다.');
            }
        } catch (err) {
            console.error('비밀번호 변경 실패:', err);
            alert('비밀번호 변경에 실패했습니다.');
        }
    };
    
    const modal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
    modal.show();
}

document.addEventListener('DOMContentLoaded', loadNavbar);
