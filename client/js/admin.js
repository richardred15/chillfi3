/**
 * Admin Panel Manager
 */
class AdminManager {
    constructor(api, toast) {
        this.api = api;
        this.toast = toast;
    }

    // Show admin panel
    showAdminPanel() {
        const modal = this.createAdminModal();
        document.body.appendChild(modal);
    }

    // Create admin modal
    createAdminModal() {
        const modal = document.createElement('div');
        modal.className = 'profile-popup show';
        modal.innerHTML = `
            <div class="profile-popup-header">
                <div class="profile-popup-title">Admin Panel</div>
                <button class="profile-popup-close" id="closeAdminButton">
                    <img src="client/icons/close.svg" alt="Close" width="16" height="16">
                </button>
            </div>
            <div class="profile-popup-content">
                <div class="admin-section">
                    <h3>Create New User</h3>
                    <form class="admin-form" id="createUserForm">
                        <div class="form-group">
                            <label for="newUsername">Username</label>
                            <input type="text" id="newUsername" name="username" required>
                        </div>
                        <div class="form-group">
                            <label for="newPassword">Password (optional)</label>
                            <input type="password" id="newPassword" name="password" placeholder="Leave empty to generate reset token">
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="isAdmin" name="isAdmin">
                                Admin User
                            </label>
                        </div>
                        <button type="submit" class="admin-button">Create User</button>
                    </form>
                    <div class="admin-result" id="createUserResult" style="display: none;"></div>
                </div>
            </div>
        `;



        // Handle close button
        const closeButton = modal.querySelector('#closeAdminButton');
        closeButton.addEventListener('click', () => {
            modal.remove();
        });
        
        // Handle click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Handle form submission
        const form = modal.querySelector('#createUserForm');
        const resultDiv = modal.querySelector('#createUserResult');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = form.username.value;
            const password = form.password.value || null;
            const isAdmin = form.isAdmin.checked;
            const submitButton = form.querySelector('.admin-button');
            
            submitButton.disabled = true;
            submitButton.textContent = 'Creating...';
            resultDiv.style.display = 'none';
            
            try {
                const response = await this.api.emit('auth:createUser', {
                    username,
                    password,
                    isAdmin
                });
                
                if (response.success) {
                    resultDiv.className = 'admin-result success';
                    let message = `User "${username}" created successfully!`;
                    if (response.resetToken) {
                        message += `\\nReset token: ${response.resetToken}`;
                    }
                    resultDiv.textContent = message;
                    form.reset();
                } else {
                    throw new Error(response.message || 'Failed to create user');
                }
            } catch (error) {
                resultDiv.className = 'admin-result error';
                resultDiv.textContent = error.message;
            } finally {
                resultDiv.style.display = 'block';
                submitButton.disabled = false;
                submitButton.textContent = 'Create User';
            }
        });

        return modal;
    }
}

export default AdminManager;