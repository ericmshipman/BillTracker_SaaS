let allPayments = [];
let currentPaymentId = null;

function PaidCheckMessage(){
    const ShowPaid = document.getElementById('showPaid');
    return ShowPaid.checked ? "Hide Paid" : "Show Paid";
}

function isLate(due,paid){
    let today = new Date()
    const offset = today.getTimezoneOffset()
    today = new Date(today.getTime() - (offset*60*1000))
    
    const compDate = paid || today.toISOString().split('T')[0];

    let style = "";

    if (due < compDate){
        if(paid){
            style = "card_paid_late";
        }else{
            style = "card_unpaid_late";
        }
    }else{
        if(paid){
            style="card_paid";
        }
    }
    return style;    
}

async function getPmts(){
    const pmts = await getPayments();
    allPayments = pmts;
    selectClosestPlannedDate();
    //renderItems(allPayments);
}

async function refreshPmts(){
    const pmts = await getPayments();
    allPayments = pmts;
    const select = document.getElementById('plannedDateSelect');
    select.dispatchEvent(new Event('change'));
}

async function renderItems(payments) {
    //payments = payments || allPayments;
    const list = document.getElementById("itemlist");
    const totalPaid = payments.filter(p=> p.paid_date).reduce((sum,p) => sum + (p.amount || 0),0);
    const totalUnpaid = payments.filter(p => !p.paid_date).reduce((sum, p) => sum + (p.amount || 0),0);

    document.getElementById("totalPaid").innerText = `Paid: $${totalPaid.toFixed(2)}`;
    document.getElementById("totalPlanned").innerText =`Planned: $${totalUnpaid.toFixed(2)}`;
    
    const ShowPaid = document.getElementById('showPaid');
    let showPaid = ShowPaid ? ShowPaid.checked : false;

    if(!showPaid){
        payments = payments.filter(p => !p.paid_date);
    }

    list.innerHTML = "";

    payments.forEach(payment => {
    const card = document.createElement("div");
    let format = isLate(payment.due_date,payment.paid_date);
    card.className = "card my-1 " + format;
    
    card.innerHTML = `
        <div class="card-header p-2 " onclick="editItem('${payment.id}')">
        <div class="d-flex justify-content-between align-items-start">
            <div>
                <h6 class="mb-1 align-text-center">${payment.name}</i></h6>
            </div>
            <div class="text-muted small text-end">
                <div>${PlanOrPaid(payment.paid_date,payment.planned_date)}</div>
            </div>
            </div>
        </div>
        <div class="card-body p-1" >
            <div class="d-flex justify-content-between align-text-bottom" onclick="editItem('${payment.id}')">
                <p class="text-muted small">${payment.notes || "<em>Enter Notes...</em>"}</p>
                <div class="${getAmountText(payment.paid_date)}">$${Number(payment.amount).toFixed(2)}</div>
            </div>

        <div class="d-flex justify-content-between align-items-end" >
            <div>
                <span class="px-2 rounded hover-bg-light" role="button" onclick="markPaid('${payment.id}', ${payment.paid_date})">
                    <i class="${payment.paid_date ? "bi-check-circle-fill text-success" : "bi-check-circle text-primary"} fs-4"></i>
                </span>                
                <span class="px-2 rounded hover-bg-light" role="button" onclick="delPayment('${payment.id}')">
                    <i class="bi-trash-fill text-primary fs-4"></i>
                </span>
                <span class="px-2 rounded hover-bg-light" role="button" onclick="visitURL('${payment.bills?.url}',${payment.bill_id})">
                    <i class="bi-globe text-primary fs-4"></i>
                </span>
                <span class="px-2 rounded hover-bg-light" role="button" onclick="openReceiptModal('${payment.id}','${payment.receipt_url??""} ')">
                    <i class="${!payment.receipt_url ? "bi-link-45deg" : "bi-receipt"} text-primary fs-2"></i>
                </span>
            </div>
            <div class="text-muted small">
                 <div><strong>Due:</strong> ${formatLocalDate(payment.due_date)}</div>
            </div>
        </div>  
        
    `;

    document.getElementById("itemlist").appendChild(card);
    });
}

function visitURL(url, billId){
    if (url && typeof url === "string" && url.trim().toLowerCase() !== "null") {
       goURL(url);
    } else {
        window.location.href = "bill.html?id=" + billId + "&NeedURL=1";
    }
}

async function delPayment(id) {
    if (confirm("Are you sure you want to delete this payment?")) {
        await deletePayment(id);
        const select = document.getElementById('plannedDateSelect');
        refreshPmts();
    }
}

async function editItem(id){
    window.location.href = "payment.html?id=" + id
}

async function markPaid(id, paid_date){
    const payment = await getPaymentById(id);
    payment.paid_date = paid_date ? null : new Date();
    await updatePayment(id, payment);
    refreshPmts();
}

async function startAddItem(){
    window.location.href = "payment.html";
}

function PlanOrPaid(paid, planned) {
    const dateStr = paid || planned;
    if (!dateStr) return "";

    const dateLbl = paid ? "<strong>Paid:</strong> " : "<strong>Planned:</strong> ";
    // Extract YYYY-MM-DD and reconstruct with local Date constructor
    const [year, month, day] = dateStr.split("T")[0].split("-");
    const localDate = new Date(year, month - 1, day); // JS months are 0-based

    const options = { year: 'numeric', month: 'numeric', day: 'numeric' };
    return dateLbl + localDate.toLocaleDateString(undefined, options); // e.g., Apr 15, 2025
}

async function loadPlannedDates() {
  const payments = await getPlannedDateList();

  // Get unique dates (removing time portion)
  const uniqueDates = [...new Set(payments.map(p => p.planned_date.split('T')[0]))];

  const select = document.getElementById('plannedDateSelect');
   select.innerHTML = '';

  for (const dateStr of uniqueDates) {
    const date = new Date(dateStr);
    const label = formatLocalDate(dateStr);

    const option = document.createElement('option');
    option.value = dateStr;
    option.textContent = label;

    select.appendChild(option);
  }
}

function getDefaultPlannedDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    let targetDate;

    if (today.getDate() > 15) {
        // Select the 15th of this month
        targetDate = new Date(year, month, 15);
    } else {
        // Select the last day of previous month
        targetDate = new Date(year, month, 0); // Day 0 gives last day of previous month
    }

    // Return in YYYY-MM-DD format
    return targetDate.toISOString().split('T')[0];
}

function selectClosestPlannedDate() {
    const plannedDateKey = getDefaultPlannedDate();
    const select = document.getElementById('plannedDateSelect');
    
    if (!select) return;

    // Try to find a matching option
    const options = Array.from(select.options);
    const match = options.find(opt => opt.value === plannedDateKey);

    if (match) {
        select.value = plannedDateKey;
        select.dispatchEvent(new Event('change')); // optional: trigger filter logic
    }
    }

function onPlannedDateChange() {
    const select = document.getElementById('plannedDateSelect');
    const selectedDates = Array.from(select.selectedOptions).map(opt => opt.value);
    console.log('Selected planned date:', selectedDates);

    if(selectedDates.lenght === 0){
        renderItems(allPayments);
    }else{
        const filterPmts = allPayments.filter(p => selectedDates.includes(p.planned_date.split('T')[0]));
        renderItems(filterPmts);
    }

  // You could call a filter function here:
  // filterPaymentsByPlannedDate(selectedDate);
}

function onShowPaidChange() {
    const ShowPaid = document.getElementById('showPaid');
    const ShowPaidLable = document.getElementById("showPaidLabel")

    let showPaid = ShowPaid ? ShowPaid.checked : false;

    if(showPaid){
        ShowPaidLable.innerHTML = "Hide Paid";
    }else{
        ShowPaidLable.innerHTML = "Show Paid";
    }
    onPlannedDateChange();            
}

function openReceiptModal(paymentId, url) {
    currentPaymentId = paymentId;
    const modal = new bootstrap.Modal(document.getElementById('receiptModal'));
    if(url){
        goURL(url);
    }else{
        document.getElementById('receipt-url-input').value = url;
        modal.show();
    }
    
    
    
  }

  async function saveReceiptLink() {
    const url = document.getElementById('receipt-url-input').value.trim();
    
    payment = {
        receipt_url: url
    };

    await updatePayment(currentPaymentId, payment);

    bootstrap.Modal.getInstance(document.getElementById('receiptModal')).hide();
  }

getPmts();

loadPlannedDates();
