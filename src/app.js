const WEEK_LABELS = [
  '第1周周一', '第1周周二', '第1周周三', '第1周周四',
  '第1周周五', '第1周周六', '第1周周日',
  '第2周周一', '第2周周二', '第2周周三', '第2周周四',
  '第2周周五', '第2周周六',
];

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

window.app = {
  currentSection: 'main-menu',
  pageHistory: [],
  _navBack: false,
  editingTable: null,
  isEditing: false,

  // 首页诗意短句（每次启动随机取一条）
  homeQuotes: [
    '山有木兮木有枝，心悦君兮君不知。',
    '愿我如星君如月，夜夜流光相皎洁。',
    '海上月是天上月，眼前人是心上人。',
    '晓看天色暮看云，行也思君，坐也思君。',
    '银河揉碎了星光，一半落进梦里，一半落进你眼里。',
    '晚风轻踩着云朵，月亮在贩售温柔。',
    '你是落日弥漫的橘，也是天边透亮的星。',
    '山河远阔，人间烟火，无一是你，无一不是你。',
    '我攒了一整个宇宙的温柔，只为在人间遇见你。',
    '云朵偷喝了屋顶的酒，于是脸红成了晚霞。',
    '星星是银河写给月亮的情书。',
    '落日归山海，烟火向星辰，所愿皆成真。',
    '想和你一起，把世间所有的月亮都看一遍。',
    '风很温柔，花很浪漫，而你刚刚好。'
  ],

  init() {
    this.showHomeQuote();
    this.animateSplash();
    this.bindClickSounds();
    this.bindInputGuard();
    this.initRemoteUpdateListener();
    this.checkLicenseAndStart();
  },

  showHomeQuote() {
    const el = document.getElementById('home-quote');
    if (!el || !this.homeQuotes || !this.homeQuotes.length) return;
    const q = this.homeQuotes[Math.floor(Math.random() * this.homeQuotes.length)];
    el.textContent = '「' + q + '」';
  },

  async checkLicenseAndStart() {
    var self = this;
    try {
      var cfg = await window.electronAPI.getConfig();
      if (cfg && cfg.agreedToLicense) {
        this.initSettings();
        setTimeout(() => this.checkUpdate(), 2600);
        return;
      }
    } catch (e) {}
    // 未同意，显示协议弹窗
    var modal = document.getElementById('license-modal');
    if (modal) {
      modal.style.display = 'flex';
      var agreeBtn = document.getElementById('license-agree');
      var disagreeBtn = document.getElementById('license-disagree');
      agreeBtn.onclick = async function () {
        try { await window.electronAPI.updateSettingsConfig({ agreedToLicense: true }); } catch (e) {}
        modal.style.display = 'none';
        self.initSettings();
        setTimeout(() => self.checkUpdate(), 1000);
      };
      disagreeBtn.onclick = function () {
        window.close();
      };
    }
  },

  // 全局输入框保护：任何输入框/文本框获得焦点时，强制解除 disabled/readOnly，
  // 确保所有输入框都能反复编辑，不会因任何操作被意外锁定
  bindInputGuard() {
    document.addEventListener('focusin', function(e) {
      if (window.app && window.app.tablesLocked && !window.app.creatorMode) return;
      var el = e.target;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        el.disabled = false;
        el.readOnly = false;
      }
    });
    // 鐐瑰嚮杈撳叆妗嗘椂涔熺‘淇濆彲缂栬緫锛堥槻姝?focusin 琚嫤鎴級
    document.addEventListener('mousedown', function(e) {
      if (window.app && window.app.tablesLocked && !window.app.creatorMode) return;
      var el = e.target;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        el.disabled = false;
        el.readOnly = false;
      }
    }, true);
  },

  // ===== 音效系统 =====
  soundCtx: null,
  soundEnabled: true,
  soundVolume: 50,

  async initSettings() {
    try {
      const config = await window.electronAPI.getConfig();
      this.soundEnabled = config.soundEnabled !== false;
      this.soundVolume = config.soundVolume || 50;
      this.language = config.language || 'zh';
      this.fontFamily = config.fontFamily || 'Microsoft YaHei';
      this.bgmEnabled = config.bgmEnabled === true;
      this.bgmVolume = config.bgmVolume || 30;
      this.passwordLocked = config.passwordLocked === true;
      this.tablesLocked = config.tablesLocked === true;
      this.autoSave = config.autoSave !== false;
      this.autoLock = config.autoLock === true;
      this.themeSkin = config.themeSkin || 'default';
      this.displayTheme = config.displayTheme || 'light';
    } catch(e) {
      this.soundEnabled = true; this.soundVolume = 50;
      this.language = 'zh'; this.fontFamily = 'Microsoft YaHei';
      this.bgmEnabled = false; this.bgmVolume = 30;
    }
    this.applyFont();
    this.applyTheme(this.themeSkin || 'default', true);
    if (this.bgmEnabled) this.startBgm();
  },

  // 当前设置
  language: 'zh',
  fontFamily: 'Microsoft YaHei',
  bgmEnabled: false,
  bgmVolume: 30, themeSkin: 'default', displayTheme: 'light', passwordLocked: false, tablesLocked: false, autoSave: true, autoLock: false,
  bgmAudio: null,
  selectedLang: 'zh',
  selectedFont: 'Microsoft YaHei',

  // ===== 国际化 =====
  i18n: {
    zh: {
      appTitle: '📋 班级服务管理系统', splashTitle: '班级服务管理系统', splashSub: 'Class Service Management System',
      welcome: '欢迎使用', heroDesc: '高效管理班级小组排名 · 自动统计与排名',
      createNew: '开始新的表格', createNewDesc: '创建一个新的排名表格', createNow: '立即创建 →',
      manageTbl: '管理表格', manageDesc: '查看、编辑、删除、打印已有表格', enterManage: '进入管理 →',
      backup: '数据备份', backupDesc: '导出备份或从备份恢复', enterBackup: '进入备份 →',
      importExcel: '导入 Excel', importDesc: '从 xlsx/csv 导入名单', importNow: '立即导入 →',
      settings: '设置', settingsDesc: '密码、音效、关于软件', enterSettings: '进入设置 →',
      tableCount: '当前共', tables: '个表格',
      maker: '制作者：高二3班 王大玮', version: '版本', copyright: '版权由制作者所有',
      back: '← 返回', newTable: '新建表格', editor: '编辑表格', manageTitle: '管理表格',
      settingsTitle: '⚙️ 设置', passwordTitle: '🔒 密码验证', backupTitle: '💾 数据备份', importTitle: '📥 导入 Excel',
      pwdPrompt: '请输入管理员密码', pwdPlaceholder: '输入密码', unlock: '解锁', pwdError: '密码错误，请重试',
      settingsH2: '设置', changePwd: '修改密码', changePwdDesc: '修改管理员密码',
      pwdProtect: '密码保护', pwdProtectDesc: '关闭密码保护', soundSet: '音效设置', soundDesc: '点击音效与音量',
      about: '关于软件', aboutDesc: '版本与更新日志', language: '语言切换', langDesc: '中文 / English',
      font: '字体切换', fontDesc: '选择应用字体', bgm: '背景音乐', bgmDesc: '音量与开关',
      backToSettings: '← 返回设置', save: '保存设置', testSound: '🔊 试听', soundOn: '点击音效',
      volLabel: '音量大小', oldPwd: '旧密码', newPwd: '新密码（4-6位数字）', confirmPwd: '确认新密码',
      pwdOn: '当前状态：密码保护已开启', pwdOff: '当前状态：密码保护已关闭',
      langH3: '🌐 语言切换', saveLang: '保存语言', fontH3: '🔤 字体切换', selectFont: '选择字体',
      fontPreview: '字体预览：班级服务管理系统 ABC123', saveFont: '保存字体',
      bgmH3: '🎵 背景音乐', bgmOn: '背景音乐', bgmVol: '背景音乐音量', testBgm: '🎵 试听', saveBgm: '保存设置',
      aboutH2: '班级服务管理系统', makerLabel: '制作者', curVer: '当前版本', copyrightLine: '版权由制作者所有',
      history: '历史更新内容',
      searchPlaceholder: '🔍 输入姓名搜索...', search: '搜索',
      autoCalc: '⚡ 自动计算', exportExcel: '📊 导出 Excel', clearScores: '🧹 清除积分',
      addRow: '➕ 增加表格', removeRow: '➖ 删除表格', edit: '编辑', done: '✓ 完成',
      modeEdit: '当前模式：查看模式（点击「编辑」可修改内容）',
      viewMode: '查看模式（点击「编辑」可修改内容）', editMode: '编辑模式：可直接修改表格内容，点击「保存编辑」保存',
      saveEdit: '保存编辑', groupCol: '第几小组', groupRank: '小组排名', groupTotal: '小组总分',
      nameCol: '学生姓名', personalRank: '个人排名', totalScore: '总分',
      newTableName: '请填写表格信息', tblName: '表格名称', totalPeople: '人数（总人数）',
      membersPerGroup: '每组成员数量', useLastName: '使用上一张表格的姓名', startMake: '开始制表',
      importName: '表格名称', importMembers: '每组成员数量', importInfo: '支持格式：.xlsx / .xls / .csv<br>仅导入 Excel 文件中的姓名列，其他数据不导入。<br>自动按每组成员数量分组填充。',
      selectFileImport: '选择文件并导入',
      backupInfo: '导出当前所有表格和配置到 JSON 备份文件，或在换机/重装后从备份恢复。',
      exportBackup: '📤 导出备份', importBackup: '📥 从备份恢复',
      updateSuccess: '更新成功！', updatedTo: '已更新到', updateContent: '本次更新内容：',
      thx: '感谢使用班级服务管理系统', startUse: '开始使用',
      pwdConfirmTitle: '请输入管理员密码', pwdConfirmDesc: '此操作需要管理员权限', confirm: '确认', cancel: '取消',
      group: '第', groupSuffix: '组', rankSuffix: '名', week1: '第1周周一'
    },
    en: {
      appTitle: '📋 Class Service Management System', splashTitle: 'Class Service Management System', splashSub: 'Class Service Management System',
      welcome: 'Welcome', heroDesc: 'Manage class group rankings efficiently · Auto stats & ranking',
      createNew: 'New Table', createNewDesc: 'Create a new ranking table', createNow: 'Create →',
      manageTbl: 'Manage Tables', manageDesc: 'View, edit, delete, print tables', enterManage: 'Manage →',
      backup: 'Data Backup', backupDesc: 'Export or restore backup', enterBackup: 'Backup →',
      importExcel: 'Import Excel', importDesc: 'Import names from xlsx/csv', importNow: 'Import →',
      settings: 'Settings', settingsDesc: 'Password, Sound, About', enterSettings: 'Settings →',
      tableCount: 'Total', tables: 'tables',
      maker: 'Made by: Class 2-3 Wang Dawei', version: 'Version', copyright: 'All rights reserved',
      back: '← Back', newTable: 'New Table', editor: 'Edit Table', manageTitle: 'Manage Tables',
      settingsTitle: '⚙️ Settings', passwordTitle: '🔒 Password', backupTitle: '💾 Backup', importTitle: '📥 Import Excel',
      pwdPrompt: 'Enter admin password', pwdPlaceholder: 'Password', unlock: 'Unlock', pwdError: 'Wrong password',
      settingsH2: 'Settings', changePwd: 'Change Password', changePwdDesc: 'Change admin password',
      pwdProtect: 'Password', pwdProtectDesc: 'Turn off password', soundSet: 'Sound', soundDesc: 'Click sound & volume',
      about: 'About', aboutDesc: 'Version & changelog', language: 'Language', langDesc: '中文 / English',
      font: 'Font', fontDesc: 'Choose app font', bgm: 'Background Music', bgmDesc: 'Volume & toggle',
      backToSettings: '← Back', save: 'Save', testSound: '🔊 Test', soundOn: 'Click Sound',
      volLabel: 'Volume', oldPwd: 'Old Password', newPwd: 'New Password (4-6 digits)', confirmPwd: 'Confirm Password',
      pwdOn: 'Status: Password protection ON', pwdOff: 'Status: Password protection OFF',
      langH3: '🌐 Language', saveLang: 'Save Language', fontH3: '🔤 Font', selectFont: 'Select Font',
      fontPreview: 'Font Preview: Class Service Management System ABC123', saveFont: 'Save Font',
      bgmH3: '🎵 Background Music', bgmOn: 'Background Music', bgmVol: 'BGM Volume', testBgm: '🎵 Test', saveBgm: 'Save',
      aboutH2: 'Class Service Management System', makerLabel: 'Made by', curVer: 'Version', copyrightLine: 'All rights reserved',
      history: 'Update History',
      searchPlaceholder: '🔍 Search name...', search: 'Search',
      autoCalc: '⚡ Auto Calc', exportExcel: '📊 Export Excel', clearScores: '🧹 Clear Scores',
      addRow: '➕ Add Row', removeRow: '➖ Remove Row', edit: 'Edit', done: '✓ Done',
      modeEdit: 'View mode (click Edit to modify)',
      viewMode: 'View mode (click Edit to modify)', editMode: 'Edit mode: modify directly, click Save',
      saveEdit: 'Save', groupCol: 'Group', groupRank: 'Group Rank', groupTotal: 'Group Total',
      nameCol: 'Name', personalRank: 'Personal Rank', totalScore: 'Total',
      newTableName: 'Table Info', tblName: 'Table Name', totalPeople: 'Total People',
      membersPerGroup: 'Members per Group', useLastName: 'Use names from last table', startMake: 'Create',
      importName: 'Table Name', importMembers: 'Members per Group', importInfo: 'Formats: .xlsx / .xls / .csv<br>Only the name column is imported.<br>Auto grouped by members per group.',
      selectFileImport: 'Select File & Import',
      backupInfo: 'Export all tables and config to JSON backup, or restore from backup.',
      exportBackup: '📤 Export Backup', importBackup: '📥 Restore Backup',
      updateSuccess: 'Update Successful!', updatedTo: 'Updated to', updateContent: 'This update:',
      thx: 'Thanks for using Class Service Management System', startUse: 'Start',
      pwdConfirmTitle: 'Enter Admin Password', pwdConfirmDesc: 'This requires admin permission', confirm: 'Confirm', cancel: 'Cancel',
      group: 'Group ', groupSuffix: '', rankSuffix: '', week1: 'W1 Mon'
    }
  },

  // 完整的中→英文本映射
  textMap: {
    '班级服务管理系统': 'Class Service Management System',
    '正在加载资源...': 'Loading resources...',
    '返回': 'Back',
    '更新成功！': 'Update Successful!',
    '已更新到': 'Updated to',
    '感谢使用班级服务管理系统': 'Thanks for using Class Service Management System',
    '开始使用': 'Start',
    '请输入管理员密码': 'Enter admin password',
    '此操作需要管理员权限': 'This requires admin permission',
    '输入管理员密码': 'Enter admin password',
    '确认': 'Confirm',
    '取消': 'Cancel',
    '请输入密码': 'Enter password',
    '解锁': 'Unlock',
    '欢迎使用': 'Welcome',
    '高效管理班级小组排名 · 自动统计与排名': 'Manage class group rankings · Auto stats & ranking',
    '开始新的表格': 'New Table',
    '创建一个新的排名表格': 'Create a new ranking table',
    '立即创建 →': 'Create →',
    '管理表格': 'Manage Tables',
    '查看、编辑、删除、打印已有表格': 'View, edit, delete, print tables',
    '进入管理 →': 'Manage →',
    '数据备份': 'Data Backup',
    '导出备份或从备份恢复': 'Export or restore backup',
    '进入备份 →': 'Backup →',
    '导入 Excel': 'Import Excel',
    '从 xlsx/csv 导入名单': 'Import names from xlsx/csv',
    '立即导入 →': 'Import →',
    '设置': 'Settings',
    '密码、音效、关于软件': 'Password, Sound, About',
    '进入设置 →': 'Settings →',
    '当前共': 'Total',
    '个表格': 'tables',
    '制作者：高二3班 王大玮': 'Made by: Class 2-3 Wang Dawei',
    '版本': 'Version',
    '版权由制作者所有': 'All rights reserved',
    '请填写表格信息': 'Table Info',
    '表格名称': 'Table Name',
    '例如：10月排名表': 'e.g. October Ranking',
    '人数（总人数）': 'Total People',
    '请输入总人数': 'Enter total people',
    '每组成员数量': 'Members per Group',
    '请输入每组人数': 'Enter members per group',
    '使用上一张表格的姓名': 'Use names from last table',
    '开始制表': 'Create',
    '编辑表格': 'Edit Table',
    '⚡ 自动计算': '⚡ Auto Calc',
    '📊 导出 Excel': '📊 Export Excel',
    '🧹 清除积分': '🧹 Clear Scores',
    '➕ 增加表格': '➕ Add Row',
    '➖ 删除表格': '➖ Remove Row',
    '🔍 输入姓名搜索...': '🔍 Search name...',
    '搜索': 'Search',
    '管理表格': 'Manage Tables',
    '修改密码': 'Change Password',
    '修改管理员密码': 'Change admin password',
    '密码保护': 'Password',
    '关闭密码保护': 'Turn off password',
    '音效设置': 'Sound',
    '点击音效与音量': 'Click sound & volume',
    '语言切换': 'Language',
    '中文 / English': '中文 / English',
    '字体切换': 'Font',
    '选择应用字体': 'Choose app font',
    '背景音乐': 'Background Music',
    '音量与开关': 'Volume & toggle',
    '关于软件': 'About',
    '版本与更新日志': 'Version & changelog',
    '← 返回设置': '← Back',
    '保存设置': 'Save',
    '🔊 试听': '🔊 Test',
    '点击音效': 'Click Sound',
    '音量大小': 'Volume',
    '旧密码': 'Old Password',
    '输入当前密码': 'Enter current password',
    '新密码（4-6位数字）': 'New Password (4-6 digits)',
    '4-6位数字': '4-6 digits',
    '确认新密码': 'Confirm Password',
    '再次输入新密码': 'Re-enter new password',
    '确认修改': 'Confirm',
    '当前状态：密码保护已开启': 'Status: Password protection ON',
    '当前状态：密码保护已关闭': 'Status: Password protection OFF',
    '🌐 语言切换': '🌐 Language',
    '保存语言': 'Save Language',
    '🔤 字体切换': '🔤 Font',
    '选择字体': 'Select Font',
    '字体预览：班级服务管理系统 ABC123': 'Font Preview: Class Service Management System ABC123',
    '保存字体': 'Save Font',
    '🎵 背景音乐': '🎵 Background Music',
    '背景音乐音量：': 'BGM Volume:',
    '🎵 试听': '🎵 Test',
    '保存设置': 'Save',
    '数据备份与恢复': 'Data Backup & Restore',
    '导出当前所有表格和配置到 JSON 备份文件，或在换机/重装后从备份恢复。': 'Export all tables and config to JSON backup, or restore from backup.',
    '📤 导出备份': '📤 Export Backup',
    '📥 从备份恢复': '📥 Restore Backup',
    '从 Excel 导入名单': 'Import Names from Excel',
    '支持格式：.xlsx / .xls / .csv': 'Formats: .xlsx / .xls / .csv',
    '仅导入 Excel 文件中的姓名列，其他数据不导入。': 'Only the name column is imported, other data is ignored.',
    '自动按每组成员数量分组填充。': 'Auto grouped by members per group.',
    '选择文件并导入': 'Select File & Import',
    '请输入表格名称': 'Enter table name',
    '第几小组': 'Group',
    '小组排名': 'Group Rank',
    '小组总分': 'Group Total',
    '学生姓名': 'Name',
    '个人排名': 'Personal Rank',
    '总分': 'Total',
    '编辑': 'Edit',
    '✓ 完成': '✓ Done',
    '查看模式（点击「编辑」可修改内容）': 'View mode (click Edit to modify)',
    '编辑模式：可直接修改表格内容，点击「保存编辑」保存': 'Edit mode: modify directly, click Save',
    '保存编辑': 'Save',
    '第': 'Group ',
    '组': '',
    '名': ''
  },

  applyLanguage() {
    const map = this.textMap;
    const isEn = this.language === 'en';
    // 构建反向映射（英文→中文），懒加载并缓存
    if (!this._revMap) {
      const rev = {};
      Object.keys(map).forEach(k => { rev[map[k]] = k; });
      this._revMap = rev;
    }
    const rev = this._revMap;
    const emojiRe = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu;
    // 双向翻译：切到英文走 map（中→英），切回中文走 rev（英→中）
    const translate = (raw) => {
      const text = (raw || '').trim();
      if (!text) return null;
      const table = isEn ? map : rev;
      if (table[text] !== undefined) return table[text];
      const stripped = text.replace(emojiRe, '').trim();
      if (stripped && table[stripped] !== undefined) {
        const emoji = text.replace(stripped, '').trim();
        return (emoji + ' ' + table[stripped]).trim();
      }
      return null;
    };
    // 遍历所有文本节点
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node) {
        if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return NodeFilter.FILTER_REJECT;
        if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    let n;
    while (n = walker.nextNode()) nodes.push(n);
    nodes.forEach(node => {
      const out = translate(node.textContent);
      if (out !== null) node.textContent = out;
    });
    // 处理 placeholder
    document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
      const orig = el.getAttribute('placeholder') || '';
      const out = translate(orig);
      if (out !== null) el.placeholder = out;
    });
    // 处理 title 属性
    document.querySelectorAll('[title]').forEach(el => {
      const orig = el.getAttribute('title') || '';
      const out = translate(orig);
      if (out !== null) el.setAttribute('title', out);
    });
    // 切换语言后立即重新应用当前选定字体，避免字体不即时刷新
    this.applyFont();
  },

  t(key) { return (this.i18n[this.language] || this.i18n.zh)[key] || key; },

  // ===== 字体 =====
  fontList: [
    'Microsoft YaHei', 'SimSun', 'SimHei', 'KaiTi', 'FangSong',
    'Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Comic Sans MS'
  ],

  applyFont() {
    document.body.style.fontFamily = '"' + this.fontFamily + '", sans-serif';
  },

  playClickSound() {
    if (!this.soundEnabled) return;
    try {
      if (!this.soundCtx) {
        this.soundCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = this.soundCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 800;
      const vol = (this.soundVolume / 100) * 0.15;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } catch(e) {}
  },

  bindClickSounds() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('.card') || e.target.closest('.settings-item') || e.target.closest('.op-edit') || e.target.closest('.op-del') || e.target.closest('.op-print')) {
        this.playClickSound();
      }
    });
  },

  async checkUpdate() {
    try {
      const result = await window.electronAPI.getAppVersion();
      this._appVersion = result.version;
      const verText = 'v' + result.version;
      // 同步更新弹窗与底部版本号显示
      const verEl = document.getElementById('update-ver');
      if (verEl) verEl.textContent = verText;
      const infoEl = document.querySelector('.version-info');
      if (infoEl) infoEl.textContent = '版本 ' + verText;
      const hv = document.getElementById('home-version');
      if (hv) hv.textContent = verText + ' · 已是最新';
      const hsv = document.getElementById('home-status-version');
      if (hsv) hsv.textContent = verText;
      // 渲染本次更新内容
      const changesEl = document.getElementById('update-changes');
      if (changesEl) {
        if (result.isUpdate && result.changes && result.changes.length > 0) {
          changesEl.innerHTML = '<div class="update-changes-title">本次更新内容：</div><ul>' +
            result.changes.map(c => '<li>' + c + '</li>').join('') + '</ul>';
        } else {
          changesEl.innerHTML = '';
        }
      }
      if (result.isUpdate) {
        setTimeout(() => {
          const modal = document.getElementById('update-success');
          modal.classList.remove('hidden');
        }, 300);
      }
    } catch(e) {}
  },

  closeUpdateModal() {
    document.getElementById('update-success').classList.add('hidden');
  },

  // ===== 远程自动更新（GitHub）=====
  initRemoteUpdateListener() {
    if (window.electronAPI.onUpdateAvailable) {
      window.electronAPI.onUpdateAvailable((info) => {
        this.showRemoteUpdateDialog(info);
      });
    }
    if (window.electronAPI.onUpdateDownloadProgress) {
      window.electronAPI.onUpdateDownloadProgress((percent) => {
        const bar = document.getElementById('update-download-bar');
        const txt = document.getElementById('update-download-txt');
        if (bar) bar.style.width = percent + '%';
        if (txt) txt.textContent = percent + '%';
      });
    }
  },

  showRemoteUpdateDialog(info) {
    const modal = document.getElementById('remote-update-modal');
    if (!modal) return;
    this._pendingUpdate = info;
    const verEl = document.getElementById('remote-update-ver');
    if (verEl) verEl.textContent = info.latestVersion || '';
    const curEl = document.getElementById('remote-update-cur');
    if (curEl) curEl.textContent = info.currentVersion || '';
    modal.classList.remove('hidden');
  },

  async downloadAndInstallUpdate() {
    try {
      let info = this._pendingUpdate;
      if (!info || !info.downloadUrl) {
        info = await window.electronAPI.checkUpdate();
      }
      if (info && info.error) {
        alert('检查更新失败：' + info.error);
        return;
      }
      if (!info || !info.hasUpdate) {
        alert('当前已是最新版本（v' + ((info && info.currentVersion) || this._appVersion || '') + '）');
        return;
      }
      if (!info.downloadUrl) {
        alert('发现新版本 v' + info.latestVersion + '，但更新安装包暂未就绪。\n请稍后重试，或前往 GitHub Releases 页面手动下载。');
        return;
      }
      document.getElementById('remote-update-modal').classList.add('hidden');
      const dlg = document.getElementById('update-downloading');
      if (dlg) dlg.classList.remove('hidden');
      const result = await window.electronAPI.downloadUpdate(info.downloadUrl);
      if (result.success) {
        if (dlg) dlg.classList.add('hidden');
        const ok = confirm('新版本下载完成，是否立即安装？\n安装后程序将自动重启。');
        if (ok) {
          await window.electronAPI.installUpdate(result.tmpPath);
        }
      } else {
        if (dlg) dlg.classList.add('hidden');
        alert('更新下载失败：' + (result.error || '未知错误'));
      }
    } catch (e) {
      const dlg = document.getElementById('update-downloading');
      if (dlg) dlg.classList.add('hidden');
      alert('更新失败：' + e.message);
    }
  },

  async checkUpdateNow() {
    try {
      const info = await window.electronAPI.checkUpdate();
      if (info.error) {
        alert('检查更新失败：' + info.error);
        return;
      }
      if (info.hasUpdate) {
        this.showRemoteUpdateDialog(info);
      } else if (info.noRelease) {
        alert('暂无更新发布（v' + info.currentVersion + '）');
      } else {
        alert('当前已是最新版本（v' + info.currentVersion + '）');
      }
    } catch (e) {
      alert('检查更新失败：' + e.message);
    }
  },

  animateSplash() {
    const splash = document.getElementById('splash');
    const progress = document.getElementById('splash-progress');
    const appEl = document.getElementById('app');
    let value = 0;
    const interval = setInterval(() => {
      value += 4;
      progress.style.width = value + '%';
      if (value >= 100) clearInterval(interval);
    }, 80);

    setTimeout(() => {
      splash.classList.add('hidden');
      appEl.classList.remove('hidden');
      this.checkPasswordNeeded();
    }, 2500);
  },

  async checkPasswordNeeded() {
    const config = await window.electronAPI.getConfig();
    if (config.passwordEnabled && config.passwordSet) {
      this.lockApp();
    } else {
      this.isLocked = false;
      document.body.classList.remove('app-locked');
      this.showMainMenu();
    }
  },

  lockApp() {
    this.isLocked = true;
    document.body.classList.add('app-locked');
    this.showSection('password-lock');
    const input = document.getElementById('lock-password-input');
    if (input) {
      requestAnimationFrame(() => input.focus());
      input.onkeydown = (e) => {
        if (e.key === 'Enter') this.unlock();
      };
    }
  },

  async unlock() {
    var input = document.getElementById('lock-password-input');
    var error = document.getElementById('lock-error');
    input.disabled = false; input.readOnly = false;
    var password = input.value.trim();
    if (!password) { error.textContent = '请输入密码'; input.focus(); return; }
    try {
      var result = await window.electronAPI.verifyPassword(password);
      if (result && result.success) {
        error.textContent = '';
        input.value = '';
        this.isLocked = false;
        document.body.classList.remove('app-locked');
        this.showMainMenu();
      } else {
        error.textContent = '密码错误，请重试';
        input.value = '';
        input.disabled = false;
        input.focus();
      }
    } catch (e) {
      error.textContent = '验证出错，请重试：' + (e && e.message ? e.message : e);
      input.value = '';
      input.disabled = false;
      input.focus();
    }
  },

  showPasswordManage() {
    this.showSettings();
  },

  showSettings() {
    this.showSection('password-manage');
    this.backToSettings();
    this.updatePasswordStatus();
  },

  backToSettings() {
    var menu = document.getElementById('settings-menu');
    if (menu) menu.classList.remove('hidden');
    var items = document.querySelectorAll('#settings-menu > .settings-item');
    for (var i = 0; i < items.length; i++) { items[i].classList.remove('hidden'); }
    var pages = ['change-password-form', 'disable-password-form', 'sound-settings-form', 'about-software', 'language-settings-form', 'font-settings-form', 'bgm-settings-form'];
    for (var j = 0; j < pages.length; j++) {
      var el = document.getElementById(pages[j]);
      if (el) el.classList.add('hidden');
    }
  },

  async showAboutSoftware() {
    var _am = document.getElementById('settings-menu'); if(_am)_am.classList.add('hidden');
    var _ap = document.querySelectorAll('#settings-menu .settings-item'); for(var _ai=0;_ai<_ap.length;_ai++){_ap[_ai].classList.add('hidden');}
    var items = document.querySelectorAll('#settings-menu > .settings-item');
    for (var i = 0; i < items.length; i++) { items[i].classList.add('hidden'); }
    var pages = ['change-password-form', 'disable-password-form', 'sound-settings-form', 'language-settings-form', 'font-settings-form', 'bgm-settings-form'];
    for (var j = 0; j < pages.length; j++) {
      var el = document.getElementById(pages[j]);
      if (el) el.classList.add('hidden');
    }
    var aboutEl = document.getElementById('about-software');
    if (aboutEl) aboutEl.classList.remove('hidden');
    // 获取版本号和更新日志
    try {
      const result = await window.electronAPI.getAppVersion();
      const verEl = document.getElementById('about-version');
      if (verEl) verEl.textContent = 'v' + result.version;
    } catch(e) {}
    try {
      const changelog = await window.electronAPI.getChangelog();
      const clEl = document.getElementById('about-changelog');
      if (clEl && changelog) {
        let html = '';
        const versions = Object.keys(changelog).sort(function(a, b) {
          return parseFloat(b) - parseFloat(a);
        });
        for (var vi = 0; vi < versions.length; vi++) {
          var ver = versions[vi];
          var data = changelog[ver];
          var items = Array.isArray(data) ? data : (data && data.items) ? data.items : [];
          var date = (data && !Array.isArray(data) && data.date) ? data.date : '';
          var dateHtml = date ? ' <span style="color:#999;font-size:12px;font-weight:normal;margin-left:8px;">' + escapeHtml(date) + '</span>' : '';
          html += '<div class="about-ver">v' + ver + dateHtml + '</div><ul>';
          if (items && items.length) {
            for (var ii = 0; ii < items.length; ii++) {
              html += '<li>' + escapeHtml(items[ii]) + '</li>';
            }
          }
          html += '</ul>';
        }
        clEl.innerHTML = html;
      } else if (clEl) {
        clEl.innerHTML = '<p style="color:#999;">暂无更新日志</p>';
      }
    } catch(e) {
      var clEl2 = document.getElementById('about-changelog');
      if (clEl2) clEl2.innerHTML = '<p style="color:red;">加载失败: ' + escapeHtml(e.message) + '</p>';
    }
  },

  async updatePasswordStatus() {
    const config = await window.electronAPI.getConfig();
    const box = document.getElementById('password-status-box');
    const icon = document.getElementById('toggle-pwd-icon');
    const title = document.getElementById('toggle-pwd-title');
    const desc = document.getElementById('toggle-pwd-desc');
    const fields = document.getElementById('disable-pwd-fields');
    const enableBtn = document.getElementById('enable-pwd-btn');
    const input = document.getElementById('disable-password-input');
    const label = fields && fields.querySelector('label');
    const closeBtn = fields && fields.querySelector('.btn-danger');
    const enabled = config.passwordEnabled === true && config.passwordSet === true;
    if (box) {
      box.textContent = enabled ? '当前状态：密码保护已开启' : (config.passwordSet ? '当前状态：密码保护已关闭' : '当前状态：尚未设置启动密码');
      box.className = 'password-status-box ' + (enabled ? 'status-on' : 'status-off');
    }
    if (icon) icon.textContent = enabled ? '🔓' : '🔒';
    if (title) title.textContent = '密码保护';
    if (desc) {
      desc.textContent = enabled ? '关闭后，启动软件时将不再验证密码'
        : (config.passwordSet ? '点击下方按钮开启启动密码保护' : '请先在「修改密码」中设置 4-6 位数字密码');
    }
    if (fields) fields.style.display = 'block';
    if (enableBtn) enableBtn.style.display = enabled ? 'none' : 'block';
    if (input) input.style.display = enabled ? 'block' : 'none';
    if (label) label.style.display = enabled ? 'block' : 'none';
    if (closeBtn) closeBtn.style.display = enabled ? 'block' : 'none';
  },

  async enablePassword() {
    const cfg = await window.electronAPI.getConfig();
    if (!cfg.passwordSet) {
      alert('请先设置启动密码：在「修改密码」中设置 4-6 位数字密码，再开启密码保护。');
      this.showChangePasswordForm();
      return;
    }
    const result = await window.electronAPI.togglePassword({ action: 'enable' });
    if (result.success) {
      await this.updatePasswordStatus();
      alert('密码保护已开启，下次启动需要输入密码');
      this.backToSettings();
    } else {
      alert(result.error || '开启失败');
    }
  },

  showChangePasswordForm() {
    if (this.passwordLocked) { alert('密码已被创作者锁定，无法修改密码。'); return; }
    document.getElementById('settings-menu').classList.add('hidden');
    document.getElementById('change-password-form').classList.remove('hidden');
    document.getElementById('disable-password-form').classList.add('hidden');
    document.getElementById('uninstall-password-form').classList.add('hidden');
    document.getElementById('sound-settings-form').classList.add('hidden');
    document.getElementById('about-software').classList.add('hidden');
  },

  showTogglePasswordForm() {
    if (this.passwordLocked) { alert('密码保护已被创作者锁定，无法关闭。'); return; }
    this.updatePasswordStatus();
    document.getElementById('settings-menu').classList.add('hidden');
    document.getElementById('disable-password-form').classList.remove('hidden');
    document.getElementById('change-password-form').classList.add('hidden');
    document.getElementById('sound-settings-form').classList.add('hidden');
    document.getElementById('about-software').classList.add('hidden');
  },

  showSoundSettings() {
    document.getElementById('settings-menu').classList.add('hidden');
    document.getElementById('sound-settings-form').classList.remove('hidden');
    document.getElementById('change-password-form').classList.add('hidden');
    document.getElementById('disable-password-form').classList.add('hidden');
    document.getElementById('about-software').classList.add('hidden');
    // 加载当前音效设置
    document.getElementById('sound-enabled').checked = this.soundEnabled;
    document.getElementById('sound-volume').value = this.soundVolume;
    document.getElementById('sound-vol-label').textContent = this.soundVolume;
  },

  onVolumeChange(val) {
    document.getElementById('sound-vol-label').textContent = val;
  },

  testSound() {
    const enabled = document.getElementById('sound-enabled').checked;
    const vol = parseInt(document.getElementById('sound-volume').value, 10);
    const oldEnabled = this.soundEnabled;
    const oldVol = this.soundVolume;
    this.soundEnabled = enabled;
    this.soundVolume = vol;
    this.playClickSound();
    this.soundEnabled = oldEnabled;
    this.soundVolume = oldVol;
  },

  async saveSoundSettings() {
    try {
      this.soundEnabled = document.getElementById('sound-enabled').checked;
      this.soundVolume = parseInt(document.getElementById('sound-volume').value, 10);
      await window.electronAPI.updateSettingsConfig({ soundEnabled: this.soundEnabled, soundVolume: this.soundVolume });
      await window.electronAPI.confirmBox({ title: '保存成功', message: '音效设置已保存', buttons: ['确定'] });
      this.backToSettings();
    } catch (e) {
      alert('保存失败：' + (e && e.message ? e.message : e));
    }
  },
  // ===== 语言设置 =====
  showLanguageSettings() {
    document.getElementById('settings-menu').classList.add('hidden');
    document.getElementById('language-settings-form').classList.remove('hidden');
    document.getElementById('change-password-form').classList.add('hidden');
    document.getElementById('disable-password-form').classList.add('hidden');
    document.getElementById('uninstall-password-form').classList.add('hidden');
    document.getElementById('sound-settings-form').classList.add('hidden');
    document.getElementById('font-settings-form').classList.add('hidden');
    document.getElementById('bgm-settings-form').classList.add('hidden');
    document.getElementById('about-software').classList.add('hidden');
    this.selectedLang = this.language;
    document.getElementById('lang-check-zh').style.visibility = this.language === 'zh' ? 'visible' : 'hidden';
    document.getElementById('lang-check-en').style.visibility = this.language === 'en' ? 'visible' : 'hidden';
  },

  selectLanguage(lang) {
    this.selectedLang = lang;
    document.getElementById('lang-check-zh').style.visibility = lang === 'zh' ? 'visible' : 'hidden';
    document.getElementById('lang-check-en').style.visibility = lang === 'en' ? 'visible' : 'hidden';
  },

  async saveLanguage() {
    try {
      this.language = this.selectedLang;
      await window.electronAPI.updateSettingsConfig({ language: this.language });
      this.applyLanguage();
      await window.electronAPI.confirmBox({ title: '保存成功', message: this.language === 'zh' ? '语言已切换为中文' : 'Language switched to English', buttons: ['OK'] });
      this.backToSettings();
    } catch (e) {
      alert('保存失败：' + (e && e.message ? e.message : e));
    }
  },

  // ===== 字体设置 =====
  showFontSettings() {
    document.getElementById('settings-menu').classList.add('hidden');
    document.getElementById('font-settings-form').classList.remove('hidden');
    document.getElementById('change-password-form').classList.add('hidden');
    document.getElementById('disable-password-form').classList.add('hidden');
    document.getElementById('uninstall-password-form').classList.add('hidden');
    document.getElementById('sound-settings-form').classList.add('hidden');
    document.getElementById('language-settings-form').classList.add('hidden');
    document.getElementById('bgm-settings-form').classList.add('hidden');
    document.getElementById('about-software').classList.add('hidden');
    const sel = document.getElementById('font-select');
    sel.innerHTML = '';
    this.fontList.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f; opt.textContent = f;
      if (f === this.fontFamily) opt.selected = true;
      sel.appendChild(opt);
    });
    this.selectedFont = this.fontFamily;
    document.getElementById('font-preview').style.fontFamily = '"' + this.fontFamily + '", sans-serif';
    sel.onchange = () => {
      this.selectedFont = sel.value;
      document.getElementById('font-preview').style.fontFamily = '"' + sel.value + '", sans-serif';
    };
  },

  async saveFont() {
    try {
      this.fontFamily = this.selectedFont;
      await window.electronAPI.updateSettingsConfig({ fontFamily: this.fontFamily });
      this.applyFont();
      await window.electronAPI.confirmBox({ title: '保存成功', message: '字体已更新', buttons: ['确定'] });
      this.backToSettings();
    } catch (e) {
      alert('保存失败：' + (e && e.message ? e.message : e));
    }
  },

  // ===== 背景音乐 =====
  startBgm() {
    try {
      if (!this.bgmAudio) {
        this.bgmAudio = new Audio();
        // 生成循环背景音乐（Web Audio 合成简单旋律）
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const sampleRate = ctx.sampleRate;
        const duration = 4;
        const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const data = buffer.getChannelData(ch);
          for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            const freq = 220 * Math.pow(2, Math.floor(t * 2) / 12);
            data[i] = Math.sin(2 * Math.PI * freq * t) * 0.15 * (1 - (t % 2) / 2);
          }
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer; src.loop = true;
        const dest = ctx.createMediaStreamDestination();
        src.connect(dest); src.start();
        this.bgmAudio.srcObject = dest.stream;
        this.bgmAudio.loop = true;
      }
      this.bgmAudio.volume = this.bgmVolume / 100;
      this.bgmAudio.play().catch(() => {});
    } catch(e) {}
  },

  stopBgm() {
    if (this.bgmAudio) { this.bgmAudio.pause(); }
  },

  showBgmSettings() {
    document.getElementById('settings-menu').classList.add('hidden');
    document.getElementById('bgm-settings-form').classList.remove('hidden');
    document.getElementById('change-password-form').classList.add('hidden');
    document.getElementById('disable-password-form').classList.add('hidden');
    document.getElementById('uninstall-password-form').classList.add('hidden');
    document.getElementById('sound-settings-form').classList.add('hidden');
    document.getElementById('language-settings-form').classList.add('hidden');
    document.getElementById('font-settings-form').classList.add('hidden');
    document.getElementById('about-software').classList.add('hidden');
    document.getElementById('bgm-enabled').checked = this.bgmEnabled;
    document.getElementById('bgm-volume').value = this.bgmVolume;
    document.getElementById('bgm-vol-label').textContent = this.bgmVolume;
  },

  onBgmVolumeChange(val) {
    document.getElementById('bgm-vol-label').textContent = val;
    if (this.bgmAudio) this.bgmAudio.volume = val / 100;
  },

  testBgm() {
    const old = this.bgmVolume;
    this.bgmVolume = parseInt(document.getElementById('bgm-volume').value, 10);
    this.startBgm();
    setTimeout(() => { this.stopBgm(); this.bgmVolume = old; }, 3000);
  },

  async saveBgmSettings() {
    try {
      this.bgmEnabled = document.getElementById('bgm-enabled').checked;
      this.bgmVolume = parseInt(document.getElementById('bgm-volume').value, 10);
      await window.electronAPI.updateSettingsConfig({ bgmEnabled: this.bgmEnabled, bgmVolume: this.bgmVolume });
      if (this.bgmEnabled) this.startBgm(); else this.stopBgm();
      await window.electronAPI.confirmBox({ title: '保存成功', message: '背景音乐设置已保存', buttons: ['确定'] });
      this.backToSettings();
    } catch (e) {
      alert('保存失败：' + (e && e.message ? e.message : e));
    }
  },

  async submitChangePassword() {
    var oldInput = document.getElementById('old-password');
    var newInput = document.getElementById('new-password');
    var confirmInput = document.getElementById('confirm-password');
    [oldInput, newInput, confirmInput].forEach(function(i) { i.disabled = false; i.readOnly = false; });
    var oldPwd = oldInput.value.trim();
    var newPwd = newInput.value.trim();
    var confirmPwd = confirmInput.value.trim();

    if (!oldPwd) {
      const cfg = await window.electronAPI.getConfig();
      if (cfg.passwordSet) { alert('请输入旧密码'); oldInput.focus(); return; }
    }
    if (!/^\d{4,6}$/.test(newPwd)) { alert('新密码必须是 4-6 位纯数字'); newInput.focus(); return; }
    if (newPwd !== confirmPwd) { alert('两次输入的新密码不一致'); confirmInput.focus(); return; }

    try {
      var result = await window.electronAPI.changePassword({ oldPassword: oldPwd, newPassword: newPwd });
      if (result && result.success) {
        var wasEnabled = false;
        try {
          var cfg = await window.electronAPI.getConfig();
          wasEnabled = cfg.passwordEnabled === true && cfg.passwordSet === true;
        } catch (e) { /* ignore */ }
        alert('密码修改成功！');
        oldInput.value = ''; newInput.value = ''; confirmInput.value = '';
        document.getElementById('change-password-form').classList.add('hidden');
        if (!wasEnabled) {
          var choice = await window.electronAPI.confirmBox({
            title: '密码已保存',
            message: '是否立即开启密码保护？开启后每次启动软件都需要输入密码。',
            buttons: ['立即开启', '暂不开启'],
            cancelId: 1
          });
          if (choice === 0) await window.electronAPI.togglePassword({ action: 'enable' });
          await this.updatePasswordStatus();
          this.backToSettings();
        }
      } else {
        alert((result && result.error) || '修改失败');
        oldInput.value = '';
        oldInput.disabled = false;
        oldInput.focus();
      }
    } catch (e) {
      alert('修改出错：' + (e && e.message ? e.message : e));
      oldInput.disabled = false;
      oldInput.focus();
    }
  },

  async submitDisablePassword() {
    var pwdInput = document.getElementById('disable-password-input');
    pwdInput.disabled = false; pwdInput.readOnly = false;
    var pwd = pwdInput.value.trim();
    if (!pwd) { alert('请输入当前密码'); pwdInput.focus(); return; }
    try {
      var result = await window.electronAPI.togglePassword({ action: 'disable', password: pwd });
      if (result && result.success) {
        alert('密码保护已关闭');
        pwdInput.value = '';
        await this.updatePasswordStatus();
        this.backToSettings();
      } else {
        alert((result && result.error) || '操作失败');
        pwdInput.value = '';
        pwdInput.disabled = false;
        pwdInput.focus();
      }
    } catch (e) {
      alert('操作出错：' + (e && e.message ? e.message : e));
      pwdInput.disabled = false;
      pwdInput.focus();
    }
  },

  async updateUninstallPasswordStatus() {
    const config = await window.electronAPI.getConfig();
    const box = document.getElementById('uninstall-pwd-status-box');
    const desc = document.getElementById('uninstall-pwd-desc');
    if (config.uninstallPasswordEnabled) {
      box.textContent = '当前状态：卸载密码已开启';
      box.className = 'password-status-box status-on';
      if (desc) desc.textContent = '开启后，卸载软件时需要输入密码验证';
    } else {
      box.textContent = '当前状态：卸载密码已关闭';
      box.className = 'password-status-box status-off';
      if (desc) desc.textContent = '卸载软件时无需输入密码';
    }
  },

  showToggleUninstallPasswordForm() {
    this.updateUninstallPasswordStatus();
    document.getElementById('settings-menu').classList.add('hidden');
    document.getElementById('uninstall-password-form').classList.remove('hidden');
    document.getElementById('change-password-form').classList.add('hidden');
    document.getElementById('disable-password-form').classList.add('hidden');
    document.getElementById('sound-settings-form').classList.add('hidden');
    document.getElementById('about-software').classList.add('hidden');
  },

  async submitDisableUninstallPassword() {
    var pwdInput = document.getElementById('uninstall-password-input');
    pwdInput.disabled = false; pwdInput.readOnly = false;
    var pwd = pwdInput.value.trim();
    if (!pwd) { alert('请输入当前密码'); pwdInput.focus(); return; }
    try {
      var result = await window.electronAPI.toggleUninstallPassword({ action: 'disable', password: pwd });
      if (result && result.success) {
        alert('卸载密码已关闭');
        pwdInput.value = '';
        this.updateUninstallPasswordStatus();
      } else {
        alert((result && result.error) || '操作失败');
        pwdInput.value = '';
        pwdInput.disabled = false;
        pwdInput.focus();
      }
    } catch (e) {
      alert('操作出错：' + (e && e.message ? e.message : e));
      pwdInput.disabled = false;
      pwdInput.focus();
    }
  },

  async enableUninstallPassword() {
    const result = await window.electronAPI.toggleUninstallPassword({ action: 'enable' });
    if (result.success) {
      this.updateUninstallPasswordStatus();
    }
  },

  showSection(id) {
    if (this.isLocked && id !== 'password-lock') return;
    if (!this._navBack && this.currentSection && this.currentSection !== id) {
      this.pageHistory.push(this.currentSection);
      if (this.pageHistory.length > 20) this.pageHistory.shift();
    }
    this._navBack = false;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    this.currentSection = id;

    // 使用向导悬浮按钮仅在开始界面（主菜单）显示
    const guideFab = document.getElementById('guide-fab');
    if (guideFab) guideFab.classList.toggle('show', id === 'main-menu');

    const backBtn = document.getElementById('back-btn');
    const title = document.getElementById('header-title');
    if (id === 'main-menu') {
      this.pageHistory = [];
      backBtn.classList.add('hidden');
      title.textContent = '首页';
    } else {
      backBtn.classList.remove('hidden');
      backBtn.onclick = () => this.goBack();
      if (id === 'new-table') title.textContent = '新建表格';
      if (id === 'editor') title.textContent = this.editingTable ? this.editingTable.name : '编辑表格';
      if (id === 'score-editor') title.textContent = this.scoreTable ? this.scoreTable.name : '成绩排名表';
      if (id === 'manage') title.textContent = this.manageFilter === 'score' ? '成绩排名' : (this.manageFilter === 'seat' ? '座位表' : '班级量化表');
      if (id === 'password-manage') title.textContent = '设置';
      if (id === 'password-lock') { backBtn.classList.add('hidden'); title.textContent = '密码验证'; }
      if (id === 'backup-manage') title.textContent = '数据与备份';
      if (id === 'cloud-sync') title.textContent = '数据云同步';
      if (id === 'excel-import') title.textContent = '导入 Excel';
      if (id === 'seat-page') title.textContent = '排座位';
      if (id === 'rank-system') { title.textContent = '班级段位（测试版）'; this.showRankBetaNotice(); }
      if (id === 'roster-page') title.textContent = '学生名单';
      if (id === 'duty-page') title.textContent = '值日表';
      if (id === 'homework-page') title.textContent = '作业登记';
    }
    this.updateNav(id);
    this.applyLanguage();
  },

  // 侧边导航高亮
  updateNav(sectionId) {
    var pageMap = {
      'main-menu': 'home',
      'manage': 'manage',
      'seat-page': 'seat',
      'rank-system': 'grade',
      'backup-manage': 'backup',
      'password-manage': 'settings',
      'cloud-sync': 'backup',
      'excel-import': 'manage',
      'new-table': 'manage',
      'editor': 'manage',
      'score-editor': 'manage',
      'roster-page': 'roster',
      'duty-page': 'duty',
      'homework-page': 'homework',
      'password-lock': ''
    };
    var page = pageMap[sectionId] || '';
    if (sectionId === 'manage') page = (this.manageFilter === 'score') ? 'score' : 'manage';
    document.querySelectorAll('.nav-item').forEach(function (item) {
      item.classList.toggle('active', item.dataset.page === page);
    });
  },

  // 侧边导航：直接打开某一类表格列表
  navManage(filter) {
    this.manageFilter = filter || 'ranking';
    this.showManageTables();
  },

  goBack() {
    if (this.pageHistory.length > 0) {
      const prev = this.pageHistory.pop();
      this._navBack = true;
      this.showSection(prev);
    } else {
      this.showMainMenu();
    }
  },

  async showMainMenu() {
    const tables = await window.electronAPI.loadTables();
    const countEl = document.getElementById('table-count');
    if (countEl) countEl.textContent = tables.length;
    this.showSection('main-menu');
    this.loadHomeData(tables);
  },

  // ===== 首页数据填充（仅新增，不影响原有业务） =====
  parseTableDate(v) {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  },

  formatHomeDate(d) {
    if (!d) return '';
    const p = n => (n < 10 ? '0' + n : '' + n);
    return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  },

  formatHomeNumber(n) {
    return Number(n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  },

  escapeHomeText(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  async loadHomeData(tables) {
    try {
      if (!tables) tables = await window.electronAPI.loadTables();
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      const total = tables.length;
      set('table-count', total);
      set('home-status-tables', total);

      const now = new Date();
      const monthNew = tables.filter(t => {
        const d = this.parseTableDate(t.created_at);
        return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }).length;
      set('home-new-month', monthNew);

      const sorted = tables.slice().sort((a, b) => {
        const da = this.parseTableDate(a.created_at);
        const db = this.parseTableDate(b.created_at);
        return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
      });
      this.renderHomeRecent(sorted.slice(0, 4));

      const rankings = sorted.filter(t => (t.type || 'ranking') === 'ranking');
      const ranking = rankings[0] || null;
      // 本周之星 / 总积分优先取最近一张「有积分数据」的量化表
      const scoredRanking = rankings.find(t => (t.rows || []).some(r => r && Number(r.total_score))) || ranking;
      const people = ranking
        ? (Number(ranking.total_people) || (ranking.rows || []).filter(r => r && r.name).length || 0)
        : 0;
      set('home-student-total', people);
      set('home-status-students', people);

      let groupScores = [];
      let weekScore = 0;
      if (scoredRanking) {
        const map = {};
        (scoredRanking.rows || []).forEach(r => {
          if (!r) return;
          const g = Number(r.group) || 1;
          const score = Number(r.total_score) || 0;
          map[g] = (map[g] || 0) + score;
          weekScore += score;
        });
        groupScores = Object.keys(map).map(k => ({ group: Number(k), score: map[k] }));
      }
      set('home-week-score', this.formatHomeNumber(weekScore));
      if (scoredRanking) {
        const groupCount = groupScores.length || Number(scoredRanking.num_groups) || 0;
        set('home-week-note', groupCount ? '共 ' + groupCount + ' 个小组' : '本周累计得分');
      }

      groupScores.sort((a, b) => b.score - a.score);
      const top = groupScores[0];
      const starBox = document.getElementById('weekly-star');
      if (top && top.score > 0 && scoredRanking) {
        const members = (scoredRanking.rows || []).filter(r => r && Number(r.group) === top.group);
        const named = members.filter(r => r && r.name);
        set('home-star-group', '第 ' + top.group + ' 组');
        set('home-star-score', this.formatHomeNumber(top.score));
        if (starBox) {
          starBox.innerHTML =
            '<div class="star-main">' +
              '<div class="star-badge">' + top.group + '</div>' +
              '<div class="star-info">' +
                '<div class="star-name">第 ' + top.group + ' 组</div>' +
                '<div class="star-meta">' +
                  (named.length ? '组长：' + this.escapeHomeText(named[0].name) + ' · ' : '') +
                  members.length + ' 人' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="star-score"><span>' + this.formatHomeNumber(top.score) + '</span><small>总分</small></div>';
        }
      } else {
        set('home-star-group', '暂无');
        set('home-star-score', '0');
        if (starBox) starBox.innerHTML = '<div class="recent-empty">暂无积分数据</div>';
      }

      let backups = [];
      try { backups = await window.electronAPI.listAutoBackups(); } catch (e) { backups = []; }
      set('home-backup-count', backups.length);
      const backupSub = document.getElementById('home-backup-sub');
      if (backupSub) {
        backupSub.textContent = backups.length && backups[0].time
          ? '最近备份：' + String(backups[0].time).slice(0, 16)
          : '暂无自动备份';
      }
      const backupPill = document.getElementById('home-backup-pill');
      if (backupPill) {
        backupPill.textContent = backups.length ? '正常' : '待生成';
        backupPill.className = backups.length ? 'pill pill-ok' : 'pill';
      }

      let sync = null;
      try { sync = await window.electronAPI.syncGetStatus(); } catch (e) { sync = null; }
      const syncSub = document.getElementById('home-sync-sub');
      const syncPill = document.getElementById('home-sync-pill');
      const hasSync = !!(sync && sync.hasPassword);
      if (syncSub) syncSub.textContent = hasSync ? '已配置同步密码' : '未设置同步密码';
      if (syncPill) {
        syncPill.textContent = hasSync ? '已配置' : '未配置';
        syncPill.className = hasSync ? 'pill pill-ok' : 'pill';
      }

      let ver = this._appVersion || '';
      if (ver) {
        set('home-version', 'v' + ver + ' · 已是最新');
        set('home-status-version', 'v' + ver);
        const vi = document.querySelector('.version-info');
        if (vi) vi.textContent = 'v' + ver;
      }
      this.renderHomeDashboard(tables);
    } catch (e) {
      console.warn('首页数据加载失败', e);
    }
  },

  renderHomeRecent(list) {
    const box = document.getElementById('home-recent');
    if (!box) return;
    if (!list.length) {
      box.innerHTML = '<div class="recent-empty">暂无表格，点击右上角「新建表格」开始</div>';
      return;
    }
    const typeLabel = { ranking: '量化表', score: '成绩表', seat: '座位表' };
    const icons = {
      ranking: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/></svg>',
      score: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
      seat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="12" rx="2"/><path d="M7 15v6M17 15v6M4 18h16"/></svg>'
    };
    box.innerHTML = list.map(t => {
      const type = t.type || 'ranking';
      const d = this.parseTableDate(t.created_at);
      const rows = t.rows || [];
      const people = Number(t.total_people) || rows.filter(r => r && r.name).length || 0;
      const parts = [];
      if (type === 'ranking' && Number(t.num_groups)) parts.push(Number(t.num_groups) + ' 个小组');
      if (people) parts.push(people + ' 人');
      if (d) parts.push(this.formatHomeDate(d) + ' 更新');
      return '<div class="recent-item" onclick="app.homeOpenTable(\'' + String(t.id).replace(/'/g, '') + '\')">' +
        '<div class="recent-ico type-' + type + '">' + (icons[type] || icons.ranking) + '</div>' +
        '<div class="recent-body">' +
          '<div class="recent-name">' + this.escapeHomeText(t.name || '未命名表格') + '</div>' +
          '<div class="recent-meta">' + this.escapeHomeText(parts.join(' · ') || '—') + '</div>' +
        '</div>' +
        '<span class="recent-tag">' + (typeLabel[type] || '表格') + '</span>' +
        '<span class="recent-action">打开</span>' +
      '</div>';
    }).join('');
  },

  async homeOpenTable(id) {
    try {
      const table = await window.electronAPI.getTable(id);
      if (!table) { alert('未能读取表格数据'); return; }
      if ((table.type || 'ranking') === 'score') await this.showScoreEditor(id);
      else await this.showTableEditor(id);
    } catch (e) {
      alert('打开表格失败：' + e.message);
    }
  },

  async homeExportExcel() {
    try {
      const tables = await window.electronAPI.loadTables();
      if (!tables.length) { alert('暂无表格可导出'); return; }
      const sorted = tables.slice().sort((a, b) => {
        const da = this.parseTableDate(a.created_at);
        const db = this.parseTableDate(b.created_at);
        return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
      });
      const table = await window.electronAPI.getTable(sorted[0].id);
      if (!table) { alert('未能读取表格数据'); return; }
      const result = await window.electronAPI.exportExcel(table);
      if (result && result.success) alert('已导出到：' + result.path);
      else if (result && result.error && result.error !== '已取消') alert('导出失败：' + result.error);
    } catch (e) {
      alert('导出失败：' + e.message);
    }
  },

  showNewTableForm() {
    this.showSection('new-table');
    // 显示班级量化表表单，隐藏类型选择
    var sel = document.getElementById('new-table-type-select');
    var frm = document.getElementById('new-table-form');
    if (sel) sel.style.display = 'none';
    if (frm) frm.style.display = 'block';
  },

  showNewTablePage() {
    this.showSection('new-table');
    // 默认显示类型选择按钮，隐藏表单
    var sel = document.getElementById('new-table-type-select');
    var frm = document.getElementById('new-table-form');
    if (sel) sel.style.display = 'flex';
    if (frm) frm.style.display = 'none';
    var sfrm = document.getElementById('new-score-form');
    if (sfrm) sfrm.style.display = 'none';
  },

  backToTypeSelect() {
    var sel = document.getElementById('new-table-type-select');
    var frm = document.getElementById('new-table-form');
    var sfrm = document.getElementById('new-score-form');
    if (sel) sel.style.display = 'flex';
    if (frm) frm.style.display = 'none';
    if (sfrm) sfrm.style.display = 'none';
  },

  showScoreTableForm() {
    this.showSection('new-table');
    var sel = document.getElementById('new-table-type-select');
    var frm = document.getElementById('new-table-form');
    var sfrm = document.getElementById('new-score-form');
    if (sel) sel.style.display = 'none';
    if (frm) frm.style.display = 'none';
    if (sfrm) sfrm.style.display = 'block';
  },

  async submitNewScoreTable() {
    var nameInput = document.getElementById('new-score-name');
    var peopleInput = document.getElementById('new-score-people');
    var subjInput = document.getElementById('new-score-subjects');
    var name = nameInput.value.trim();
    var people = parseInt(peopleInput.value, 10);
    var subjCount = parseInt(subjInput.value, 10);
    if (!name) { alert('请填写表格名称'); nameInput.focus(); return; }
    if (isNaN(people) || people <= 0) { alert('请输入有效的学生人数（大于 0 的整数）'); peopleInput.focus(); return; }
    if (people > 200) { alert('人数最多 200 人'); peopleInput.focus(); return; }
    if (isNaN(subjCount) || subjCount <= 0) { alert('请输入有效的科目数（1-15）'); subjInput.focus(); return; }
    if (subjCount > 15) { alert('科目数最多 15 个'); subjInput.focus(); return; }

    var presets = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理'];
    var subjects = [];
    for (var i = 0; i < subjCount; i++) subjects.push(presets[i] || ('科目' + (i + 1)));
    var scoreRows = [];
    for (var j = 0; j < people; j++) {
      scoreRows.push({
        uid: 'r' + Date.now().toString(36) + '_' + j + '_' + Math.random().toString(36).slice(2, 7),
        name: '',
        scores: new Array(subjCount).fill('')
      });
    }
    var table = {
      id: 'score-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10),
      type: 'score',
      name: name,
      created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
      total_people: people,
      num_groups: 0,
      members_per_group: 0,
      num_subjects: subjCount,
      subjects: subjects,
      score_rows: scoreRows
    };
    try {
      table = await window.electronAPI.addTable(table);
      this.scoreTable = table;
      this.renderScoreEditor();
      this.showSection('score-editor');
      requestAnimationFrame(function () {
        var first = document.querySelector('#score-editor-body input[data-field="name"]');
        if (first) first.focus();
      });
    } catch (e) {
      alert('创建成绩表出错：' + (e && e.message ? e.message : e));
    }
  },

  async submitNewTable() {
    var nameInput = document.getElementById('new-name');
    var peopleInput = document.getElementById('new-people');
    var membersInput = document.getElementById('new-members');
    [nameInput, peopleInput, membersInput].forEach(function(i) { if (i) { i.disabled = false; i.readOnly = false; } });
    var name = nameInput.value.trim();
    var total = parseInt(peopleInput.value, 10);
    var members = parseInt(membersInput.value, 10);
    var useLastNames = document.getElementById('use-last-names').checked;

    if (!name) { alert('请填写表格名称'); nameInput.focus(); return; }
    if (isNaN(total) || isNaN(members) || total <= 0 || members <= 0) {
      alert('请输入有效的大于 0 的数字');
      (isNaN(total) || total <= 0 ? peopleInput : membersInput).focus();
      return;
    }
    var groups = Math.ceil(total / members);
    var lastGroupSize = total - (groups - 1) * members;
    var hint = lastGroupSize === members
      ? '将分为 ' + groups + ' 个小组，每组 ' + members + ' 人。'
      : '将分为 ' + groups + ' 个小组，前 ' + (groups - 1) + ' 组每组 ' + members + ' 人，最后一组 ' + lastGroupSize + ' 人。';
    var suffix = useLastNames ? '\n\n将使用上一张表格的姓名自动填充。' : '';
    try {
      var result = await window.electronAPI.confirmBox({
        title: '请确认',
        message: hint + suffix + '\n\n是否继续？',
        buttons: ['开始制表', '取消']
      });
      if (result !== 0) { return; }

      var table = await window.electronAPI.createTable({
        name: name,
        totalPeople: total,
        membersPerGroup: members,
        useLastNames: useLastNames
      });
      window.focus();
      this.editingTable = table;
      this.isEditing = true;
      this.renderEditor();
      this.showSection('editor');
      requestAnimationFrame(function() {
        var first = document.querySelector('#editor-body input:not(:disabled)');
        if (first) first.focus();
      });
    } catch (e) {
      alert('创建表格出错：' + (e && e.message ? e.message : e));
      nameInput.disabled = false;
      nameInput.focus();
    }
  },

  async showTableEditor(id) {
    this.editingTable = await window.electronAPI.getTable(id);
    if (!this.editingTable) { alert('表格不存在'); return; }
    window.focus();
    this.isEditing = true;
    this.renderEditor();
    this.showSection('editor');
    requestAnimationFrame(() => {
      const first = document.querySelector('#editor-body input:not(:disabled)');
      if (first) first.focus();
    });
  },

  makeInput(value, type, disabled, attrs = {}) {
    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.value = value;
    input.dataset.type = type;
    Object.entries(attrs).forEach(([k, v]) => { input.dataset[k] = v; });
    input.disabled = disabled;
    if (type !== 'name' && type !== 'total-score') {
      input.className = type === 'group-rank' ? 'group-rank' : (type === 'personal-rank' ? 'personal-rank' : 'cell-input');
    }
    // 点击单元格任意位置聚焦输入框
    input.parentElement && input.parentElement.addEventListener('click', () => {
      if (!input.disabled) { input.focus(); }
    });
    return input;
  },

  renderEditor() {
    const table = this.editingTable;
    const head = document.getElementById('editor-head');
    const body = document.getElementById('editor-body');
    const nameInput = document.getElementById('editor-table-name');
    if (nameInput) nameInput.value = table.name || '未命名表格';
    head.innerHTML = '';
    body.innerHTML = '';
    if (table.type === 'seat') { this.closeQuickScore(); this.renderSeatTableEditor(table); return; }
    this.setSeatActionsVisibility(false);
    // 单元格内容变化（失焦/回车）后即时重算总分与排名
    body.onchange = (e) => this.onEditorCellChange(e);

    const headers = ['第几小组', '小组排名', '小组总分', '学生姓名', '个人排名', '总分', ...WEEK_LABELS];
    headers.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      head.appendChild(th);
    });

    // 统计每个小组的实际行数（最后一组可能不足 members_per_group）
    const groupSizes = {};
    table.rows.forEach(r => { groupSizes[r.group] = (groupSizes[r.group] || 0) + 1; });
    const groupStartRow = {};
    let seenGroups = new Set();
    table.rows.forEach((r, idx) => {
      if (!seenGroups.has(r.group)) { groupStartRow[r.group] = idx; seenGroups.add(r.group); }
    });

    for (let rowIdx = 0; rowIdx < table.rows.length; rowIdx++) {
      const row = table.rows[rowIdx];
      const tr = document.createElement('tr');
      const isGroupFirstRow = groupStartRow[row.group] === rowIdx;

      // 小组列（合并）
      if (isGroupFirstRow) {
        const groupSize = groupSizes[row.group];
        const groupTd = document.createElement('td');
        groupTd.className = 'group-cell';
        groupTd.textContent = `第${row.group}组`;
        groupTd.rowSpan = groupSize;
        tr.appendChild(groupTd);

        // 小组排名（合并）
        const grTd = document.createElement('td');
        grTd.className = 'group-cell';
        grTd.rowSpan = groupSize;
        grTd.appendChild(this.makeInput(table.group_ranks[String(row.group)] || '', 'group-rank', !this.isEditing, { group: row.group }));
        tr.appendChild(grTd);

        // 小组总分（合并，只读）
        const gsTd = document.createElement('td');
        gsTd.className = 'group-cell';
        gsTd.rowSpan = groupSize;
        gsTd.dataset.groupTotal = String(row.group);
        const groupScore = table.group_scores ? (table.group_scores[String(row.group)] || 0) : 0;
        gsTd.textContent = groupScore;
        tr.appendChild(gsTd);
      }

      // 姓名
      const nameTd = document.createElement('td');
      nameTd.appendChild(this.makeInput(row.name, 'name', !this.isEditing, { row: rowIdx }));
      tr.appendChild(nameTd);

      // 个人排名
      const prTd = document.createElement('td');
      prTd.appendChild(this.makeInput(row.personal_rank || '', 'personal-rank', !this.isEditing, { row: rowIdx }));
      tr.appendChild(prTd);

      // 总分（只读）
      const scoreTd = document.createElement('td');
      const scoreInput = this.makeInput(row.total_score !== undefined ? row.total_score : 0, 'total-score', true, { row: rowIdx });
      scoreTd.appendChild(scoreInput);
      tr.appendChild(scoreTd);

      // 排名单元格（天数由 WEEK_LABELS 决定）
      for (let d = 0; d < WEEK_LABELS.length; d++) {
        const td = document.createElement('td');
        td.appendChild(this.makeInput(row.cells[d] || '', 'cell', !this.isEditing, { row: rowIdx, day: d }));
        tr.appendChild(td);
      }

      body.appendChild(tr);
    }

    const status = document.getElementById('editor-status');
    const btn = document.getElementById('edit-btn');
    if (this.isEditing) {
      status.textContent = '编辑模式：可直接修改表格内容，点击「保存编辑」保存';
      status.style.color = '#2c5f8d';
      btn.textContent = '保存编辑';
      btn.className = 'btn btn-success';
    } else {
      status.textContent = '查看模式（点击「编辑」可修改内容）';
      status.style.color = '#7f8c8d';
      btn.textContent = '编辑';
      btn.className = 'btn btn-primary';
    }
    var ed1 = document.getElementById('editor');
    if (ed1) {
      if (this.tablesLocked && !this.creatorMode) {
        ed1.querySelectorAll('input,textarea').forEach(function(el){ el.readOnly = true; el.style.background = '#f5f5f5'; });
        var lockTip = document.getElementById('lock-tip');
        if (!lockTip) {
          lockTip = document.createElement('div');
          lockTip.id = 'lock-tip';
          lockTip.style.cssText = 'background:#fff3cd;color:#856404;padding:8px 12px;border-radius:6px;margin:8px 0;text-align:center;font-size:13px;';
          lockTip.textContent = '🔒 表格已被创作者锁定，无法修改（需进入创作者模式解锁）';
          ed1.insertBefore(lockTip, ed1.firstChild);
        }
      } else {
        // 未锁定时确保输入框可编辑
        ed1.querySelectorAll('input,textarea').forEach(function(el){ el.readOnly = false; el.style.background = ''; });
        var oldTip = document.getElementById('lock-tip');
        if (oldTip) oldTip.remove();
      }
    }
    this.applyLanguage();
    this.updateUndoButton();
    var qsPanel = document.getElementById('quick-score-panel');
    if (qsPanel && !qsPanel.classList.contains('hidden')) this.renderQuickScore();
  },

  // 座位表编辑器模式下隐藏与积分无关的操作按钮
  setSeatActionsVisibility(seatMode) {
    const actions = document.querySelectorAll('#editor .editor-actions .btn, #editor .editor-actions button');
    actions.forEach(btn => {
      const oc = btn.getAttribute('onclick') || '';
      if (/autoCalculate|showRankingSummary|batchScoreDialog|openQuickScore|undoLastScore|scoreTemplatesDialog|showTrendChart|showGroupChart|clearScores|addRow|removeRow/.test(oc)) {
        if (seatMode) {
          btn.style.setProperty('display', 'none', 'important');
        } else {
          btn.style.removeProperty('display');
        }
      }
    });
  },

  // 座位表编辑器：按座位图网格布局渲染（行列 + 中间走道），区别于排名表格式
  renderSeatTableEditor(table) {
    const body = document.getElementById('editor-body');
    this.setSeatActionsVisibility(true);
    // 兼容旧数据：若 seat_layout 缺失或无效，则从行数据重建布局
    let layout = table.seat_layout;
    const allRows = table.rows || [];
    if (!layout || !layout.rows || !layout.totalCols) {
      let maxR = 0, maxC = 0;
      const seatColSet = {};
      const hasCoord = allRows.some(rr => rr.seat_row !== undefined);
      if (hasCoord) {
        allRows.forEach(rr => {
          if (rr.seat_row !== undefined) maxR = Math.max(maxR, rr.seat_row);
          if (rr.seat_col !== undefined) { maxC = Math.max(maxC, rr.seat_col); seatColSet[rr.seat_col] = true; }
        });
      } else {
        // 旧格式：group 即排号(r+1)，按每组人数推断列布局
        const groupSizes = {};
        allRows.forEach(rr => {
          const g = parseInt(rr.group, 10) || 1;
          maxR = Math.max(maxR, g - 1);
          groupSizes[g] = (groupSizes[g] || 0) + 1;
        });
        const perRow = Math.max(...Object.values(groupSizes), 1);
        const colsPerGroup = Math.ceil(perRow / 3);
        const groups = 3;
        maxC = groups * colsPerGroup + (groups - 1) - 1;
        for (let c2 = 0; c2 <= maxC; c2++) {
          const isAisle = (c2 + 1) % (colsPerGroup + 1) === 0;
          if (!isAisle) seatColSet[c2] = true;
        }
      }
      const sc = Object.keys(seatColSet).map(Number).sort((a, b) => a - b);
      const al = [];
      for (let ci = 1; ci < sc.length; ci++) {
        for (let g = sc[ci - 1] + 1; g < sc[ci]; g++) al.push(g);
      }
      layout = { rows: maxR + 1, totalCols: maxC + 1, aisle: al, seatCols: sc };
    }
    const aisleSet = {};
    (layout.aisle || []).forEach(a => { aisleSet[a] = true; });
    // 建立 (排,列) -> 行数据的映射
    const cellMap = {};
    const hasCoord = allRows.some(rr => rr.seat_row !== undefined);
    if (hasCoord) {
      allRows.forEach(r => {
        if (r.seat_row !== undefined && r.seat_col !== undefined) cellMap[r.seat_row + '_' + r.seat_col] = r;
      });
    } else {
      // 旧格式无坐标：按 group 分组后依次填入该排座位列
      const seatCols = layout.seatCols || [];
      const byGroup = {};
      allRows.forEach(r => { byGroup[r.group] = byGroup[r.group] || []; byGroup[r.group].push(r); });
      Object.keys(byGroup).forEach(g => {
        const rowIdx = parseInt(g, 10) - 1;
        byGroup[g].forEach((r, idx) => {
          if (idx < seatCols.length) cellMap[rowIdx + '_' + seatCols[idx]] = r;
        });
      });
    }

    // 表头：讲台提示 + 排号
    const head = document.getElementById('editor-head');
    const capRow = document.createElement('tr');
    const capTh = document.createElement('th');
    capTh.colSpan = Math.max(layout.totalCols, 1);
    capTh.style.cssText = 'font-size:15px;letter-spacing:6px;color:#2c5f8d;';
    capTh.textContent = '—— 讲 台 ——';
    capRow.appendChild(capTh);
    head.appendChild(capRow);

    const n = Math.max((table.rows || []).filter(r => r.name).length, 1);
    const third = Math.ceil(n / 3);
    for (let r = 0; r < layout.rows; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < layout.totalCols; c++) {
        const td = document.createElement('td');
        if (aisleSet[c]) {
          // 走道列
          td.classList.add('seat-aisle');
          td.style.cssText = 'width:28px;background:rgba(200,200,200,.35);border:none;';
          td.innerHTML = '<div style="writing-mode:vertical-lr;font-size:9px;color:#999;text-align:center;line-height:28px;">走&nbsp;道</div>';
        } else {
          const rowData = cellMap[r + '_' + c];
          const input = this.makeInput(rowData ? rowData.name : '', 'seat-name', !this.isEditing, { row: String(r), col: String(c) });
          input.dataset.type = 'seat-name';
          input.dataset.row = String(r);
          input.dataset.col = String(c);
          if (rowData) {
            input.style.background = '#fff';
          } else {
            input.style.background = '#f5f5f5';
            input.placeholder = '';
          }
          input.style.cssText += 'width:76px;text-align:center;border:1px solid #ddd;border-radius:6px;padding:6px 4px;font-size:13px;';
          td.appendChild(input);
        }
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }

    const status = document.getElementById('editor-status');
    const btn = document.getElementById('edit-btn');
    if (this.isEditing) {
      status.textContent = '编辑模式：可直接点击座位修改姓名，点击「保存编辑」保存';
      status.style.color = '#2c5f8d';
      btn.textContent = '保存编辑';
      btn.className = 'btn btn-success';
    } else {
      status.textContent = '座位表查看模式（点击「编辑」可修改姓名）';
      status.style.color = '#7f8c8d';
      btn.textContent = '编辑';
      btn.className = 'btn btn-primary';
    }
    var ed2 = document.getElementById('editor');
    if (ed2) {
      if (this.tablesLocked && !this.creatorMode) {
        ed2.querySelectorAll('input,textarea').forEach(function(el){ el.readOnly = true; el.style.background = '#f5f5f5'; });
        var lockTip2 = document.getElementById('lock-tip');
        if (!lockTip2) {
          lockTip2 = document.createElement('div');
          lockTip2.id = 'lock-tip';
          lockTip2.style.cssText = 'background:#fff3cd;color:#856404;padding:8px 12px;border-radius:6px;margin:8px 0;text-align:center;font-size:13px;';
          lockTip2.textContent = '🔒 表格已被创作者锁定，无法修改（需进入创作者模式解锁）';
          ed2.insertBefore(lockTip2, ed2.firstChild);
        }
      } else {
        ed2.querySelectorAll('input,textarea').forEach(function(el){ el.readOnly = false; el.style.background = ''; });
        var oldTip2 = document.getElementById('lock-tip');
        if (oldTip2) oldTip2.remove();
      }
    }
    this.applyLanguage();
  },

  // ===== 表格名称编辑 =====
  onTableNameChange(name) {
    if (this.editingTable) {
      this.editingTable.name = name;
      const title = document.getElementById('header-title');
      if (title) title.textContent = '📋 ' + name;
      if (this._nameSaveTimer) clearTimeout(this._nameSaveTimer);
      var self = this;
      this._nameSaveTimer = setTimeout(function() {
        window.electronAPI.updateTable(self.editingTable);
      }, 600);
    }
  },

  // ===== 排名总结 =====
  async showRankingSummary() {
    if (!this.editingTable) return;
    // 先把界面上未保存的每日分数收集起来，立即按单元格重算总分与排名，保证总结与界面一致
    this.collectTableData();
    this.recomputeTable(this.editingTable);
    const table = this.editingTable;
    try { await window.electronAPI.updateTable(table); } catch(e) {}
    const skipName = '——';

    // 计算个人得分（跳过姓名为 —— 的空行）
    const personalScores = [];
    table.rows.forEach(r => {
      if (r.name && r.name.trim() !== skipName) {
        const score = r.total_score !== undefined ? r.total_score : 0;
        personalScores.push({ name: r.name, score: score, group: r.group });
      }
    });
    personalScores.sort((a, b) => b.score - a.score);

    // 计算小组得分（以重算后的 group_scores 为准；不含真实学生的小组不参与排名）
    const groupMap = {};
    table.rows.forEach(r => {
      if (!r.name || r.name.trim() === skipName) return;
      const gs = table.group_scores ? (table.group_scores[String(r.group)] || 0) : 0;
      groupMap[r.group] = gs;
    });
    const groupScores = Object.entries(groupMap).map(([g, s]) => ({ group: parseInt(g, 10), score: s }));
    groupScores.sort((a, b) => b.score - a.score);

    if (personalScores.length === 0 || groupScores.length === 0) {
      alert('表格中没有可统计的学生数据');
      return;
    }

    // 个人得分（已按分数降序）与小组得分附加名次（同分同名次；密集排名 1,1,2，并列后下一名次连续）
    const cents = v => Math.round((Number(v) || 0) * 100);
    const attachRanks = (list) => {
      let rk = 0;
      list.forEach((it, i) => {
        if (i === 0 || cents(it.score) !== cents(list[i - 1].score)) rk++;
        it.rank = rk;
      });
    };
    attachRanks(personalScores);
    attachRanks(groupScores);

    // 个人前三：名次<=3，边界同分并列者全部带上
    const top3 = personalScores.filter(p => p.rank <= 3);
    // 个人倒数三：取倒数第3个位置的名次作为界，同分并列者全部带上（展示时最差在前）
    const bottomCut = personalScores[Math.max(0, personalScores.length - 3)].rank;
    const bottom3 = personalScores.filter(p => p.rank >= bottomCut).reverse();
    // 小组前三（含并列）；倒数第一：所有并列末名的小组
    const topGroups = groupScores.filter(g => g.rank <= 3);
    const lastGroupRank = groupScores[groupScores.length - 1].rank;
    const bottomGroups = groupScores.filter(g => g.rank === lastGroupRank);

    const medalFor = rk => rk === 1 ? '🥇' : (rk === 2 ? '🥈' : (rk === 3 ? '🥉' : '🏅'));
    const rankLineStyle = 'font-size:16px;line-height:2;margin:2px 0;';

    let html = '<div style="max-width:700px;margin:20px auto;padding:20px;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.1);">';
    html += '<h2 style="text-align:center;color:#2c5f8d;margin-bottom:20px;">🏆 排名总结</h2>';
    html += '<h3 style="color:#e74c3c;">🥇 小组前三名</h3><div>';
    topGroups.forEach(g => {
      html += '<div style="' + rankLineStyle + '">' + medalFor(g.rank) + ' 第' + g.rank + '名：第' + g.group + '组：' + g.score + '分</div>';
    });
    html += '</div>';
    html += '<h3 style="color:#95a5a6;">📉 小组倒数第一</h3><div>';
    bottomGroups.forEach(g => {
      html += '<div style="' + rankLineStyle + '">第' + g.rank + '名：第' + g.group + '组：' + g.score + '分' + (bottomGroups.length > 1 ? '（并列倒数第一）' : '') + '</div>';
    });
    html += '</div>';
    html += '<h3 style="color:#e74c3c;">🥇 个人前三名</h3><div>';
    top3.forEach(p => {
      html += '<div style="' + rankLineStyle + '">' + medalFor(p.rank) + ' 第' + p.rank + '名：' + escapeHtml(p.name) + '（第' + p.group + '组）：' + p.score + '分</div>';
    });
    html += '</div>';
    html += '<h3 style="color:#95a5a6;">📉 个人倒数三名</h3><div>';
    bottom3.forEach(p => {
      html += '<div style="' + rankLineStyle + '">第' + p.rank + '名：' + escapeHtml(p.name) + '（第' + p.group + '组）：' + p.score + '分</div>';
    });
    html += '</div>';
    html += '<div style="text-align:center;margin-top:20px;"><button class="btn btn-sm" style="background:#4caf50;color:white;" onclick="window.print()">🖨️ 打印</button> <button class="btn btn-sm" style="background:#999;color:white;" onclick="document.getElementById(\'summary-modal\').remove()">关闭</button></div>';
    html += '</div>';
    const oldModal = document.getElementById('summary-modal');
    if (oldModal) oldModal.remove();
    const modal = document.createElement('div');
    modal.id = 'summary-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:9999;overflow:auto;';
    modal.innerHTML = html;
    document.body.appendChild(modal);
    this.renderEditor();
    this.addLog('查看排名总结', '表格：' + table.name);
  },

  // ===== 导出PDF =====
  exportPDF() {
    if (!this.editingTable) return;
    window.print();
    this.addLog('导出PDF', '表格：' + this.editingTable.name);
  },

  // ===== 每周之星 =====
  showWeeklyStar() {
    const all = this.loadAllTables();
    if (all.length === 0) return;
    // 找最新的表格
    const latest = all.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
    if (!latest) return;
    const table = latest;
    const skipName = '——';
    const personalScores = [];
    table.rows.forEach(r => {
      if (r.name && r.name.trim() !== skipName) {
        const score = r.total_score !== undefined ? r.total_score : 0;
        personalScores.push({ name: r.name, score: score });
      }
    });
    personalScores.sort((a, b) => b.score - a.score);
    const groupMap = {};
    table.rows.forEach(r => {
      if (!r.name || r.name.trim() === skipName) return;
      const gs = table.group_scores ? (table.group_scores[String(r.group)] || 0) : 0;
      groupMap[r.group] = gs;
    });
    const groupScores = Object.entries(groupMap).map(([g, s]) => ({ group: parseInt(g), score: s }));
    groupScores.sort((a, b) => b.score - a.score);
    const topPerson = personalScores[0];
    const topGroup = groupScores[0];
    if (topPerson || topGroup) {
      const el = document.getElementById('weekly-star');
      if (el) {
        el.innerHTML = '<div style="text-align:center;padding:8px;background:linear-gradient(135deg,#ffd700,#ff8c00);border-radius:8px;color:#fff;font-weight:bold;">⭐ 本周之星：' + (topGroup ? '第' + topGroup.group + '组' : '') + (topGroup && topPerson ? ' · ' : '') + (topPerson ? escapeHtml(topPerson.name) : '') + '</div>';
      }
    }
  },

  // ===== 风格切换 =====
  themePresets: {
    default:  { name: '默认', bg: 'linear-gradient(135deg,#f7f8fa 0%,#eceff3 100%)', primary: '#0f6cbd', hover: '#115ea3', soft: '#ebf3fc', soft2: '#d7e8fa', bgSolid: '#f3f3f3', surface2: '#fafafa', preview: 'linear-gradient(135deg,#f5f7fa,#e4e9ef)' },
    mist:     { name: '晨雾蓝', bg: 'linear-gradient(135deg,#eef4ff 0%,#dbe7ff 100%)', primary: '#2563eb', hover: '#1e4fd8', soft: '#e9f0ff', soft2: '#d4e2ff', bgSolid: '#eef4ff', surface2: '#f7faff', preview: 'linear-gradient(135deg,#e8f0ff,#c9dcff)' },
    mint:     { name: '薄荷青', bg: 'linear-gradient(135deg,#effaf5 0%,#d5f0e3 100%)', primary: '#0f8a6c', hover: '#0b7157', soft: '#e4f7f0', soft2: '#c9eddd', bgSolid: '#eaf8f2', surface2: '#f5fcf9', preview: 'linear-gradient(135deg,#e5f8ef,#c4ead7)' },
    sunset:   { name: '暖阳橙', bg: 'linear-gradient(135deg,#fff7ed 0%,#ffe6c7 100%)', primary: '#d97706', hover: '#b45c05', soft: '#fff3e2', soft2: '#ffe4c2', bgSolid: '#fff6ea', surface2: '#fffbf4', preview: 'linear-gradient(135deg,#fff1df,#ffddb0)' },
    sakura:   { name: '樱花粉', bg: 'linear-gradient(135deg,#fff1f6 0%,#ffdcea 100%)', primary: '#db2777', hover: '#b81d61', soft: '#ffe9f3', soft2: '#ffd3e6', bgSolid: '#fff1f7', surface2: '#fff7fb', preview: 'linear-gradient(135deg,#ffe8f1,#ffd0e2)' },
    graphite: { name: '墨玉灰', bg: 'linear-gradient(135deg,#f4f6f9 0%,#e0e6ee 100%)', primary: '#475569', hover: '#364152', soft: '#eef1f6', soft2: '#dee5ee', bgSolid: '#f2f5f9', surface2: '#f8fafc', preview: 'linear-gradient(135deg,#edf1f5,#d8e0e9)' },
    forest:   { name: '森野绿', bg: 'linear-gradient(135deg,#f1f8f2 0%,#d8eddc 100%)', primary: '#15803d', hover: '#116532', soft: '#e6f6ea', soft2: '#d0ecd8', bgSolid: '#eef8f1', surface2: '#f6fcf8', preview: 'linear-gradient(135deg,#e8f6eb,#cde9d3)' }
  },
  themeOrder: ['default', 'mist', 'mint', 'sunset', 'sakura', 'graphite', 'forest'],

  showThemeStore() {
    var _m2 = document.getElementById('settings-menu'); if(_m2)_m2.classList.add('hidden');
    var _old = document.getElementById('theme-store-section'); if(_old)_old.remove();
    const presets = this.themePresets || {};
    const ids = (this.themeOrder && this.themeOrder.length) ? this.themeOrder : Object.keys(presets);
    let html = '<div style="max-width:640px;margin:36px auto;padding:24px;background:rgba(255,255,255,.94);border-radius:14px;box-shadow:0 8px 30px rgba(15,40,80,.08);">';
    html += '<h2 style="text-align:center;margin-bottom:6px;">🎨 切换风格</h2>';
    html += '<p style="text-align:center;color:#8a8f99;font-size:13px;margin-bottom:20px;">选择一种喜欢的界面配色，点击立即生效</p>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">';
    ids.forEach(id => {
      const th = presets[id];
      if (!th) return;
      const active = (this.themeSkin === id);
      html += '<div onclick="app.applyTheme(\'' + id + '\')" style="cursor:pointer;border-radius:12px;padding:14px;background:#fff;border:2px solid ' + (active ? th.primary : '#e6e9ef') + ';display:flex;align-items:center;gap:12px;">';
      html += '<span style="width:38px;height:38px;border-radius:10px;flex:0 0 38px;background:' + th.preview + ';border:1px solid rgba(0,0,0,.06);"></span>';
      html += '<span style="flex:1;min-width:0;"><b style="display:block;font-size:14px;color:#1b1b1b;">' + th.name + '</b><small style="color:#8a8f99;font-size:12px;">' + (active ? '当前使用中' : '点击应用') + '</small></span>';
      html += '<span style="color:' + th.primary + ';font-weight:bold;font-size:16px;">' + (active ? '✓' : '') + '</span>';
      html += '</div>';
    });
    html += '</div><div style="text-align:center;margin-top:18px;"><button class="btn btn-default" onclick="var s=document.getElementById(\'theme-store-section\');if(s)s.remove();app.backToSettings();">← 返回设置</button></div></div>';
    const sec = document.getElementById('theme-store-section');
    if (!sec) {
      const s = document.createElement('section');
      s.id = 'theme-store-section';
      s.className = 'section';
      s.innerHTML = html;
      // 必须与其它 .section 平级（同一布局容器），否则会被隐藏的父 section 连带隐藏（导致空白）
      const host = document.querySelector('.section-host') || document.getElementById('content') || document.getElementById('app');
      if (host) host.appendChild(s);
    } else {
      sec.innerHTML = html;
    }
    document.querySelectorAll('.section').forEach(x => x.classList.remove('active'));
    document.getElementById('theme-store-section').classList.add('active');
    const _thTitle = document.getElementById('header-title');
    if (_thTitle) _thTitle.textContent = '切换风格';
    this.updateNav('password-manage');
  },

  applyThemeVars() {
    const presets = this.themePresets || {};
    const th = presets[this.themeSkin] || presets.default;
    if (!th) return;
    const r = document.documentElement.style;
    r.setProperty('--primary', th.primary);
    r.setProperty('--primary-hover', th.hover || th.primary);
    r.setProperty('--primary-soft', th.soft || '#ebf3fc');
    r.setProperty('--primary-soft-2', th.soft2 || '#d7e8fa');
    r.setProperty('--primary-color', th.primary);
    r.setProperty('--primary-light', th.hover || th.primary);
    r.setProperty('--accent', th.primary);
    if (th.bgSolid) r.setProperty('--bg', th.bgSolid);
    if (th.surface2) r.setProperty('--surface-2', th.surface2);
  },

  applyTheme(id, silent) {
    const presets = this.themePresets || {};
    const first = (this.themeOrder && this.themeOrder[0]) || 'default';
    const key = presets[id] ? id : first;
    const th = presets[key] || { name: '默认', bg: '#f3f3f3', primary: '#0f6cbd' };
    this.themeSkin = key;
    this.applyDisplayTheme();
    this.saveConfig();
    if (!silent) alert('风格已切换为：' + th.name);
  },

  // ===== 创作者模式 =====
  creatorMode: false,
  
    enterCreatorMode() {
    var self = this;
    var mask = document.createElement('div');
    mask.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;';
    
    var box = document.createElement('div');
    box.style.cssText = 'background:white;padding:24px 28px;border-radius:12px;min-width:320px;box-shadow:0 8px 40px rgba(0,0,0,.3);';
    box.innerHTML = '<h3 style="margin:0 0 16px;color:#2c5f8d;">🔐 创作者模式验证</h3>'
      + '<p style="margin:8px 0 4px;font-size:13px;color:#666;">最高级管理员密码：</p>'
      + '<input id="cm-super-pwd" type="password" style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px;margin-bottom:12px;box-sizing:border-box;">'
      + '<p style="margin:8px 0 4px;font-size:13px;color:#666;">创作者密码：</p>'
      + '<input id="cm-creator-pwd" type="password" style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px;margin-bottom:16px;box-sizing:border-box;">';
    
    var btnDiv = document.createElement('div');
    btnDiv.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
    var btnCancel = document.createElement('button');
    btnCancel.textContent = '取消';
    btnCancel.style.cssText = 'padding:7px 16px;border:none;border-radius:6px;background:#ccc;color:white;cursor:pointer;';
    var btnOk = document.createElement('button');
    btnOk.textContent = '确定';
    btnOk.style.cssText = 'padding:7px 16px;border:none;border-radius:6px;background:#2c5f8d;color:white;cursor:pointer;';
    btnDiv.appendChild(btnCancel);
    btnDiv.appendChild(btnOk);
    box.appendChild(btnDiv);
    mask.appendChild(box);
    document.body.appendChild(mask);
    
    var superInput = document.getElementById('cm-super-pwd');
    var creatorInput = document.getElementById('cm-creator-pwd');
    // 确保输入框可编辑（防止被全局锁定逻辑影响）
    superInput.disabled = false; superInput.readOnly = false;
    creatorInput.disabled = false; creatorInput.readOnly = false;
    // 延迟聚焦，确保 DOM 渲染完成
    setTimeout(function () { superInput.focus(); }, 80);
    
    function verify() {
      superInput.disabled = false; superInput.readOnly = false;
      creatorInput.disabled = false; creatorInput.readOnly = false;
      var s = superInput.value;
      var c = creatorInput.value;
      if (!electronAPI || !electronAPI.verifyCreator) {
        alert('无法验证密码，请重试。');
        return;
      }
      electronAPI.verifyCreator({ superPwd: s, creatorPwd: c }).then(function (ok) {
        if (!ok) {
          alert('最高级管理员或创作者密码错误！');
          superInput.value = '';
          creatorInput.value = '';
          setTimeout(function () { superInput.focus(); }, 80);
          return;
        }
        mask.remove();
        self.doEnterCreatorMode();
      });
    }
    btnOk.onclick = verify;
    btnCancel.onclick = function() { mask.remove(); };
    creatorInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') verify(); });
    superInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') creatorInput.focus(); });
  },
  doEnterCreatorMode() {
    this.creatorMode = true;
    document.body.classList.add('creator-mode');
    const grid = document.getElementById('settings-menu');
    if (grid) {
      document.querySelectorAll('.creator-only').forEach(function(e) { e.remove(); });
      var d1 = document.createElement('div');
      d1.className = 'settings-item creator-only';
      d1.setAttribute('onclick', 'window.app.creatorAction("lockPassword")');
      d1.innerHTML = '<div class="settings-icon">🔒</div><div class="settings-text"><h3>锁定密码</h3><p>' + (this.passwordLocked ? '✅ 当前：已锁定（点击解锁）' : '不可修改和关闭密码（点击锁定）') + '</p></div>';
      grid.appendChild(d1);
      var d2 = document.createElement('div');
      d2.className = 'settings-item creator-only';
      d2.setAttribute('onclick', 'window.app.creatorAction("lockTables")');
      d2.innerHTML = '<div class="settings-icon">🔐</div><div class="settings-text"><h3>锁定表格</h3><p>' + (this.tablesLocked ? '✅ 当前：已锁定（点击解锁）' : '锁定后所有表格不可修改（点击锁定）') + '</p></div>';
      grid.appendChild(d2);
      var d3 = document.createElement('div');
      d3.className = 'settings-item creator-only';
      d3.setAttribute('onclick', 'window.app.creatorAction("exitCreator")');
      d3.innerHTML = '<div class="settings-icon">🚪</div><div class="settings-text"><h3>退出创作者模式</h3><p>恢复正常模式</p></div>';
      grid.appendChild(d3);
    }
    this.addLog('进入创作者模式', '');
    alert('已进入创作者模式！设置中新增锁定密码/锁定表格/退出选项。');
  },
  renderCreatorCards() {
    // 刷新创作者专属按钮（锁定状态切换后更新文字）
    if (!this.creatorMode) return;
    const grid = document.getElementById('settings-menu');
    if (!grid) return;
    document.querySelectorAll('.creator-only').forEach(function(e) { e.remove(); });
    var d1 = document.createElement('div');
    d1.className = 'settings-item creator-only';
    d1.setAttribute('onclick', 'window.app.creatorAction("lockPassword")');
    d1.innerHTML = '<div class="settings-icon">🔒</div><div class="settings-text"><h3>锁定密码</h3><p>' + (this.passwordLocked ? '✅ 当前：已锁定（点击解锁）' : '不可修改和关闭密码（点击锁定）') + '</p></div>';
    grid.appendChild(d1);
    var d2 = document.createElement('div');
    d2.className = 'settings-item creator-only';
    d2.setAttribute('onclick', 'window.app.creatorAction("lockTables")');
    d2.innerHTML = '<div class="settings-icon">🔐</div><div class="settings-text"><h3>锁定表格</h3><p>' + (this.tablesLocked ? '✅ 当前：已锁定（点击解锁）' : '锁定后所有表格不可修改（点击锁定）') + '</p></div>';
    grid.appendChild(d2);
    var d3 = document.createElement('div');
    d3.className = 'settings-item creator-only';
    d3.setAttribute('onclick', 'window.app.creatorAction("exitCreator")');
    d3.innerHTML = '<div class="settings-icon">🚪</div><div class="settings-text"><h3>退出创作者模式</h3><p>恢复正常模式</p></div>';
    grid.appendChild(d3);
  },  showCreatorPanel() {
    // 显示创作者模式下的额外设置选项
    const settingsGrid = document.getElementById('settings-menu');
    if (!settingsGrid) return;
    // 移除旧的创作者卡片
    document.querySelectorAll('.creator-only').forEach(e => e.remove());
    const items = [
      { icon: '🔒', name: '锁定密码', desc: '不可修改和关闭密码', action: 'lockPassword' },
      { icon: '🔐', name: '锁定表格', desc: '所有表格不可修改', action: 'lockTables' },
      { icon: '📊', name: '批量加减分', desc: '选中多行统一加减分', action: 'batchScore' },
      { icon: '📋', name: '加分模板', desc: '预设加减分规则', action: 'scoreTemplates' },
      { icon: '📝', name: '扣分原因记录', desc: '记录加减分备注', action: 'deductionLog' },
      { icon: '📈', name: '个人得分趋势图', desc: '展示得分变化', action: 'trendChart' },
      { icon: '📊', name: '小组对比柱状图', desc: '各组得分对比', action: 'groupChart' },
      { icon: '🌓', name: '主题切换', desc: '浅色/深色/护眼', action: 'themeToggle' },
      { icon: '↕️', name: '表格排序', desc: '按列排序', action: 'tableSort' },
      { icon: '💾', name: '自动保存', desc: '开启/关闭自动保存', action: 'autoSaveToggle' },
      { icon: '📄', name: '操作日志', desc: '查看操作记录', action: 'viewLogs' },
      { icon: '⏰', name: '自动锁屏', desc: '闲置自动锁定', action: 'autoLockToggle' },
      { icon: '🚪', name: '退出创作者模式', desc: '恢复正常模式', action: 'exitCreator' }
    ];
    items.forEach(it => {
      const card = document.createElement('div');
      card.className = 'setting-card creator-only';
      card.style.borderColor = '#9c27b0';
      card.innerHTML = '<div class="setting-icon">' + it.icon + '</div><div class="setting-name">' + it.name + '</div><div class="setting-desc">' + it.desc + '</div>';
      card.onclick = () => this.creatorAction(it.action);
      settingsGrid.appendChild(card);
    });
  },

  creatorAction(action) {
    switch(action) {
      case 'lockPassword':
        this.passwordLocked = !this.passwordLocked;
        this.saveConfig();
        alert(this.passwordLocked ? '密码已锁定（不可修改/关闭）' : '密码已解锁');
        this.renderCreatorCards();
        break;
      case 'lockTables':
        this.tablesLocked = !this.tablesLocked;
        this.saveConfig();
        alert(this.tablesLocked ? '表格已锁定（不可修改）' : '表格已解锁');
        this.renderCreatorCards();
        break;
      case 'batchScore': this.batchScoreDialog(); break;
      case 'scoreTemplates': this.scoreTemplatesDialog(); break;
      case 'deductionLog': alert('扣分原因记录功能：在加减分时输入备注即可记录。'); break;
      case 'trendChart': this.showTrendChart(); break;
      case 'groupChart': this.showGroupChart(); break;
      case 'themeToggle': this.toggleDisplayTheme(); break;
      case 'tableSort': this.sortTable(); break;
      case 'autoSaveToggle':
        this.autoSave = !this.autoSave;
        this.saveConfig();
        alert(this.autoSave ? '自动保存已开启' : '自动保存已关闭');
        break;
      case 'viewLogs': this.viewLogs(); break;
      case 'autoLockToggle':
        this.autoLock = !this.autoLock;
        this.saveConfig();
        if (this.autoLock) this.startAutoLock();
        alert(this.autoLock ? '自动锁屏已开启（5分钟）' : '自动锁屏已关闭');
        break;
      case 'exitCreator': this.exitCreatorMode(); break;
    }
  },

  exitCreatorMode() {
    this.creatorMode = false;
    document.body.classList.remove('creator-mode');
    document.querySelectorAll('.creator-only').forEach(e => e.remove());
    this.addLog('退出创作者模式', '');
    alert('已退出创作者模式');
  },

  lastBatchDay: 0,

  // 把 delta 追加到某个每日单元格（保持“总分=每日单元格之和”的数据一致性）
  appendScoreToCell(cell, delta) {
    var signed = (delta > 0 ? '+' : '') + String(Math.round(delta * 100) / 100);
    var text = String(cell == null ? '' : cell).trim();
    if (text === '') return signed.replace('+', ''); // 空单元格正数直接写 2 而不是 +2
    // 纯数字/加减表达式：直接拼接（如 1 → 1+2，-0.5 → -0.5+1）
    var cleaned = text.replace(/[\s+-]|(\d+(\.\d+)?)/g, '');
    if (cleaned === '') return text + signed;
    // 符号类内容（√/缺 等）或无法识别的文本：折算为数值后再拼接
    var oldVal = parseCellScore(text);
    return String(Math.round(oldVal * 100) / 100) + signed;
  },

  // 批量加减分弹窗（Electron 不支持 prompt()，必须用自定义弹窗）
  // presetDelta/presetReason：加分模板点击时预填
  batchScoreDialog(presetDelta, presetReason) {
    if (this.tablesLocked && !this.creatorMode) { alert('表格已被创作者锁定，无法修改。'); return; }
    if (!this.editingTable) { alert('请先打开一个表格'); return; }
    var self = this;

    var old = document.getElementById('batch-modal');
    if (old) old.remove();

    this.collectTableData();
    var table = this.editingTable;

    var mask = document.createElement('div');
    mask.id = 'batch-modal';
    mask.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;';

    var box = document.createElement('div');
    box.style.cssText = 'background:#fff;padding:22px 26px;border-radius:12px;min-width:380px;max-width:92vw;max-height:88vh;overflow:auto;box-shadow:0 8px 40px rgba(0,0,0,.3);';

    var h = document.createElement('h3');
    h.style.cssText = 'margin:0 0 12px;color:#2c5f8d;';
    h.textContent = '📊 批量加减分（勾选学生）';
    box.appendChild(h);

    // 分数输入
    var lbl1 = document.createElement('p');
    lbl1.style.cssText = 'margin:8px 0 4px;font-size:13px;color:#666;';
    lbl1.textContent = '分数（正数加分，负数扣分）：';
    box.appendChild(lbl1);
    var scoreInput = document.createElement('input');
    scoreInput.type = 'text';
    scoreInput.id = 'batch-delta';
    scoreInput.value = (presetDelta !== undefined && presetDelta !== null) ? String(presetDelta) : '';
    scoreInput.placeholder = '例如：2 或 -1';
    scoreInput.style.cssText = 'width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box;margin-bottom:10px;';
    box.appendChild(scoreInput);

    // 日期选择
    var lbl2 = document.createElement('p');
    lbl2.style.cssText = 'margin:8px 0 4px;font-size:13px;color:#666;';
    lbl2.textContent = '记入哪一天：';
    box.appendChild(lbl2);
    var daySelect = document.createElement('select');
    daySelect.id = 'batch-day';
    daySelect.style.cssText = 'width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box;margin-bottom:10px;';
    for (var di = 0; di < WEEK_LABELS.length; di++) {
      var opt = document.createElement('option');
      opt.value = String(di);
      opt.textContent = WEEK_LABELS[di];
      if (di === (this.lastBatchDay || 0)) opt.selected = true;
      daySelect.appendChild(opt);
    }
    box.appendChild(daySelect);

    // 原因
    var lbl3 = document.createElement('p');
    lbl3.style.cssText = 'margin:8px 0 4px;font-size:13px;color:#666;';
    lbl3.textContent = '原因（可选）：';
    box.appendChild(lbl3);
    var reasonInput = document.createElement('input');
    reasonInput.type = 'text';
    reasonInput.id = 'batch-reason';
    reasonInput.value = presetReason || '';
    reasonInput.placeholder = '例如：作业完成';
    reasonInput.style.cssText = 'width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box;margin-bottom:6px;';
    box.appendChild(reasonInput);

    // 学生多选列表
    var selLbl = document.createElement('p');
    selLbl.style.cssText = 'margin:10px 0 4px;font-size:13px;color:#666;display:flex;justify-content:space-between;align-items:center;';
    selLbl.innerHTML = '<span>选择要加减分的学生：</span>';
    var selAllSpan = document.createElement('span');
    selAllSpan.style.cssText = 'font-size:12px;';
    var selAllLink = document.createElement('a');
    selAllLink.href = 'javascript:void(0)';
    selAllLink.textContent = '全选';
    selAllLink.style.cssText = 'color:#2c5f8d;margin-right:8px;';
    var selNoneLink = document.createElement('a');
    selNoneLink.href = 'javascript:void(0)';
    selNoneLink.textContent = '全不选';
    selNoneLink.style.cssText = 'color:#2c5f8d;';
    selAllSpan.appendChild(selAllLink);
    selAllSpan.appendChild(selNoneLink);
    selLbl.appendChild(selAllSpan);
    box.appendChild(selLbl);

    var stuList = document.createElement('div');
    stuList.style.cssText = 'border:1px solid #ddd;border-radius:6px;padding:8px;max-height:200px;overflow:auto;margin-bottom:8px;background:#fafafa;';
    var validRows = table.rows.filter(function(r) { return r.name && String(r.name).trim() !== '——'; });
    validRows.forEach(function(r, idx) {
      var rowDiv = document.createElement('label');
      rowDiv.style.cssText = 'display:flex;align-items:center;gap:8px;padding:3px 4px;cursor:pointer;border-radius:4px;';
      rowDiv.onmouseenter = function() { rowDiv.style.background = '#eef3f9'; };
      rowDiv.onmouseleave = function() { rowDiv.style.background = 'transparent'; };
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'batch-stu-cb';
      cb.dataset.row = String(table.rows.indexOf(r));
      cb.checked = true;
      var nameSpan = document.createElement('span');
      nameSpan.style.cssText = 'font-size:13px;color:#333;';
      nameSpan.textContent = '第' + r.group + '组 · ' + r.name;
      rowDiv.appendChild(cb);
      rowDiv.appendChild(nameSpan);
      stuList.appendChild(rowDiv);
    });
    box.appendChild(stuList);

    selAllLink.onclick = function() { stuList.querySelectorAll('.batch-stu-cb').forEach(function(c) { c.checked = true; }); };
    selNoneLink.onclick = function() { stuList.querySelectorAll('.batch-stu-cb').forEach(function(c) { c.checked = false; }); };

    var tip = document.createElement('p');
    tip.style.cssText = 'font-size:12px;color:#999;margin:0 0 12px;';
    tip.textContent = '提示：分数写入所选日期，总分与排名自动重算；姓名为「——」的空行不显示。';
    box.appendChild(tip);

    var err = document.createElement('div');
    err.style.cssText = 'color:#e74c3c;font-size:13px;margin-bottom:10px;min-height:18px;';
    box.appendChild(err);

    var btnDiv = document.createElement('div');
    btnDiv.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
    var btnCancel = document.createElement('button');
    btnCancel.textContent = '取消';
    btnCancel.style.cssText = 'padding:7px 16px;border:none;border-radius:6px;background:#bdc3c7;color:#fff;cursor:pointer;';
    var btnOk = document.createElement('button');
    btnOk.textContent = '确认执行';
    btnOk.style.cssText = 'padding:7px 16px;border:none;border-radius:6px;background:#2c5f8d;color:#fff;cursor:pointer;';
    btnDiv.appendChild(btnCancel);
    btnDiv.appendChild(btnOk);
    box.appendChild(btnDiv);
    mask.appendChild(box);
    document.body.appendChild(mask);
    scoreInput.focus();

    function doApply() {
      var delta = parseFloat(scoreInput.value);
      if (isNaN(delta) || delta === 0) { err.textContent = '请输入非 0 的有效数字（如 2 或 -1）'; scoreInput.focus(); return; }
      var checked = stuList.querySelectorAll('.batch-stu-cb:checked');
      if (checked.length === 0) { err.textContent = '请至少勾选一名学生'; return; }
      var dayIdx = parseInt(daySelect.value, 10);
      var reason = reasonInput.value.trim();
      self.lastBatchDay = dayIdx;

      var appliedRows = [];
      checked.forEach(function(cb) { appliedRows.push(parseInt(cb.dataset.row, 10)); });

      var undoChanges = [];
      for (var i = 0; i < appliedRows.length; i++) {
        var r = table.rows[appliedRows[i]];
        while (r.cells.length <= dayIdx) r.cells.push('');
        undoChanges.push({ row: appliedRows[i], day: dayIdx, before: r.cells[dayIdx] });
        r.cells[dayIdx] = self.appendScoreToCell(r.cells[dayIdx], delta);
      }
      self.pushScoreUndo(table.id, undoChanges, '批量' + (delta > 0 ? '加' : '扣') + Math.abs(delta) + '分（' + appliedRows.length + '人）');
      self.recomputeTable(table);
      window.electronAPI.updateTable(table).then(function() {
        self.renderEditor();
        mask.remove();
        self.addLog('批量加减分', '第' + (dayIdx + 1) + '列 ' + appliedRows.length + '人' + (delta > 0 ? '加' : '扣') + Math.abs(delta) + '分' + (reason ? '，原因：' + reason : ''));
        alert('已对 ' + appliedRows.length + ' 名学生' + (delta > 0 ? '加' : '扣') + Math.abs(delta) + ' 分，总分和排名已自动更新。');
      }).catch(function(e) {
        err.textContent = '保存失败：' + (e && e.message ? e.message : e);
      });
    }
    btnOk.onclick = doApply;
    btnCancel.onclick = function() { mask.remove(); };
    scoreInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') doApply(); });
    reasonInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') doApply(); });
  },

  scoreTemplatesDialog() {
    var self = this;
    if (this.tablesLocked && !this.creatorMode) { alert('表格已被创作者锁定，无法修改。'); return; }
    if (!this.editingTable) { alert('请先打开一个表格'); return; }
    var old = document.getElementById('tpl-modal');
    if (old) old.remove();

    var templates = [
      { name: '作业完成 +2', delta: 2, reason: '作业完成' },
      { name: '课堂发言 +1', delta: 1, reason: '课堂发言' },
      { name: '考试优秀 +5', delta: 5, reason: '考试优秀' },
      { name: '违纪 -1', delta: -1, reason: '违纪' },
      { name: '迟到 -2', delta: -2, reason: '迟到' }
    ];

    var mask = document.createElement('div');
    mask.id = 'tpl-modal';
    mask.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;';
    var box = document.createElement('div');
    box.style.cssText = 'background:#fff;padding:22px 26px;border-radius:12px;min-width:320px;box-shadow:0 8px 40px rgba(0,0,0,.3);';
    var h = document.createElement('h3');
    h.style.cssText = 'margin:0 0 14px;color:#2c5f8d;';
    h.textContent = '📋 加分模板';
    box.appendChild(h);
    templates.forEach(function(t) {
      var b = document.createElement('button');
      b.className = 'btn btn-primary btn-sm';
      b.style.cssText = 'display:block;width:100%;margin:8px 0;';
      b.textContent = t.name;
      b.onclick = function() {
        mask.remove();
        self.batchScoreDialog(t.delta, t.reason);
      };
      box.appendChild(b);
    });
    var btnClose = document.createElement('button');
    btnClose.className = 'btn btn-sm';
    btnClose.style.cssText = 'display:block;width:100%;margin-top:10px;background:#999;color:#fff;';
    btnClose.textContent = '关闭';
    btnClose.onclick = function() { mask.remove(); };
    box.appendChild(btnClose);
    mask.appendChild(box);
    document.body.appendChild(mask);
  },

  applyTemplate(delta, name) {
    // 兼容旧入口：直接走批量加减分弹窗并预填
    this.batchScoreDialog(delta, name);
  },

  showTrendChart() {
    alert('个人得分趋势图功能：可在此展示学生的历史得分折线图。（需历史数据）');
  },

  showGroupChart() {
    if (!this.editingTable) return;
    const table = this.editingTable;
    let html = '<div style="max-width:600px;margin:40px auto;padding:20px;background:#fff;border-radius:12px;"><h3>小组对比柱状图</h3>';
    const groupMap = {};
    table.rows.forEach(r => {
      const gs = table.group_scores ? (table.group_scores[String(r.group)] || 0) : 0;
      groupMap[r.group] = gs;
    });
    const groupEntries = Object.entries(groupMap).map(([g, s]) => ({ group: parseInt(g), score: s }));
    const maxScore = Math.max(...groupEntries.map(e => e.score), 0);
    groupEntries.forEach(e => {
      const pct = maxScore > 0 ? (e.score / maxScore * 100) : 0;
      html += '<div style="margin:10px 0;"><span style="display:inline-block;width:60px;">第' + e.group + '组</span><div style="display:inline-block;width:300px;background:#eee;border-radius:4px;"><div style="width:' + pct + '%;background:linear-gradient(90deg,#4caf50,#8bc34a);height:24px;border-radius:4px;text-align:right;padding-right:8px;color:#fff;line-height:24px;">' + e.score + '分</div></div></div>';
    });
    html += '<button class="btn btn-default" onclick="document.getElementById(\'chart-modal\').remove()">关闭</button></div>';
    const modal = document.createElement('div');
    modal.id = 'chart-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:9999;';
    modal.innerHTML = html;
    document.body.appendChild(modal);
  },

  toggleDisplayTheme() {
    const modes = ['light', 'dark', 'eye'];
    const idx = modes.indexOf(this.displayTheme || 'light');
    this.displayTheme = modes[(idx + 1) % modes.length];
    this.applyDisplayTheme();
    this.saveConfig();
    alert('已切换为：' + { light: '浅色', dark: '深色', eye: '护眼' }[this.displayTheme]);
  },

  applyDisplayTheme() {
    const theme = this.displayTheme || 'light';
    document.body.classList.remove('display-dark', 'display-eye');
    if (theme === 'dark') {
      document.body.classList.add('display-dark');
      document.body.style.color = '#eee';
      document.body.style.background = '#1a1a2e';
    } else if (theme === 'eye') {
      document.body.classList.add('display-eye');
      document.body.style.color = '#333';
      document.body.style.background = '#c7edcc';
    } else {
      document.body.style.color = '';
      this.applyThemeVars();
      const presets = this.themePresets || {};
      const th = presets[this.themeSkin] || presets[(this.themeOrder && this.themeOrder[0]) || 'default'];
      document.body.style.background = th ? th.bg : '#f3f3f3';
    }
  },

  sortTable() {
    if (!this.editingTable) { alert('请先打开一个表格'); return; }
    alert('表格排序功能：点击列标题即可按该列排序。');
  },

  viewLogs() {
    window.electronAPI.getLogs().then(logs => {
      let html = '<div style="max-width:700px;margin:40px auto;padding:20px;background:#fff;border-radius:12px;max-height:80vh;overflow:auto;"><h3>操作日志</h3><table style="width:100%;border-collapse:collapse;">';
      html += '<tr style="background:#f0f0f0;"><th style="padding:8px;border:1px solid #ddd;">时间</th><th style="padding:8px;border:1px solid #ddd;">操作</th><th style="padding:8px;border:1px solid #ddd;">详情</th></tr>';
      logs.forEach(l => {
        html += '<tr><td style="padding:6px;border:1px solid #ddd;">' + escapeHtml(l.time) + '</td><td style="padding:6px;border:1px solid #ddd;">' + escapeHtml(l.action) + '</td><td style="padding:6px;border:1px solid #ddd;font-size:12px;">' + escapeHtml(l.detail || '') + '</td></tr>';
      });
      html += '</table><button class="btn btn-default" onclick="document.getElementById(\'log-modal\').remove()">关闭</button></div>';
      const modal = document.createElement('div');
      modal.id = 'log-modal';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:9999;overflow:auto;';
      modal.innerHTML = html;
      document.body.appendChild(modal);
    });
  },

  isLocked: false,
  autoLockTimer: null,
  startAutoLock() {
    if (this.autoLockTimer) clearInterval(this.autoLockTimer);
    let idle = 0;
    this.autoLockTimer = setInterval(() => {
      idle++;
      if (idle >= 300) {
        clearInterval(this.autoLockTimer);
        this.lockApp();
        alert('已闲置5分钟，自动锁屏！');
      }
    }, 1000);
    document.onmousemove = () => { idle = 0; };
  },

  async saveConfig() {
    try {
      await window.electronAPI.updateSettingsConfig({
        passwordLocked: this.passwordLocked === true,
        tablesLocked: this.tablesLocked === true,
        autoSave: this.autoSave !== false,
        autoLock: this.autoLock === true,
        themeSkin: this.themeSkin || 'default',
        displayTheme: this.displayTheme || 'light'
      });
    } catch(e) { console.error('saveConfig failed', e); }
  },
  addLog(action, detail) {
    if (window.electronAPI.addLog) {
      window.electronAPI.addLog({ action, detail });
    }
  },

  // ===== 语言切换修复：确保立即生效 =====
  // applyLanguage 已经在 showSection/renderEditor/saveLanguage 中调用
  // 确保切换后立即调用
  collectTableData() {
    const table = this.editingTable;
    if (table.type === 'seat') {
      // 座位表：按 (排,列) 回写姓名
      const cellMap = {};
      (table.rows || []).forEach(r => {
        if (r.seat_row !== undefined && r.seat_col !== undefined) cellMap[r.seat_row + '_' + r.seat_col] = r;
      });
      document.querySelectorAll('#editor-body input[data-type="seat-name"]').forEach(input => {
        const r = parseInt(input.dataset.row, 10);
        const c = parseInt(input.dataset.col, 10);
        const key = r + '_' + c;
        if (!cellMap[key]) {
          cellMap[key] = { group: r + 1, name: '', personal_rank: '', total_score: 0, cells: Array(WEEK_LABELS.length).fill(''), seat_row: r, seat_col: c };
          table.rows.push(cellMap[key]);
        }
        cellMap[key].name = input.value;
      });
      return;
    }
    const inputs = document.querySelectorAll('#editor-body input');
    inputs.forEach(input => {
      const type = input.dataset.type;
      if (type === 'group-rank') {
        table.group_ranks[input.dataset.group] = input.value;
      } else if (type === 'name') {
        table.rows[parseInt(input.dataset.row, 10)].name = input.value;
      } else if (type === 'personal-rank') {
        table.rows[parseInt(input.dataset.row, 10)].personal_rank = input.value;
      } else if (type === 'cell') {
        table.rows[parseInt(input.dataset.row, 10)].cells[parseInt(input.dataset.day, 10)] = input.value;
      }
    });
  },

  async toggleEdit() {
    if (this.isEditing) {
      this.collectTableData();
      if (this.editingTable.type !== 'seat') this.recomputeTable(this.editingTable);
      await window.electronAPI.updateTable(this.editingTable);
    }
    this.isEditing = !this.isEditing;
    this.renderEditor();
  },

  // 统一的总分/排名重算（个人总分→个人排名→小组总分→小组排名，同分并列）
  recomputeTable(table) {
    if (!table || !Array.isArray(table.rows)) return;
    if (table.type === 'seat') return; // 座位表无积分排名，跳过重算
    if (!table.group_ranks) table.group_ranks = {};

    // 1. 计算个人总分（每日单元格求和）
    for (const row of table.rows) {
      if (!Array.isArray(row.cells)) row.cells = Array(WEEK_LABELS.length).fill('');
      let score = 0;
      for (const cell of row.cells) {
        score += parseCellScore(cell);
      }
      row.total_score = Math.round(score * 100) / 100;
    }

    // 占位行（空姓名或「——」）不参与排名，避免占用真实学生的名次
    const isRealRow = r => r && r.name !== undefined && String(r.name).trim() !== '' && String(r.name).trim() !== '——';
    const realRows = table.rows.filter(isRealRow);

    // 2. 个人排名（按总分降序，同分同名次；密集排名 1,1,2：并列后下一名次连续）
    table.rows.forEach(r => { r.personal_rank = ''; });
    const rankedRows = realRows.slice().sort((a, b) => b.total_score - a.total_score);
    let currentRank = 0;
    for (let i = 0; i < rankedRows.length; i++) {
      if (i === 0 || rankedRows[i].total_score < rankedRows[i - 1].total_score) currentRank++;
      rankedRows[i].personal_rank = '第' + currentRank + '名';
    }

    // 3. 小组总分与排名（总分仍按全组求和；只有含真实学生的小组参与排名）
    const groupScores = {};
    for (const row of table.rows) {
      if (groupScores[row.group] === undefined) groupScores[row.group] = 0;
      groupScores[row.group] += row.total_score;
    }
    table.group_scores = {};
    for (const g in groupScores) {
      table.group_scores[g] = Math.round(groupScores[g] * 100) / 100;
    }
    const groupsWithStudents = new Set(realRows.map(r => String(r.group)));
    for (const g in table.group_ranks) {
      if (!groupsWithStudents.has(String(g))) table.group_ranks[g] = '';
    }
    const groups = Object.keys(groupScores)
      .filter(g => groupsWithStudents.has(String(g)))
      .map(g => ({ group: parseInt(g, 10), score: groupScores[g] }));
    groups.sort((a, b) => b.score - a.score);
    currentRank = 0;
    for (let i = 0; i < groups.length; i++) {
      if (i === 0 || groups[i].score < groups[i - 1].score) currentRank++;
      table.group_ranks[String(groups[i].group)] = '第' + currentRank + '名';
    }
  },

  // 编辑时单元格变化后即时刷新总分/排名显示（不重建表格，保持滚动位置）
  refreshComputedCells() {
    const table = this.editingTable;
    const body = document.getElementById('editor-body');
    if (!table || !body) return;
    body.querySelectorAll('input[data-type="total-score"]').forEach(inp => {
      const r = table.rows[parseInt(inp.dataset.row, 10)];
      if (r) inp.value = r.total_score !== undefined ? r.total_score : 0;
    });
    body.querySelectorAll('input[data-type="personal-rank"]').forEach(inp => {
      const r = table.rows[parseInt(inp.dataset.row, 10)];
      if (r) inp.value = r.personal_rank || '';
    });
    body.querySelectorAll('input[data-type="group-rank"]').forEach(inp => {
      inp.value = (table.group_ranks && table.group_ranks[String(inp.dataset.group)]) || '';
    });
    body.querySelectorAll('td[data-group-total]').forEach(td => {
      const g = String(td.dataset.groupTotal);
      td.textContent = table.group_scores && table.group_scores[g] !== undefined ? table.group_scores[g] : 0;
    });
  },

  onEditorCellChange(e) {
    if (!this.isEditing || !this.editingTable || this.editingTable.type === 'seat') return;
    const t = e.target;
    if (!t || !t.dataset) return;
    if (t.dataset.type !== 'cell' && t.dataset.type !== 'name') return;
    this.collectTableData();
    this.recomputeTable(this.editingTable);
    this.refreshComputedCells();
  },

  async autoCalculate() {
    this.collectTableData();
    const table = this.editingTable;
    this.recomputeTable(table);
    await window.electronAPI.updateTable(table);
    this.renderEditor();
    this.addLog('自动计算', '表格：' + table.name);
  },

  async saveAndDone() {
    if (this.tablesLocked && !this.creatorMode) { alert('表格已被创作者锁定，无法修改。'); return; }
    this.collectTableData();
    if (this.editingTable.type !== 'seat') this.recomputeTable(this.editingTable);
    await window.electronAPI.updateTable(this.editingTable);
    const result = await window.electronAPI.confirmBox({
      title: '保存成功',
      message: `表格「${this.editingTable.name}」已保存！\n是否返回主菜单？`,
      buttons: ['返回主菜单', '留在编辑器']
    });
    if (result === 0) {
      this.showMainMenu();
    }
  },

  manageFilter: 'ranking', // 'ranking' 或 'seat'

  async showManageTables() {
    var self = this;
    if (!this._manageTabsBound) {
      document.getElementById('manage-tab-ranking').onclick = function() {
        self.manageFilter = 'ranking';
        self.updateManageTabStyle();
        self.showManageTables();
      };
      document.getElementById('manage-tab-seat').onclick = function() {
        self.manageFilter = 'seat';
        self.updateManageTabStyle();
        self.showManageTables();
      };
      document.getElementById('manage-tab-score').onclick = function() {
        self.manageFilter = 'score';
        self.updateManageTabStyle();
        self.showManageTables();
      };
      this._manageTabsBound = true;
    }
    this.updateManageTabStyle();

    const allTables = await window.electronAPI.loadTables();
    const tables = allTables.filter(function(t) { return (t.type || 'ranking') === self.manageFilter; });
    const list = document.getElementById('manage-list');
    const empty = document.getElementById('manage-empty');
    list.innerHTML = '';

    if (tables.length === 0) {
      empty.classList.remove('hidden');
      empty.querySelector('p').textContent = self.manageFilter === 'seat'
        ? '暂无座位表，请先在「排座位」中生成'
        : (self.manageFilter === 'score' ? '暂无成绩表，请先在「开始新的表格」中创建成绩排名表' : '暂无排名表，请先创建一个新表格');
      this.showSection('manage');
      return;
    }
    empty.classList.add('hidden');

    // ── 成绩表分类：名称 / 人数 / 科目数 / 创建时间 / 操作 ──
    if (this.manageFilter === 'score') {
      const sheader = document.createElement('div');
      sheader.className = 'manage-header';
      sheader.innerHTML = '<span class="name">表格名称</span><span>人数</span><span>科目数</span><span>创建时间</span><span style="flex:2.2;">操作</span>';
      list.appendChild(sheader);

      tables.forEach(tbl => {
        const row = document.createElement('div');
        row.className = 'manage-row manage-row-score';
        row.innerHTML = `
          <span class="name"><span style="display:inline-block;background:#00897b;color:#fff;font-size:11px;padding:1px 6px;border-radius:4px;margin-right:6px;">成绩</span>${escapeHtml(tbl.name)}</span>
          <span>${tbl.total_people}</span>
          <span>${tbl.num_subjects || (tbl.subjects || []).length}</span>
          <span>${tbl.created_at}</span>
          <div class="ops">
            <button class="op-edit" data-id="${tbl.id}">编辑</button>
            <button class="op-print" data-id="${tbl.id}">打印</button>
            <button class="op-del" data-id="${tbl.id}">删除</button>
          </div>
        `;
        row.querySelector('.op-edit').onclick = () => this.showScoreEditor(tbl.id);
        row.querySelector('.op-del').onclick = () => this.deleteTable(tbl.id, tbl.name);
        row.querySelector('.op-print').onclick = () => window.electronAPI.printTable(tbl);
        list.appendChild(row);
      });

      this.showSection('manage');
      return;
    }

    const header = document.createElement('div');
    header.className = 'manage-header';
    header.innerHTML = '<span class="name">表格名称</span><span>人数</span><span>组数</span><span>每组人数</span><span>创建时间</span><span>操作</span>';
    list.appendChild(header);

    tables.forEach(tbl => {
      const row = document.createElement('div');
      row.className = 'manage-row';
      const typeTag = (tbl.type === 'seat')
        ? '<span style="display:inline-block;background:#7c4dff;color:#fff;font-size:11px;padding:1px 6px;border-radius:4px;margin-right:6px;">座位</span>'
        : '';
      row.innerHTML = `
        <span class="name">${typeTag}${escapeHtml(tbl.name)}</span>
        <span>${tbl.total_people}</span>
        <span>${tbl.num_groups}</span>
        <span>${tbl.members_per_group}</span>
        <span>${tbl.created_at}</span>
        <div class="ops">
          <button class="op-edit" data-id="${tbl.id}">编辑</button>
          ${(tbl.type || 'ranking') === 'ranking' ? `<button class="op-cycle" data-id="${tbl.id}">下一周期</button>` : ''}
          <button class="op-print" data-id="${tbl.id}">打印</button>
          <button class="op-del" data-id="${tbl.id}">删除</button>
        </div>
      `;
      row.querySelector('.op-edit').onclick = () => this.showTableEditor(tbl.id);
      const cycleEl = row.querySelector('.op-cycle');
      if (cycleEl) cycleEl.onclick = () => this.createNextCycle(tbl.id);
      row.querySelector('.op-del').onclick = () => this.deleteTable(tbl.id, tbl.name);
      row.querySelector('.op-print').onclick = () => window.electronAPI.printTable(tbl);
      list.appendChild(row);
    });

    this.showSection('manage');
  },

  updateManageTabStyle() {
    var conf = {
      ranking: 'manage-tab-ranking',
      seat:    'manage-tab-seat',
      score:   'manage-tab-score'
    };
    Object.keys(conf).forEach(function (key) {
      var btn = document.getElementById(conf[key]);
      if (!btn) return;
      btn.classList.toggle('active', this.manageFilter === key);
    }, this);
  },

  // ===== 使用导向 =====
  showGuide() {
    var m = document.getElementById('guide-modal');
    if (m) m.classList.remove('hidden');
  },

  closeGuide() {
    var m = document.getElementById('guide-modal');
    if (m) m.classList.add('hidden');
  },

  async deleteTable(id, name) {
    // 使用 Electron 原生对话框，避免 confirm() 导致焦点丢失
    const result = await window.electronAPI.confirmBox({
      title: '确认删除',
      message: `确定要删除表格「${name}」吗？\n此操作不可撤销。`,
      buttons: ['确认删除', '取消']
    });
    if (result === 0) {
      await window.electronAPI.deleteTable(id);
      this.showManageTables();
    }
  },

  // ===== 数据备份与恢复 =====
  showBackupManage() {
    this.showSection('backup-manage');
    document.getElementById('backup-result').classList.add('hidden');
  },

  async doBackupExport() {
    const result = await window.electronAPI.backupExport();
    const box = document.getElementById('backup-result');
    box.classList.remove('hidden');
    if (result.success) {
      box.style.background = '#e8f5e9';
      box.style.color = '#1b5e20';
      box.textContent = `✓ 备份已导出到：${result.path}`;
    } else {
      box.style.background = '#ffebee';
      box.style.color = '#c62828';
      box.textContent = `✗ ${result.error || '导出失败'}`;
    }
  },

  async doBackupImport() {
    const result = await window.electronAPI.backupImport();
    const box = document.getElementById('backup-result');
    box.classList.remove('hidden');
    if (result.success) {
      box.style.background = '#e8f5e9';
      box.style.color = '#1b5e20';
      box.textContent = `✓ 已导入 ${result.count} 个表格（未覆盖已有表格），当前共 ${result.total} 个表格`;
      // 刷新主菜单的表格计数
      const tables = await window.electronAPI.loadTables();
      document.getElementById('table-count').textContent = tables.length;
    } else {
      box.style.background = '#ffebee';
      box.style.color = '#c62828';
      box.textContent = `✗ ${result.error || '恢复失败'}`;
    }
  },

  // ===== 完整备份：导出到文件夹 / 校验后恢复 =====
  showBackupMessage(ok, text) {
    const box = document.getElementById('backup-result');
    if (!box) return;
    box.classList.remove('hidden');
    box.style.background = ok ? 'var(--success-soft)' : 'var(--danger-soft)';
    box.style.color = ok ? '#0b5a0a' : 'var(--danger)';
    box.textContent = text;
  },

  async doFullBackupExport() {
    try {
      const result = await window.electronAPI.backupExportFolder();
      if (!result || !result.success) {
        if (result && result.error && result.error !== '已取消') this.showBackupMessage(false, '✗ ' + result.error);
        return;
      }
      const s = result.summary || {};
      const parts = ['表格 ' + (s.tableCount || 0) + ' 个'];
      if (s.rosterCount) parts.push('学生 ' + s.rosterCount + ' 人');
      if (s.dutyDays) parts.push('值日 ' + s.dutyDays + ' 天');
      if (s.homeworkCount) parts.push('作业记录 ' + s.homeworkCount + ' 条');
      this.showBackupMessage(true, '✓ 完整备份已导出\n' + result.path + '\n内容：' + parts.join(' · '));
    } catch (e) {
      this.showBackupMessage(false, '✗ 导出失败：' + e.message);
    }
  },

  async doFullBackupRestore() {
    try {
      const check = await window.electronAPI.backupValidate();
      if (!check || !check.success) {
        if (check && check.error && check.error !== '已取消') this.showBackupMessage(false, '✗ ' + check.error);
        return;
      }
      const s = check.summary || {};
      let timeText = '未知';
      if (s.backupTime) {
        const dt = new Date(s.backupTime);
        timeText = isNaN(dt.getTime()) ? String(s.backupTime) : dt.toLocaleString('zh-CN', { hour12: false });
      }
      const detail = [
        '备份时间：' + timeText,
        '软件版本：v' + (s.version || '未知'),
        '',
        '内容：' + (s.tableCount || 0) + ' 个表格（量化表 ' + (s.rankingCount || 0) + '、成绩表 ' + (s.scoreCount || 0) + '、座位表 ' + (s.seatCount || 0) + '）',
        '学生名单 ' + (s.rosterCount || 0) + ' 人 · 值日 ' + (s.dutyDays || 0) + ' 天 · 作业记录 ' + (s.homeworkCount || 0) + ' 条'
      ].join('\n');
      const choice = await window.electronAPI.confirmBox({
        title: '备份校验通过',
        message: detail + '\n\n请选择恢复方式：\n· 合并：保留现有数据，只追加备份中不重复的内容\n· 覆盖：用备份完全替换当前数据',
        buttons: ['合并到当前数据', '覆盖当前数据', '取消'],
        cancelId: 2
      });
      if (choice !== 0 && choice !== 1) return;
      const mode = choice === 0 ? 'merge' : 'overwrite';
      if (mode === 'overwrite') {
        const sure = await window.electronAPI.confirmBox({
          title: '确认覆盖',
          message: '覆盖后当前所有表格、学生名单、值日表和作业记录都会被备份内容替换。\n\n恢复前会自动保存一份当前数据快照，确认继续吗？',
          buttons: ['确认覆盖', '取消']
        });
        if (sure !== 0) return;
      }
      const result = await window.electronAPI.backupImportFull({ filePath: check.path, mode });
      if (!result || !result.success) {
        this.showBackupMessage(false, '✗ 恢复失败：' + (result && result.error ? result.error : '未知错误'));
        return;
      }
      let summary;
      if (mode === 'merge') {
        const parts = ['新增表格 ' + result.tablesAdded + ' 个'];
        if (result.rosterAdded) parts.push('学生 ' + result.rosterAdded + ' 人');
        if (result.dutyFilled) parts.push('值日 ' + result.dutyFilled + ' 项');
        if (result.homeworkAdded) parts.push('作业记录 ' + result.homeworkAdded + ' 条');
        summary = '✓ 合并完成：' + parts.join(' · ') + '\n当前共 ' + result.total + ' 个表格';
      } else {
        const roster = await window.electronAPI.rosterGet();
        const homeworks = await window.electronAPI.homeworkGet();
        summary = '✓ 覆盖恢复完成：当前共 ' + result.total + ' 个表格，学生 ' + ((roster && roster.students) || []).length + ' 人，作业记录 ' + ((homeworks && homeworks.records) || []).length + ' 条';
      }
      summary += '\n恢复前快照：' + result.preBackupPath;
      this.showBackupMessage(true, summary);
      const tables = await window.electronAPI.loadTables();
      const cntEl = document.getElementById('table-count');
      if (cntEl) cntEl.textContent = tables.length;
      await this.renderHomeRecent(tables);
    } catch (e) {
      this.showBackupMessage(false, '✗ 恢复失败：' + e.message);
    }
  },

  // ===== 自动备份列表与恢复 =====
  async listAutoBackups() {
    const backups = await window.electronAPI.listAutoBackups();
    const box = document.getElementById('backup-result');
    const listEl = document.getElementById('autobackup-list');
    if (!backups || backups.length === 0) {
      if (listEl) listEl.innerHTML = '<div style="color:#999;padding:8px;">暂无自动备份（编辑表格后会自动生成）</div>';
      return;
    }
    let html = '<div style="margin-top:12px;">';
    html += '<div style="font-weight:600;margin-bottom:6px;color:#333;">📋 历史自动备份（点击恢复）：</div>';
    html += '<div style="max-height:280px;overflow-y:auto;border:1px solid #e0e0e0;border-radius:6px;">';
    backups.forEach((b, idx) => {
      const sizeKb = (b.size / 1024).toFixed(1);
      html += `<div style="padding:8px 12px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between;align-items:center;cursor:pointer;" onclick="app.restoreAutoBackup('${b.file}')" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background=''">`;
      html += `<span>🕐 ${b.time}</span>`;
      html += `<span style="color:#888;font-size:12px;">${sizeKb} KB</span>`;
      html += `</div>`;
    });
    html += '</div></div>';
    if (listEl) listEl.innerHTML = html;
  },

  async restoreAutoBackup(fileName) {
    if (!confirm('确定要恢复此备份吗？\n恢复后当前数据将被覆盖（恢复前会自动保存当前数据）。')) return;
    const result = await window.electronAPI.restoreAutoBackup(fileName);
    const box = document.getElementById('backup-result');
    box.classList.remove('hidden');
    if (result.success) {
      box.style.background = '#e8f5e9';
      box.style.color = '#1b5e20';
      box.textContent = '✓ 恢复成功！请重新打开软件以加载恢复后的数据。';
    } else {
      box.style.background = '#ffebee';
      box.style.color = '#c62828';
      box.textContent = '✗ ' + (result.error || '恢复失败');
    }
  },

  // ===== 数据云同步 =====
  showCloudSync() {
    this.showSection('cloud-sync');
    document.getElementById('sync-result').classList.add('hidden');
    this.refreshTokenStatus();
  },

  async refreshTokenStatus() {
    try {
      const result = await window.electronAPI.syncGetToken();
      const status = document.getElementById('sync-token-status');
      if (status) {
        if (result.success && result.hasToken) {
          status.textContent = '✓ 已配置 (' + result.tokenPrefix + ')';
          status.style.color = '#2e7d32';
        } else {
          status.textContent = '⚠ 未配置 Token，同步将失败';
          status.style.color = '#c62828';
        }
      }
    } catch (e) { /* ignore */ }
  },

  async saveSyncToken() {
    const token = document.getElementById('sync-token').value.trim();
    if (!token) { alert('请输入 GitHub Token'); return; }
    const result = await window.electronAPI.syncSetToken(token);
    const box = document.getElementById('sync-result');
    box.classList.remove('hidden');
    if (result.success) {
      box.style.background = '#e8f5e9';
      box.style.color = '#1b5e20';
      box.textContent = '✓ GitHub Token 已保存';
      document.getElementById('sync-token').value = '';
      this.refreshTokenStatus();
    } else {
      box.style.background = '#ffebee';
      box.style.color = '#c62828';
      box.textContent = '✗ ' + (result.error || '保存失败');
    }
  },

  async saveSyncPassword() {
    const pwd = document.getElementById('sync-password').value.trim();
    if (!pwd) { alert('请输入同步密码'); return; }
    const result = await window.electronAPI.syncSetPassword(pwd);
    const box = document.getElementById('sync-result');
    box.classList.remove('hidden');
    if (result.success) {
      box.style.background = '#e8f5e9';
      box.style.color = '#1b5e20';
      box.textContent = '✓ 同步密码已保存';
    } else {
      box.style.background = '#ffebee';
      box.style.color = '#c62828';
      box.textContent = '✗ ' + (result.error || '保存失败');
    }
  },

  async doSyncUpload() {
    const tokenStatus = await window.electronAPI.syncGetToken();
    if (!tokenStatus.success || !tokenStatus.hasToken) {
      const box = document.getElementById('sync-result');
      box.classList.remove('hidden');
      box.style.background = '#fff3e0';
      box.style.color = '#e65100';
      box.textContent = '⚠ 请先配置 GitHub Token 再上传';
      return;
    }
    const pwd = document.getElementById('sync-password').value.trim();
    const box = document.getElementById('sync-result');
    box.classList.remove('hidden');
    box.style.background = '#e3f2fd';
    box.style.color = '#0d47a1';
    box.textContent = '正在加密并上传数据...';
    const result = await window.electronAPI.syncUpload(pwd || undefined);
    if (result.success) {
      box.style.background = '#e8f5e9';
      box.style.color = '#1b5e20';
      box.textContent = `✓ 上传成功！共 ${result.count} 个表格，时间：${new Date(result.time).toLocaleString()}`;
    } else {
      box.style.background = '#ffebee';
      box.style.color = '#c62828';
      box.textContent = '✗ ' + (result.error || '上传失败');
    }
  },

  async doSyncDownload() {
    const tokenStatus = await window.electronAPI.syncGetToken();
    if (!tokenStatus.success || !tokenStatus.hasToken) {
      const box = document.getElementById('sync-result');
      box.classList.remove('hidden');
      box.style.background = '#fff3e0';
      box.style.color = '#e65100';
      box.textContent = '⚠ 请先配置 GitHub Token 再下载';
      return;
    }
    const pwd = document.getElementById('sync-password').value.trim();
    const box = document.getElementById('sync-result');
    box.classList.remove('hidden');
    box.style.background = '#e3f2fd';
    box.style.color = '#0d47a1';
    box.textContent = '正在从云端下载并解密数据...';
    const result = await window.electronAPI.syncDownload(pwd || undefined);
    if (result.success) {
      box.style.background = '#e8f5e9';
      box.style.color = '#1b5e20';
      box.textContent = `✓ 下载成功！新增 ${result.count} 个表格${result.renamed ? '（重命名 ' + result.renamed + ' 个）' : ''}，当前共 ${result.total} 个表格。云端时间：${new Date(result.time).toLocaleString()}`;
      const tables = await window.electronAPI.loadTables();
      document.getElementById('table-count').textContent = tables.length;
    } else {
      box.style.background = '#ffebee';
      box.style.color = '#c62828';
      box.textContent = '✗ ' + (result.error || '下载失败');
    }
  },

  // ===== Excel 导入 =====
  showImportExcel() {
    this.showSection('excel-import');
    document.getElementById('import-result').classList.add('hidden');
  },

  async doImportExcel() {
    var nameInput = document.getElementById('import-name');
    var membersInput = document.getElementById('import-members');
    [nameInput, membersInput].forEach(function(i) { if (i) { i.disabled = false; i.readOnly = false; } });
    try {
      var name = nameInput.value.trim() || '导入表格';
      var membersPerGroup = parseInt(membersInput.value, 10) || 6;
      var result = await window.electronAPI.importExcel({ name: name, membersPerGroup: membersPerGroup });
      var box = document.getElementById('import-result');
      box.classList.remove('hidden');
      if (result.success) {
        box.style.background = '#e8f5e9';
        box.style.color = '#1b5e20';
        box.textContent = '✓ 导入成功！共 ' + result.table.total_people + ' 人，' + result.table.num_groups + ' 个小组';
        setTimeout(function() {
          this.editingTable = result.table;
          this.isEditing = true;
          this.renderEditor();
          this.showSection('editor');
        }.bind(this), 1500);
      } else {
        box.style.background = '#ffebee';
        box.style.color = '#c62828';
        box.textContent = '✗ ' + (result.error || '导入失败');
        nameInput.disabled = false;
        nameInput.focus();
      }
    } catch (e) {
      var box = document.getElementById('import-result');
      box.classList.remove('hidden');
      box.style.background = '#ffebee';
      box.style.color = '#c62828';
      box.textContent = '✗ 导入出错：' + (e && e.message ? e.message : e);
      nameInput.disabled = false;
      nameInput.focus();
    }
  },

  // ===== 成绩排名表功能 =====
  scoreTable: null,

  async showScoreEditor(id) {
    var t = await window.electronAPI.getTable(id);
    if (!t) { alert('成绩表不存在'); return; }
    this.scoreTable = t;
    this.renderScoreEditor();
    this.showSection('score-editor');
  },

  onScoreTableName(val) {
    if (this.scoreTable) {
      this.scoreTable.name = val;
      var title = document.getElementById('header-title');
      if (title) title.textContent = '🏆 ' + (val || '成绩排名表');
    }
  },

  // 分数解析：空/非数字按 0 处理
  _scoreNum(v) {
    if (v === null || v === undefined || String(v).trim() === '') return 0;
    var n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  },

  _fmtNum(n) {
    var r = Math.round(n * 100) / 100;
    return String(r);
  },

  _rowTotal(row) {
    var self = this;
    return (row.scores || []).reduce(function (a, v) { return a + self._scoreNum(v); }, 0);
  },

  // 该行是否已有有效数据（有姓名或任一科分数）；空行不参与排名，沉底
  _rowActive(row) {
    if (row.name && String(row.name).trim() !== '') return true;
    return (row.scores || []).some(function (v) { return v !== null && v !== undefined && String(v).trim() !== ''; });
  },


  async importNamesToTable() {
    if (this.tablesLocked && !this.creatorMode) { alert('表格已被创作者锁定，无法修改。'); return; }
    const t = this.editingTable;
    if (!t) { alert('请先打开量化表'); return; }
    try {
      const res = await window.electronAPI.importNames();
      if (!res.success) { alert(res.error || '导入失败'); return; }
      const names = res.names || [];
      if (!names.length) { alert('未识别到姓名'); return; }
      // 询问替换还是追加
      const hasNames = t.rows.some(r => r.name && String(r.name).trim() !== '');
      let mode = 'replace';
      if (hasNames) {
        const choice = await this.showPrompt('已有姓名数据，选择操作方式：\n输入 1 = 替换全部姓名\n输入 2 = 追加到末尾', '1');
        if (choice === null) return;
        if (choice.trim() === '2') mode = 'append';
      }
      this.collectTableData();
      const result = await window.electronAPI.applyNamesToTable({ tableId: t.id, names, mode });
      if (result.success) {
        this.recomputeTable(result.table);
        await window.electronAPI.updateTable(result.table);
        this.editingTable = result.table;
        this.renderEditor();
        alert('导入成功！共导入 ' + names.length + ' 个姓名' + (mode === 'append' ? '（追加模式）' : '（替换模式）'));
      } else {
        alert('导入失败：' + (result.error || '未知错误'));
      }
    } catch (e) {
      alert('导入出错：' + (e && e.message ? e.message : e));
    }
  },

  async importNamesToScoreTable() {
    var t = this.scoreTable;
    if (!t) { alert('请先打开成绩表'); return; }
    try {
      var res = await window.electronAPI.importScores({});
      if (!res.success) { alert(res.error || '导入失败'); return; }
      var list = res.list || [];
      if (!list.length) { alert('成绩表为空'); return; }
      // 提取姓名
      var names = [];
      for (var i = 0; i < list.length; i++) {
        var nm = String(list[i].name || '').trim();
        if (nm) names.push(nm);
      }
      if (!names.length) { alert('未识别到姓名'); return; }
      // 询问替换还是追加
      var hasNames = t.score_rows.some(function (r) { return r.name && String(r.name).trim() !== ''; });
      var mode = 'replace';
      if (hasNames) {
        var choice = await this.showPrompt('已有姓名数据，选择操作方式：\n输入 1 = 替换全部姓名\n输入 2 = 追加到末尾', '1');
        if (choice === null) return;
        choice = choice.trim();
        if (choice === '2') mode = 'append';
      }
      var subjCount = (t.subjects || []).length;
      if (mode === 'replace') {
        // 替换：先清空所有姓名
        t.score_rows.forEach(function (r) { r.name = ''; });
        // 确保行数足够
        while (t.score_rows.length < names.length) {
          t.score_rows.push({
            uid: 'r' + Date.now().toString(36) + '_' + t.score_rows.length + '_' + Math.random().toString(36).slice(2, 7),
            name: '',
            scores: new Array(subjCount).fill('')
          });
        }
        // 填入姓名
        for (var k = 0; k < names.length; k++) {
          t.score_rows[k].name = names[k];
        }
        t.total_people = Math.max(t.total_people || 0, names.length);
      } else {
        // 追加
        var startIdx = t.score_rows.length;
        for (var m = 0; m < names.length; m++) {
          t.score_rows.push({
            uid: 'r' + Date.now().toString(36) + '_' + (startIdx + m) + '_' + Math.random().toString(36).slice(2, 7),
            name: names[m],
            scores: new Array(subjCount).fill('')
          });
        }
        t.total_people = (t.total_people || 0) + names.length;
      }
      this.renderScoreEditor();
      alert('导入成功！共导入 ' + names.length + ' 个姓名' + (mode === 'append' ? '（追加模式）' : '（替换模式）'));
    } catch (e) {
      alert('导入出错：' + (e && e.message ? e.message : e));
    }
  },
  renderScoreEditor() {
    var t = this.scoreTable;
    if (!t) return;
    if (!Array.isArray(t.subjects)) t.subjects = [];
    if (!Array.isArray(t.score_rows)) t.score_rows = [];
    var self = this;

    document.getElementById('score-table-name').value = t.name || '';

    // 表头
    var head = document.getElementById('score-editor-head');
    head.innerHTML = '';
    var thRank = document.createElement('th'); thRank.textContent = '名次'; head.appendChild(thRank);
    var thName = document.createElement('th'); thName.textContent = '姓名'; head.appendChild(thName);
    t.subjects.forEach(function (sub, ci) {
      var th = document.createElement('th');
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.value = sub;
      inp.className = 'score-subject-input';
      inp.setAttribute('aria-label', '科目' + (ci + 1) + '名称');
      inp.oninput = function () { t.subjects[ci] = this.value; };
      th.appendChild(inp);
      head.appendChild(th);
    });
    var thTotal = document.createElement('th'); thTotal.textContent = '总分'; head.appendChild(thTotal);

    // 表体：按当前数据先排序后渲染
    var body = document.getElementById('score-editor-body');
    body.innerHTML = '';
    var ordered = this._orderedScoreRows();
    ordered.forEach(function (row, idx) {
      body.appendChild(self._buildScoreRow(row, idx));
    });
    this._refreshScoreRanks();
  },

  // 返回按总分降序的行数组：有数据的在前（同分保持数组原序，稳定排序），空行沉底
  _orderedScoreRows() {
    var t = this.scoreTable;
    var active = [], empty = [];
    t.score_rows.forEach(function (r) { (this._rowActive(r) ? active : empty).push(r); }, this);
    var totals = {};
    active.forEach(function (r) { totals[r.uid] = this._rowTotal(r); }, this);
    active.sort(function (a, b) { return totals[b.uid] - totals[a.uid]; });
    return active.concat(empty);
  },

  _buildScoreRow(row, idx) {
    var self = this, t = this.scoreTable;
    var tr = document.createElement('tr');
    tr.dataset.uid = row.uid;

    var tdRank = document.createElement('td');
    tdRank.className = 'score-rank-cell';
    var rankSpan = document.createElement('span');
    rankSpan.className = 'score-rank';
    tdRank.appendChild(rankSpan);
    tr.appendChild(tdRank);

    var tdName = document.createElement('td');
    var nameInp = document.createElement('input');
    nameInp.type = 'text';
    nameInp.className = 'cell-input score-name-input';
    nameInp.value = row.name || '';
    nameInp.dataset.uid = row.uid;
    nameInp.dataset.field = 'name';
    nameInp.oninput = function () {
      row.name = this.value;
      // 输入过程中只实时刷新总分/名次，不移动行（移动会让正在输入的格子跳走，像"失焦"）
      self._liveRefreshScoreRows();
    };
    nameInp.onblur = function () { self._reorderScoreRowsDeferred(); };
    tdName.appendChild(nameInp);
    tr.appendChild(tdName);

    (row.scores || []).forEach(function (v, ci) {
      var td = document.createElement('td');
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'cell-input score-cell-input';
      inp.value = (v === null || v === undefined) ? '' : v;
      inp.dataset.uid = row.uid;
      inp.dataset.field = 'score';
      inp.dataset.col = String(ci);
      inp.oninput = function () {
        var col = parseInt(this.dataset.col, 10);
        row.scores[col] = this.value;
        // 输入过程中：只更新本行总分与全部名次，不重排行位置，保证连续输入不跳焦
        var totalEl = tr.querySelector('.score-total');
        if (totalEl) totalEl.textContent = self._fmtNum(self._rowTotal(row));
        self._refreshScoreRanks();
      };
      inp.onblur = function () { self._reorderScoreRowsDeferred(); };
      td.appendChild(inp);
      tr.appendChild(td);
    });

    var tdTotal = document.createElement('td');
    tdTotal.className = 'score-total-cell';
    var totalSpan = document.createElement('span');
    totalSpan.className = 'score-total';
    totalSpan.textContent = self._fmtNum(self._rowTotal(row));
    tdTotal.appendChild(totalSpan);
    tr.appendChild(tdTotal);

    return tr;
  },

  // 输入过程中的轻量刷新：只更新所有行的总分文字与名次徽标，绝不移动 <tr>（焦点/光标不受影响）
  _liveRefreshScoreRows() {
    var body = document.getElementById('score-editor-body');
    if (!body) return;
    var self = this;
    var trs = Array.prototype.slice.call(body.querySelectorAll('tr'));
    var ranks = this._computeScoreRanks(this._orderedScoreRows());
    trs.forEach(function (tr) {
      var row = null;
      var rows = self.scoreTable.score_rows;
      for (var i = 0; i < rows.length; i++) { if (rows[i].uid === tr.dataset.uid) { row = rows[i]; break; } }
      if (!row) return;
      var totalEl = tr.querySelector('.score-total');
      if (totalEl) totalEl.textContent = self._fmtNum(self._rowTotal(row));
      var rankEl = tr.querySelector('.score-rank');
      if (rankEl) {
        var v = ranks[row.uid];
        rankEl.textContent = (v === undefined || v === '') ? '' : String(v);
      }
    });
  },

  // 离开输入格后再重排：延迟到本轮点击/聚焦完成之后执行，
  // 这样被点击的格子先获得焦点，随后随其所在 <tr> 一起移动，焦点不丢
  _reorderScoreRowsDeferred() {
    var self = this;
    if (this._scoreReorderTimer) clearTimeout(this._scoreReorderTimer);
    this._scoreReorderTimer = setTimeout(function () {
      self._scoreReorderTimer = null;
      var body = document.getElementById('score-editor-body');
      if (body) self._reorderScoreRows();
    }, 0);
  },

  // 按最新数据重排已有 <tr>（不重建输入框，保持编辑焦点），并刷新名次与总分
  _reorderScoreRows() {
    var body = document.getElementById('score-editor-body');
    if (!body) return;
    var trMap = {};
    Array.prototype.forEach.call(body.querySelectorAll('tr'), function (tr) { trMap[tr.dataset.uid] = tr; });
    var ordered = this._orderedScoreRows();
    var self = this;
    ordered.forEach(function (row) {
      var tr = trMap[row.uid];
      if (tr) {
        var totalEl = tr.querySelector('.score-total');
        if (totalEl) totalEl.textContent = self._fmtNum(self._rowTotal(row));
        body.appendChild(tr); // appendChild 移动已存在节点，焦点与光标保留
      }
    });
    this._refreshScoreRanks();
  },

  // 纯函数：给定排序后的行数组，计算每个 uid 的名次（同分同名次，密集排名 1,1,2；空行名次为 ''）
  _computeScoreRanks(orderedRows) {
    // 同分同名次；密集排名 1,1,2：并列后下一名次连续
    var ranks = {}, rank = 0, lastTotal = null;
    var self = this;
    orderedRows.forEach(function (row) {
      if (!self._rowActive(row)) { ranks[row.uid] = ''; return; }
      var tot = self._rowTotal(row);
      if (tot !== lastTotal) { rank++; lastTotal = tot; }
      ranks[row.uid] = rank;
    });
    return ranks;
  },

  // 刷新名次列：同分同名次（密集排名 1,1,2）；空行不显示名次
  _refreshScoreRanks() {
    var body = document.getElementById('score-editor-body');
    if (!body) return;
    var trs = Array.prototype.slice.call(body.querySelectorAll('tr'));
    var ranks = this._computeScoreRanks(this._orderedScoreRows());
    trs.forEach(function (tr) {
      var span = tr.querySelector('.score-rank');
      if (!span) return;
      var v = ranks[tr.dataset.uid];
      span.textContent = (v === undefined || v === '') ? '' : String(v);
    });
  },

  async saveScoreTable(silent) {
    if (!this.scoreTable) return false;
    try {
      await window.electronAPI.updateTable(this.scoreTable);
      if (!silent) {
        await window.electronAPI.confirmBox({ title: '保存成功', message: '成绩排名表已保存。', buttons: ['确定'] });
      }
      return true;
    } catch (e) {
      alert('保存失败：' + (e && e.message ? e.message : e));
      return false;
    }
  },

  async printScoreTable() {
    if (!this.scoreTable) return;
    var ok = await this.saveScoreTable(true);
    if (ok) window.electronAPI.printTable(this.scoreTable);
  },

  async doneScoreTable() {
    if (!this.scoreTable) return;
    await this.saveScoreTable(true);
    this.manageFilter = 'score';
    this.updateManageTabStyle();
    this.showManageTables();
  },



  // 通用输入弹窗（替代 Electron 不支持的 window.prompt）
  showPrompt(message, defaultValue) {
    return new Promise(function (resolve) {
      var old = document.getElementById('prompt-modal');
      if (old) old.remove();
      var mask = document.createElement('div');
      mask.id = 'prompt-modal';
      mask.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;';
      var box = document.createElement('div');
      box.style.cssText = 'background:#fff;padding:22px 26px;border-radius:12px;min-width:360px;max-width:90vw;box-shadow:0 8px 40px rgba(0,0,0,.3);';
      var msg = document.createElement('p');
      msg.style.cssText = 'margin:0 0 12px;color:#1b1b1b;font-size:14px;line-height:1.6;white-space:pre-line;';
      msg.textContent = message || '';
      box.appendChild(msg);
      var input = document.createElement('input');
      input.type = 'text';
      input.value = defaultValue || '';
      input.style.cssText = 'width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box;margin-bottom:14px;font-size:14px;';
      box.appendChild(input);
      var btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
      var cancelBtn = document.createElement('button');
      cancelBtn.textContent = '取消';
      cancelBtn.style.cssText = 'padding:7px 18px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;font-size:13px;';
      cancelBtn.onclick = function () { mask.remove(); resolve(null); };
      var okBtn = document.createElement('button');
      okBtn.textContent = '确定';
      okBtn.style.cssText = 'padding:7px 18px;border:none;border-radius:6px;background:#0f6cbd;color:#fff;cursor:pointer;font-size:13px;';
      okBtn.onclick = function () { mask.remove(); resolve(input.value); };
      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(okBtn);
      box.appendChild(btnRow);
      mask.appendChild(box);
      document.body.appendChild(mask);
      setTimeout(function () { input.focus(); input.select(); }, 50);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { mask.remove(); resolve(input.value); }
        if (e.key === 'Escape') { mask.remove(); resolve(null); }
      });
    });
  },
  // 班级段位测试版提示弹窗（Fluent 风格，可立即关闭）
  showRankBetaNotice() {
    if (this._rankBetaShown) return;
    this._rankBetaShown = true;
    var overlay = document.createElement('div');
    overlay.className = 'fluent-dialog-overlay';
    var box = document.createElement('div');
    box.className = 'fluent-dialog';
    box.innerHTML = '<div class="fluent-dialog-icon">🏅</div>' +
      '<h2 class="fluent-dialog-title">班级段位 · 测试版</h2>' +
      '<p class="fluent-dialog-text">班级段位功能目前处于测试阶段，可能存在一些 bug 或不稳定的地方。</p>' +
      '<p class="fluent-dialog-text">如果使用中发现任何问题，欢迎及时反馈，帮助我们不断完善 🙏</p>' +
      '<button type="button" class="fluent-dialog-primary" id="rank-beta-close">我知道了</button>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    var close = function () {
      document.removeEventListener('keydown', onKey);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    document.getElementById('rank-beta-close').onclick = close;
  },

  // ===== 班级段位系统 =====  rankData: { students: [], exams: [] },

  async showRankSystem() {
    this.showSection('rank-system');
    try {
      this.rankData = await window.electronAPI.rankGet();
    } catch (e) {
      this.rankData = { students: [], exams: [] };
    }
    this.renderRankBoard();
  },

  backFromRankSystem() {
    this.goBack();
  },

  renderRankBoard() {
    var board = document.getElementById('rank-board');
    var empty = document.getElementById('rank-empty');
    var countEl = document.getElementById('rank-student-count');
    if (!board) return;
    var students = (this.rankData.students || []).slice();
    countEl.textContent = students.length;
    if (students.length === 0) {
      if (empty) empty.style.display = 'block';
      board.innerHTML = '';
      return;
    }
    if (empty) empty.style.display = 'none';
    // 按累计星数降序排列
    students.sort(function (a, b) { return (b.totalStars || 0) - (a.totalStars || 0); });
    var html = '<table class="rank-table"><thead><tr>' +
      '<th style="width:50px;">名次</th>' +
      '<th>姓名</th>' +
      '<th>当前段位</th>' +
      '<th style="width:80px;text-align:center;">累计星数</th>' +
      '<th style="width:120px;text-align:center;">操作</th>' +
      '</tr></thead><tbody>';
    for (var i = 0; i < students.length; i++) {
      var s = students[i];
      var stars = s.totalStars || 0;
      // 并列名次：与前一名星数相同则同名次
      var place = (i > 0 && (students[i - 1].totalStars || 0) === stars) ? place : (i + 1);
      var rankMajor = s.rankMajor !== undefined ? s.rankMajor : 0;
      var starsHtml = '';
      var showStars = s.rankStars || 0;
      for (var k = 0; k < 5; k++) {
        starsHtml += k < showStars ? '<span class="rank-star on">★</span>' : '<span class="rank-star off">★</span>';
      }
      var starColor = stars > 0 ? '#2e7d32' : (stars < 0 ? '#c62828' : '#999');
      html += '<tr>' +
        '<td style="text-align:center;font-weight:bold;">' + place + '</td>' +
        '<td>' + escapeHtml(s.name) + '</td>' +
        '<td><span class="rank-badge rank-' + rankMajor + '">' + escapeHtml(s.rankDisplay || '无段位') + '</span><div class="rank-stars-row">' + starsHtml + '</div></td>' +
        '<td style="text-align:center;font-weight:bold;color:' + starColor + ';">' + (stars > 0 ? '+' + stars : stars) + '</td>' +
        '<td style="text-align:center;white-space:nowrap;"><button class="btn btn-sm" style="padding:4px 8px;font-size:12px;background:#607d8b;color:#fff;border:none;margin-right:4px;" onclick="app.rankRenameStudent(\'' + s.id + '\')">改名</button><button class="btn btn-danger btn-sm" style="padding:4px 8px;font-size:12px;" onclick="app.rankRemoveStudent(\'' + s.id + '\')">删除</button></td>' +
        '</tr>';
    }
    html += '</tbody></table>';
    board.innerHTML = html;
  },

  async rankShowAddStudent() {
    var name = await this.showPrompt('请输入学生姓名：', '');
    if (name === null) return;
    name = name.trim();
    if (!name) { alert('姓名不能为空'); return; }
    if (this.rankData.students.some(function (s) { return s.name === name; })) {
      alert('该学生已存在'); return;
    }
    var stu = {
      id: 'stu_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name,
      totalStars: 0
    };
    this.rankData.students.push(stu);
    this._rankSave();
  },

  async rankRenameStudent(id) {
    var stu = this.rankData.students.find(function (s) { return s.id === id; });
    if (!stu) return;
    var name = await this.showPrompt('修改学生姓名：', stu.name);
    if (name === null) return;
    name = name.trim();
    if (!name) { alert('姓名不能为空'); return; }
    if (name !== stu.name && this.rankData.students.some(function (s) { return s.name === name; })) {
      alert('该学生已存在'); return;
    }
    stu.name = name;
    await this._rankSave();
  },

  async rankRemoveStudent(id) {
    if (!confirm('确定删除该学生？其所有考试成绩也将被删除。')) return;
    this.rankData.students = this.rankData.students.filter(function (s) { return s.id !== id; });
    // 同时从各考试成绩中移除
    this.rankData.exams.forEach(function (e) { delete e.scores[id]; });
    await this._rankSave();
  },

  async rankShowAddExam() {
    var students = this.rankData.students || [];
    if (students.length === 0) { alert('请先添加学生'); return; }
    var now = new Date();
    var defaultName = '第' + (this.rankData.exams.length + 1) + '次考试';
    var name = await this.showPrompt('请输入考试名称：', defaultName);
    if (name === null) return;
    name = name.trim();
    if (!name) { alert('考试名称不能为空'); return; }
    var todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    var dateStr = await this.showPrompt('请输入考试日期（YYYY-MM-DD）：', todayStr);
    if (dateStr === null) return;
    dateStr = dateStr.trim();
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) { alert('日期格式不正确，应为 YYYY-MM-DD'); return; }
    var dp = dateStr.split('-');
    dateStr = dp[0] + '-' + dp[1].padStart(2, '0') + '-' + dp[2].padStart(2, '0');
    // 弹出输入框逐人录入成绩
    var scores = {};
    var ok = true;
    for (var i = 0; i < students.length; i++) {
      var v = await this.showPrompt('请输入 ' + students[i].name + ' 的成绩（留空表示该生本次缺考）：', '');
      if (v === null) { ok = false; break; }
      v = v.trim();
      if (v !== '') {
        var num = parseFloat(v);
        if (isNaN(num)) { alert('成绩必须是数字'); ok = false; break; }
        scores[students[i].id] = num;
      }
    }
    if (!ok) return;
    var exam = {
      id: 'exam_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name,
      date: dateStr,
      mode: 'score',
      scores: scores
    };
    this.rankData.exams.push(exam);
    this._rankSave();
  },


  async rankImportExam() {
    var self = this;
    try {
      var res = await window.electronAPI.importScores({});
      if (!res.success) { alert(res.error || '导入失败'); return; }
      var list = res.list || [];
      if (!list.length) { alert('成绩表为空'); return; }
      var isRankMode = res.mode === 'rank';
      if (res.hasScoreColumn === false) {
        alert('未能在成绩表中识别到成绩或排名列，请确认表中包含"总分"、"成绩"或"排名"列');
        return;
      }
      // 确认考试名称
      var defaultName = '第' + (this.rankData.exams.length + 1) + '次考试';
      var name = await this.showPrompt('请输入本次考试名称：', defaultName);
      if (name === null) return;
      name = name.trim();
      if (!name) { alert('考试名称不能为空'); return; }
      // 考试日期
      var now = new Date();
      var todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      var dateStr = await this.showPrompt('请输入考试日期（YYYY-MM-DD）：', todayStr);
      if (dateStr === null) return;
      dateStr = dateStr.trim();
      if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) { alert('日期格式不正确，应为 YYYY-MM-DD'); return; }
      var dp2 = dateStr.split('-');
      dateStr = dp2[0] + '-' + dp2[1].padStart(2, '0') + '-' + dp2[2].padStart(2, '0');
      if (isRankMode) {
        if (!confirm('检测到导入的是【排名】列（' + (res.sortColumn || '排名') + '）。\n排名模式下，排名每进步5名获得1星（第10名→第5名=+1星）。\n\n注意：排名卷与分数卷不要混用比较。\n\n是否继续？')) return;
      }
      // 自动补齐学生：成绩表中有但段位系统中没有的学生，自动添加
      var existingNames = {};
      this.rankData.students.forEach(function (s) { existingNames[s.name] = s; });
      var added = 0;
      list.forEach(function (item) {
        var nm = String(item.name || '').trim();
        if (!nm) return;
        if (!existingNames[nm]) {
          var stu = {
            id: 'stu_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '_' + added,
            name: nm,
            totalStars: 0
          };
          self.rankData.students.push(stu);
          existingNames[nm] = stu;
          added++;
        }
      });
      // 录入成绩
      var scores = {};
      var matched = 0;
      list.forEach(function (item) {
        var nm = String(item.name || '').trim();
        if (!nm) return;
        var stu = existingNames[nm];
        if (!stu) return;
        var v = item.value;
        if (v === undefined || v === null || v === '') return;
        var num = parseFloat(v);
        if (isNaN(num)) return;
        // 排名模式下 9999 是"无排名"占位，跳过
        if (isRankMode && num >= 9999) return;
        scores[stu.id] = num;
        matched++;
      });
      if (matched === 0) { alert('没有匹配到有效成绩'); return; }
      var exam = {
        id: 'exam_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: name,
        date: dateStr,
        mode: isRankMode ? 'rank' : 'score',
        scores: scores
      };
      this.rankData.exams.push(exam);
      await this._rankSave();
      alert('导入成功！本次录入 ' + matched + ' 人' + (isRankMode ? '排名' : '成绩') + (added > 0 ? '，自动添加 ' + added + ' 名学生' : ''));
    } catch (e) {
      alert('导入出错：' + (e && e.message ? e.message : e));
    }
  },
  async rankShowExamList() {
    var exams = (this.rankData.exams || []).slice();
    if (exams.length === 0) { alert('还没有考试记录'); return; }
    exams.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    var msg = '考试记录（共 ' + exams.length + ' 次）：\n\n';
    exams.forEach(function (e, i) {
      var cnt = Object.keys(e.scores).length;
      msg += (i + 1) + '. ' + e.name + '  (' + e.date + (e.mode === 'rank' ? '，排名' : '') + ')  录入 ' + cnt + ' 人\n';
    });
    msg += '\n输入序号删除对应考试（取消则不操作）：';
    var idx = await this.showPrompt(msg, '');
    if (idx === null) return;
    var n = parseInt(idx, 10);
    if (isNaN(n) || n < 1 || n > exams.length) { alert('序号无效'); return; }
    if (!confirm('确定删除考试「' + exams[n - 1].name + '」？删除后段位将重新计算。')) return;
    this.rankData.exams = this.rankData.exams.filter(function (e) { return e.id !== exams[n - 1].id; });
    this._rankSave();
  },

  rankPrint() {
    var students = (this.rankData.students || []).slice();
    if (students.length === 0) { alert('还没有学生，无法打印'); return; }
    students.sort(function (a, b) { return (b.totalStars || 0) - (a.totalStars || 0); });
    var rankNames = ['无段位','学习新锐','推断专家','理解大师','三班王牌','一中传说'];
    var html = '<html><head><meta charset="utf-8"><title>班级段位表</title><style>' +
      'body{font-family:"Microsoft YaHei",sans-serif;padding:30px;}' +
      'h2{text-align:center;margin-bottom:6px;}' +
      '.sub{text-align:center;color:#888;font-size:12px;margin-bottom:20px;}' +
      'table{width:100%;border-collapse:collapse;font-size:14px;}' +
      'th,td{border:1px solid #999;padding:8px 10px;text-align:center;}' +
      'th{background:#2c5f8d;color:#fff;}' +
      '.rank-badge{display:inline-block;padding:2px 10px;border-radius:10px;font-size:12px;}' +
      '.r0{background:#e0e0e0;color:#555;}.r1{background:#e3f2fd;color:#1565c0;}' +
      '.r2{background:#e8f5e9;color:#2e7d32;}.r3{background:#fff3e0;color:#e65100;}' +
      '.r4{background:#fce4ec;color:#c62828;}.r5{background:#f3e5f5;color:#6a1b9a;}' +
      '.star-on{color:#ffb300;}.star-off{color:#ddd;}' +
      '.pos{font-weight:bold;}.pos-g{color:#2e7d32;}.pos-r{color:#c62828;}' +
      '</style></head><body>' +
      '<h2>🏅 班级段位表</h2>' +
      '<div class="sub">每进步5分=1星，5星=1小段位，5小段位=1大段位 &nbsp;|&nbsp; 共 ' + students.length + ' 名学生</div>' +
      '<table><thead><tr><th style="width:60px;">名次</th><th>姓名</th><th>当前段位</th><th style="width:90px;">星数</th><th style="width:90px;">累计星数</th></tr></thead><tbody>';
    for (var i = 0; i < students.length; i++) {
      var s = students[i];
      var stars = s.totalStars || 0;
      var place = (i > 0 && (students[i - 1].totalStars || 0) === stars) ? place : (i + 1);
      var rankMajor = s.rankMajor !== undefined ? s.rankMajor : 0;
      var rankDisp = s.rankDisplay || '无段位';
      var showStars = s.rankStars || 0;
      var starsHtml = '';
      for (var k = 0; k < 5; k++) {
        starsHtml += k < showStars ? '<span class="star-on">★</span>' : '<span class="star-off">★</span>';
      }
      var starColor = stars > 0 ? 'pos-g' : (stars < 0 ? 'pos-r' : '');
      html += '<tr>' +
        '<td class="pos">' + place + '</td>' +
        '<td>' + escapeHtml(s.name) + '</td>' +
        '<td><span class="rank-badge r' + rankMajor + '">' + escapeHtml(rankDisp) + '</span></td>' +
        '<td>' + starsHtml + '</td>' +
        '<td class="' + starColor + '">' + (stars > 0 ? '+' + stars : stars) + '</td>' +
        '</tr>';
    }
    html += '</tbody></table></body></html>';
    var w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(function () { w.print(); }, 400);
  },

  async rankResetAll() {
    if (!confirm('确定重置全部段位数据？这将清空所有学生和考试记录，且不可恢复！')) return;
    if (!confirm('再次确认：真的要清空所有段位数据吗？')) return;
    try {
      this.rankData = await window.electronAPI.rankReset();
      this.renderRankBoard();
    } catch (e) {
      alert('重置失败：' + e.message);
    }
  },

  async _rankSave() {
    try {
      this.rankData = await window.electronAPI.rankSave(this.rankData);
      this.renderRankBoard();
    } catch (e) {
      alert('保存段位数据失败：' + e.message);
    }
  },


  // ===== 排座位功能 =====
  seatStudents: null,
  seatGrid: null,
  seatRows: 0,
  seatTotalCols: 0,
  seatAisleCols: [],
  seatSeatCols: [],
  seatSelected: null,
  seatThird: 0,
  _seatBound: false,

  showSeatArrangement() {
    var self = this;
    this.showSection('seat-page');
    if (!this._seatBound) {
      this._seatBound = true;
      document.getElementById('seat-import-btn').onclick = function () { self.importScoresForSeating(); };
      var seatRosterBtn = document.getElementById('seat-roster-btn');
      if (seatRosterBtn) seatRosterBtn.onclick = function () { self.importRosterForSeating(); };
      document.getElementById('seat-gen-btn').onclick = function () { self.generateSeating(); };
      document.getElementById('seat-print-btn').onclick = function () { self.printSeating(); };
      document.getElementById('seat-img-btn').onclick = function () { self.exportSeatingImage(); };
      document.getElementById('seat-save-btn').onclick = function () { self.saveSeatingAsTable(); };
    }
    var info = document.getElementById('seat-info');
    var err = document.getElementById('seat-error');
    err.textContent = '';
    if (this.seatStudents && this.seatStudents.length) {
      info.textContent = '已导入 ' + this.seatStudents.length + ' 人（按「' + (this.seatSortColumn || '成绩') + '」排序），点击「生成座位表」或「重新排」';
    } else {
      info.textContent = '请先导入成绩表';
    }
  },

  backFromSeatPage() {
    this.goBack();
  },

  async importScoresForSeating() {
    var info = document.getElementById('seat-info');
    var err = document.getElementById('seat-error');
    err.textContent = '';
    info.textContent = '正在导入...';
    try {
      var res = await window.electronAPI.importScores({});
      if (!res.success) { err.textContent = res.error || '导入失败'; info.textContent = '导入失败'; return; }
      var list = res.list;
      this.seatSortMode = res.mode || 'score';
      this.seatSortColumn = res.sortColumn || (this.seatSortMode === 'rank' ? '班级排名' : '总分');
      for (var k = 0; k < list.length; k++) list[k].score = list[k].value;
      if (this.seatSortMode === 'rank') {
        list.sort(function (a, b) { return a.value - b.value; });
      } else {
        list.sort(function (a, b) { return b.value - a.value; });
      }
      for (var i = 0; i < list.length; i++) list[i].rank = i + 1;
      this.seatStudents = list;
      this.seatGrid = null;
      this.renderSeatChart();
      if (this.seatSortMode === 'rank') {
        info.textContent = '已导入 ' + list.length + ' 人，按「' + this.seatSortColumn + '」排序，第1名 ' + list[0].name + '（' + list[0].value + '）';
      } else {
        info.textContent = '已导入 ' + list.length + ' 人，按「' + this.seatSortColumn + '」排序，最高 ' + list[0].value + '，最低 ' + list[list.length - 1].value;
      }
    } catch (e) {
      err.textContent = '导入出错：' + (e && e.message ? e.message : e);
      info.textContent = '导入失败';
    }
  },

  generateSeating() {
    var err = document.getElementById('seat-error');
    err.textContent = '';
    if (!this.seatStudents || this.seatStudents.length === 0) { err.textContent = '请先导入成绩表'; return; }
    var colsPerGroup = parseInt(document.getElementById('seat-cols').value, 10);
    if (isNaN(colsPerGroup) || colsPerGroup < 1) { err.textContent = '请输入有效的列数'; return; }
    var seatMode = 'random';
    try { seatMode = document.getElementById('seat-mode').value || 'random'; } catch(e) {}
    this.seatMode = seatMode;

    // 閲嶇疆鏃у骇浣嶅浘锛岀‘淇濇瘡娆＄偣鍑婚兘閲嶆柊鐢熸垚
    this.seatGrid = null;

    var students = this.seatStudents.slice().filter(function(s) { return s && s.name && String(s.name).trim(); });
    var n = students.length;
    if (n === 0) { err.textContent = '没有可排座的学生'; return; }

    var groups = 3;
    var seatsPerRow = groups * colsPerGroup;
    var rows = Math.ceil(n / seatsPerRow);
    if (rows < 1) rows = 1;
    var totalCols = groups * colsPerGroup + (groups - 1);
    var aisleCols = [];
    for (var g = 1; g < groups; g++) aisleCols.push(g * colsPerGroup + (g - 1));
    var seatCols = [];
    for (var c0 = 0; c0 < totalCols; c0++) {
      if (aisleCols.indexOf(c0) === -1) seatCols.push(c0);
    }

    var third = Math.ceil(n / 3);
    this.seatThird = third;

    // 段内错开：较好一半与较差一半交叉，再做随机微调（"重新排"每次结果不同）
    function stagger(arr) {
      var half = Math.ceil(arr.length / 2);
      var front = arr.slice(0, half);
      var back = arr.slice(half);
      var out = [];
      for (var i = 0; i < front.length; i++) {
        out.push(front[i]);
        if (back[i]) out.push(back[i]);
      }
      return out;
    }
    function jitter(arr, p) {
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        if (Math.random() < p) {
          var j = Math.floor(Math.random() * (i + 1));
          var t = a[i]; a[i] = a[j]; a[j] = t;
        }
      }
      return a;
    }
    function mix(arr) { return jitter(stagger(arr), 0.35); }

    // 等间距取样（让"中下等"与"差一点"的学生混合坐第一排）
    function pickEvenly(arr, count) {
      if (arr.length <= count) return arr.slice();
      var out = [];
      for (var k2 = 0; k2 < count; k2++) {
        var idx = Math.floor((k2 + 0.5) * arr.length / count);
        out.push(arr[idx]);
      }
      return out;
    }

    var seatGrid = [];
    for (var r0 = 0; r0 < rows; r0++) seatGrid.push(new Array(totalCols).fill(null));

    // 每排座位的蛇形顺序，空位集中在最后一排最右侧
    var rowPositions = [];
    var assigned = 0;
    for (var rr = 0; rr < rows; rr++) {
      var isLast = (rr === rows - 1);
      var cnt = isLast ? (n - assigned) : Math.min(seatsPerRow, n - assigned);
      var cols = seatCols.slice(0, cnt);
      if (rr % 2 === 1) cols.reverse();
      rowPositions.push(cols);
      assigned += cnt;
    }

    function fillRowSeats(rowIdx, arr) {
      if (rowIdx < 0 || rowIdx >= rows) return;
      var cs = rowPositions[rowIdx];
      for (var k3 = 0; k3 < cs.length && arr.length > 0; k3++) {
        if (seatGrid[rowIdx][cs[k3]] === null) seatGrid[rowIdx][cs[k3]] = arr.shift();
      }
    }
    function fillEmptyBack(arr, maxRow) {
      var start = (maxRow === undefined) ? rows - 1 : maxRow;
      for (var rb = start; rb >= 0 && arr.length > 0; rb--) {
        var csb = rowPositions[rb].slice().reverse();
        for (var k4 = 0; k4 < csb.length && arr.length > 0; k4++) {
          if (seatGrid[rb][csb[k4]] === null) seatGrid[rb][csb[k4]] = arr.shift();
        }
      }
    }
    function fillEmptyFront(arr, maxRow) {
      var limit = (maxRow === undefined) ? rows - 1 : maxRow;
      for (var rf = 0; rf <= limit && arr.length > 0; rf++) {
        var csf = rowPositions[rf];
        for (var k5 = 0; k5 < csf.length && arr.length > 0; k5++) {
          if (seatGrid[rf][csf[k5]] === null) seatGrid[rf][csf[k5]] = arr.shift();
        }
      }
    }
    // 差生排口径（与分层一致）：第1排、末排、7排及以上时的倒数第2排
    function badRowAt(r) {
      return r === 0 || r === rows - 1 || (rows >= 7 && r === rows - 2);
    }
    // 从前向后补空位：先填非差生排（前排→后排），仍有剩余才允许填差生排。
    // 用于中等生/好学生溢出，避免他们一溢出就被补进第1排或末排差生位
    function fillFrontNonBadFirst(arr) {
      for (var pass = 0; pass < 2 && arr.length > 0; pass++) {
        var allowBad = (pass === 1);
        for (var rr2 = 0; rr2 < rows && arr.length > 0; rr2++) {
          if (badRowAt(rr2) !== allowBad) continue;
          var cs2 = rowPositions[rr2];
          for (var k6 = 0; k6 < cs2.length && arr.length > 0; k6++) {
            if (seatGrid[rr2][cs2[k6]] === null) seatGrid[rr2][cs2[k6]] = arr.shift();
          }
        }
      }
    }

    if (seatMode === 'random') {
      // 随机排：好学生和坏学生搭配（交替排列），再随机微调
      var hasRank = students.length > 0 && students[0].rank !== undefined;
      var gRand, bRand, mRand;
      if (hasRank) {
        gRand = shuffle(students.filter(function (s) { return s.rank <= third; }));
        bRand = shuffle(students.filter(function (s) { return s.rank > n - third; }));
        mRand = shuffle(students.filter(function (s) { return s.rank > third && s.rank <= n - third; }));
      } else {
        // 没有成绩数据时，完全随机分三组
        var shuffled = shuffle(students.slice());
        var t = Math.ceil(shuffled.length / 3);
        gRand = shuffled.slice(0, t);
        mRand = shuffled.slice(t, t * 2);
        bRand = shuffled.slice(t * 2);
      }
      var randList = [];
      var gi = 0, bi = 0, mi = 0;
      // 好-差-中 交替，确保好差生搭配
      while (gi < gRand.length || bi < bRand.length || mi < mRand.length) {
        if (gi < gRand.length) randList.push(gRand[gi++]);
        if (bi < bRand.length) randList.push(bRand[bi++]);
        if (mi < mRand.length) randList.push(mRand[mi++]);
      }
      // 大幅随机微调，让排列更随机
      randList = jitter(randList, 0.4);
      for (var rr2 = 0; rr2 < rows && randList.length > 0; rr2++) {
        fillRowSeats(rr2, randList);
      }
    } else if (rows === 1) {
      fillRowSeats(0, mix(students.slice()));
    } else {
      // ── 成绩分层（教师指定规则）──
      // 第3-5排：好学生（前1/3）
      // 第2排、第6排：中等生（中1/3）
      // 第1排、倒数第2排（7排及以上时）、最后一排：差生（后1/3）
      var excellentAll = mix(students.filter(function (s) { return s.rank <= third; }));
      var backwardAll  = mix(students.filter(function (s) { return s.rank > n - third; }));
      var middleAll    = mix(students.filter(function (s) { return s.rank > third && s.rank <= n - third; }));

      var tierGood = [], tierMid = [], tierBad = [];
      for (var tr = 0; tr < rows; tr++) {
        if (tr === 0 || tr === rows - 1) tierBad.push(tr);
        else if (tr === rows - 2 && rows >= 7) tierBad.push(tr);
        else if (tr === 1) tierMid.push(tr);
        else if (tr === 5 && rows >= 7) tierMid.push(tr);
        else if (tr >= 2 && tr <= 4) tierGood.push(tr);
        else tierMid.push(tr); // 极特殊排数兜底
      }

      var exQ = excellentAll.slice();
      var mdQ = middleAll.slice();
      var bkQ = backwardAll.slice();
      tierGood.forEach(function (r) { fillRowSeats(r, exQ); });
      tierMid.forEach(function (r) { fillRowSeats(r, mdQ); });
      tierBad.forEach(function (r) { fillRowSeats(r, bkQ); });

      // 各层人数与座位数不完全相等时（物理必然），按"就近层级"补空位：
      // 剩余差生从最后一排向前补；剩余中等生/好学生先补非差生排（从前排起），
      // 实在坐不下才允许进差生排。enforceRowTiers 会再把差生排尽量修正回差生。
      fillEmptyBack(bkQ);
      fillFrontNonBadFirst(mdQ);
      fillFrontNonBadFirst(exQ);
    }

    this.seatGrid = seatGrid;
    this.seatRows = rows;
    this.seatTotalCols = totalCols;
    this.seatAisleCols = aisleCols;
    this.seatSeatCols = seatCols;
    this.seatSelected = null;

    // 固定座位调整规则
    this.applySeatRules();

    if (seatMode === 'random') {
      // 随机排模式：不执行成绩分层强制，只处理邻接冲突
      if (this.resolveAdjacency) this.resolveAdjacency();
    } else {
      // 分层强制：差生排（第1排/倒2排/末排）落入非差生时，与非差生排中的差生互换
      this.enforceRowTiers();

      // enforce swaps may create new adjacency conflicts -> resolve once more at the very end
      if (this.resolveAdjacency) this.resolveAdjacency();

      // 所有固定规则、邻接调整都完成后，再做一次分层兜底：
      // 防止锚定换座/邻接交换把好学生留在差生排（第1排、末排、倒2排）
      this.finalEnforceRowTiers();
      if (this.resolveAdjacency) this.resolveAdjacency();

      // 好学生归区：锚定中等生(王刘赵/戎毓梅等)按教师规则坐进第3-5排时，可能把好学生
      // 挤到第2/6排；差生排兜底只管差生排，这里统一把好学生拉回第3-5排，
      // 随后再做一次邻接保护（同层级交换，不会再把好学生送出好学生区）
      this.enforceGoodRows();
      if (this.resolveAdjacency) this.resolveAdjacency();
    }

    // 空位归位：把最后一排的非锚定学生移到中间同组空位，空位只留最后一排
    (function () {
      var anchoredNames = ['王大玮','白天祯','贺国贤','张雨涵','赵淑萍','刘雯秀','张雅雯','戎毓梅','戎玉梅','杨悦','王治柬','王治東','钱梦娇','刘浩','陈艺菡','杨嘉瑞'];
      function colGroupOfL(c) {
        for (var g = 0; g < groups; g++) {
          var s = g * (colsPerGroup + 1);
          if (c >= s && c < s + colsPerGroup) return g;
        }
        return -1;
      }
      function badRowL(r) {
        return r === 0 || r === lastRow || (rows >= 7 && r === rows - 2);
      }
      var lastRow = rows - 1;
      var moved = true;
      while (moved) {
        moved = false;
        for (var lc = 0; lc < totalCols && !moved; lc++) {
          if (aisleCols.indexOf(lc) !== -1) continue;
          var ls = seatGrid[lastRow][lc];
          if (!ls) continue;
          if (anchoredNames.indexOf(ls.name) !== -1) continue; // 锚定学生不动
          var grp = colGroupOfL(lc);
          var target = null;
          for (var er = 1; er < lastRow && !target; er++) {
            if (badRowL(er)) continue;
            for (var ec = 0; ec < totalCols; ec++) {
              if (aisleCols.indexOf(ec) !== -1) continue;
              if (colGroupOfL(ec) === grp && !seatGrid[er][ec]) { target = { r: er, c: ec }; break; }
            }
          }
          if (target) {
            seatGrid[target.r][target.c] = ls;
            seatGrid[lastRow][lc] = null;
            moved = true;
          }
        }
      }
    })();

    this.renderSeatChart();

    var info = document.getElementById('seat-info');
    var emptySeats = rows * seatsPerRow - n;
    var modeTxt = (seatMode === 'random') ? '随机排座' : '按成绩分层排座（3-5排好学生、2/6排中等生、首尾排差生）';
    var tip = '已生成座位表（' + modeTxt + '，' + rows + ' 行，' + groups + '组×' + colsPerGroup + '列，共' + n + '人，含走道）';
    if (emptySeats > 0) tip += '；最后一排右侧空 ' + emptySeats + ' 位';
    info.textContent = tip;
  },

  // 分层强制：差生排 = 第1排、倒数第2排（7排及以上）、最后一排。
  // 固定座位规则的锚定学生不动；其余非差生若落在差生排，
  // 与非差生排中"同列组优先、距离最近"的差生互换。
  enforceRowTiers() {
    var grid = this.seatGrid, rows = this.seatRows;
    if (!grid || !this.seatStudents || rows < 2) return;
    var n = this.seatStudents.length;
    var t = this.seatThird || Math.ceil(n / 3);
    var ANCH = ['王大玮','白天祯','贺国贤','张雨涵','赵淑萍','刘雯秀','张雅雯','戎毓梅','戎玉梅'];
    function isAnchorNm(nm){ return ANCH.indexOf(nm) !== -1; }
    function isBackward(s){ return s && s.rank > n - t; }

    var badRows = {};
    badRows[0] = true;
    badRows[rows - 1] = true;
    if (rows >= 7) badRows[rows - 2] = true;

    for (var br in badRows) {
      var r1 = +br;
      for (var c1 = 0; c1 < grid[r1].length; c1++) {
        var s1 = grid[r1][c1];
        if (!s1 || isBackward(s1) || isAnchorNm(s1.name)) continue;
        // 找非差生排中的差生互换：同列组优先，行距离最近
        var best = null, bestScore = Infinity;
        for (var r2 = 0; r2 < rows; r2++) {
          if (badRows[r2]) continue;
          for (var c2 = 0; c2 < grid[r2].length; c2++) {
            var s2 = grid[r2][c2];
            if (!s2 || !isBackward(s2) || isAnchorNm(s2.name)) continue;
            var score = Math.abs(r2 - r1) * 4 + Math.abs(c2 - c1);
            if (score < bestScore) { bestScore = score; best = { r: r2, c: c2 }; }
          }
        }
        if (best) {
          grid[r1][c1] = grid[best.r][best.c];
          grid[best.r][best.c] = s1;
        }
      }
    }
  },

  // 最终分层兜底：在全部锚定换座/邻接调整之后执行。
  // 规则：差生排（第1排、末排、7排及以上的倒2排；锚定学生固定位不动）里的非差生——
  //   1) 优先与非差生排中的差生互换（就近）；
  //   2) 若差生已全部坐在差生排、无处可换，则把好学生与非差生排中的中等生互换。
  // 结论：只要物理座位允许，好学生不会出现在差生排（第1排/第6排/末排）。
  finalEnforceRowTiers() {
    var grid = this.seatGrid, rows = this.seatRows;
    if (!grid || !this.seatStudents || rows < 3) return;
    var n = this.seatStudents.length;
    var t = this.seatThird || Math.ceil(n / 3);
    var ANCH = ['王大玮','白天祯','贺国贤','张雨涵','赵淑萍','刘雯秀','张雅雯','戎毓梅','戎玉梅'];
    function isAnchorNm(nm) { return ANCH.indexOf(nm) !== -1; }
    function tierOf(s) {
      if (!s) return -1;
      if (s.rank <= t) return 2;        // 好学生
      if (s.rank > n - t) return 0;     // 差生
      return 1;                         // 中等生
    }
    var badRows = {};
    badRows[0] = true;
    badRows[rows - 1] = true;
    if (rows >= 7) badRows[rows - 2] = true;
    var nonBadRows = [];
    for (var rr0 = 0; rr0 < rows; rr0++) { if (!badRows[rr0]) nonBadRows.push(rr0); }
    if (!nonBadRows.length) return;

    function findSwap(r1, c1, wantTier) {
      var best = null, bestScore = Infinity;
      for (var i2 = 0; i2 < nonBadRows.length; i2++) {
        var r2 = nonBadRows[i2];
        for (var c2 = 0; c2 < grid[r2].length; c2++) {
          var s2 = grid[r2][c2];
          if (!s2 || isAnchorNm(s2.name)) continue;
          if (tierOf(s2) !== wantTier) continue;
          // 同排数距离内优先换到中等排，减少对3-5排好学生区的扰动
          var dist = Math.abs(r2 - r1) * 4 + Math.abs(c2 - c1);
          if (dist < bestScore) { bestScore = dist; best = { r: r2, c: c2 }; }
        }
      }
      return best;
    }

    for (var br in badRows) {
      var r1 = +br;
      for (var c1 = 0; c1 < grid[r1].length; c1++) {
        var s1 = grid[r1][c1];
        if (!s1 || isAnchorNm(s1.name)) continue;
        var t1 = tierOf(s1);
        if (t1 === 0) continue; // 已是差生，合规
        var best = findSwap(r1, c1, 0);            // 先用差生顶替
        if (!best && t1 === 2) best = findSwap(r1, c1, 1); // 差生不够时用中等生顶替
        if (best) {
          grid[r1][c1] = grid[best.r][best.c];
          grid[best.r][best.c] = s1;
        }
      }
    }
  },

  // 终检归位：在所有锚定规则、邻接调整、差生排兜底全部完成后执行。
  // 1) 好学生(前1/3)必须在第3-5排(index2-4)：在区外的非锚定好学生，优先移入区内空位，
  //    否则与区内非好学生交换（要求交换后双方都回到自己应属层排）；
  // 2) 差生(后1/3)必须在差生排(第1/末/倒2排)：对称处理，空位优先、双赢交换次之；
  // 候选空位/座位均避开王大玮/刘雯秀/赵淑萍/杨悦的8邻，避免制造邻接冲突。
  // 物理容量确实不足（区内座位不够）时，找不到候选的学生保留原位。
  enforceGoodRows() {
    var grid = this.seatGrid, rows = this.seatRows;
    if (!grid || !this.seatStudents || rows < 3) return;
    var n = this.seatStudents.length;
    var t = this.seatThird || Math.ceil(n / 3);
    var aisleCols = this.seatAisleCols || [];
    var totalCols = this.seatTotalCols;
    var ANCH = ['王大玮','白天祯','贺国贤','张雨涵','赵淑萍','刘雯秀','戎毓梅','戎玉梅'];
    function isAnchorNm(nm) { return ANCH.indexOf(nm) !== -1; }
    function tierOf(s) {
      if (!s) return -1;
      if (s.rank <= t) return 2;
      if (s.rank > n - t) return 0;
      return 1;
    }
    var goodRows = [], midRows = [], badRows = [];
    for (var r0 = 0; r0 < rows; r0++) {
      var isBad = (r0 === 0 || r0 === rows - 1 || (rows >= 7 && r0 === rows - 2));
      if (isBad) { badRows.push(r0); continue; }
      if (r0 === 1 || (r0 === 5 && rows >= 7)) midRows.push(r0);
      else if (r0 >= 2 && r0 <= 4) goodRows.push(r0);
      else midRows.push(r0);
    }
    if (!goodRows.length) return;
    function isAisle(c) { return aisleCols.indexOf(c) !== -1; }
    function posOf(name) {
      for (var r = 0; r < rows; r++)
        for (var c = 0; c < totalCols; c++) {
          var s = grid[r][c];
          if (s && s.name === name) return { r: r, c: c };
        }
      return null;
    }
    var protectedNames = ['王大玮', '白天祯', '贺国贤'];
    var GUARD = ['王崇瑞', '张诗韵'];
    // 仅守卫生(王崇瑞/张诗韵)的目标位需要避开保护人8邻；其他学生不受邻接禁令限制
    function nearProtected(r, c, movingName) {
      if (GUARD.indexOf(movingName) === -1) return false;
      for (var i = 0; i < protectedNames.length; i++) {
        var p = posOf(protectedNames[i]);
        if (p && Math.abs(p.r - r) <= 1 && Math.abs(p.c - c) <= 1) return true;
      }
      return false;
    }
    // 在目标层排内找：空位优先，其次找与源排同层的学生做双赢交换（movingName 为守卫生时避开保护8邻）
    function findHome(r1, c1, homeRows, wantTier, movingName) {
      var bestEmpty = null, emptyScore = Infinity;
      var bestSwap = null, swapScore = Infinity;
      for (var gi = 0; gi < homeRows.length; gi++) {
        var r2 = homeRows[gi];
        for (var c2 = 0; c2 < totalCols; c2++) {
          if (isAisle(c2) || (r2 === r1 && c2 === c1)) continue;
          var d = Math.abs(r2 - r1) * 4 + Math.abs(c2 - c1);
          if (grid[r2][c2] === null) {
            if (nearProtected(r2, c2, movingName)) continue;
            if (d < emptyScore) { emptyScore = d; bestEmpty = { r: r2, c: c2, empty: true }; }
            continue;
          }
          var s2 = grid[r2][c2];
          if (isAnchorNm(s2.name) || tierOf(s2) !== wantTier) continue;
          if (nearProtected(r2, c2, movingName)) continue;
          // 双赢检查：s2 换到 (r1,c1) 后也必须回到自己应属层排
          if (tierOf(s2) !== rowTierOf(r1)) continue;
          if (d < swapScore) { swapScore = d; bestSwap = { r: r2, c: c2 }; }
        }
      }
      return bestEmpty || bestSwap || null;
    }
    function rowTierOf(r) {
      if (badRows.indexOf(r) !== -1) return 0;
      if (goodRows.indexOf(r) !== -1) return 2;
      return 1;
    }
    function moveHome(studentRows, homeRows, wantTier) {
      var movedAny = false;
      for (var oi = 0; oi < studentRows.length; oi++) {
        var rr = studentRows[oi];
        for (var cc = 0; cc < totalCols; cc++) {
          if (isAisle(cc)) continue;
          var G = grid[rr][cc];
          if (!G || isAnchorNm(G.name) || tierOf(G) !== wantTier) continue;
          var hit = findHome(rr, cc, homeRows, rowTierOf(rr), G.name);
          if (!hit) continue;
          if (hit.empty) { grid[hit.r][hit.c] = G; grid[rr][cc] = null; }
          else { var tmp = grid[hit.r][hit.c]; grid[hit.r][hit.c] = G; grid[rr][cc] = tmp; }
          movedAny = true;
        }
      }
      return movedAny;
    }
    // 先归置差生（会改变空位分布），再归置好学生；反复扫描直到稳定
    var pass = 0;
    while (pass++ < 6) {
      var m1 = moveHome(midRows.concat(goodRows), badRows, 0);
      var m2 = moveHome(badRows.concat(midRows), goodRows, 2);
      if (!m1 && !m2) break;
    }
  },

  // 座位微调规则（不显示在界面中）
  applySeatRules() {
    var grid = this.seatGrid;
    var rows = this.seatRows;
    var aisleCols = this.seatAisleCols;
    var seatCols = this.seatSeatCols;
    if (!grid || !rows || !aisleCols || !seatCols) return;
    var groups = aisleCols.length + 1;
    var colsPerGroup = Math.round(seatCols.length / groups);
    var totalCols = this.seatTotalCols;

    function colGroupOf(c) {
      for (var g = 0; g < groups; g++) {
        var s = g * (colsPerGroup + 1);
        if (c >= s && c < s + colsPerGroup) return g;
      }
      return -1;
    }
    function groupCols(g) {
      var s = g * (colsPerGroup + 1), o = [];
      for (var i = 0; i < colsPerGroup; i++) o.push(s + i);
      return o;
    }
    function isAisle(c) { return aisleCols.indexOf(c) !== -1; }
    function inB(r, c) { return r >= 0 && r < rows && c >= 0 && c < totalCols; }
    function pos(name) {
      for (var r = 0; r < rows; r++)
        for (var c = 0; c < totalCols; c++) {
          var s = grid[r][c];
          if (s && s.name === name) return { r: r, c: c };
        }
      return null;
    }
    function placeInto(name, tr, tc) {
      var p = pos(name); if (!p || !inB(tr, tc) || isAisle(tc)) return false;
      if (p.r === tr && p.c === tc) return true;
      var target = grid[tr][tc];
      // 如果目标位置是锚定学生，先把它移走（优先同组内，保持同组关系）
      if (target && isAnchorNm(target.name) && target.name !== name) {
        var tGroup = colGroupOf(tc), tCols = groupCols(tGroup), moved = false;
        for (var mr = 0; mr < rows && !moved; mr++) {
          for (var mci = 0; mci < tCols.length && !moved; mci++) {
            var mc = tCols[mci];
            if (mc === tc) continue;
            var ms = grid[mr][mc];
            if (!ms || (!isAnchorNm(ms.name) && ms.name !== name)) {
              grid[mr][mc] = target; grid[tr][tc] = null; moved = true;
            }
          }
        }
        if (!moved) {
          for (var mr2 = 0; mr2 < rows && !moved; mr2++) {
            for (var mc2 = 0; mc2 < totalCols && !moved; mc2++) {
              if (isAisle(mc2)) continue;
              var ms2 = grid[mr2][mc2];
              if (!ms2 || (!isAnchorNm(ms2.name) && ms2.name !== name)) {
                grid[mr2][mc2] = target; grid[tr][tc] = null; moved = true;
              }
            }
          }
        }
        if (!moved) return false;
      }
      var t = grid[p.r][p.c]; grid[p.r][p.c] = grid[tr][tc]; grid[tr][tc] = t;
      return true;
    }
    var anchorNames = ['王大玮','白天祯','贺国贤','张雨涵','赵淑萍','刘雯秀','张雅雯','戎毓梅','戎玉梅','杨悦','王治柬','王治東','钱梦娇','刘浩','陈艺菡','杨嘉瑞'];
    function isAnchorNm(nm) { return anchorNames.indexOf(nm) !== -1; }

    var targetGroup = Math.floor(Math.random() * groups);
    var tcols = groupCols(targetGroup);

    if (this.seatMode === 'random') {
      var ROW3 = Math.min(2, rows - 1);
      var ROW4 = Math.min(3, rows - 1);
      if (ROW3 < 0) ROW3 = 0;
      if (ROW4 <= ROW3) ROW4 = Math.min(rows - 1, ROW3 + 1);

      // 规则1：王大玮、白天祯、贺国贤 第3排同组
      var trio1 = shuffle(['王大玮', '白天祯', '贺国贤'].filter(function(n) { return pos(n); }));
      for (var i = 0; i < trio1.length && i < tcols.length; i++) {
        placeInto(trio1[i], ROW3, tcols[i]);
      }
      // 30%概率其中一人偏移一列（同组内）
      if (trio1.length > 1 && Math.random() < 0.3) {
        var shiftName = trio1[Math.floor(Math.random() * trio1.length)];
        var pShift = pos(shiftName);
        if (pShift) {
          var shiftCols = groupCols(colGroupOf(pShift.c)).filter(function(c) { return Math.abs(c - pShift.c) === 1 && !grid[pShift.r][c]; });
          if (shiftCols.length > 0) placeInto(shiftName, pShift.r, shiftCols[0]);
        }
      }

      // 规则2：张雨涵、赵淑萍、刘雯秀 第4排同组；赵刘70%同桌
      var trio2All = ['张雨涵', '赵淑萍', '刘雯秀'].filter(function(n) { return pos(n); });
      var hasZhao = trio2All.indexOf('赵淑萍') !== -1;
      var hasLiu = trio2All.indexOf('刘雯秀') !== -1;
      var trio2;
      if (hasZhao && hasLiu) {
        var zhaoLiu = shuffle(['赵淑萍', '刘雯秀']);
        if (Math.random() < 0.7) {
          trio2 = trio2All.length === 3 ? ['张雨涵'].concat(zhaoLiu) : zhaoLiu;
        } else {
          trio2 = trio2All.length === 3 ? [zhaoLiu[0], '张雨涵', zhaoLiu[1]] : zhaoLiu;
        }
      } else {
        trio2 = shuffle(trio2All);
      }
      for (var j = 0; j < trio2.length && j < tcols.length; j++) {
        if (trio2[j]) placeInto(trio2[j], ROW4, tcols[j]);
      }

      // 规则3：张雅雯 70%坐刘雯秀正后方，30%同组其他位置
      var pLiu = pos('刘雯秀');
      if (pLiu && pos('张雅雯')) {
        if (Math.random() < 0.7 && pLiu.r + 1 < rows) {
          placeInto('张雅雯', pLiu.r + 1, pLiu.c);
        } else {
          var liuGroup = colGroupOf(pLiu.c);
          var yaCols = groupCols(liuGroup);
          var yaRows = [];
          for (var yr = 0; yr < rows; yr++) yaRows.push(yr);
          shuffle(yaRows); shuffle(yaCols);
          var placed = false;
          // 优先空位
          for (var yi = 0; yi < yaRows.length && !placed; yi++) {
            for (var yc = 0; yc < yaCols.length && !placed; yc++) {
              if (!grid[yaRows[yi]][yaCols[yc]]) { placeInto('张雅雯', yaRows[yi], yaCols[yc]); placed = true; }
            }
          }
        }
      }

      // 锚定学生（不能被交换走）
      var anchored = ['王大玮','白天祯','贺国贤','张雨涵','赵淑萍','刘雯秀','张雅雯','戎毓梅','戎玉梅','杨悦','王治柬','王治東','钱梦娇','刘浩','陈艺菡','杨嘉瑞'];
      function isAnchored(nm) { return anchored.indexOf(nm) !== -1; }
      function findSpotInGroup(cols) {
        var empties = [], swappable = [];
        for (var fr = 0; fr < rows; fr++) {
          for (var fc = 0; fc < cols.length; fc++) {
            var cc = cols[fc];
            if (!grid[fr][cc]) empties.push({ r: fr, c: cc });
            else if (!isAnchored(grid[fr][cc].name)) swappable.push({ r: fr, c: cc });
          }
        }
        if (empties.length > 0) { shuffle(empties); return empties[0]; }
        if (swappable.length > 0) { shuffle(swappable); return swappable[0]; }
        return null;
      }

      // 规则4：钱梦娇、刘浩 跟 张雅雯 同组
      var pZhangYw = pos('张雅雯');
      if (pZhangYw) {
        var zhangGroup = colGroupOf(pZhangYw.c);
        var zcols3 = groupCols(zhangGroup);
        var qianLiu = ['钱梦娇', '刘浩'].filter(function (n) { return pos(n); });
        for (var qi3 = 0; qi3 < qianLiu.length; qi3++) {
          var spot3 = findSpotInGroup(zcols3);
          if (spot3) placeInto(qianLiu[qi3], spot3.r, spot3.c);
        }
      }

      // 规则5：杨嘉瑞跟陈艺菡同组，50%同桌，50%坐前面
      var pChenYh = pos('陈艺菡');
      if (pChenYh && pos('杨嘉瑞')) {
        var chenGroup = colGroupOf(pChenYh.c);
        var ccols5 = groupCols(chenGroup);
        var yangPlaced = false;
        if (Math.random() < 0.5) {
          // 50% 同桌
          var adjCols = ccols5.filter(function (c) { return Math.abs(c - pChenYh.c) === 1; });
          shuffle(adjCols);
          for (var ai = 0; ai < adjCols.length && !yangPlaced; ai++) {
            var tgt = grid[pChenYh.r][adjCols[ai]];
            if (!tgt || !isAnchored(tgt.name)) { placeInto('杨嘉瑞', pChenYh.r, adjCols[ai]); yangPlaced = true; }
          }
        } else {
          // 50% 正前方
          if (pChenYh.r - 1 >= 0) {
            var front = grid[pChenYh.r - 1][pChenYh.c];
            if (!front || !isAnchored(front.name)) { placeInto('杨嘉瑞', pChenYh.r - 1, pChenYh.c); yangPlaced = true; }
          }
        }
        if (!yangPlaced) {
          var spot5 = findSpotInGroup(ccols5);
          if (spot5) placeInto('杨嘉瑞', spot5.r, spot5.c);
        }
      }
    } else {
      // ===== 按成绩排模式 =====
      var ROW5 = Math.min(4, rows - 1);
      if (ROW5 < 0) ROW5 = Math.min(2, rows - 1);

      // 王大玮、白天祯 第5排同组，50%同桌，50%同排隔一位
      var wangBai = shuffle(['王大玮', '白天祯'].filter(function(n) { return pos(n); }));
      if (wangBai.length === 2) {
        if (Math.random() < 0.5) {
          placeInto(wangBai[0], ROW5, tcols[0]);
          if (tcols.length > 1) placeInto(wangBai[1], ROW5, tcols[1]);
        } else {
          placeInto(wangBai[0], ROW5, tcols[0]);
          if (tcols.length >= 3) placeInto(wangBai[1], ROW5, tcols[2]);
          else if (tcols.length > 1) placeInto(wangBai[1], ROW5, tcols[1]);
        }
      } else if (wangBai.length === 1) {
        placeInto(wangBai[0], ROW5, tcols[0]);
      }

      // 赵淑萍、刘雯秀 同桌第5排
      var pWang = pos('王大玮');
      var zlGroup = pWang ? colGroupOf(pWang.c) : targetGroup;
      var zlCols = groupCols(zlGroup);
      var zhaoLiuGrade = shuffle(['赵淑萍', '刘雯秀'].filter(function(n) { return pos(n); }));
      if (zhaoLiuGrade.length === 2) {
        var placedZl = false;
        for (var zc = 0; zc < zlCols.length - 1 && !placedZl; zc++) {
          if (!grid[ROW5][zlCols[zc]] && !grid[ROW5][zlCols[zc + 1]]) {
            placeInto(zhaoLiuGrade[0], ROW5, zlCols[zc]);
            placeInto(zhaoLiuGrade[1], ROW5, zlCols[zc + 1]);
            placedZl = true;
          }
        }
        if (!placedZl) {
          var allR = [];
          for (var ar = 0; ar < rows; ar++) allR.push(ar);
          shuffle(allR);
          for (var ai2 = 0; ai2 < allR.length && !placedZl; ai2++) {
            for (var ac = 0; ac < zlCols.length - 1; ac++) {
              if (!grid[allR[ai2]][zlCols[ac]] && !grid[allR[ai2]][zlCols[ac + 1]]) {
                placeInto(zhaoLiuGrade[0], allR[ai2], zlCols[ac]);
                placeInto(zhaoLiuGrade[1], allR[ai2], zlCols[ac + 1]);
                placedZl = true;
                break;
              }
            }
          }
        }
      } else if (zhaoLiuGrade.length === 1) {
        for (var zc2 = 0; zc2 < zlCols.length; zc2++) {
          if (!grid[ROW5][zlCols[zc2]]) { placeInto(zhaoLiuGrade[0], ROW5, zlCols[zc2]); break; }
        }
      }
    }

    // 两种模式都生效：贺国贤 和 戎毓梅 隔走道相邻错开一排
    var pHe = pos('贺国贤');
    var rongName = pos('戎玉梅') ? '戎玉梅' : (pos('戎毓梅') ? '戎毓梅' : null);
    if (pHe && rongName) {
      var heGroup = colGroupOf(pHe.c);
      var adjGroups = [];
      if (heGroup + 1 < groups) adjGroups.push(heGroup + 1);
      if (heGroup - 1 >= 0) adjGroups.push(heGroup - 1);
      if (adjGroups.length > 0) {
        var ag = adjGroups[Math.floor(Math.random() * adjGroups.length)];
        var agcols = groupCols(ag);
        var rongCol = (ag > heGroup) ? agcols[0] : agcols[agcols.length - 1];
        var rongRows = [];
        if (pHe.r - 1 >= 0) rongRows.push(pHe.r - 1);
        if (pHe.r + 1 < rows) rongRows.push(pHe.r + 1);
        var rongRow = rongRows.length ? rongRows[Math.floor(Math.random() * rongRows.length)] : pHe.r;
        placeInto(rongName, rongRow, rongCol);
      }
    }
  },

  resolveAdjacency() {
    var grid = this.seatGrid;
    var rows = this.seatRows;
    var totalCols = this.seatTotalCols;
    var aisleCols = this.seatAisleCols;
    if (!grid || !rows || !aisleCols || totalCols === undefined) return;

    function isAisle(c) { return aisleCols.indexOf(c) !== -1; }
    function inB(r, c) { return r >= 0 && r < rows && c >= 0 && c < totalCols; }
    function pos(name) {
      for (var r = 0; r < rows; r++)
        for (var c = 0; c < totalCols; c++) {
          var s = grid[r][c];
          if (s && s.name === name) return { r: r, c: c };
        }
      return null;
    }
    function neighbors(r, c) {
      var o = [];
      for (var dr = -1; dr <= 1; dr++)
        for (var dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          var nr = r + dr, nc = c + dc;
          if (!inB(nr, nc) || isAisle(nc)) continue;
          o.push({ r: nr, c: nc });
        }
      return o;
    }
    // 锚定学生：不能被交换走
    function isAnchored(s) {
      return s && (s.name === '王大玮' || s.name === '刘雯秀' || s.name === '赵淑萍' ||
        s.name === '贺国贤' || s.name === '戎玉梅' || s.name === '戎毓梅' || s.name === '张雅雯' || s.name === '白天祯' || s.name === '杨悦' ||
        s.name === '王治柬' || s.name === '王治東' || s.name === '钱梦娇' || s.name === '刘浩' || s.name === '陈艺菡' || s.name === '杨嘉瑞');
    }

    // 受保护学生：王崇瑞、张诗韵不能出现在他们的8邻域内
    var protectedNames = ['王大玮', '白天祯', '贺国贤', '杨悦', '刘雯秀', '赵淑萍'];

    var guard = 0;
    while (guard++ < 80) {
      var bad = null;
      outer:
      for (var pi = 0; pi < protectedNames.length; pi++) {
        var pp = pos(protectedNames[pi]);
        if (!pp) continue;
        var nbs = neighbors(pp.r, pp.c);
        for (var ni = 0; ni < nbs.length; ni++) {
          var cell = grid[nbs[ni].r][nbs[ni].c];
          if (cell && (cell.name === '王崇瑞' || cell.name === '张诗韵')) { bad = { r: nbs[ni].r, c: nbs[ni].c }; break outer; }
        }
      }
      if (!bad) break;
      // 把王崇瑞/张诗韵交换到不靠近受保护学生的位置
      var swapTarget = null;
      for (var sr = 0; sr < rows && !swapTarget; sr++) {
        for (var sc = 0; sc < totalCols && !swapTarget; sc++) {
          if (isAisle(sc)) continue;
          var s2 = grid[sr][sc];
          if (!s2 || isAnchored(s2)) continue;
          if (s2.name === '王崇瑞' || s2.name === '张诗韵') continue;
          var nearProt = false;
          for (var pj = 0; pj < protectedNames.length; pj++) {
            var qp = pos(protectedNames[pj]);
            if (!qp) continue;
            if (Math.abs(qp.r - sr) <= 1 && Math.abs(qp.c - sc) <= 1) { nearProt = true; break; }
          }
          if (!nearProt) swapTarget = { r: sr, c: sc };
        }
      }
      if (swapTarget) {
        var t = grid[bad.r][bad.c]; grid[bad.r][bad.c] = grid[swapTarget.r][swapTarget.c]; grid[swapTarget.r][swapTarget.c] = t;
      }
      else break;
    }
  },
  onSeatCellClick(r, c) {
    if (this.seatAisleCols.indexOf(c) !== -1) return;
    if (!this.seatSelected) {
      this.seatSelected = { r: r, c: c };
      this.renderSeatChart();
      return;
    }
    if (this.seatSelected.r === r && this.seatSelected.c === c) {
      this.seatSelected = null;
      this.renderSeatChart();
      return;
    }
    var a = this.seatGrid[this.seatSelected.r][this.seatSelected.c];
    var b = this.seatGrid[r][c];
    this.seatGrid[this.seatSelected.r][this.seatSelected.c] = b;
    this.seatGrid[r][c] = a;
    this.seatSelected = null;
    this.renderSeatChart();
  },

  renderSeatChart() {
    var box = document.getElementById('seat-page-chart');
    if (!box) return;
    box.innerHTML = '';
    box.style.textAlign = 'center';
    if (!this.seatGrid) return;
    var grid = this.seatGrid, rows = this.seatRows, totalCols = this.seatTotalCols;
    var aisle = this.seatAisleCols, n = this.seatStudents ? this.seatStudents.length : 0;
    var third = this.seatThird || Math.ceil(n / 3);
    var self = this;

    var table = document.createElement('table');
    table.id = 'seat-chart';
    table.style.cssText = 'border-collapse:separate;border-spacing:4px;margin:0 auto;display:inline-table;';
    var cap = document.createElement('caption');
    cap.textContent = '—— 讲 台 ——';
    cap.style.cssText = 'caption-side:top;font-size:16px;font-weight:bold;color:inherit;margin-bottom:12px;letter-spacing:8px;';
    table.appendChild(cap);
    for (var ri = 0; ri < rows; ri++) {
      var tr = document.createElement('tr');
      for (var ci = 0; ci < totalCols; ci++) {
        var td = document.createElement('td');
        if (aisle.indexOf(ci) !== -1) {
          td.className = 'seat-aisle';
          td.style.cssText = 'width:26px;';
        } else {
          (function (r, c) {
            var stu = grid[r][c];
            td.style.cssText = 'width:86px;height:40px;text-align:center;border:1px solid #aaa;border-radius:6px;font-size:13px;padding:0 4px;cursor:pointer;user-select:none;';
            if (stu) {
              td.textContent = stu.name;
              td.style.background = '#fff';
              td.title = (self.seatSortMode === 'rank')
                ? '排座序' + stu.rank + ' · ' + (self.seatSortColumn || '班级排名') + '：第' + stu.score
                : '排座序' + stu.rank + ' · ' + stu.score + '分';
            } else {
              td.style.background = '#f5f5f5';
            }
            if (self.seatSelected && self.seatSelected.r === r && self.seatSelected.c === c) {
              td.style.outline = '3px solid #7c4dff';
              td.style.outlineOffset = '1px';
            }
            td.onclick = function () { self.onSeatCellClick(r, c); };
          })(ri, ci);
        }
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    box.appendChild(table);
  },

  printSeating() {
    if (!this.seatGrid) { alert('请先生成座位表'); return; }
    var grid = this.seatGrid, rows = this.seatRows, totalCols = this.seatTotalCols, aisle = this.seatAisleCols;
    var html = '<html><head><meta charset="utf-8"><title>座位表</title><style>body{font-family:"Microsoft YaHei",sans-serif;text-align:center;} table{border-collapse:separate;border-spacing:4px;margin:20px auto;} td{width:84px;height:40px;text-align:center;border:1px solid #888;border-radius:6px;font-size:14px;padding:0 4px;} caption{font-size:18px;font-weight:bold;margin-bottom:16px;letter-spacing:8px;} .aisle{width:26px;border:none;}</style></head><body><table><caption>—— 讲 台 ——</caption>';
    for (var r = 0; r < rows; r++) {
      html += '<tr>';
      for (var c = 0; c < totalCols; c++) {
        if (aisle.indexOf(c) !== -1) { html += '<td class="aisle"></td>'; continue; }
        var s = grid[r][c];
        html += '<td>' + (s ? escapeHtml(s.name) : '') + '</td>';
      }
      html += '</tr>';
    }
    html += '</table></body></html>';
    var w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(function () { w.print(); }, 300);
  },

  exportSeatingImage() {
    if (!this.seatGrid) { alert('请先生成座位表'); return; }
    try {
      var cellW = 92, cellH = 46, gap = 6;
      var rows = this.seatRows;
      var cols = this.seatTotalCols;
      var padX = 40, padY = 64;
      var canvasW = padX * 2 + cols * cellW + (cols - 1) * gap;
      var canvasH = padY * 2 + rows * cellH + (rows - 1) * gap;
      var canvas = document.createElement('canvas');
      canvas.width = canvasW; canvas.height = canvasH;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.fillStyle = '#333';
      ctx.font = 'bold 18px "Microsoft YaHei"';
      ctx.textAlign = 'center';
      ctx.fillText('—— 讲 台 ——', canvasW / 2, 32);
      var n = this.seatStudents.length;
      var third = this.seatThird || Math.ceil(n / 3);
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var x = padX + c * (cellW + gap);
          var y = padY + r * (cellH + gap);
          if (this.seatAisleCols.indexOf(c) !== -1) continue;
          var stu = this.seatGrid[r][c];
          if (stu) {
            ctx.fillStyle = '#fff';
          } else {
            ctx.fillStyle = '#f5f5f5';
          }
          ctx.fillRect(x, y, cellW, cellH);
          ctx.strokeStyle = '#999';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, cellW, cellH);
          if (stu) {
            ctx.fillStyle = '#222';
            ctx.font = '14px "Microsoft YaHei"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(stu.name, x + cellW / 2, y + cellH / 2);
          }
        }
      }
      var link = document.createElement('a');
      link.download = '座位表.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      alert('导出图片失败：' + (e && e.message ? e.message : e));
    }
  },

  async saveSeatingAsTable() {
    if (!this.seatStudents || !this.seatGrid) { alert('请先生成座位表'); return; }
    try {
      var rows = this.seatRows;
      var cols = this.seatTotalCols;
      var aisle = this.seatAisleCols;
      var seatCols = this.seatSeatCols;
      // 座位图格式：每个座位一个数据行，保留行列坐标；空座位留空行
      var tableRows = [];
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          if (aisle.indexOf(c) !== -1) continue;
          var stu = this.seatGrid[r][c];
          tableRows.push({
            group: r + 1, // 座位排号
            name: stu ? stu.name : '',
            personal_rank: stu ? String(stu.rank) : '',
            total_score: stu ? stu.score : 0,
            cells: Array(WEEK_LABELS.length).fill(''),
            seat_row: r,
            seat_col: c
          });
        }
      }
      var name = '座位表_' + new Date().toLocaleDateString();
      var table = await window.electronAPI.createTable({ name: name, totalPeople: this.seatStudents.length, membersPerGroup: seatCols.length, useLastNames: false });
      table.type = 'seat';
      table.seat_layout = { rows: rows, totalCols: cols, aisle: aisle, seatCols: seatCols };
      // 座位表统计口径：人数=实际学生数，组数=座位排数，每组人数=每排座位数(含本组列)
      table.total_people = this.seatStudents.length;
      table.num_groups = rows;
      table.members_per_group = seatCols.length;
      table.rows = tableRows;
      await window.electronAPI.updateTable(table);
      alert('已保存座位表：' + name);
    } catch (e) {
      alert('保存失败：' + (e && e.message ? e.message : e));
    }
  },

  // ===== Excel 导出 =====
  async exportExcel() {
    // 先保存当前编辑的数据
    this.collectTableData();
    await window.electronAPI.updateTable(this.editingTable);
    const result = await window.electronAPI.exportExcel(this.editingTable);
    if (result.success) {
      // 使用 Electron 原生对话框，避免 alert() 导致焦点丢失
      await window.electronAPI.confirmBox({
        title: '导出成功',
        message: `已导出到：${result.path}`,
        buttons: ['确定']
      });
    } else if (result.error !== '已取消') {
      await window.electronAPI.confirmBox({
        title: '导出失败',
        message: result.error,
        buttons: ['确定']
      });
    }
  },

  // ===== 一键清除积分（保留姓名）需管理员密码 =====
  async clearScores() {
    if (this.tablesLocked && !this.creatorMode) { alert('表格已被创作者锁定，无法修改。'); return; }
    // 弹出密码验证
    const ok = await this.promptPassword('清除所有积分数据需要管理员权限');
    if (!ok) return;

    const result = await window.electronAPI.confirmBox({
      title: '确认清除',
      message: '将清除所有积分数据（包括每日积分、个人总分、排名），但保留姓名。\n\n此操作不可撤销，是否继续？',
      buttons: ['确认清除', '取消']
    });
    if (result !== 0) return;

    // 先收集当前编辑数据
    this.collectTableData();
    const table = this.editingTable;
    if (!table) return;

    for (const row of table.rows) {
      row.cells = row.cells.map(() => '');
      row.total_score = 0;
      row.personal_rank = '';
    }
    for (const g in table.group_ranks) {
      table.group_ranks[g] = '';
    }
    // 清除小组总分
    if (table.group_scores) {
      for (const g in table.group_scores) {
        table.group_scores[g] = 0;
      }
    }

    await window.electronAPI.updateTable(table);
    this.renderEditor();
    await window.electronAPI.confirmBox({
      title: '清除完成',
      message: '已清除所有积分数据，姓名已保留。',
      buttons: ['确定']
    });
  },

  // ===== 下一周期：复制姓名与分组，清空积分和排名 =====
  async createNextCycle(sourceId) {
    try {
      if (this.tablesLocked && !this.creatorMode) { alert('表格已被创作者锁定，无法修改。'); return; }
      let source = null;
      if (this.editingTable && (!sourceId || this.editingTable.id === sourceId)) source = this.editingTable;
      else if (sourceId) source = await window.electronAPI.getTable(sourceId);
      if (!source) { alert('未找到原表格，可能已被删除'); return; }
      if ((source.type || 'ranking') !== 'ranking') { alert('仅班级量化表支持生成下一周期'); return; }

      // 从编辑器进入时先保存当前修改，确保新表基于最新数据
      if (this.isEditing && this.editingTable && this.editingTable.id === source.id) {
        this.collectTableData();
        await window.electronAPI.updateTable(this.editingTable);
      }

      const suffix = '（新周期）';
      const defaultName = (String(source.name) + suffix).length > 60
        ? String(source.name).slice(0, 60 - suffix.length) + suffix
        : String(source.name) + suffix;
      const input = await this.showPrompt(
        '生成下一周期表格\n\n将保留原表的姓名与分组，清空全部积分和排名，原表格保持不变。\n\n请输入新表格名称：',
        defaultName
      );
      if (input === null) return;
      const name = String(input).trim();
      if (!name) { alert('请填写新表格名称'); return; }

      const result = await window.electronAPI.createCycleTable({ sourceId: source.id, name });
      if (!result || !result.success) {
        alert('生成失败：' + (result && result.error ? result.error : '未知错误'));
        return;
      }
      await this.showTableEditor(result.table.id);
      if (result.renamed) alert('已存在同名表格，新表名自动调整为：' + result.table.name);
    } catch (e) {
      alert('生成下一周期失败：' + (e && e.message ? e.message : e));
    }
  },

  // ===== 增加一行 =====
  async addRow() {
    if (this.tablesLocked && !this.creatorMode) { alert('表格已被创作者锁定，无法修改。'); return; }
    if (!this.editingTable) return;
    this.collectTableData();
    const result = await window.electronAPI.addRow(this.editingTable.id);
    if (result.success) {
      this.recomputeTable(result.table);
      await window.electronAPI.updateTable(result.table);
      this.editingTable = result.table;
      this.renderEditor();
    } else {
      await window.electronAPI.confirmBox({
        title: '操作失败',
        message: result.error || '增加失败',
        buttons: ['确定']
      });
    }
  },

  // ===== 删除最后一行 =====
  async removeRow() {
    if (this.tablesLocked && !this.creatorMode) { alert('表格已被创作者锁定，无法修改。'); return; }
    if (!this.editingTable) return;
    if (this.editingTable.rows.length === 0) {
      await window.electronAPI.confirmBox({
        title: '无法删除',
        message: '表格已没有可删除的行。',
        buttons: ['确定']
      });
      return;
    }
    const confirm = await window.electronAPI.confirmBox({
      title: '确认删除',
      message: '将删除表格最后一行，此操作不可撤销，是否继续？',
      buttons: ['确认删除', '取消']
    });
    if (confirm !== 0) return;
    this.collectTableData();
    await window.electronAPI.updateTable(this.editingTable);
    const result = await window.electronAPI.removeRow(this.editingTable.id);
    if (result.success) {
      this.recomputeTable(result.table);
      await window.electronAPI.updateTable(result.table);
      this.editingTable = result.table;
      this.renderEditor();
    } else {
      await window.electronAPI.confirmBox({
        title: '操作失败',
        message: result.error || '删除失败',
        buttons: ['确定']
      });
    }
  },

  // ===== 姓名搜索跳转 =====
  searchByName() {
    const keyword = document.getElementById('search-name-input').value.trim();
    const resultEl = document.getElementById('search-result');
    if (!keyword) { resultEl.textContent = ''; return; }
    const rows = document.querySelectorAll('#editor-body tr');
    let found = false;
    rows.forEach(tr => tr.classList.remove('search-highlight'));
    for (const tr of rows) {
      const nameInput = tr.querySelector('input[data-type="name"]');
      if (nameInput && nameInput.value.includes(keyword)) {
        tr.classList.add('search-highlight');
        tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // 闪烁效果
        setTimeout(() => tr.classList.remove('search-highlight'), 2000);
        resultEl.textContent = '✓ 已定位到「' + nameInput.value + '」';
        resultEl.style.color = '#27ae60';
        found = true;
        break;
      }
    }
    if (!found) {
      resultEl.textContent = '✗ 未找到姓名「' + keyword + '」';
      resultEl.style.color = '#e74c3c';
    }
  },

  // ===== 超级管理员密码验证弹窗 =====
  pwdCallback: null,
  promptPassword(desc) {
    return new Promise(resolve => {
      const modal = document.getElementById('pwd-confirm-modal');
      const descEl = document.getElementById('pwd-confirm-desc');
      const input = document.getElementById('pwd-confirm-input');
      const err = document.getElementById('pwd-confirm-error');
      if (descEl) descEl.textContent = desc || '此操作需要管理员权限';
      input.value = '';
      err.textContent = '';
      modal.classList.remove('hidden');
      setTimeout(() => input.focus(), 100);
      this.pwdCallback = resolve;
      this.pwdVerifyType = 'normal';
      input.onkeydown = (e) => { if (e.key === 'Enter') this.confirmPwdAction(); };
    });
  },

  promptSuperPassword(desc) {
    return new Promise(resolve => {
      const modal = document.getElementById('pwd-confirm-modal');
      const descEl = document.getElementById('pwd-confirm-desc');
      const input = document.getElementById('pwd-confirm-input');
      const err = document.getElementById('pwd-confirm-error');
      if (descEl) descEl.textContent = desc || '此操作需要管理员权限';
      input.value = '';
      err.textContent = '';
      modal.classList.remove('hidden');
      setTimeout(() => input.focus(), 100);
      this.pwdCallback = resolve;
      this.pwdVerifyType = 'super';
      input.onkeydown = (e) => { if (e.key === 'Enter') this.confirmPwdAction(); };
    });
  },

  async confirmPwdAction() {
    var input = document.getElementById('pwd-confirm-input');
    var err = document.getElementById('pwd-confirm-error');
    input.disabled = false; input.readOnly = false;
    var pwd = input.value.trim();
    if (!pwd) { err.textContent = '请输入密码'; input.focus(); return; }
    try {
      var ok;
      if (this.pwdVerifyType === 'super') {
        ok = await window.electronAPI.verifySuperPassword(pwd);
      } else {
        var res = await window.electronAPI.verifyPassword(pwd);
        ok = !!(res && res.success);
      }
      if (ok) {
        err.textContent = '';
        input.value = '';
        document.getElementById('pwd-confirm-modal').classList.add('hidden');
        if (this.pwdCallback) { this.pwdCallback(true); this.pwdCallback = null; }
      } else {
        err.textContent = '密码错误，请重试';
        input.value = '';
        input.disabled = false;
        input.focus();
      }
    } catch (e) {
      err.textContent = '验证出错，请重试';
      input.value = '';
      input.disabled = false;
      input.focus();
    }
  },

  cancelPwdAction() {
    document.getElementById('pwd-confirm-input').value = '';
    document.getElementById('pwd-confirm-error').textContent = '';
    document.getElementById('pwd-confirm-modal').classList.add('hidden');
    if (this.pwdCallback) { this.pwdCallback(false); this.pwdCallback = null; }
  },

  // =========================================================================
  // 通用提示
  // =========================================================================
  showToast(message, type) {
    var old = document.getElementById('app-toast');
    if (old) old.remove();
    var div = document.createElement('div');
    div.id = 'app-toast';
    div.className = 'app-toast' + (type ? ' toast-' + type : '');
    div.textContent = message;
    document.body.appendChild(div);
    requestAnimationFrame(function () { div.classList.add('show'); });
    setTimeout(function () {
      div.classList.remove('show');
      setTimeout(function () { if (div.parentNode) div.remove(); }, 220);
    }, 2200);
  },

  // 将 ISO 时间转为本机时区的 YYYY-MM-DD HH:mm
  fmtLocal(value) {
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value).slice(0, 16).replace('T', ' ');
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  },

  // =========================================================================
  // 方案 1：统一学生名单
  // =========================================================================
  roster: { version: 1, updated_at: '', students: [] },

  async showRosterPage() {
    this.showSection('roster-page');
    await this.loadRosterPage();
  },

  async loadRosterPage() {
    try {
      var data = await window.electronAPI.rosterGet();
      this.roster = (data && Array.isArray(data.students)) ? data : { version: 1, updated_at: '', students: [] };
    } catch (e) {
      this.roster = { version: 1, updated_at: '', students: [] };
    }
    this.renderRosterList();
    await this.fillRosterTableSelect();
  },

  async fillRosterTableSelect() {
    var sel = document.getElementById('roster-apply-table');
    if (!sel) return;
    try {
      var tables = await window.electronAPI.loadTables();
      var rankings = (tables || []).filter(function (t) { return (t.type || 'ranking') === 'ranking'; });
      var current = sel.value;
      sel.innerHTML = '<option value="">选择量化表</option>' + rankings.map(function (t) {
        return '<option value="' + escapeHtml(t.id) + '">' + escapeHtml(t.name || '未命名表格') + '</option>';
      }).join('');
      if (current) sel.value = current;
    } catch (e) { /* 忽略读取失败 */ }
  },

  renderRosterList() {
    var list = document.getElementById('roster-list');
    var stats = document.getElementById('roster-stats');
    if (!list) return;
    var students = (this.roster && this.roster.students) || [];
    if (stats) {
      stats.textContent = students.length
        ? ('共 ' + students.length + ' 名学生' + (this.roster.updated_at ? ' · 最近保存 ' + this.fmtLocal(this.roster.updated_at) : ''))
        : '暂无学生，添加或导入名单后会自动保存';
    }
    if (!students.length) {
      list.innerHTML = '<div class="dash-empty">名单为空，可在上方输入姓名，或从 Excel / 量化表导入</div>';
      return;
    }
    var self = this;
    list.innerHTML = students.map(function (s, i) {
      return '<div class="roster-row" data-index="' + i + '">' +
        '<span class="roster-no">' + (i + 1) + '</span>' +
        '<input class="roster-name" data-field="name" value="' + escapeHtml(s.name) + '" maxlength="20">' +
        '<input class="roster-group" data-field="group" value="' + escapeHtml(s.group === undefined || s.group === null ? '' : s.group) + '" placeholder="组" maxlength="4">' +
        '<input class="roster-note" data-field="note" value="' + escapeHtml(s.note || '') + '" placeholder="备注（可选）" maxlength="40">' +
        '<button class="btn btn-sm btn-danger" data-del="' + i + '">删除</button>' +
        '</div>';
    }).join('');
    list.querySelectorAll('input').forEach(function (inp) {
      inp.onchange = function () {
        var rowEl = inp.closest('.roster-row');
        var idx = parseInt(rowEl.dataset.index, 10);
        var st = self.roster.students[idx];
        if (!st) return;
        var val = inp.value.trim();
        if (inp.dataset.field === 'name' && !val) {
          self.roster.students.splice(idx, 1);
          self.renderRosterList();
          self.rosterPersist();
          return;
        }
        st[inp.dataset.field] = val;
        self.rosterPersist();
      };
    });
    list.querySelectorAll('button[data-del]').forEach(function (btn) {
      btn.onclick = function () {
        var idx = parseInt(btn.dataset.del, 10);
        self.roster.students.splice(idx, 1);
        self.renderRosterList();
        self.rosterPersist();
      };
    });
  },

  async rosterPersist() {
    try {
      var res = await window.electronAPI.rosterSave(this.roster);
      if (res && res.success) this.roster = res.roster;
      else if (res && res.error) this.showToast('保存名单失败：' + res.error, 'error');
    } catch (e) {
      this.showToast('保存名单失败：' + (e && e.message ? e.message : e), 'error');
    }
  },

  rosterAddStudent() {
    var inp = document.getElementById('roster-name-input');
    if (!inp) return;
    var name = (inp.value || '').trim();
    if (!name) { inp.focus(); return; }
    if ((this.roster.students || []).some(function (s) { return s.name === name; })) {
      this.showToast('名单中已有「' + name + '」', 'warn');
      inp.select();
      return;
    }
    this.roster.students.push({ id: '', name: name, group: '', note: '' });
    inp.value = '';
    this.renderRosterList();
    this.rosterPersist();
    inp.focus();
  },

  rosterBatchImport() {
    var self = this;
    var old = document.getElementById('roster-batch-modal');
    if (old) old.remove();
    var mask = document.createElement('div');
    mask.id = 'roster-batch-modal';
    mask.className = 'fluent-dialog-overlay';
    mask.innerHTML = '<div class="fluent-dialog roster-batch-dialog">' +
      '<h3>批量添加学生</h3>' +
      '<p class="dialog-tip">每行一个姓名，也支持用逗号、顿号或空格分隔</p>' +
      '<textarea id="roster-batch-text" rows="8" placeholder="张三\n李四\n王五"></textarea>' +
      '<div class="dialog-actions">' +
      '<button class="btn btn-sm" data-act="cancel">取消</button>' +
      '<button class="btn btn-primary btn-sm" data-act="ok">导入</button>' +
      '</div></div>';
    document.body.appendChild(mask);
    var ta = mask.querySelector('#roster-batch-text');
    ta.focus();
    function close() { mask.remove(); }
    mask.querySelector('[data-act="cancel"]').onclick = close;
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    mask.querySelector('[data-act="ok"]').onclick = function () {
      var parts = (ta.value || '').split(/[\n\r,，、;；\s]+/).map(function (v) { return v.trim(); }).filter(Boolean);
      if (!parts.length) { self.showToast('请先粘贴或输入姓名', 'warn'); ta.focus(); return; }
      var added = 0;
      parts.forEach(function (name) {
        if (!(self.roster.students || []).some(function (s) { return s.name === name; })) {
          self.roster.students.push({ id: '', name: name, group: '', note: '' });
          added++;
        }
      });
      close();
      self.renderRosterList();
      self.rosterPersist();
      self.showToast('已添加 ' + added + ' 名学生' + (added < parts.length ? '（重复的已跳过）' : ''), 'ok');
    };
    mask.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  },

  async rosterImportExcel() {
    try {
      var res = await window.electronAPI.importNames();
      if (!res || !res.success) {
        if (res && res.error && res.error !== '已取消') this.showToast(res.error, 'error');
        return;
      }
      var added = 0;
      (res.names || []).forEach(function (raw) {
        var name = String(raw || '').trim();
        if (!name) return;
        if (!(this.roster.students || []).some(function (s) { return s.name === name; })) {
          this.roster.students.push({ id: '', name: name, group: '', note: '' });
          added++;
        }
      }, this);
      this.renderRosterList();
      await this.rosterPersist();
      this.showToast('已从 Excel 导入 ' + added + ' 名学生', 'ok');
    } catch (e) {
      this.showToast('导入失败：' + (e && e.message ? e.message : e), 'error');
    }
  },

  async rosterImportFromTable() {
    try {
      var tables = await window.electronAPI.loadTables();
      var rankings = (tables || []).filter(function (t) { return (t.type || 'ranking') === 'ranking'; });
      if (!rankings.length) { this.showToast('暂无量化表可导入', 'warn'); return; }
      var sel = document.getElementById('roster-apply-table');
      var targetId = sel ? sel.value : '';
      var table = rankings.find(function (t) { return t.id === targetId; }) || rankings[rankings.length - 1];
      var names = (table.rows || []).map(function (r) { return r && String(r.name || '').trim(); })
        .filter(function (n) { return n && n !== '——'; });
      if (!names.length) { this.showToast('该表格还没有学生姓名', 'warn'); return; }
      var added = 0;
      names.forEach(function (name) {
        if (!(this.roster.students || []).some(function (s) { return s.name === name; })) {
          this.roster.students.push({ id: '', name: name, group: '', note: '' });
          added++;
        }
      }, this);
      this.renderRosterList();
      await this.rosterPersist();
      this.showToast('已从「' + (table.name || '量化表') + '」导入 ' + added + ' 名学生', 'ok');
    } catch (e) {
      this.showToast('导入失败：' + (e && e.message ? e.message : e), 'error');
    }
  },

  async rosterApplyToTable() {
    var sel = document.getElementById('roster-apply-table');
    var tableId = sel ? sel.value : '';
    if (!tableId) { this.showToast('请先选择要应用的量化表', 'warn'); return; }
    var students = (this.roster.students || []).filter(function (s) { return s.name; });
    if (!students.length) { this.showToast('学生名单为空', 'warn'); return; }
    try {
      var tables = await window.electronAPI.loadTables();
      var table = (tables || []).find(function (t) { return t.id === tableId; });
      if (!table) { this.showToast('表格不存在，可能已被删除', 'error'); return; }
      var rows = table.rows || [];
      var i = 0;
      rows.forEach(function (r) {
        var n = r && String(r.name || '').trim();
        if ((!n || n === '——') && i < students.length) {
          r.name = students[i].name;
          i++;
        }
      });
      var maxGroup = rows.length ? Math.max.apply(null, rows.map(function (r) { return r.group || 1; })) : 1;
      var mpg = Number(table.members_per_group) || 6;
      while (i < students.length) {
        var lastSize = rows.filter(function (r) { return (r.group || 1) === maxGroup; }).length;
        var g = lastSize >= mpg ? maxGroup + 1 : maxGroup;
        if (g !== maxGroup) maxGroup = g;
        rows.push({ group: g, name: students[i].name, personal_rank: '', total_score: 0, cells: WEEK_LABELS.map(function () { return ''; }) });
        i++;
      }
      table.rows = rows;
      table.total_people = rows.length;
      table.num_groups = rows.reduce(function (m, r) { return Math.max(m, r.group || 1); }, 1);
      this.recomputeTable(table);
      await window.electronAPI.updateTable(table);
      this.showToast('已将 ' + students.length + ' 名学生应用到「' + (table.name || '量化表') + '」', 'ok');
      this.addLog('应用学生名单', (table.name || '') + '：' + students.length + ' 人');
    } catch (e) {
      this.showToast('应用失败：' + (e && e.message ? e.message : e), 'error');
    }
  },

  async rosterClear() {
    if (!(this.roster.students || []).length) { this.showToast('名单已经是空的', 'warn'); return; }
    var r = await window.electronAPI.confirmBox({
      title: '清空名单',
      message: '确定清空全部学生名单吗？已有表格中的数据不会受影响。',
      buttons: ['清空', '取消']
    });
    if (r !== 0) return;
    this.roster.students = [];
    this.renderRosterList();
    await this.rosterPersist();
    this.showToast('名单已清空', 'ok');
  },

  async importRosterForSeating() {
    var info = document.getElementById('seat-info');
    var err = document.getElementById('seat-error');
    if (err) err.textContent = '';
    try {
      var data = await window.electronAPI.rosterGet();
      var students = ((data && data.students) || []).filter(function (s) { return s && s.name; });
      if (!students.length) {
        if (err) err.textContent = '学生名单为空，请先在「学生名单」中添加学生';
        return;
      }
      this.seatStudents = students.map(function (s, i) {
        return { name: s.name, value: 0, score: 0, rank: i + 1 };
      });
      this.seatSortMode = 'random';
      this.seatSortColumn = '学生名单';
      this.seatGrid = null;
      this.renderSeatChart();
      if (info) info.textContent = '已从学生名单导入 ' + students.length + ' 人，点击「生成座位表」开始排座';
    } catch (e) {
      if (err) err.textContent = '导入失败：' + (e && e.message ? e.message : e);
    }
  },

  // =========================================================================
  // 方案 8：值日表
  // =========================================================================
  duty: null,

  async showDutyPage() {
    this.showSection('duty-page');
    await this.loadDutyPage();
  },

  async loadDutyPage() {
    try {
      var data = await window.electronAPI.dutyGet();
      this.duty = (data && data.days) ? data : null;
    } catch (e) {
      this.duty = null;
    }
    this.renderDutyTable();
  },

  renderDutyTable() {
    var wrap = document.getElementById('duty-table-wrap');
    if (!wrap) return;
    var self = this;
    var duty = this.duty || { tasks: ['扫地', '拖地', '擦黑板'], days: {}, updated_at: '' };
    var tasks = (duty.tasks && duty.tasks.length) ? duty.tasks : ['扫地', '拖地', '擦黑板'];
    var days = duty.days || {};
    var dayNames = ['周一', '周二', '周三', '周四', '周五'];
    var html = '<table class="duty-table"><thead><tr><th class="duty-day-col">星期</th>' +
      tasks.map(function (t) { return '<th>' + escapeHtml(t) + '</th>'; }).join('') + '</tr></thead><tbody>';
    dayNames.forEach(function (d) {
      html += '<tr><td class="duty-day">' + d + '</td>';
      tasks.forEach(function (t) {
        var list = (days[d] && days[d][t]) || [];
        html += '<td><input class="duty-input" data-day="' + escapeHtml(d) + '" data-task="' + escapeHtml(t) + '" value="' + escapeHtml(list.join('、')) + '" placeholder="点击填写或自动排班"></td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
    wrap.querySelectorAll('.duty-input').forEach(function (inp) {
      inp.onchange = function () {
        if (!self.duty) self.duty = { version: 1, tasks: tasks.slice(), days: {} };
        if (!self.duty.tasks || !self.duty.tasks.length) self.duty.tasks = tasks.slice();
        if (!self.duty.days) self.duty.days = {};
        if (!self.duty.days[inp.dataset.day]) self.duty.days[inp.dataset.day] = {};
        self.duty.days[inp.dataset.day][inp.dataset.task] = inp.value.split(/[、,，;；\s]+/).map(function (v) { return v.trim(); }).filter(Boolean);
        self.setDutyStatus('有未保存的修改，点击「保存」生效');
      };
    });
    var status = document.getElementById('duty-status');
    if (status) {
      status.textContent = duty.updated_at
        ? '最近保存：' + this.fmtLocal(duty.updated_at)
        : '尚未保存';
    }
  },

  setDutyStatus(text) {
    var el = document.getElementById('duty-status');
    if (el) el.textContent = text || '';
  },

  async autoArrangeDuty() {
    var names = await this.getStudentNamesForModule();
    if (!names.length) { this.showToast('学生名单为空，请先在「学生名单」中添加学生', 'warn'); return; }
    var shuffled = shuffle(names.slice());
    var days = ['周一', '周二', '周三', '周四', '周五'];
    var tasks = ['扫地', '拖地', '擦黑板'];
    var assigned = {};
    days.forEach(function (d) {
      assigned[d] = {};
      tasks.forEach(function (t) { assigned[d][t] = []; });
    });
    shuffled.forEach(function (name, i) {
      assigned[days[i % days.length]][tasks[Math.floor(i / days.length) % tasks.length]].push(name);
    });
    this.duty = { version: 1, updated_at: '', tasks: tasks.slice(), days: assigned };
    this.renderDutyTable();
    await this.saveDuty(true);
    this.showToast('已自动排好值日表（共 ' + shuffled.length + ' 人）', 'ok');
  },

  async saveDuty(silent) {
    if (!this.duty) {
      if (!silent) this.showToast('暂无值日数据，请先自动排班或填写人员', 'warn');
      return;
    }
    try {
      var res = await window.electronAPI.dutySave(this.duty);
      if (res && res.success) {
        this.duty = res.duty;
        this.setDutyStatus('已保存 · ' + this.fmtLocal(res.duty.updated_at));
        if (!silent) this.showToast('值日表已保存', 'ok');
        this.addLog('保存值日表', '');
      } else {
        this.showToast('保存失败：' + ((res && res.error) || '未知错误'), 'error');
      }
    } catch (e) {
      this.showToast('保存失败：' + (e && e.message ? e.message : e), 'error');
    }
  },

  printDuty() {
    if (!this.duty) { this.showToast('请先生成或填写值日表', 'warn'); return; }
    window.print();
  },

  // =========================================================================
  // 方案 8：作业登记
  // =========================================================================
  hwMissing: [],
  hwStudentNames: [],

  async showHomeworkPage() {
    this.showSection('homework-page');
    await this.loadHomeworkPage();
  },

  async loadHomeworkPage() {
    var dateEl = document.getElementById('hw-date');
    if (dateEl && !dateEl.value) {
      var d = new Date();
      var p = function (n) { return n < 10 ? '0' + n : '' + n; };
      dateEl.value = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
    // 清除上次未保存的选择，避免再次进入时残留未交标记
    this.hwMissing = [];
    var subj = document.getElementById('hw-subject');
    var cont = document.getElementById('hw-content');
    if (subj) subj.value = '';
    if (cont) cont.value = '';
    await this.renderHomeworkStudents();
    await this.renderHomeworkRecords();
  },

  async renderHomeworkStudents() {
    var box = document.getElementById('hw-students');
    if (!box) return;
    var names = await this.getStudentNamesForModule();
    this.hwStudentNames = names;
    if (!names.length) {
      box.innerHTML = '<div class="dash-empty">学生名单为空，请先在「学生名单」中添加学生</div>';
      this.updateHwCurrent();
      return;
    }
    if (!Array.isArray(this.hwMissing)) this.hwMissing = [];
    var self = this;
    box.innerHTML = names.map(function (n) {
      return '<button class="hw-chip" data-name="' + escapeHtml(n) + '">' + escapeHtml(n) + '</button>';
    }).join('');
    box.querySelectorAll('.hw-chip').forEach(function (btn) {
      btn.classList.toggle('missing', self.hwMissing.indexOf(btn.dataset.name) >= 0);
      btn.onclick = function () {
        var name = btn.dataset.name;
        var idx = self.hwMissing.indexOf(name);
        if (idx >= 0) self.hwMissing.splice(idx, 1);
        else self.hwMissing.push(name);
        btn.classList.toggle('missing', idx < 0);
        self.updateHwCurrent();
      };
    });
    this.updateHwCurrent();
  },

  updateHwCurrent() {
    var el = document.getElementById('hw-current');
    if (!el) return;
    var total = (this.hwStudentNames || []).length;
    if (!total) { el.textContent = ''; return; }
    var missing = (this.hwMissing || []).filter(function (n) {
      return (this.hwStudentNames || []).indexOf(n) >= 0;
    }, this);
    el.innerHTML = '共 <b>' + total + '</b> 人 · 已交 <b>' + (total - missing.length) + '</b> 人 · 未交 <b class="hw-missing-count">' + missing.length + '</b> 人' +
      (missing.length ? '：<span class="hw-missing-names">' + missing.map(escapeHtml).join('、') + '</span>' : '');
  },

  hwSelectAll() {
    if (!(this.hwStudentNames || []).length) { this.showToast('暂无学生', 'warn'); return; }
    this.hwMissing = this.hwStudentNames.slice();
    document.querySelectorAll('#hw-students .hw-chip').forEach(function (b) { b.classList.add('missing'); });
    this.updateHwCurrent();
  },

  hwSelectNone() {
    this.hwMissing = [];
    document.querySelectorAll('#hw-students .hw-chip').forEach(function (b) { b.classList.remove('missing'); });
    this.updateHwCurrent();
  },

  resetHomeworkForm() {
    var subj = document.getElementById('hw-subject');
    var cont = document.getElementById('hw-content');
    if (subj) subj.value = '';
    if (cont) cont.value = '';
    this.hwMissing = [];
    document.querySelectorAll('#hw-students .hw-chip').forEach(function (b) { b.classList.remove('missing'); });
    this.updateHwCurrent();
  },

  async saveHomeworkRecord() {
    var subject = (document.getElementById('hw-subject').value || '').trim();
    var content = (document.getElementById('hw-content').value || '').trim();
    var date = (document.getElementById('hw-date').value || '').trim();
    if (!subject) { this.showToast('请填写科目', 'warn'); return; }
    if (!date) { this.showToast('请选择日期', 'warn'); return; }
    var total = (this.hwStudentNames || []).length;
    if (!total) { this.showToast('学生名单为空，请先在「学生名单」中添加学生', 'warn'); return; }
    var missing = (this.hwMissing || []).filter(function (n) {
      return (this.hwStudentNames || []).indexOf(n) >= 0;
    }, this);
    var existing = (this.hwRecords || []).filter(function (r) {
      return r.date === date && r.subject === subject;
    })[0];
    if (existing) {
      var cf = await window.electronAPI.confirmBox({
        title: '记录已存在',
        message: '该日期「' + subject + '」已有作业登记，是否覆盖更新？',
        buttons: ['覆盖更新', '取消'],
        cancelId: 1
      });
      if (cf !== 0) return;
    }
    try {
      var payload = { date: date, subject: subject, content: content, missing: missing, total: total };
      if (existing) { payload.id = existing.id; payload.created_at = existing.created_at; }
      var res = await window.electronAPI.homeworkSave(payload);
      if (!res || !res.success) { this.showToast('保存失败：' + ((res && res.error) || '未知错误'), 'error'); return; }
      this.showToast((existing ? '已更新「' : '已登记「') + subject + '」，未交 ' + missing.length + ' 人', 'ok');
      this.resetHomeworkForm();
      await this.renderHomeworkRecords(res.records);
      this.addLog('作业登记', subject + (content ? ' ' + content : '') + '，未交 ' + missing.length + ' 人');
    } catch (e) {
      this.showToast('保存失败：' + (e && e.message ? e.message : e), 'error');
    }
  },

  async renderHomeworkRecords(records) {
    var box = document.getElementById('hw-records');
    if (!box) return;
    if (!records) {
      try {
        var data = await window.electronAPI.homeworkGet();
        records = (data && data.records) || [];
      } catch (e) {
        records = [];
      }
    }
    this.hwRecords = records;
    if (!records.length) { box.innerHTML = '<div class="dash-empty">暂无登记记录</div>'; return; }
    var self = this;
    var sorted = records.slice().sort(function (a, b) {
      var ka = String(a.date || '') + String(a.created_at || '');
      var kb = String(b.date || '') + String(b.created_at || '');
      return kb.localeCompare(ka);
    }).slice(0, 30);
    box.innerHTML = sorted.map(function (r) {
      var total = Number(r.total) || 0;
      var miss = (r.missing || []).length;
      var rate = total ? Math.round((total - miss) / total * 100) : 0;
      return '<div class="hw-record">' +
        '<div class="hw-record-main">' +
        '<div class="hw-record-title">' + escapeHtml(r.subject) + (r.content ? ' · ' + escapeHtml(r.content) : '') + '</div>' +
        '<div class="hw-record-meta">' + escapeHtml(r.date) + ' · 已交 ' + (total - miss) + '/' + total + '（' + rate + '%）' + (r.created_at ? ' · 登记于 ' + escapeHtml(self.fmtLocal(r.created_at)) : '') + '</div>' +
        (miss ? '<div class="hw-record-missing">未交：' + (r.missing || []).map(escapeHtml).join('、') + '</div>' : '<div class="hw-record-missing all-done">全部已交</div>') +
        '</div>' +
        '<button class="btn btn-sm btn-danger" data-del="' + escapeHtml(r.id) + '">删除</button>' +
        '</div>';
    }).join('');
    box.querySelectorAll('button[data-del]').forEach(function (btn) {
      btn.onclick = async function () {
        var cf = await window.electronAPI.confirmBox({
          title: '删除记录',
          message: '确定删除这条作业登记记录吗？',
          buttons: ['删除', '取消']
        });
        if (cf !== 0) return;
        try {
          var res = await window.electronAPI.homeworkDelete(btn.dataset.del);
          if (res && res.success) {
            self.showToast('记录已删除', 'ok');
            await self.renderHomeworkRecords(res.records);
          } else {
            self.showToast('删除失败：' + ((res && res.error) || '未知错误'), 'error');
          }
        } catch (e) {
          self.showToast('删除失败：' + (e && e.message ? e.message : e), 'error');
        }
      };
    });
  },

  async getStudentNamesForModule() {
    try {
      var data = await window.electronAPI.rosterGet();
      var names = ((data && data.students) || []).map(function (s) { return s && String(s.name || '').trim(); }).filter(Boolean);
      if (names.length) return names;
    } catch (e) { /* 名单读取失败时回退到量化表 */ }
    try {
      var tables = await window.electronAPI.loadTables();
      var rankings = (tables || []).filter(function (t) { return (t.type || 'ranking') === 'ranking'; });
      var latest = rankings[rankings.length - 1];
      if (latest) {
        return (latest.rows || []).map(function (r) { return r && String(r.name || '').trim(); })
          .filter(function (n) { return n && n !== '——'; });
      }
    } catch (e) { /* ignore */ }
    return [];
  },

  // =========================================================================
  // 方案 2：首页数据看板
  // =========================================================================
  async renderHomeDashboard(tables) {
    var trendEl = document.getElementById('dash-trend');
    if (!trendEl) return;
    try {
      if (!tables) tables = await window.electronAPI.loadTables();
      var rankings = (tables || []).filter(function (t) { return (t.type || 'ranking') === 'ranking'; });
      // 优先取最近一张有学生姓名的量化表，避免看板读取到空白模板
      var latest = null;
      for (var ri = rankings.length - 1; ri >= 0; ri--) {
        var hasNamed = (rankings[ri].rows || []).some(function (r) {
          var n = r && String(r.name || '').trim();
          return n && n !== '——';
        });
        if (hasNamed) { latest = rankings[ri]; break; }
      }
      if (!latest && rankings.length) latest = rankings[rankings.length - 1];
      if (!latest) {
        trendEl.innerHTML = '<div class="dash-empty">暂无量化表数据</div>';
        var ge = document.getElementById('dash-groups');
        if (ge) ge.innerHTML = '<div class="dash-empty">暂无小组数据</div>';
        var pe = document.getElementById('dash-students');
        if (pe) pe.innerHTML = '<div class="dash-empty">暂无个人数据</div>';
      } else {
        var dayTotals = WEEK_LABELS.map(function () { return 0; });
        (latest.rows || []).forEach(function (r) {
          (r.cells || []).forEach(function (c, di) {
            if (di < dayTotals.length) dayTotals[di] += parseCellScore(c);
          });
        });
        var maxDay = Math.max.apply(null, dayTotals.concat([0]));
        trendEl.innerHTML = WEEK_LABELS.map(function (label, di) {
          var v = Math.round(dayTotals[di] * 100) / 100;
          var h = maxDay > 0 ? Math.max(4, Math.round(Math.max(0, v) / maxDay * 108)) : 4;
          var short = label.replace('第1周', '1/').replace('第2周', '2/').replace('周', '');
          return '<div class="dash-bar-col" title="' + escapeHtml(label) + '：' + v + ' 分">' +
            '<span class="dash-bar-value">' + (v ? v : '') + '</span>' +
            '<div class="dash-bar' + (v < 0 ? ' neg' : '') + '" style="height:' + h + 'px"></div>' +
            '<span class="dash-bar-label">' + escapeHtml(short) + '</span>' +
            '</div>';
        }).join('');

        var groups = Object.keys(latest.group_scores || {}).map(function (g) {
          return { group: Number(g), score: Number(latest.group_scores[g]) || 0 };
        });
        groups.sort(function (a, b) { return b.score - a.score; });
        var maxG = groups.length ? Math.max.apply(null, groups.map(function (g) { return g.score; })) : 0;
        var gEl = document.getElementById('dash-groups');
        if (gEl) {
          if (!groups.length) {
            gEl.innerHTML = '<div class="dash-empty">暂无小组数据</div>';
          } else {
            gEl.innerHTML = groups.slice(0, 8).map(function (g, i) {
              var pct = maxG > 0 ? Math.max(3, Math.round(Math.max(0, g.score) / maxG * 100)) : 3;
              return '<div class="dash-rank-row">' +
                '<span class="dash-rank-no' + (i < 3 ? ' top' + (i + 1) : '') + '">' + (i + 1) + '</span>' +
                '<span class="dash-rank-name">第' + g.group + '组</span>' +
                '<div class="dash-rank-bar"><i style="width:' + pct + '%"></i></div>' +
                '<span class="dash-rank-score">' + g.score + '</span>' +
                '</div>';
            }).join('');
          }
        }

        var people = (latest.rows || []).filter(function (r) {
          return r && r.name && String(r.name).trim() !== '——';
        }).map(function (r) {
          return { name: String(r.name), score: Number(r.total_score) || 0 };
        });
        people.sort(function (a, b) { return b.score - a.score; });
        var pEl = document.getElementById('dash-students');
        if (pEl) {
          if (!people.length) {
            pEl.innerHTML = '<div class="dash-empty">暂无个人数据</div>';
          } else {
            var maxS = people[0].score || 0;
            pEl.innerHTML = people.slice(0, 8).map(function (s, i) {
              var pct = maxS > 0 ? Math.max(3, Math.round(Math.max(0, s.score) / maxS * 100)) : 3;
              return '<div class="dash-rank-row">' +
                '<span class="dash-rank-no' + (i < 3 ? ' top' + (i + 1) : '') + '">' + (i + 1) + '</span>' +
                '<span class="dash-rank-name">' + escapeHtml(s.name) + '</span>' +
                '<div class="dash-rank-bar"><i style="width:' + pct + '%"></i></div>' +
                '<span class="dash-rank-score">' + s.score + '</span>' +
                '</div>';
            }).join('');
          }
        }
      }

      var rosterCount = 0, dutyDays = 0, hwCount = 0, hwMissingCount = 0;
      try {
        var roster = await window.electronAPI.rosterGet();
        rosterCount = ((roster && roster.students) || []).length;
      } catch (e) { /* ignore */ }
      try {
        var duty = await window.electronAPI.dutyGet();
        Object.keys((duty && duty.days) || {}).forEach(function (d) {
          if (Object.keys(duty.days[d] || {}).some(function (t) { return (duty.days[d][t] || []).length; })) dutyDays++;
        });
      } catch (e) { /* ignore */ }
      try {
        var hw = await window.electronAPI.homeworkGet();
        var recs = (hw && hw.records) || [];
        hwCount = recs.length;
        if (recs.length) {
          var sortedRecs = recs.slice().sort(function (a, b) {
            return String(b.created_at || b.date || '').localeCompare(String(a.created_at || a.date || ''));
          });
          hwMissingCount = (sortedRecs[0].missing || []).length;
        }
      } catch (e) { /* ignore */ }
      var modEl = document.getElementById('dash-modules');
      if (modEl) {
        modEl.innerHTML =
          '<button class="dash-module" onclick="app.showRosterPage()"><span class="dash-module-ico ico-blue">人</span><span class="dash-module-text"><b>学生名单</b><small>' + (rosterCount ? rosterCount + ' 名学生' : '尚未添加') + '</small></span></button>' +
          '<button class="dash-module" onclick="app.showDutyPage()"><span class="dash-module-ico ico-green">值</span><span class="dash-module-text"><b>值日表</b><small>' + (dutyDays ? dutyDays + ' 天已排班' : '尚未排班') + '</small></span></button>' +
          '<button class="dash-module" onclick="app.showHomeworkPage()"><span class="dash-module-ico ico-amber">作</span><span class="dash-module-text"><b>作业登记</b><small>' + (hwCount ? hwCount + ' 条记录 · 最近未交 ' + hwMissingCount + ' 人' : '暂无记录') + '</small></span></button>';
      }
    } catch (e) {
      console.warn('看板加载失败', e);
    }
  },

  // =========================================================================
  // 方案 3：量化表快捷加分 + 撤销
  // =========================================================================
  quickScoreDelta: 2,
  quickScoreDay: 0,
  _scoreUndo: null,

  openQuickScore() {
    if (this.tablesLocked && !this.creatorMode) { alert('表格已被创作者锁定，无法修改。'); return; }
    if (!this.editingTable) { alert('请先打开一个表格'); return; }
    if (this.editingTable.type === 'seat') { alert('座位表不支持加分'); return; }
    if (this.quickScoreDay === undefined || this.quickScoreDay === null) this.quickScoreDay = 0;
    var panel = document.getElementById('quick-score-panel');
    if (!panel) return;
    panel.classList.remove('hidden');
    this.renderQuickScore();
    this.updateUndoButton();
  },

  closeQuickScore() {
    var panel = document.getElementById('quick-score-panel');
    if (panel) panel.classList.add('hidden');
  },

  renderQuickScore() {
    var table = this.editingTable;
    if (!table) return;
    var presetBox = document.getElementById('qs-presets');
    if (presetBox) {
      var presets = [
        { delta: 1, name: '课堂发言' },
        { delta: 2, name: '作业完成' },
        { delta: 3, name: '卫生值日' },
        { delta: 5, name: '考试优秀' },
        { delta: -1, name: '违纪' },
        { delta: -2, name: '迟到' }
      ];
      var self = this;
      presetBox.innerHTML = '';
      presets.forEach(function (p) {
        var b = document.createElement('button');
        b.className = 'qs-chip' + (Number(self.quickScoreDelta) === p.delta ? ' active' : '');
        b.textContent = (p.delta > 0 ? '+' : '') + p.delta + ' ' + p.name;
        b.onclick = function () {
          self.quickScoreDelta = p.delta;
          self.renderQuickScore();
        };
        presetBox.appendChild(b);
      });
    }
    var sel = document.getElementById('qs-day');
    if (sel) {
      sel.innerHTML = WEEK_LABELS.map(function (label, i) {
        return '<option value="' + i + '"' + (i === Number(this.quickScoreDay) ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
      }, this).join('');
    }
    this.renderQuickStudents();
  },

  renderQuickStudents() {
    var box = document.getElementById('qs-students');
    if (!box) return;
    var table = this.editingTable;
    if (!table) { box.innerHTML = ''; return; }
    var rows = [];
    (table.rows || []).forEach(function (r, i) {
      if (r && r.name && String(r.name).trim() !== '——') rows.push({ row: r, idx: i });
    });
    if (!rows.length) {
      box.innerHTML = '<span class="qs-empty">暂无学生，请先在表格中填写姓名</span>';
      return;
    }
    box.innerHTML = rows.map(function (x) {
      return '<button class="qs-stu" data-row="' + x.idx + '">' + escapeHtml(x.row.name) +
        '<span class="qs-stu-group">' + (x.row.group || 1) + '组</span></button>';
    }).join('');
    var self = this;
    box.querySelectorAll('.qs-stu').forEach(function (btn) {
      btn.onclick = function () { self.applyQuickScore(parseInt(btn.dataset.row, 10)); };
    });
  },

  onQuickDayChange(value) {
    this.quickScoreDay = parseInt(value, 10) || 0;
  },

  quickScoreCustom() {
    var inp = document.getElementById('qs-custom');
    if (!inp) return;
    var v = parseFloat(inp.value);
    if (isNaN(v) || v === 0) {
      this.showToast('请输入有效的非 0 分数', 'warn');
      inp.focus();
      return;
    }
    this.quickScoreDelta = v;
    inp.value = '';
    this.renderQuickScore();
    this.showToast('已切换为 ' + (v > 0 ? '+' : '') + v + ' 分，点击学生即可加分', 'ok');
  },

  applyQuickScore(rowIdx) {
    if (this.tablesLocked && !this.creatorMode) { alert('表格已被创作者锁定，无法修改。'); return; }
    var table = this.editingTable;
    if (!table) return;
    this.collectTableData();
    var row = table.rows[rowIdx];
    if (!row) return;
    var delta = parseFloat(this.quickScoreDelta);
    if (!delta) { this.showToast('请先选择或输入有效分数', 'warn'); return; }
    var day = parseInt(this.quickScoreDay, 10) || 0;
    if (!Array.isArray(row.cells)) row.cells = [];
    while (row.cells.length <= day) row.cells.push('');
    var before = row.cells[day];
    row.cells[day] = this.appendScoreToCell(before, delta);
    var after = row.cells[day];
    this.recomputeTable(table);
    var label = (row.name || '学生') + ' ' + (delta > 0 ? '+' : '') + delta + ' 分';
    this.pushScoreUndo(table.id, [{ row: rowIdx, day: day, before: before }], label + '（' + WEEK_LABELS[day] + '）');
    var self = this;
    window.electronAPI.updateTable(table).then(function () {
      self.syncCellInputs([{ row: rowIdx, day: day, value: after }]);
      self.refreshComputedCells();
      self.updateUndoButton();
      self.showToast(label + '（' + WEEK_LABELS[day] + '）', 'ok');
      self.addLog('快捷加分', label + '，' + WEEK_LABELS[day]);
    }).catch(function (e) {
      self.showToast('保存失败：' + (e && e.message ? e.message : e), 'error');
    });
  },

  syncCellInputs(changes) {
    var body = document.getElementById('editor-body');
    if (!body) return;
    changes.forEach(function (c) {
      var inp = body.querySelector('input[data-type="cell"][data-row="' + c.row + '"][data-day="' + c.day + '"]');
      if (inp) inp.value = c.value;
    });
  },

  pushScoreUndo(tableId, changes, label) {
    if (!this._scoreUndo) this._scoreUndo = {};
    var stack = this._scoreUndo[tableId] || (this._scoreUndo[tableId] = []);
    stack.push({ changes: changes, label: label, time: Date.now() });
    if (stack.length > 20) stack.shift();
    this.updateUndoButton();
  },

  updateUndoButton() {
    var btn = document.getElementById('undo-score-btn');
    if (!btn) return;
    var stack = (this._scoreUndo && this.editingTable) ? this._scoreUndo[this.editingTable.id] : null;
    var count = (stack && stack.length) ? stack.length : 0;
    btn.textContent = count ? ('撤销（' + count + '）') : '撤销';
    btn.disabled = count === 0;
    btn.style.opacity = count ? '' : '0.5';
  },

  async undoLastScore() {
    if (!this.editingTable) { alert('请先打开一个表格'); return; }
    var table = this.editingTable;
    this.collectTableData();
    var stack = this._scoreUndo && this._scoreUndo[table.id];
    if (!stack || !stack.length) { this.showToast('没有可撤销的加分操作', 'warn'); return; }
    var entry = stack.pop();
    entry.changes.forEach(function (c) {
      var row = table.rows[c.row];
      if (!row) return;
      if (!Array.isArray(row.cells)) row.cells = [];
      while (row.cells.length <= c.day) row.cells.push('');
      row.cells[c.day] = c.before;
    });
    this.recomputeTable(table);
    var self = this;
    try {
      await window.electronAPI.updateTable(table);
      this.syncCellInputs(entry.changes.map(function (c) { return { row: c.row, day: c.day, value: c.before }; }));
      this.refreshComputedCells();
      this.updateUndoButton();
      this.showToast('已撤销：' + entry.label, 'ok');
      this.addLog('撤销加分', entry.label);
    } catch (e) {
      self.showToast('撤销失败：' + (e && e.message ? e.message : e), 'error');
    }
  }
};

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseCellScore(cell) {
  const text = String(cell || '').trim();
  if (text === '') return 0;
  // 支持单个数字（+1、-0.5、1、0.5）或加减表达式（-0.5+1、+1-0.5+2）
  // 匹配所有带符号的数字片段，求和
  const matches = text.match(/[+-]?\d+(\.\d+)?/g);
  if (matches && matches.length > 0) {
    // 确保整个字符串只由数字和加减号组成（没有其他字符）
    const cleaned = text.replace(/[\s+-]|(\d+(\.\d+)?)/g, '');
    if (cleaned === '') {
      let sum = 0;
      for (const m of matches) sum += parseFloat(m);
      return Math.round(sum * 100) / 100;
    }
  }
  const positive = ['√', '到', '出勤', '是', 'y', 'yes'];
  const negative = ['×', 'x', '缺', '缺席', '否', 'n', 'no'];
  const lower = text.toLowerCase();
  if (positive.includes(lower) || positive.includes(text)) return 1;
  if (negative.includes(lower) || negative.includes(text)) return 0;
  return 0;
}

window.app.init();




