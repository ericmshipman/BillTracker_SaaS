// Scripts/plan-payments.js

let generatedPayments = [];
let groupedPayments = {};
let generationMode = 'bills'; // 'bills' or 'payments'

/**
 * Update UI based on selected generation mode
 */
function updateModeUI() {
    const modeBills = document.getElementById('modeBills');
    generationMode = modeBills.checked ? 'bills' : 'payments';
    
    const billsInputs = document.getElementById('billsModeInputs');
    const paymentsInputs = document.getElementById('paymentsModeInputs');
    
    if (generationMode === 'payments') {
        billsInputs.style.display = 'none';
        paymentsInputs.style.display = 'block';
    } else {
        billsInputs.style.display = 'block';
        paymentsInputs.style.display = 'none';
    }
}

/**
 * Generate payments for a given date range
 */
async function generatePayments() {
    // Determine mode
    const modeBills = document.getElementById('modeBills');
    generationMode = modeBills.checked ? 'bills' : 'payments';
    
    // Show loading toast
    showToast('Generating payments...', 'info');
    
    try {
        if (generationMode === 'bills') {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            
            if (!startDate || !endDate) {
                alert('Please select both start and end dates');
                return;
            }
            
            if (new Date(startDate) > new Date(endDate)) {
                alert('Start date must be before end date');
                return;
            }
            
            await generatePaymentsFromBills(startDate, endDate);
        } else {
            const copyStartDate = document.getElementById('copyStartDate').value;
            const copyEndDate = document.getElementById('copyEndDate').value;
            const iterateAmount = parseInt(document.getElementById('iterateAmount').value);
            const iterateUnit = document.getElementById('iterateUnit').value;
            
            if (!copyStartDate || !copyEndDate) {
                alert('Please select both copy start and end dates');
                return;
            }
            
            if (new Date(copyStartDate) > new Date(copyEndDate)) {
                alert('Copy start date must be before copy end date');
                return;
            }
            
            if (!iterateAmount || iterateAmount < 1) {
                alert('Please enter a valid iteration amount');
                return;
            }
            
            await generatePaymentsFromPayments(copyStartDate, copyEndDate, iterateAmount, iterateUnit);
        }
    } catch (error) {
        console.error('Error generating payments:', error);
        showToast('Error generating payments: ' + error.message, 'danger');
    }
}

/**
 * Generate payments from bills for a given date range
 */
async function generatePaymentsFromBills(startDate, endDate) {
    // Fetch active bills (non-archived only)
    // getBills(true) filters for archived=false (non-archived bills)
    const bills = await getBills(true);
    
    if (bills.length === 0) {
        showToast('No active bills found. Please create bills first.', 'warning');
        return;
    }
    
    // Generate payments for each bill
    generatedPayments = [];
    
    for (const bill of bills) {
        const payments = calculatePaymentsForBill(bill, startDate, endDate);
        generatedPayments.push(...payments);
    }
    
    // Check for duplicates
    await checkForDuplicates();
    
    // Group by planned date
    groupPaymentsByDate();
    
    // Render preview
    renderPaymentPreview();
    
    // Show success toast
    showToast(`Generated ${generatedPayments.length} payments from ${bills.length} bills`, 'success');
}

/**
 * Generate payments from existing payments for a given date range
 * Copies payments and shifts them forward by the specified period
 */
async function generatePaymentsFromPayments(copyStartDate, copyEndDate, iterateAmount, iterateUnit) {
    // Fetch existing payments in the copy-from range
    const existingPayments = await getPayments(copyStartDate, copyEndDate, 'both');
    
    if (existingPayments.length === 0) {
        showToast('No payments found in the selected date range. Please select a range with existing payments.', 'warning');
        return;
    }
    
    // Calculate the date shift amount
    let dateShift = 0;
    if (iterateUnit === 'Year') {
        dateShift = iterateAmount * 365; // Approximate, will handle leap years
    } else {
        // For months, calculate more precisely
        const copyStart = new Date(copyStartDate);
        const copyEnd = new Date(copyEndDate);
        const daysDiff = Math.floor((copyEnd - copyStart) / (1000 * 60 * 60 * 24));
        
        // Average days per month
        dateShift = Math.round(iterateAmount * 30.44);
    }
    
    // Generate payments by copying and shifting dates
    generatedPayments = [];
    
    for (const payment of existingPayments) {
        // Parse the payment's dates
        const originalDueDate = new Date(payment.due_date);
        const originalPlannedDate = payment.planned_date ? new Date(payment.planned_date) : null;
        
        // Shift dates forward
        const newDueDate = new Date(originalDueDate);
        if (iterateUnit === 'Year') {
            newDueDate.setFullYear(newDueDate.getFullYear() + iterateAmount);
        } else {
            newDueDate.setMonth(newDueDate.getMonth() + iterateAmount);
        }
        
        let finalPlannedDate = null;
        if (originalPlannedDate) {
            const newPlannedDate = new Date(originalPlannedDate);
            if (iterateUnit === 'Year') {
                newPlannedDate.setFullYear(newPlannedDate.getFullYear() + iterateAmount);
            } else {
                newPlannedDate.setMonth(newPlannedDate.getMonth() + iterateAmount);
            }
            finalPlannedDate = newPlannedDate.toISOString().split('T')[0];
        } else {
            // If no planned_date, calculate it based on pay_period
            const bill = await getBillById(payment.bill_id);
            if (bill) {
                finalPlannedDate = calculatePlannedDate(newDueDate, bill.pay_period);
            } else {
                finalPlannedDate = newDueDate.toISOString().split('T')[0];
            }
        }
        
        // Create new payment with all original values, just shifted dates
        generatedPayments.push({
            bill_id: payment.bill_id,
            name: payment.name, // Preserve modified name
            amount: payment.amount, // Preserve modified amount
            planned_date: finalPlannedDate,
            due_date: newDueDate.toISOString().split('T')[0],
            notes: payment.notes || '', // Preserve modified notes
            paid_date: null, // Always null for new payments
            receipt_url: null, // Always null for new payments
            isDuplicate: false
        });
    }
    
    // Check for duplicates
    await checkForDuplicates();
    
    // Group by planned date
    groupPaymentsByDate();
    
    // Render preview
    renderPaymentPreview();
    
    // Show success toast
    showToast(`Generated ${generatedPayments.length} payments from ${existingPayments.length} existing payments`, 'success');
}

/**
 * Calculate all payment dates for a bill within the date range
 */
function calculatePaymentsForBill(bill, startDate, endDate) {
    const payments = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    // Parse bill's due_date as starting point
    const billStartDate = new Date(bill.due_date);
    billStartDate.setHours(0, 0, 0, 0);
    
    // Find the first occurrence within or before the range
    let currentDate = new Date(billStartDate);
    
    // If bill starts after the range, skip it
    if (currentDate > end) {
        return payments;
    }
    
    // If bill starts before the range, find first occurrence in range
    if (currentDate < start) {
        while (currentDate < start) {
            currentDate = addRecurrencePeriod(currentDate, bill.occurs_every, bill.occurs_every_unit);
        }
    }
    
    // Generate all payments within range
    while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Calculate planned_date based on pay_period
        const plannedDate = calculatePlannedDate(currentDate, bill.pay_period);
        
        payments.push({
            bill_id: bill.id,
            name: bill.name,
            amount: bill.amount,
            planned_date: plannedDate,
            due_date: dateStr,
            notes: bill.notes || '',
            paid_date: null,
            receipt_url: null,
            isDuplicate: false
        });
        
        // Move to next occurrence
        currentDate = addRecurrencePeriod(currentDate, bill.occurs_every, bill.occurs_every_unit);
    }
    
    return payments;
}

/**
 * Calculate payments from an existing payment, iterating forward
 */
function calculatePaymentsFromPayment(payment, bill, copyFromDate, generateUntilDate) {
    const payments = [];
    const start = new Date(copyFromDate);
    const end = new Date(generateUntilDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    // Use the payment's actual due_date as the starting point
    const paymentDueDate = new Date(payment.due_date);
    paymentDueDate.setHours(0, 0, 0, 0);
    
    // Find the first occurrence after the copy-from date
    let currentDate = new Date(paymentDueDate);
    
    // If payment is before the copy-from date, find first occurrence after
    if (currentDate < start) {
        while (currentDate < start) {
            currentDate = addRecurrencePeriod(currentDate, bill.occurs_every, bill.occurs_every_unit);
        }
    }
    
    // Generate all payments within range
    while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Calculate planned_date based on pay_period
        const plannedDate = calculatePlannedDate(currentDate, bill.pay_period);
        
        payments.push({
            bill_id: payment.bill_id,
            name: payment.name, // Use payment's name (may have been modified)
            amount: payment.amount, // Use payment's actual amount (may have been modified)
            planned_date: plannedDate,
            due_date: dateStr,
            notes: payment.notes || '', // Use payment's notes (may have been modified)
            paid_date: null,
            receipt_url: null,
            isDuplicate: false
        });
        
        // Move to next occurrence
        currentDate = addRecurrencePeriod(currentDate, bill.occurs_every, bill.occurs_every_unit);
    }
    
    return payments;
}

/**
 * Calculate planned date based on pay_period
 * pay_period 1 = 15th of the month
 * pay_period 2 = last day of the month
 */
function calculatePlannedDate(dueDate, payPeriod) {
    const date = new Date(dueDate);
    const year = date.getFullYear();
    const month = date.getMonth();
    
    if (payPeriod == 1) {
        // 15th of the month
        return new Date(year, month, 15).toISOString().split('T')[0];
    } else if (payPeriod == 2) {
        // Last day of the month
        return new Date(year, month + 1, 0).toISOString().split('T')[0];
    } else {
        // Default to due date if pay_period is not 1 or 2
        return date.toISOString().split('T')[0];
    }
}

/**
 * Add recurrence period to a date
 */
function addRecurrencePeriod(date, occursEvery, occursEveryUnit) {
    const newDate = new Date(date);
    
    switch (occursEveryUnit) {
        case 'Day':
            newDate.setDate(newDate.getDate() + occursEvery);
            break;
        case 'Week':
            newDate.setDate(newDate.getDate() + (occursEvery * 7));
            break;
        case 'Month':
            newDate.setMonth(newDate.getMonth() + occursEvery);
            // Handle month-end edge cases (e.g., Jan 31 + 1 month = Feb 28/29)
            if (newDate.getDate() !== date.getDate()) {
                newDate.setDate(0); // Go to last day of previous month
            }
            break;
        case 'Year':
            newDate.setFullYear(newDate.getFullYear() + occursEvery);
            break;
        default:
            console.warn('Unknown recurrence unit:', occursEveryUnit);
    }
    
    return newDate;
}

/**
 * Check for duplicate payments
 */
async function checkForDuplicates() {
    if (generatedPayments.length === 0) return;
    
    // Get date range
    const dates = generatedPayments.map(p => p.planned_date);
    const minDate = dates.reduce((a, b) => a < b ? a : b);
    const maxDate = dates.reduce((a, b) => a > b ? a : b);
    
    // Fetch existing payments in range
    const existingPayments = await getPayments(minDate, maxDate, 'both');
    
    // Create a set of existing payment keys (bill_id + planned_date)
    const existingKeys = new Set();
    existingPayments.forEach(p => {
        // Handle both date string and ISO string formats
        const plannedDate = p.planned_date ? (p.planned_date.split('T')[0] || p.planned_date) : '';
        const key = `${p.bill_id}_${plannedDate}`;
        existingKeys.add(key);
    });
    
    // Mark duplicates
    generatedPayments.forEach(payment => {
        const key = `${payment.bill_id}_${payment.planned_date}`;
        payment.isDuplicate = existingKeys.has(key);
    });
}

/**
 * Group payments by planned date
 */
function groupPaymentsByDate() {
    groupedPayments = {};
    
    generatedPayments.forEach(payment => {
        const dateKey = payment.planned_date;
        if (!groupedPayments[dateKey]) {
            groupedPayments[dateKey] = [];
        }
        groupedPayments[dateKey].push(payment);
    });
    
    // Sort dates
    const sortedDates = Object.keys(groupedPayments).sort();
    const sortedGroups = {};
    sortedDates.forEach(date => {
        sortedGroups[date] = groupedPayments[date];
    });
    groupedPayments = sortedGroups;
}

/**
 * Render payment preview with grouping
 */
function renderPaymentPreview() {
    const previewDiv = document.getElementById('paymentPreview');
    previewDiv.innerHTML = '';
    
    if (Object.keys(groupedPayments).length === 0) {
        previewDiv.innerHTML = '<p class="text-muted">No payments to display</p>';
        return;
    }
    
    // Create groups
    const dateKeys = Object.keys(groupedPayments);
    dateKeys.forEach((dateKey, index) => {
        const payments = groupedPayments[dateKey];
        // Add separator before groups (except first)
        if (index > 0) {
            const separator = document.createElement('div');
            separator.className = 'border-top my-3';
            separator.style.height = '1px';
            previewDiv.appendChild(separator);
        }
        const groupDiv = createPaymentGroup(dateKey, payments);
        previewDiv.appendChild(groupDiv);
    });
    
    // Show preview section
    document.getElementById('previewSection').style.display = 'block';
    
    // Update counts and save button state
    updateCounts();
    updateSaveButton();
}

/**
 * Create a payment group element
 */
function createPaymentGroup(dateKey, payments, showSeparator = false) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'card mb-3';
    groupDiv.setAttribute('data-date', dateKey);
    
    // Add separator line at the top (except for first group)
    if (showSeparator) {
        const separator = document.createElement('div');
        separator.className = 'border-top mb-3 mt-2';
        separator.style.height = '2px';
        groupDiv.appendChild(separator);
    }
    
    // Calculate group totals
    const totalAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const duplicateCount = payments.filter(p => p.isDuplicate).length;
    const allChecked = payments.every(p => p.selected !== false);
    
    // Group header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'card-header p-2';
    headerDiv.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <div class="d-flex align-items-center">
                <div class="form-check mb-0 me-3">
                    <input class="form-check-input" type="checkbox" id="group-${dateKey}" 
                           ${allChecked ? 'checked' : ''} 
                           onchange="toggleGroup('${dateKey}', this.checked)">
                </div>
                <label class="form-check-label mb-0" for="group-${dateKey}">
                ${formatLocalDate(dateKey)}
                ${duplicateCount > 0 ? `<span class="badge bg-warning ms-2">${duplicateCount} duplicate(s)</span>` : ''}
            </label>
            </div>
            <div class="fw-bold text-danger fs-3">
                $${Math.round(totalAmount)}
            </div>
        </div>
    `;
    groupDiv.appendChild(headerDiv);
    
    // Payments table
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'card-body p-0';
    
    const table = document.createElement('table');
    table.className = 'table table-hover mb-0';
    
    const tbody = document.createElement('tbody');
    payments.forEach((payment, index) => {
        const row = createPaymentRow(payment, dateKey, index);
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    bodyDiv.appendChild(table);
    groupDiv.appendChild(bodyDiv);
    
    return groupDiv;
}

/**
 * Create a payment table row element
 */
function createPaymentRow(payment, dateKey, index) {
    const row = document.createElement('tr');
    row.className = payment.isDuplicate ? 'table-warning' : '';
    
    const checkboxId = `payment-${dateKey}-${index}`;
    const isChecked = payment.selected !== false && !payment.isDuplicate;
    
    row.innerHTML = `
        <td style="width: 40px;">
            <div class="form-check">
                <input class="form-check-input" type="checkbox" 
                       id="${checkboxId}" 
                       data-bill-id="${payment.bill_id}"
                       data-planned-date="${payment.planned_date}"
                       ${isChecked ? 'checked' : ''}
                       onchange="updatePaymentSelection('${dateKey}', ${index}, this.checked)">
            </div>
        </td>
        <td>
            <div>${payment.name}${payment.isDuplicate ? ' <i class="bi-exclamation-triangle text-warning" title="Duplicate payment"></i>' : ''}</div>
            <div class="text-muted small">Due: ${formatLocalDate(payment.due_date)}</div>
        </td>
        <td class="text-end">
            <span class="${getAmountText(payment.paid_date)}">$${Math.round(Number(payment.amount))}</span>
        </td>
    `;
    
    // Store reference
    payment.selected = isChecked;
    
    return row;
}

/**
 * Toggle all payments in a group
 */
function toggleGroup(dateKey, checked) {
    const payments = groupedPayments[dateKey];
    payments.forEach((payment, index) => {
        payment.selected = checked;
        const checkbox = document.getElementById(`payment-${dateKey}-${index}`);
        if (checkbox) {
            checkbox.checked = checked;
        }
    });
    
    updateCounts();
    updateSaveButton();
}

/**
 * Update individual payment selection
 */
function updatePaymentSelection(dateKey, index, checked) {
    const payment = groupedPayments[dateKey][index];
    payment.selected = checked;
    
    // Update group checkbox
    const groupCheckbox = document.getElementById(`group-${dateKey}`);
    if (groupCheckbox) {
        const allChecked = groupedPayments[dateKey].every(p => p.selected);
        groupCheckbox.checked = allChecked;
    }
    
    updateCounts();
    updateSaveButton();
}

/**
 * Update count displays
 */
function updateCounts() {
    const total = generatedPayments.length;
    const duplicates = generatedPayments.filter(p => p.isDuplicate).length;
    const selected = generatedPayments.filter(p => p.selected).length;
    
    document.getElementById('totalGenerated').textContent = `${total} payment${total !== 1 ? 's' : ''}`;
    document.getElementById('duplicateCount').textContent = `${duplicates} duplicate${duplicates !== 1 ? 's' : ''}`;
    document.getElementById('selectedCount').textContent = `${selected} selected`;
}

/**
 * Update save button state
 */
function updateSaveButton() {
    const selectedCount = generatedPayments.filter(p => p.selected).length;
    const saveButton = document.getElementById('saveButton');
    saveButton.disabled = selectedCount === 0;
}

/**
 * Save selected payments to database
 */
async function saveSelectedPayments() {
    const selectedPayments = generatedPayments.filter(p => p.selected);
    
    if (selectedPayments.length === 0) {
        alert('No payments selected');
        return;
    }
    
    if (!confirm(`Are you sure you want to create ${selectedPayments.length} payment(s)?`)) {
        return;
    }
    
    const saveButton = document.getElementById('saveButton');
    saveButton.disabled = true;
    saveButton.innerHTML = '<i class="bi-hourglass-split"></i> Saving...';
    
    try {
        let successCount = 0;
        let errorCount = 0;
        
        for (const payment of selectedPayments) {
            try {
                // Remove isDuplicate and selected flags before saving
                const paymentToSave = {
                    bill_id: payment.bill_id,
                    name: payment.name,
                    amount: payment.amount,
                    planned_date: payment.planned_date,
                    due_date: payment.due_date,
                    notes: payment.notes,
                    paid_date: payment.paid_date,
                    receipt_url: payment.receipt_url
                };
                
                await addPayment(paymentToSave);
                successCount++;
            } catch (error) {
                console.error('Error saving payment:', error);
                errorCount++;
            }
        }
        
        if (errorCount === 0) {
            alert(`Successfully created ${successCount} payment(s)!`);
            window.location.href = 'payments.html';
        } else {
            alert(`Created ${successCount} payment(s), but ${errorCount} failed. Please check the console for details.`);
        }
    } catch (error) {
        console.error('Error saving payments:', error);
        alert('Error saving payments: ' + error.message);
        saveButton.disabled = false;
        saveButton.innerHTML = '<i class="bi-save"></i> Save Selected Payments';
    }
}

/**
 * Clear preview
 */
function clearPreview() {
    generatedPayments = [];
    groupedPayments = {};
    document.getElementById('previewSection').style.display = 'none';
    document.getElementById('paymentPreview').innerHTML = '';
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toastElement = document.getElementById('statusToast');
    const toastBody = document.getElementById('toastBody');
    const toastTitle = document.getElementById('toastTitle');
    
    // Set message
    toastBody.textContent = message;
    
    // Set title and styling based on type
    const toastHeader = toastElement.querySelector('.toast-header');
    toastHeader.className = 'toast-header';
    
    switch(type) {
        case 'success':
            toastTitle.textContent = 'Success';
            toastHeader.classList.add('bg-success', 'text-white');
            break;
        case 'warning':
            toastTitle.textContent = 'Warning';
            toastHeader.classList.add('bg-warning', 'text-dark');
            break;
        case 'danger':
            toastTitle.textContent = 'Error';
            toastHeader.classList.add('bg-danger', 'text-white');
            break;
        default:
            toastTitle.textContent = 'Info';
            toastHeader.classList.add('bg-info', 'text-white');
    }
    
    // Show toast
    const toast = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: 3000
    });
    toast.show();
}

/**
 * Toggle select all payments
 */
function toggleSelectAll() {
    const selectedCount = generatedPayments.filter(p => p.selected).length;
    const shouldSelectAll = selectedCount < generatedPayments.length;
    
    // Toggle all groups
    Object.keys(groupedPayments).forEach(dateKey => {
        const groupCheckbox = document.getElementById(`group-${dateKey}`);
        if (groupCheckbox) {
            groupCheckbox.checked = shouldSelectAll;
            toggleGroup(dateKey, shouldSelectAll);
        }
    });
    
    // Update counts after toggling
    updateCounts();
    updateSaveButton();
}

/**
 * Scroll to duplicate payments
 */
function scrollToDuplicates() {
    // Find first duplicate payment in the preview
    const previewDiv = document.getElementById('paymentPreview');
    const duplicateRows = previewDiv.querySelectorAll('.table-warning');
    
    if (duplicateRows.length > 0) {
        // Scroll to first duplicate
        duplicateRows[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Highlight briefly
        duplicateRows[0].style.transition = 'background-color 0.3s';
        duplicateRows[0].style.backgroundColor = 'rgba(255, 193, 7, 0.3)';
        setTimeout(() => {
            duplicateRows[0].style.backgroundColor = '';
        }, 1000);
    }
}

