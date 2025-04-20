const SUPABASE_URL = 'https://kyxsxnxszpocszlmrpdb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5eHN4bnhzenBvY3N6bG1ycGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxMDQ1NzYsImV4cCI6MjA2MDY4MDU3Nn0.ANiq24mu1Pu2oA7Y2z-EzmCJUT1MZt4kyV7Hm8edm6s';

// Initialize client (don't name it 'supabase' to avoid conflicts)
const supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === CRUD: Bills ===
async function getBills() {
  const { data, error } = await supa.from("bills").select("*").order("name");
  if (error) console.error("Fetch bills error:", error);
  return data || [];
}

async function getBillById(id) {
    const {data, error} = await supa.from("bills").select("*").eq("id", id).maybeSingle()
    if(error) console.error("Get bill by id error:", error);
    return data;
}

async function addBill(bill) {
  const { data, error } = await supa.from("bills").insert([bill]);
  if (error) console.error("Add bill error:", error);
  return data;
}

async function updateBill(id, updates) {
  const { data, error } = await supa.from("bills").update(updates).eq("id", id);
  if (error) console.error("Update bill error:", error);
  return data;
}

async function deleteBill(id) {
  const { error } = await supa.from("bills").delete().eq("id", id);
  if (error) console.error("Delete bill error:", error);
}

// === CRUD: Payments ===
async function getPayments() {
  const { data, error } = await supa.from("Payments").select("*").order("date_due");
  if (error) console.error("Fetch payments error:", error);
  return data || [];
}

async function addPayment(payment) {
  const { data, error } = await supa.from("Payments").insert([payment]);
  if (error) console.error("Add payment error:", error);
  return data;
}

async function updatePayment(id, updates) {
  const { data, error } = await supa.from("Payments").update(updates).eq("id", id);
  if (error) console.error("Update payment error:", error);
  return data;
}

async function deletePayment(id) {
  const { error } = await supa.from("Payments").delete().eq("id", id);
  if (error) console.error("Delete payment error:", error);
}