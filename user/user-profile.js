/**
 * 用户详情页面逻辑
 * 作者：Nexus Mods 智能助手
 */

// 常量定义
const API_BASE_URL = 'http://127.0.0.1:7003';

const API_ENDPOINTS = {
    GET_USER_DETAIL: '/user/getDetail',
    UPDATE_USER_INFO: '/user/updateMine', // 修改我的信息接口
    UPDATE_PASSWORD: '/user/update/pwd', // 修改密码接口
    FILE_UPLOAD: '/file/upload', // 文件上传接口
    FILE_VIEW: '/file/view' // 文件预览接口
};

// 全局状态
let isEditing = false;
let originalUserData = null;
let currentUserData = null;

// DOM 元素
const elements = {
    // 容器
    loadingContainer: document.getElementById('loadingContainer'),
    errorContainer: document.getElementById('errorContainer'),
    profileContent: document.getElementById('profileContent'),
    
    // 按钮
    closeBtn: document.getElementById('closeBtn'),
    retryBtn: document.getElementById('retryBtn'),
    editBtn: document.getElementById('editBtn'),
    saveBtn: document.getElementById('saveBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    changePasswordBtn: document.getElementById('changePasswordBtn'),
    
    // 显示元素
    displayUserName: document.getElementById('displayUserName'),
    displayUserEmail: document.getElementById('displayUserEmail'),
    userAvatar: document.getElementById('userAvatar'),
    
    // 表单元素
    profileForm: document.getElementById('profileForm'),
    userName: document.getElementById('userName'),
    nickName: document.getElementById('nickName'),
    account: document.getElementById('account'),
    phone: document.getElementById('phone'),
    city: document.getElementById('city'),
    sex: document.getElementById('sex'),
    sexDisplay: document.getElementById('sexDisplay'),
    userId: document.getElementById('userId'),
    // remark: document.getElementById('remark'), // 已注释掉
    roleTags: document.getElementById('roleTags'),
    
    // 消息提示
    messageToast: document.getElementById('messageToast'),

    // 密码修改模态框
    passwordModal: document.getElementById('passwordModal'),
    passwordModalCloseBtn: document.getElementById('passwordModalCloseBtn'),
    passwordForm: document.getElementById('passwordForm'),
    passwordCancelBtn: document.getElementById('passwordCancelBtn'),
    passwordSubmitBtn: document.getElementById('passwordSubmitBtn'),
    currentPassword: document.getElementById('currentPassword'),
    newPassword: document.getElementById('newPassword'),
    confirmNewPassword: document.getElementById('confirmNewPassword')
};

// MD5加密工具已移至 md5-utils.js 文件中，避免代码重复

/**
 * 获取当前有效的Token
 * @returns {string|null} Token字符串或null
 */
function getCurrentToken() {
    let token = null;
    let tokenSource = '';

    console.log('=== 开始获取Token ===');

    // 方法1: 优先从父窗口的用户管理器获取
    try {
        if (window.opener) {
            console.log('父窗口存在，检查userManager...');

            // 安全地检查userManager
            if (window.opener.userManager) {
                console.log('父窗口userManager类型:', typeof window.opener.userManager);

                try {
                    const isLoggedIn = window.opener.userManager.isUserLoggedIn();
                    console.log('父窗口登录状态:', isLoggedIn);

                    if (isLoggedIn) {
                        token = window.opener.userManager.getToken();
                        tokenSource = '父窗口userManager';
                        console.log('从父窗口获取Token:', token ? `存在(长度:${token.length})` : '不存在');

                        // 同步到本地存储
                        if (token) {
                            localStorage.setItem('nexus_user_token', token);
                            console.log('Token已同步到本地存储');
                        }
                    } else {
                        console.log('父窗口用户未登录');
                    }
                } catch (userManagerError) {
                    console.error('访问父窗口userManager方法时出错:', userManagerError.message);
                }
            } else {
                console.log('父窗口userManager不存在');
            }
        } else {
            console.log('父窗口不存在');
        }
    } catch (error) {
        console.error('从父窗口获取Token时出错 (可能是跨域限制):', error.message);
    }

    // 方法2: 从本地存储获取
    if (!token) {
        try {
            token = localStorage.getItem('nexus_user_token');
            tokenSource = '本地存储';
            console.log('从本地存储获取Token:', token ? `存在(长度:${token.length})` : '不存在');
        } catch (error) {
            console.error('从本地存储获取Token时出错:', error);
        }
    }

    // 方法3: 尝试从URL参数获取（如果有的话）
    if (!token) {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const urlToken = urlParams.get('token');
            if (urlToken) {
                token = urlToken;
                tokenSource = 'URL参数';
                console.log('从URL参数获取Token:', token ? `存在(长度:${token.length})` : '不存在');

                // 保存到本地存储
                localStorage.setItem('nexus_user_token', token);
                console.log('URL Token已保存到本地存储');
            }
        } catch (error) {
            console.error('从URL参数获取Token时出错:', error);
        }
    }

    console.log('=== Token获取结果 ===');
    console.log('Token来源:', tokenSource || '未获取到');
    console.log('Token状态:', token ? `存在(长度:${token.length})` : '不存在');
    console.log('Token内容预览:', token ? `${token.substring(0, 20)}...` : '无');
    console.log('=== Token获取结束 ===');

    return token;
}

/**
 * 获取当前用户数据
 * @returns {Object|null} 用户数据对象或null
 */
function getCurrentUserData() {
    let userData = null;
    let dataSource = '';

    console.log('=== 开始获取用户数据 ===');

    // 方法1: 优先从父窗口的用户管理器获取
    try {
        if (window.opener) {
            console.log('父窗口存在，尝试获取用户数据...');

            if (window.opener.userManager) {
                try {
                    const isLoggedIn = window.opener.userManager.isUserLoggedIn();
                    console.log('父窗口登录状态:', isLoggedIn);

                    if (isLoggedIn) {
                        userData = window.opener.userManager.getUserData();
                        dataSource = '父窗口userManager';
                        console.log('从父窗口获取用户数据:', userData);

                        // 同步到本地存储
                        if (userData) {
                            localStorage.setItem('nexus_user_data', JSON.stringify(userData));
                            console.log('用户数据已同步到本地存储');
                        }
                    } else {
                        console.log('父窗口用户未登录');
                    }
                } catch (userManagerError) {
                    console.error('访问父窗口userManager方法时出错:', userManagerError.message);
                }
            } else {
                console.log('父窗口userManager不存在');
            }
        } else {
            console.log('父窗口不存在');
        }
    } catch (error) {
        console.error('从父窗口获取用户数据时出错 (可能是跨域限制):', error.message);
    }

    // 方法2: 从本地存储获取
    if (!userData) {
        try {
            const userDataStr = localStorage.getItem('nexus_user_data');
            if (userDataStr) {
                userData = JSON.parse(userDataStr);
                dataSource = '本地存储';
                console.log('从本地存储获取用户数据:', userData);
            } else {
                console.log('本地存储中没有用户数据');
            }
        } catch (error) {
            console.error('解析本地用户数据失败:', error);
            userData = null;
        }
    }

    // 方法3: 尝试从URL参数获取用户ID（如果有的话）
    if (!userData) {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const userId = urlParams.get('userId');
            const userName = urlParams.get('userName');
            const account = urlParams.get('account');

            if (userId) {
                userData = {
                    userId: userId,
                    userName: userName || '',
                    account: account || ''
                };
                dataSource = 'URL参数';
                console.log('从URL参数构建用户数据:', userData);

                // 保存到本地存储
                localStorage.setItem('nexus_user_data', JSON.stringify(userData));
                console.log('URL用户数据已保存到本地存储');
            }
        } catch (error) {
            console.error('从URL参数获取用户数据时出错:', error);
        }
    }

    console.log('=== 用户数据获取结果 ===');
    console.log('数据来源:', dataSource || '未获取到');
    console.log('用户数据状态:', userData ? '存在' : '不存在');
    if (userData) {
        console.log('用户ID:', userData.userId);
        console.log('用户名:', userData.userName);
        console.log('账号:', userData.account);
    }
    console.log('=== 用户数据获取结束 ===');

    return userData;
}

/**
 * 处理API错误响应
 * @param {Object} result API响应结果
 * @param {string} defaultMessage 默认错误消息
 * @returns {boolean} 是否为登录过期错误
 */
function handleApiError(result, defaultMessage = '操作失败') {
    let errorMessage = result.msg || defaultMessage;

    // 处理登录过期错误
    if (result.code === 110003) {
        errorMessage = '登录已过期，请重新登录';

        // 清除本地登录信息
        localStorage.removeItem('nexus_user_token');
        localStorage.removeItem('nexus_user_data');

        showMessage(errorMessage, 'error');

        // 3秒后关闭窗口并打开登录窗口
        setTimeout(() => {
            if (window.opener && window.opener.userManager) {
                window.opener.userManager.openLoginWindow();
                window.close();
            } else {
                // 如果没有父窗口，跳转到登录页面
                window.location.href = 'user-auth.html';
            }
        }, 3000);

        return true; // 表示是登录过期错误
    }

    // 处理其他错误
    showMessage(errorMessage, 'error');
    return false;
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    setupMessageListener();

    // 添加调试信息
    debugLoginStatus();

    // 检查登录状态
    if (!checkLoginStatus()) {
        showLoginExpiredError('请先登录后再查看用户详情');
        return;
    }

    loadUserProfile();
});

/**
 * 设置消息监听器，接收来自父窗口的数据同步消息
 */
function setupMessageListener() {
    window.addEventListener('message', function(event) {
        console.log('收到消息:', event.data);

        if (event.data && event.data.type === 'USER_DATA_SYNC') {
            console.log('收到用户数据同步消息:', event.data);

            // 更新本地存储
            if (event.data.userData) {
                localStorage.setItem('nexus_user_data', JSON.stringify(event.data.userData));
                console.log('用户数据已同步到本地存储');
            }

            if (event.data.token) {
                localStorage.setItem('nexus_user_token', event.data.token);
                console.log('Token已同步到本地存储');
            }

            // 如果当前页面还在加载状态，重新加载用户信息
            if (elements.loadingContainer.style.display !== 'none') {
                console.log('页面正在加载，重新获取用户信息');
                setTimeout(() => {
                    loadUserProfile();
                }, 500);
            }
        }
    });
}

/**
 * 调试登录状态
 */
function debugLoginStatus() {
    console.log('=== 用户详情页面登录状态调试 ===');
    console.log('当前时间:', new Date().toLocaleString());
    console.log('页面URL:', window.location.href);

    // 检查父窗口
    console.log('\n--- 父窗口检查 ---');
    console.log('父窗口存在:', !!window.opener);

    if (window.opener) {
        try {
            // 尝试安全地访问父窗口信息
            console.log('父窗口userManager存在:', !!window.opener.userManager);

            if (window.opener.userManager) {
                try {
                    console.log('父窗口登录状态:', window.opener.userManager.isUserLoggedIn());
                    const parentUserData = window.opener.userManager.getUserData();
                    const parentToken = window.opener.userManager.getToken();
                    console.log('父窗口用户数据:', parentUserData);
                    console.log('父窗口Token:', parentToken ? `存在(长度:${parentToken.length})` : '不存在');

                    if (parentUserData) {
                        console.log('父窗口用户ID:', parentUserData.userId);
                        console.log('父窗口用户名:', parentUserData.userName);
                        console.log('父窗口账号:', parentUserData.account);
                    }
                } catch (error) {
                    console.error('访问父窗口userManager时出错:', error);
                }
            }
        } catch (error) {
            console.error('访问父窗口时出错 (可能是跨域限制):', error.message);
        }
    } else {
        console.log('没有父窗口，可能是直接访问页面');
    }

    // 检查本地存储
    console.log('\n--- 本地存储检查 ---');
    try {
        const localUserData = localStorage.getItem('nexus_user_data');
        const localToken = localStorage.getItem('nexus_user_token');
        const loginTime = localStorage.getItem('nexus_login_time');

        console.log('本地用户数据原始值:', localUserData);
        console.log('本地Token:', localToken ? `存在(长度:${localToken.length})` : '不存在');
        console.log('登录时间:', loginTime ? new Date(parseInt(loginTime)).toLocaleString() : '不存在');

        if (localUserData) {
            try {
                const parsedUserData = JSON.parse(localUserData);
                console.log('解析后的用户数据:', parsedUserData);
                console.log('本地用户ID:', parsedUserData.userId);
                console.log('本地用户名:', parsedUserData.userName);
                console.log('本地账号:', parsedUserData.account);
            } catch (parseError) {
                console.error('解析本地用户数据失败:', parseError);
            }
        }

        if (localToken) {
            console.log('Token预览:', `${localToken.substring(0, 20)}...`);
        }
    } catch (error) {
        console.error('检查本地存储时出错:', error);
    }

    // 检查URL参数
    console.log('\n--- URL参数检查 ---');
    try {
        const urlParams = new URLSearchParams(window.location.search);
        console.log('URL参数:', Object.fromEntries(urlParams.entries()));
    } catch (error) {
        console.error('检查URL参数时出错:', error);
    }

    console.log('\n=== 调试信息结束 ===');
}

/**
 * 检查登录状态
 */
function checkLoginStatus() {
    const userData = getCurrentUserData();
    const token = getCurrentToken();

    console.log('检查登录状态结果:');
    console.log('- 用户数据:', userData);
    console.log('- Token:', token ? '存在' : '不存在');

    return userData && userData.userId && token;
}

/**
 * 初始化事件监听器
 */
function initializeEventListeners() {
    // 关闭按钮
    elements.closeBtn.addEventListener('click', closeWindow);
    
    // 重试按钮
    elements.retryBtn.addEventListener('click', loadUserProfile);
    
    // 编辑相关按钮
    elements.editBtn.addEventListener('click', enterEditMode);
    elements.saveBtn.addEventListener('click', saveUserProfile);
    elements.cancelBtn.addEventListener('click', cancelEdit);
    
    // 修改密码按钮
    elements.changePasswordBtn.addEventListener('click', openChangePasswordDialog);

    // 密码模态框事件
    elements.passwordModalCloseBtn.addEventListener('click', closePasswordModal);
    elements.passwordCancelBtn.addEventListener('click', closePasswordModal);
    elements.passwordForm.addEventListener('submit', handlePasswordChange);

    // 密码显示切换（模态框中的）
    const passwordToggles = elements.passwordModal.querySelectorAll('.password-toggle');
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', () => togglePasswordVisibility(toggle));
    });

    // 表单提交
    elements.profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveUserProfile();
    });

    // 键盘事件
    document.addEventListener('keydown', handleKeyDown);

    // 头像点击事件
    elements.userAvatar.parentElement.addEventListener('click', changeAvatar);
}

/**
 * 加载用户详情
 */
async function loadUserProfile() {
    showLoading();
    
    try {
        // 使用统一的函数获取用户数据和Token
        const userData = getCurrentUserData();
        const token = getCurrentToken();

        if (!userData || !userData.userId || !token) {
            const errorMsg = !userData ? '用户数据不存在' : (!userData.userId ? '用户ID不存在' : 'Token不存在');
            console.error('登录验证失败:', errorMsg);
            throw new Error('用户未登录或登录信息已过期');
        }
        
        // 调用API获取详细信息
        console.log('准备调用API - 用户ID:', userData.userId);
        console.log('准备调用API - Token:', token ? `存在(长度:${token.length})` : '不存在');
        console.log('准备调用API - 完整Token:', token);

        const requestHeaders = {
            'Content-Type': 'application/json',
            'token': token
        };

        console.log('请求头:', requestHeaders);

        const requestBody = {
            userId: userData.userId
        };

        console.log('请求体:', requestBody);

        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.GET_USER_DETAIL}`, {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify(requestBody)
        });
        
        const result = await response.json();

        console.log('API响应:', result); // 调试日志

        if (result.code === 200) {
            currentUserData = result.data;
            originalUserData = JSON.parse(JSON.stringify(result.data)); // 深拷贝
            displayUserProfile(currentUserData);
            showContent();
        } else {
            // 使用统一的错误处理
            const isLoginExpired = handleApiError(result, '获取用户信息失败');
            if (isLoginExpired) {
                // 显示重新登录按钮
                showLoginExpiredError('登录已过期，请重新登录');
                return;
            }
            throw new Error(result.msg || '获取用户信息失败');
        }
    } catch (error) {
        console.error('加载用户详情失败:', error);
        showError(error.message);
    }
}

/**
 * 显示用户详情
 */
function displayUserProfile(userData) {
    console.log('开始显示用户详情:', userData);

    // 更新头部显示
    elements.displayUserName.textContent = userData.userName || '未设置';
    elements.displayUserEmail.textContent = userData.account || '未设置';

    // 更新头像显示 - 适配API返回的avatarUrl
    console.log('用户头像信息 - avatarUrl:', userData.avatarUrl);
    console.log('用户头像信息 - avatarFileId:', userData.avatarFileId);
    updateUserAvatar(userData.avatarUrl || userData.avatarFileId);

    // 更新表单字段
    elements.userName.value = userData.userName || '';
    elements.nickName.value = userData.nickName || '';
    elements.account.value = userData.account || '';
    elements.phone.value = userData.phone || '';
    elements.city.value = userData.city || '';
    elements.sex.value = userData.sex !== undefined ? userData.sex.toString() : '';
    elements.userId.value = userData.userId || '';

    // 更新性别显示文本
    updateSexDisplay(userData.sex);
    // elements.remark.value = userData.remark || ''; // 备注字段已注释

    // 显示角色标签
    displayRoleTags(userData.roleIds || []);

    console.log('用户详情显示完成:', userData);
}

/**
 * 获取用于更新的头像URL
 * @returns {string|null} 头像URL或null
 */
function getAvatarUrlForUpdate() {
    if (!currentUserData) return null;

    // 优先使用avatarUrl（API返回的完整URL）
    if (currentUserData.avatarUrl) {
        console.log('使用API返回的avatarUrl:', currentUserData.avatarUrl);
        return currentUserData.avatarUrl;
    }

    // 其次使用avatarFileId构建URL
    if (currentUserData.avatarFileId) {
        const constructedUrl = `${API_BASE_URL}${API_ENDPOINTS.FILE_VIEW}/${currentUserData.avatarFileId}`;
        console.log('使用avatarFileId构建URL:', constructedUrl);
        return constructedUrl;
    }

    console.log('没有头像信息，返回null');
    return null;
}

/**
 * 更新用户头像显示
 * @param {string} avatarSource - 头像源，可以是完整URL或文件ID
 */
function updateUserAvatar(avatarSource) {
    console.log('更新头像显示，头像源:', avatarSource);

    if (avatarSource) {
        let avatarUrl;

        // 判断是完整URL还是文件ID
        if (avatarSource.startsWith('http://') || avatarSource.startsWith('https://')) {
            // 完整URL，直接使用
            avatarUrl = avatarSource;
            console.log('使用完整URL作为头像:', avatarUrl);
        } else {
            // 文件ID，构建完整URL
            avatarUrl = `${API_BASE_URL}${API_ENDPOINTS.FILE_VIEW}/${avatarSource}`;
            console.log('使用文件ID构建头像URL:', avatarUrl);
        }

        elements.userAvatar.src = avatarUrl;
        elements.userAvatar.onerror = () => {
            console.warn('头像加载失败，使用默认头像:', avatarUrl);
            // 如果加载失败，使用默认头像
            elements.userAvatar.src = '../images/user-avatar.png';
        };

        elements.userAvatar.onload = () => {
            console.log('头像加载成功:', avatarUrl);
        };
    } else {
        console.log('没有头像源，使用默认头像');
        // 使用默认头像
        elements.userAvatar.src = '../images/user-avatar.png';
    }
}

/**
 * 显示角色标签
 */
function displayRoleTags(roleIds) {
    elements.roleTags.innerHTML = '';
    
    if (!roleIds || roleIds.length === 0) {
        elements.roleTags.innerHTML = '<span style="color: #718096; font-size: 13px;">暂无角色</span>';
        return;
    }
    
    roleIds.forEach(roleId => {
        const tag = document.createElement('span');
        tag.className = 'role-tag';
        tag.textContent = getRoleName(roleId);
        elements.roleTags.appendChild(tag);
    });
}

/**
 * 获取角色名称
 */
function getRoleName(roleId) {
    const roleMap = {
        '1': '普通用户',
        '2': 'VIP用户',
        '3': '管理员',
        '4': '超级管理员'
    };
    return roleMap[roleId] || `角色${roleId}`;
}

/**
 * 更新性别显示文本
 * @param {number|string} sexValue - 性别值 (0: 男, 1: 女)
 */
function updateSexDisplay(sexValue) {
    const sexMap = {
        '0': '男',
        '1': '女',
        0: '男',
        1: '女'
    };

    const displayText = sexMap[sexValue] || '未设置';
    elements.sexDisplay.textContent = displayText;
}

/**
 * 进入编辑模式
 */
function enterEditMode() {
    isEditing = true;

    // 切换按钮显示
    elements.editBtn.style.display = 'none';
    elements.saveBtn.style.display = 'flex';
    elements.cancelBtn.style.display = 'flex';

    // 启用表单字段（除了userId和account）
    elements.userName.removeAttribute('readonly');
    elements.nickName.removeAttribute('readonly');
    elements.phone.removeAttribute('readonly');
    elements.city.removeAttribute('readonly');

    // 性别字段：隐藏显示文本，显示下拉框
    elements.sexDisplay.style.display = 'none';
    elements.sex.style.display = 'block';
    elements.sex.removeAttribute('disabled');

    // elements.remark.removeAttribute('readonly'); // 备注字段已注释

    // 聚焦到第一个可编辑字段
    elements.userName.focus();

    showMessage('进入编辑模式，您可以修改用户信息', 'info');
}

/**
 * 取消编辑
 */
function cancelEdit() {
    isEditing = false;

    // 切换按钮显示
    elements.editBtn.style.display = 'flex';
    elements.saveBtn.style.display = 'none';
    elements.cancelBtn.style.display = 'none';

    // 恢复只读状态
    elements.userName.setAttribute('readonly', '');
    elements.nickName.setAttribute('readonly', '');
    elements.phone.setAttribute('readonly', '');
    elements.city.setAttribute('readonly', '');

    // 性别字段：显示文本，隐藏下拉框
    elements.sexDisplay.style.display = 'flex';
    elements.sex.style.display = 'none';
    elements.sex.setAttribute('disabled', '');

    // elements.remark.setAttribute('readonly', ''); // 备注字段已注释

    // 恢复原始数据
    if (originalUserData) {
        displayUserProfile(originalUserData);
        currentUserData = JSON.parse(JSON.stringify(originalUserData));
    }

    // 清除错误信息
    clearAllErrors();

    showMessage('已取消编辑', 'info');
}

/**
 * 保存用户详情
 */
async function saveUserProfile() {
    if (!validateForm()) {
        return;
    }
    
    // 显示保存状态
    const saveSpinner = elements.saveBtn.querySelector('.loading-spinner');
    const saveText = elements.saveBtn.querySelector('.btn-text');
    
    saveSpinner.style.display = 'block';
    saveText.textContent = '保存中...';
    elements.saveBtn.disabled = true;
    
    try {
        // 获取Token
        const token = getCurrentToken();
        if (!token) {
            throw new Error('Token不存在，无法保存用户信息');
        }

        // 构建更新数据，按照API要求的格式
        const updateData = {
            userName: elements.userName.value.trim(),
            nickName: elements.nickName.value.trim(),
            phone: elements.phone.value.trim(),
            city: elements.city.value.trim(),
            sex: elements.sex.value ? parseInt(elements.sex.value) : null,
            avatarUrl: getAvatarUrlForUpdate()
        };

        console.log('准备更新的用户数据:', updateData);

        // 调用更新API
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.UPDATE_USER_INFO}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'token': token
            },
            body: JSON.stringify(updateData)
        });

        const result = await response.json();

        console.log('更新API响应:', result); // 调试日志

        if (result.code === 200) {
            // 更新本地数据
            currentUserData = { ...currentUserData, ...updateData };
            originalUserData = JSON.parse(JSON.stringify(currentUserData));

            // 更新本地存储
            const localUserData = JSON.parse(localStorage.getItem('nexus_user_data') || '{}');
            const updatedLocalData = { ...localUserData, ...updateData };
            localStorage.setItem('nexus_user_data', JSON.stringify(updatedLocalData));

            // 退出编辑模式
            exitEditMode();

            // 更新显示
            displayUserProfile(currentUserData);

            showMessage('用户信息更新成功', 'success');
        } else {
            // 使用统一的错误处理
            const isLoginExpired = handleApiError(result, '更新失败');
            if (isLoginExpired) {
                return; // 登录过期错误已处理
            }
            throw new Error(result.msg || '更新失败');
        }
    } catch (error) {
        console.error('保存用户详情失败:', error);
        showMessage(error.message, 'error');
    } finally {
        // 恢复按钮状态
        saveSpinner.style.display = 'none';
        saveText.textContent = '保存';
        elements.saveBtn.disabled = false;
    }
}

/**
 * 退出编辑模式
 */
function exitEditMode() {
    isEditing = false;

    // 切换按钮显示
    elements.editBtn.style.display = 'flex';
    elements.saveBtn.style.display = 'none';
    elements.cancelBtn.style.display = 'none';

    // 恢复只读状态
    elements.userName.setAttribute('readonly', '');
    elements.nickName.setAttribute('readonly', '');
    elements.phone.setAttribute('readonly', '');
    elements.city.setAttribute('readonly', '');

    // 性别字段：显示文本，隐藏下拉框
    elements.sexDisplay.style.display = 'flex';
    elements.sex.style.display = 'none';
    elements.sex.setAttribute('disabled', '');

    // elements.remark.setAttribute('readonly', ''); // 备注字段已注释

    // 清除错误信息
    clearAllErrors();
}

/**
 * 验证表单
 */
function validateForm() {
    clearAllErrors();
    let isValid = true;
    
    // 验证用户名
    const userName = elements.userName.value.trim();
    if (!userName) {
        showError('userNameError', '用户名不能为空');
        isValid = false;
    } else if (userName.length < 2) {
        showError('userNameError', '用户名至少需要2个字符');
        isValid = false;
    } else if (userName.length > 20) {
        showError('userNameError', '用户名不能超过20个字符');
        isValid = false;
    }

    // 验证昵称（如果填写了）
    const nickName = elements.nickName.value.trim();
    if (nickName && nickName.length > 20) {
        showError('nickNameError', '昵称不能超过20个字符');
        isValid = false;
    }

    // 验证手机号（如果填写了）
    const phone = elements.phone.value.trim();
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
        showError('phoneError', '请输入有效的手机号码');
        isValid = false;
    }

    // 验证城市（如果填写了）
    const city = elements.city.value.trim();
    if (city && city.length > 50) {
        showError('cityError', '城市名称不能超过50个字符');
        isValid = false;
    }

    // 验证备注长度（备注字段已注释，跳过验证）
    // const remark = elements.remark.value.trim();
    // if (remark.length > 200) {
    //     showError('remarkError', '备注信息不能超过200个字符');
    //     isValid = false;
    // }
    
    return isValid;
}

/**
 * 更换头像
 */
async function changeAvatar() {
    if (!isEditing) {
        showMessage('请先进入编辑模式', 'warning');
        return;
    }

    // 创建文件输入元素
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            await handleAvatarUpload(file);
        }
    });

    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
}

/**
 * 处理头像上传
 */
async function handleAvatarUpload(file) {
    // 验证文件大小（限制为2MB）
    if (file.size > 2 * 1024 * 1024) {
        showMessage('图片大小不能超过2MB', 'error');
        return;
    }

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
        showMessage('请选择有效的图片文件', 'error');
        return;
    }

    // 显示上传进度
    const uploadProgress = document.getElementById('avatarUploadProgress');
    if (uploadProgress) {
        uploadProgress.style.display = 'flex';
    }

    try {
        // 获取Token
        const token = getCurrentToken();
        if (!token) {
            throw new Error('Token不存在，无法上传头像');
        }

        // 创建FormData对象
        const formData = new FormData();
        formData.append('file', file);

        // 上传文件到服务器
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.FILE_UPLOAD}`, {
            method: 'POST',
            headers: {
                'token': token
            },
            body: formData
        });

        const result = await response.json();

        console.log('头像上传API响应:', result); // 调试日志

        if (result.code === 200) {
            const fileData = result.data;

            // 更新当前用户数据中的头像文件ID
            if (currentUserData) {
                currentUserData.avatarFileId = fileData.fileId;
            }

            // 更新头像显示
            updateUserAvatar(fileData.fileId);

            showMessage('头像上传成功，请保存修改', 'success');

            console.log('头像上传成功:', fileData);
        } else {
            // 使用统一的错误处理
            const isLoginExpired = handleApiError(result, '上传失败');
            if (isLoginExpired) {
                return; // 登录过期错误已处理
            }
            throw new Error(result.msg || '上传失败');
        }
    } catch (error) {
        console.error('头像上传失败:', error);
        showMessage(`头像上传失败: ${error.message}`, 'error');
    } finally {
        // 隐藏上传进度
        const uploadProgress = document.getElementById('avatarUploadProgress');
        if (uploadProgress) {
            uploadProgress.style.display = 'none';
        }
    }
}

/**
 * 打开修改密码对话框
 */
function openChangePasswordDialog() {
    // 清空表单
    elements.currentPassword.value = '';
    elements.newPassword.value = '';
    elements.confirmNewPassword.value = '';

    // 清除错误信息
    clearPasswordErrors();

    // 显示模态框
    elements.passwordModal.style.display = 'flex';

    // 聚焦到第一个输入框
    setTimeout(() => {
        elements.currentPassword.focus();
    }, 100);
}

/**
 * 关闭修改密码对话框
 */
function closePasswordModal() {
    elements.passwordModal.style.display = 'none';

    // 清空表单
    elements.currentPassword.value = '';
    elements.newPassword.value = '';
    elements.confirmNewPassword.value = '';

    // 清除错误信息
    clearPasswordErrors();
}

/**
 * 处理密码修改
 */
async function handlePasswordChange(event) {
    event.preventDefault();

    // 验证表单
    if (!validatePasswordForm()) {
        return;
    }

    // 显示加载状态
    const submitBtn = elements.passwordSubmitBtn;
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.loading-spinner');

    btnText.style.display = 'none';
    spinner.style.display = 'block';
    submitBtn.disabled = true;

    try {
        // 获取Token
        const token = getCurrentToken();
        if (!token) {
            throw new Error('Token不存在，无法修改密码');
        }

        const currentPassword = elements.currentPassword.value;
        const newPassword = elements.newPassword.value;

        // 加密密码
        const encryptedOldPwd = encryptPassword(currentPassword);
        const encryptedNewPwd = encryptPassword(newPassword);

        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.UPDATE_PASSWORD}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'token': token
            },
            body: JSON.stringify({
                oldPwd: encryptedOldPwd,
                newPwd: encryptedNewPwd
            })
        });

        const result = await response.json();

        console.log('密码修改API响应:', result); // 调试日志

        if (result.code === 200) {
            showMessage('密码修改成功', 'success');
            closePasswordModal();
        } else {
            // 使用统一的错误处理
            const isLoginExpired = handleApiError(result, '密码修改失败');
            if (isLoginExpired) {
                closePasswordModal();
                return; // 登录过期错误已处理
            }
            showMessage(result.msg || '密码修改失败', 'error');
        }
    } catch (error) {
        console.error('密码修改失败:', error);
        showMessage(`密码修改失败: ${error.message}`, 'error');
    } finally {
        // 恢复按钮状态
        btnText.style.display = 'block';
        spinner.style.display = 'none';
        submitBtn.disabled = false;
    }
}

/**
 * 验证密码表单
 */
function validatePasswordForm() {
    clearPasswordErrors();
    let isValid = true;

    const currentPassword = elements.currentPassword.value;
    const newPassword = elements.newPassword.value;
    const confirmNewPassword = elements.confirmNewPassword.value;

    // 验证当前密码
    if (!currentPassword) {
        showPasswordError('currentPasswordError', '请输入当前密码');
        isValid = false;
    }

    // 验证新密码
    if (!newPassword) {
        showPasswordError('newPasswordError', '请输入新密码');
        isValid = false;
    } else if (newPassword.length < 6) {
        showPasswordError('newPasswordError', '新密码至少需要6位字符');
        isValid = false;
    } else if (newPassword === currentPassword) {
        showPasswordError('newPasswordError', '新密码不能与当前密码相同');
        isValid = false;
    }

    // 验证确认密码
    if (!confirmNewPassword) {
        showPasswordError('confirmNewPasswordError', '请确认新密码');
        isValid = false;
    } else if (newPassword !== confirmNewPassword) {
        showPasswordError('confirmNewPasswordError', '两次输入的密码不一致');
        isValid = false;
    }

    return isValid;
}

/**
 * 显示密码错误信息
 */
function showPasswordError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = '';
    }
}

/**
 * 清除密码错误信息
 */
function clearPasswordErrors() {
    const errorIds = ['currentPasswordError', 'newPasswordError', 'confirmNewPasswordError'];
    errorIds.forEach(id => {
        const errorElement = document.getElementById(id);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = '';
        }
    });
}

/**
 * 切换密码显示/隐藏
 */
function togglePasswordVisibility(toggleBtn) {
    const targetId = toggleBtn.getAttribute('data-target');
    const passwordInput = document.getElementById(targetId);

    if (passwordInput) {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleBtn.textContent = '🙈';
        } else {
            passwordInput.type = 'password';
            toggleBtn.textContent = '👁️';
        }
    }
}

/**
 * 显示加载状态
 */
function showLoading() {
    elements.loadingContainer.style.display = 'flex';
    elements.errorContainer.style.display = 'none';
    elements.profileContent.style.display = 'none';
}

/**
 * 显示错误状态
 */
function showError(message) {
    elements.errorContainer.style.display = 'flex';
    elements.loadingContainer.style.display = 'none';
    elements.profileContent.style.display = 'none';

    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.textContent = message;
    }
}

/**
 * 显示登录过期错误
 */
function showLoginExpiredError(message) {
    elements.errorContainer.style.display = 'flex';
    elements.loadingContainer.style.display = 'none';
    elements.profileContent.style.display = 'none';

    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.innerHTML = `
            <div style="margin-bottom: 15px;">${message}</div>
            <div style="font-size: 14px; color: #666; margin-bottom: 15px;">
                可能的原因：<br>
                • Token已过期或无效<br>
                • 用户数据丢失<br>
                • 网络连接问题<br>
                • 跨域安全限制
            </div>
            <div style="font-size: 12px; color: #888; margin-bottom: 10px;">
                <a href="quick-login.html" target="_blank" style="color: #28a745; text-decoration: none; margin-right: 15px;">
                    ⚡ 快速登录
                </a>
                <a href="token-status.html" target="_blank" style="color: #007bff; text-decoration: none;">
                    🔍 检查状态
                </a>
            </div>
        `;
    }

    // 更新重试按钮文本和功能
    const retryBtn = elements.retryBtn;
    if (retryBtn) {
        retryBtn.textContent = '重新登录';
        retryBtn.onclick = function() {
            // 清除本地登录信息
            localStorage.removeItem('nexus_user_token');
            localStorage.removeItem('nexus_user_data');

            // 关闭当前窗口并打开登录窗口
            if (window.opener && window.opener.userManager) {
                // 清除父窗口的登录状态
                window.opener.userManager.clearUserData();
                window.opener.userManager.openLoginWindow();
                window.close();
            } else {
                // 如果没有父窗口，直接跳转到登录页面
                window.location.href = 'user-auth.html';
            }
        };
    }

    // 添加额外的调试按钮
    const errorContainer = elements.errorContainer;
    let debugBtn = errorContainer.querySelector('.debug-btn');
    if (!debugBtn) {
        debugBtn = document.createElement('button');
        debugBtn.className = 'retry-btn debug-btn';
        debugBtn.textContent = '🔍 检查状态';
        debugBtn.style.marginLeft = '10px';
        debugBtn.onclick = function() {
            window.open('token-status.html', '_blank');
        };
        retryBtn.parentNode.appendChild(debugBtn);
    }
}

/**
 * 显示内容
 */
function showContent() {
    elements.profileContent.style.display = 'block';
    elements.loadingContainer.style.display = 'none';
    elements.errorContainer.style.display = 'none';
}

/**
 * 处理键盘事件
 */
function handleKeyDown(event) {
    // ESC 键处理
    if (event.key === 'Escape') {
        // 如果密码模态框打开，先关闭模态框
        if (elements.passwordModal.style.display === 'flex') {
            closePasswordModal();
        } else if (isEditing) {
            cancelEdit();
        } else {
            closeWindow();
        }
    }

    // Ctrl+S 保存
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        if (isEditing) {
            saveUserProfile();
        }
    }
}

/**
 * 显示错误信息
 */
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = '';
    }
}

/**
 * 清除所有错误信息
 */
function clearAllErrors() {
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(element => {
        element.textContent = '';
        element.style.display = '';
    });
}

/**
 * 显示消息提示
 */
function showMessage(message, type = 'info') {
    const toast = elements.messageToast;
    const icon = toast.querySelector('.toast-icon');
    const text = toast.querySelector('.toast-text');
    
    // 设置图标
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    icon.textContent = icons[type] || icons.info;
    text.textContent = message;
    
    // 设置样式
    toast.className = `message-toast ${type}`;
    
    // 显示提示
    toast.classList.add('show');
    
    // 自动隐藏
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

/**
 * 关闭窗口
 */
function closeWindow() {
    // 如果正在编辑，询问是否保存
    if (isEditing) {
        if (confirm('您有未保存的修改，确定要关闭吗？')) {
            // 关闭窗口
            if (window.opener) {
                window.close();
            } else {
                // 如果不是弹窗，则隐藏容器
                document.querySelector('.profile-container').style.display = 'none';
            }
        }
    } else {
        // 关闭窗口
        if (window.opener) {
            window.close();
        } else {
            // 如果不是弹窗，则隐藏容器
            document.querySelector('.profile-container').style.display = 'none';
        }
    }
}
