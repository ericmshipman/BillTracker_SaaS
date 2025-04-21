function formatDate(dateString) {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function formatDate(dateString) {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function getAmountText(paid_date){
    if(paid_date){
        return "text-success fw-bold fs-3";
    }else{
        return "text-danger fw-bold fs-3";
    }
}