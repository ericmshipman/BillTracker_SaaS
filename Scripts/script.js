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
