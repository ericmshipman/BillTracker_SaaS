let historyBillId = null;

function normalizeBillFilterValue(value) {
    const cleaned = String(value ?? '').trim();
    if (!cleaned) return '';

    const lower = cleaned.toLowerCase();
    if (lower === 'null' || lower === 'undefined' || lower === 'all') {
        return '';
    }

    return cleaned;
}

async function initHistoryPaymentsPage() {
    const params = new URLSearchParams(window.location.search);
    const billIdParam = params.get("billId");
    const startDateParam = params.get("startDate");
    const endDateParam = params.get("endDate");
    const sortByParam = params.get("sortBy");
    historyBillId = normalizeBillFilterValue(billIdParam);

    setDefaultHistoryRange();
    await populateBillFilterOptions(historyBillId);

    if (startDateParam) {
        document.getElementById('historyStartDate').value = startDateParam;
    }
    if (endDateParam) {
        document.getElementById('historyEndDate').value = endDateParam;
    }
    if (sortByParam) {
        const sortSelect = document.getElementById('historySortBy');
        const hasOption = Array.from(sortSelect.options).some(o => o.value === sortByParam);
        if (hasOption) {
            sortSelect.value = sortByParam;
        }
    }

    updateFilterBreadcrumb();

    loadBillHistory();
}

async function populateBillFilterOptions(selectedBillId = '') {
    const billSelect = document.getElementById('historyBillFilter');
    if (!billSelect) return;

    const normalizedSelected = normalizeBillFilterValue(selectedBillId);

    billSelect.innerHTML = '<option value="">All Bills</option>';

    try {
        const bills = await getBills(true);

        bills.forEach(bill => {
            const option = document.createElement('option');
            option.value = String(bill.id);
            option.textContent = bill.name;
            billSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading bill filter options:', error);
    }

    if (normalizedSelected) {
        const exists = Array.from(billSelect.options).some(opt => opt.value === normalizedSelected);
        if (!exists) {
            let fallbackText = normalizedSelected;
            try {
                const bill = await getBillById(normalizedSelected);
                if (bill?.name) {
                    fallbackText = bill.name;
                }
            } catch {
                // ignore and keep id text
            }

            const fallback = document.createElement('option');
            fallback.value = normalizedSelected;
            fallback.textContent = fallbackText;
            billSelect.appendChild(fallback);
        }
    }

    billSelect.value = normalizedSelected;
}

function setDefaultHistoryRange() {
    const today = new Date();

    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - 6);

    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 6);

    document.getElementById('historyStartDate').value = startDate.toISOString().split('T')[0];
    document.getElementById('historyEndDate').value = endDate.toISOString().split('T')[0];
}

function resetFilterState() {
    setDefaultHistoryRange();
    const sortSelect = document.getElementById('historySortBy');
    if (sortSelect) {
        sortSelect.value = 'planned_date_desc';
    }
    const billFilterInput = document.getElementById('historyBillFilter');
    if (billFilterInput) {
        billFilterInput.value = '';
        billFilterInput.selectedIndex = 0;
    }
    loadBillHistory();
}

function toggleFilterCard() {
    const card = document.getElementById('filterCard');
    const icon = document.getElementById('toggleFilter');

    card.classList.toggle('show');
    icon.classList.toggle('bi-funnel-fill');
    icon.classList.toggle('bi-funnel');
}

function updateFilterBreadcrumb() {
    const breadcrumb = document.getElementById('filterBreadcrumb');

    const startDate = document.getElementById('historyStartDate').value;
    const endDate = document.getElementById('historyEndDate').value;
    const billFilterSelect = document.getElementById('historyBillFilter');
    const selectedBillValue = billFilterSelect ? billFilterSelect.value : '';
    const billFilter = selectedBillValue === '' ? '' : normalizeBillFilterValue(selectedBillValue);
    const applyBillFilter = !!billFilterSelect && billFilterSelect.selectedIndex > 0 && billFilter !== '';
    const billSelect = document.getElementById('historyBillFilter');
    const sortSelect = document.getElementById('historySortBy');
    const sortLabel = sortSelect.options[sortSelect.selectedIndex]?.text || '';

    if (!startDate || !endDate) {
        breadcrumb.textContent = '';
        return;
    }

    const selectedBillOption = billSelect ? billSelect.options[billSelect.selectedIndex] : null;
    const billLabel = applyBillFilter ? (selectedBillOption?.text || billFilter) : '';
    const billText = billLabel ? `${billLabel} | ` : '';
    breadcrumb.textContent = `${billText}${formatLocalDate(startDate)} - ${formatLocalDate(endDate)} | ${sortLabel}`;
}

async function loadBillHistory() {
    const historySummary = document.getElementById('historySummary');
    const historyPreview = document.getElementById('historyPreview');

    const startDateValue = document.getElementById('historyStartDate').value;
    const endDateValue = document.getElementById('historyEndDate').value;
    const billFilterSelect = document.getElementById('historyBillFilter');
    const selectedBillValue = billFilterSelect ? billFilterSelect.value : '';
    const billFilter = selectedBillValue === '' ? '' : normalizeBillFilterValue(selectedBillValue);
    const applyBillFilter = !!billFilterSelect && billFilterSelect.selectedIndex > 0 && billFilter !== '';
    const sortBy = document.getElementById('historySortBy').value;

    if (!startDateValue || !endDateValue) {
        historySummary.textContent = 'Please select both start and end dates.';
        historyPreview.innerHTML = '';
        setTotals([], true);
        updateFilterBreadcrumb();
        return;
    }

    const start = new Date(`${startDateValue}T00:00:00`);
    const end = new Date(`${endDateValue}T23:59:59.999`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        historySummary.textContent = 'Please select valid start and end dates.';
        historyPreview.innerHTML = '';
        setTotals([], true);
        updateFilterBreadcrumb();
        return;
    }

    if (start > end) {
        historySummary.textContent = 'Start date must be before end date.';
        historyPreview.innerHTML = '';
        setTotals([], true);
        updateFilterBreadcrumb();
        return;
    }

    try {
        let query = supa
            .from('payments')
            .select('*');

        if (applyBillFilter) {
            const typedBillFilter = /^\d+$/.test(billFilter) ? Number(billFilter) : billFilter;
            query = query.eq('bill_id', typedBillFilter);
        }

        query = query.or(
            `and(planned_date.gte.${startDateValue},planned_date.lte.${endDateValue}),` +
            `and(due_date.gte.${startDateValue},due_date.lte.${endDateValue}),` +
            `and(paid_date.gte.${startDateValue},paid_date.lte.${endDateValue})`
        );

        const { data, error } = await query;

        if (error) throw error;

        const filteredPayments = data || [];

        const payments = sortHistoryPayments(filteredPayments, sortBy);

        setTotals(payments);
        updateFilterBreadcrumb();

        if (payments.length === 0) {
            historySummary.textContent = 'No payment history found in the selected range.';
            historyPreview.innerHTML = '';
            return;
        }

        historySummary.textContent = `${payments.length} payment${payments.length !== 1 ? 's' : ''}`;
        renderBillHistory(payments);
    } catch (error) {
        console.error('Error loading bill history:', error);
        historySummary.textContent = 'Error loading bill history.';
        historyPreview.innerHTML = '';
        setTotals([], true);
    }
}

function setTotals(payments, clearOnly = false) {
    const totalPaidEl = document.getElementById('totalPaid');
    const totalUnpaidEl = document.getElementById('totalUnpaid');

    if (clearOnly) {
        totalPaidEl.innerText = 'Paid: $0.00';
        totalUnpaidEl.innerText = 'Unpaid: $0.00';
        return;
    }

    const paidTotal = payments.filter(p => p.paid_date).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const unpaidTotal = payments.filter(p => !p.paid_date).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    totalPaidEl.innerText = `Paid: $${paidTotal.toFixed(2)}`;
    totalUnpaidEl.innerText = `Unpaid: $${unpaidTotal.toFixed(2)}`;
}

function sortHistoryPayments(payments, sortBy) {
    const sorted = [...payments];

    sorted.sort((a, b) => {
        switch (sortBy) {
            case 'planned_date_asc':
                return compareDatesAsc(a.planned_date, b.planned_date) || compareDatesDesc(a.due_date, b.due_date);
            case 'planned_date_desc':
                return compareDatesDesc(a.planned_date, b.planned_date) || compareDatesDesc(a.due_date, b.due_date);
            case 'due_date_asc':
                return compareDatesAsc(a.due_date, b.due_date) || compareDatesDesc(a.planned_date, b.planned_date);
            case 'due_date_desc':
                return compareDatesDesc(a.due_date, b.due_date) || compareDatesDesc(a.planned_date, b.planned_date);
            case 'paid_date_asc':
                return compareNullableDatesAsc(a.paid_date, b.paid_date) || compareDatesDesc(a.planned_date, b.planned_date);
            case 'paid_date_desc':
                return compareNullableDatesDesc(a.paid_date, b.paid_date) || compareDatesDesc(a.planned_date, b.planned_date);
            case 'amount_asc':
                return (Number(a.amount) || 0) - (Number(b.amount) || 0) || compareDatesDesc(a.planned_date, b.planned_date);
            case 'amount_desc':
                return (Number(b.amount) || 0) - (Number(a.amount) || 0) || compareDatesDesc(a.planned_date, b.planned_date);
            default:
                return compareDatesDesc(a.planned_date, b.planned_date) || compareDatesDesc(a.due_date, b.due_date);
        }
    });

    return sorted;
}

function compareDatesAsc(a, b) {
    return new Date(a) - new Date(b);
}

function compareDatesDesc(a, b) {
    return new Date(b) - new Date(a);
}

function compareNullableDatesAsc(a, b) {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return compareDatesAsc(a, b);
}

function compareNullableDatesDesc(a, b) {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return compareDatesDesc(a, b);
}

function renderBillHistory(payments) {
    const historyPreview = document.getElementById('historyPreview');

    historyPreview.innerHTML = '';

    payments.forEach(payment => {
        const card = document.createElement('div');
        const format = isLate(payment.due_date, payment.paid_date);
        card.className = `card my-1 ${format}`;
        card.setAttribute('role', 'button');
        card.onclick = () => editHistoryPayment(payment.id);

        const amountClass = getAmountText(payment.paid_date);
        const amount = Number(payment.amount || 0).toFixed(2);
        const plannedDate = payment.planned_date ? formatLocalDate(payment.planned_date) : '—';
        const dueDate = payment.due_date ? formatLocalDate(payment.due_date) : '—';
        const paidDate = payment.paid_date ? formatLocalDate(payment.paid_date) : '';

        card.innerHTML = `
            <div class="card-header p-2">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6 class="mb-1 align-text-center">${escapeHtml(payment.name || '')}</h6>
                    </div>
                    <div class="text-muted small text-end">
                        <div><strong>Planned:</strong> ${plannedDate}</div>
                    </div>
                </div>
            </div>
            <div class="card-body p-1">
                <div class="d-flex justify-content-between align-text-bottom">
                    <div class="text-muted small">
                        <div><strong>Due:</strong> ${dueDate}</div>
                        <div><strong>Paid:</strong> ${paidDate}</div>
                    </div>
                    <div class="${amountClass}">$${amount}</div>
                </div>
            </div>
        `;

        historyPreview.appendChild(card);
    });
}

function editHistoryPayment(paymentId) {
    if (!paymentId) return;

    const query = new URLSearchParams();

    const billFilterSelect = document.getElementById('historyBillFilter');
    const selectedBillValue = billFilterSelect ? billFilterSelect.value : '';
    const billFilter = selectedBillValue === '' ? '' : normalizeBillFilterValue(selectedBillValue);

    const startDate = document.getElementById('historyStartDate').value;
    const endDate = document.getElementById('historyEndDate').value;
    const sortBy = document.getElementById('historySortBy').value;

    if (billFilter) query.set('billId', billFilter);
    if (startDate) query.set('startDate', startDate);
    if (endDate) query.set('endDate', endDate);
    if (sortBy) query.set('sortBy', sortBy);

    const returnUrl = `history-payments${query.toString() ? `?${query.toString()}` : ''}`;
    sessionStorage.setItem('bt-edit-context', '1');
    sessionStorage.setItem('bt-edit-payment-id', String(paymentId));
    sessionStorage.setItem('bt-edit-return-url', returnUrl);
    sessionStorage.setItem('bt-edit-ts', String(Date.now()));
    window.location.href = `payment?id=${encodeURIComponent(paymentId)}&returnUrl=${encodeURIComponent(returnUrl)}`;
}

function isLate(due, paid) {
    let today = new Date();
    const offset = today.getTimezoneOffset();
    today = new Date(today.getTime() - (offset * 60 * 1000));

    const compDate = paid || today.toISOString().split('T')[0];
    let style = '';

    if (due < compDate) {
        style = paid ? 'card_paid_late' : 'card_unpaid_late';
    } else if (paid) {
        style = 'card_paid';
    }

    return style;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
