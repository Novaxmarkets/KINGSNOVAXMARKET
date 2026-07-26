const HISTORY_STORAGE_KEY = 'novaxMarketsTradeHistory';
const ACCOUNT_STORAGE_KEY = 'novaxAccounts';
const ACTIVE_ACCOUNT_STORAGE_KEY = 'novaxCurrentAccount';
const HISTORY_PAGE_SIZE = 8;

const historyState = {
    trades: [],
    page: 1,
    range: 'all',
    account: 'all',
    result: 'all',
    market: 'all',
    search: '',
    sort: 'newest'
};

const statsWrap = document.getElementById('historyStats');
const tableBody = document.getElementById('historyTableBody');
const historyPagination = document.getElementById('historyPagination');
const modal = document.getElementById('historyModal');
const modalContent = document.getElementById('historyModalContent');
const searchInput = document.getElementById('historySearch');
const marketFilter = document.getElementById('marketFilter');
const accountFilter = document.getElementById('accountFilter');
const resultFilter = document.getElementById('resultFilter');
const sortFilter = document.getElementById('sortFilter');
const rangeButtons = document.querySelectorAll('.filter-chip[data-range]');
const quickFilterButtons = document.querySelectorAll('.filter-chip[data-filter-type]');
const exportButtons = document.querySelectorAll('.export-btn');

function loadTrades() {
    const storedAccounts = localStorage.getItem(ACCOUNT_STORAGE_KEY);

    if (storedAccounts) {
        try {
            const parsedAccounts = JSON.parse(storedAccounts);
            const accountTrades = [];

            ['demo', 'live'].forEach((accountType) => {
                const account = parsedAccounts?.[accountType];
                const trades = Array.isArray(account?.tradeHistory) ? account.tradeHistory : [];
                trades.forEach((trade) => accountTrades.push({ ...trade, accountType }));
            });

            if (accountTrades.length) {
                historyState.trades = accountTrades;
                historyState.account = 'all';
                if (accountFilter) accountFilter.value = historyState.account;
                return;
            }
        } catch (error) {
            historyState.trades = [];
        }
    }

    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (stored) {
        try {
            historyState.trades = JSON.parse(stored);
            return;
        } catch (error) {
            historyState.trades = [];
        }
    }

    historyState.trades = [
        {
            id: 'NM-1001',
            date: new Date(Date.now() - 3600000).toISOString(),
            market: 'Volatility 75 Index',
            tradeType: 'ODD',
            stake: 25,
            entryPrice: 16584.482,
            exitPrice: 16584.489,
            tickDuration: 5,
            winningDigit: 9,
            result: 'won',
            payout: 0.95,
            accountType: 'demo',
            entryTime: new Date(Date.now() - 3600000).toISOString(),
            exitTime: new Date(Date.now() - 3500000).toISOString(),
            tickHistory: [1, 4, 9],
            profitLoss: 23.75,
            balanceAfterTrade: 10023.75,
            status: 'completed'
        },
        {
            id: 'NM-1002',
            date: new Date(Date.now() - 86400000).toISOString(),
            market: 'Volatility 50 Index',
            tradeType: 'EVEN',
            stake: 40,
            entryPrice: 14567.321,
            exitPrice: 14567.299,
            tickDuration: 10,
            winningDigit: 4,
            result: 'lost',
            payout: 0.95,
            accountType: 'live',
            entryTime: new Date(Date.now() - 86400000).toISOString(),
            exitTime: new Date(Date.now() - 86350000).toISOString(),
            tickHistory: [2, 5, 4],
            profitLoss: -40,
            balanceAfterTrade: 0,
            status: 'completed'
        }
    ];

    saveTrades();
}

function saveTrades() {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyState.trades));
}

function formatMoney(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(value || 0);
}

function formatDate(value) {
    return new Date(value).toLocaleString();
}

function getFilteredTrades() {
    let filtered = [...historyState.trades];

    const now = Date.now();
    if (historyState.range === 'today') {
        filtered = filtered.filter((trade) => new Date(trade.date).toDateString() === new Date(now).toDateString());
    } else if (historyState.range === '7d') {
        filtered = filtered.filter((trade) => now - new Date(trade.date).getTime() <= 7 * 24 * 60 * 60 * 1000);
    } else if (historyState.range === '30d') {
        filtered = filtered.filter((trade) => now - new Date(trade.date).getTime() <= 30 * 24 * 60 * 60 * 1000);
    }

    if (historyState.account !== 'all') {
        filtered = filtered.filter((trade) => trade.accountType === historyState.account);
    }

    if (historyState.result !== 'all') {
        filtered = filtered.filter((trade) => trade.result === historyState.result);
    }

    if (historyState.market !== 'all') {
        filtered = filtered.filter((trade) => trade.market === historyState.market);
    }

    if (historyState.search.trim()) {
        const query = historyState.search.trim().toLowerCase();
        filtered = filtered.filter((trade) => {
            return [trade.id, trade.market, new Date(trade.date).toLocaleDateString()].some((field) => field.toLowerCase().includes(query));
        });
    }

    switch (historyState.sort) {
        case 'oldest':
            filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
            break;
        case 'profit':
            filtered.sort((a, b) => b.profitLoss - a.profitLoss);
            break;
        case 'loss':
            filtered.sort((a, b) => Math.abs(a.profitLoss) - Math.abs(b.profitLoss));
            break;
        case 'stake':
            filtered.sort((a, b) => b.stake - a.stake);
            break;
        default:
            filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
            break;
    }

    return filtered;
}

function renderStats(trades) {
    const totalTrades = trades.length;
    const winningTrades = trades.filter((trade) => trade.result === 'won').length;
    const losingTrades = trades.filter((trade) => trade.result === 'lost').length;
    const winRate = totalTrades ? ((winningTrades / totalTrades) * 100).toFixed(1) : '0.0';
    const totalProfit = trades.filter((trade) => trade.result === 'won').reduce((sum, trade) => sum + trade.profitLoss, 0);
    const totalLoss = trades.filter((trade) => trade.result === 'lost').reduce((sum, trade) => sum + Math.abs(trade.profitLoss), 0);
    const net = totalProfit - totalLoss;
    const balance = historyState.trades[0]?.balanceAfterTrade || 0;

    statsWrap.innerHTML = `
        <article class="stat-tile"><span>Total Trades</span><strong>${totalTrades}</strong></article>
        <article class="stat-tile"><span>Winning Trades</span><strong>${winningTrades}</strong></article>
        <article class="stat-tile"><span>Losing Trades</span><strong>${losingTrades}</strong></article>
        <article class="stat-tile"><span>Win Rate</span><strong>${winRate}%</strong></article>
        <article class="stat-tile"><span>Total Profit</span><strong>${formatMoney(totalProfit)}</strong></article>
        <article class="stat-tile"><span>Total Loss</span><strong>${formatMoney(totalLoss)}</strong></article>
        <article class="stat-tile"><span>Net Profit/Loss</span><strong>${formatMoney(net)}</strong></article>
        <article class="stat-tile"><span>Current Account Balance</span><strong>${formatMoney(balance)}</strong></article>
    `;
}

function renderTable(trades) {
    const start = (historyState.page - 1) * HISTORY_PAGE_SIZE;
    const pageItems = trades.slice(start, start + HISTORY_PAGE_SIZE);

    tableBody.innerHTML = pageItems.map((trade) => {
        const resultClass = trade.result === 'won' ? 'history-won' : trade.result === 'lost' ? 'history-lost' : 'history-pending';
        return `
            <tr class="${resultClass}" data-id="${trade.id}">
                <td>${trade.id}</td>
                <td>${formatDate(trade.date)}</td>
                <td>${trade.market}</td>
                <td>${trade.tradeType}</td>
                <td>${formatMoney(trade.stake)}</td>
                <td>${trade.entryPrice.toFixed(3)}</td>
                <td>${trade.exitPrice.toFixed(3)}</td>
                <td>${trade.tickDuration}</td>
                <td>${trade.winningDigit}</td>
                <td>${trade.result.toUpperCase()}</td>
                <td>${formatMoney(trade.profitLoss)}</td>
                <td>${formatMoney(trade.balanceAfterTrade)}</td>
            </tr>
        `;
    }).join('');

    tableBody.querySelectorAll('tr').forEach((row) => {
        row.addEventListener('click', () => openTradeModal(row.dataset.id));
    });

    renderPagination(trades.length);
}

function renderPagination(total) {
    const pages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
    historyPagination.innerHTML = '';

    for (let i = 1; i <= pages; i++) {
        const button = document.createElement('button');
        button.className = `pager-btn ${historyState.page === i ? 'active' : ''}`;
        button.textContent = i;
        button.addEventListener('click', () => {
            historyState.page = i;
            render();
        });
        historyPagination.appendChild(button);
    }
}

function openTradeModal(tradeId) {
    const trade = historyState.trades.find((entry) => entry.id === tradeId);
    if (!trade) return;

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');

    modalContent.innerHTML = `
        <h2>Trade Details</h2>
        <div class="history-details-grid">
            <div><span>Trade ID</span><strong>${trade.id}</strong></div>
            <div><span>Market</span><strong>${trade.market}</strong></div>
            <div><span>Account Type</span><strong>${trade.accountType}</strong></div>
            <div><span>Entry Time</span><strong>${formatDate(trade.entryTime)}</strong></div>
            <div><span>Exit Time</span><strong>${formatDate(trade.exitTime)}</strong></div>
            <div><span>Stake</span><strong>${formatMoney(trade.stake)}</strong></div>
            <div><span>Payout</span><strong>${trade.payout}%</strong></div>
            <div><span>Entry Price</span><strong>${trade.entryPrice.toFixed(3)}</strong></div>
            <div><span>Exit Price</span><strong>${trade.exitPrice.toFixed(3)}</strong></div>
            <div><span>Tick History</span><strong>${(trade.tickHistory || []).join(' • ')}</strong></div>
            <div><span>Winning Digit</span><strong>${trade.winningDigit}</strong></div>
            <div><span>Profit/Loss</span><strong>${formatMoney(trade.profitLoss)}</strong></div>
            <div><span>Final Balance</span><strong>${formatMoney(trade.balanceAfterTrade)}</strong></div>
        </div>
    `;
}

function exportCsv() {
    const trades = getFilteredTrades();
    const rows = [
        ['Trade ID', 'Date & Time', 'Market', 'Trade Type', 'Stake', 'Entry Price', 'Exit Price', 'Tick Duration', 'Winning Digit', 'Result', 'Profit/Loss', 'Balance After Trade']
    ];

    trades.forEach((trade) => {
        rows.push([
            trade.id,
            formatDate(trade.date),
            trade.market,
            trade.tradeType,
            trade.stake,
            trade.entryPrice.toFixed(3),
            trade.exitPrice.toFixed(3),
            trade.tickDuration,
            trade.winningDigit,
            trade.result,
            trade.profitLoss,
            trade.balanceAfterTrade
        ]);
    });

    const csv = rows.map((row) => row.join(',')).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'novax-trade-history.csv');
}

function exportExcel() {
    const trades = getFilteredTrades();
    const worksheet = XLSX.utils.json_to_sheet(trades.map((trade) => ({
        'Trade ID': trade.id,
        'Date & Time': formatDate(trade.date),
        Market: trade.market,
        'Trade Type': trade.tradeType,
        Stake: trade.stake,
        'Entry Price': trade.entryPrice.toFixed(3),
        'Exit Price': trade.exitPrice.toFixed(3),
        'Tick Duration': trade.tickDuration,
        'Winning Digit': trade.winningDigit,
        Result: trade.result,
        'Profit/Loss': trade.profitLoss,
        'Balance After Trade': trade.balanceAfterTrade
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Trade History');
    XLSX.writeFile(workbook, 'novax-trade-history.xlsx');
}

function exportPdf() {
    const trades = getFilteredTrades();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('NovaxMarkets Trade History', 14, 16);
    let y = 28;

    trades.slice(0, 18).forEach((trade) => {
        doc.setFontSize(10);
        doc.text(`${trade.id} | ${trade.market} | ${trade.result} | ${formatMoney(trade.profitLoss)}`, 14, y);
        y += 8;
    });

    doc.save('novax-trade-history.pdf');
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function syncFilterHighlights() {
    rangeButtons.forEach((button) => {
        button.classList.toggle('active', button.dataset.range === historyState.range);
    });

    quickFilterButtons.forEach((button) => {
        if (button.dataset.filterType === 'result') {
            button.classList.toggle('active', button.dataset.filterValue === historyState.result);
        } else if (button.dataset.filterType === 'account') {
            button.classList.toggle('active', button.dataset.filterValue === historyState.account);
        } else {
            button.classList.toggle('active', historyState.account === 'all' && historyState.result === 'all');
        }
    });
}

function render() {
    const filtered = getFilteredTrades();
    syncFilterHighlights();
    renderStats(filtered);
    renderTable(filtered);
}

function bindEvents() {
    searchInput.addEventListener('input', (event) => {
        historyState.search = event.target.value;
        historyState.page = 1;
        render();
    });

    marketFilter.addEventListener('change', (event) => {
        historyState.market = event.target.value;
        historyState.page = 1;
        render();
    });

    accountFilter.addEventListener('change', (event) => {
        historyState.account = event.target.value;
        historyState.page = 1;
        render();
    });

    resultFilter.addEventListener('change', (event) => {
        historyState.result = event.target.value;
        historyState.page = 1;
        render();
    });

    sortFilter.addEventListener('change', (event) => {
        historyState.sort = event.target.value;
        historyState.page = 1;
        render();
    });

    rangeButtons.forEach((button) => {
        button.addEventListener('click', () => {
            historyState.range = button.dataset.range;
            historyState.page = 1;
            render();
        });
    });

    quickFilterButtons.forEach((button) => {
        button.addEventListener('click', () => {
            if (button.dataset.filterType === 'result') {
                historyState.result = button.dataset.filterValue;
            } else if (button.dataset.filterType === 'account') {
                historyState.account = button.dataset.filterValue;
            } else {
                historyState.result = 'all';
                historyState.account = 'all';
            }
            historyState.page = 1;
            render();
        });
    });

    exportButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const type = button.dataset.export;
            if (type === 'csv') exportCsv();
            if (type === 'excel') exportExcel();
            if (type === 'pdf') exportPdf();
        });
    });

    document.getElementById('closeHistoryModal').addEventListener('click', () => {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
    });

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
        }
    });
}

window.addEventListener('account-switched', (event) => {
    const accountType = event.detail?.accountType || 'demo';
    historyState.account = accountType;
    if (accountFilter) accountFilter.value = accountType;
    historyState.page = 1;
    render();
});

window.addEventListener('account-state-updated', () => {
    loadTrades();
    render();
});

loadTrades();
bindEvents();
render();
