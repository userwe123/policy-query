/**
 * 保单查询系统 - 主题管理器
 * 支持亮色/暗色主题切换和自定义配色
 */

class ThemeManager {
  constructor() {
    this.currentTheme = localStorage.getItem('theme') || 'light';
    this.customColors = JSON.parse(localStorage.getItem('customColors') || '{}');
    this.init();
  }

  init() {
    this.applyTheme(this.currentTheme);
    this.applyCustomColors();
    this.createToggleButton();
    this.createSettingsPanel();
  }

  // 切换主题
  toggleTheme() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(this.currentTheme);
    localStorage.setItem('theme', this.currentTheme);
  }

  // 应用主题
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.currentTheme = theme;
    
    // 更新切换按钮图标
    const toggleBtn = document.querySelector('.theme-toggle');
    if (toggleBtn) {
      toggleBtn.innerHTML = theme === 'light' ? '🌙' : '☀️';
    }
  }

  // 设置自定义颜色
  setCustomColor(colorName, colorValue) {
    this.customColors[colorName] = colorValue;
    localStorage.setItem('customColors', JSON.stringify(this.customColors));
    this.applyCustomColors();
  }

  // 应用自定义颜色
  applyCustomColors() {
    Object.entries(this.customColors).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  }

  // 重置自定义颜色
  resetCustomColors() {
    this.customColors = {};
    localStorage.removeItem('customColors');
    
    // 移除所有自定义CSS变量
    const root = document.documentElement;
    const customVars = ['--primary-color', '--primary-dark', '--primary-light', '--secondary-color'];
    customVars.forEach(varName => {
      root.style.removeProperty(varName);
    });
  }

  // 创建主题切换按钮
  createToggleButton() {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'theme-toggle';
    toggleBtn.innerHTML = this.currentTheme === 'light' ? '🌙' : '☀️';
    toggleBtn.title = '切换主题';
    toggleBtn.onclick = () => this.toggleTheme();
    document.body.appendChild(toggleBtn);
  }

  // 创建设置面板
  createSettingsPanel() {
    const panel = document.createElement('div');
    panel.className = 'settings-panel';
    panel.innerHTML = `
      <div class="settings-header">
        <h3>🎨 主题设置</h3>
        <button class="settings-close" onclick="themeManager.closeSettings()">×</button>
      </div>
      <div class="settings-content">
        <div class="setting-group">
          <label>主题模式</label>
          <div class="theme-options">
            <button class="theme-option ${this.currentTheme === 'light' ? 'active' : ''}" onclick="themeManager.applyTheme('light'); themeManager.updateSettingsUI();">
              ☀️ 亮色
            </button>
            <button class="theme-option ${this.currentTheme === 'dark' ? 'active' : ''}" onclick="themeManager.applyTheme('dark'); themeManager.updateSettingsUI();">
              🌙 暗色
            </button>
          </div>
        </div>
        
        <div class="setting-group">
          <label>主色调</label>
          <div class="color-presets">
            <button class="color-preset" style="background: #667eea;" onclick="themeManager.setPrimaryColor('#667eea', '#5568d3', '#8fa0f2')" title="蓝紫"></button>
            <button class="color-preset" style="background: #1890ff;" onclick="themeManager.setPrimaryColor('#1890ff', '#096dd9', '#40a9ff')" title="蓝色"></button>
            <button class="color-preset" style="background: #52c41a;" onclick="themeManager.setPrimaryColor('#52c41a', '#47a816', '#73d13d')" title="绿色"></button>
            <button class="color-preset" style="background: #fa8c16;" onclick="themeManager.setPrimaryColor('#fa8c16', '#d48806', '#ffa940')" title="橙色"></button>
            <button class="color-preset" style="background: #f5222d;" onclick="themeManager.setPrimaryColor('#f5222d', '#d91a1a', '#ff4d4f')" title="红色"></button>
            <button class="color-preset" style="background: #722ed1;" onclick="themeManager.setPrimaryColor('#722ed1', '#531dab', '#9254de')" title="紫色"></button>
          </div>
        </div>
        
        <div class="setting-group">
          <label>自定义主色</label>
          <div class="custom-color-input">
            <input type="color" id="customPrimaryColor" value="${this.customColors['--primary-color'] || '#667eea'}" onchange="themeManager.setPrimaryColorFromPicker(this.value)">
            <span class="color-hex" id="colorHexDisplay">${this.customColors['--primary-color'] || '#667eea'}</span>
          </div>
        </div>
        
        <div class="setting-group">
          <button class="btn btn-secondary btn-block" onclick="themeManager.resetCustomColors(); themeManager.updateSettingsUI();">
            🔄 重置为默认
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(panel);
    
    // 添加打开设置按钮
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'settings-toggle';
    settingsBtn.innerHTML = '⚙️';
    settingsBtn.title = '主题设置';
    settingsBtn.onclick = () => this.openSettings();
    document.body.appendChild(settingsBtn);
  }

  // 打开设置面板
  openSettings() {
    const panel = document.querySelector('.settings-panel');
    panel.classList.add('open');
  }

  // 关闭设置面板
  closeSettings() {
    const panel = document.querySelector('.settings-panel');
    panel.classList.remove('open');
  }

  // 更新设置面板UI
  updateSettingsUI() {
    // 更新主题选项
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.classList.remove('active');
      if (btn.textContent.includes(this.currentTheme === 'light' ? '亮色' : '暗色')) {
        btn.classList.add('active');
      }
    });
    
    // 更新颜色选择器
    const colorPicker = document.getElementById('customPrimaryColor');
    if (colorPicker) {
      colorPicker.value = this.customColors['--primary-color'] || '#667eea';
    }
    
    const hexDisplay = document.getElementById('colorHexDisplay');
    if (hexDisplay) {
      hexDisplay.textContent = this.customColors['--primary-color'] || '#667eea';
    }
  }

  // 设置主色调
  setPrimaryColor(primary, dark, light) {
    this.setCustomColor('--primary-color', primary);
    this.setCustomColor('--primary-dark', dark);
    this.setCustomColor('--primary-light', light);
    this.updateSettingsUI();
  }

  // 从颜色选择器设置主色
  setPrimaryColorFromPicker(color) {
    // 生成深色和浅色变体
    const dark = this.adjustColor(color, -20);
    const light = this.adjustColor(color, 30);
    
    this.setPrimaryColor(color, dark, light);
    
    const hexDisplay = document.getElementById('colorHexDisplay');
    if (hexDisplay) {
      hexDisplay.textContent = color;
    }
  }

  // 调整颜色亮度
  adjustColor(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
}

// 添加设置面板样式
const settingsStyles = document.createElement('style');
settingsStyles.textContent = `
  .settings-panel {
    position: fixed;
    top: 0;
    right: -400px;
    width: 380px;
    height: 100vh;
    background: var(--bg-secondary);
    box-shadow: var(--shadow-xl);
    z-index: 9999;
    transition: right var(--transition-normal);
    overflow-y: auto;
  }
  
  .settings-panel.open {
    right: 0;
  }
  
  .settings-header {
    padding: var(--spacing-lg);
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 1;
  }
  
  .settings-header h3 {
    font-size: var(--font-size-lg);
    font-weight: 600;
  }
  
  .settings-close {
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    font-size: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }
  
  .settings-close:hover {
    background: rgba(255,255,255,0.3);
    transform: rotate(90deg);
  }
  
  .settings-content {
    padding: var(--spacing-lg);
  }
  
  .setting-group {
    margin-bottom: var(--spacing-xl);
  }
  
  .setting-group label {
    display: block;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: var(--spacing-sm);
  }
  
  .theme-options {
    display: flex;
    gap: var(--spacing-sm);
  }
  
  .theme-option {
    flex: 1;
    padding: 12px;
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: var(--font-size-base);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  
  .theme-option:hover {
    border-color: var(--primary-color);
  }
  
  .theme-option.active {
    border-color: var(--primary-color);
    background: var(--primary-color);
    color: white;
  }
  
  .color-presets {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: var(--spacing-sm);
  }
  
  .color-preset {
    aspect-ratio: 1;
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  
  .color-preset:hover {
    transform: scale(1.1);
    box-shadow: var(--shadow-md);
  }
  
  .custom-color-input {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }
  
  .custom-color-input input[type="color"] {
    width: 60px;
    height: 40px;
    border: 2px solid var(--border-color);
    border-radius: var(--radius-md);
    cursor: pointer;
  }
  
  .color-hex {
    font-family: 'Courier New', monospace;
    font-size: var(--font-size-base);
    color: var(--text-secondary);
  }
  
  .settings-toggle {
    position: fixed;
    bottom: 90px;
    right: 24px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--secondary-color);
    color: white;
    border: none;
    cursor: pointer;
    box-shadow: var(--shadow-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    transition: all var(--transition-normal);
    z-index: 1000;
  }
  
  .settings-toggle:hover {
    transform: scale(1.1) rotate(90deg);
    box-shadow: var(--shadow-xl);
  }
  
  .btn-block {
    width: 100%;
  }
`;
document.head.appendChild(settingsStyles);

// 初始化主题管理器
const themeManager = new ThemeManager();
