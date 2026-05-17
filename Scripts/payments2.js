(function () {
  const originalLoadPlannedDates = window.loadPlannedDates;
  const originalUpdateFilterState = window.updateFilterState;
  const VIEW_QUERY_PARAM = "view";
  const VIEW_STORAGE_PREFIX = "bt-payments2-view";
  let viewStorageKey = VIEW_STORAGE_PREFIX;
  let viewInitialized = false;

  async function initializeViewStorageKey() {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user?.id) {
        viewStorageKey = `${VIEW_STORAGE_PREFIX}-${user.id}`;
      }
    } catch (_) {
      viewStorageKey = VIEW_STORAGE_PREFIX;
    }
  }

  function getViewFromBrowserState() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get(VIEW_QUERY_PARAM);
    return view === "detail" ? "detail" : (view === "group" ? "group" : null);
  }

  function persistViewToBrowserState(view) {
    const params = new URLSearchParams(window.location.search);
    params.set(VIEW_QUERY_PARAM, view);
    const query = params.toString();
    const hash = window.location.hash || "";
    const newUrl = `${window.location.pathname}${query ? `?${query}` : ""}${hash}`;
    window.history.replaceState({}, "", newUrl);
  }

  async function restoreViewPreference() {
    await initializeViewStorageKey();

    const browserView = getViewFromBrowserState();
    if (browserView) {
      setPayments2View(browserView);
      return;
    }

    const savedView = localStorage.getItem(viewStorageKey);
    setPayments2View(savedView === "detail" ? "detail" : "group");
  }

  function fmtAmount(n) {
    const v = Number(n) || 0;
    return `$${v.toFixed(2)}`;
  }

  function dateOnly(value) {
    return (value || "").split("T")[0];
  }

  function parsePlanDate(value) {
    const raw = dateOnly(value);
    if (!raw) return null;

    if (raw.includes("-")) {
      const parts = raw.split("-").map(Number);
      if (parts.length === 3) {
        const [y, m, d] = parts;
        return new Date(y, (m || 1) - 1, d || 1);
      }
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function sortPaymentsOldToNew(list) {
    return [...(list || [])].sort((a, b) => {
      const aPlan = parsePlanDate(a?.planned_date);
      const bPlan = parsePlanDate(b?.planned_date);

      if (!aPlan && !bPlan) return 0;
      if (!aPlan) return 1;
      if (!bPlan) return -1;

      const planDiff = aPlan - bPlan;
      if (planDiff !== 0) return planDiff;

      const aDue = parsePlanDate(a?.due_date);
      const bDue = parsePlanDate(b?.due_date);
      if (!aDue && !bDue) return 0;
      if (!aDue) return 1;
      if (!bDue) return -1;
      return aDue - bDue;
    });
  }

  function formatDate(value) {
    const d = dateOnly(value);
    return d ? formatLocalDate(d) : "";
  }

  function formatDateShort(value) {
    const d = dateOnly(value);
    if (!d) return "";
    const [y, m, day] = d.split("-").map(Number);
    if (!y || !m || !day) return "";
    const local = new Date(y, m - 1, day);
    return `${local.getMonth() + 1}/${local.getDate()}`;
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  window.payments2QuickAction = function (action, id, isPaid, autopay, due, url, billId) {
    const paid = isPaid === true || isPaid === "true";
    const auto = autopay === true || autopay === "true";

    switch (action) {
      case "paid":
        markPaid(id, paid, auto, due);
        break;
      case "open":
        visitURL(url || null, billId || null);
        break;
      case "history":
        viewBillHistory(billId || null);
        break;
      case "delete":
        delPayment(id);
        break;
      default:
        break;
    }
  };

  function isOverdue(dueDate) {
    const due = dateOnly(dueDate);
    if (!due) return false;
    const today = new Date();
    const tz = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (tz * 60 * 1000)).toISOString().split("T")[0];
    return due < localToday;
  }

  function getPaymentToneClass(payment) {
    const isPaid = !!payment.paid_date;
    const isLateNow = isOverdue(payment.due_date);

    if (isPaid && isLateNow) return "payment-tone-paid-late";
    if (!isPaid && isLateNow) return "payment-tone-late";
    if (isPaid) return "payment-tone-paid";
    return "";
  }

  function getDetailToneClass(payment) {
    const tone = getPaymentToneClass(payment);
    return tone
      .replace("payment-tone-paid-late", "detail-tone-paid-late")
      .replace("payment-tone-late", "detail-tone-late")
      .replace("payment-tone-paid", "detail-tone-paid");
  }

  window.setPayments2View = function (view) {
    const resolvedView = view === "detail" ? "detail" : "group";
    const isGroup = resolvedView === "group";
    document.getElementById("groupView").classList.toggle("active", isGroup);
    document.getElementById("detailView").classList.toggle("active", !isGroup);
    document.getElementById("groupBtn").classList.toggle("active", isGroup);
    document.getElementById("detailBtn").classList.toggle("active", !isGroup);
    document.getElementById("groupBtn").setAttribute("aria-pressed", isGroup ? "true" : "false");
    document.getElementById("detailBtn").setAttribute("aria-pressed", !isGroup ? "true" : "false");

    localStorage.setItem(viewStorageKey, resolvedView);
    persistViewToBrowserState(resolvedView);
  };

  window.toggleShowPaidVisual = function () {
    const visual = document.getElementById("showPaidVisual");
    const hidden = document.getElementById("showPaid");
    hidden.checked = visual.checked;
    onShowPaidChange();
    syncShowPaidVisual();
  };

  function syncShowPaidVisual() {
    const visual = document.getElementById("showPaidVisual");
    const hidden = document.getElementById("showPaid");
    if (visual) {
      visual.checked = hidden.checked;
      const label = document.getElementById("showPaidVisualLabel");
      if (label) {
        label.innerText = hidden.checked ? "Hide Paid" : "Show Paid";
      }
    }
  }

  function renderDateChips() {
    const select = document.getElementById("plannedDateSelect");
    const host = document.getElementById("plannedDateChips");
    host.innerHTML = "";

    const options = Array.from(select.options).sort((a, b) => {
      const da = parsePlanDate(a.value);
      const db = parsePlanDate(b.value);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });

    options.forEach(option => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `btn btn-sm rounded-pill ${option.selected ? "btn-primary" : "btn-outline-secondary"}`;
      btn.textContent = option.textContent;
      btn.onclick = () => {
        option.selected = !option.selected;
        onPlannedDateChange();
      };
      host.appendChild(btn);
    });
  }

  function ensureVisibleFirstSelectedChip() {
    const host = document.getElementById("plannedDateChips");
    const selected = host.querySelector("button.btn-primary");
    if (selected && typeof selected.scrollIntoView === "function") {
      selected.scrollIntoView({ behavior: "auto", inline: "start", block: "nearest" });
    }
  }

  window.loadPlannedDates = async function () {
    await originalLoadPlannedDates();
    renderDateChips();
  };

  window.updateFilterState = function () {
    originalUpdateFilterState();
    renderDateChips();
    syncShowPaidVisual();
  };

  function renderSummary(paymentsDate) {
    const list = Array.isArray(paymentsDate) ? paymentsDate : [];
    const paid = list.filter(p => p.paid_date).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const unpaid = list.filter(p => !p.paid_date).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const planned = paid + unpaid;

    document.getElementById("paidTotalV2").innerText = fmtAmount(paid);
    document.getElementById("plannedTotalV2").innerText = fmtAmount(planned);
    document.getElementById("leftTotalV2").innerText = fmtAmount(unpaid);
  }

  function renderGrouped(payments) {
    const host = document.getElementById("groupView");
    const grouped = new Map();

    const sortedPayments = sortPaymentsOldToNew(payments || []);

    sortedPayments.forEach(p => {
      const key = dateOnly(p.planned_date) || "No Date";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(p);
    });

    if (grouped.size === 0) {
      host.innerHTML = `<div class="card bg-body border-0 rounded-4"><div class="card-body text-secondary">No payments found.</div></div>`;
      return;
    }

    let html = `<div class="row g-3">`;

    for (const [plannedDate, rows] of grouped.entries()) {
      const groupTotal = rows.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      html += `
<section class="col-12 col-md-6">
  <div class="d-flex align-items-baseline justify-content-between px-2 pb-1 section-label">
    <span>${formatDate(plannedDate)}</span>
    <span class="text-reset">${fmtAmount(groupTotal)}</span>
  </div>

  <div class="payment-group-card card bg-body">
    ${rows.map(p => {
      const paid = !!p.paid_date;
      const dueDanger = !paid && isOverdue(p.due_date);
      const rightLineClass = paid ? "text-warning fw-semibold" : (dueDanger ? "text-danger fw-semibold" : "");
      const rightLine = paid ? `Paid ${formatDate(p.paid_date)}` : `Due ${formatDate(p.due_date)}`;

      const toneClass = getPaymentToneClass(p);

      return `
      <div class="payment-row ${paid ? "is-paid" : ""} ${toneClass} d-flex align-items-center justify-content-between gap-3 px-3 py-2" onclick="editItem('${p.id}')">
        <div class="min-w-0 flex-grow-1">
          <div class="payment-main d-flex align-items-center gap-1 text-truncate">
            ${p.bills?.autopay ? `<i class="bi bi-arrow-repeat text-secondary"></i>` : ""}
            <span class="text-truncate">${p.name || ""}</span>
          </div>
          <div class="payment-mini-actions" onclick="event.stopPropagation()">
            <button class="btn btn-sm" type="button" title="Mark Paid" aria-label="Mark paid" onclick="payments2QuickAction('paid', '${esc(p.id)}', '${p.paid_date ? "true" : "false"}', '${p.bills?.autopay ? "true" : "false"}', '${esc(p.due_date || "")}', '${esc(p.bills?.url || "")}', '${esc(p.bill_id || "")}')">
              <i class="bi ${p.paid_date ? "bi-check-circle-fill text-success" : "bi-check-circle"}"></i>
            </button>
            <button class="btn btn-sm" type="button" title="Open bill site" aria-label="Open bill site" onclick="payments2QuickAction('open', '${esc(p.id)}', '${p.paid_date ? "true" : "false"}', '${p.bills?.autopay ? "true" : "false"}', '${esc(p.due_date || "")}', '${esc(p.bills?.url || "")}', '${esc(p.bill_id || "")}')">
              <i class="bi bi-globe"></i>
            </button>
            <button class="btn btn-sm" type="button" title="History" aria-label="History" onclick="payments2QuickAction('history', '${esc(p.id)}', '${p.paid_date ? "true" : "false"}', '${p.bills?.autopay ? "true" : "false"}', '${esc(p.due_date || "")}', '${esc(p.bills?.url || "")}', '${esc(p.bill_id || "")}')">
              <i class="bi bi-clock-history"></i>
            </button>
            <button class="btn btn-sm" type="button" title="Delete" aria-label="Delete" onclick="payments2QuickAction('delete', '${esc(p.id)}', '${p.paid_date ? "true" : "false"}', '${p.bills?.autopay ? "true" : "false"}', '${esc(p.due_date || "")}', '${esc(p.bills?.url || "")}', '${esc(p.bill_id || "")}')">
              <i class="bi bi-trash text-danger"></i>
            </button>
          </div>
          <div class="payment-sub text-truncate">${p.notes || ""}</div>
        </div>

        <div class="payment-right text-end flex-shrink-0">
          <div class="amount ${paid ? "text-success" : ""}">${fmtAmount(p.amount)}</div>
          <div class="date-line ${rightLineClass} mt-1">${rightLine}</div>
        </div>
      </div>`;
    }).join("")}
  </div>
</section>`;
    }

    html += `</div>`;
    host.innerHTML = html;
  }

  function renderDetail(payments) {
    const host = document.getElementById("detailView");
    const rows = sortPaymentsOldToNew(payments || []);

    host.innerHTML = `
<div class="d-flex align-items-baseline justify-content-between px-2 pb-1 detail-title">
  <span>Detail View</span>
  <span>${rows.length} payments</span>
</div>

<div class="detail-table-shell">
  <table class="table table-sm table-borderless align-middle detail-table">
    <thead>
      <tr class="border-bottom">
        <th class="bill-col">Bill</th>
        <th class="notes-col">Notes</th>
        <th class="date-col">Plan</th>
        <th class="date-col">Due</th>
        <th class="paid-col">Paid</th>
        <th class="amount-col text-end">Amt</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(p => `
      <tr class="border-bottom ${getDetailToneClass(p)}" style="cursor:pointer" onclick="editItem('${p.id}')">
        <td>${p.name || ""}</td>
        <td class="text-secondary notes-cell">${p.notes || ""}</td>
        <td>${formatDateShort(p.planned_date)}</td>
        <td class="${(!p.paid_date && isOverdue(p.due_date)) ? "text-danger fw-semibold" : ""}">${formatDateShort(p.due_date)}</td>
        <td class="${p.paid_date ? "text-warning fw-semibold" : ""}">${p.paid_date ? formatDateShort(p.paid_date) : "—"}</td>
        <td class="text-end fw-semibold ${p.paid_date ? "text-success" : ""}">${fmtAmount(p.amount)}</td>
      </tr>
      `).join("")}
    </tbody>
  </table>
</div>`;
  }

  // Replace visual renderer only; keep all data/event logic from payments.js.
  window.renderItems = function (payments, paymentsDate) {
    renderSummary(paymentsDate || payments || []);
    renderGrouped(payments || []);
    renderDetail(payments || []);
    syncShowPaidVisual();
    renderDateChips();
    ensureVisibleFirstSelectedChip();

    if (!viewInitialized) {
      viewInitialized = true;
      restoreViewPreference();
    }
  };

  const originalResetFilterState = window.resetFilterState;
  window.resetFilterState = function () {
    const select = document.getElementById("plannedDateSelect");
    if (!select) {
      originalResetFilterState();
      return;
    }

    const sortedOptions = Array.from(select.options).sort((a, b) => {
      const da = parsePlanDate(a.value);
      const db = parsePlanDate(b.value);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });
    sortedOptions.forEach(o => { o.selected = false; });

    const today = new Date();
    const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    let currentIdx = -1;
    for (let i = 0; i < sortedOptions.length; i++) {
      const optionDate = parsePlanDate(sortedOptions[i].value);
      if (optionDate && optionDate <= localToday) {
        currentIdx = i;
      }
    }

    if (currentIdx >= 0) {
      sortedOptions[currentIdx].selected = true;
      if (sortedOptions[currentIdx + 1]) {
        sortedOptions[currentIdx + 1].selected = true;
      }
    } else if (sortedOptions.length > 0) {
      sortedOptions[0].selected = true;
      if (sortedOptions[1]) {
        sortedOptions[1].selected = true;
      }
    }

    onPlannedDateChange();
  };
})();