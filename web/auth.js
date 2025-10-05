// ============= AUTHENTICATION FUNCTIONS =============
// 
// SECURITY NOTE: These client-side checks are ONLY for UX improvement.
// Real security is enforced server-side with requireAuth + requireAdmin middleware.
// All database API endpoints verify admin status on the server before processing requests.
// 
// Client-side bypass via developer tools WILL NOT grant actual database access.
// Server will return 403 Forbidden for non-admin users regardless of client-side manipulation.
//

// Check if user is authenticated and has admin access (UX only)
async function checkAuthentication() {
    try {
        console.log('🔐 Checking authentication (client-side UX check)...');
        
        const response = await fetch('/api/auth/user');
        const authData = await response.json();
        
        if (authData.authenticated && authData.user) {
            currentUser = authData.user;
            
            // Check if user is admin
            if (authData.user.is_admin) {
                console.log('✅ Admin access granted (UI will load, but server validates all requests):', authData.user.email);
                displayUserProfile(authData.user);
                return currentUser;
            } else {
                console.warn('⚠️ User is authenticated but not an admin:', authData.user.email);
                return null;
            }
        } else {
            console.log('❌ User not authenticated');
            return null;
        }
    } catch (error) {
        console.error('❌ Authentication check failed:', error);
        return null;
    }
}

// Show access denied message
function showAccessDenied() {
    const authLoading = document.getElementById('authLoading');
    const accessDenied = document.getElementById('accessDenied');
    const mainContent = document.getElementById('mainContent');
    
    if (authLoading) authLoading.classList.add('hidden');
    if (mainContent) mainContent.classList.add('hidden');
    if (accessDenied) accessDenied.classList.remove('hidden');
    
    // Display user email if available
    if (currentUser && currentUser.email) {
        const userEmailInfo = document.getElementById('userEmailInfo');
        if (userEmailInfo) {
            userEmailInfo.textContent = currentUser.email;
        }
    }
    
    // Start countdown for auto-redirect
    startRedirectCountdown();
}

// Display user profile in navbar
function displayUserProfile(user) {
    const userProfile = document.getElementById('userProfile');
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    const userAvatar = document.getElementById('userAvatar');
    
    if (userProfile && userName && userRole && userAvatar) {
        userName.textContent = user.name;
        userRole.textContent = user.is_admin ? 'Administrator' : 'User';
        
        const avatarUrl = user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=570df8&color=fff`;
        userAvatar.src = avatarUrl;
        
        userProfile.classList.remove('hidden');
    }
}
