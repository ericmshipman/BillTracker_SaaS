function formatDate(dateString) {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function formatLocalDate(dateInput) {
    const date = new Date(dateInput);
    if (isNaN(date)) {
      console.error("Invalid date passed to formatLocalDate:", dateInput);
      return "";
    }
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().split("T")[0];
  }

function getAmountText(paid_date){
    if(paid_date){
        return "text-success fw-bold fs-3";
    }else{
        return "text-danger fw-bold fs-3";
    }
}