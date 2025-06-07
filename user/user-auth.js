/**
 * 用户认证模块 - 登录注册功能
 * 作者：Nexus Mods 智能助手
 */

// 常量定义
const API_BASE_URL = 'http://127.0.0.1:7003';
const USER_SOURCE = 'N网智能助手';

const API_ENDPOINTS = {
    SEND_EMAIL_CODE: '/login/sendEmailCode',
    EMAIL_REGISTER: '/login/emailRegister', 
    EMAIL_LOGIN: '/login/emailLogin',
    ACCOUNT_LOGIN: '/login/accountLogin',
    LOGOUT: '/login/logout'
};

// 全局状态
let currentTab = 'login';
let currentLoginType = 'email';
let countdownTimer = null;
let isSubmitting = false;

// DOM 元素
const elements = {
    // 标签切换
    tabBtns: document.querySelectorAll('.tab-btn'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    
    // 登录类型切换
    loginTypeBtns: document.querySelectorAll('.login-type-btn'),
    emailLoginFields: document.querySelector('.email-login-fields'),
    accountLoginFields: document.querySelector('.account-login-fields'),
    
    // 表单
    loginFormElement: document.getElementById('loginFormElement'),
    registerFormElement: document.getElementById('registerFormElement'),
    
    // 按钮
    closeBtn: document.getElementById('closeBtn'),
    sendCodeBtn: document.getElementById('sendCodeBtn'),
    loginSubmitBtn: document.getElementById('loginSubmitBtn'),
    registerSubmitBtn: document.getElementById('registerSubmitBtn'),
    
    // 密码切换
    passwordToggles: document.querySelectorAll('.password-toggle'),
    
    // 消息提示
    messageToast: document.getElementById('messageToast')
};

// MD5加密工具已移至 md5-utils.js 文件中，避免代码重复



// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    loadSavedData();
});

/**
 * 初始化事件监听器
 */
function initializeEventListeners() {
    // 标签切换
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // 登录类型切换
    elements.loginTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => switchLoginType(btn.dataset.type));
    });
    
    // 关闭按钮
    elements.closeBtn.addEventListener('click', closeWindow);
    
    // 发送验证码
    elements.sendCodeBtn.addEventListener('click', sendEmailCode);
    
    // 表单提交
    elements.loginFormElement.addEventListener('submit', handleLogin);
    elements.registerFormElement.addEventListener('submit', handleRegister);
    
    // 密码显示切换
    elements.passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', () => togglePasswordVisibility(toggle));
    });
    
    // 实时验证
    setupRealTimeValidation();
    
    // 键盘事件
    document.addEventListener('keydown', handleKeyDown);
}

/**
 * 切换标签
 */
function switchTab(tab) {
    currentTab = tab;
    
    // 更新标签按钮状态
    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // 显示对应表单
    elements.loginForm.style.display = tab === 'login' ? 'block' : 'none';
    elements.registerForm.style.display = tab === 'register' ? 'block' : 'none';
    
    // 清除错误信息
    clearAllErrors();
}

/**
 * 切换登录类型
 */
function switchLoginType(type) {
    currentLoginType = type;

    // 更新按钮状态
    elements.loginTypeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });

    // 使用CSS类控制显示/隐藏，避免破坏 .form-group 的 flex 布局
    if (type === 'email') {
        elements.emailLoginFields.classList.remove('hidden');
        elements.accountLoginFields.classList.add('hidden');
    } else {
        elements.emailLoginFields.classList.add('hidden');
        elements.accountLoginFields.classList.remove('hidden');
    }

    // 清除错误信息
    clearAllErrors();
}

/**
 * 发送邮箱验证码
 */
async function sendEmailCode() {
    const emailInput = document.getElementById('registerEmail');
    const email = emailInput.value.trim();
    
    // 验证邮箱
    if (!email) {
        showError('registerEmailError', '请输入邮箱地址');
        emailInput.focus();
        return;
    }
    
    if (!isValidEmail(email)) {
        showError('registerEmailError', '请输入有效的邮箱地址');
        emailInput.focus();
        return;
    }
    
    // 禁用按钮并显示加载状态
    elements.sendCodeBtn.disabled = true;
    elements.sendCodeBtn.textContent = '发送中...';
    
    try {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.SEND_EMAIL_CODE}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                type: 1 // 注册验证码
            })
        });
        
        const result = await response.json();
        
        if (result.code === 200) {
            showMessage('验证码已发送到您的邮箱，请查收', 'success');
            startCountdown();
        } else {
            showMessage(result.msg || '发送验证码失败，请重试', 'error');
            resetSendCodeButton();
        }
    } catch (error) {
        console.error('发送验证码失败:', error);
        showMessage('网络错误，请检查网络连接', 'error');
        resetSendCodeButton();
    }
}

/**
 * 开始倒计时
 */
function startCountdown() {
    let countdown = 60;
    
    const updateButton = () => {
        if (countdown > 0) {
            elements.sendCodeBtn.textContent = `${countdown}秒后重发`;
            countdown--;
            countdownTimer = setTimeout(updateButton, 1000);
        } else {
            resetSendCodeButton();
        }
    };
    
    updateButton();
}

/**
 * 重置发送验证码按钮
 */
function resetSendCodeButton() {
    elements.sendCodeBtn.disabled = false;
    elements.sendCodeBtn.textContent = '发送验证码';
    if (countdownTimer) {
        clearTimeout(countdownTimer);
        countdownTimer = null;
    }
}

/**
 * 处理登录
 */
async function handleLogin(event) {
    event.preventDefault();
    
    if (isSubmitting) return;
    
    // 获取表单数据
    const formData = getLoginFormData();
    if (!formData) return;
    
    // 显示加载状态
    setSubmitButtonLoading(elements.loginSubmitBtn, true);
    isSubmitting = true;
    
    try {
        const endpoint = currentLoginType === 'email' ? API_ENDPOINTS.EMAIL_LOGIN : API_ENDPOINTS.ACCOUNT_LOGIN;
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.code === 200) {
            // 登录成功
            await handleLoginSuccess(result.data);
        } else {
            showMessage(result.msg || '登录失败，请检查账号密码', 'error');
        }
    } catch (error) {
        console.error('登录失败:', error);
        showMessage('网络错误，请检查网络连接', 'error');
    } finally {
        setSubmitButtonLoading(elements.loginSubmitBtn, false);
        isSubmitting = false;
    }
}

/**
 * 处理注册
 */
async function handleRegister(event) {
    event.preventDefault();
    
    if (isSubmitting) return;
    
    // 获取表单数据
    const formData = getRegisterFormData();
    if (!formData) return;
    
    // 显示加载状态
    setSubmitButtonLoading(elements.registerSubmitBtn, true);
    isSubmitting = true;
    
    try {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.EMAIL_REGISTER}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.code === 200) {
            // 注册成功
            await handleRegisterSuccess(result.data);
        } else {
            showMessage(result.msg || '注册失败，请重试', 'error');
        }
    } catch (error) {
        console.error('注册失败:', error);
        showMessage('网络错误，请检查网络连接', 'error');
    } finally {
        setSubmitButtonLoading(elements.registerSubmitBtn, false);
        isSubmitting = false;
    }
}

/**
 * 获取登录表单数据
 */
function getLoginFormData() {
    clearAllErrors();
    
    let formData = {};
    let isValid = true;
    
    if (currentLoginType === 'email') {
        const email = document.getElementById('loginEmail').value.trim();
        if (!email) {
            showError('loginEmailError', '请输入邮箱地址');
            isValid = false;
        } else if (!isValidEmail(email)) {
            showError('loginEmailError', '请输入有效的邮箱地址');
            isValid = false;
        }
        formData.email = email;
    } else {
        const account = document.getElementById('loginAccount').value.trim();
        if (!account) {
            showError('loginAccountError', '请输入账号');
            isValid = false;
        }
        formData.account = account;
    }
    
    const password = document.getElementById('loginPassword').value;
    if (!password) {
        showError('loginPasswordError', '请输入密码');
        isValid = false;
    }
    // 密码加密后传输
    formData.pwd = encryptPassword(password);
    
    return isValid ? formData : null;
}

/**
 * 获取注册表单数据
 */
function getRegisterFormData() {
    clearAllErrors();

    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const verificationCode = document.getElementById('verificationCode').value.trim();
    const userSource = document.getElementById('userSource').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;

    let isValid = true;

    // 验证邮箱
    if (!email) {
        showError('registerEmailError', '请输入邮箱地址');
        isValid = false;
    } else if (!isValidEmail(email)) {
        showError('registerEmailError', '请输入有效的邮箱地址');
        isValid = false;
    }

    // 验证密码
    if (!password) {
        showError('registerPasswordError', '请输入密码');
        isValid = false;
    } else if (password.length < 6) {
        showError('registerPasswordError', '密码至少需要6位字符');
        isValid = false;
    }

    // 验证确认密码
    if (!confirmPassword) {
        showError('confirmPasswordError', '请确认密码');
        isValid = false;
    } else if (password !== confirmPassword) {
        showError('confirmPasswordError', '两次输入的密码不一致');
        isValid = false;
    }

    // 验证验证码
    if (!verificationCode) {
        showError('verificationCodeError', '请输入验证码');
        isValid = false;
    }

    // 验证用户来源
    if (!userSource) {
        showError('userSourceError', '请选择您的来源');
        isValid = false;
    }

    // 验证协议同意
    if (!agreeTerms) {
        showMessage('请阅读并同意用户协议和隐私政策', 'warning');
        isValid = false;
    }

    if (!isValid) return null;

    return {
        email: email,
        pwd: encryptPassword(password), // 密码加密后传输
        verificationCode: verificationCode,
        invitationCode: '', // 保持兼容性，传空字符串
        userSource: userSource // 使用用户选择的来源
    };
}

/**
 * 处理登录成功
 */
async function handleLoginSuccess(userData) {
    // 保存用户数据
    await saveUserData(userData);
    
    // 保存记住我状态
    const rememberMe = document.getElementById('rememberMe').checked;
    if (rememberMe) {
        localStorage.setItem('nexus_remember_me', 'true');
        if (currentLoginType === 'email') {
            localStorage.setItem('nexus_saved_email', userData.email || '');
        } else {
            localStorage.setItem('nexus_saved_account', userData.account || '');
        }
    }
    
    showMessage('登录成功！欢迎回来', 'success');
    
    // 延迟关闭窗口
    setTimeout(() => {
        closeWindow();
    }, 1500);
}

/**
 * 处理注册成功
 */
async function handleRegisterSuccess(userData) {
    // 保存用户数据
    await saveUserData(userData);
    
    showMessage('注册成功！欢迎加入', 'success');
    
    // 延迟关闭窗口
    setTimeout(() => {
        closeWindow();
    }, 1500);
}

/**
 * 保存用户数据
 */
async function saveUserData(userData) {
    try {
        // 保存到本地存储
        localStorage.setItem('nexus_user_data', JSON.stringify(userData));
        localStorage.setItem('nexus_user_token', userData.token || '');
        localStorage.setItem('nexus_login_time', Date.now().toString());
        
        // 通知父窗口用户状态变化
        if (window.opener) {
            window.opener.postMessage({
                type: 'USER_LOGIN_SUCCESS',
                userData: userData
            }, '*');
        }
        
        console.log('用户数据保存成功');
    } catch (error) {
        console.error('保存用户数据失败:', error);
    }
}

/**
 * 加载保存的数据
 */
function loadSavedData() {
    const rememberMe = localStorage.getItem('nexus_remember_me') === 'true';
    if (rememberMe) {
        document.getElementById('rememberMe').checked = true;
        
        const savedEmail = localStorage.getItem('nexus_saved_email');
        const savedAccount = localStorage.getItem('nexus_saved_account');
        
        if (savedEmail) {
            document.getElementById('loginEmail').value = savedEmail;
        }
        if (savedAccount) {
            document.getElementById('loginAccount').value = savedAccount;
        }
    }
}

/**
 * 设置提交按钮加载状态
 */
function setSubmitButtonLoading(button, loading) {
    const btnText = button.querySelector('.btn-text');
    const spinner = button.querySelector('.loading-spinner');
    
    if (loading) {
        button.disabled = true;
        btnText.style.display = 'none';
        spinner.style.display = 'block';
    } else {
        button.disabled = false;
        btnText.style.display = 'block';
        spinner.style.display = 'none';
    }
}

/**
 * 切换密码可见性
 */
function togglePasswordVisibility(toggle) {
    const targetId = toggle.dataset.target;
    const input = document.getElementById(targetId);
    
    if (input.type === 'password') {
        input.type = 'text';
        toggle.textContent = '🙈';
    } else {
        input.type = 'password';
        toggle.textContent = '👁️';
    }
}

/**
 * 设置实时验证
 */
function setupRealTimeValidation() {
    // 邮箱验证
    const emailInputs = ['loginEmail', 'registerEmail'];
    emailInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('blur', () => {
                const email = input.value.trim();
                const errorId = id + 'Error';
                if (email && !isValidEmail(email)) {
                    showError(errorId, '请输入有效的邮箱地址');
                } else {
                    clearError(errorId);
                }
            });
        }
    });
    
    // 密码确认验证
    const confirmPasswordInput = document.getElementById('confirmPassword');
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('blur', () => {
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = confirmPasswordInput.value;
            if (confirmPassword && password !== confirmPassword) {
                showError('confirmPasswordError', '两次输入的密码不一致');
            } else {
                clearError('confirmPasswordError');
            }
        });
    }
}

/**
 * 处理键盘事件
 */
function handleKeyDown(event) {
    // ESC 键关闭窗口
    if (event.key === 'Escape') {
        closeWindow();
    }
    
    // Enter 键提交表单
    if (event.key === 'Enter' && !event.shiftKey) {
        const activeElement = document.activeElement;
        if (activeElement && activeElement.tagName === 'INPUT') {
            const form = activeElement.closest('form');
            if (form) {
                event.preventDefault();
                form.dispatchEvent(new Event('submit'));
            }
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
        // 移除内联样式，让CSS控制显示状态
        errorElement.style.display = '';
    }
}

/**
 * 清除错误信息
 */
function clearError(elementId) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = '';
        // 移除内联样式，让CSS控制显示状态
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
        // 移除内联样式，让CSS控制显示状态
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
 * 验证邮箱格式
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * 关闭窗口
 */
function closeWindow() {
    // 清理定时器
    if (countdownTimer) {
        clearTimeout(countdownTimer);
    }
    
    // 关闭窗口
    if (window.opener) {
        window.close();
    } else {
        // 如果不是弹窗，则隐藏容器
        document.querySelector('.auth-container').style.display = 'none';
    }
}
