let allPayments = [];
let currentPaymentId = null;

// UI state
let selectedDates = [];
let selectedPayments = [];
let showPaid = false;
let renderType = "card";

async function initPaymentsPage() {
    allPayments = await getPayments();
    await loadPlannedDates(); // load select options
    selectClosestPlannedDate();
}

async function initHomePage() {
    renderType = "list";
    allPayments = await getPayments();
    await loadPlannedDates(); // load select options
    selectClosestPlannedDate();
    //Retreive Balance
    retreiveBankBal();
}

async function loadPlannedDates() {
    const payments = await getPlannedDateList();
  
    // Get unique dates (removing time portion)
    const uniqueDates = [...new Set(payments.map(p => p.planned_date.split('T')[0]))];
  
    const select = document.getElementById('plannedDateSelect');
     select.innerHTML = '';
  
     uniqueDates.forEach(dateStr => {
        const option = document.createElement('option');
        option.value = dateStr;
        option.textContent = formatLocalDate(dateStr);
        select.appendChild(option);
    });
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
    }
    updateFilterState();
}

function updateFilterState() {
    const select = document.getElementById('plannedDateSelect');
    selectedDates = Array.from(select.selectedOptions).map(opt => opt.value);

    const showPaidCheckbox = document.getElementById('showPaid');
    showPaid = showPaidCheckbox ? showPaidCheckbox.checked : false;

    filterAndRenderPayments();
}

function filterAndRenderPayments() {
    let filtered = [...allPayments];
    let filteredDate = [...allPayments];

    // Filter by planned date(s)
    if (selectedDates.length > 0) {
        filtered = filtered.filter(p => selectedDates.includes(p.planned_date.split('T')[0]));
        filteredDate = filtered;
    }

    // Filter by paid status
    if (!showPaid) {
        filtered = filtered.filter(p => !p.paid_date);
    }

    renderItems(filtered, filteredDate);

    updateSelectedTotal();
}

function onPlannedDateChange() {
    updateFilterState();
}

function onShowPaidChange() {
    const label = document.getElementById('showPaidLabel');
    const showPaidCheckbox = document.getElementById('showPaid');

    label.innerText = showPaidCheckbox.checked ? "Hide Paid" : "Show Paid";

    updateFilterState();
}

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

async function renderItems(payments, paymentsDate) {
    //payments = payments || allPayments;
    const list = document.getElementById("itemlist");
    const totalPaid = paymentsDate.filter(p=> p.paid_date).reduce((sum,p) => sum + (p.amount || 0),0);
    const totalUnpaid = paymentsDate.filter(p => !p.paid_date).reduce((sum, p) => sum + (p.amount || 0),0);

    document.getElementById("totalPaid").innerText = `Paid: $${totalPaid.toFixed(2)}`;
    document.getElementById("totalPlanned").innerText =`Planned: $${totalUnpaid.toFixed(2)}`;
    
    const ShowPaid = document.getElementById('showPaid');
    let showPaid = ShowPaid ? ShowPaid.checked : false;

    if(!showPaid){
        payments = payments.filter(p => !p.paid_date);
    }

    list.innerHTML = "";

    if(renderType==="card"){
        payments.forEach(payment => {
            const card = document.createElement("div");
            let format = isLate(payment.due_date,payment.paid_date);
            card.className = "card my-1 " + format;
            
            card.innerHTML = `
                <div class="card-header p-2 " onclick="editItem('${payment.id}')">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h6 class="mb-1 align-text-center">${payment.bills?.autopay ? " <i class=\"bi-arrow-repeat text-muted\" style=\"font-size: 1.3rem;\" title=\"Auto Pay\"></i>" : ""} ${payment.name}
                        </h6>
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
                        <span class="px-2 rounded hover-bg-light" role="button" onclick="markPaid('${payment.id}', ${payment.paid_date}, '${payment.bills?.autopay}', '${payment.due_date}')">
                            <i class="${payment.paid_date ? "bi-check-circle-fill text-success" : "bi-check-circle text-primary"} fs-4"></i>
                        </span>                
                        <span class="px-2 rounded hover-bg-light" role="button" onclick="delPayment('${payment.id}')">
                            <i class="bi-trash-fill text-primary fs-4"></i>
                        </span>
                        <span class="px-2 rounded hover-bg-light" role="button" onclick="visitURL('${payment.bills?.url}',${payment.bill_id})">
                            <i class="bi-globe text-primary fs-4"></i>
                        </span>
                        <span class="px-2 rounded hover-bg-light" role="button" onclick="openReceiptModal('${payment.id}','${payment.receipt_url??""}')">
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
    else if(renderType=="list"){
        payments.forEach(payment => {
            const card = document.createElement("div");
            //let format = isLate(payment.due_date,payment.paid_date);
            card.className = "card my-1 selectable-card";
            card.setAttribute('data-id', payment.id);
            card.setAttribute('data-amount', payment.amount);
            
            card.innerHTML = `
                    <div class="card-header p-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="">
                                <label class="form-check-label">${payment.name}</label> 
                            </div>
                            <div class="${getAmountText(payment.paid_date)}">$${Number(payment.amount).toFixed(2)}</div>
                        </div>
                    </div>
                   
                    <div class="card-body collapse">
                        <div class="">
                            <div class="text-muted small">
                                <strong>Planned:</strong> ${formatLocalDate(payment.planned_date)}
                            </div>
                            <div class="text-muted small">
                                <strong>Due:</strong> ${formatLocalDate(payment.due_date)}
                            </div>
                            <div class="text-muted small">
                                <strong>Paid:</strong> ${payment.paid_date ? formatLocalDate(payment.paid_date) : "           "}
                            </div>
                        </div>
                    </div>`;
                
            card.addEventListener('click', () => toggleCardSelection(payment.id, payment.amount, card));
        
            document.getElementById("itemlist").appendChild(card);
        });
        //Select all cards by default.
        selectAllCards();
    }
}

function selectAllCards(){
    const cards = document.querySelectorAll('.selectable-card');

    selectedPayments = [];

    cards.forEach(card=> {
        const paymentId = parseInt(card.getAttribute('data-id'));
        const amount = parseFloat(card.getAttribute('data-amount')) || 0;

        if(!card.classList.contains('selected')){
            card.classList.add('selected');
        }

        selectedPayments.push({id: paymentId, amount});
    });

    updateSelectedTotal();
}

function toggleCardSelection(paymentId, amount, cardElement){

    const index = selectedPayments.findIndex(p=>p.id===paymentId);
    if(index===-1)
    {
        selectedPayments.push({id: paymentId, amount})
        cardElement.classList.add("selected");
    }else{
        selectedPayments.splice(index,1);
        cardElement.classList.remove("selected");
    }

    updateSelectedTotal();
}

function updateSelectedTotal(){
    const total = selectedPayments.reduce((sum, p) => sum + p.amount, 0);

    const totalDisplay = document.getElementById('selectedTotal');
    if (totalDisplay) {
        totalDisplay.value = `${total.toFixed(2)}`;
    }
    
    updateCashFlow();
}

async function saveBankBal(){
    const bankBalance = document.getElementById("bankBalance");
    const newBalance = parseFloat(bankBalance.value) || 0;
    try {
        await supabaseClient.auth.updateUser({
          data: { bank_balance: newBalance }
        });
        localStorage.setItem('cb-bal', newBalance);
      } catch (err) {
        //Ingore
        localStorage.setItem('cb-bal', newBalance);
      }
      updateCashFlow();
}

async function retreiveBankBal(){
    let bankBalance = localStorage.getItem('cb-bal');

    const { data: { user } } = await supabaseClient.auth.getUser();
    bankBalance = user?.user_metadata.bank_balance || bankBalance;

    const bb = document.getElementById("bankBalance");
    bb.value = bankBalance;
    
    updateCashFlow();
}

function updateCashFlow()
{
    const inputAmt = document.getElementById('bankBalance');
    let input = 0;
    if(inputAmt){
        input = parseFloat(inputAmt.value) || 0 ;
    }    
   
    const selectedTotal = selectedPayments.reduce((sum, p) => sum + p.amount, 0);  
       
    const cashFlowAmt = input - selectedTotal;
    const cashFlow = document.getElementById('cashflowBalance');
    if(cashFlow){
        cashFlow.value = `${cashFlowAmt.toFixed(2)}`;
    }

    //update bubble. 
    const perc = input != 0 ? selectedTotal/input : 1.00;
    console.log(perc);
    bubble.update(perc * 100);
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

async function markPaid(id, paid_date, autopay, due_date){
    const payment = {
        paid_date: paid_date ? null : autopay ? due_date : new Date()
    };
    //payment.paid_date = 
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

//Filter Show/Hide
function toggleFilterCard(){
const card = document.getElementById('filterCard');
const icon = document.getElementById('toggleFilter');
icon.classList.toggle('bi-funnel-fill');
icon.classList.toggle('bi-funnel');
card.classList.toggle('show');
}

function toggleList(){
    const list = document.getElementById('itemlist');
    const icon = document.getElementById('toggleSelectedList');
    list.classList.toggle('show')
}




