/**
 * 用户状态管理模块
 * 负责用户登录状态的管理、用户信息的缓存和同步
 * 作者：Nexus Mods 智能助手
 */

// 常量定义
const USER_STORAGE_KEYS = {
    USER_DATA: 'nexus_user_data',
    USER_TOKEN: 'nexus_user_token',
    LOGIN_TIME: 'nexus_login_time',
    REMEMBER_ME: 'nexus_remember_me',
    SAVED_EMAIL: 'nexus_saved_email',
    SAVED_ACCOUNT: 'nexus_saved_account'
};
const API_BASE_URL = 'http://127.0.0.1:7003';
const TOKEN_EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000; // 7天过期时间

/**
 * 用户管理器类
 */
class UserManager {
    constructor() {
        this.userData = null;
        this.token = null;
        this.isLoggedIn = false;
        this.loginCallbacks = [];
        this.logoutCallbacks = [];
        
        // 初始化
        this.init();
    }
    
    /**
     * 初始化用户管理器
     */
    init() {
        this.loadUserData();
        this.setupMessageListener();
        this.checkTokenExpiry();
    }
    
    /**
     * 加载用户数据
     */
    loadUserData() {
        try {
            const userDataStr = localStorage.getItem(USER_STORAGE_KEYS.USER_DATA);
            const token = localStorage.getItem(USER_STORAGE_KEYS.USER_TOKEN);
            const loginTime = localStorage.getItem(USER_STORAGE_KEYS.LOGIN_TIME);
            
            if (userDataStr && token && loginTime) {
                this.userData = JSON.parse(userDataStr);
                this.token = token;
                this.isLoggedIn = true;
                
                console.log('用户数据加载成功:', this.userData);
            } else {
                this.clearUserData();
            }
        } catch (error) {
            console.error('加载用户数据失败:', error);
            this.clearUserData();
        }
    }
    
    /**
     * 保存用户数据
     */
    saveUserData(userData) {
        try {
            this.userData = userData;
            this.token = userData.token;
            this.isLoggedIn = true;
            
            localStorage.setItem(USER_STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
            localStorage.setItem(USER_STORAGE_KEYS.USER_TOKEN, userData.token);
            localStorage.setItem(USER_STORAGE_KEYS.LOGIN_TIME, Date.now().toString());
            
            // 触发登录回调
            this.triggerLoginCallbacks(userData);
            
            console.log('用户数据保存成功');
            return true;
        } catch (error) {
            console.error('保存用户数据失败:', error);
            return false;
        }
    }
    
    /**
     * 清除用户数据
     */
    clearUserData() {
        const wasLoggedIn = this.isLoggedIn;
        
        this.userData = null;
        this.token = null;
        this.isLoggedIn = false;
        
        // 清除本地存储
        Object.values(USER_STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        
        // 如果之前是登录状态，触发登出回调
        if (wasLoggedIn) {
            this.triggerLogoutCallbacks();
        }
        
        console.log('用户数据已清除');
    }
    
    /**
     * 检查token是否过期
     */
    checkTokenExpiry() {
        if (!this.isLoggedIn) return;
        
        const loginTime = localStorage.getItem(USER_STORAGE_KEYS.LOGIN_TIME);
        if (!loginTime) {
            this.clearUserData();
            return;
        }
        
        const loginTimestamp = parseInt(loginTime);
        const currentTime = Date.now();
        
        if (currentTime - loginTimestamp > TOKEN_EXPIRE_TIME) {
            console.log('Token已过期，清除用户数据');
            this.clearUserData();
        }
    }
    
    /**
     * 设置消息监听器
     */
    setupMessageListener() {
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'USER_LOGIN_SUCCESS') {
                this.saveUserData(event.data.userData);
            }
        });
    }
    
    /**
     * 获取用户信息
     */
    getUserData() {
        return this.userData;
    }
    
    /**
     * 获取用户token
     */
    getToken() {
        return this.token;
    }
    
    /**
     * 检查是否已登录
     */
    isUserLoggedIn() {
        return this.isLoggedIn;
    }
    
    /**
     * 获取用户显示名称
     */
    getUserDisplayName() {
        if (!this.userData) return '';
        
        return this.userData.nickName || 
               this.userData.userName || 
               this.userData.email || 
               this.userData.account || 
               '用户';
    }
    
    /**
     * 获取用户头像URL
     */
    getUserAvatarUrl() {
        if (!this.userData) return '';
        return this.userData.avatarUrl || '';
    }
    
    /**
     * 获取用户邮箱
     */
    getUserEmail() {
        if (!this.userData) return '';
        return this.userData.email || '';
    }
    
    /**
     * 登出用户
     */
    async logout() {
        try {
            // 调用登出API
            const response = await fetch(API_BASE_URL+'/login/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'token': this.token
                }
            });
            
            const result = await response.json();
            console.log('登出API响应:', result);
        } catch (error) {
            console.error('调用登出API失败:', error);
        } finally {
            // 无论API调用是否成功，都清除本地数据
            this.clearUserData();
        }
    }
    
    /**
     * 打开登录窗口
     */
    openLoginWindow() {
        const loginUrl = chrome.runtime.getURL('user/user-auth.html');
        const windowFeatures = 'width=600,height=1000,scrollbars=yes,resizable=yes,centerscreen=yes';

        const loginWindow = window.open(loginUrl, 'nexus_login', windowFeatures);

        if (loginWindow) {
            loginWindow.focus();
        } else {
            console.error('无法打开登录窗口，可能被浏览器阻止');
            alert('无法打开登录窗口，请检查浏览器弹窗设置');
        }

        return loginWindow;
    }

    /**
     * 打开用户详情窗口
     */
    openProfileWindow() {
        if (!this.isLoggedIn) {
            console.warn('用户未登录，无法打开用户详情');
            alert('请先登录后再查看用户详情');
            return null;
        }

        // 构建URL，包含必要的参数以确保页面能够获取到用户信息
        const baseUrl = chrome.runtime.getURL('user/user-profile.html');
        const urlParams = new URLSearchParams();

        // 添加用户信息参数作为备用
        if (this.userData) {
            if (this.userData.userId) urlParams.set('userId', this.userData.userId);
            if (this.userData.userName) urlParams.set('userName', this.userData.userName);
            if (this.userData.account) urlParams.set('account', this.userData.account);
        }

        // 添加token参数作为备用
        if (this.token) {
            urlParams.set('token', this.token);
        }

        const profileUrl = urlParams.toString() ? `${baseUrl}?${urlParams.toString()}` : baseUrl;
        const windowFeatures = 'width=1000,height=800,scrollbars=yes,resizable=yes,centerscreen=yes';

        console.log('打开用户详情窗口，URL:', profileUrl);

        const profileWindow = window.open(profileUrl, 'nexus_profile', windowFeatures);

        if (profileWindow) {
            profileWindow.focus();

            // 等待窗口加载完成后，确保数据同步
            setTimeout(() => {
                try {
                    if (profileWindow && !profileWindow.closed) {
                        // 通过postMessage发送用户数据，确保数据传递
                        profileWindow.postMessage({
                            type: 'USER_DATA_SYNC',
                            userData: this.userData,
                            token: this.token
                        }, '*');
                        console.log('已向用户详情窗口发送数据同步消息');
                    }
                } catch (error) {
                    console.error('向用户详情窗口发送数据时出错:', error);
                }
            }, 1000);
        } else {
            console.error('无法打开用户详情窗口，可能被浏览器阻止');
            alert('无法打开用户详情窗口，请检查浏览器弹窗设置');
        }

        return profileWindow;
    }
    
    /**
     * 添加登录回调
     */
    onLogin(callback) {
        if (typeof callback === 'function') {
            this.loginCallbacks.push(callback);
        }
    }
    
    /**
     * 添加登出回调
     */
    onLogout(callback) {
        if (typeof callback === 'function') {
            this.logoutCallbacks.push(callback);
        }
    }
    
    /**
     * 移除登录回调
     */
    removeLoginCallback(callback) {
        const index = this.loginCallbacks.indexOf(callback);
        if (index > -1) {
            this.loginCallbacks.splice(index, 1);
        }
    }
    
    /**
     * 移除登出回调
     */
    removeLogoutCallback(callback) {
        const index = this.logoutCallbacks.indexOf(callback);
        if (index > -1) {
            this.logoutCallbacks.splice(index, 1);
        }
    }
    
    /**
     * 触发登录回调
     */
    triggerLoginCallbacks(userData) {
        this.loginCallbacks.forEach(callback => {
            try {
                callback(userData);
            } catch (error) {
                console.error('登录回调执行失败:', error);
            }
        });
    }
    
    /**
     * 触发登出回调
     */
    triggerLogoutCallbacks() {
        this.logoutCallbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('登出回调执行失败:', error);
            }
        });
    }
    
    /**
     * 获取用户统计信息
     */
    getUserStats() {
        if (!this.userData) return null;
        
        return {
            userId: this.userData.userId,
            isClockIn: this.userData.isClockIn,
            isUpdatePwd: this.userData.isUpdatePwd,
            loginTime: localStorage.getItem(USER_STORAGE_KEYS.LOGIN_TIME),
            rememberMe: localStorage.getItem(USER_STORAGE_KEYS.REMEMBER_ME) === 'true'
        };
    }
    
    /**
     * 更新用户信息
     */
    updateUserData(newData) {
        if (!this.userData) return false;
        
        try {
            // 合并新数据
            this.userData = { ...this.userData, ...newData };
            
            // 保存到本地存储
            localStorage.setItem(USER_STORAGE_KEYS.USER_DATA, JSON.stringify(this.userData));
            
            console.log('用户信息更新成功');
            return true;
        } catch (error) {
            console.error('更新用户信息失败:', error);
            return false;
        }
    }
    
    /**
     * 获取请求头（包含认证信息）
     */
    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.token) {
            headers['token'] = this.token;
        }

        return headers;
    }
    
    /**
     * 检查用户权限
     */
    hasPermission(permission) {
        if (!this.userData || !this.userData.buttonList) return false;
        
        return this.userData.buttonList.some(button => 
            button.idCode === permission || button.name === permission
        );
    }
    
    /**
     * 获取用户菜单
     */
    getUserMenus() {
        if (!this.userData || !this.userData.menuList) return [];
        return this.userData.menuList;
    }
    
    /**
     * 获取用户按钮权限
     */
    getUserButtons() {
        if (!this.userData || !this.userData.buttonList) return [];
        return this.userData.buttonList;
    }
}

// 创建全局用户管理器实例
const userManager = new UserManager();

// 导出用户管理器
if (typeof module !== 'undefined' && module.exports) {
    module.exports = userManager;
} else if (typeof window !== 'undefined') {
    window.userManager = userManager;
}

// 定期检查token过期
setInterval(() => {
    userManager.checkTokenExpiry();
}, 60000); // 每分钟检查一次
