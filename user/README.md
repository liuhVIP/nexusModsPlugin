# 用户认证模块

## 📋 功能概述

用户认证模块为 Nexus Mods 智能助手提供了完整的用户账号管理功能，包括：

- 🔐 用户登录（支持邮箱登录和账号登录）
- 📝 用户注册（邮箱注册，包含邮箱验证）
- 👤 用户状态管理
- 🎨 现代化UI设计

## 📁 文件结构

```
user/
├── user-auth.html      # 登录注册页面
├── user-auth.css       # 现代化样式文件
├── user-auth.js        # 登录注册逻辑
├── user-profile.html   # 用户详情页面
├── user-profile.css    # 用户详情样式文件
├── user-profile.js     # 用户详情逻辑
├── user-manager.js     # 用户状态管理
├── test-password-encryption.html  # 密码加密测试页面
└── README.md          # 说明文档
```

## 🚀 功能特性

### 登录功能
- ✅ 邮箱登录
- ✅ 账号密码登录
- ✅ 记住我功能
- ✅ 密码显示切换
- ✅ 实时表单验证

### 注册功能
- ✅ 邮箱注册
- ✅ 邮箱验证码验证
- ✅ 密码强度验证
- ✅ 确认密码验证
- ✅ 邀请码支持（可选）
- ✅ 用户协议确认

### 用户管理
- ✅ 用户状态持久化
- ✅ Token自动过期检查
- ✅ 用户信息缓存
- ✅ 登录状态回调
- ✅ 权限管理

### 用户详情
- ✅ 用户信息查看
- ✅ 用户信息编辑
- ✅ 头像更换功能
- ✅ 角色标签显示
- ✅ 密码修改功能
- ✅ 账户安全设置
- ✅ 表单验证
- ✅ 实时保存

### UI设计
- 🎨 现代化渐变背景
- 🎨 响应式布局
- 🎨 友好的交互动画
- 🎨 优雅的错误提示
- 🎨 加载状态指示

## 🔧 API接口

### 后端接口
注意：token字段在请求头传递是是token，不是authorization
#### 认证相关
- `POST /login/sendEmailCode` - 发送邮箱验证码
- `POST /login/emailRegister` - 邮箱注册
- `POST /login/emailLogin` - 邮箱登录
- `POST /login/accountLogin` - 账号密码登录
- `POST /login/logout` - 退出登录

#### 用户详情相关
- `POST /user/getDetail` - 获取用户详细信息
- `POST /user/updateMine` - 修改我的信息
- `POST /user/update/pwd` - 修改用户密码

**获取用户详情请求格式**:
```json
{
  "userId": "用户ID字符串"
}
```

**获取用户详情响应格式**:
```json
{
  "code": 200,
  "data": {
    "userId": "用户ID",
    "userName": "用户名称",
    "account": "账号",
    "phone": "手机号码",
    "remark": "备注信息",
    "roleIds": ["角色ID数组"],
    "avatarFileId": "头像文件ID"
  },
  "msg": "操作成功",
  "detail": "详细描述"
}
```

**修改我的信息请求格式**:
```json
{
  "userName": "用户名称",
  "nickName": "昵称",
  "phone": "15882080821",
  "city": "所在城市",
  "sex": 0,
  "avatarUrl": "头像地址"
}
```

**修改我的信息响应格式**:
```json
{
  "code": 200,
  "msg": "修改成功",
  "detail": "详细描述"
}
```

**修改密码请求格式**:
```json
{
  "oldPwd": "加密后的原密码",
  "newPwd": "加密后的新密码"
}
```

**修改密码响应格式**:
```json
{
  "code": 200,
  "msg": "密码修改成功",
  "detail": "详细描述"
}
```

#### 文件管理相关
- `POST /file/upload` - 通用文件上传接口
- `GET /file/view/{fileId}` - 通过文件ID在线预览

**文件上传请求格式** (multipart/form-data):
```
file: 文件对象
```

**文件上传响应格式**:
```json
{
  "code": 200,
  "data": {
    "fileId": "文件ID",
    "fileName": "文件名",
    "fileSize": 文件大小,
    "fileType": "文件类型",
    "fileUrl": "文件存储地址",
    "fileFullUrl": "文件完整访问地址",
    "fileThumbnailUrl": "文件缩略图地址",
    "fileServer": "文件存储服务器"
  },
  "msg": "上传成功"
}
```

### 前端API
```javascript
// 用户管理器实例
const userManager = window.userManager;

// 检查登录状态
userManager.isUserLoggedIn()

// 获取用户数据
userManager.getUserData()

// 获取用户Token
userManager.getToken()

// 打开登录窗口
userManager.openLoginWindow()

// 打开用户详情窗口
userManager.openProfileWindow()

// 用户登出
await userManager.logout()

// 监听登录事件
userManager.onLogin((userData) => {
    console.log('用户已登录:', userData);
});

// 监听登出事件
userManager.onLogout(() => {
    console.log('用户已登出');
});
```

## 🎯 集成方式

### 1. 在控制面板中集成

用户中心已集成到 `popup.html` 中，显示用户登录状态和操作按钮：

- 未登录：显示登录/注册按钮
- 已登录：显示用户信息、个人资料和登出按钮

### 2. 在其他页面中使用

```html
<!-- 引入用户管理器 -->
<script src="user/user-manager.js"></script>

<script>
// 检查用户状态
if (userManager.isUserLoggedIn()) {
    const userData = userManager.getUserData();
    console.log('当前用户:', userData);
} else {
    console.log('用户未登录');
}
</script>
```

## 🔒 安全特性

- ✅ 密码MD5加密传输（密码+盐值"gmyy"）
- ✅ Token自动过期管理（7天）
- ✅ 本地存储加密
- ✅ HTTPS通信
- ✅ 输入验证和清理
- ✅ CSRF防护

### 密码加密规则

用户密码在传输前会进行MD5加密处理：

```javascript
// 加密规则：MD5(原始密码 + "gmyy")
function encryptPassword(password) {
    const passwordWithSalt = password + "gmyy";
    return md5(passwordWithSalt);
}

// 示例：
// 原始密码: "123456"
// 加盐后: "123456gmyy"
// MD5加密: "e10adc3949ba59abbe56e057f20f883e"
```

这确保了：
- 🔐 密码不会以明文形式传输
- 🔐 即使相同密码，加盐后的MD5值更安全
- 🔐 符合后端API的加密要求

## 🧪 测试

### 功能测试
使用 `test-auth.html` 页面进行功能测试：

1. 打开 `user/test-auth.html`
2. 测试各项功能
3. 查看控制台日志
4. 验证用户状态变化

### 密码加密测试
使用 `test-password-encryption.html` 页面测试密码加密：

1. 打开 `user/test-password-encryption.html`
2. 输入测试密码
3. 查看加密结果
4. 验证加密算法正确性

## 📱 响应式设计

- 📱 移动端适配
- 💻 桌面端优化
- 🎨 自适应布局
- ⚡ 流畅动画

## 🎨 样式定制

CSS变量定义在 `user-auth.css` 中，可以轻松定制：

```css
:root {
    --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --secondary-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    --success-gradient: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    /* ... 更多变量 */
}
```

## 🔄 状态管理

用户状态通过 `UserManager` 类进行管理：

- 自动加载保存的用户数据
- 监听用户状态变化
- 提供回调机制
- 处理Token过期

## 📝 使用示例

```javascript
// 监听用户登录
userManager.onLogin((userData) => {
    // 更新UI显示
    updateUserInterface(userData);
    
    // 发送欢迎消息
    showWelcomeMessage(userData.nickName);
});

// 监听用户登出
userManager.onLogout(() => {
    // 清理用户相关数据
    clearUserInterface();
    
    // 重定向到登录页面
    showLoginPrompt();
});

// 检查用户权限
if (userManager.hasPermission('admin')) {
    showAdminPanel();
}
```

## 🐛 故障排除

### 常见问题

1. **用户管理器未初始化**
   - 确保已引入 `user-manager.js`
   - 检查控制台错误信息

2. **登录窗口无法打开**
   - 检查浏览器弹窗设置
   - 确认扩展权限配置

3. **Token过期**
   - 自动处理，用户需重新登录
   - 检查系统时间设置

4. **网络请求失败**
   - 检查网络连接
   - 确认API服务器状态

## 📄 许可证

本模块遵循 Apache-2.0 许可证，详见项目根目录的 LICENSE 文件。

## 👨‍💻 作者

- 作者：改洺_ (B站UP主改洺_)
- 项目：Nexus Mods 智能助手
- 版本：2.0
