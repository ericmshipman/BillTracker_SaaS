function formatDate(dateString) {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function formatLocalDate(dateInput) {
    const dateStr = dateInput;
    const [year, month, day] = dateStr.split("T")[0].split("-");
    const localDate = new Date(year, month - 1, day); // JS months are 0-based
    const options = { year: 'numeric', month: 'numeric', day: 'numeric' };
    return localDate.toLocaleDateString(undefined, options);
  }

function getAmountText(paid_date){
    if(paid_date){
        return "text-success fw-bold fs-3";
    }else{
        return "text-danger fw-bold fs-3";
    }
}

function goURL(url){
    if (url && typeof url === "string" && url.trim().toLowerCase() !== "null") {
        // Add protocol if missing
        if (!/^https?:\/\//i.test(url)) {
        url = "https://" + url;
        }
        window.open(url, "_blank");
    } else {
        console.warn("Invalid or missing URL:", url);
    }
}

function ensureSiteModalAlertElement() {
    let modalElement = document.getElementById('siteModalAlert');
    if (modalElement) {
        return modalElement;
    }

    modalElement = document.createElement('div');
    modalElement.id = 'siteModalAlert';
    modalElement.className = 'modal fade';
    modalElement.tabIndex = -1;
    modalElement.setAttribute('aria-hidden', 'true');
    modalElement.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="siteModalAlertTitle">Notice</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body" id="siteModalAlertMessage"></div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" id="siteModalAlertCancel" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" id="siteModalAlertConfirm">OK</button>
                </div>
            </div>
        </div>`;

    document.body.appendChild(modalElement);
    return modalElement;
}

function showSiteModalAlert(options = {}) {
    const {
        title = 'Confirm Action',
        message = '',
        confirmText = 'OK',
        cancelText = 'Cancel',
        confirmVariant = 'primary',
        showCancel = true
    } = options;

    if (!window.bootstrap || !window.bootstrap.Modal) {
        return Promise.resolve(showCancel ? confirm(message || title) : (alert(message || title), true));
    }

    const modalElement = ensureSiteModalAlertElement();
    const titleElement = document.getElementById('siteModalAlertTitle');
    const messageElement = document.getElementById('siteModalAlertMessage');
    const cancelButton = document.getElementById('siteModalAlertCancel');
    const confirmButton = document.getElementById('siteModalAlertConfirm');
    const closeButton = modalElement.querySelector('.btn-close');

    titleElement.textContent = title;
    messageElement.textContent = message;
    cancelButton.textContent = cancelText;
    confirmButton.textContent = confirmText;
    confirmButton.className = `btn btn-${confirmVariant}`;
    cancelButton.style.display = showCancel ? '' : 'none';
    closeButton.style.display = showCancel ? '' : 'none';

    return new Promise((resolve) => {
        const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
        let settled = false;

        const cleanup = () => {
            confirmButton.removeEventListener('click', onConfirm);
            cancelButton.removeEventListener('click', onDismiss);
            closeButton.removeEventListener('click', onDismiss);
            modalElement.removeEventListener('hidden.bs.modal', onHidden);
        };

        const finalize = (result) => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(result);
        };

        const onConfirm = () => {
            finalize(true);
            modal.hide();
        };

        const onDismiss = () => {
            finalize(false);
        };

        const onHidden = () => {
            finalize(false);
        };

        confirmButton.addEventListener('click', onConfirm);
        cancelButton.addEventListener('click', onDismiss);
        closeButton.addEventListener('click', onDismiss);
        modalElement.addEventListener('hidden.bs.modal', onHidden);

        modal.show();
    });
}
