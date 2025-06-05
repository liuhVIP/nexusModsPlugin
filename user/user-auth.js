/**
 * 用户认证模块 - 登录注册功能
 * 作者：Nexus Mods 智能助手
 */

// 常量定义
const API_BASE_URL = 'http://127.0.0.1:7003';
const USER_SOURCE = 'N网智能助手';
const PASSWORD_SALT = 'gmyy'; // 密码加密盐值

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

// MD5加密函数
function md5(string) {
    function md5_RotateLeft(lValue, iShiftBits) {
        return (lValue<<iShiftBits) | (lValue>>>(32-iShiftBits));
    }
    function md5_AddUnsigned(lX,lY) {
        var lX4,lY4,lX8,lY8,lResult;
        lX8 = (lX & 0x80000000);
        lY8 = (lY & 0x80000000);
        lX4 = (lX & 0x40000000);
        lY4 = (lY & 0x40000000);
        lResult = (lX & 0x3FFFFFFF)+(lY & 0x3FFFFFFF);
        if (lX4 & lY4) {
            return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
        }
        if (lX4 | lY4) {
            if (lResult & 0x40000000) {
                return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
            } else {
                return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
            }
        } else {
            return (lResult ^ lX8 ^ lY8);
        }
    }
    function md5_F(x,y,z) { return (x & y) | ((~x) & z); }
    function md5_G(x,y,z) { return (x & z) | (y & (~z)); }
    function md5_H(x,y,z) { return (x ^ y ^ z); }
    function md5_I(x,y,z) { return (y ^ (x | (~z))); }
    function md5_FF(a,b,c,d,x,s,ac) {
        a = md5_AddUnsigned(a, md5_AddUnsigned(md5_AddUnsigned(md5_F(b, c, d), x), ac));
        return md5_AddUnsigned(md5_RotateLeft(a, s), b);
    };
    function md5_GG(a,b,c,d,x,s,ac) {
        a = md5_AddUnsigned(a, md5_AddUnsigned(md5_AddUnsigned(md5_G(b, c, d), x), ac));
        return md5_AddUnsigned(md5_RotateLeft(a, s), b);
    };
    function md5_HH(a,b,c,d,x,s,ac) {
        a = md5_AddUnsigned(a, md5_AddUnsigned(md5_AddUnsigned(md5_H(b, c, d), x), ac));
        return md5_AddUnsigned(md5_RotateLeft(a, s), b);
    };
    function md5_II(a,b,c,d,x,s,ac) {
        a = md5_AddUnsigned(a, md5_AddUnsigned(md5_AddUnsigned(md5_I(b, c, d), x), ac));
        return md5_AddUnsigned(md5_RotateLeft(a, s), b);
    };
    function md5_ConvertToWordArray(string) {
        var lWordCount;
        var lMessageLength = string.length;
        var lNumberOfWords_temp1=lMessageLength + 8;
        var lNumberOfWords_temp2=(lNumberOfWords_temp1-(lNumberOfWords_temp1 % 64))/64;
        var lNumberOfWords = (lNumberOfWords_temp2+1)*16;
        var lWordArray=Array(lNumberOfWords-1);
        var lBytePosition = 0;
        var lByteCount = 0;
        while ( lByteCount < lMessageLength ) {
            lWordCount = (lByteCount-(lByteCount % 4))/4;
            lBytePosition = (lByteCount % 4)*8;
            lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount)<<lBytePosition));
            lByteCount++;
        }
        lWordCount = (lByteCount-(lByteCount % 4))/4;
        lBytePosition = (lByteCount % 4)*8;
        lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80<<lBytePosition);
        lWordArray[lNumberOfWords-2] = lMessageLength<<3;
        lWordArray[lNumberOfWords-1] = lMessageLength>>>29;
        return lWordArray;
    };
    function md5_WordToHex(lValue) {
        var WordToHexValue="",WordToHexValue_temp="",lByte,lCount;
        for (lCount = 0;lCount<=3;lCount++) {
            lByte = (lValue>>>(lCount*8)) & 255;
            WordToHexValue_temp = "0" + lByte.toString(16);
            WordToHexValue = WordToHexValue + WordToHexValue_temp.substring(WordToHexValue_temp.length-2);
        }
        return WordToHexValue;
    };
    function md5_Utf8Encode(string) {
        string = string.replace(/\r\n/g,"\n");
        var utftext = "";
        for (var n = 0; n < string.length; n++) {
            var c = string.charCodeAt(n);
            if (c < 128) {
                utftext += String.fromCharCode(c);
            }
            else if((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            }
            else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }
        }
        return utftext;
    };
    var x=Array();
    var k,AA,BB,CC,DD,a,b,c,d;
    var S11=7, S12=12, S13=17, S14=22;
    var S21=5, S22=9 , S23=14, S24=20;
    var S31=4, S32=11, S33=16, S34=23;
    var S41=6, S42=10, S43=15, S44=21;
    string = md5_Utf8Encode(string);
    x = md5_ConvertToWordArray(string);
    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;
    for (k=0;k<x.length;k+=16) {
        AA=a; BB=b; CC=c; DD=d;
        a=md5_FF(a,b,c,d,x[k+0], S11,0xD76AA478);
        d=md5_FF(d,a,b,c,x[k+1], S12,0xE8C7B756);
        c=md5_FF(c,d,a,b,x[k+2], S13,0x242070DB);
        b=md5_FF(b,c,d,a,x[k+3], S14,0xC1BDCEEE);
        a=md5_FF(a,b,c,d,x[k+4], S11,0xF57C0FAF);
        d=md5_FF(d,a,b,c,x[k+5], S12,0x4787C62A);
        c=md5_FF(c,d,a,b,x[k+6], S13,0xA8304613);
        b=md5_FF(b,c,d,a,x[k+7], S14,0xFD469501);
        a=md5_FF(a,b,c,d,x[k+8], S11,0x698098D8);
        d=md5_FF(d,a,b,c,x[k+9], S12,0x8B44F7AF);
        c=md5_FF(c,d,a,b,x[k+10],S13,0xFFFF5BB1);
        b=md5_FF(b,c,d,a,x[k+11],S14,0x895CD7BE);
        a=md5_FF(a,b,c,d,x[k+12],S11,0x6B901122);
        d=md5_FF(d,a,b,c,x[k+13],S12,0xFD987193);
        c=md5_FF(c,d,a,b,x[k+14],S13,0xA679438E);
        b=md5_FF(b,c,d,a,x[k+15],S14,0x49B40821);
        a=md5_GG(a,b,c,d,x[k+1], S21,0xF61E2562);
        d=md5_GG(d,a,b,c,x[k+6], S22,0xC040B340);
        c=md5_GG(c,d,a,b,x[k+11],S23,0x265E5A51);
        b=md5_GG(b,c,d,a,x[k+0], S24,0xE9B6C7AA);
        a=md5_GG(a,b,c,d,x[k+5], S21,0xD62F105D);
        d=md5_GG(d,a,b,c,x[k+10],S22,0x2441453);
        c=md5_GG(c,d,a,b,x[k+15],S23,0xD8A1E681);
        b=md5_GG(b,c,d,a,x[k+4], S24,0xE7D3FBC8);
        a=md5_GG(a,b,c,d,x[k+9], S21,0x21E1CDE6);
        d=md5_GG(d,a,b,c,x[k+14],S22,0xC33707D6);
        c=md5_GG(c,d,a,b,x[k+3], S23,0xF4D50D87);
        b=md5_GG(b,c,d,a,x[k+8], S24,0x455A14ED);
        a=md5_GG(a,b,c,d,x[k+13],S21,0xA9E3E905);
        d=md5_GG(d,a,b,c,x[k+2], S22,0xFCEFA3F8);
        c=md5_GG(c,d,a,b,x[k+7], S23,0x676F02D9);
        b=md5_GG(b,c,d,a,x[k+12],S24,0x8D2A4C8A);
        a=md5_HH(a,b,c,d,x[k+5], S31,0xFFFA3942);
        d=md5_HH(d,a,b,c,x[k+8], S32,0x8771F681);
        c=md5_HH(c,d,a,b,x[k+11],S33,0x6D9D6122);
        b=md5_HH(b,c,d,a,x[k+14],S34,0xFDE5380C);
        a=md5_HH(a,b,c,d,x[k+1], S31,0xA4BEEA44);
        d=md5_HH(d,a,b,c,x[k+4], S32,0x4BDECFA9);
        c=md5_HH(c,d,a,b,x[k+7], S33,0xF6BB4B60);
        b=md5_HH(b,c,d,a,x[k+10],S34,0xBEBFBC70);
        a=md5_HH(a,b,c,d,x[k+13],S31,0x289B7EC6);
        d=md5_HH(d,a,b,c,x[k+0], S32,0xEAA127FA);
        c=md5_HH(c,d,a,b,x[k+3], S33,0xD4EF3085);
        b=md5_HH(b,c,d,a,x[k+6], S34,0x4881D05);
        a=md5_HH(a,b,c,d,x[k+9], S31,0xD9D4D039);
        d=md5_HH(d,a,b,c,x[k+12],S32,0xE6DB99E5);
        c=md5_HH(c,d,a,b,x[k+15],S33,0x1FA27CF8);
        b=md5_HH(b,c,d,a,x[k+2], S34,0xC4AC5665);
        a=md5_II(a,b,c,d,x[k+0], S41,0xF4292244);
        d=md5_II(d,a,b,c,x[k+7], S42,0x432AFF97);
        c=md5_II(c,d,a,b,x[k+14],S43,0xAB9423A7);
        b=md5_II(b,c,d,a,x[k+5], S44,0xFC93A039);
        a=md5_II(a,b,c,d,x[k+12],S41,0x655B59C3);
        d=md5_II(d,a,b,c,x[k+3], S42,0x8F0CCC92);
        c=md5_II(c,d,a,b,x[k+10],S43,0xFFEFF47D);
        b=md5_II(b,c,d,a,x[k+1], S44,0x85845DD1);
        a=md5_II(a,b,c,d,x[k+8], S41,0x6FA87E4F);
        d=md5_II(d,a,b,c,x[k+15],S42,0xFE2CE6E0);
        c=md5_II(c,d,a,b,x[k+6], S43,0xA3014314);
        b=md5_II(b,c,d,a,x[k+13],S44,0x4E0811A1);
        a=md5_II(a,b,c,d,x[k+4], S41,0xF7537E82);
        d=md5_II(d,a,b,c,x[k+11],S42,0xBD3AF235);
        c=md5_II(c,d,a,b,x[k+2], S43,0x2AD7D2BB);
        b=md5_II(b,c,d,a,x[k+9], S44,0xEB86D391);
        a=md5_AddUnsigned(a,AA);
        b=md5_AddUnsigned(b,BB);
        c=md5_AddUnsigned(c,CC);
        d=md5_AddUnsigned(d,DD);
    }
    return (md5_WordToHex(a)+md5_WordToHex(b)+md5_WordToHex(c)+md5_WordToHex(d)).toLowerCase();
}

/**
 * 加密密码 - 使用MD5加密并拼接盐值
 * @param {string} password 原始密码
 * @returns {string} 加密后的密码
 */
function encryptPassword(password) {
    if (!password) return '';

    // 密码 + 盐值，然后MD5加密
    const passwordWithSalt = password + PASSWORD_SALT;
    const encryptedPassword = md5(passwordWithSalt);

    console.log('密码加密:', {
        original: password,
        withSalt: passwordWithSalt,
        encrypted: encryptedPassword
    });

    return encryptedPassword;
}

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
