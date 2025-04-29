// Initialize Supabase
const supabaseUrl = 'https://kyxsxnxszpocszlmrpdb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5eHN4bnhzenBvY3N6bG1ycGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxMDQ1NzYsImV4cCI6MjA2MDY4MDU3Nn0.ANiq24mu1Pu2oA7Y2z-EzmCJUT1MZt4kyV7Hm8edm6s';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// -------------------------
// AUTH METHODS
// -------------------------

// Login (Email + Password)
async function login(email, password) {
    const { error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) throw error; // Let page handle showing error
}

// Signup (Register new account)
async function signup(email, password) {
    const { error } = await supabaseClient.auth.signUp({
        email: email,
        password: password
    });

    if (error) throw error;
}

// Forgot Password (Send Reset Email)
async function resetPassword(email) {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/update-password.html'
    });

    if (error) throw error;
}

// Update Password (After user clicks password reset link)
async function updatePassword(newPassword) {
    const { error } = await supabaseClient.auth.updateUser({
        password: newPassword
    });

    if (error) throw error;
}

async function updateTheme(newTheme){
    const {error } = await supabaseClient.auth.updateUser({
        data : {
            theme: newTheme
        }
    });

    if(error) throw error;
}

// Logout
async function logout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
}

// Get current user session
async function getCurrentSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
}

// Get current user details (like email)
async function getCurrentUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
}

// Redirect if not logged in
async function redirectIfNotLoggedIn() {
    const session = await getCurrentSession();
    if (!session) {
        window.location.href = "login.html";
    }
}

// Redirect if already logged in (login page)
async function redirectIfLoggedIn() {
    const session = await getCurrentSession();
    if (session) {
        window.location.href = "payments.html"; 
    }
}
