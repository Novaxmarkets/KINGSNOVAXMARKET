// =======================================
// NovaxMarkets Account Manager
// =======================================

const ACCOUNT_STORAGE_KEY = 'novaxAccounts';
const ACTIVE_ACCOUNT_STORAGE_KEY = 'novaxCurrentAccount';
const TRADE_HISTORY_STORAGE_KEY = 'novaxMarketsTradeHistory';
const AUTH_STORAGE_KEY = 'novaxAuthSession';
const USERS_STORAGE_KEY = 'novaxUsers';

function getCurrentPageName() {
    return (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
}

function getAuthSession() {
    try {
        const stored = localStorage.getItem(AUTH_STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (error) {
        return null;
    }
}

function saveAuthSession(user) {
    const payload = { loggedIn: true, ...user };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
}

function clearAuthSession() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
}

function isAuthenticated() {
    return Boolean(getAuthSession());
}

function applyAuthRouting() {
    const pageName = getCurrentPageName();
    const publicPages = ['index.html', 'login.html', 'register.html', 'register'];

    if (!isAuthenticated() && !publicPages.includes(pageName)) {
        window.location.replace('login.html');
        return false;
    }

    if (isAuthenticated() && publicPages.includes(pageName)) {
        window.location.replace('dashboard.html');
        return false;
    }

    return true;
}

function bindLogoutLinks() {
    document.querySelectorAll('[data-nav="logout"], a[href="index.html"]').forEach((link) => {
        const text = (link.textContent || '').trim().toLowerCase();
        if (text === 'logout' || link.dataset.nav === 'logout') {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                clearAuthSession();
                window.location.href = 'index.html';
            });
        }
    });
}

function getStoredUsers() {
    try {
        const raw = localStorage.getItem(USERS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        console.warn('Failed to parse stored users, resetting auth storage.', error);
        localStorage.removeItem(USERS_STORAGE_KEY);
        return [];
    }
}

function saveStoredUsers(users) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function bindAuthForms() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authMessage = document.getElementById('authMessage');

    function showAuthMessage(message, variant = 'error') {
        if (!authMessage) return;
        authMessage.textContent = message;
        authMessage.className = `message-box ${variant}`;
        authMessage.hidden = false;
    }

    function clearAuthMessage() {
        if (!authMessage) return;
        authMessage.textContent = '';
        authMessage.className = 'message-box';
        authMessage.hidden = true;
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            clearAuthMessage();

            const email = document.getElementById('loginEmail')?.value?.trim().toLowerCase() || '';
            const password = document.getElementById('loginPassword')?.value || '';
            const users = getStoredUsers();

            const match = users.find((user) => String(user.email).toLowerCase() === email && String(user.password) === password);

            if (!match) {
                showAuthMessage('Invalid email or password.', 'error');
                return;
            }

            saveAuthSession({ email: match.email, name: match.fullName, username: match.username || match.email.split('@')[0] });
            window.location.href = 'dashboard.html';
        });
    }

    if (registerForm) {
        const submitButton = registerForm.querySelector('button[type="submit"]');
        let isSubmitting = false;

        registerForm.addEventListener('submit', (event) => {
            event.preventDefault();

            if (isSubmitting) {
                return;
            }

            clearAuthMessage();
            isSubmitting = true;
            if (submitButton) submitButton.disabled = true;

            const fullName = document.getElementById('registerFullName')?.value?.trim() || '';
            const email = document.getElementById('registerEmail')?.value?.trim().toLowerCase() || '';
            const password = document.getElementById('registerPassword')?.value || '';
            const confirmPassword = document.getElementById('registerConfirmPassword')?.value || '';
            const users = getStoredUsers();
            const username = email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase() || '';

            if (!fullName || !email || !password || !confirmPassword) {
                showAuthMessage('Please complete all fields.', 'error');
                isSubmitting = false;
                if (submitButton) submitButton.disabled = false;
                return;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showAuthMessage('Please enter a valid email address.', 'error');
                isSubmitting = false;
                if (submitButton) submitButton.disabled = false;
                return;
            }

            if (password.length < 6) {
                showAuthMessage('Password must be at least 6 characters.', 'error');
                isSubmitting = false;
                if (submitButton) submitButton.disabled = false;
                return;
            }

            if (password !== confirmPassword) {
                showAuthMessage('Passwords do not match.', 'error');
                isSubmitting = false;
                if (submitButton) submitButton.disabled = false;
                return;
            }

            if (users.some((user) => String(user.email).toLowerCase() === email || String(user.username).toLowerCase() === username)) {
                showAuthMessage('An account with this email or username already exists.', 'error');
                isSubmitting = false;
                if (submitButton) submitButton.disabled = false;
                return;
            }

            try {
                const newUser = {
                    fullName,
                    email,
                    password,
                    username,
                    createdAt: new Date().toISOString()
                };
                users.push(newUser);
                saveStoredUsers(users);

                showAuthMessage('Account created successfully.', 'success');
                if (submitButton) submitButton.disabled = true;

                window.setTimeout(() => {
                    window.location.assign('login.html');
                }, 1200);
            } catch (error) {
                console.error('Registration failed:', error);
                showAuthMessage('Registration failed. Please try again.', 'error');
                isSubmitting = false;
                if (submitButton) submitButton.disabled = false;
            }
        });
    }
}

function createAccountState(type, baseBalance) {
    return {
        id: type,
        name: type === 'live' ? 'Live' : 'Demo',
        type,
        label: type === 'live' ? 'Live Account' : 'Demo Account',
        balance: Number(baseBalance) || 0,
        wallet: {
            balance: Number(baseBalance) || 0,
            deposits: [],
            withdrawals: [],
            transactions: []
        },
        tradeHistory: [],
        openTrades: [],
        closedTrades: [],
        wins: 0,
        losses: 0,
        profitLoss: 0,
        notifications: []
    };
}

function normalizeAccount(accountData, type, defaultBalance) {
    const baseBalance = Number(accountData?.balance ?? defaultBalance) || defaultBalance;
    const normalized = createAccountState(type, baseBalance);

    normalized.name = accountData?.name || normalized.name;
    normalized.label = accountData?.label || normalized.label;
    normalized.balance = type === 'live' ? Math.max(0, Number(accountData?.balance ?? baseBalance) || baseBalance) : Number(accountData?.balance ?? baseBalance) || defaultBalance;
    normalized.wallet.balance = normalized.balance;
    normalized.wallet.deposits = Array.isArray(accountData?.wallet?.deposits) ? accountData.wallet.deposits : [];
    normalized.wallet.withdrawals = Array.isArray(accountData?.wallet?.withdrawals) ? accountData.wallet.withdrawals : [];
    normalized.wallet.transactions = Array.isArray(accountData?.wallet?.transactions) ? accountData.wallet.transactions : [];
    normalized.tradeHistory = Array.isArray(accountData?.tradeHistory) ? accountData.tradeHistory : [];
    normalized.openTrades = Array.isArray(accountData?.openTrades) ? accountData.openTrades : [];
    normalized.closedTrades = Array.isArray(accountData?.closedTrades) ? accountData.closedTrades : [];
    normalized.wins = Number(accountData?.wins || 0) || 0;
    normalized.losses = Number(accountData?.losses || 0) || 0;
    normalized.profitLoss = Number(accountData?.profitLoss || 0) || 0;
    normalized.notifications = Array.isArray(accountData?.notifications) ? accountData.notifications : [];

    return normalized;
}

let accounts = {
    demo: createAccountState('demo', 10000),
    live: createAccountState('live', 0)
};

try {
    const storedAccounts = JSON.parse(localStorage.getItem(ACCOUNT_STORAGE_KEY));

    if (storedAccounts && typeof storedAccounts === 'object') {
        accounts = {
            demo: normalizeAccount(storedAccounts.demo, 'demo', 10000),
            live: normalizeAccount(storedAccounts.live, 'live', 0)
        };
    }
} catch (error) {
    console.warn('Unable to restore account state.', error);
}

let currentAccount = localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY) || 'demo';

function formatAccountCurrency(value) {
    return `$${Number(value || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function getActiveAccountType() {
    return currentAccount === 'live' ? 'live' : 'demo';
}

function getAccountData(accountType = currentAccount) {
    return accounts[accountType] || accounts.demo;
}

function getAllAccountTrades() {
    return Object.values(accounts).flatMap((account) => account.tradeHistory || []);
}

function saveAccounts() {
    const safeAccounts = {
        demo: normalizeAccount(accounts.demo, 'demo', 10000),
        live: normalizeAccount(accounts.live, 'live', 0)
    };

    accounts = safeAccounts;
    localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(safeAccounts));
    localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, currentAccount);
    localStorage.setItem(TRADE_HISTORY_STORAGE_KEY, JSON.stringify(getAllAccountTrades()));
    window.dispatchEvent(new CustomEvent('account-state-updated', {
        detail: { accounts: safeAccounts, currentAccount }
    }));
}

function addNotification(accountType, message, variant = 'info') {
    const targetAccount = getAccountData(accountType);
    targetAccount.notifications.unshift({
        id: `nt-${Date.now()}`,
        message,
        variant,
        createdAt: new Date().toISOString()
    });

    targetAccount.notifications = targetAccount.notifications.slice(0, 5);
    saveAccounts();
}

function updateAccountPills() {
    document.querySelectorAll('.account-pill').forEach((pill) => {
        const accountType = pill.dataset.account;
        const targetAccount = getAccountData(accountType);
        pill.textContent = `${accountType === 'live' ? 'Live' : 'Demo'} | ${formatAccountCurrency(targetAccount.balance)}`;
        pill.classList.toggle('active', accountType === currentAccount);
    });
}

function updateActiveAccountUI() {
    const activeAccount = getAccountData();
    const isLive = currentAccount === 'live';
    const selectedMarket = getSelectedMarketName();
    const marketProfile = getMarketProfile(selectedMarket);
    const stakeValue = Number(settingsData.stake || 25);
    const payoutValue = Number(marketProfile.payout || 95);
    const potentialReturn = getPotentialReturn(stakeValue, selectedMarket);

    const demoBalance = document.getElementById('demo-balance');
    const liveBalance = document.getElementById('live-balance');
    const currentAccountBadge = document.getElementById('current-account-badge');
    const accountBanner = document.getElementById('active-account-banner');
    const walletTitle = document.getElementById('wallet-title');
    const walletBalance = document.getElementById('wallet-balance');
    const walletDeposits = document.getElementById('wallet-deposits');
    const walletWithdrawals = document.getElementById('wallet-withdrawals');
    const walletTransactions = document.getElementById('wallet-transactions');
    const statsWins = document.getElementById('stats-wins');
    const statsLosses = document.getElementById('stats-losses');
    const statsProfit = document.getElementById('stats-profit');
    const statsClosed = document.getElementById('stats-closed');
    const tradeFeedback = document.getElementById('trade-feedback');
    const dashboardMarketPrice = document.getElementById('dashboardMarketPrice');
    const dashboardMarketStatus = document.getElementById('dashboardMarketStatus');
    const dashboardMarketPayout = document.getElementById('dashboardMarketPayout');
    const dashboardMarketReturn = document.getElementById('dashboardMarketReturn');
    const currentTradePosition = document.getElementById('currentTradePosition');
    const currentTradeStake = document.getElementById('currentTradeStake');
    const currentTradeOutcome = document.getElementById('currentTradeOutcome');
    const currentTradeBalance = document.getElementById('currentTradeBalance');
    const notificationsListPage = document.getElementById('notificationsListPage');

    if (demoBalance) demoBalance.textContent = formatAccountCurrency(accounts.demo.balance);
    if (liveBalance) liveBalance.textContent = formatAccountCurrency(accounts.live.balance);

    if (currentAccountBadge) {
        currentAccountBadge.textContent = isLive ? '🔵 Live Account' : '🟢 Demo Account';
        currentAccountBadge.classList.toggle('live', isLive);
    }

    if (accountBanner) {
        accountBanner.textContent = isLive ? '🔵 Live Account Active' : '🟢 Demo Account Active';
        accountBanner.classList.toggle('live', isLive);
    }

    document.querySelectorAll('[data-account-card]').forEach((card) => {
        card.classList.toggle('active', card.dataset.accountCard === currentAccount);
    });

    if (walletTitle) walletTitle.textContent = `${activeAccount.label}`;
    if (walletBalance) walletBalance.textContent = formatAccountCurrency(activeAccount.balance);
    if (walletDeposits) walletDeposits.textContent = formatAccountCurrency(activeAccount.wallet.deposits.reduce((sum, item) => sum + Number(item.amount || 0), 0));
    if (walletWithdrawals) walletWithdrawals.textContent = formatAccountCurrency(activeAccount.wallet.withdrawals.reduce((sum, item) => sum + Number(item.amount || 0), 0));
    if (walletTransactions) walletTransactions.textContent = activeAccount.wallet.transactions.length;

    if (statsWins) statsWins.textContent = activeAccount.wins;
    if (statsLosses) statsLosses.textContent = activeAccount.losses;
    if (statsProfit) statsProfit.textContent = formatAccountCurrency(activeAccount.profitLoss);
    if (statsClosed) statsClosed.textContent = activeAccount.closedTrades.length;

    const currentPrice = Number(priceDisplay?.textContent || price || marketProfile.basePrice || 0);

    if (dashboardMarketPrice) dashboardMarketPrice.textContent = formatAccountCurrency(currentPrice);
    if (dashboardMarketStatus) dashboardMarketStatus.textContent = 'LIVE';
    if (dashboardMarketPayout) dashboardMarketPayout.textContent = `${payoutValue}%`;
    if (dashboardMarketReturn) dashboardMarketReturn.textContent = formatAccountCurrency(potentialReturn);
    if (document.getElementById('terminalPayout')) document.getElementById('terminalPayout').textContent = `${payoutValue}%`;
    if (document.getElementById('terminalReturn')) document.getElementById('terminalReturn').textContent = formatAccountCurrency(potentialReturn);
    if (document.getElementById('terminalMarketName')) document.getElementById('terminalMarketName').textContent = selectedMarket;
    if (document.getElementById('terminalPrice')) document.getElementById('terminalPrice').textContent = currentPrice.toFixed(3);
    if (document.getElementById('terminalStatus')) document.getElementById('terminalStatus').textContent = 'LIVE';

    flashPriceElements();

    const dashboardMarketInfo = document.getElementById('dashboardMarketInfo');
    if (dashboardMarketInfo) dashboardMarketInfo.textContent = selectedMarket;

    const marketTitle = document.getElementById('market-name');
    if (marketTitle) marketTitle.textContent = selectedMarket;

    if (currentTradePosition) currentTradePosition.textContent = activeAccount.openTrades.length ? activeAccount.openTrades[0].tradeType : 'Awaiting entry';
    if (currentTradeStake) currentTradeStake.textContent = activeAccount.openTrades.length ? formatAccountCurrency(activeAccount.openTrades[0].stake) : '—';
    if (currentTradeOutcome) currentTradeOutcome.textContent = activeAccount.openTrades.length ? 'Open' : 'Awaiting entry';
    if (currentTradeBalance) currentTradeBalance.textContent = formatAccountCurrency(activeAccount.balance);

    if (notificationsListPage) {
        const items = [...(activeAccount.notifications || []), ...activeAccount.wallet.deposits.map((item) => ({...item, message: `Deposit Successful via ${item.method}`, variant: 'success'})), ...activeAccount.wallet.withdrawals.map((item) => ({...item, message: `Withdrawal Successful via ${item.method}`, variant: 'error'}))].slice(0, 10);
        notificationsListPage.innerHTML = items.length ? items.map((item) => `<article class="notification-card ${item.variant || 'info'}"><strong>${item.message}</strong><p>${item.method ? `Method: ${item.method}` : 'Account activity'}</p><small>${new Date(item.createdAt || Date.now()).toLocaleString()}</small></article>`).join('') : '<div class="empty-state">No notifications yet.</div>';
    }

    if (tradeFeedback) {
        tradeFeedback.textContent = `Using ${activeAccount.label}.`;
        tradeFeedback.className = 'trade-feedback';
    }

    updateAccountPills();
    saveAccounts();
    window.dispatchEvent(new CustomEvent('account-switched', {
        detail: { accountType: currentAccount, account: activeAccount }
    }));
}

function switchAccount(accountType) {
    const nextAccount = accountType === 'live' ? 'live' : 'demo';
    currentAccount = nextAccount;
    updateActiveAccountUI();
}

function resetDemoBalance() {
    const demo = getAccountData('demo');
    const previousBalance = demo.balance;
    demo.balance = 10000;
    demo.wallet.balance = 10000;
    demo.wallet.transactions.unshift({
        id: `tx-${Date.now()}`,
        type: 'reset',
        amount: 10000 - previousBalance,
        description: 'Demo balance reset to $10,000.00',
        createdAt: new Date().toISOString()
    });
    addNotification('demo', 'Demo balance restored to $10,000.00.', 'success');
    updateActiveAccountUI();
}

function applyDeposit(amount, method) {
    const activeAccount = getAccountData();
    const depositAmount = Number(amount || 0);

    if (!depositAmount || depositAmount <= 0) {
        return { success: false, message: 'Please enter a valid deposit amount.' };
    }

    activeAccount.balance += depositAmount;
    activeAccount.wallet.balance = activeAccount.balance;
    activeAccount.wallet.deposits.push({
        id: `dep-${Date.now()}`,
        amount: depositAmount,
        method,
        createdAt: new Date().toISOString()
    });
    activeAccount.wallet.transactions.unshift({
        id: `tx-${Date.now()}`,
        type: 'deposit',
        amount: depositAmount,
        description: `${method} deposit`,
        createdAt: new Date().toISOString()
    });
    activeAccount.notifications.unshift({
        id: `nt-${Date.now()}`,
        message: `Deposit Successful via ${method}`,
        variant: 'success',
        createdAt: new Date().toISOString()
    });
    saveAccounts();
    updateActiveAccountUI();
    return { success: true, message: `Deposit of ${formatAccountCurrency(depositAmount)} added to your ${activeAccount.label}.` };
}

function applyWithdrawal(amount, method) {
    const activeAccount = getAccountData();
    const withdrawalAmount = Number(amount || 0);

    if (!withdrawalAmount || withdrawalAmount <= 0) {
        return { success: false, message: 'Please enter a valid withdrawal amount.' };
    }

    if (activeAccount.balance < withdrawalAmount) {
        return { success: false, message: 'Withdrawal exceeds the available balance.' };
    }

    activeAccount.balance -= withdrawalAmount;
    activeAccount.wallet.balance = activeAccount.balance;
    activeAccount.wallet.withdrawals.push({
        id: `wd-${Date.now()}`,
        amount: withdrawalAmount,
        method,
        createdAt: new Date().toISOString()
    });
    activeAccount.wallet.transactions.unshift({
        id: `tx-${Date.now()}`,
        type: 'withdrawal',
        amount: withdrawalAmount,
        description: `${method} withdrawal`,
        createdAt: new Date().toISOString()
    });
    activeAccount.notifications.unshift({
        id: `nt-${Date.now()}`,
        message: `Withdrawal Successful via ${method}`,
        variant: 'error',
        createdAt: new Date().toISOString()
    });
    saveAccounts();
    updateActiveAccountUI();
    return { success: true, message: `Withdrawal of ${formatAccountCurrency(withdrawalAmount)} completed.` };
}

function saveProfileData() {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profileData));
}

function saveSettingsData() {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsData));
}

function renderProfilePage() {
    const fullName = document.getElementById('profileFullName');
    const usernameField = document.getElementById('profileUsernameField');
    const email = document.getElementById('profileEmail');
    const phone = document.getElementById('profilePhone');
    const country = document.getElementById('profileCountry');
    const accountId = document.getElementById('profileAccountId');
    const registration = document.getElementById('profileRegistration');
    const nameHeading = document.getElementById('profileName');
    const usernameHeading = document.getElementById('profileUsername');
    const avatar = document.getElementById('profileAvatar');
    const formFullName = document.getElementById('formFullName');
    const formUsername = document.getElementById('formUsername');
    const formEmail = document.getElementById('formEmail');
    const formPhone = document.getElementById('formPhone');
    const formCountry = document.getElementById('formCountry');
    const formAccountId = document.getElementById('formAccountId');
    const formAvatar = document.getElementById('formAvatar');

    if (!fullName) return;

    fullName.textContent = profileData.fullName;
    usernameField.textContent = profileData.username;
    email.textContent = profileData.email;
    phone.textContent = profileData.phone;
    country.textContent = profileData.country;
    accountId.textContent = profileData.accountId;
    registration.textContent = profileData.registrationDate;
    nameHeading.textContent = profileData.fullName;
    usernameHeading.textContent = `@${profileData.username}`;
    avatar.textContent = profileData.avatar;
    formFullName.value = profileData.fullName;
    formUsername.value = profileData.username;
    formEmail.value = profileData.email;
    formPhone.value = profileData.phone;
    formCountry.value = profileData.country;
    formAccountId.value = profileData.accountId;
    formAvatar.value = profileData.avatar;
}

function renderWalletPage() {
    const walletCurrentBalance = document.getElementById('walletCurrentBalance');
    const walletAvailableBalance = document.getElementById('walletAvailableBalance');
    const walletTotalDeposits = document.getElementById('walletTotalDeposits');
    const walletTotalWithdrawals = document.getElementById('walletTotalWithdrawals');
    const walletProfitLoss = document.getElementById('walletProfitLoss');
    const walletTransactionsList = document.getElementById('walletTransactionsList');
    const activeAccount = getAccountData();

    if (!walletCurrentBalance) return;

    walletCurrentBalance.textContent = formatAccountCurrency(activeAccount.balance);
    walletAvailableBalance.textContent = formatAccountCurrency(activeAccount.balance);
    walletTotalDeposits.textContent = formatAccountCurrency(activeAccount.wallet.deposits.reduce((sum, item) => sum + Number(item.amount || 0), 0));
    walletTotalWithdrawals.textContent = formatAccountCurrency(activeAccount.wallet.withdrawals.reduce((sum, item) => sum + Number(item.amount || 0), 0));
    walletProfitLoss.textContent = formatAccountCurrency(activeAccount.profitLoss);

    if (walletTransactionsList) {
        walletTransactionsList.innerHTML = activeAccount.wallet.transactions.length ? activeAccount.wallet.transactions.slice(0, 8).map((item) => `<li>${item.description} • ${formatAccountCurrency(item.amount)} • ${new Date(item.createdAt).toLocaleDateString()}</li>`).join('') : '<li class="empty-state">No transactions yet.</li>';
    }
}

function renderDepositPage() {
    const depositHistoryList = document.getElementById('depositHistoryList');
    const activeAccount = getAccountData();

    if (depositHistoryList) {
        depositHistoryList.innerHTML = activeAccount.wallet.deposits.length ? activeAccount.wallet.deposits.map((item) => `<li>${item.method} • ${formatAccountCurrency(item.amount)} • ${new Date(item.createdAt).toLocaleDateString()}</li>`).join('') : '<li class="empty-state">No deposits yet.</li>';
    }
}

function renderWithdrawPage() {
    const withdrawHistoryList = document.getElementById('withdrawHistoryList');
    const activeAccount = getAccountData();

    if (withdrawHistoryList) {
        withdrawHistoryList.innerHTML = activeAccount.wallet.withdrawals.length ? activeAccount.wallet.withdrawals.map((item) => `<li>${item.method} • ${formatAccountCurrency(item.amount)} • ${new Date(item.createdAt).toLocaleDateString()}</li>`).join('') : '<li class="empty-state">No withdrawals yet.</li>';
    }
}

function renderSettingsPage() {
    const language = document.getElementById('settingLanguage');
    const timezone = document.getElementById('settingTimezone');
    const currency = document.getElementById('settingCurrency');
    const theme = document.getElementById('settingTheme');
    const accent = document.getElementById('settingAccent');
    const market = document.getElementById('settingMarket');
    const stake = document.getElementById('settingStake');
    const tick = document.getElementById('settingTick');
    const chart = document.getElementById('settingChart');
    const notifTrade = document.getElementById('notifTrade');
    const notifDeposit = document.getElementById('notifDeposit');
    const notifWithdraw = document.getElementById('notifWithdraw');
    const setting2fa = document.getElementById('setting2fa');
    const settingSessions = document.getElementById('settingSessions');

    if (!language) return;

    language.value = settingsData.language;
    timezone.value = settingsData.timezone;
    currency.value = settingsData.currency;
    theme.value = settingsData.theme;
    accent.value = settingsData.accent;
    market.value = settingsData.market;
    stake.value = settingsData.stake;
    tick.value = settingsData.tick;
    chart.value = settingsData.chart;
    notifTrade.checked = settingsData.notifications.trade;
    notifDeposit.checked = settingsData.notifications.deposit;
    notifWithdraw.checked = settingsData.notifications.withdraw;
    setting2fa.checked = settingsData.security.twoFactor;
    settingSessions.checked = settingsData.security.sessions;
}

let price = 16584.621;

const PROFILE_STORAGE_KEY = 'novaxProfileData';
const SETTINGS_STORAGE_KEY = 'novaxSettingsData';
const MARKET_PROFILES = {
    'Volatility 10 Index': { basePrice: 14500.328, payout: 88 },
    'Volatility 25 Index': { basePrice: 15240.612, payout: 90 },
    'Volatility 50 Index': { basePrice: 15941.702, payout: 92 },
    'Volatility 75 Index': { basePrice: 16584.621, payout: 95 },
    'Volatility 100 Index': { basePrice: 17120.310, payout: 97 },
    'Volatility 10 (1s)': { basePrice: 14700.241, payout: 88 },
    'Volatility 25 (1s)': { basePrice: 15390.514, payout: 90 },
    'Volatility 50 (1s)': { basePrice: 16043.406, payout: 92 },
    'Volatility 75 (1s)': { basePrice: 16658.489, payout: 95 },
    'Volatility 100 (1s)': { basePrice: 17280.114, payout: 97 },
    'Jump 10 Index': { basePrice: 14942.618, payout: 89 },
    'Jump 25 Index': { basePrice: 15603.877, payout: 91 },
    'Jump 50 Index': { basePrice: 16208.291, payout: 93 },
    'Jump 75 Index': { basePrice: 16812.173, payout: 95 },
    'Jump 100 Index': { basePrice: 17433.486, payout: 97 },
    'Step Index': { basePrice: 15141.790, payout: 91 }
};

function getMarketProfile(marketName = settingsData.market || 'Volatility 75 Index') {
    return MARKET_PROFILES[marketName] || MARKET_PROFILES['Volatility 75 Index'];
}

function getSelectedMarketName() {
    return marketSelect?.value || settingsData.market || 'Volatility 75 Index';
}

function getPotentialReturn(stakeValue = Number(settingsData.stake || 25), marketName = getSelectedMarketName()) {
    const profile = getMarketProfile(marketName);
    return Number(stakeValue || 0) * (Number(profile.payout || 95) / 100);
}

function flashPriceElements() {
    const elements = [priceDisplay, document.getElementById('dashboardMarketPrice'), document.getElementById('terminalPrice')].filter(Boolean);

    elements.forEach((element) => {
        element.classList.remove('price-flash');
        void element.offsetWidth;
        element.classList.add('price-flash');
    });

    window.setTimeout(() => {
        elements.forEach((element) => element.classList.remove('price-flash'));
    }, 220);
}

let profileData = {
    fullName: 'Novax Trader',
    username: 'novaxtrader',
    email: 'trader@novaxmarkets.com',
    phone: '+1 555 0100',
    country: 'United States',
    accountId: 'NM-1001',
    registrationDate: '2024-01-15',
    avatar: 'NT'
};

let settingsData = {
    language: 'English',
    timezone: 'UTC',
    currency: 'USD',
    theme: 'dark',
    accent: '#00c2ff',
    market: 'Volatility 75 Index',
    stake: 25,
    tick: '5',
    chart: 'line',
    notifications: {
        trade: true,
        deposit: true,
        withdraw: true
    },
    security: {
        twoFactor: false,
        sessions: true
    }
};

try {
    const storedProfile = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY));
    if (storedProfile) profileData = { ...profileData, ...storedProfile };

    const storedSettings = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY));
    if (storedSettings) {
        settingsData = {
            ...settingsData,
            ...storedSettings,
            notifications: { ...settingsData.notifications, ...(storedSettings.notifications || {}) },
            security: { ...settingsData.security, ...(storedSettings.security || {}) }
        };
    }
} catch (error) {
    console.warn('Unable to restore profile or settings.', error);
}

const priceDisplay = document.getElementById("tick-price");
const lastDigitDisplay = document.getElementById("last-digit");
const digitBoxes = document.querySelectorAll('.digit');
const digitHistory = [];
const DIGIT_WINDOW = 300;
const chartSurface = document.getElementById('liveChart');
const chartButtons = document.querySelectorAll('.chart-btn');
const chartTypeKey = 'novaxChartType';

let chartData = [];
let prices = [];
let selectedChartType = localStorage.getItem(chartTypeKey) || 'line';
let visiblePoints = 70;
let panOffset = 0;
let dragging = false;
let dragStartX = 0;
let dragStartPan = 0;
let panelWidth = 0;
let panelHeight = 0;

const chartColors = {
    green: '#18c874',
    red: '#ff5f6d',
    teal: '#7fe7ff',
    bg: '#08111e',
    grid: 'rgba(148, 163, 184, 0.18)',
    text: '#c8d7ee',
    muted: '#8394b5'
};

const chartCanvas = document.createElement('canvas');
chartCanvas.id = 'novaxChartCanvas';
chartCanvas.setAttribute('role', 'img');
chartCanvas.setAttribute('aria-label', 'NovaxMarkets live market chart');
chartCanvas.style.width = '100%';
chartCanvas.style.height = '100%';
chartCanvas.style.display = 'block';

if (chartSurface && !chartSurface.querySelector('#novaxChartCanvas')) {
    chartSurface.appendChild(chartCanvas);
}

const chartContext = chartCanvas.getContext('2d');

function seedDigitHistory() {
    for (let i = 0; i < DIGIT_WINDOW; i++) {
        digitHistory.push(Math.floor(Math.random() * 10));
    }
}

function seedChartHistory() {
    const now = Math.floor(Date.now() / 1000);

    for (let i = 59; i >= 0; i--) {
        const value = parseFloat((price + (Math.random() * 8 - 4)).toFixed(3));
        prices.push(value);

        const open = value;
        const close = value;
        const high = parseFloat((open + 0.5).toFixed(3));
        const low = parseFloat((close - 0.5).toFixed(3));

        chartData.push({
            time: now - i,
            open,
            high,
            low,
            close
        });
    }
}

seedDigitHistory();
seedChartHistory();

function updateRollingDigitStats(digit) {
    digitHistory.push(digit);

    if (digitHistory.length > DIGIT_WINDOW) {
        digitHistory.shift();
    }

    const recentDigits = digitHistory.slice(-DIGIT_WINDOW);
    const counts = Array(10).fill(0);
    recentDigits.forEach((value) => counts[value] += 1);

    const total = recentDigits.length || 1;
    const maxCount = Math.max(...counts);
    const minCount = Math.min(...counts);
    const mostDigit = counts.indexOf(maxCount);
    const leastDigit = counts.indexOf(minCount);

    digitBoxes.forEach((box) => {
        const digitValue = Number(box.dataset.digit);
        const percentage = (counts[digitValue] / total) * 100;
        const percentText = box.querySelector('.digit-percent');

        if (percentText) {
            percentText.textContent = `${percentage.toFixed(1)}%`;
        }

        box.classList.remove('most', 'least', 'neutral', 'active');

        if (digitValue === mostDigit) {
            box.classList.add('most');
        } else if (digitValue === leastDigit) {
            box.classList.add('least');
        } else {
            box.classList.add('neutral');
        }

        if (Number(lastDigitDisplay.textContent) === digitValue) {
            box.classList.add('active');
        }
    });
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function resizeChartCanvas() {
    if (!chartSurface || !chartCanvas || !chartContext) return;

    const rect = chartSurface.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    panelWidth = Math.max(300, Math.round(rect.width));
    panelHeight = Math.max(260, Math.round(rect.height));

    chartCanvas.width = Math.round(panelWidth * dpr);
    chartCanvas.height = Math.round(panelHeight * dpr);
    chartCanvas.style.width = `${panelWidth}px`;
    chartCanvas.style.height = `${panelHeight}px`;
    chartContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawChart();
}

function getVisibleWindow() {
    const maxPoints = Math.max(28, Math.min(140, visiblePoints));
    const start = clamp(chartData.length - maxPoints - panOffset, 0, Math.max(0, chartData.length - 1));
    const end = clamp(chartData.length - panOffset, start + 2, chartData.length);
    return chartData.slice(start, end);
}

function drawBackdrop(width, height, minValue, maxValue, dataSlice) {
    const plotTop = 24;
    const plotBottom = height - 30;
    const plotLeft = 10;
    const plotRight = width - 12;
    const plotHeight = plotBottom - plotTop;
    const plotWidth = plotRight - plotLeft;
    const range = Math.max(maxValue - minValue, 0.001);

    chartContext.clearRect(0, 0, width, height);

    const bgGradient = chartContext.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#0a1425');
    bgGradient.addColorStop(1, '#06101c');
    chartContext.fillStyle = bgGradient;
    chartContext.fillRect(0, 0, width, height);

    chartContext.strokeStyle = chartColors.grid;
    chartContext.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
        const y = plotTop + (plotHeight / 4) * i;
        chartContext.beginPath();
        chartContext.moveTo(plotLeft, y);
        chartContext.lineTo(plotRight, y);
        chartContext.stroke();
    }

    for (let i = 0; i <= 5; i++) {
        const x = plotLeft + (plotWidth / 5) * i;
        chartContext.beginPath();
        chartContext.moveTo(x, plotTop);
        chartContext.lineTo(x, plotBottom);
        chartContext.stroke();
    }

    chartContext.fillStyle = chartColors.muted;
    chartContext.font = '12px Segoe UI, Arial, sans-serif';
    chartContext.textAlign = 'right';

    for (let i = 0; i <= 4; i++) {
        const value = maxValue - (range / 4) * i;
        const y = plotTop + (plotHeight / 4) * i;
        chartContext.fillText(value.toFixed(3), plotRight - 4, y + 4);
    }

    chartContext.textAlign = 'left';
    chartContext.fillStyle = chartColors.muted;

    for (let i = 0; i < 6; i++) {
        const index = Math.max(0, Math.round((dataSlice.length - 1) * (i / 5)));
        const x = plotLeft + (plotWidth / 5) * i;
        const label = dataSlice[index]?.time ? new Date(dataSlice[index].time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
        chartContext.fillText(label, x + 4, height - 8);
    }

    chartContext.fillStyle = chartColors.teal;
    chartContext.font = '700 12px Segoe UI, Arial, sans-serif';
    chartContext.fillText('NOVAX MARKETS', plotLeft + 4, plotTop - 8);
}

function drawLineChart(width, height, dataSlice) {
    const plotTop = 24;
    const plotBottom = height - 30;
    const plotLeft = 10;
    const plotRight = width - 12;
    const plotHeight = plotBottom - plotTop;
    const plotWidth = plotRight - plotLeft;
    const values = dataSlice.map((item) => item.close);
    const minValue = Math.min(...values) - 0.4;
    const maxValue = Math.max(...values) + 0.4;
    const range = Math.max(maxValue - minValue, 0.001);

    drawBackdrop(width, height, minValue, maxValue, dataSlice);

    const xStep = plotWidth / Math.max(dataSlice.length - 1, 1);
    const points = dataSlice.map((item, index) => ({
        x: plotLeft + index * xStep,
        y: plotTop + plotHeight - ((item.close - minValue) / range) * plotHeight,
        value: item.close
    }));

    chartContext.beginPath();
    chartContext.lineWidth = 2.5;
    chartContext.strokeStyle = chartColors.green;
    chartContext.shadowColor = 'rgba(24,200,116,0.65)';
    chartContext.shadowBlur = 12;

    points.forEach((point, index) => {
        if (index === 0) {
            chartContext.moveTo(point.x, point.y);
        } else {
            chartContext.lineTo(point.x, point.y);
        }
    });

    chartContext.stroke();
    chartContext.shadowBlur = 0;

    const lastPoint = points[points.length - 1];
    const prevPoint = points[points.length - 2] || points[0];
    const markerColor = lastPoint.value >= prevPoint.value ? chartColors.green : chartColors.red;

    chartContext.beginPath();
    chartContext.fillStyle = markerColor;
    chartContext.arc(lastPoint.x, lastPoint.y, 4.6, 0, Math.PI * 2);
    chartContext.fill();

    chartContext.beginPath();
    chartContext.fillStyle = '#ffffff';
    chartContext.arc(lastPoint.x, lastPoint.y, 2.1, 0, Math.PI * 2);
    chartContext.fill();

    chartContext.beginPath();
    chartContext.strokeStyle = 'rgba(255,255,255,0.75)';
    chartContext.moveTo(lastPoint.x, plotTop);
    chartContext.lineTo(lastPoint.x, plotBottom);
    chartContext.stroke();

    chartContext.fillStyle = '#edf4ff';
    chartContext.font = '700 12px Segoe UI, Arial, sans-serif';
    chartContext.fillText(`LIVE ${lastPoint.value.toFixed(3)}`, plotLeft + 4, plotTop + 14);
}

function drawCandleChart(width, height, dataSlice) {
    const plotTop = 24;
    const plotBottom = height - 30;
    const plotLeft = 10;
    const plotRight = width - 12;
    const plotHeight = plotBottom - plotTop;
    const plotWidth = plotRight - plotLeft;
    const allHigh = Math.max(...dataSlice.map((item) => item.high));
    const allLow = Math.min(...dataSlice.map((item) => item.low));
    const minValue = allLow - 0.4;
    const maxValue = allHigh + 0.4;
    const range = Math.max(maxValue - minValue, 0.001);

    drawBackdrop(width, height, minValue, maxValue, dataSlice);

    const step = plotWidth / Math.max(dataSlice.length, 1);
    const bodyWidth = Math.max(4, step * 0.48);

    dataSlice.forEach((item, index) => {
        const x = plotLeft + step * index + step / 2;
        const openY = plotTop + plotHeight - ((item.open - minValue) / range) * plotHeight;
        const closeY = plotTop + plotHeight - ((item.close - minValue) / range) * plotHeight;
        const highY = plotTop + plotHeight - ((item.high - minValue) / range) * plotHeight;
        const lowY = plotTop + plotHeight - ((item.low - minValue) / range) * plotHeight;
        const isUp = item.close >= item.open;

        chartContext.strokeStyle = isUp ? chartColors.green : chartColors.red;
        chartContext.lineWidth = 1.5;
        chartContext.beginPath();
        chartContext.moveTo(x, highY);
        chartContext.lineTo(x, lowY);
        chartContext.stroke();

        chartContext.fillStyle = isUp ? 'rgba(24,200,116,0.88)' : 'rgba(255,95,109,0.88)';
        chartContext.strokeStyle = isUp ? chartColors.green : chartColors.red;
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(3, Math.abs(closeY - openY));
        chartContext.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
        chartContext.strokeRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight);
    });
}

function drawOHLCChart(width, height, dataSlice) {
    const plotTop = 24;
    const plotBottom = height - 30;
    const plotLeft = 10;
    const plotRight = width - 12;
    const plotHeight = plotBottom - plotTop;
    const plotWidth = plotRight - plotLeft;
    const allHigh = Math.max(...dataSlice.map((item) => item.high));
    const allLow = Math.min(...dataSlice.map((item) => item.low));
    const minValue = allLow - 0.4;
    const maxValue = allHigh + 0.4;
    const range = Math.max(maxValue - minValue, 0.001);

    drawBackdrop(width, height, minValue, maxValue, dataSlice);

    const step = plotWidth / Math.max(dataSlice.length, 1);

    dataSlice.forEach((item, index) => {
        const x = plotLeft + step * index + step / 2;
        const openY = plotTop + plotHeight - ((item.open - minValue) / range) * plotHeight;
        const closeY = plotTop + plotHeight - ((item.close - minValue) / range) * plotHeight;
        const highY = plotTop + plotHeight - ((item.high - minValue) / range) * plotHeight;
        const lowY = plotTop + plotHeight - ((item.low - minValue) / range) * plotHeight;
        const isUp = item.close >= item.open;

        chartContext.strokeStyle = isUp ? chartColors.green : chartColors.red;
        chartContext.lineWidth = 1.4;
        chartContext.beginPath();
        chartContext.moveTo(x, highY);
        chartContext.lineTo(x, lowY);
        chartContext.stroke();

        chartContext.beginPath();
        chartContext.moveTo(x - 5, openY);
        chartContext.lineTo(x, openY);
        chartContext.stroke();

        chartContext.beginPath();
        chartContext.moveTo(x, closeY);
        chartContext.lineTo(x + 5, closeY);
        chartContext.stroke();
    });
}

function drawChart() {
    if (!chartCanvas || !chartContext || !chartSurface) return;

    const width = panelWidth || chartSurface.clientWidth || 640;
    const height = panelHeight || chartSurface.clientHeight || 320;
    const dataSlice = getVisibleWindow();

    if (selectedChartType === 'line') {
        drawLineChart(width, height, dataSlice);
    } else if (selectedChartType === 'candle') {
        drawCandleChart(width, height, dataSlice);
    } else {
        drawOHLCChart(width, height, dataSlice);
    }
}

function applyChartType(type) {
    const nextType = type || 'line';
    selectedChartType = nextType;
    localStorage.setItem(chartTypeKey, nextType);

    chartButtons.forEach((button) => {
        button.classList.toggle('active', button.dataset.chart === nextType);
    });

    drawChart();
}

function updatePriceTick() {
    const activeMarket = getSelectedMarketName();
    const profile = getMarketProfile(activeMarket);
    const nextChange = (Math.random() * 2.4 - 1.2).toFixed(3);
    const nextPrice = Number((parseFloat(price || profile.basePrice) + parseFloat(nextChange)).toFixed(3));
    price = nextPrice;

    if (priceDisplay) {
        priceDisplay.textContent = price.toFixed(3);
    }

    const dashboardMarketPrice = document.getElementById('dashboardMarketPrice');
    if (dashboardMarketPrice) {
        dashboardMarketPrice.textContent = formatAccountCurrency(price);
    }

    const latestDigit = Number(price.toString().slice(-1));
    flashPriceElements();

    if (lastDigitDisplay) {
        lastDigitDisplay.textContent = latestDigit;
    }

    updateRollingDigitStats(latestDigit);

    prices.push(parseFloat(price));

    if (prices.length > 120) {
        prices.shift();
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const previous = chartData[chartData.length - 1] || { open: parseFloat(price), high: parseFloat(price), low: parseFloat(price), close: parseFloat(price) };
    const open = previous.close;
    const close = parseFloat(price);
    const high = parseFloat(Math.max(open, close).toFixed(3)) + 0.15;
    const low = parseFloat(Math.min(open, close).toFixed(3)) - 0.15;

    chartData.push({
        time: currentTime,
        open: parseFloat(open.toFixed(3)),
        high: parseFloat(high.toFixed(3)),
        low: parseFloat(low.toFixed(3)),
        close: parseFloat(close.toFixed(3))
    });

    if (chartData.length > 240) {
        chartData.shift();
    }

    drawChart();
}

setInterval(updatePriceTick, 700);

let tickSelector = document.getElementById("tick-duration");
let countdownDisplay = document.getElementById("countdown");

let countdown = tickSelector ? Number(tickSelector.value) : 5;

if (tickSelector && countdownDisplay) {
    tickSelector.addEventListener("change", function () {
        countdown = Number(this.value);
        countdownDisplay.textContent = countdown;
    });

    setInterval(function () {
        countdown--;

        if (countdown < 0) {
            countdown = Number(tickSelector.value);
        }

        countdownDisplay.textContent = countdown;
    }, 1000);
}

if (lastDigitDisplay && lastDigitDisplay.textContent) {
    updateRollingDigitStats(Number(lastDigitDisplay.textContent));
} else {
    // initialize with a random digit if element not present
    updateRollingDigitStats(Math.floor(Math.random() * 10));
}

const marketSelect = document.getElementById("market-select");
const marketName = document.getElementById("market-name");

function syncMarketSelectionUI() {
    const selectedMarket = settingsData.market || 'Volatility 75 Index';
    const currentSelection = marketSelect?.value || selectedMarket;

    if (marketSelect) {
        const hasMarketOption = Array.from(marketSelect.options).some((option) => option.value === selectedMarket);
        marketSelect.value = hasMarketOption ? selectedMarket : currentSelection;
    }

    const activeMarket = marketSelect?.value || selectedMarket;
    if (marketName) marketName.textContent = activeMarket;
    const dashboardMarketInfo = document.getElementById('dashboardMarketInfo');
    if (dashboardMarketInfo) dashboardMarketInfo.textContent = activeMarket;
    price = getMarketProfile(activeMarket).basePrice;
    if (priceDisplay) priceDisplay.textContent = price.toFixed(3);
    updateActiveAccountUI();
}

const menuToggle = document.getElementById("menuToggle");
const navDrawer = document.getElementById("navDrawer");
const drawerOverlay = document.getElementById("drawerOverlay");
const profileToggle = document.getElementById("profileToggle");
const profileDropdown = document.getElementById("profileDropdown");
const accountPills = document.querySelectorAll('.account-pill');
const currentAccountBadge = document.getElementById('current-account-badge');
const demoBalance = document.getElementById('demo-balance');
const liveBalance = document.getElementById('live-balance');
const tradeButtons = {
    even: document.querySelector('.even-btn'),
    odd: document.querySelector('.odd-btn')
};
const liveChatButton = document.getElementById('openLiveChatBtn');
const liveChatWindow = document.getElementById('liveChatWindow');
const closeLiveChatButton = document.getElementById('closeLiveChat');
const liveChatInput = document.getElementById('liveChatInput');
const sendLiveChatButton = document.getElementById('sendLiveChat');
let touchStartX = 0;

function getBalanceValue(element) {
    return Number(String(element?.textContent || '$0.00').replace(/[^0-9.-]/g, '') || 0);
}

function persistTradeRecord(record) {
    const activeAccount = getAccountData(record.accountType);
    activeAccount.tradeHistory.unshift(record);
    activeAccount.tradeHistory = activeAccount.tradeHistory.slice(0, 60);

    if (record.result === 'won') {
        activeAccount.wins += 1;
        activeAccount.profitLoss += record.profitLoss;
    } else {
        activeAccount.losses += 1;
        activeAccount.profitLoss += record.profitLoss;
    }

    if (record.result === 'won') {
        activeAccount.closedTrades.push(record);
    } else {
        activeAccount.closedTrades.push(record);
    }

    const recentRecord = {
        id: `tx-${Date.now()}`,
        type: record.result === 'won' ? 'trade-win' : 'trade-loss',
        amount: Math.abs(record.profitLoss),
        description: `${record.tradeType} trade ${record.result} on ${record.market}`,
        createdAt: new Date().toISOString()
    };
    activeAccount.wallet.transactions.unshift(recentRecord);
    activeAccount.wallet.transactions = activeAccount.wallet.transactions.slice(0, 20);
    activeAccount.wallet.balance = activeAccount.balance;
    saveAccounts();
}

function completeTrade(direction) {
    const currentMarket = marketName ? marketName.textContent : (marketSelect ? marketSelect.value : 'Volatility 75 Index');
    const accountType = getActiveAccountType();
    const activeAccount = getAccountData(accountType);
    const stake = Number(settingsData.stake || 25) + Math.floor(Math.random() * 20);
    const entryPrice = Number(priceDisplay?.textContent || price || 0);
    const exitPrice = Number((entryPrice + (Math.random() * 1.2 - 0.6)).toFixed(3));
    const winningDigit = Number(lastDigitDisplay?.textContent || 0);
    const outcome = Math.random() > 0.45 ? 'won' : 'lost';
    const profitLoss = outcome === 'won' ? stake * 0.95 : -stake;

    if (accountType === 'live' && activeAccount.balance < stake) {
        const feedback = document.getElementById('trade-feedback');
        if (feedback) {
            feedback.textContent = 'Insufficient funds for this Live account trade.';
            feedback.className = 'trade-feedback error';
        }
        addNotification('live', 'Live trade blocked: insufficient funds.', 'error');
        return;
    }

    const updatedBalance = Number((activeAccount.balance + profitLoss).toFixed(2));
    activeAccount.balance = accountType === 'live' ? Math.max(0, updatedBalance) : updatedBalance;
    activeAccount.wallet.balance = activeAccount.balance;
    activeAccount.openTrades = activeAccount.openTrades.filter((trade) => trade.id !== `open-${Date.now()}`);

    const tradeRecord = {
        id: `NM-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString(),
        market: currentMarket,
        tradeType: direction.toUpperCase(),
        stake,
        entryPrice,
        exitPrice,
        tickDuration: Number(tickSelector?.value || 5),
        winningDigit,
        result: outcome,
        payout: 95,
        accountType,
        entryTime: new Date().toISOString(),
        exitTime: new Date(Date.now() + 1000).toISOString(),
        tickHistory: digitHistory.slice(-3),
        profitLoss,
        balanceAfterTrade: activeAccount.balance,
        status: 'completed'
    };

    persistTradeRecord(tradeRecord);
    addNotification(accountType, outcome === 'won' ? 'Trade Won' : 'Trade Lost', outcome === 'won' ? 'success' : 'error');
    addNotification(accountType, 'Trade Opened', 'info');
    updateActiveAccountUI();

    if (tradeFeedback) {
        tradeFeedback.textContent = `${direction.toUpperCase()} trade ${outcome} on ${currentMarket}.`;
        tradeFeedback.className = `trade-feedback ${outcome === 'won' ? 'success' : 'error'}`;
    }
}

chartButtons.forEach((button) => {
    button.addEventListener('click', function () {
        applyChartType(this.dataset.chart);
    });
});

chartCanvas.addEventListener('wheel', function (event) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? 5 : -5;
    visiblePoints = clamp(visiblePoints + delta, 24, 160);
    drawChart();
}, { passive: false });

chartCanvas.addEventListener('pointerdown', function (event) {
    dragging = true;
    dragStartX = event.clientX;
    dragStartPan = panOffset;
    chartCanvas.setPointerCapture(event.pointerId);
});

chartCanvas.addEventListener('pointermove', function (event) {
    if (!dragging) return;

    const deltaX = event.clientX - dragStartX;
    const panStep = Math.round(deltaX / 18);
    panOffset = clamp(dragStartPan + panStep, 0, Math.max(0, chartData.length - visiblePoints));
    drawChart();
});

chartCanvas.addEventListener('pointerup', function (event) {
    dragging = false;
    if (chartCanvas.hasPointerCapture(event.pointerId)) {
        chartCanvas.releasePointerCapture(event.pointerId);
    }
});

chartCanvas.addEventListener('pointerleave', function () {
    dragging = false;
});

window.addEventListener('resize', resizeChartCanvas);

function setDrawerState(isOpen) {
    if (!navDrawer || !drawerOverlay || !menuToggle) return;

    navDrawer.classList.toggle('open', isOpen);
    drawerOverlay.classList.toggle('show', isOpen);
    menuToggle.setAttribute('aria-expanded', String(isOpen));
}

function toggleDrawer() {
    const isOpen = navDrawer.classList.contains('open');
    setDrawerState(!isOpen);
}

if (menuToggle) {
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.addEventListener('click', toggleDrawer);
}

if (drawerOverlay) {
    drawerOverlay.addEventListener('click', function () {
        setDrawerState(false);
    });
}

if (profileToggle && profileDropdown) {
    profileToggle.setAttribute('aria-expanded', 'false');
    profileToggle.addEventListener('click', function () {
        const isOpen = profileDropdown.classList.toggle('show');
        profileToggle.setAttribute('aria-expanded', String(isOpen));
    });
}

window.addEventListener('click', function (event) {
    if (profileDropdown && profileToggle && !profileDropdown.contains(event.target) && !profileToggle.contains(event.target)) {
        profileDropdown.classList.remove('show');
        profileToggle.setAttribute('aria-expanded', 'false');
    }

    if (navDrawer && menuToggle && !navDrawer.contains(event.target) && !menuToggle.contains(event.target)) {
        setDrawerState(false);
    }
});

window.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        setDrawerState(false);
        if (profileDropdown) {
            profileDropdown.classList.remove('show');
            if (profileToggle) {
                profileToggle.setAttribute('aria-expanded', 'false');
            }
        }
    }
});

function renderNotificationsPage() {
    const notificationsListPage = document.getElementById('notificationsListPage');
    if (!notificationsListPage) return;

    const activeAccount = getAccountData();
    const items = [
        ...(activeAccount.notifications || []),
        ...activeAccount.wallet.deposits.map((item) => ({ message: `Deposit Successful via ${item.method}`, variant: 'success', createdAt: item.createdAt, method: item.method })),
        ...activeAccount.wallet.withdrawals.map((item) => ({ message: `Withdrawal Successful via ${item.method}`, variant: 'error', createdAt: item.createdAt, method: item.method }))
    ]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 10);

    notificationsListPage.innerHTML = items.length ? items.map((item) => `<article class="notification-card ${item.variant || 'info'}"><strong>${item.message}</strong><p>${item.method ? `Method: ${item.method}` : 'Account activity'}</p><small>${new Date(item.createdAt || Date.now()).toLocaleString()}</small></article>`).join('') : '<div class="empty-state">No notifications yet.</div>';
}

function bindExtendedPages() {
    const profileForm = document.getElementById('profileForm');
    const passwordForm = document.getElementById('passwordForm');
    const depositForm = document.getElementById('depositForm');
    const withdrawForm = document.getElementById('withdrawForm');
    const editProfileBtn = document.getElementById('editProfileBtn');
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const cancelProfileEdit = document.getElementById('cancelProfileEdit');
    const cancelPasswordEdit = document.getElementById('cancelPasswordEdit');
    const profileFormCard = document.getElementById('profileFormCard');
    const passwordFormCard = document.getElementById('passwordFormCard');
    const depositMessage = document.getElementById('depositMessage');
    const withdrawMessage = document.getElementById('withdrawMessage');

    if (editProfileBtn && profileFormCard) {
        editProfileBtn.addEventListener('click', () => profileFormCard.hidden = false);
    }

    if (changePasswordBtn && passwordFormCard) {
        changePasswordBtn.addEventListener('click', () => passwordFormCard.hidden = false);
    }

    if (cancelProfileEdit && profileFormCard) {
        cancelProfileEdit.addEventListener('click', () => profileFormCard.hidden = true);
    }

    if (cancelPasswordEdit && passwordFormCard) {
        cancelPasswordEdit.addEventListener('click', () => passwordFormCard.hidden = true);
    }

    if (profileForm) {
        profileForm.addEventListener('submit', (event) => {
            event.preventDefault();
            profileData.fullName = document.getElementById('formFullName').value;
            profileData.username = document.getElementById('formUsername').value;
            profileData.email = document.getElementById('formEmail').value;
            profileData.phone = document.getElementById('formPhone').value;
            profileData.country = document.getElementById('formCountry').value;
            profileData.accountId = document.getElementById('formAccountId').value;
            profileData.avatar = document.getElementById('formAvatar').value || profileData.avatar;
            saveProfileData();
            renderProfilePage();
            profileFormCard.hidden = true;
        });
    }

    if (passwordForm) {
        passwordForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            if (newPassword !== confirmPassword) {
                window.alert('Passwords do not match.');
                return;
            }
            passwordFormCard.hidden = true;
            window.alert('Password updated successfully.');
        });
    }

    const settingsInputs = [
        ['settingLanguage', 'language'],
        ['settingTimezone', 'timezone'],
        ['settingCurrency', 'currency'],
        ['settingTheme', 'theme'],
        ['settingAccent', 'accent'],
        ['settingMarket', 'market'],
        ['settingStake', 'stake'],
        ['settingTick', 'tick'],
        ['settingChart', 'chart']
    ];

    settingsInputs.forEach(([id, key]) => {
        const element = document.getElementById(id);
        if (!element) return;
        element.addEventListener('change', () => {
            settingsData[key] = element.value;
            saveSettingsData();
            updateActiveAccountUI();
        });
    });

    const notificationInputs = [
        ['notifTrade', 'trade'],
        ['notifDeposit', 'deposit'],
        ['notifWithdraw', 'withdraw']
    ];

    notificationInputs.forEach(([id, key]) => {
        const element = document.getElementById(id);
        if (!element) return;
        element.addEventListener('change', () => {
            settingsData.notifications[key] = element.checked;
            saveSettingsData();
            updateActiveAccountUI();
        });
    });

    const securityInputs = [
        ['setting2fa', 'twoFactor'],
        ['settingSessions', 'sessions']
    ];

    securityInputs.forEach(([id, key]) => {
        const element = document.getElementById(id);
        if (!element) return;
        element.addEventListener('change', () => {
            settingsData.security[key] = element.checked;
            saveSettingsData();
            updateActiveAccountUI();
        });
    });

    if (depositForm && depositMessage) {
        depositForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const amount = document.getElementById('depositAmount').value;
            const method = document.getElementById('depositMethod').value;
            const result = applyDeposit(amount, method);
            depositMessage.textContent = result.message;
            depositMessage.className = `message-box ${result.success ? 'success' : 'error'}`;
            if (result.success) {
                depositForm.reset();
                renderDepositPage();
            }
        });
    }

    if (withdrawForm && withdrawMessage) {
        withdrawForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const amount = document.getElementById('withdrawAmount').value;
            const method = document.getElementById('withdrawMethod').value;
            const result = applyWithdrawal(amount, method);
            withdrawMessage.textContent = result.message;
            withdrawMessage.className = `message-box ${result.success ? 'success' : 'error'}`;
            if (result.success) {
                withdrawForm.reset();
                renderWithdrawPage();
            }
        });
    }
}

window.addEventListener('touchstart', function (event) {
    touchStartX = event.changedTouches[0].screenX;
}, { passive: true });

window.addEventListener('touchend', function (event) {
    const touchEndX = event.changedTouches[0].screenX;
    const diff = touchEndX - touchStartX;

    if (diff > 70 && touchStartX < 30 && navDrawer) {
        setDrawerState(true);
    }

    if (diff < -70 && navDrawer && navDrawer.classList.contains('open')) {
        setDrawerState(false);
    }
}, { passive: true });

accountPills.forEach((pill) => {
    pill.addEventListener('click', function () {
        switchAccount(this.dataset.account);
    });
});

const resetDemoBtn = document.getElementById('resetDemoBtn');
if (resetDemoBtn) {
    resetDemoBtn.addEventListener('click', function () {
        if (window.confirm('Reset the Demo balance to $10,000.00?')) {
            resetDemoBalance();
        }
    });
}

if (marketSelect && marketName) {
    marketSelect.addEventListener("change", function () {
        const nextMarket = marketSelect.value;
        marketName.textContent = nextMarket;
        if (document.getElementById('dashboardMarketInfo')) {
            document.getElementById('dashboardMarketInfo').textContent = nextMarket;
        }
        settingsData.market = nextMarket;
        saveSettingsData();
        price = getMarketProfile(nextMarket).basePrice;
        if (priceDisplay) priceDisplay.textContent = price.toFixed(3);
    });
}

if (tradeButtons.even) {
    tradeButtons.even.addEventListener('click', function () {
        completeTrade('even');
    });
}

if (tradeButtons.even) {
    tradeButtons.even.addEventListener('click', function () {
        completeTrade('even');
    });
}

if (tradeButtons.odd) {
    tradeButtons.odd.addEventListener('click', function () {
        completeTrade('odd');
    });
}

function toggleLiveChat(forceOpen) {
    if (!liveChatWindow || !liveChatButton) return;
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !liveChatWindow.classList.contains('open');
    liveChatWindow.classList.toggle('open', shouldOpen);
    liveChatWindow.setAttribute('aria-hidden', String(!shouldOpen));
}

if (liveChatButton) {
    liveChatButton.addEventListener('click', () => toggleLiveChat());
}

if (closeLiveChatButton) {
    closeLiveChatButton.addEventListener('click', () => toggleLiveChat(false));
}

if (sendLiveChatButton && liveChatInput) {
    sendLiveChatButton.addEventListener('click', () => {
        const message = liveChatInput.value.trim();
        if (!message) return;
        const chatMessages = liveChatWindow.querySelector('.chat-messages');
        if (chatMessages) {
            const bubble = document.createElement('div');
            bubble.className = 'chat-bubble';
            bubble.textContent = message;
            chatMessages.appendChild(bubble);
            liveChatInput.value = '';
            setTimeout(() => {
                const response = document.createElement('div');
                response.className = 'chat-bubble agent';
                response.textContent = 'Our team is reviewing your request.';
                chatMessages.appendChild(response);
            }, 450);
        }
    });
}

if (navDrawer) {
    navDrawer.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', function () {
            setDrawerState(false);
        });
    });
}

resizeChartCanvas();
applyChartType(selectedChartType);

function bootExtendedPages() {
    renderProfilePage();
    renderWalletPage();
    renderDepositPage();
    renderWithdrawPage();
    renderSettingsPage();
    bindExtendedPages();
}

window.addEventListener('account-state-updated', () => {
    renderProfilePage();
    renderWalletPage();
    renderDepositPage();
    renderWithdrawPage();
    renderSettingsPage();
    renderNotificationsPage();
});

let appBooted = false;

function bootApp() {
    if (appBooted) return;
    appBooted = true;

    // Defensive fix: on the public login page a stray overlay
    // (drawer overlay / live-chat / similar) may be present in
    // some deployments and can block pointer events. If we're
    // on `login.html` hide any overlay-like elements so the
    // inputs remain interactive. This is a minimal runtime
    // safeguard that does not change authentication logic.
    try {
        const page = getCurrentPageName();
        if (page === 'login.html') {
            document.querySelectorAll('.overlay, #drawerOverlay, .live-chat-window, #liveChatWindow').forEach((el) => {
                try {
                    el.style.display = 'none';
                    el.style.pointerEvents = 'none';
                } catch (e) {}
            });
        }
    } catch (e) {}

    if (!applyAuthRouting()) {
        return;
    }

    bindAuthForms();
    bindLogoutLinks();
    bootExtendedPages();
    renderNotificationsPage();
}

window.addEventListener('DOMContentLoaded', bootApp);
bootApp();
