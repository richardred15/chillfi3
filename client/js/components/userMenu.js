import Modal from './modal.js';

/**
 * User Menu Component
 */
export default class UserMenu {
    constructor(toast) {
        this.userMenu = document.getElementById('userMenu');
        this.userDropdown = document.querySelector('.user-dropdown');
        this.viewProfileButton = document.getElementById('viewProfileButton');
        this.logoutButton = document.getElementById('logoutButton');
        this.toast = toast;
        
        // Create modal instances
        this.profileModal = new Modal('profilePopup');
        this.resetPasswordModal = new Modal('resetPasswordModal');
        
        this.init();
    }
    
    init() {
        // Toggle user dropdown
        if (this.userMenu) {
            this.userMenu.addEventListener('click', this.toggleDropdown.bind(this));
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', this.closeDropdownIfOutside.bind(this));
        
        // View Profile button
        if (this.viewProfileButton) {
            this.viewProfileButton.addEventListener('click', this.showProfile.bind(this));
        }
        
        // Reset Password button
        const resetPasswordButton = document.getElementById('resetPasswordButton');
        if (resetPasswordButton) {
            resetPasswordButton.addEventListener('click', this.showResetPassword.bind(this));
        }
        
        // Logout button
        if (this.logoutButton) {
            this.logoutButton.addEventListener('click', this.logout.bind(this));
        }
        
        // Profile edit buttons
        this.initProfileEditButtons();
    }
    
    toggleDropdown(e) {
        e.stopPropagation();
        this.userDropdown.classList.toggle('show');
    }
    
    closeDropdownIfOutside(e) {
        if (!this.userMenu.contains(e.target)) {
            this.userDropdown.classList.remove('show');
        }
    }
    
    async showProfile() {
        this.profileModal.show();
        this.userDropdown.classList.remove('show');
        
        // Load current user profile data
        await this.loadProfileData();
    }
    
    async loadProfileData() {
        try {
            const userId = window.authManager?.user?.id;
            if (!userId) return;
            
            const response = await window.api.getUserProfile(userId);
            console.log('Profile data loaded:', response);
            
            if (response.user) {
                this.updateProfileDisplay(response.user);
            }
        } catch (error) {
            console.error('Failed to load profile data:', error);
        }
    }
    
    updateProfileDisplay(user) {
        // Update profile name
        const profileName = document.querySelector('.profile-name');
        if (profileName) {
            profileName.textContent = user.display_name || user.username;
        }
        
        // Update bio
        const profileBio = document.querySelector('.profile-bio p');
        if (profileBio) {
            profileBio.textContent = user.bio || 'No bio yet';
        }
        
        // Update profile avatar
        const profileAvatar = document.querySelector('.profile-avatar');
        if (profileAvatar && user.profile_image_url) {
            profileAvatar.style.backgroundImage = `url(${user.profile_image_url})`;
            profileAvatar.style.backgroundSize = 'cover';
            profileAvatar.style.backgroundPosition = 'center';
            profileAvatar.textContent = '';
        } else if (profileAvatar) {
            // Show initial if no profile image
            const initial = (user.display_name || user.username || 'U').charAt(0).toUpperCase();
            profileAvatar.textContent = initial;
            profileAvatar.style.backgroundImage = '';
        }
    }
    
    showResetPassword() {
        this.resetPasswordModal.show();
        this.userDropdown.classList.remove('show');
        
        // Set username for password manager
        const hiddenUsername = document.getElementById('hiddenUsername');
        if (hiddenUsername && window.authManager?.user?.username) {
            hiddenUsername.value = window.authManager.user.username;
        }
        
        this.initResetPasswordForm();
    }
    
    initResetPasswordForm() {
        const form = document.getElementById('resetPasswordForm');
        const errorDiv = document.getElementById('resetPasswordError');
        
        if (!form) return;
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const currentPassword = form.currentPassword.value;
            const newPassword = form.newPassword.value;
            const confirmPassword = form.confirmPassword.value;
            
            errorDiv.style.display = 'none';
            
            // Validate passwords match
            if (newPassword !== confirmPassword) {
                errorDiv.textContent = 'New passwords do not match';
                errorDiv.style.display = 'block';
                return;
            }
            
            // Validate password length
            if (newPassword.length < 6) {
                errorDiv.textContent = 'New password must be at least 6 characters';
                errorDiv.style.display = 'block';
                return;
            }
            
            const submitButton = form.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Resetting...';
            
            try {
                const response = await window.api.resetPassword(currentPassword, newPassword);
                
                if (response.success) {
                    this.toast.show('Password reset successfully. Please log in again.');
                    this.resetPasswordModal.hide();
                    
                    // Clear form
                    form.reset();
                    
                    // Clear token and force logout
                    localStorage.removeItem('chillfi_token');
                    window.api.token = null;
                    window.api.user = null;
                    
                    // Reload page to show login
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                } else {
                    errorDiv.textContent = response.message || 'Failed to reset password';
                    errorDiv.style.display = 'block';
                }
            } catch (error) {
                console.error('Reset password error:', error);
                errorDiv.textContent = 'Failed to reset password';
                errorDiv.style.display = 'block';
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Reset Password';
            }
        });
    }
    
    logout() {
        this.toast.show('Logged out successfully');
        this.userDropdown.classList.remove('show');
    }
    
    initProfileEditButtons() {
        // Avatar edit button
        const editAvatarButton = document.getElementById('editAvatarButton');
        if (editAvatarButton) {
            editAvatarButton.addEventListener('click', () => {
                this.triggerAvatarUpload();
            });
        }
        
        // Display name edit button
        const editNameButton = document.getElementById('editNameButton');
        if (editNameButton) {
            editNameButton.addEventListener('click', () => {
                this.editDisplayName();
            });
        }
        
        // Bio edit button
        const editBioButton = document.getElementById('editBioButton');
        if (editBioButton) {
            editBioButton.addEventListener('click', () => {
                this.editBio();
            });
        }
    }
    
    triggerAvatarUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => this.handleAvatarUpload(e.target.files[0]);
        input.click();
    }
    
    async handleAvatarUpload(file) {
        if (!file) return;
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.toast.show('Please select an image file');
            return;
        }
        
        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            this.toast.show('Image must be smaller than 5MB');
            return;
        }
        
        const userId = window.authManager?.user?.id;
        if (!userId) {
            this.toast.show('User not authenticated');
            return;
        }
        
        try {
            // Show loading state
            this.toast.show('Uploading avatar...');
            
            // Use the chunked image upload system
            const uploadId = `avatar_${userId}_${Date.now()}`;
            const response = await this.uploadImageInChunks(file, uploadId, 'profiles');
            
            if (response.success) {
                // Update user profile with new image URL
                const updateResponse = await window.api.updateUser(userId, { 
                    profile_image_url: response.imageUrl 
                });
                
                if (updateResponse.success) {
                    this.updateAvatarDisplay(response.imageUrl);
                    this.toast.show('Avatar updated successfully');
                } else {
                    this.toast.show('Failed to update profile');
                }
            } else {
                this.toast.show(response.message || 'Failed to upload avatar');
            }
        } catch (error) {
            console.error('Avatar upload error:', error);
            this.toast.show('Failed to upload avatar');
        }
    }
    
    async uploadImageInChunks(file, uploadId, folder = 'profiles') {
        const CHUNK_SIZE = 64 * 1024; // 64KB chunks
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        
        try {
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                const start = chunkIndex * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);
                
                // Convert chunk to base64
                const chunkData = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.readAsDataURL(chunk);
                });
                
                const response = await window.api.uploadImageChunk({
                    uploadId,
                    chunkIndex,
                    totalChunks,
                    data: chunkData,
                    filename: `${folder}/${uploadId}.${file.name.split('.').pop()}`,
                    mimeType: file.type
                });
                
                if (!response.success) {
                    throw new Error(response.message || 'Chunk upload failed');
                }
                
                // Return final response if this was the last chunk
                if (response.imageUrl) {
                    return response;
                }
            }
        } catch (error) {
            console.error('Chunked upload error:', error);
            throw error;
        }
    }
    
    updateAvatarDisplay(imageUrl) {
        const avatars = document.querySelectorAll('.profile-avatar, .user-avatar');
        avatars.forEach(avatar => {
            avatar.style.backgroundImage = `url(${imageUrl})`;
            avatar.style.backgroundSize = 'cover';
            avatar.style.backgroundPosition = 'center';
            avatar.textContent = '';
        });
    }
    
    editDisplayName() {
        const profileName = document.querySelector('.profile-name');
        if (!profileName) return;
        
        const currentName = profileName.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.style.background = 'var(--bg-primary)';
        input.style.border = '1px solid var(--border-color)';
        input.style.borderRadius = '4px';
        input.style.padding = '4px 8px';
        input.style.color = 'var(--text-primary)';
        input.style.fontSize = 'inherit';
        input.style.fontWeight = 'inherit';
        
        profileName.replaceWith(input);
        input.focus();
        input.select();
        
        const saveChanges = async () => {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                try {
                    const userId = window.authManager?.user?.id;
                    const response = await window.api.updateUser(userId, { display_name: newName });
                    
                    if (response.success) {
                        // Update local user data
                        if (window.authManager?.user) {
                            window.authManager.user.display_name = newName;
                        }
                        
                        // Update UI
                        const newProfileName = document.createElement('div');
                        newProfileName.className = 'profile-name';
                        newProfileName.textContent = newName;
                        input.replaceWith(newProfileName);
                        
                        // Update header display
                        const userName = document.querySelector('.user-name');
                        if (userName) {
                            userName.textContent = newName;
                        }
                        
                        this.toast.show('Display name updated successfully');
                    } else {
                        throw new Error(response.message || 'Failed to update display name');
                    }
                } catch (error) {
                    console.error('Display name update error:', error);
                    this.toast.show('Failed to update display name');
                    
                    // Revert to original name
                    const revertedName = document.createElement('div');
                    revertedName.className = 'profile-name';
                    revertedName.textContent = currentName;
                    input.replaceWith(revertedName);
                }
            } else {
                // Revert if no change or empty
                const revertedName = document.createElement('div');
                revertedName.className = 'profile-name';
                revertedName.textContent = currentName;
                input.replaceWith(revertedName);
            }
        };
        
        input.addEventListener('blur', saveChanges);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                const revertedName = document.createElement('div');
                revertedName.className = 'profile-name';
                revertedName.textContent = currentName;
                input.replaceWith(revertedName);
            }
        });
    }
    
    editBio() {
        const profileBio = document.querySelector('.profile-bio p');
        if (!profileBio) return;
        
        const currentBio = profileBio.textContent;
        const textarea = document.createElement('textarea');
        textarea.value = currentBio;
        textarea.style.background = 'var(--bg-primary)';
        textarea.style.border = '1px solid var(--border-color)';
        textarea.style.borderRadius = '4px';
        textarea.style.padding = '8px';
        textarea.style.color = 'var(--text-primary)';
        textarea.style.fontSize = 'inherit';
        textarea.style.fontFamily = 'inherit';
        textarea.style.lineHeight = '1.6';
        textarea.style.width = '100%';
        textarea.style.minHeight = '60px';
        textarea.style.resize = 'vertical';
        
        profileBio.replaceWith(textarea);
        textarea.focus();
        textarea.select();
        
        const saveChanges = async () => {
            const newBio = textarea.value.trim();
            if (newBio !== currentBio) {
                try {
                    const userId = window.authManager?.user?.id;
                    const response = await window.api.updateUser(userId, { bio: newBio });
                    
                    if (response.success) {
                        // Update local user data
                        if (window.authManager?.user) {
                            window.authManager.user.bio = newBio;
                        }
                        
                        // Update UI
                        const newProfileBio = document.createElement('p');
                        newProfileBio.textContent = newBio || 'No bio yet';
                        textarea.replaceWith(newProfileBio);
                        
                        this.toast.show('Bio updated successfully');
                    } else {
                        throw new Error(response.message || 'Failed to update bio');
                    }
                } catch (error) {
                    console.error('Bio update error:', error);
                    this.toast.show('Failed to update bio');
                    
                    // Revert to original bio
                    const revertedBio = document.createElement('p');
                    revertedBio.textContent = currentBio;
                    textarea.replaceWith(revertedBio);
                }
            } else {
                // Revert if no change
                const revertedBio = document.createElement('p');
                revertedBio.textContent = currentBio;
                textarea.replaceWith(revertedBio);
            }
        };
        
        textarea.addEventListener('blur', saveChanges);
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const revertedBio = document.createElement('p');
                revertedBio.textContent = currentBio;
                textarea.replaceWith(revertedBio);
            }
        });
    }
}