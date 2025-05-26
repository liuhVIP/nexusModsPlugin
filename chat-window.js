// 悬浮窗管理
class ChatWindow {
  constructor() {
    this.window = document.querySelector('.chat-container');
    this.header = document.querySelector('.chat-header');
    this.minimizeBtn = document.getElementById('minimizeBtn');
    this.closeBtn = document.getElementById('closeBtn');
    this.isMinimized = false;
    
    // 设置默认大小
    this.window.style.height = '1000px';
    this.window.style.width = '1200px';
    
    this.init();
  }
  
  init() {
    // 初始化按钮事件
    if (this.minimizeBtn) {
      this.minimizeBtn.addEventListener('click', this.toggleMinimize.bind(this));
    }
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', this.close.bind(this));
    }
  }
  
  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    if (this.isMinimized) {
      this.window.style.height = '40px';
      this.minimizeBtn.querySelector('img').src = 'images/maximize.png';
    } else {
      this.window.style.height = '1000px';
      this.window.style.width = '1200px';
      this.minimizeBtn.querySelector('img').src = 'images/minimize.png';
    }
  }
  
  close() {
    // 发送消息给popup.js，通知关闭窗口
    chrome.runtime.sendMessage({ action: 'closeChatWindow' });
  }
}

// 初始化悬浮窗
document.addEventListener('DOMContentLoaded', () => {
  window.chatWindow = new ChatWindow();
}); 