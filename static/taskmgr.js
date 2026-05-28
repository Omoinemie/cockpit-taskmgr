(function() {
    'use strict';

    const C = cockpit;
    const CONFIG_PATH = '/etc/cockpit/taskmgr/settings.json';
    
    let refreshInterval = 1000;
    let refreshTimer = null;
    let cpuHistory = [];
    let cpuCoreHistory = [];
    let memHistory = [];
    let swapHistory = [];
    let cpuTemps = {};
    let physicalCores = 0;
    let threadsPerCore = 2;
    const historyLength = 60;
    let processes = [];
    let selectedProcesses = new Set();
    let sortBy = 'cpu';
    let sortAsc = false;
    let searchFilter = '';
    let showKernelThreads = true;
    let showUserProcesses = true;

    const defaultSettings = {
        theme: 'light',
        lang: 'zh-CN',
        menuLayout: 'side',
        accentColor: '#4f6ef7',
        sidebarOpen: true,
        refreshInterval: 1000,
        showCpuTemp: false
    };

    const state = { ...defaultSettings };

    const i18n = {
        'zh-CN': {
            'Task Manager': '任务管理器',
            'Dashboard': '仪表板',
            'Processes': '进程',
            'CPU': 'CPU',
            'Memory': '内存',
            'Disk': '磁盘',
            'Network': '网络',
            'Overview': '概览',
            'Resources': '资源',
            'System Overview': '系统概览',
            'Settings': '设置',
            'Language': '语言',
            'Theme': '主题',
            'Light': '浅色',
            'Dark': '深色',
            'Refresh Interval': '刷新间隔',
            'Menu Layout': '菜单布局',
            'Sidebar': '侧边栏',
            'Top Bar': '顶部栏',
            'Theme Color': '主题颜色',
            'Process Tree View': '进程树视图',
            'Show CPU Temperature': '显示 CPU 温度',
            'Reset to Defaults': '恢复默认',
            'Save': '保存',
            'Cancel': '取消',
            'Confirm': '确认',
            'Confirm Action': '确认操作',
            'End Process': '结束进程',
            'Search processes...': '搜索进程...',
            'Sort by CPU': '按 CPU 排序',
            'Sort by Memory': '按内存排序',
            'Sort by PID': '按 PID 排序',
            'Sort by Name': '按名称排序',
            'Show kernel threads': '显示内核线程',
            'Show user processes': '显示用户进程',
            'CPU Usage': 'CPU 使用率',
            'CPU Usage History': 'CPU 使用历史',
            'CPU%': 'CPU%',
            'Swap': '交换空间',
            'CPU History': 'CPU 历史记录',
            'Memory History': '内存历史记录',
            'Memory Usage History': '内存使用历史',
            'MEM%': 'MEM%',
            'Top Processes by CPU': 'CPU 占用最高的进程',
            'PID': 'PID',
            'Name': '名称',
            'User': '用户',
            'CPU %': 'CPU %',
            'Memory %': '内存 %',
            'PRI': '优先级',
            'NI': 'Nice',
            'VIRT': '虚拟内存',
            'RES': '驻留内存',
            'SHR': '共享内存',
            'S': '状态',
            'TIME+': '时间',
            'Command': '命令',
            'Load Average (1 min)': '平均负载 (1分钟)',
            'Load Average (5 min)': '平均负载 (5分钟)',
            'Load Average (15 min)': '平均负载 (15分钟)',
            'Physical Memory': '物理内存',
            'Used': '已用',
            'Cached': '缓存',
            'Free': '空闲',
            'Total': '总计',
            'Available': '可用',
            'Buffers': '缓冲',
            'Disk I/O': '磁盘 I/O',
            'Network Traffic': '网络流量',
            'Live': '实时',
            'Skip to main content': '跳转到主内容',
            'Vendor': '厂商',
            'Architecture': '架构',
            'Stepping': '步进',
            'CPU MHz': 'CPU 频率',
            'BogoMIPS': 'BogoMIPS',
            'L1d Cache': 'L1d 缓存',
            'L1i Cache': 'L1i 缓存',
            'L2 Cache': 'L2 缓存',
            'L3 Cache': 'L3 缓存',
            'Dirty': '脏页',
            'Writeback': '回写',
            'AnonPages': '匿名页',
            'Mapped': '映射页',
            'Slab': 'Slab',
            'Kernel Stack': '内核栈',
            'PageTables': '页表',
            'HugePages': '大页',
            'Voltage': '电压',
            'Power': '功耗',
            'Memory Hardware': '内存硬件',
            'Generation': '代数/类型',
            'Channels': '通道数',
            'Slots Used': '已用插槽',
            'GPU': 'GPU',
            'No GPU detected': '未检测到 GPU',
            'GPU Utilization History': 'GPU 利用率历史',
            'GPU Memory': 'GPU 显存',
            'GPU Processes': 'GPU 进程',
            'Process': '进程名',
            'Columns': '列设置',
            'Settings': '设置',
            'Close': '关闭',
            'Reset': '重置',
            'Kill Process': '结束进程',
            'Child Processes': '子进程',
            'Parent Process': '父进程',
            'No parent or child processes': '无父进程或子进程',
            'Path': '路径',
            'Type': '类型',
            'Priority': '优先级'
        },
        'en': {}
    };

    function t(key) {
        return (i18n[state.lang] && i18n[state.lang][key]) || key;
    }

    function updateI18n() {
        document.querySelectorAll('[translate="yes"]').forEach(el => {
            const key = el.textContent.trim();
            if (i18n[state.lang] && i18n[state.lang][key]) {
                el.textContent = i18n[state.lang][key];
            }
        });
        document.documentElement.lang = state.lang;
    }

    function loadSettings() {
        return new Promise((resolve) => {
            C.file(CONFIG_PATH).read()
                .done(content => {
                    try {
                        const saved = JSON.parse(content);
                        Object.assign(state, saved);
                    } catch (e) {}
                    resolve();
                })
                .fail(() => {
                    resolve();
                });
        });
    }

    function saveSettings() {
        const data = JSON.stringify(state, null, 2);
        try {
            localStorage.setItem('taskmgr-settings', data);
        } catch (e) {}
        C.file(CONFIG_PATH).replace(data)
            .done(() => {
                console.log('Settings saved');
            })
            .fail((err) => {
                console.error('Failed to save settings:', err);
            });
    }

    function init() {
        // Synchronous pre-load from localStorage to set body class immediately
        try {
            var s = localStorage.getItem('taskmgr-settings');
            if (s) {
                var cfg = JSON.parse(s);
                if (cfg.menuLayout) state.menuLayout = cfg.menuLayout;
                if (cfg.theme) state.theme = cfg.theme;
            }
        } catch(e) {}
        applyMenuLayout();

        // Then load full settings from Cockpit config (async)
        loadSettings().then(() => {
            applyTheme();
            applyAccentColor(state.accentColor);
            applyMenuLayout();
            applySidebarState();
            updateI18n();
            bindEvents();
            buildCpuGrid();
            buildGpuGrid();
            buildTopMenu();
            buildProcTableHead();
            initColSettings();
            initProcDetail();
            startMonitoring();
            showToast(t('Task Manager') + ' started', 'success');
        });
    }

    function applyTheme() {
        document.documentElement.setAttribute('data-theme', state.theme);
        const sunIcon = document.querySelector('.icon-sun');
        const moonIcon = document.querySelector('.icon-moon');
        if (state.theme === 'dark') {
            if (sunIcon) sunIcon.style.display = 'none';
            if (moonIcon) moonIcon.style.display = 'block';
        } else {
            if (sunIcon) sunIcon.style.display = 'block';
            if (moonIcon) moonIcon.style.display = 'none';
        }
    }

    function applyAccentColor(color) {
        state.accentColor = color;
        const rgb = hexToRgb(color);
        if (rgb) {
            document.documentElement.style.setProperty('--accent', color);
            const hoverR = Math.max(0, rgb.r - 20);
            const hoverG = Math.max(0, rgb.g - 20);
            const hoverB = Math.max(0, rgb.b - 20);
            document.documentElement.style.setProperty('--accent-hover', `rgb(${hoverR},${hoverG},${hoverB})`);
            document.documentElement.style.setProperty('--accent-light', `rgba(${rgb.r},${rgb.g},${rgb.b},0.1)`);
            document.documentElement.style.setProperty('--accent-glow', `rgba(${rgb.r},${rgb.g},${rgb.b},0.25)`);
        }
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    function applyMenuLayout() {
        const hamburger = document.getElementById('hamburgerBtn');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        
        if (state.menuLayout === 'top') {
            document.body.classList.add('menu-top');
            document.body.classList.remove('menu-side', 'sidebar-collapsed');
            if (sidebar) sidebar.classList.add('collapsed');
            if (overlay) overlay.classList.remove('show');
            if (hamburger) hamburger.style.display = 'none';
        } else {
            document.body.classList.remove('menu-top');
            document.body.classList.add('menu-side');
            if (sidebar) sidebar.classList.remove('collapsed');
            if (hamburger) hamburger.style.display = 'flex';
        }
    }

    function applySidebarState() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (state.sidebarOpen) {
            document.body.classList.remove('sidebar-collapsed');
            if (sidebar) sidebar.classList.remove('collapsed');
        } else {
            document.body.classList.add('sidebar-collapsed');
            if (sidebar) sidebar.classList.add('collapsed');
        }
    }

    function buildTopMenu() {
        const topMenuBar = document.getElementById('topMenuBar');
        if (!topMenuBar) return;

        const menuItems = document.querySelectorAll('.sidebar .menu-item');
        topMenuBar.innerHTML = '';
        
        menuItems.forEach(item => {
            const section = item.getAttribute('data-section');
            const icon = item.querySelector('.menu-icon');
            const label = item.querySelector('.menu-label');
            
            const topItem = document.createElement('div');
            topItem.className = 'menu-item' + (item.classList.contains('active') ? ' active' : '');
            topItem.setAttribute('data-section', section);
            topItem.innerHTML = `
                <span class="menu-icon">${icon ? icon.innerHTML : ''}</span>
                <span class="menu-label">${label ? label.textContent : ''}</span>
            `;
            topItem.addEventListener('click', () => setActiveSection(section));
            topMenuBar.appendChild(topItem);
        });
    }

    function setActiveSection(sectionId) {
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-section') === sectionId);
        });
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.toggle('active', section.id === 'sec-' + sectionId);
        });
    }

    function bindEvents() {
        const hamburger = document.getElementById('hamburgerBtn');
        const overlay = document.getElementById('sidebarOverlay');
        const themeBtn = document.getElementById('themeBtn');
        const layoutBtn = document.getElementById('layoutBtn');
        const langBtn = document.getElementById('langBtn');
        const refreshBtn = document.getElementById('refreshBtn');
        const settingsBtn = document.getElementById('settingsBtn');
        const closeSettingsBtn = document.getElementById('closeSettingsBtn');
        const saveSettingsBtn = document.getElementById('saveSettingsBtn');
        const resetSettingsBtn = document.getElementById('resetSettingsBtn');
        const langDropdown = document.getElementById('langDropdown');

        if (hamburger) hamburger.addEventListener('click', toggleSidebar);
        if (overlay) {
            overlay.addEventListener('click', () => {
                document.getElementById('sidebar')?.classList.remove('show');
                overlay.classList.remove('show');
            });
        }
        if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
        if (layoutBtn) layoutBtn.addEventListener('click', toggleLayout);
        if (langBtn) {
            langBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (langDropdown) langDropdown.classList.toggle('show');
            });
        }
        if (langDropdown) {
            langDropdown.querySelectorAll('.lang-dropdown-item').forEach(item => {
                item.addEventListener('click', () => {
                    const lang = item.getAttribute('data-lang');
                    state.lang = lang;
                    langDropdown.querySelectorAll('.lang-dropdown-item').forEach(i => {
                        i.classList.toggle('active', i.getAttribute('data-lang') === lang);
                    });
                    langDropdown.classList.remove('show');
                    updateI18n();
                    saveSettings();
                    showToast('Language changed', 'success');
                });
            });
        }
        document.addEventListener('click', (e) => {
            if (langDropdown && !langDropdown.contains(e.target) && e.target !== langBtn) {
                langDropdown.classList.remove('show');
            }
        });
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                updateAll();
                showToast('Refreshed', 'info');
            });
        }
        if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
        if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);
        if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettingsFromForm);
        if (resetSettingsBtn) resetSettingsBtn.addEventListener('click', resetSettings);

        document.querySelectorAll('.sidebar .menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const section = item.getAttribute('data-section');
                setActiveSection(section);
            });
        });

        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                const color = swatch.getAttribute('data-color') || swatch.value;
                if (color) {
                    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                    swatch.classList.add('active');
                    applyAccentColor(color);
                }
            });
        });

        const colorCustomPicker = document.getElementById('colorCustomPicker');
        if (colorCustomPicker) {
            colorCustomPicker.addEventListener('input', (e) => {
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
                colorCustomPicker.classList.add('active');
                applyAccentColor(e.target.value);
            });
        }

        const processSearch = document.getElementById('processSearch');
        const processSort = document.getElementById('processSort');
        const killProcessBtn = document.getElementById('killProcessBtn');
        const selectAllProcesses = document.getElementById('selectAllProcesses');
        const showKernelThreadsCb = document.getElementById('showKernelThreads');
        const showUserProcessesCb = document.getElementById('showUserProcesses');

        if (processSearch) {
            processSearch.addEventListener('input', (e) => {
                searchFilter = e.target.value.toLowerCase();
                renderProcessTable();
            });
        }
        if (processSort) {
            processSort.addEventListener('change', (e) => {
                sortBy = e.target.value;
                renderProcessTable();
            });
        }
        // Sortable headers are now bound dynamically in buildProcTableHead()
        
        if (killProcessBtn) killProcessBtn.addEventListener('click', killSelectedProcesses);
        // selectAllProcesses is now bound dynamically in buildProcTableHead()
        if (showKernelThreadsCb) {
            showKernelThreadsCb.addEventListener('change', (e) => {
                showKernelThreads = e.target.checked;
                renderProcessTable();
            });
        }
        if (showUserProcessesCb) {
            showUserProcessesCb.addEventListener('change', (e) => {
                showUserProcesses = e.target.checked;
                renderProcessTable();
            });
        }

        document.getElementById('confirmCancelBtn')?.addEventListener('click', closeConfirm);
        document.getElementById('confirmOkBtn')?.addEventListener('click', confirmAction);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSettings();
                closeConfirm();
                if (langDropdown) langDropdown.classList.remove('show');
            }
        });
    }

    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            sidebar?.classList.toggle('show');
            overlay?.classList.toggle('show');
        } else {
            state.sidebarOpen = !state.sidebarOpen;
            applySidebarState();
            saveSettings();
        }
    }

    function toggleTheme() {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        applyTheme();
        applyAccentColor(state.accentColor);
        saveSettings();
    }

    function toggleLayout() {
        state.menuLayout = state.menuLayout === 'side' ? 'top' : 'side';
        applyMenuLayout();
        buildTopMenu();
        saveSettings();
        showToast('Layout changed', 'info');
    }

    function openSettings() {
        const modal = document.getElementById('settingsModal');
        const settingLang = document.getElementById('settingLang');
        const settingTheme = document.getElementById('settingTheme');
        const refreshIntervalSelect = document.getElementById('refreshInterval');
        const menuLayoutSelect = document.getElementById('menuLayout');
        const showCpuTempToggle = document.getElementById('showCpuTemp');

        if (settingLang) settingLang.value = state.lang;
        if (settingTheme) settingTheme.value = state.theme;
        if (refreshIntervalSelect) refreshIntervalSelect.value = state.refreshInterval;
        if (menuLayoutSelect) menuLayoutSelect.value = state.menuLayout;
        if (showCpuTempToggle) showCpuTempToggle.checked = state.showCpuTemp;

        document.querySelectorAll('.color-swatch').forEach(swatch => {
            const color = swatch.getAttribute('data-color');
            swatch.classList.toggle('active', color === state.accentColor);
        });

        if (modal) modal.classList.add('show');
    }

    function closeSettings() {
        document.getElementById('settingsModal')?.classList.remove('show');
    }

    function saveSettingsFromForm() {
        const settingLang = document.getElementById('settingLang');
        const settingTheme = document.getElementById('settingTheme');
        const refreshIntervalSelect = document.getElementById('refreshInterval');
        const menuLayoutSelect = document.getElementById('menuLayout');
        const showCpuTempToggle = document.getElementById('showCpuTemp');

        if (settingLang) {
            state.lang = settingLang.value;
            updateI18n();
            const langDropdown = document.getElementById('langDropdown');
            if (langDropdown) {
                langDropdown.querySelectorAll('.lang-dropdown-item').forEach(i => {
                    i.classList.toggle('active', i.getAttribute('data-lang') === state.lang);
                });
            }
        }
        if (settingTheme) {
            state.theme = settingTheme.value;
            applyTheme();
            applyAccentColor(state.accentColor);
        }
        if (refreshIntervalSelect) {
            state.refreshInterval = parseInt(refreshIntervalSelect.value);
            restartMonitoring();
        }
        if (menuLayoutSelect) {
            state.menuLayout = menuLayoutSelect.value;
            applyMenuLayout();
            buildTopMenu();
        }
        if (showCpuTempToggle) state.showCpuTemp = showCpuTempToggle.checked;

        saveSettings();
        closeSettings();
        showToast('Settings saved', 'success');
    }

    function resetSettings() {
        Object.assign(state, defaultSettings);
        applyTheme();
        applyAccentColor(state.accentColor);
        applyMenuLayout();
        applySidebarState();
        updateI18n();
        restartMonitoring();
        openSettings();
        saveSettings();
        showToast('Settings reset', 'info');
    }

    let confirmCallback = null;

    function showConfirm(title, message, callback) {
        const dialog = document.getElementById('confirmDialog');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;
        if (dialog) dialog.classList.add('show');
        confirmCallback = callback;
    }

    function closeConfirm() {
        document.getElementById('confirmDialog')?.classList.remove('show');
        confirmCallback = null;
    }

    function confirmAction() {
        if (confirmCallback) confirmCallback();
        closeConfirm();
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;

        toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    function startMonitoring() {
        // Delay first update to ensure DOM is fully laid out
        setTimeout(function() {
            updateAll();
            refreshTimer = setInterval(updateAll, state.refreshInterval);
        }, 300);
    }

    function restartMonitoring() {
        if (refreshTimer) clearInterval(refreshTimer);
        startMonitoring();
    }

    function updateAll() {
        updateCpu();
        updateMemory();
        updateProcesses();
        updateDisk();
        updateNetwork();
        updateUptime();
        updateGpu();
    }

    let cpuCorePrev = [];
    let cpuGridReady = false;
    let gpuDetected = false;
    let gpuHistory = { gpu: [], mem: [], enc: [], dec: [] };
    const gpuHistoryLength = 60;

    function updateCpu() {
        C.spawn(['cat', '/proc/stat'])
            .done(data => {
                const lines = data.split('\n');
                const cpuLine = lines[0];
                const parts = cpuLine.split(/\s+/);
                const user = parseInt(parts[1]);
                const nice = parseInt(parts[2]);
                const system = parseInt(parts[3]);
                const idle = parseInt(parts[4]);
                const iowait = parseInt(parts[5]) || 0;
                const total = user + nice + system + idle + iowait;
                const used = user + nice + system;
                const usage = total > 0 ? ((used / total) * 100).toFixed(1) : 0;

                document.getElementById('cpuUsageValue').textContent = usage + '%';

                cpuHistory.push(parseFloat(usage));
                if (cpuHistory.length > historyLength) cpuHistory.shift();

                updateCpuChart();

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i];
                    if (!line.startsWith('cpu')) break;
                    
                    const coreParts = line.split(/\s+/);
                    const coreId = coreParts[0].replace('cpu', '');
                    if (coreId === '') continue;
                    
                    const coreUser = parseInt(coreParts[1]);
                    const coreNice = parseInt(coreParts[2]);
                    const coreSystem = parseInt(coreParts[3]);
                    const coreIdle = parseInt(coreParts[4]);
                    const coreIowait = parseInt(coreParts[5]) || 0;
                    const coreTotal = coreUser + coreNice + coreSystem + coreIdle + coreIowait;
                    const coreUsed = coreUser + coreNice + coreSystem;
                    
                    if (!cpuCorePrev[coreId]) {
                        cpuCorePrev[coreId] = { total: 0, used: 0 };
                    }
                    
                    const deltaTotal = coreTotal - cpuCorePrev[coreId].total;
                    const deltaUsed = coreUsed - cpuCorePrev[coreId].used;
                    const coreUsage = deltaTotal > 0 ? ((deltaUsed / deltaTotal) * 100).toFixed(1) : 0;
                    
                    cpuCorePrev[coreId] = { total: coreTotal, used: coreUsed };
                    
                    if (cpuGridReady) {
                        const threadEl = document.getElementById(`cpu-thread-${coreId}`);
                        if (threadEl) {
                            const fill = threadEl.querySelector('.cpu-thread-fill');
                            const value = threadEl.querySelector('.cpu-thread-value');
                            if (fill) fill.style.width = coreUsage + '%';
                            if (value) value.textContent = coreUsage + '%';
                        }
                        
                        const coreIdNum = parseInt(coreId);
                        if (!isNaN(coreIdNum)) {
                            if (!cpuCoreHistory[coreIdNum]) cpuCoreHistory[coreIdNum] = [];
                            cpuCoreHistory[coreIdNum].push(parseFloat(coreUsage));
                            if (cpuCoreHistory[coreIdNum].length > historyLength) {
                                cpuCoreHistory[coreIdNum].shift();
                            }
                            
                            const historyValueEl = document.getElementById(`cpu-history-value-${coreIdNum}`);
                            if (historyValueEl) historyValueEl.textContent = coreUsage + '%';
                        }
                    }
                }
                
                if (cpuGridReady) {
                    requestAnimationFrame(() => {
                        for (let i = 0; i < cpuCoreHistory.length; i++) {
                            if (cpuCoreHistory[i] && cpuCoreHistory[i].length >= 2) {
                                const historyChartEl = document.getElementById(`cpu-history-chart-${i}`);
                                if (historyChartEl) {
                                    drawCoreSvgChart(historyChartEl, cpuCoreHistory[i], state.accentColor || '#4f6ef7', 100);
                                }
                            }
                        }
                    });
                }
            });

        C.spawn(['cat', '/proc/loadavg'])
            .done(data => {
                const parts = data.split(/\s+/);
                document.getElementById('loadAvg1').textContent = parts[0];
                document.getElementById('loadAvg5').textContent = parts[1];
                document.getElementById('loadAvg15').textContent = parts[2];
            });

        C.spawn(['cat', '/proc/cpuinfo'])
            .done(data => {
                const lines = data.split('\n');
                let model = '';
                let vendor = '';
                let cores = 0;
                let stepping = '';
                let cpuFamily = '';
                let bogomips = '';
                let cpuFlags = '';
                const freqMap = {};
                let currentProc = -1;
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.startsWith('model name')) model = line.split(':')[1].trim();
                    if (line.startsWith('vendor_id')) vendor = line.split(':')[1].trim();
                    if (line.startsWith('cpu family')) cpuFamily = line.split(':')[1].trim();
                    if (line.startsWith('stepping')) stepping = line.split(':')[1].trim();
                    if (line.startsWith('bogomips')) bogomips = line.split(':')[1].trim();
                    if (line.startsWith('flags') && !cpuFlags) cpuFlags = line.split(':')[1].trim();
                    if (line.startsWith('processor')) {
                        currentProc = parseInt(line.split(':')[1].trim());
                        cores++;
                    }
                    if (line.startsWith('cpu MHz') && currentProc >= 0) {
                        const freq = parseFloat(line.split(':')[1].trim());
                        freqMap[currentProc] = freq;
                    }
                }
                
                document.getElementById('cpuModel').textContent = model || 'Unknown CPU';
                document.getElementById('cpuCores').textContent = `${cores} cores`;
                document.getElementById('cpuVendor').textContent = vendor || '--';
                document.getElementById('cpuArch').textContent = cpuFamily ? `Family ${cpuFamily}` : '--';
                document.getElementById('cpuStepping').textContent = stepping || '--';
                document.getElementById('cpuBogomips').textContent = bogomips || '--';
                
                const freqValues = Object.values(freqMap);
                if (freqValues.length > 0) {
                    const minFreq = Math.round(Math.min(...freqValues));
                    const maxFreq = Math.round(Math.max(...freqValues));
                    document.getElementById('cpuMhz').textContent = minFreq === maxFreq ? `${minFreq} MHz` : `${minFreq} - ${maxFreq} MHz`;
                }
                
                for (let i = 0; i < cores; i++) {
                    const freqEl = document.getElementById(`cpu-freq-${i}`);
                    if (freqEl && freqMap[i]) {
                        freqEl.textContent = `${Math.round(freqMap[i])} MHz`;
                    }
                }

                // CPU ISA instruction set tags
                if (cpuFlags) {
                    const flags = cpuFlags.split(' ');
                    const isaList = [
                        { tag: 'SSE', test: f => f === 'sse' },
                        { tag: 'SSE2', test: f => f === 'sse2' },
                        { tag: 'SSE3', test: f => f === 'sse3' },
                        { tag: 'SSSE3', test: f => f === 'ssse3' },
                        { tag: 'SSE4.1', test: f => f === 'sse4_1' },
                        { tag: 'SSE4.2', test: f => f === 'sse4_2' },
                        { tag: 'AVX', test: f => f === 'avx' },
                        { tag: 'AVX2', test: f => f === 'avx2' },
                        { tag: 'AVX-512', test: f => f.startsWith('avx512') },
                        { tag: 'AES-NI', test: f => f === 'aes' },
                        { tag: 'BMI1', test: f => f === 'bmi1' },
                        { tag: 'BMI2', test: f => f === 'bmi2' },
                        { tag: 'FMA', test: f => f === 'fma' },
                        { tag: 'F16C', test: f => f === 'f16c' },
                        { tag: 'PCLMULQDQ', test: f => f === 'pclmulqdq' },
                        { tag: 'ADX', test: f => f === 'adx' },
                        { tag: 'SHA', test: f => f === 'sha_ni' },
                        { tag: 'VAES', test: f => f === 'vaes' },
                        { tag: 'VPCLMULQDQ', test: f => f === 'vpclmulqdq' },
                        { tag: 'GFNI', test: f => f === 'gfni' },
                        { tag: 'AMX-BF16', test: f => f === 'amx-bf16' },
                        { tag: 'AMX-INT8', test: f => f === 'amx-int8' },
                        { tag: 'AMX-TILE', test: f => f === 'amx-tile' },
                        { tag: 'SVM', test: f => f === 'svm' },
                        { tag: 'VMX', test: f => f === 'vmx' },
                    ];
                    const matched = [];
                    for (const isa of isaList) {
                        if (flags.some(f => isa.test(f))) matched.push(isa.tag);
                    }
                    const container = document.getElementById('cpuISA');
                    if (container && matched.length > 0) {
                        container.innerHTML = matched.map(t => '<span class="isa-tag">' + t + '</span>').join('');
                    }
                }
            });

        // CPU power from RAPL
        C.spawn(['sh', '-c',
            'POWER="";' +
            'for d in /sys/class/powercap/intel-rapl:0 /sys/class/powercap/intel-rapl:0:0; do' +
            '  if [ -f "$d/energy_uj" ]; then' +
            '    e1=$(cat "$d/energy_uj" 2>/dev/null);' +
            '    sleep 1;' +
            '    e2=$(cat "$d/energy_uj" 2>/dev/null);' +
            '    max=$(cat "$d/max_energy_range_uj" 2>/dev/null);' +
            '    if [ -n "$e1" ] && [ -n "$e2" ]; then' +
            '      if [ "$e2" -lt "$e1" ] 2>/dev/null; then e2=$((e2 + max)); fi;' +
            '      POWER=$(echo "scale=1; ($e2 - $e1) / 1000000" | bc 2>/dev/null);' +
            '      echo "${POWER}W"; exit 0;' +
            '    fi;' +
            '  fi;' +
            'done'
        ]).done(data => {
            var p = (data || '').trim();
            if (p) document.getElementById('cpuPower').textContent = p;
        });

        C.spawn(['sensors'])
            .done(data => {
                const lines = data.split('\n');
                let currentCore = -1;
                
                for (const line of lines) {
                    const coreMatch = line.match(/^Core\s+(\d+):\s+\+([\d.]+)°C/);
                    if (coreMatch) {
                        const coreId = parseInt(coreMatch[1]);
                        const temp = parseFloat(coreMatch[2]);
                        const tempEl = document.getElementById(`cpu-core-temp-${coreId}`);
                        if (tempEl) {
                            tempEl.textContent = `${temp.toFixed(1)}°C`;
                        }
                    }
                }
            })
            .fail(() => {
                C.spawn(['cat', '/sys/class/thermal/thermal_zone0/temp'])
                    .done(data => {
                        const temp = parseInt(data.trim()) / 1000;
                        const tempEl = document.getElementById('cpu-core-temp-0');
                        if (tempEl && !isNaN(temp)) {
                            tempEl.textContent = `${temp.toFixed(1)}°C`;
                        }
                    })
                    .fail(() => {});
            });
    }

    function buildCpuGrid() {
        // Use sysfs topology to reliably detect physical cores and threads
        C.spawn(['sh', '-c',
            'nproc 2>/dev/null || nproc' +
            ' && ls -d /sys/devices/system/cpu/cpu[0-9]* 2>/dev/null | wc -l' +
            ' && for c in /sys/devices/system/cpu/cpu[0-9]*; do' +
            '   [ -f "$c/topology/core_id" ] && cat "$c/topology/core_id";' +
            ' done | sort -un | wc -l'
        ]).done(data => {
                const lines = data.trim().split('\n');
                const totalThreads = parseInt(lines[0]) || 1;
                const sysfsCount = parseInt(lines[1]) || totalThreads;
                const uniqueCoreIds = parseInt(lines[2]) || 0;

                // Determine threads per core
                if (uniqueCoreIds > 0 && uniqueCoreIds < totalThreads) {
                    threadsPerCore = Math.round(totalThreads / uniqueCoreIds);
                    physicalCores = uniqueCoreIds;
                } else {
                    // Fallback: try lscpu, then assume no HT
                    threadsPerCore = 1;
                    physicalCores = totalThreads;
                }
                if (physicalCores < 1) physicalCores = 1;
                if (threadsPerCore < 1) threadsPerCore = 1;
                
                const grid = document.getElementById('cpuGrid');
                const historyGrid = document.getElementById('cpuHistoryGrid');
                
                if (!grid) return;
                grid.innerHTML = '';
                if (historyGrid) historyGrid.innerHTML = '';
                
                cpuCoreHistory = [];
                for (let i = 0; i < totalThreads; i++) {
                    cpuCoreHistory[i] = [];
                }
                
                for (let core = 0; core < physicalCores; core++) {
                    const group = document.createElement('div');
                    group.className = 'cpu-core-group';
                    group.id = `cpu-core-group-${core}`;
                    
                    let threadsHtml = '';
                    for (let t = 0; t < threadsPerCore; t++) {
                        const threadId = core * threadsPerCore + t;
                        threadsHtml += `
                            <div class="cpu-thread" id="cpu-thread-${threadId}">
                                <div class="cpu-thread-label">Thread ${t}</div>
                                <div class="cpu-thread-bar"><div class="cpu-thread-fill" style="width: 0%"></div></div>
                                <div class="cpu-thread-value">0%</div>
                                <div class="cpu-thread-freq" id="cpu-freq-${threadId}">-- MHz</div>
                            </div>
                        `;
                    }
                    
                    group.innerHTML = `
                        <div class="cpu-core-group-header">
                            <span class="cpu-core-group-label">Core ${core}</span>
                            <span class="cpu-core-group-temp" id="cpu-core-temp-${core}">--°C</span>
                        </div>
                        <div class="cpu-threads-grid">${threadsHtml}</div>
                    `;
                    grid.appendChild(group);
                    
                    if (historyGrid) {
                        for (let t = 0; t < threadsPerCore; t++) {
                            const threadId = core * threadsPerCore + t;
                            const historyCard = document.createElement('div');
                            historyCard.className = 'cpu-history-card';
                            historyCard.innerHTML = `
                                <div class="cpu-history-header">
                                    <span class="cpu-history-label">C${core}T${t}</span>
                                    <span class="cpu-history-value" id="cpu-history-value-${threadId}">0%</span>
                                </div>
                                <div class="cpu-history-chart" id="cpu-history-chart-${threadId}"></div>
                            `;
                            historyGrid.appendChild(historyCard);
                        }
                    }
                }
                
                setTimeout(() => {
                    for (let i = 0; i < totalThreads; i++) {
                        var el = document.getElementById(`cpu-history-chart-${i}`);
                        if (el && cpuCoreHistory[i] && cpuCoreHistory[i].length >= 2) {
                            drawCoreSvgChart(el, cpuCoreHistory[i], state.accentColor || '#4f6ef7', 100);
                        }
                    }
                    cpuGridReady = true;
                }, 200);
            })
            .fail(() => {
                // Fallback: build grid using /proc/cpuinfo only
                C.spawn(['sh', '-c', 'grep -c ^processor /proc/cpuinfo'])
                    .done(data => {
                        const totalThreads = parseInt(data.trim()) || 1;
                        threadsPerCore = 1;
                        physicalCores = totalThreads;
                        buildCpuGridFromCount(totalThreads);
                        cpuGridReady = true;
                    })
                    .fail(() => {
                        // Last resort: assume 1 core
                        threadsPerCore = 1;
                        physicalCores = 1;
                        buildCpuGridFromCount(1);
                        cpuGridReady = true;
                    });
            });
    }

    function buildCpuGridFromCount(totalThreads) {
        const grid = document.getElementById('cpuGrid');
        const historyGrid = document.getElementById('cpuHistoryGrid');

        if (!grid) return;
        grid.innerHTML = '';
        if (historyGrid) historyGrid.innerHTML = '';

        cpuCoreHistory = [];
        for (let i = 0; i < totalThreads; i++) {
            cpuCoreHistory[i] = [];
        }

        for (let i = 0; i < totalThreads; i++) {
            const group = document.createElement('div');
            group.className = 'cpu-core-group';
            group.id = `cpu-core-group-${i}`;

            group.innerHTML = `
                <div class="cpu-core-group-header">
                    <span class="cpu-core-group-label">Core ${i}</span>
                    <span class="cpu-core-group-temp" id="cpu-core-temp-${i}">--°C</span>
                </div>
                <div class="cpu-threads-grid">
                    <div class="cpu-thread" id="cpu-thread-${i}">
                        <div class="cpu-thread-label">Thread 0</div>
                        <div class="cpu-thread-bar"><div class="cpu-thread-fill" style="width: 0%"></div></div>
                        <div class="cpu-thread-value">0%</div>
                        <div class="cpu-thread-freq" id="cpu-freq-${i}">-- MHz</div>
                    </div>
                </div>
            `;
            grid.appendChild(group);

            if (historyGrid) {
                const historyCard = document.createElement('div');
                historyCard.className = 'cpu-history-card';
                historyCard.innerHTML = `
                    <div class="cpu-history-header">
                        <span class="cpu-history-label">CPU ${i}</span>
                        <span class="cpu-history-value" id="cpu-history-value-${i}">0%</span>
                    </div>
                    <div class="cpu-history-chart" id="cpu-history-chart-${i}"></div>
                `;
                historyGrid.appendChild(historyCard);
            }
        }
    }

    function updateMemory() {
        C.spawn(['cat', '/proc/meminfo'])
            .done(data => {
                const lines = data.split('\n');
                const mem = {};
                for (const line of lines) {
                    const parts = line.split(':');
                    if (parts.length === 2) {
                        const key = parts[0].trim();
                        const value = parseInt(parts[1].trim()) * 1024;
                        mem[key] = value;
                    }
                }

                const total = mem['MemTotal'] || 0;
                const free = mem['MemFree'] || 0;
                const available = mem['MemAvailable'] || free;
                const buffers = mem['Buffers'] || 0;
                const cached = mem['Cached'] || 0;
                const used = total - available;
                const swapTotal = mem['SwapTotal'] || 0;
                const swapFree = mem['SwapFree'] || 0;
                const swapUsed = swapTotal - swapFree;

                const formatGB = (bytes) => (bytes / (1024 * 1024 * 1024)).toFixed(1);

                document.getElementById('memUsageValue').textContent = `${formatGB(used)} / ${formatGB(total)} GB`;
                document.getElementById('swapUsageValue').textContent = `${formatGB(swapUsed)} / ${formatGB(swapTotal)} GB`;
                document.getElementById('memTotal').textContent = formatGB(total) + ' GB';
                document.getElementById('memUsed').textContent = formatGB(used) + ' GB';
                document.getElementById('memFree').textContent = formatGB(free) + ' GB';
                document.getElementById('memAvailable').textContent = formatGB(available) + ' GB';
                document.getElementById('memCached').textContent = formatGB(cached) + ' GB';
                document.getElementById('memBuffers').textContent = formatGB(buffers) + ' GB';
                document.getElementById('swapTotal').textContent = formatGB(swapTotal) + ' GB';
                document.getElementById('swapUsed').textContent = formatGB(swapUsed) + ' GB';
                document.getElementById('swapFree').textContent = formatGB(swapFree) + ' GB';

                const formatMB = (bytes) => (bytes / (1024 * 1024)).toFixed(1);
                document.getElementById('memDirty').textContent = formatMB(mem['Dirty'] || 0) + ' MB';
                document.getElementById('memWriteback').textContent = formatMB(mem['Writeback'] || 0) + ' MB';
                document.getElementById('memAnonPages').textContent = formatMB(mem['AnonPages'] || 0) + ' MB';
                document.getElementById('memMapped').textContent = formatMB(mem['Mapped'] || 0) + ' MB';
                document.getElementById('memSlab').textContent = formatMB(mem['Slab'] || 0) + ' MB';
                document.getElementById('memKernelStack').textContent = formatMB(mem['KernelStack'] || 0) + ' MB';
                document.getElementById('memPageTables').textContent = formatMB(mem['PageTables'] || 0) + ' MB';

                const hugeTotal = mem['HugePages_Total'] || 0;
                const hugeFree = mem['HugePages_Free'] || 0;
                const hugeSize = mem['Hugepagesize'] || 0;
                if (hugeTotal > 0) {
                    document.getElementById('memHugePages').textContent = `${hugeFree}/${hugeTotal} (${formatMB(hugeSize)}/page)`;
                } else {
                    document.getElementById('memHugePages').textContent = 'Disabled';
                }

                if (total > 0) {
                    document.getElementById('memBarUsed').style.width = ((used / total) * 100) + '%';
                    document.getElementById('memBarCached').style.width = ((cached / total) * 100) + '%';
                }
                if (swapTotal > 0) {
                    document.getElementById('swapBarUsed').style.width = ((swapUsed / swapTotal) * 100) + '%';
                }

                const memPercent = total > 0 ? ((used / total) * 100).toFixed(1) : 0;
                memHistory.push(parseFloat(memPercent));
                if (memHistory.length > historyLength) memHistory.shift();

                const swapPercent = swapTotal > 0 ? ((swapUsed / swapTotal) * 100).toFixed(1) : 0;
                swapHistory.push(parseFloat(swapPercent));
                if (swapHistory.length > historyLength) swapHistory.shift();

                updateMemChart();
                updateMemDetailChart();
            });

        updateMemoryHardware();
        updateSwapInfo();
    }

    function updateSwapInfo() {
        C.spawn(['cat', '/proc/swaps'])
            .done(data => {
                if (!data) return;
                var lines = data.split('\n').slice(1); // skip header
                for (var i = 0; i < lines.length; i++) {
                    var parts = lines[i].trim().split(/\s+/);
                    if (parts.length >= 5) {
                        document.getElementById('swapPath').textContent = parts[0] || '--';
                        document.getElementById('swapType').textContent = parts[1] || '--';
                        document.getElementById('swapPriority').textContent = parts[4] || '--';
                        break;
                    }
                }
            });
    }

    function updateMemoryHardware() {
        C.spawn(['sh', '-c', 'dmidecode -t memory 2>/dev/null || true'])
            .done(data => {
                if (!data || data.indexOf('No SMBIOS') !== -1 || data.indexOf('Permission denied') !== -1) {
                    C.spawn(['sh', '-c',
                        'GEN=$(cat /sys/devices/system/memory/block_size_bytes 2>/dev/null);' +
                        'SLOTS=$(ls -d /sys/devices/system/memory/memory* 2>/dev/null | wc -l);' +
                        'echo "BLOCK_SIZE:$GEN"; echo "SLOTS:$SLOTS"'
                    ]).done(d => {
                        const lines = d.trim().split('\n');
                        for (const l of lines) {
                            if (l.startsWith('BLOCK_SIZE:')) {
                                const sz = parseInt(l.split(':')[1], 16);
                                if (sz > 0) document.getElementById('memGeneration').textContent = 'Block: ' + (sz / 1024 / 1024).toFixed(0) + ' MB';
                            }
                            if (l.startsWith('SLOTS:')) {
                                const n = parseInt(l.split(':')[1]);
                                if (n > 0) document.getElementById('memSlots').textContent = n + ' regions';
                            }
                        }
                    });
                    return;
                }

                const lines = data.split('\n');
                let slots = [];
                let currentSlot = null;
                let totalSlots = 0;
                let usedSlots = 0;
                let memType = '';
                let memSpeed = '';
                let memVoltage = '';
                let channelCount = 0;
                const channelSet = new Set();

                for (const line of lines) {
                    if (line.indexOf('Memory Device') !== -1) {
                        if (currentSlot) slots.push(currentSlot);
                        currentSlot = { size: '', type: '', speed: '', manufacturer: '', part: '', voltage: '', locator: '' };
                        totalSlots++;
                    }
                    if (!currentSlot) continue;
                    const m = line.match(/^\s+([^:]+):\s*(.*)$/);
                    if (!m) continue;
                    const key = m[1].trim();
                    const val = m[2].trim();
                    if (key === 'Size' && val !== 'No Module Installed' && val !== '') {
                        currentSlot.size = val;
                        usedSlots++;
                    }
                    if (key === 'Type' && val && !memType) memType = val;
                    if (key === 'Type Detail') currentSlot.type = val;
                    if (key === 'Speed' && val && !memSpeed) memSpeed = val;
                    if (key === 'Configured Voltage' && val && !memVoltage) memVoltage = val;
                    if (key === 'Manufacturer') currentSlot.manufacturer = val;
                    if (key === 'Part Number') currentSlot.part = val;
                    if (key === 'Locator') currentSlot.locator = val;
                    if (key === 'Bank Locator' && val) channelSet.add(val);
                }
                if (currentSlot) slots.push(currentSlot);

                if (memType) document.getElementById('memGeneration').textContent = memType;
                if (channelSet.size > 0) document.getElementById('memChannels').textContent = channelSet.size + ' channels';
                document.getElementById('memSlots').textContent = usedSlots + ' / ' + totalSlots;
                if (memVoltage) document.getElementById('memVoltage').textContent = memVoltage;

                const slotList = document.getElementById('memSlotList');
                if (slotList) {
                    slotList.innerHTML = slots
                        .filter(s => s.size)
                        .map(s => {
                            const sizeMatch = s.size.match(/(\d+\s*\S+)/);
                            const size = sizeMatch ? sizeMatch[1] : s.size;
                            const brand = (s.manufacturer && s.manufacturer !== 'Unknown' ? s.manufacturer : '') +
                                          (s.part && s.part !== 'Unknown' ? ' ' + s.part : '');
                            return '<div class="mem-slot-row">' +
                                '<span class="mem-slot-id">' + (s.locator || 'Slot') + '</span>' +
                                '<span class="mem-slot-info">' + (brand || s.type || memType || '--') + '</span>' +
                                '<span class="mem-slot-size">' + size + '</span>' +
                                '<span class="mem-slot-freq">' + (s.speed || memSpeed || '--') + '</span>' +
                                '</div>';
                        }).join('');
                }
            })
            .fail(() => {
                document.getElementById('memGeneration').textContent = 'N/A';
                document.getElementById('memSlots').textContent = 'N/A';
            });
    }

    // ==================== GPU ====================

    var gpuList = []; // populated by buildGpuGrid
    var gpuProcCounter = 0;

    function buildGpuGrid() {
        // Detect GPUs via sysfs + lspci (works for Intel, AMD, NVIDIA)
        C.spawn(['sh', '-c',
            'GPU_LIST="";' +
            'for card in /sys/class/drm/card[0-9]*; do' +
            '  [ -f "$card/device/vendor" ] || continue;' +
            '  VENDOR=$(cat "$card/device/vendor" 2>/dev/null);' +
            '  DEV=$(basename "$card");' +
            '  PCI=$(readlink -f "$card/device" 2>/dev/null | sed "s|.*/||");' +
            '  NAME=$(lspci -s "$PCI" 2>/dev/null | sed "s/^[^:]*: //");' +
            '  GPU_LIST="$GPU_LIST$DEV|$VENDOR|$PCI|$NAME\n";' +
            'done;' +
            'echo "$GPU_LIST";' +
            'nvidia-smi --query-gpu=index,name,pci.bus_id,driver_version --format=csv,noheader 2>/dev/null | while read line; do' +
            '  echo "nvidia|$line";' +
            'done'
        ]).done(data => {
            const noDev = document.getElementById('gpuNoDevice');
            const content = document.getElementById('gpuContent');

            if (!data || !data.trim()) {
                if (noDev) noDev.style.display = 'flex';
                if (content) content.style.display = 'none';
                return;
            }

            gpuList = [];
            const seen = new Set();
            const lines = data.trim().split('\n');

            for (const line of lines) {
                if (!line.trim()) continue;

                if (line.startsWith('nvidia|')) {
                    // NVIDIA GPU from nvidia-smi
                    const p = line.substring(7).split(', ').map(s => s.trim());
                    const key = 'nvidia-' + p[0];
                    if (seen.has(key)) continue;
                    seen.add(key);
                    gpuList.push({
                        id: p[0], vendor: 'nvidia', name: p[1], bus: p[2],
                        driver: p[3], type: 'nvidia'
                    });
                } else {
                    // GPU from sysfs (Intel/AMD/other)
                    const p = line.split('|');
                    if (p.length < 4) continue;
                    const card = p[0];
                    const vendor = p[1];
                    const pci = p[2];
                    const name = p[3];
                    const cardNum = card.replace('card', '');
                    const key = 'sysfs-' + pci;
                    if (seen.has(key)) continue;
                    seen.add(key);

                    let v = 'unknown';
                    if (vendor === '0x8086') v = 'intel';
                    else if (vendor === '0x1002') v = 'amd';
                    else if (vendor === '0x10de') v = 'nvidia';

                    gpuList.push({
                        id: cardNum, vendor: v, name: name || 'GPU ' + cardNum,
                        bus: pci, driver: '', type: 'sysfs', card: card
                    });
                }
            }

            if (gpuList.length === 0) {
                if (noDev) noDev.style.display = 'flex';
                if (content) content.style.display = 'none';
                return;
            }

            gpuDetected = true;
            if (noDev) noDev.style.display = 'none';
            if (content) content.style.display = 'block';

            const driverEl = document.getElementById('gpuDriver');
            const drivers = gpuList.map(g => g.driver).filter(Boolean);
            if (driverEl) driverEl.textContent = drivers.length > 0 ? 'Driver: ' + drivers[0] : '';

            // Stat cards
            const statGrid = document.getElementById('gpuStatGrid');
            if (statGrid) {
                statGrid.innerHTML =
                    '<div class="stat-card"><div class="stat-icon stat-icon-gpu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"></rect><line x1="6" y1="10" x2="18" y2="10"></line></svg></div><div class="stat-info"><div class="stat-label">GPU</div><div class="stat-value" id="gpuMainUsage">--%</div></div><div class="stat-chart" id="gpuMiniChart"></div></div>' +
                    '<div class="stat-card"><div class="stat-icon stat-icon-temp"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path></svg></div><div class="stat-info"><div class="stat-label">Temp</div><div class="stat-value" id="gpuMainTemp">--°C</div></div></div>' +
                    '<div class="stat-card"><div class="stat-icon stat-icon-power"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></div><div class="stat-info"><div class="stat-label">Power</div><div class="stat-value" id="gpuMainPower">-- W</div></div></div>' +
                    '<div class="stat-card"><div class="stat-icon stat-icon-fan"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"></path></svg></div><div class="stat-info"><div class="stat-label">Fan</div><div class="stat-value" id="gpuMainFan">--%</div></div></div>';
            }

            // Per-GPU cards
            const grid = document.getElementById('gpuGrid');
            if (grid) {
                grid.innerHTML = gpuList.map(g => `
                    <div class="gpu-card" id="gpu-card-${g.id}">
                        <div class="gpu-card-header">
                            <span class="gpu-card-title">${g.name}</span>
                            <span class="gpu-card-bus">${g.bus} [${g.vendor}]</span>
                        </div>
                        <div class="gpu-metrics-row">
                            <div class="gpu-metric"><div class="gpu-metric-label">GPU Clock</div><div class="gpu-metric-value" id="gpu-smclk-${g.id}">--</div><div class="gpu-metric-unit">MHz</div></div>
                            <div class="gpu-metric"><div class="gpu-metric-label">Mem Clock</div><div class="gpu-metric-value" id="gpu-memclk-${g.id}">--</div><div class="gpu-metric-unit">MHz</div></div>
                            <div class="gpu-metric"><div class="gpu-metric-label">Temp</div><div class="gpu-metric-value" id="gpu-temp-${g.id}">--</div><div class="gpu-metric-unit">°C</div></div>
                            <div class="gpu-metric"><div class="gpu-metric-label">Power</div><div class="gpu-metric-value" id="gpu-power-${g.id}">--</div><div class="gpu-metric-unit">W</div></div>
                            <div class="gpu-metric"><div class="gpu-metric-label">Fan</div><div class="gpu-metric-value" id="gpu-fan-${g.id}">--</div><div class="gpu-metric-unit">%</div></div>
                            <div class="gpu-metric"><div class="gpu-metric-label">P-State</div><div class="gpu-metric-value" id="gpu-pstate-${g.id}">--</div></div>
                        </div>
                        <div class="gpu-bar-container">
                            <div class="gpu-bar-label"><span class="gpu-bar-label-name">GPU Utilization</span><span class="gpu-bar-label-value" id="gpu-gpuval-${g.id}">0%</span></div>
                            <div class="gpu-bar"><div class="gpu-bar-fill" id="gpu-gpubar-${g.id}" style="width:0%"></div></div>
                        </div>
                        <div class="gpu-bar-container">
                            <div class="gpu-bar-label"><span class="gpu-bar-label-name">Memory</span><span class="gpu-bar-label-value" id="gpu-memval-${g.id}">0 / 0 MB</span></div>
                            <div class="gpu-bar"><div class="gpu-bar-fill" id="gpu-membar-${g.id}" style="width:0%"></div></div>
                        </div>
                        <div class="gpu-bar-container">
                            <div class="gpu-bar-label"><span class="gpu-bar-label-name">Video Engine</span><span class="gpu-bar-label-value" id="gpu-encval-${g.id}">0%</span></div>
                            <div class="gpu-bar"><div class="gpu-bar-fill" id="gpu-encbar-${g.id}" style="width:0%"></div></div>
                        </div>
                    </div>
                `).join('');
            }

            // History charts
            const histGrid = document.getElementById('gpuHistoryGrid');
            if (histGrid) {
                const metrics = [
                    { id: 'gpu', label: 'GPU %' },
                    { id: 'mem', label: 'Memory %' },
                    { id: 'enc', label: 'Video Engine %' }
                ];
                histGrid.innerHTML = metrics.map(m => `
                    <div class="gpu-history-card">
                        <div class="gpu-history-header">
                            <span class="gpu-history-label">${m.label}</span>
                            <span class="gpu-history-value" id="gpu-histval-${m.id}">0%</span>
                        </div>
                        <div class="gpu-history-chart" id="gpu-histchart-${m.id}"></div>
                    </div>
                `).join('');
            }
        });
    }

    function updateGpu() {
        // Only collect when GPU page is active
        var gpuSection = document.getElementById('sec-gpu');
        if (!gpuSection || !gpuSection.classList.contains('active')) return;
        if (!gpuDetected || gpuList.length === 0) return;

        for (const g of gpuList) {
            if (g.type === 'nvidia') {
                updateGpuNvidia(g);
            } else if (g.vendor === 'intel') {
                updateGpuIntel(g);
            } else if (g.vendor === 'amd') {
                updateGpuAmd(g);
            }
        }

        // GPU processes: update every 5 cycles (expensive fdinfo scan)
        gpuProcCounter++;
        if (gpuProcCounter < 5) return;
        gpuProcCounter = 0;

        C.spawn(['sh', '-c',
            'nvidia-smi --query-compute-apps=pid,process_name,used_gpu_memory,gpu_uuid --format=csv,noheader 2>/dev/null || true'
        ]).done(data => {
            var tbody = document.getElementById('gpuProcTable');
            if (!tbody) return;
            if (data && data.trim()) {
                tbody.innerHTML = data.trim().split('\n').map(line => {
                    var p = line.split(', ').map(s => s.trim());
                    return '<tr><td>' + (p[0] || '') + '</td><td>' + (p[1] || '') + '</td><td>' + (p[3] || '') + '</td><td>' + (p[2] || '') + '</td></tr>';
                }).join('');
                return;
            }
            // Fallback: scan /proc/*/fdinfo for drm memory (Intel/AMD)
            C.spawn(['sh', '-c',
                'declare -A PID_MEM PID_CMD PID_ENG;' +
                'for f in /proc/[0-9]*/fdinfo/*;' +
                'do' +
                '  grep -q "drm-total-system0\\|drm-total-vram" "$f" 2>/dev/null || continue;' +
                '  pidnum=$(echo "$f" | cut -d/ -f3);' +
                '  if [ -z "${PID_CMD[$pidnum]}" ]; then PID_CMD[$pidnum]=$(cat /proc/$pidnum/comm 2>/dev/null); fi;' +
                '  mem=$(grep -oP "drm-total-system0:\\s*\\K[0-9]+" "$f" 2>/dev/null);' +
                '  if [ -n "$mem" ]; then PID_MEM[$pidnum]=$(( ${PID_MEM[$pidnum]:-0} + mem )); fi;' +
                '  eng=$(grep -oP "drm-engine-render:\\s*\\K[0-9]+" "$f" 2>/dev/null);' +
                '  if [ -n "$eng" ]; then PID_ENG[$pidnum]=$(( ${PID_ENG[$pidnum]:-0} + eng )); fi;' +
                'done;' +
                'for pid in "${!PID_MEM[@]}"; do' +
                '  echo "$pid|${PID_CMD[$pid]}|${PID_MEM[$pid]}|${PID_ENG[$pid]:-0}";' +
                'done | sort -t"|" -k3 -rn | head -20'
            ]).done(fdinfo => {
                if (!fdinfo || !fdinfo.trim()) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-tertiary)">No GPU processes</td></tr>';
                    return;
                }
                tbody.innerHTML = fdinfo.trim().split('\n').map(line => {
                    var p = line.split('|');
                    var pid = p[0] || '';
                    var cmd = p[1] || '';
                    var memKiB = parseInt(p[2]) || 0;
                    var memStr = memKiB >= 1024 ? (memKiB / 1024).toFixed(0) + ' MiB' : memKiB + ' KiB';
                    var engNs = parseInt(p[3]) || 0;
                    return '<tr><td>' + pid + '</td><td title="' + cmd + '">' + (cmd.length > 35 ? cmd.substring(0, 35) + '...' : cmd) + '</td><td>-</td><td>' + memStr + '</td></tr>';
                }).join('');
            });
        });
    }

    function gpuUpdateUI(g, gpuUtil, memUtil, encUtil, temp, power, fan, smClk, memClk, memUsed, memTotal, pstate) {
        const $ = (id) => document.getElementById(id);

        if (gpuList.indexOf(g) === 0) {
            const el = (id) => document.getElementById(id);
            el('gpuMainUsage').textContent = gpuUtil + '%';
            el('gpuMainTemp').textContent = temp > 0 ? temp + '°C' : 'N/A';
            el('gpuMainPower').textContent = power > 0 ? power.toFixed(0) + ' W' : 'N/A';
            el('gpuMainFan').textContent = fan >= 0 ? fan + '%' : 'N/A';

            gpuHistory.gpu.push(gpuUtil);
            gpuHistory.mem.push(memUtil);
            gpuHistory.enc.push(encUtil);
            if (gpuHistory.gpu.length > gpuHistoryLength) {
                gpuHistory.gpu.shift();
                gpuHistory.mem.shift();
                gpuHistory.enc.shift();
            }

            const color = state.accentColor || '#4f6ef7';
            const spark = ensureSparkline('gpuMiniChart', color);
            if (spark && gpuHistory.gpu.length >= 2) drawSparkline(spark, gpuHistory.gpu, color);

            ['gpu', 'mem', 'enc'].forEach(key => {
                const arr = gpuHistory[key];
                if (!arr || arr.length === 0) return;
                const valEl = el('gpu-histval-' + key);
                if (valEl) valEl.textContent = arr[arr.length - 1] + '%';
                const chartEl = el('gpu-histchart-' + key);
                if (chartEl && arr.length >= 2) drawCoreSvgChart(chartEl, arr, color, 100);
            });
        }

        const smEl = $('gpu-smclk-' + g.id);
        if (smEl) smEl.textContent = smClk > 0 ? smClk : '--';
        const memClkEl = $('gpu-memclk-' + g.id);
        if (memClkEl) memClkEl.textContent = memClk > 0 ? memClk : '--';
        const tempEl = $('gpu-temp-' + g.id);
        if (tempEl) tempEl.textContent = temp > 0 ? temp : '--';
        const powerEl = $('gpu-power-' + g.id);
        if (powerEl) powerEl.textContent = power > 0 ? power.toFixed(0) : '--';
        const fanEl = $('gpu-fan-' + g.id);
        if (fanEl) fanEl.textContent = fan >= 0 ? fan : '--';
        const psEl = $('gpu-pstate-' + g.id);
        if (psEl) psEl.textContent = pstate || '--';

        const gpuVal = $('gpu-gpuval-' + g.id);
        if (gpuVal) gpuVal.textContent = gpuUtil + '%';
        const gpuBar = $('gpu-gpubar-' + g.id);
        if (gpuBar) {
            gpuBar.style.width = gpuUtil + '%';
            gpuBar.className = 'gpu-bar-fill' + (gpuUtil > 90 ? ' danger' : gpuUtil > 70 ? ' warn' : '');
        }

        const memStr = memTotal > 0 ? (memUsed + ' / ' + memTotal + ' MB') : (memUsed > 0 ? memUsed + ' MB' : 'N/A');
        const memPct = memTotal > 0 ? ((memUsed / memTotal) * 100).toFixed(0) : 0;
        const memVal = $('gpu-memval-' + g.id);
        if (memVal) memVal.textContent = memStr;
        const memBar = $('gpu-membar-' + g.id);
        if (memBar) {
            memBar.style.width = memPct + '%';
            memBar.className = 'gpu-bar-fill' + (memPct > 90 ? ' danger' : memPct > 70 ? ' warn' : '');
        }

        const encVal = $('gpu-encval-' + g.id);
        if (encVal) encVal.textContent = encUtil + '%';
        const encBar = $('gpu-encbar-' + g.id);
        if (encBar) encBar.style.width = encUtil + '%';

        // Mem history chart
        const memChartEl = document.getElementById('gpuMemChart');
        if (memChartEl && gpuHistory.gpu.length >= 2) {
            drawSvgChart(memChartEl, gpuHistory.mem, '#38a169', 100);
        }
    }

    function updateGpuNvidia(g) {
        C.spawn(['sh', '-c',
            'nvidia-smi --query-gpu=index,utilization.gpu,utilization.memory,utilization.encoder,utilization.decoder,' +
            'temperature.gpu,power.draw,fan.speed,clocks.current.graphics,clocks.current.memory,' +
            'memory.used,memory.total,pstate --format=csv,noheader,nounits -i ' + g.id + ' 2>/dev/null'
        ]).done(data => {
            if (!data || !data.trim()) return;
            const p = data.trim().split(', ').map(s => s.trim());
            if (p.length < 12) return;
            gpuUpdateUI(g,
                parseInt(p[1]) || 0, parseInt(p[2]) || 0, parseInt(p[3]) || 0,
                parseInt(p[5]) || 0, parseFloat(p[6]) || 0, parseInt(p[7]) || 0,
                parseInt(p[8]) || 0, parseInt(p[9]) || 0,
                parseInt(p[10]) || 0, parseInt(p[11]) || 0, p[12] || ''
            );
        });
    }

    function updateGpuIntel(g) {
        var card = g.card || ('card' + g.id);
        C.spawn(['sh', '-c',
            'D=/sys/class/drm/' + card + '/device;' +
            'FREQ=$(cat /sys/class/drm/' + card + '/gt_cur_freq_mhz 2>/dev/null || echo 0);' +
            'TEMP=0;' +
            'for hw in /sys/class/hwmon/hwmon*; do' +
            '  T=$(cat "$hw/temp1_input" 2>/dev/null);' +
            '  if [ -n "$T" ] && [ "$T" -gt 10000 ] && [ "$T" -lt 150000 ]; then TEMP=$((T / 1000)); break; fi;' +
            'done;' +
            // Intel GPU utilization via intel_gpu_top -J
            'UTIL=0;' +
            'IGT=$(timeout 2 intel_gpu_top -J -s 1000 2>/dev/null | tail -1);' +
            'if echo "$IGT" | grep -q "busy"; then UTIL=$(echo "$IGT" | grep -oP "\\"busy\\":\\s*\\K[0-9.]+" | head -1 | cut -d. -f1); fi;' +
            'echo "FREQ:$FREQ"; echo "TEMP:$TEMP"; echo "UTIL:$UTIL"'
        ]).done(data => {
            var lines = data.trim().split('\n');
            var freq = 0, gpuUtil = 0, temp = 0;
            for (var l of lines) {
                if (l.startsWith('FREQ:')) freq = parseInt(l.split(':')[1]) || 0;
                if (l.startsWith('UTIL:')) gpuUtil = parseInt(l.split(':')[1]) || 0;
                if (l.startsWith('TEMP:')) temp = parseInt(l.split(':')[1]) || 0;
            }
            gpuUpdateUI(g, gpuUtil, 0, 0, temp, 0, -1, freq, 0, 0, 0, '');
        });
    }

    function updateGpuAmd(g) {
        var card = g.card || ('card' + g.id);
        C.spawn(['sh', '-c',
            'D=/sys/class/drm/' + card + '/device;' +
            // GPU utilization
            'BUSY=0; [ -f "$D/gpu_busy_percent" ] && BUSY=$(cat "$D/gpu_busy_percent" 2>/dev/null || echo 0);' +
            // VRAM
            'VRAM_T=0; [ -f "$D/mem_info_vram_total" ] && VRAM_T=$(( $(cat "$D/mem_info_vram_total") / 1048576 ));' +
            'VRAM_U=0; [ -f "$D/mem_info_vram_used" ] && VRAM_U=$(( $(cat "$D/mem_info_vram_used") / 1048576 ));' +
            // Clocks
            'FREQ=$(cat "$D/pp_dpm_sclk" 2>/dev/null | grep "\\*" | grep -oP "\\d+" | head -1 || echo 0);' +
            'MFREQ=$(cat "$D/pp_dpm_mclk" 2>/dev/null | grep "\\*" | grep -oP "\\d+" | head -1 || echo 0);' +
            // hwmon: temp, power, fan
            'HWM=$(readlink -f "$D/hwmon" 2>/dev/null | head -1);' +
            'TEMP=0; [ -f "$HWM/temp1_input" ] && TEMP=$(( $(cat "$HWM/temp1_input") / 1000 ));' +
            'POWER=0; [ -f "$HWM/power1_average" ] && POWER=$(( $(cat "$HWM/power1_average") / 1000000 ));' +
            'FAN=0; [ -f "$HWM/pwm1" ] && FAN=$(( $(cat "$HWM/pwm1") * 100 / 255 ));' +
            'echo "BUSY:$BUSY"; echo "VRAM_T:$VRAM_T"; echo "VRAM_U:$VRAM_U";' +
            'echo "FREQ:$FREQ"; echo "MFREQ:$MFREQ"; echo "TEMP:$TEMP"; echo "POWER:$POWER"; echo "FAN:$FAN"'
        ]).done(data => {
            var lines = data.trim().split('\n');
            var busy = 0, vramT = 0, vramU = 0, freq = 0, mfreq = 0, temp = 0, power = 0, fan = 0;
            for (var l of lines) {
                if (l.startsWith('BUSY:')) busy = parseInt(l.split(':')[1]) || 0;
                if (l.startsWith('VRAM_T:')) vramT = parseInt(l.split(':')[1]) || 0;
                if (l.startsWith('VRAM_U:')) vramU = parseInt(l.split(':')[1]) || 0;
                if (l.startsWith('FREQ:')) freq = parseInt(l.split(':')[1]) || 0;
                if (l.startsWith('MFREQ:')) mfreq = parseInt(l.split(':')[1]) || 0;
                if (l.startsWith('TEMP:')) temp = parseInt(l.split(':')[1]) || 0;
                if (l.startsWith('POWER:')) power = parseInt(l.split(':')[1]) || 0;
                if (l.startsWith('FAN:')) fan = parseInt(l.split(':')[1]) || 0;
            }
            gpuUpdateUI(g, busy, 0, 0, temp, power, fan, freq, mfreq, vramU, vramT, '');
        });
    }

    var procIoPrev = {}; // pid -> { r, w, t } for IO delta

    function updateProcesses() {
        // Only collect when process page is active
        var procSection = document.getElementById('sec-processes');
        if (!procSection || !procSection.classList.contains('active')) return;
        // ps 获取全部进程数据（一次 fork）
        C.spawn(['sh', '-c',
            'ps -eo user:20,pid,ppid,nlwp,pri,ni,vsz,rss,tty,stat,%cpu,%mem,time,etime:14,args --sort=-%cpu --no-headers 2>/dev/null'
        ]).done(psData => {
            if (!psData) return;
            var lines = psData.split('\n');
            var newProcesses = [];

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line) continue;
                // user 是第一个字段（固定宽度20），后面用正则
                var m = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/);
                if (!m) continue;
                newProcesses.push({
                    pid: parseInt(m[2]),
                    ppid: parseInt(m[3]),
                    user: m[1],
                    threads: parseInt(m[4]) || 1,
                    pri: m[5],
                    ni: m[6],
                    vsz: parseInt(m[7]) || 0,
                    rss: parseInt(m[8]) || 0,
                    tty: m[9],
                    stat: m[10],
                    cpu: parseFloat(m[11]) || 0,
                    mem: parseFloat(m[12]) || 0,
                    time: m[13],
                    etime: m[14],
                    command: m[15].trim()
                });
            }

            // Batch read IO for top 30 processes (one fork, calculate rate)
            var topPids = newProcesses.slice(0, 30).map(function(p) { return p.pid; });
            if (topPids.length > 0) {
                var now = Date.now();
                C.spawn(['sh', '-c',
                    'for pid in ' + topPids.join(' ') + '; do' +
                    '  if [ -f /proc/$pid/io ]; then' +
                    '    R=$(awk -F": " "/^read_bytes:/{print \\$2}" /proc/$pid/io 2>/dev/null);' +
                    '    W=$(awk -F": " "/^write_bytes:/{print \\$2}" /proc/$pid/io 2>/dev/null);' +
                    '    echo "$pid|${R:-0}|${W:-0}";' +
                    '  fi;' +
                    'done'
                ]).done(function(ioData) {
                    if (ioData) {
                        var ioLines = ioData.trim().split('\n');
                        for (var j = 0; j < ioLines.length; j++) {
                            var ioParts = ioLines[j].split('|');
                            if (ioParts.length < 3) continue;
                            var pid = parseInt(ioParts[0]);
                            var curR = parseInt(ioParts[1]) || 0;
                            var curW = parseInt(ioParts[2]) || 0;
                            var prev = procIoPrev[pid];
                            if (prev && now > prev.t) {
                                var dt = (now - prev.t) / 1000;
                                if (dt > 0) {
                                    var ioR = Math.max(0, Math.round((curR - prev.r) / dt));
                                    var ioW = Math.max(0, Math.round((curW - prev.w) / dt));
                                    for (var k = 0; k < newProcesses.length; k++) {
                                        if (newProcesses[k].pid === pid) {
                                            newProcesses[k].io = { read: ioR, write: ioW };
                                            break;
                                        }
                                    }
                                }
                            }
                            procIoPrev[pid] = { r: curR, w: curW, t: now };
                        }
                    }
                    // Clean stale PIDs
                    for (var oldPid in procIoPrev) {
                        if (topPids.indexOf(parseInt(oldPid)) === -1) delete procIoPrev[oldPid];
                    }
                    finishProc(newProcesses);
                }).fail(function() { finishProc(newProcesses); });
            } else {
                finishProc(newProcesses);
            }
        }).fail(function() {});
    }

    function finishProc(procs) {
        processes = procs;
        document.getElementById('procCountValue').textContent = processes.length;
        renderProcessTable();
        renderTopCpuTable();
    }

    // ==================== Process Column Config ====================

    var PROC_COLUMNS = [
        { id: 'select',  label: '',        fixed: true,  default: true,  width: '40px',  css: 'col-select' },
        { id: 'pid',     label: 'PID',     fixed: false, default: true,  width: '70px',  css: 'col-pid',     sortable: true,  align: 'right' },
        { id: 'ppid',    label: 'PPID',    fixed: false, default: false, width: '70px',  css: 'col-ppid',    sortable: true,  align: 'right' },
        { id: 'user',    label: 'User',    fixed: false, default: true,  width: '100px', css: 'col-user',    sortable: true },
        { id: 'threads', label: 'THR',     fixed: false, default: false, width: '50px',  css: 'col-threads', sortable: true,  align: 'right' },
        { id: 'pri',     label: 'PRI',     fixed: false, default: true,  width: '45px',  css: 'col-pri',     align: 'right' },
        { id: 'ni',      label: 'NI',      fixed: false, default: true,  width: '45px',  css: 'col-ni',      align: 'right' },
        { id: 'vsz',     label: 'VIRT',    fixed: false, default: true,  width: '75px',  css: 'col-virt',    sortable: true,  align: 'right' },
        { id: 'rss',     label: 'RES',     fixed: false, default: true,  width: '75px',  css: 'col-res',     sortable: true,  align: 'right' },
        { id: 'shr',     label: 'SHR',     fixed: false, default: false, width: '65px',  css: 'col-shr',     align: 'right' },
        { id: 'tty',     label: 'TTY',     fixed: false, default: false, width: '70px',  css: 'col-tty' },
        { id: 'stat',    label: 'S',       fixed: false, default: true,  width: '45px',  css: 'col-state' },
        { id: 'cpu',     label: 'CPU%',    fixed: false, default: true,  width: '65px',  css: 'col-cpu',     sortable: true,  align: 'right' },
        { id: 'mem',     label: 'MEM%',    fixed: false, default: true,  width: '65px',  css: 'col-mem',     sortable: true,  align: 'right' },
        { id: 'time',    label: 'TIME+',   fixed: false, default: true,  width: '80px',  css: 'col-time',    align: 'right' },
        { id: 'etime',   label: 'ELAPSED', fixed: false, default: false, width: '100px', css: 'col-etime',   align: 'right' },
        { id: 'io_r',    label: 'IO R/s',   fixed: false, default: false, width: '80px',  css: 'col-io',      sortable: true,  align: 'right' },
        { id: 'io_w',    label: 'IO W/s',   fixed: false, default: false, width: '80px',  css: 'col-io',      sortable: true,  align: 'right' },
        { id: 'command', label: 'Command', fixed: false, default: true,  width: 'auto',  css: 'col-cmd',     sortable: true },
    ];

    var procVisibleCols = null; // loaded from localStorage

    function getVisibleCols() {
        if (procVisibleCols) return procVisibleCols;
        try {
            var saved = localStorage.getItem('taskmgr-proc-cols');
            if (saved) {
                procVisibleCols = JSON.parse(saved);
                return procVisibleCols;
            }
        } catch (e) {}
        procVisibleCols = PROC_COLUMNS.filter(function(c) { return c.default || c.fixed; }).map(function(c) { return c.id; });
        return procVisibleCols;
    }

    function saveVisibleCols() {
        try { localStorage.setItem('taskmgr-proc-cols', JSON.stringify(procVisibleCols)); } catch (e) {}
    }

    function isColVisible(colId) {
        var cols = getVisibleCols();
        return cols.indexOf(colId) !== -1;
    }

    function toggleCol(colId) {
        var cols = getVisibleCols();
        var idx = cols.indexOf(colId);
        if (idx !== -1) {
            cols.splice(idx, 1);
        } else {
            cols.push(colId);
        }
        procVisibleCols = cols;
        saveVisibleCols();
        procRowCache.clear(); // force rebuild
        buildProcTableHead();
        renderProcessTable();
    }

    function buildProcTableHead() {
        var thead = document.getElementById('processTableHead');
        if (!thead) return;
        var cols = getVisibleCols();
        var html = '<tr>';
        for (var i = 0; i < cols.length; i++) {
            var col = PROC_COLUMNS.find(function(c) { return c.id === cols[i]; });
            if (!col) continue;
            var w = colWidths[col.id] || col.width;
            var style = 'width:' + w + ';';
            if (col.align) style += 'text-align:' + col.align + ';';
            var resizeHandle = (col.id !== 'command' && col.id !== 'select') ? '<span class="col-resize-handle" data-col="' + col.id + '"></span>' : '';
            if (col.id === 'select') {
                html += '<th class="' + col.css + '" style="' + style + '"><input type="checkbox" id="selectAllProcesses"></th>';
            } else if (col.sortable) {
                html += '<th class="' + col.css + ' sortable" data-sort="' + col.id + '" style="' + style + '">' + col.label + ' <span class="sort-icon"></span>' + resizeHandle + '</th>';
            } else {
                html += '<th class="' + col.css + '" style="' + style + '">' + col.label + resizeHandle + '</th>';
            }
        }
        html += '</tr>';
        thead.innerHTML = html;

        // Rebind sortable headers
        thead.querySelectorAll('.sortable').forEach(function(th) {
            th.addEventListener('click', function(e) {
                if (e.target.closest('.col-resize-handle')) return;
                var column = th.getAttribute('data-sort');
                if (sortBy === column) {
                    sortAsc = !sortAsc;
                } else {
                    sortBy = column;
                    sortAsc = column === 'pid' || column === 'ppid' || column === 'user' || column === 'command';
                }
                thead.querySelectorAll('.sortable').forEach(function(s) { s.classList.remove('asc', 'desc'); });
                th.classList.add(sortAsc ? 'asc' : 'desc');
                renderProcessTable();
            });
        });

        // Rebind select-all
        var selectAll = document.getElementById('selectAllProcesses');
        if (selectAll) {
            selectAll.addEventListener('change', function(e) {
                var checked = e.target.checked;
                document.querySelectorAll('.process-checkbox').forEach(function(cb) { cb.checked = checked; });
                updateSelectedProcesses();
            });
        }

        // Column resize
        initColResize(thead);
    }

    var colWidths = {}; // colId -> 'NNpx' saved widths

    function initColResize(thead) {
        var startX, startW, resizeCol, resizeTh;

        thead.addEventListener('mousedown', function(e) {
            var handle = e.target.closest('.col-resize-handle');
            if (!handle) return;
            e.preventDefault();
            resizeCol = handle.getAttribute('data-col');
            resizeTh = handle.parentElement;
            startX = e.clientX;
            startW = resizeTh.offsetWidth;
            handle.classList.add('active');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', function(e) {
            if (!resizeTh) return;
            var delta = e.clientX - startX;
            var newW = Math.max(40, startW + delta);
            resizeTh.style.width = newW + 'px';
            colWidths[resizeCol] = newW + 'px';
            // Also update all td in this column
            var table = thead.closest('table');
            if (table) {
                table.querySelectorAll('td[data-col="' + resizeCol + '"]').forEach(function(td) {
                    td.style.maxWidth = newW + 'px';
                });
            }
        });

        document.addEventListener('mouseup', function() {
            if (!resizeTh) return;
            resizeTh.querySelector('.col-resize-handle')?.classList.remove('active');
            resizeTh = null;
            resizeCol = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            // Save col widths
            try { localStorage.setItem('taskmgr-col-widths', JSON.stringify(colWidths)); } catch (e) {}
        });

        // Load saved widths
        try {
            var saved = localStorage.getItem('taskmgr-col-widths');
            if (saved) colWidths = JSON.parse(saved);
        } catch (e) {}
    }

    var pendingColConfig = null; // pending column config before save

    function buildColSettingsDropdown() {
        var dropdown = document.getElementById('colSettingsDropdown');
        if (!dropdown) return;
        var cols = getVisibleCols();
        pendingColConfig = cols.slice(); // snapshot current config

        var html = '<div class="col-settings-panel">';

        // Left panel: function toggles
        html += '<div class="col-settings-left">';
        html += '<div class="col-settings-title">' + t('Settings') + '</div>';
        html += '<label><input type="checkbox" id="col-kernel-threads" ' + (showKernelThreads ? 'checked' : '') + '> ' + t('Show kernel threads') + '</label>';
        html += '<label><input type="checkbox" id="col-user-processes" ' + (showUserProcesses ? 'checked' : '') + '> ' + t('Show user processes') + '</label>';
        html += '</div>';

        // Right panel: column drag-sort
        html += '<div class="col-settings-right">';
        html += '<div class="col-settings-title">' + t('Columns') + ' <button class="col-reset-btn" id="colResetBtn" title="Reset">' + t('Reset') + '</button></div>';
        html += '<div class="col-settings-list" id="colSettingsList">';
        for (var i = 0; i < cols.length; i++) {
            var col = PROC_COLUMNS.find(function(c) { return c.id === cols[i]; });
            if (!col || col.id === 'select') continue;
            html += '<div class="col-settings-item" draggable="true" data-col="' + col.id + '">' +
                '<span class="col-drag-handle">⣿</span>' +
                '<input type="checkbox" id="col-cb-' + col.id + '" data-col="' + col.id + '" checked>' +
                '<label for="col-cb-' + col.id + '">' + col.label + '</label>' +
                '</div>';
        }
        for (var j = 0; j < PROC_COLUMNS.length; j++) {
            var hcol = PROC_COLUMNS[j];
            if (hcol.id === 'select') continue;
            if (cols.indexOf(hcol.id) !== -1) continue;
            html += '<div class="col-settings-item col-hidden-item" draggable="true" data-col="' + hcol.id + '">' +
                '<span class="col-drag-handle">⣿</span>' +
                '<input type="checkbox" id="col-cb-' + hcol.id + '" data-col="' + hcol.id + '">' +
                '<label for="col-cb-' + hcol.id + '">' + hcol.label + '</label>' +
                '</div>';
        }
        html += '</div>';

        // Save button
        html += '<div style="padding:8px 0 0;text-align:right">';
        html += '<button class="btn btn-primary col-save-btn" id="colSaveBtn">' + t('Save') + '</button>';
        html += '</div>';

        html += '</div>'; // end right
        html += '</div>'; // end panel
        dropdown.innerHTML = html;

        // Bind visibility checkboxes - only update pending, don't apply
        dropdown.querySelectorAll('.col-settings-right input[type="checkbox"]').forEach(function(cb) {
            cb.addEventListener('change', function() {
                updatePendingCols();
            });
        });

        // Bind function toggles - apply immediately
        var kernCb = document.getElementById('col-kernel-threads');
        if (kernCb) kernCb.addEventListener('change', function() {
            showKernelThreads = kernCb.checked;
            procRowCache.clear();
            renderProcessTable();
        });
        var userCb = document.getElementById('col-user-processes');
        if (userCb) userCb.addEventListener('change', function() {
            showUserProcesses = userCb.checked;
            procRowCache.clear();
            renderProcessTable();
        });

        // Drag and drop reordering (only in right panel list)
        initColDragSort(dropdown.querySelector('#colSettingsList'));

        // Reset button
        var resetBtn = document.getElementById('colResetBtn');
        if (resetBtn) resetBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            resetColOrder();
        });

        // Save button
        var saveBtn = document.getElementById('colSaveBtn');
        if (saveBtn) saveBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            applyPendingCols();
        });
    }

    function updatePendingCols() {
        // Read current checkbox states from the list into pending
        var list = document.getElementById('colSettingsList');
        if (!list) return;
        var order = [];
        list.querySelectorAll('.col-settings-item').forEach(function(el) {
            var colId = el.getAttribute('data-col');
            var cb = el.querySelector('input[type="checkbox"]');
            if (cb && cb.checked) order.push(colId);
        });
        pendingColConfig = ['select'].concat(order);
    }

    function applyPendingCols() {
        if (!pendingColConfig) return;
        procVisibleCols = pendingColConfig;
        saveVisibleCols();
        procRowCache.clear();
        buildProcTableHead();
        renderProcessTable();
        // Close dropdown
        var dropdown = document.getElementById('colSettingsDropdown');
        if (dropdown) dropdown.classList.remove('show');
        showToast('Columns updated', 'success');
    }

    function initColDragSort(list) {
        if (!list) return;
        var dragItem = null;

        list.addEventListener('dragstart', function(e) {
            var item = e.target.closest('.col-settings-item');
            if (!item) return;
            dragItem = item;
            item.classList.add('col-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', '');
        });

        list.addEventListener('dragend', function(e) {
            var item = e.target.closest('.col-settings-item');
            if (item) item.classList.remove('col-dragging');
            dragItem = null;
            // Save new order from DOM positions
            var newOrder = [];
            list.querySelectorAll('.col-settings-item').forEach(function(el) {
                newOrder.push(el.getAttribute('data-col'));
            });
            procVisibleCols = ['select'].concat(newOrder);
            saveVisibleCols();
            // Rebuild header only, don't clear row cache (renderProcessTable handles column mismatch)
            buildProcTableHead();
            renderProcessTable();
        });

        list.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!dragItem) return;
            var target = e.target.closest('.col-settings-item');
            if (!target || target === dragItem) return;
            var rect = target.getBoundingClientRect();
            var midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
                list.insertBefore(dragItem, target);
            } else {
                list.insertBefore(dragItem, target.nextSibling);
            }
        });
    }

    function resetColOrder() {
        procVisibleCols = null;
        try { localStorage.removeItem('taskmgr-proc-cols'); } catch (e) {}
        procVisibleCols = PROC_COLUMNS.filter(function(c) { return c.default || c.fixed; }).map(function(c) { return c.id; });
        procRowCache.clear();
        buildProcTableHead();
        buildColSettingsDropdown(); // refresh dropdown
        renderProcessTable();
    }

    // Init column settings UI
    function initColSettings() {
        var btn = document.getElementById('colSettingsBtn');
        var dropdown = document.getElementById('colSettingsDropdown');
        if (!btn || !dropdown) return;

        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            buildColSettingsDropdown();
            dropdown.classList.toggle('show');
        });

        document.addEventListener('click', function(e) {
            if (!dropdown.contains(e.target) && e.target !== btn) {
                dropdown.classList.remove('show');
            }
        });
    }

    // ==================== Process Table Rendering ====================

    var procRowCache = new Map();

    function formatSize(kb) {
        if (kb >= 1024 * 1024) return (kb / (1024 * 1024)).toFixed(1) + 'G';
        if (kb >= 1024) return (kb / 1024).toFixed(1) + 'M';
        return kb + 'K';
    }

    function formatBytes(b) {
        if (!b || b === 0) return '0';
        if (b >= 1073741824) return (b / 1073741824).toFixed(1) + 'G';
        if (b >= 1048576) return (b / 1048576).toFixed(1) + 'M';
        if (b >= 1024) return (b / 1024).toFixed(0) + 'K';
        return b + 'B';
    }

    function getProcCellValue(p, colId) {
        switch (colId) {
            case 'select': return '';
            case 'pid': return p.pid;
            case 'ppid': return p.ppid;
            case 'user': return p.user;
            case 'threads': return p.threads;
            case 'pri': return p.pri;
            case 'ni': return p.ni;
            case 'vsz': return formatSize(p.vsz);
            case 'rss': return formatSize(p.rss);
            case 'shr': return '-';
            case 'tty': return p.tty;
            case 'stat': return p.stat;
            case 'cpu': return p.cpu.toFixed(1);
            case 'mem': return p.mem.toFixed(1);
            case 'time': return p.time;
            case 'etime': return p.etime;
            case 'io_r': return p.io ? formatBytes(p.io.read) : '-';
            case 'io_w': return p.io ? formatBytes(p.io.write) : '-';
            case 'command': return p.command;
            default: return '';
        }
    }

    function renderProcessTable() {
        var tbody = document.getElementById('processTableBody');
        if (!tbody) return;

        var filtered = processes;

        if (searchFilter) {
            filtered = filtered.filter(function(p) {
                return p.command.toLowerCase().includes(searchFilter) ||
                    p.pid.toString().includes(searchFilter) ||
                    p.user.toLowerCase().includes(searchFilter);
            });
        }

        if (!showKernelThreads) filtered = filtered.filter(function(p) { return p.user !== 'root' || !p.command.startsWith('['); });
        if (!showUserProcesses) filtered = filtered.filter(function(p) { return p.user === 'root' && p.command.startsWith('['); });

        filtered.sort(function(a, b) {
            var result = 0;
            switch (sortBy) {
                case 'cpu': result = b.cpu - a.cpu; break;
                case 'mem': result = b.mem - a.mem; break;
                case 'pid': result = a.pid - b.pid; break;
                case 'ppid': result = a.ppid - b.ppid; break;
                case 'user': result = a.user.localeCompare(b.user); break;
                case 'vsz': result = b.vsz - a.vsz; break;
                case 'rss': result = b.rss - a.rss; break;
                case 'threads': result = b.threads - a.threads; break;
                case 'command': result = a.command.localeCompare(b.command); break;
                default: result = 0;
            }
            return sortAsc ? -result : result;
        });

        var countEl = document.getElementById('processCount');
        if (countEl) countEl.textContent = filtered.length + ' / ' + processes.length;

        var cols = getVisibleCols();
        var currentPids = new Set();
        var fragment = document.createDocumentFragment();

        // Pre-compute which PIDs have children
        var hasChild = {};
        for (var ii = 0; ii < filtered.length; ii++) {
            for (var jj = 0; jj < filtered.length; jj++) {
                if (filtered[jj].ppid === filtered[ii].pid && filtered[jj].pid !== filtered[ii].pid) {
                    hasChild[filtered[ii].pid] = true;
                    break;
                }
            }
        }

        for (var i = 0; i < filtered.length; i++) {
            var p = filtered[i];
            currentPids.add(p.pid);

            var tr = procRowCache.get(p.pid);
            if (tr) {
                updateProcRow(tr, p, cols, hasChild[p.pid]);
                fragment.appendChild(tr);
            } else {
                tr = createProcRow(p, cols, hasChild[p.pid]);
                procRowCache.set(p.pid, tr);
                fragment.appendChild(tr);
            }
        }

        procRowCache.forEach(function(tr, pid) {
            if (!currentPids.has(pid)) procRowCache.delete(pid);
        });

        tbody.innerHTML = '';
        tbody.appendChild(fragment);

        // Bind events
        tbody.querySelectorAll('.process-checkbox').forEach(function(cb) {
            cb.addEventListener('change', updateSelectedProcesses);
        });
        tbody.querySelectorAll('.process-row').forEach(function(tr) {
            tr.addEventListener('click', function(e) {
                if (e.target.closest('.process-checkbox')) return;
                var pid = parseInt(tr.getAttribute('data-pid'));
                if (pid) showProcDetail(pid);
            });
        });
    }

    // ==================== Process Detail Popup ====================

    function showProcDetail(pid) {
        var p = processes.find(function(x) { return x.pid === pid; });
        if (!p) return;

        var overlay = document.getElementById('procDetailOverlay');
        var title = document.getElementById('procDetailTitle');
        var grid = document.getElementById('procDetailGrid');
        var childrenDiv = document.getElementById('procDetailChildren');
        var killBtn = document.getElementById('procDetailKillBtn');

        // Remove any existing command block (prevent duplicates)
        var oldCmd = overlay.querySelector('.proc-detail-cmd');
        if (oldCmd) oldCmd.remove();

        title.textContent = p.command;

        var fields = [
            ['PID', p.pid], ['PPID', p.ppid], ['User', p.user],
            ['Threads', p.threads], ['PRI', p.pri], ['NI', p.ni],
            ['State', p.stat], ['TTY', p.tty],
            ['VIRT', formatSize(p.vsz)], ['RES', formatSize(p.rss)],
            ['CPU%', p.cpu.toFixed(1) + '%'], ['MEM%', p.mem.toFixed(1) + '%'],
            ['Time', p.time], ['Elapsed', p.etime],
            ['IO Read', p.io ? formatBytes(p.io.read) : '-'],
            ['IO Write', p.io ? formatBytes(p.io.write) : '-']
        ];

        grid.innerHTML = fields.map(function(f) {
            return '<div class="proc-detail-field"><span class="proc-detail-label">' + f[0] + '</span><span class="proc-detail-value">' + f[1] + '</span></div>';
        }).join('');

        // Command detail with copy button
        var cmdHtml = '<div class="proc-detail-cmd">';
        cmdHtml += '<div class="proc-detail-cmd-header">';
        cmdHtml += '<span class="proc-detail-label">Command</span>';
        cmdHtml += '<button class="proc-cmd-copy" id="procCmdCopy" title="Copy">Copy</button>';
        cmdHtml += '</div>';
        cmdHtml += '<div class="proc-detail-cmd-text" id="procCmdText">' + escapeHtml(p.command) + '</div>';
        cmdHtml += '</div>';
        grid.insertAdjacentHTML('afterend', cmdHtml);

        // Copy button
        var copyBtn = document.getElementById('procCmdCopy');
        var cmdText = document.getElementById('procCmdText');
        if (copyBtn && cmdText) {
            copyBtn.onclick = function() {
                navigator.clipboard.writeText(p.command).then(function() {
                    copyBtn.textContent = 'Copied!';
                    setTimeout(function() { copyBtn.textContent = 'Copy'; }, 1500);
                }).catch(function() {
                    // Fallback
                    var ta = document.createElement('textarea');
                    ta.value = p.command;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    copyBtn.textContent = 'Copied!';
                    setTimeout(function() { copyBtn.textContent = 'Copy'; }, 1500);
                });
            };
        }

        // Children - show process tree
        var children = processes.filter(function(c) { return c.ppid === pid && c.pid !== pid; });
        var parent = processes.find(function(x) { return x.pid === p.ppid; });
        var treeHtml = '';

        // Parent info
        if (parent && parent.pid !== pid) {
            treeHtml += '<div class="proc-detail-children-title">' + t('Parent Process') + '</div>';
            treeHtml += '<table class="proc-detail-child-table"><thead><tr><th>PID</th><th>CPU%</th><th>MEM%</th><th>State</th><th>Command</th></tr></thead><tbody>';
            treeHtml += '<tr class="proc-tree-clickable" data-pid="' + parent.pid + '"><td>' + parent.pid + '</td><td>' + parent.cpu.toFixed(1) + '</td><td>' + parent.mem.toFixed(1) + '</td><td>' + parent.stat + '</td><td>' + escapeHtml(parent.command.substring(0, 50)) + '</td></tr>';
            treeHtml += '</tbody></table>';
        }

        // Children
        if (children.length > 0) {
            treeHtml += '<div class="proc-detail-children-title">' + t('Child Processes') + ' (' + children.length + ')</div>';
            treeHtml += '<table class="proc-detail-child-table"><thead><tr><th>PID</th><th>CPU%</th><th>MEM%</th><th>State</th><th>Command</th></tr></thead><tbody>';
            children.sort(function(a, b) { return b.cpu - a.cpu; });
            for (var i = 0; i < Math.min(children.length, 100); i++) {
                var c = children[i];
                treeHtml += '<tr class="proc-tree-clickable" data-pid="' + c.pid + '"><td>' + c.pid + '</td><td>' + c.cpu.toFixed(1) + '</td><td>' + c.mem.toFixed(1) + '</td><td>' + c.stat + '</td><td>' + escapeHtml(c.command.substring(0, 50)) + '</td></tr>';
            }
            treeHtml += '</tbody></table>';
        }

        if (!treeHtml) {
            treeHtml = '<div style="color:var(--text-tertiary);font-size:0.82rem;margin-top:12px">' + t('No parent or child processes') + '</div>';
        }
        childrenDiv.innerHTML = treeHtml;

        // Bind click on child/parent rows
        childrenDiv.querySelectorAll('.proc-tree-clickable').forEach(function(row) {
            row.addEventListener('click', function() {
                var clickPid = parseInt(row.getAttribute('data-pid'));
                if (clickPid) showProcDetail(clickPid);
            });
        });

        // Kill button
        killBtn.onclick = function() {
            showConfirm('Kill Process', 'Kill process ' + pid + ' (' + p.command.substring(0, 40) + ')?', function() {
                C.spawn(['kill', pid.toString()])
                    .done(function() { showToast('Process ' + pid + ' killed', 'success'); })
                    .fail(function() { showToast('Failed to kill ' + pid, 'error'); });
                closeProcDetail();
                setTimeout(updateProcesses, 500);
            });
        };

        overlay.classList.add('show');
    }

    function closeProcDetail() {
        var overlay = document.getElementById('procDetailOverlay');
        if (overlay) overlay.classList.remove('show');
        // Remove dynamically inserted command detail
        var cmdEl = overlay.querySelector('.proc-detail-cmd');
        if (cmdEl) cmdEl.remove();
    }

    function initProcDetail() {
        var closeBtn = document.getElementById('procDetailClose');
        var closeBtn2 = document.getElementById('procDetailCloseBtn');
        var overlay = document.getElementById('procDetailOverlay');
        if (closeBtn) closeBtn.addEventListener('click', closeProcDetail);
        if (closeBtn2) closeBtn2.addEventListener('click', closeProcDetail);
        if (overlay) overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closeProcDetail();
        });
    }

    function createProcRow(p, cols, isParent) {
        var tr = document.createElement('tr');
        tr.className = 'process-row' + (selectedProcesses.has(p.pid) ? ' selected' : '') + (isParent ? ' proc-parent' : '');
        tr.setAttribute('data-pid', p.pid);
        for (var i = 0; i < cols.length; i++) {
            var colId = cols[i];
            var colDef = PROC_COLUMNS.find(function(c) { return c.id === colId; });
            var td = document.createElement('td');
            if (colDef) {
                td.className = colDef.css;
                td.setAttribute('data-col', colId);
                if (colDef.align) td.style.textAlign = colDef.align;
            }
            if (colId === 'select') {
                td.innerHTML = '<input type="checkbox" class="process-checkbox" data-pid="' + p.pid + '"' + (selectedProcesses.has(p.pid) ? ' checked' : '') + '>';
            } else if (colId === 'command') {
                var cmdHtml = isParent ? '<span class="proc-tree-badge">▸</span>' : '';
                cmdHtml += escapeHtml(p.command);
                td.innerHTML = cmdHtml;
                td.title = p.command;
            } else {
                td.textContent = getProcCellValue(p, colId);
            }
            tr.appendChild(td);
        }
        return tr;
    }

    function updateProcRow(tr, p, cols, isParent) {
        tr.className = 'process-row' + (selectedProcesses.has(p.pid) ? ' selected' : '') + (isParent ? ' proc-parent' : '');
        var cells = tr.children;
        var needRebuild = cells.length !== cols.length;
        if (!needRebuild) {
            for (var i = 0; i < cols.length; i++) {
                if (cells[i].getAttribute('data-col') !== cols[i]) { needRebuild = true; break; }
            }
        }
        if (needRebuild) {
            tr.innerHTML = '';
            for (var j = 0; j < cols.length; j++) {
                var colId = cols[j];
                var colDef = PROC_COLUMNS.find(function(c) { return c.id === colId; });
                var td = document.createElement('td');
                if (colDef) {
                    td.className = colDef.css;
                    td.setAttribute('data-col', colId);
                    if (colDef.align) td.style.textAlign = colDef.align;
                }
                if (colId === 'select') {
                    td.innerHTML = '<input type="checkbox" class="process-checkbox" data-pid="' + p.pid + '"' + (selectedProcesses.has(p.pid) ? ' checked' : '') + '>';
                } else                 if (colId === 'command') {
                    td.innerHTML = escapeHtml(p.command);
                    td.title = p.command;
                } else {
                    td.textContent = getProcCellValue(p, colId);
                }
                tr.appendChild(td);
            }
            return;
        }
        // Update cells in place
        for (var k = 0; k < cols.length; k++) {
            var cid = cols[k];
            if (cid === 'select') continue;
            var cell = cells[k];
            if (cid === 'command') {
                var cmdText = escapeHtml(p.command);
                if (cell.innerHTML !== cmdText) {
                    cell.innerHTML = cmdText;
                    cell.title = p.command;
                }
            } else {
                var val = getProcCellValue(p, cid);
                if (cell.textContent != val) cell.textContent = val;
            }
        }
    }

    function renderTopCpuTable() {
        const tbody = document.getElementById('topCpuTable');
        if (!tbody) return;

        const top = processes.slice(0, 10);
        tbody.innerHTML = top.map(p => `
            <tr>
                <td>${p.pid}</td>
                <td>${escapeHtml(p.command.substring(0, 30))}</td>
                <td>${p.user}</td>
                <td>${p.cpu.toFixed(1)}%</td>
                <td>${p.mem.toFixed(1)}%</td>
            </tr>
        `).join('');
    }

    function updateSelectedProcesses() {
        selectedProcesses.clear();
        document.querySelectorAll('.process-checkbox:checked').forEach(cb => {
            selectedProcesses.add(parseInt(cb.getAttribute('data-pid')));
        });

        var killBtn = document.getElementById('killProcessBtn');
        var killLabel = document.getElementById('killProcessLabel');
        if (killBtn) {
            if (selectedProcesses.size > 0) {
                killBtn.style.display = 'inline-flex';
                if (killLabel) killLabel.textContent = 'Kill (' + selectedProcesses.size + ')';
            } else {
                killBtn.style.display = 'none';
            }
        }

        document.querySelectorAll('.process-row').forEach(row => {
            var pid = parseInt(row.getAttribute('data-pid'));
            row.classList.toggle('selected', selectedProcesses.has(pid));
        });
    }

    function killSelectedProcesses() {
        if (selectedProcesses.size === 0) return;

        const pids = Array.from(selectedProcesses);
        const message = pids.length === 1 
            ? `Are you sure you want to terminate process ${pids[0]}?`
            : `Are you sure you want to terminate ${pids.length} processes?`;

        showConfirm('Terminate Process', message, () => {
            pids.forEach(pid => {
                C.spawn(['kill', pid.toString()])
                    .done(() => showToast(`Process ${pid} terminated`, 'success'))
                    .fail(() => showToast(`Failed to terminate process ${pid}`, 'error'));
            });
            selectedProcesses.clear();
            updateProcesses();
        });
    }

    function updateDisk() {
        C.spawn(['df', '-B1'])
            .done(data => {
                const lines = data.split('\n').slice(1);
                const grid = document.getElementById('diskGrid');
                if (!grid) return;

                grid.innerHTML = lines
                    .filter(line => line.trim() && !line.startsWith('tmpfs') && !line.startsWith('devtmpfs'))
                    .map(line => {
                        const parts = line.split(/\s+/);
                        const device = parts[0];
                        const total = parseInt(parts[1]);
                        const used = parseInt(parts[2]);
                        const available = parseInt(parts[3]);
                        const percent = parts[4];
                        const mount = parts[5];

                        const formatGB = (bytes) => (bytes / (1024 * 1024 * 1024)).toFixed(1);

                        const percentNum = parseInt(percent);
                        let percentClass = '';
                        if (percentNum > 90) percentClass = 'danger';
                        else if (percentNum > 70) percentClass = 'warning';

                        return `
                            <div class="disk-card">
                                <div class="disk-card-header">
                                    <span class="disk-card-title">${mount}</span>
                                    <span class="disk-card-device">${device}</span>
                                </div>
                                <div class="disk-usage-bar">
                                    <div class="disk-usage-fill ${percentClass}" style="width: ${percent}"></div>
                                </div>
                                <div class="disk-stats">
                                    <div class="disk-stat"><span class="disk-stat-label">Total</span><span class="disk-stat-value">${formatGB(total)} GB</span></div>
                                    <div class="disk-stat"><span class="disk-stat-label">Used</span><span class="disk-stat-value">${formatGB(used)} GB</span></div>
                                    <div class="disk-stat"><span class="disk-stat-label">Available</span><span class="disk-stat-value">${formatGB(available)} GB</span></div>
                                    <div class="disk-stat"><span class="disk-stat-label">Usage</span><span class="disk-stat-value">${percent}</span></div>
                                </div>
                            </div>
                        `;
                    }).join('');
            });
    }

    function updateNetwork() {
        C.spawn(['cat', '/proc/net/dev'])
            .done(data => {
                const lines = data.split('\n').slice(2);
                const grid = document.getElementById('networkGrid');
                if (!grid) return;

                grid.innerHTML = lines
                    .filter(line => line.trim())
                    .map(line => {
                        const parts = line.split(':');
                        const iface = parts[0].trim();
                        const stats = parts[1].trim().split(/\s+/);
                        const rxBytes = parseInt(stats[0]);
                        const txBytes = parseInt(stats[8]);

                        const formatBytes = (bytes) => {
                            if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
                            if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
                            if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
                            return bytes + ' B';
                        };

                        if (iface === 'lo') return '';

                        return `
                            <div class="network-card">
                                <div class="network-card-header">
                                    <span class="network-card-title">${iface}</span>
                                </div>
                                <div class="network-stats">
                                    <div class="network-stat"><span class="network-stat-label">Received</span><span class="network-stat-value">${formatBytes(rxBytes)}</span></div>
                                    <div class="network-stat"><span class="network-stat-label">Sent</span><span class="network-stat-value">${formatBytes(txBytes)}</span></div>
                                </div>
                            </div>
                        `;
                    }).join('');
            });
    }

    function updateUptime() {
        C.spawn(['cat', '/proc/uptime'])
            .done(data => {
                const uptime = parseFloat(data.split(' ')[0]);
                const days = Math.floor(uptime / 86400);
                const hours = Math.floor((uptime % 86400) / 3600);
                const mins = Math.floor((uptime % 3600) / 60);
                
                let uptimeStr = '';
                if (days > 0) uptimeStr += `${days}d `;
                uptimeStr += `${hours}h ${mins}m`;
                
                document.getElementById('uptimeDisplay').textContent = `Uptime: ${uptimeStr}`;
            });
    }

    // ==================== Chart Rendering ====================

    /**
     * Draw a CSS sparkline into a div element using clip-path.
     */
    function drawSparkline(el, data, color) {
        if (!el || !data || data.length < 2) return;
        var max = 100;
        var n = data.length;
        var points = [];
        for (var i = 0; i < n; i++) {
            var pct = (data[i] / max) * 100;
            var x = (i / (n - 1)) * 100;
            var y = 100 - pct;
            points.push(x.toFixed(2) + '% ' + y.toFixed(2) + '%');
        }
        el.style.background = 'linear-gradient(to top, ' + color + '33, ' + color + '11)';
        el.style.clipPath = 'polygon(0% 100%, ' + points.join(', ') + ', 100% 100%)';
        el.style.webkitClipPath = el.style.clipPath;
    }

    function ensureSparkline(parentId, color) {
        var container = document.getElementById(parentId);
        if (!container) return null;
        var spark = container.querySelector('.sparkline');
        if (!spark) {
            spark = document.createElement('div');
            spark.className = 'sparkline';
            container.appendChild(spark);
        }
        return spark;
    }

    function updateCpuChart() {
        var spark = ensureSparkline('cpuMiniChart', state.accentColor || '#4f6ef7');
        if (spark && cpuHistory.length >= 2) drawSparkline(spark, cpuHistory, state.accentColor || '#4f6ef7');

        var el = document.getElementById('cpuHistoryChart');
        if (el && cpuHistory.length >= 2) drawSvgChart(el, cpuHistory, state.accentColor || '#4f6ef7', 100);
    }

    function updateMemChart() {
        var spark = ensureSparkline('memMiniChart', '#38a169');
        if (spark && memHistory.length >= 2) drawSparkline(spark, memHistory, '#38a169');

        var el = document.getElementById('memHistoryChart');
        if (el && memHistory.length >= 2) drawSvgChart(el, memHistory, '#38a169', 100);
    }

    function updateMemDetailChart() {
        var el = document.getElementById('memDetailChart');
        if (!el) return;
        var datasets = [];
        if (memHistory.length >= 2) {
            datasets.push({ data: memHistory, color: '#4f6ef7', label: 'Memory' });
        }
        if (swapHistory.length >= 2) {
            datasets.push({ data: swapHistory, color: '#f59e0b', label: 'Swap' });
        }
        if (datasets.length > 0) {
            drawMultiLineSvgChart(el, datasets, 100);
        }
    }

    /**
     * Render a line+area chart as inline SVG inside a container div.
     * No canvas needed — works in any iframe/CSP environment.
     */
    function drawSvgChart(container, data, color, maxVal) {
        if (!container || !data || data.length < 2) return;

        // Get container size
        var rect = container.getBoundingClientRect();
        var W = Math.round(rect.width) || 600;
        var H = Math.round(rect.height) || 150;
        if (W < 10 || H < 10) { W = 600; H = 150; }

        var pad = 4;
        var cw = W - pad * 2;
        var ch = H - pad * 2;
        if (cw <= 0 || ch <= 0) return;

        // Build polyline points
        var pts = [];
        var step = cw / Math.max(data.length - 1, 1);
        for (var i = 0; i < data.length; i++) {
            var x = pad + i * step;
            var val = Math.max(0, Math.min(data[i], maxVal));
            var y = pad + ch - (val / maxVal) * ch;
            pts.push(x.toFixed(1) + ',' + y.toFixed(1));
        }

        // Area polygon (line + bottom edge)
        var areaPts = pts.join(' ') + ' ' + (pad + (data.length - 1) * step).toFixed(1) + ',' + (H - pad) + ' ' + pad + ',' + (H - pad);

        // Grid lines
        var gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || '#e2e8f0';
        var grid1 = pad;
        var grid2 = pad + ch / 2;
        var grid3 = pad + ch;

        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="display:block;width:100%;height:100%">' +
            '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="transparent"/>' +
            '<line x1="' + pad + '" y1="' + grid1 + '" x2="' + (W - pad) + '" y2="' + grid1 + '" stroke="' + gridColor + '" stroke-width="0.5"/>' +
            '<line x1="' + pad + '" y1="' + grid2.toFixed(1) + '" x2="' + (W - pad) + '" y2="' + grid2.toFixed(1) + '" stroke="' + gridColor + '" stroke-width="0.5"/>' +
            '<line x1="' + pad + '" y1="' + grid3 + '" x2="' + (W - pad) + '" y2="' + grid3 + '" stroke="' + gridColor + '" stroke-width="0.5"/>' +
            '<polygon points="' + areaPts + '" fill="' + color + '" fill-opacity="0.12"/>' +
            '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>' +
            '</svg>';

        container.innerHTML = svg;
    }

    /**
     * Draw a multi-line chart with labels.
     * datasets: [{ data: [], color: '', label: '' }]
     */
    function drawMultiLineSvgChart(container, datasets, maxVal) {
        if (!container || !datasets || datasets.length === 0) return;
        var rect = container.getBoundingClientRect();
        var W = Math.round(rect.width) || 600;
        var H = Math.round(rect.height) || 200;
        if (W < 10 || H < 10) { W = 600; H = 200; }

        var pad = 30;
        var padR = 10;
        var padTop = 28;
        var padBot = 24;
        var cw = W - pad - padR;
        var ch = H - padTop - padBot;
        if (cw <= 0 || ch <= 0) return;

        var gridColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || '#e2e8f0';
        var textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#666';

        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" style="display:block;width:100%;height:100%">';

        // Grid lines and Y labels
        for (var g = 0; g <= 4; g++) {
            var gy = padTop + (ch * g / 4);
            var gVal = Math.round(maxVal - (maxVal * g / 4));
            svg += '<line x1="' + pad + '" y1="' + gy.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + gy.toFixed(1) + '" stroke="' + gridColor + '" stroke-width="0.5"/>';
            svg += '<text x="' + (pad - 4) + '" y="' + (gy + 4).toFixed(1) + '" text-anchor="end" font-size="10" fill="' + textColor + '">' + gVal + '%</text>';
        }

        // Draw each dataset
        for (var d = 0; d < datasets.length; d++) {
            var ds = datasets[d];
            if (!ds.data || ds.data.length < 2) continue;
            var n = ds.data.length;
            var step = cw / Math.max(n - 1, 1);
            var pts = [];
            for (var i = 0; i < n; i++) {
                var x = pad + i * step;
                var val = Math.max(0, Math.min(ds.data[i], maxVal));
                var y = padTop + ch - (val / maxVal) * ch;
                pts.push(x.toFixed(1) + ',' + y.toFixed(1));
            }
            // Area
            var areaPts = pts.join(' ') + ' ' + (pad + (n - 1) * step).toFixed(1) + ',' + (padTop + ch) + ' ' + pad + ',' + (padTop + ch);
            svg += '<polygon points="' + areaPts + '" fill="' + ds.color + '" fill-opacity="0.1"/>';
            // Line
            svg += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + ds.color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
            // Latest value label
            if (n > 0) {
                var lastVal = Math.round(ds.data[n - 1]);
                var lastX = pad + (n - 1) * step;
                var lastY = padTop + ch - (lastVal / maxVal) * ch;
                svg += '<circle cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="3" fill="' + ds.color + '"/>';
                svg += '<text x="' + (lastX + 5).toFixed(1) + '" y="' + (lastY - 5).toFixed(1) + '" font-size="11" font-weight="600" fill="' + ds.color + '">' + lastVal + '%</text>';
            }
        }

        // Legend
        var legendX = pad + 4;
        var legendY = 14;
        for (var l = 0; l < datasets.length; l++) {
            svg += '<rect x="' + legendX + '" y="' + (legendY - 8) + '" width="12" height="8" rx="2" fill="' + datasets[l].color + '"/>';
            svg += '<text x="' + (legendX + 16) + '" y="' + legendY + '" font-size="11" fill="' + textColor + '">' + datasets[l].label + '</text>';
            legendX += datasets[l].label.length * 7 + 30;
        }

        svg += '</svg>';
        container.innerHTML = svg;
    }

    /**
     * Draw a per-core history chart as inline SVG.
     */
    function drawCoreSvgChart(container, data, color, maxVal) {
        if (!container || !data || data.length < 2) return;

        var W = 300, H = 160;
        var pad = 4;
        var cw = W - pad * 2;
        var ch = H - pad * 2;

        var pts = [];
        var step = cw / Math.max(data.length - 1, 1);
        for (var i = 0; i < data.length; i++) {
            var x = pad + i * step;
            var val = Math.max(0, Math.min(data[i], maxVal));
            var y = pad + ch - (val / maxVal) * ch;
            pts.push(x.toFixed(1) + ',' + y.toFixed(1));
        }
        var areaPts = pts.join(' ') + ' ' + (pad + (data.length - 1) * step).toFixed(1) + ',' + (H - pad) + ' ' + pad + ',' + (H - pad);

        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="display:block;width:100%;height:100%">' +
            '<polygon points="' + areaPts + '" fill="' + color + '" fill-opacity="0.12"/>' +
            '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
            '</svg>';

        container.innerHTML = svg;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    window.TaskManager = {
        showToast,
        refresh: updateAll,
        getProcesses: () => processes,
        killProcess: (pid) => {
            C.spawn(['kill', pid.toString()])
                .done(() => showToast(`Process ${pid} terminated`, 'success'))
                .fail(() => showToast(`Failed to terminate process ${pid}`, 'error'));
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
