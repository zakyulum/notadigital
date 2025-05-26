const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
const PORT = 3002;

// JWT secret key - in production, use environment variable
const JWT_SECRET = 'your-secret-key-here'; // Change this to a secure random string in production

// Serve static files
app.use(express.static(path.join(__dirname)));

// Increase the body size limit for JSON payloads
app.use(express.json({ limit: '50mb' }));

// Add CORS middleware with updated configuration
app.use(cors({
    origin: ['http://localhost:3002', 'http://127.0.0.1:3002', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 hours
}));

// User data structure with hashed passwords
let users = {
    'admin': { 
        username: 'admin', 
        passwordHash: '$2b$10$YourHashedPasswordHere', // This will be updated on first run
        role: 'admin'
    }
};

// Function to load users from file
function loadUsers() {
    const usersFile = path.join(__dirname, 'data', 'users.json');
    try {
        if (fs.existsSync(usersFile)) {
            const data = fs.readFileSync(usersFile, 'utf8');
            users = JSON.parse(data);
            console.log('Users loaded from file');
        } else {
            // Create data directory if it doesn't exist
            if (!fs.existsSync(path.join(__dirname, 'data'))) {
                fs.mkdirSync(path.join(__dirname, 'data'));
            }
            // Save initial users object
            fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
            console.log('Initial users file created');
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Function to save users to file
function saveUsers() {
    const usersFile = path.join(__dirname, 'data', 'users.json');
    try {
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
        console.log('Users saved to file');
    } catch (error) {
        console.error('Error saving users:', error);
    }
}

// Password validation function
function validatePassword(password) {
    // Minimum 8 characters, at least one uppercase letter, one lowercase letter, one number and one special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
}

// Middleware to check for authentication token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ 
                    error: 'Token has expired',
                    code: 'TOKEN_EXPIRED'
                });
            }
            return res.status(403).json({ 
                error: 'Invalid token',
                code: 'INVALID_TOKEN'
            });
        }
        req.user = user;
        req.userId = user.userId;
        next();
    });
}

// Initialize admin password on first run
async function initializeAdminPassword() {
    // Load existing users first
    loadUsers();
    
    if (users['admin'].passwordHash === '$2b$10$YourHashedPasswordHere') {
        const hashedPassword = await bcrypt.hash('Admin123!', 10);
        users['admin'].passwordHash = hashedPassword;
        // Save updated users
        saveUsers();
        console.log('Admin password initialized');
    }
}

// Function to migrate invoices from null directory to user directory
async function migrateNullInvoices() {
    const nullDir = path.join(__dirname, 'invoice', 'null');
    if (!fs.existsSync(nullDir)) {
        console.log('No null directory found, skipping migration');
        return;
    }

    console.log('Starting migration of invoices from null directory...');
    const files = fs.readdirSync(nullDir);
    
    for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        try {
            const filePath = path.join(nullDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const invoice = JSON.parse(content);
            
            // Extract user ID from filename
            const filenameParts = file.split('_');
            if (filenameParts.length < 3) {
                console.log(`Skipping invalid filename format: ${file}`);
                continue;
            }
            
            // Try to find the user ID from the transaction data
            let userId = null;
            if (invoice.userId) {
                userId = invoice.userId;
            } else {
                // If no userId in data, try to extract from filename
                const match = file.match(/invoice_([^_]+)_/);
                if (match && match[1] !== 'null') {
                    userId = match[1];
                }
            }
            
            if (!userId) {
                console.log(`Could not determine user ID for file: ${file}`);
                continue;
            }
            
            // Create user directory if it doesn't exist
            const userDir = path.join(__dirname, 'invoice', userId);
            if (!fs.existsSync(userDir)) {
                fs.mkdirSync(userDir, { recursive: true });
            }
            
            // Move file to user directory
            const newFilePath = path.join(userDir, file);
            fs.renameSync(filePath, newFilePath);
            console.log(`Migrated ${file} to user directory: ${userId}`);
            
        } catch (error) {
            console.error(`Error migrating file ${file}:`, error);
        }
    }
    
    // Remove null directory if empty
    try {
        const remainingFiles = fs.readdirSync(nullDir);
        if (remainingFiles.length === 0) {
            fs.rmdirSync(nullDir);
            console.log('Removed empty null directory');
        }
    } catch (error) {
        console.error('Error removing null directory:', error);
    }
}

// Call migration function when server starts
migrateNullInvoices().catch(console.error);

// --- API Routes ---

// Registration endpoint (Public)
app.post('/api/register', async (req, res) => {
    console.log('Register attempt:', { username: req.body.username });
    const { username, password } = req.body;

    // Basic validation
    if (!username || !password) {
        return res.status(400).json({ error: 'Username dan password harus diisi' });
    }

    // Password validation
    if (!validatePassword(password)) {
        return res.status(400).json({ 
            error: 'Password harus minimal 8 karakter dan mengandung huruf besar, huruf kecil, angka dan karakter spesial' 
        });
    }

    // Check if username already exists
    const existingUser = Object.values(users).find(user => user.username === username);
    if (existingUser) {
        return res.status(409).json({ error: 'Username sudah digunakan' });
    }

    try {
        // Hash password with bcryptjs
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('Password hashed successfully');
        
        // Generate user ID
        const userId = 'user_' + Date.now();

        // Store user with hashed password
        users[userId] = { 
            username, 
            passwordHash: hashedPassword,
            role: 'user'
        };

        // Save updated users to file
        saveUsers();

        console.log('User stored:', { userId, username });

        // Buat direktori dan file default untuk user
        const directoriesCreated = await createUserDirectories(userId);
        if (!directoriesCreated) {
            throw new Error('Gagal membuat direktori user');
        }

        // Generate JWT token
        const token = jwt.sign({ userId, username, role: 'user' }, JWT_SECRET, { expiresIn: '24h' });

        console.log('User registered successfully:', { userId, username });

        res.status(201).json({ 
            message: 'Registrasi berhasil',
            token,
            userId,
            username,
            role: 'user'
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan saat registrasi' });
    }
});

// Login endpoint (Public)
app.post('/api/login', async (req, res) => {
    console.log('Login attempt:', { username: req.body.username });
    const { username, password } = req.body;
    const ip = req.ip;

    try {
        // Basic validation
        if (!username || !password) {
            return res.status(400).json({ 
                error: 'Username dan password harus diisi',
                code: 'MISSING_CREDENTIALS'
            });
        }

        // Find user by username
        const userEntry = Object.entries(users).find(([_, user]) => user.username === username);
        
        if (!userEntry) {
            console.log('Login failed: User not found:', username);
            return res.status(401).json({ 
                error: 'Username atau password salah',
                code: 'INVALID_CREDENTIALS'
            });
        }

        const [userId, user] = userEntry;

        // Compare password with hash
        const validPassword = await bcrypt.compare(password, user.passwordHash);
        
        if (!validPassword) {
            console.log('Login failed: Invalid password for user:', username);
            return res.status(401).json({ 
                error: 'Username atau password salah',
                code: 'INVALID_CREDENTIALS'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log('Login successful:', { userId, username });

        res.json({
            message: 'Login berhasil',
            token,
            userId,
            username: user.username,
            role: user.role
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            error: 'Terjadi kesalahan saat login',
            code: 'LOGIN_ERROR'
        });
    }
});

// Change password endpoint (Protected)
app.put('/api/change-password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.userId;

    // Basic validation
    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: 'All password fields are required' });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'New password and confirmation do not match' });
    }

    // Password validation
    if (!validatePassword(newPassword)) {
        return res.status(400).json({ 
            message: 'New password must be at least 8 characters long and contain uppercase, lowercase, number and special character' 
        });
    }

    try {
        const user = users[userId];
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!validPassword) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        user.passwordHash = hashedNewPassword;

        // Generate new token
        const token = jwt.sign(
            { userId, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Password changed successfully',
            token // Send new token to client
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Error changing password' });
    }
});

// Protected API Routes (require authenticationToken middleware)
app.post('/api/save-invoice', authenticateToken, (req, res) => {
    const transactionData = req.body;
    const filename = transactionData.filename;

    if (!filename) {
        console.error('Failed to save invoice: filename missing in request body');
        return res.status(400).json({ error: 'Filename missing in transaction data' });
    }

    // Ensure the filename includes the user ID
    if (!filename.startsWith(`invoice_${req.userId}_`)) {
        transactionData.filename = `invoice_${req.userId}_${filename.replace(/^invoice_/, '')}`;
    }

    const userInvoiceDir = path.join(__dirname, 'invoice', req.userId);
    
    // Create user-specific invoice directory if it doesn't exist
    if (!fs.existsSync(userInvoiceDir)) {
        fs.mkdirSync(userInvoiceDir, { recursive: true });
    }

    // Save the entire transaction object to the user's file
    const filePath = path.join(userInvoiceDir, transactionData.filename);
    fs.writeFile(filePath, JSON.stringify(transactionData, null, 2), err => {
        if (err) {
            console.error('Failed to write user invoice file:', err);
            return res.status(500).json({ error: 'Failed to save user invoice file' });
        }
        console.log(`User ${req.userId}: Invoice file saved:`, filePath);
        res.json({ success: true, filename: transactionData.filename });
    });
});

app.get('/api/list-invoice', authenticateToken, (req, res) => {
    const userId = req.userId;
    const userJsonPath = path.join(__dirname, 'data', userId, 'transactions.json');
    if (fs.existsSync(userJsonPath)) {
        try {
            const transactions = JSON.parse(fs.readFileSync(userJsonPath, 'utf8'));
            return res.json(transactions);
        } catch (err) {
            console.error(`User ${userId}: Failed to read or parse transactions.json:`, err);
            return res.status(500).json({ error: 'Failed to read transactions file' });
        }
    }
    // Fallback ke cara lama jika file tidak ada
    const userInvoiceDir = path.join(__dirname, 'invoice', userId);
    if (!fs.existsSync(userInvoiceDir)) {
        console.log(`User ${userId}: Invoice directory not found, returning empty list.`);
        return res.json([]);
    }
    fs.readdir(userInvoiceDir, (err, files) => {
        if (err) {
            console.error(`User ${userId}: Failed to read user invoice folder:`, err);
            return res.status(500).json({ error: 'Failed to read invoice folder' });
        }
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        if (jsonFiles.length === 0) {
            console.log(`User ${userId}: No invoice files found.`);
            return res.json([]);
        }
        console.log(`User ${userId}: Found ${jsonFiles.length} invoice files.`);
        const data = [];
        let count = 0;
        jsonFiles.forEach(file => {
            fs.readFile(path.join(userInvoiceDir, file), 'utf8', (err, content) => {
                count++;
                if (err) {
                    console.error(`User ${userId}: Failed to read invoice file ${file}:`, err);
                    if (!res.headersSent) {
                        return res.status(500).json({ error: `Failed to read invoice file ${file}` });
                    }
                    return;
                }
                try {
                    data.push(JSON.parse(content));
                } catch (parseErr) {
                    console.error(`User ${userId}: Failed to parse invoice file ${file}:`, parseErr);
                    if (!res.headersSent) {
                        return res.status(500).json({ error: `Failed to parse invoice data in file ${file}` });
                    }
                    return;
                }
                if (count === jsonFiles.length) {
                    console.log(`User ${userId}: Successfully read ${data.length}/${jsonFiles.length} invoice files.`);
                    res.json(data);
                }
            });
        });
    });
});

app.delete('/api/delete-invoice', authenticateToken, (req, res) => {
    const filename = req.query.filename;
    if (!filename) {
        console.log(`User ${req.userId}: No filename provided for deletion`);
        return res.status(400).json({ error: 'No filename provided' });
    }
    const filePath = path.join(__dirname, 'invoice', req.userId, filename);
    fs.unlink(filePath, err => {
        if (err) {
            console.error(`User ${req.userId}: Delete error for file ${filename}:`, err);
            // Differentiate between file not found and other errors
            if (err.code === 'ENOENT') {
                 return res.status(404).json({ error: 'File not found or already deleted' });
            } else {
                 return res.status(500).json({ error: 'Failed to delete file' });
            }
        }
        console.log(`User ${req.userId}: File deleted:`, filePath);
        res.json({ success: true });
    });
});

// --- API Endpoint to get a specific invoice data (Protected) ---
// Frontend will request this using the filename (slug)
app.get('/api/invoice-data/:filename', authenticateToken, (req, res) => {
    const filename = req.params.filename; // Get filename from URL parameter
    const userId = req.userId; // Get user ID from authenticated token

    // Validasi hanya prefix, tidak perlu .json
    if (!filename || !filename.startsWith(`invoice_${userId}_`)) {
        console.warn(`User ${userId}: Attempted to access invalid or unauthorized invoice file: ${filename}`);
        return res.status(400).json({ error: 'Invalid or unauthorized filename' });
    }

    // Tambahkan .json saat membaca file
    const filePath = path.join(__dirname, 'invoice', userId, `${filename}.json`);

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error(`User ${userId}: Failed to read invoice file ${filename}:`, err);
            if (err.code === 'ENOENT') {
                 return res.status(404).json({ error: 'Invoice file not found' });
            } else {
                 return res.status(500).json({ error: 'Failed to read invoice file' });
            }
        }
        try {
            const invoiceData = JSON.parse(data);
             console.log(`User ${userId}: Successfully read invoice file ${filename}.`);
            res.json(invoiceData);
        } catch (parseErr) {
            console.error(`User ${userId}: Failed to parse invoice file ${filename}:`, parseErr);
            res.status(500).json({ error: 'Failed to parse invoice data' });
        }
    });
});

// 1. Route paling spesifik (userId + filename) - tanpa autentikasi
app.get('/invoice/:userId/:filename', (req, res) => {
    const { userId, filename } = req.params;
    const filePath = path.join(__dirname, 'invoice', userId, `${filename}.json`);
    const settingsPath = path.join(__dirname, 'settings', `${userId}.json`);
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(404).send('<h2>Invoice tidak ditemukan</h2>');
        }
        let invoice;
        try {
            invoice = JSON.parse(data);
        } catch (e) {
            return res.status(500).send('<h2>Data invoice rusak</h2>');
        }
        // Baca data toko
        let store = {
            storeName: 'Toko Saya',
            storeAddress: 'Jl. Contoh No. 123',
            storePhone: '08123456789',
            storeTagline: 'Jual Eceran Harga Grosir',
            storeFooter: 'Terima kasih telah berbelanja di toko kami!',
            storeLogo: null
        };
        if (fs.existsSync(settingsPath)) {
            try {
                const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                store = { ...store, ...settings };
            } catch (e) {}
        }
        // Format rupiah
        function formatRupiah(num) {
            return 'Rp ' + Number(num).toLocaleString('id-ID');
        }
        // Layout nota sesuai setting paperLayout
        const isThermal = store.paperLayout === 'thermal80';
        // Render HTML mirip preview invoice
        res.send(`
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Nota ${invoice.invoiceNumber}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                    
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    
                    body {
                        font-family: 'Inter', sans-serif;
                        background: #f8fafc;
                        color: #1e293b;
                        line-height: 1.5;
                    }
                    
                    .container {
                        max-width: 210mm;
                        margin: 2rem auto;
                        background: white;
                        padding: 2.5rem;
                        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
                        border-radius: 0.5rem;
                    }
                    
                    .header {
                        text-align: center;
                        margin-bottom: 2.5rem;
                        padding-bottom: 2rem;
                        border-bottom: 2px solid #e2e8f0;
                    }
                    
                    .header img {
                        max-height: 80px;
                        margin-bottom: 1rem;
                    }
                    
                    .header h1 {
                        font-size: 1.875rem;
                        font-weight: 700;
                        color: #0f172a;
                        margin-bottom: 0.5rem;
                    }
                    
                    .header .tagline {
                        color: #64748b;
                        font-size: 1rem;
                        margin-bottom: 0.75rem;
                    }
                    
                    .header .contact {
                        color: #475569;
                        font-size: 0.875rem;
                    }
                    
                    .invoice-info {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 2rem;
                        margin-bottom: 2.5rem;
                        padding-bottom: 2rem;
                        border-bottom: 2px solid #e2e8f0;
                    }
                    
                    .info-block h3 {
                        font-size: 0.875rem;
                        font-weight: 600;
                        color: #64748b;
                        margin-bottom: 0.5rem;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }
                    
                    .info-block p {
                        font-size: 1rem;
                        color: #1e293b;
                        margin-bottom: 0.5rem;
                    }
                    
                    .info-block .label {
                        font-weight: 500;
                        color: #475569;
                    }
                    
                    .items-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 2.5rem;
                    }
                    
                    .items-table th {
                        background: #f8fafc;
                        padding: 1rem;
                        text-align: left;
                        font-weight: 600;
                        color: #475569;
                        border-bottom: 2px solid #e2e8f0;
                    }
                    
                    .items-table td {
                        padding: 1rem;
                        border-bottom: 1px solid #e2e8f0;
                        color: #1e293b;
                    }
                    
                    .items-table tr:last-child td {
                        border-bottom: none;
                    }
                    
                    .total-section {
                        display: flex;
                        justify-content: flex-end;
                        margin-bottom: 2.5rem;
                    }
                    
                    .total-box {
                        width: 300px;
                        background: #f8fafc;
                        padding: 1.5rem;
                        border-radius: 0.5rem;
                    }
                    
                    .total-row {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 0.5rem;
                        font-size: 1rem;
                        color: #475569;
                    }
                    
                    .total-row.grand-total {
                        font-size: 1.25rem;
                        font-weight: 700;
                        color: #0f172a;
                        margin-top: 1rem;
                        padding-top: 1rem;
                        border-top: 2px solid #e2e8f0;
                    }
                    
                    .notes {
                        background: #f8fafc;
                        padding: 1.5rem;
                        border-radius: 0.5rem;
                        margin-bottom: 2.5rem;
                    }
                    
                    .notes h3 {
                        font-size: 0.875rem;
                        font-weight: 600;
                        color: #64748b;
                        margin-bottom: 0.5rem;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }
                    
                    .notes p {
                        color: #1e293b;
                        white-space: pre-line;
                    }
                    
                    .footer {
                        text-align: center;
                        color: #64748b;
                        font-size: 0.875rem;
                        padding-top: 2rem;
                        border-top: 2px solid #e2e8f0;
                    }
                    
                    @media print {
                        body {
                            background: white;
                        }
                        
                        .container {
                            margin: 0;
                            padding: 0;
                            box-shadow: none;
                            border-radius: 0;
                        }
                        
                        .no-print {
                            display: none;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    ${store.paperLayout === 'A4' ? `
                    <div class="header" style="margin-bottom: 1.5rem; padding-bottom: 1rem;">
                        ${store.storeLogo ? `<img src="${store.storeLogo}" alt="Logo" style="max-height: 60px; margin-bottom: 0.5rem;">` : ''}
                        <h1 style="margin: 0.3rem 0;">${store.storeName}</h1>
                        ${store.storeTagline ? `<p class="tagline" style="margin: 0.2rem 0;">${store.storeTagline}</p>` : ''}
                        <div class="contact" style="margin-top: 0.5rem;">
                            <p style="margin: 0.1rem 0;">${store.storeAddress}</p>
                            <p style="margin: 0.1rem 0;">Telp: ${store.storePhone}</p>
                            ${store.storeEmail ? `<p style="margin: 0.1rem 0;">Email: ${store.storeEmail}</p>` : ''}
                    </div>
                        </div>
                    <!-- Layout A4 -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 1rem; padding: 0 2rem;">
                        <div style="text-align: left;">
                            <p style="color: #666; font-size: 0.9rem; margin-bottom: 0.1rem;">No. Invoice:</p>
                            <p style="font-weight: 500; margin-bottom: 0.5rem;">${invoice.invoiceNumber}</p>
                            <p style="color: #666; font-size: 0.9rem; margin-bottom: 0.1rem;">Tanggal:</p>
                            <p style="font-weight: 500; margin-bottom: 0.5rem;">${new Date(invoice.date).toLocaleDateString('id-ID', {day: '2-digit', month: '2-digit', year: 'numeric'})}</p>
                            <p style="color: #666; font-size: 0.9rem; margin-bottom: 0.1rem;">Waktu:</p>
                            <p style="font-weight: 500;">${new Date(invoice.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</p>
                        </div>
                        <div style="text-align: right;">
                            <p style="color: #666; font-size: 0.9rem; margin-bottom: 0.1rem;">Nama:</p>
                            <p style="font-weight: 500; margin-bottom: 0.5rem;">${invoice.customerName}</p>
                            <p style="color: #666; font-size: 0.9rem; margin-bottom: 0.1rem;">Telp:</p>
                            <p style="font-weight: 500; margin-bottom: 0.5rem;">${invoice.customerPhone}</p>
                            <p style="color: #666; font-size: 0.9rem; margin-bottom: 0.1rem;">Alamat:</p>
                            <p style="font-weight: 500;">${invoice.customerAddress}</p>
                    </div>
                    </div>
                    <table class="items-table" style="margin-top: 0.5rem;">
                            <thead>
                                <tr>
                                <th style="background: #f8fafc; padding: 1rem; text-align: left; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0;">Produk</th>
                                <th style="background: #f8fafc; padding: 1rem; text-align: center; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0;">Qty</th>
                                <th style="background: #f8fafc; padding: 1rem; text-align: right; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0;">Harga Satuan</th>
                                <th style="background: #f8fafc; padding: 1rem; text-align: right; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0;">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(invoice.items || []).map(item => `
                                <tr style="background-color: #f8fafc;">
                                    <td style="padding: 1rem; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${item.name}</td>
                                    <td style="padding: 1rem; text-align: center; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${item.quantity}</td>
                                    <td style="padding: 1rem; text-align: right; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${formatRupiah(item.price)}</td>
                                    <td style="padding: 1rem; text-align: right; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${formatRupiah(item.subtotal)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    <div style="display: flex; justify-content: flex-end; margin-top: 2rem;">
                        <div style="width: 300px; background: #f8fafc; padding: 1.5rem; border-radius: 0.5rem;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <span style="color: #475569;">Total:</span>
                                <span style="font-weight: 700; color: #0f172a;">${formatRupiah(invoice.total)}</span>
                    </div>
                        </div>
                    </div>
                    ${invoice.notes ? `
                        <div class="notes">
                            <h3>Catatan</h3>
                            <p>${invoice.notes}</p>
                        </div>
                    ` : ''}
                    <div class="footer">
                        <p>${store.storeFooter}</p>
                    </div>
                    ` : `
                    <!-- Layout Thermal 80mm SEDERHANA -->
                    <div style="width: 80mm; margin: 0 auto; font-size: 12px;">
                        <div style="text-align: center; margin-bottom: 4px;">
                            ${store.storeLogo ? `<img src="${store.storeLogo}" alt="Logo" style="max-height: 32px; margin-bottom: 4px;">` : ''}
                            <div style="font-size: 13px; font-weight: bold; margin-bottom: 1px;">${store.storeName}</div>
                            <div style="font-size: 11px; color: #444; margin-bottom: 1px;">${store.storeAddress}</div>
                            <div style="display: flex; justify-content: center; gap: 6px; font-size: 11px; color: #444; margin-bottom: 2px;">
                                <span>Telp: ${store.storePhone}</span>
                                ${store.storeEmail ? `<span>Email: ${store.storeEmail}</span>` : ''}
                </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <div>
                                <span style='font-size:11px;color:#666;'>No. Invoice:</span><br>
                                <span style='font-weight:500;'>${invoice.invoiceNumber}</span>
                            </div>
                            <div style="text-align: right;">
                                <span style='font-size:11px;color:#666;'>Nama:</span><br>
                                <span style='font-weight:500;'>${invoice.customerName}</span>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <div>
                                <span style='font-size:11px;color:#666;'>Waktu:</span><br>
                                <span style='font-weight:500;'>${new Date(invoice.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <div style="text-align: right;">
                                <span style='font-size:11px;color:#666;'>Telp:</span><br>
                                <span style='font-weight:500;'>${invoice.customerPhone}</span>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <div>
                                <span style='font-size:11px;color:#666;'>Tanggal:</span><br>
                                <span style='font-weight:500;'>${new Date(invoice.date).toLocaleDateString('id-ID', {day: '2-digit', month: '2-digit', year: 'numeric'})}</span>
                            </div>
                            <div style="text-align: right;">
                                <span style='font-size:11px;color:#666;'>Alamat:</span><br>
                                <span style='font-weight:500;'>${invoice.customerAddress}</span>
                            </div>
                        </div>
                        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin: 8px 0;">
                            <div style="display: flex; font-size: 11px; font-weight: bold; margin-bottom: 4px;">
                                <span style="flex:2;">Produk</span>
                                <span style="flex:1;text-align:center;">Qty</span>
                                <span style="flex:1;text-align:right;">Total</span>
                            </div>
                            ${(invoice.items || []).map(item => `
                                <div style="display: flex; font-size: 11px; margin: 2px 0;">
                                    <span style="flex:2;">${item.name}</span>
                                    <span style="flex:1;text-align:center;">${item.quantity}</span>
                                    <span style="flex:1;text-align:right;">${formatRupiah(item.subtotal)}</span>
                                </div>
                            `).join('')}
                        </div>
                        <div style="margin-top:8px; font-size:12px; text-align:right;">
                            <span style='font-size:11px;color:#666;'>Total:</span><br>
                            <span style='font-weight:700;'>${formatRupiah(invoice.total)}</span>
                        </div>
                        <div style="text-align: center; font-size: 11px; margin-top: 12px;">${store.storeFooter}</div>
                    </div>
                    `}
                </div>
            </body>
            </html>
        `);
    });
});

// 2. Route umum (fallback, file statis) - harus di bawah!
app.get('/invoice/:filename', (req, res) => {
    res.sendFile(path.join(__dirname, 'invoice_view.html'));
})

// --- Non-API Routes ---
// Route to serve the standalone invoice view HTML
app.get('/invoice/:filename', (req, res) => {
    const filename = req.params.filename;
    console.log('Requested invoice filename:', filename);

    // Extract userId from filename
    const filenameParts = filename.split('_');
    if (filenameParts.length < 2) {
        console.error('Invalid filename format:', filename);
        return res.status(400).send('Invalid invoice filename format');
    }

    const userIdFromFilename = filenameParts[1];
    console.log('Extracted userId:', userIdFromFilename);

    // Try both user directory and null directory
    const userFilePath = path.join(__dirname, 'invoice', userIdFromFilename, filename);
    const nullFilePath = path.join(__dirname, 'invoice', 'null', filename);
    
    let filePath = userFilePath;
    if (!fs.existsSync(filePath) && fs.existsSync(nullFilePath)) {
        filePath = nullFilePath;
        console.log('File found in null directory, will be migrated');
    }

    console.log('Full file path:', filePath);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.error('Invoice file not found:', filePath);
        return res.status(404).send('Invoice not found');
    }

    // If file exists, serve the HTML view
    res.sendFile(path.join(__dirname, 'invoice_view.html'));
});

// Add a new route to handle JSON file requests
app.get('/invoice/:filename.json', (req, res) => {
    const filename = req.params.filename;
    console.log('Requested invoice JSON filename:', filename);

    // Extract userId from filename
    const filenameParts = filename.split('_');
    if (filenameParts.length < 2) {
        console.error('Invalid filename format:', filename);
        return res.status(400).json({ error: 'Invalid invoice filename format' });
    }

    const userIdFromFilename = filenameParts[1];
    console.log('Extracted userId:', userIdFromFilename);

    // Try both user directory and null directory
    const userFilePath = path.join(__dirname, 'invoice', userIdFromFilename, `${filename}.json`);
    const nullFilePath = path.join(__dirname, 'invoice', 'null', `${filename}.json`);
    
    let filePath = userFilePath;
    if (!fs.existsSync(filePath) && fs.existsSync(nullFilePath)) {
        filePath = nullFilePath;
        console.log('File found in null directory, will be migrated');
    }

    console.log('Full file path:', filePath);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.error('Invoice file not found:', filePath);
        return res.status(404).json({ error: 'Invoice file not found' });
    }

    // Read and send the JSON file
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading invoice file:', err);
            return res.status(500).json({ error: 'Failed to read invoice file' });
        }

        try {
            const invoiceData = JSON.parse(data);
            res.json(invoiceData);
        } catch (parseError) {
            console.error('Error parsing invoice JSON:', parseError);
            res.status(500).json({ error: 'Invalid invoice data format' });
        }
    });
});

// --- Public API Endpoint to get store settings (NO Authentication Required) ---
app.get('/public-settings/:userId', (req, res) => {
    const userId = req.params.userId;
    console.log('\n=== Public Settings Request ===');
    console.log('Requested userId:', userId);
    
    const userSettingsFile = path.join(__dirname, 'settings', `${userId}.json`);
    console.log('Settings file path:', userSettingsFile);
    console.log('File exists:', fs.existsSync(userSettingsFile));

    fs.readFile(userSettingsFile, 'utf8', (err, data) => {
        if (err) {
            // If user-specific file doesn't exist, return default settings
            if (err.code === 'ENOENT') {
                console.log(`User ${userId}: Settings file not found, returning default settings.`);
                return res.json({
                    storeName: 'Toko Saya',
                    storeAddress: 'Jl. Contoh No. 123',
                    storePhone: '08123456789',
                    storeEmail: 'toko@example.com',
                    storeFooter: 'Terima kasih telah berbelanja di toko kami!',
                    storeLogo: null,
                    storeTagline: 'Jual Eceran Harga Grosir',
                    whatsappMessageTemplate: 'Halo {{customerName}}, berikut adalah nota transaksi Anda dari {{storeName}}:\n\n{{notaLink}}\n\nTerima kasih!'
                });
            } else {
                console.error(`User ${userId}: Failed to read settings file:`, err);
                return res.status(500).json({ error: 'Failed to load settings' });
            }
        }
        try {
            const settingsData = JSON.parse(data);
            // Add default values for new settings if they don't exist in the file
            const mergedSettings = {
                storeName: settingsData.storeName || 'Toko Saya',
                storeAddress: settingsData.storeAddress || 'Jl. Contoh No. 123',
                storePhone: settingsData.storePhone || '08123456789',
                storeEmail: settingsData.storeEmail || 'toko@example.com',
                storeFooter: settingsData.storeFooter || 'Terima kasih telah berbelanja di toko kami!',
                storeLogo: settingsData.storeLogo || null,
                storeTagline: settingsData.storeTagline || 'Jual Eceran Harga Grosir',
                whatsappMessageTemplate: settingsData.whatsappMessageTemplate || 'Halo {{customerName}}, berikut adalah nota transaksi Anda dari {{storeName}}:\n\n{{notaLink}}\n\nTerima kasih!'
            };
            console.log(`User ${userId}: Settings loaded from file.`);
            res.json(mergedSettings);
        } catch (parseErr) {
            console.error(`User ${userId}: Failed to parse settings file:`, parseErr);
            res.status(500).json({ error: 'Failed to parse settings' });
        }
    });
});

// --- Static Files ---
// Serve static files AFTER API and other specific routes
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploads statically

// Add logging middleware for all requests
app.use((req, res, next) => {
    console.log(`\n=== New Request ===`);
    console.log(`${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    next();
});

// --- Public API Endpoint to get invoice data (NO Authentication Required) ---
// This endpoint is for customers accessing the shared link
app.get('/public-invoice-data/:filename', (req, res) => {
    console.log('\n=== Public Invoice Data Request ===');
    console.log('Requested filename:', req.params.filename);
    
    const filename = req.params.filename;
    const filenameRegex = /^invoice_[a-zA-Z0-9]+_([a-zA-Z0-9]{10})\.json$/;
    
    console.log('Filename validation:', filenameRegex.test(filename));
    
    if (!filename || !filenameRegex.test(filename)) {
        console.log('Invalid filename format');
        return res.status(400).json({ error: 'Invalid invoice filename format' });
    }

    const filenameParts = filename.split('_');
    const userIdFromFilename = filenameParts[1];
    
    console.log('Extracted userId:', userIdFromFilename);
    
    // Construct the file path using the extracted userId and filename
    const filePath = path.join(__dirname, 'invoice', userIdFromFilename, filename);
    console.log('Full file path:', filePath);
    console.log('Directory exists:', fs.existsSync(path.dirname(filePath)));
    console.log('File exists:', fs.existsSync(filePath));
    console.log('Current working directory:', __dirname);

    // List contents of the invoice directory
    const invoiceDir = path.join(__dirname, 'invoice');
    if (fs.existsSync(invoiceDir)) {
        console.log('Contents of invoice directory:');
        fs.readdirSync(invoiceDir).forEach(file => {
            console.log('-', file);
        });
    }

    // List contents of the user's invoice directory
    const userInvoiceDir = path.join(__dirname, 'invoice', userIdFromFilename);
    if (fs.existsSync(userInvoiceDir)) {
        console.log(`Contents of ${userIdFromFilename}'s invoice directory:`);
        fs.readdirSync(userInvoiceDir).forEach(file => {
            console.log('-', file);
        });
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            if (err.code === 'ENOENT') {
                return res.status(404).json({ error: 'Invoice file not found' });
            } else {
                return res.status(500).json({ error: 'Failed to read invoice file' });
            }
        }
        
        try {
            const invoiceData = JSON.parse(data);
            console.log('Successfully read and parsed invoice data');
            res.json(invoiceData);
        } catch (parseError) {
            console.error('Error parsing JSON:', parseError);
            res.status(500).json({ error: 'Invalid invoice data format' });
        }
    });
});

// --- API Endpoint to handle logo serving securely (Protected) ---
// Serve user-specific logos securely, requires authentication
app.get('/uploads/:userId/logo.png', authenticateToken, (req, res) => {
    const requestedUserId = req.params.userId; // User ID from the URL
    const authenticatedUserId = req.userId; // User ID from the authenticated token

    // Ensure the requested user ID matches the authenticated user ID
    if (requestedUserId !== authenticatedUserId) {
        console.warn(`User ${authenticatedUserId}: Attempted to access logo of user ${requestedUserId} (Unauthorized).`);
        return res.status(403).json({ error: 'Forbidden' });
    }

    const logoPath = path.join(__dirname, 'uploads', authenticatedUserId, 'logo.png');

    fs.stat(logoPath, (err, stats) => {
        if (err) {
            console.error(`User ${authenticatedUserId}: Error accessing logo file:`, err);
             if (err.code === 'ENOENT') {
                // If file not found, maybe send a default placeholder or 404
                return res.status(404).json({ error: 'Logo not found' });
            } else {
                 return res.status(500).json({ error: 'Failed to access logo file' });
            }
        }

        // Serve the file
        res.sendFile(logoPath);
    });
});

app.post('/api/upload-logo', authenticateToken, (req, res) => {
    const { logoData } = req.body; // Base64 string
    const uploadDir = path.join(__dirname, 'uploads');
    const logoPath = path.join(uploadDir, 'logo.png'); // Assuming logo is saved as logo.png

    // Create upload directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir);
    }

    const userUploadDir = path.join(__dirname, 'uploads', req.userId);
    const userLogoPath = path.join(userUploadDir, 'logo.png'); // Save logo as logo.png in user's dir

    // Create user-specific upload directory if it doesn't exist
    if (!fs.existsSync(userUploadDir)) {
        fs.mkdirSync(userUploadDir, { recursive: true });
    }

    // Remove data URL prefix (e.g., data:image/png;base64,)
    const base64Data = logoData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Save the logo file to user's directory
    fs.writeFile(userLogoPath, buffer, err => {
        if (err) {
            console.error(`User ${req.userId}: Failed to save user logo file:`, err);
            return res.status(500).json({ error: 'Failed to upload logo' });
        }
        console.log(`User ${req.userId}: Logo file saved to`, userLogoPath);
        // Return the user-specific URL/path to access the logo
        res.json({ success: true, logoUrl: `/uploads/${req.userId}/logo.png` });
    });
});

app.post('/api/save-settings', authenticateToken, (req, res) => {
    const userSettingsDir = path.join(__dirname, 'settings');
    const userSettingsFile = path.join(userSettingsDir, `${req.userId}.json`);

    // Create settings directory if it doesn't exist (not user specific)
    if (!fs.existsSync(userSettingsDir)) {
        fs.mkdirSync(userSettingsDir);
    }

    fs.writeFile(userSettingsFile, JSON.stringify(req.body, null, 2), err => {
        if (err) {
            console.error(`User ${req.userId}: Failed to save user settings file:`, err);
            return res.status(500).json({ error: 'Failed to save settings' });
        }
        console.log(`User ${req.userId}: Settings saved to`, userSettingsFile);
        res.json({ success: true });
    });
});

app.get('/api/get-settings', authenticateToken, (req, res) => {
    const userSettingsFile = path.join(__dirname, 'settings', `${req.userId}.json`);
    console.log(`\nUser ${req.userId}: Requesting settings`);

    try {
        if (!fs.existsSync(userSettingsFile)) {
            console.log(`User ${req.userId}: Settings file not found, creating default settings.`);
            const defaultSettings = {
                storeName: 'Toko Saya',
                storeAddress: 'Jl. Contoh No. 123',
                storePhone: '08123456789',
                storeEmail: 'toko@example.com',
                storeFooter: 'Terima kasih telah berbelanja di toko kami!',
                storeLogo: null,
                storeTagline: 'Jual Eceran Harga Grosir',
                whatsappMessageTemplate: 'Halo {{customerName}}, berikut adalah nota transaksi Anda dari {{storeName}}:\n\n{{notaLink}}\n\nTerima kasih!'
            };

            fs.writeFileSync(userSettingsFile, JSON.stringify(defaultSettings, null, 2));
            return res.json(defaultSettings);
        }

        const settingsData = JSON.parse(fs.readFileSync(userSettingsFile, 'utf8'));
        console.log(`User ${req.userId}: Settings loaded successfully`);
        res.json(settingsData);
    } catch (error) {
        console.error(`User ${req.userId}: Error loading settings:`, error);
        res.status(500).json({ error: 'Failed to load settings' });
    }
});

app.post('/api/backup-transactions', authenticateToken, (req, res) => {
    const backupDir = path.join(__dirname, 'backup');
    const backupFile = path.join(backupDir, 'transactions.json');

    // Create backup directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
    }

    const userBackupDir = path.join(__dirname, 'backup', req.userId);
    const userBackupFile = path.join(userBackupDir, 'transactions.json'); // Save backup as transactions.json in user's dir

    // Create user-specific backup directory if it doesn't exist
    if (!fs.existsSync(userBackupDir)) {
        fs.mkdirSync(userBackupDir, { recursive: true });
    }

    // Save the transactions data to a user's JSON file
    fs.writeFile(userBackupFile, JSON.stringify(req.body, null, 2), err => {
        if (err) {
            console.error(`User ${req.userId}: Failed to save user backup file:`, err);
            return res.status(500).json({ error: 'Failed to save backup' });
        }
        console.log(`User ${req.userId}: Transactions backup saved to`, userBackupFile);
        res.json({ success: true, message: 'Backup saved successfully' });
    });
});

// Product management endpoints
// Simple approach: send/receive the whole list for the user

// GET user products
app.get('/api/products', authenticateToken, (req, res) => {
    const userProductsFile = path.join(__dirname, 'products', `${req.userId}.json`);
    console.log(`\nUser ${req.userId}: Requesting products`);

    try {
        if (!fs.existsSync(userProductsFile)) {
            console.log(`User ${req.userId}: Products file not found, creating empty list.`);
            fs.writeFileSync(userProductsFile, JSON.stringify([], null, 2));
            return res.json([]);
        }

        const productsData = JSON.parse(fs.readFileSync(userProductsFile, 'utf8'));
        console.log(`User ${req.userId}: Products loaded successfully`);
        res.json(productsData);
    } catch (error) {
        console.error(`User ${req.userId}: Error loading products:`, error);
        res.status(500).json({ error: 'Failed to load products' });
    }
});

// POST (or PUT) user products (save the whole list)
app.post('/api/products', authenticateToken, (req, res) => {
    const productsToSave = req.body; // Assuming frontend sends the whole array

    // Basic validation: ensure it's an array
    if (!Array.isArray(productsToSave)) {
        return res.status(400).json({ message: 'Request body must be an array of products' });
    }

    saveUserProducts(req.userId, productsToSave);
    res.json({ success: true, message: 'Products saved successfully' });
});

// DELETE a specific user product
app.delete('/api/products/:id', authenticateToken, (req, res) => {
    const productIdToDelete = req.params.id;
    const userId = req.userId;

    console.log(`User ${userId}: Attempting to delete product with ID ${productIdToDelete}`);

    loadUserProducts(userId, (err, products) => {
        if (err) {
            console.error(`User ${userId}: Error loading products for deletion:`, err);
            return res.status(500).json({ error: 'Failed to load products for deletion' });
        }

        const initialProductCount = products.length;
        // Filter out the product to delete
        const updatedProducts = products.filter(product => product.id !== productIdToDelete);

        if (updatedProducts.length === initialProductCount) {
            console.warn(`User ${userId}: Product with ID ${productIdToDelete} not found for deletion.`);
            return res.status(404).json({ error: 'Product not found' });
        }

        // Save the updated list back to the file
        saveUserProducts(userId, updatedProducts);

        console.log(`User ${userId}: Product ${productIdToDelete} deleted successfully.`);
        res.json({ success: true, message: 'Product deleted successfully' });
    });
});

// Helper functions for user product file operations
function saveUserProducts(userId, productsToSave) {
    const userProductsDir = path.join(__dirname, 'products');
    const userProductsFile = path.join(userProductsDir, `${userId}.json`);

    // Create products directory if it doesn't exist (not user specific)
    if (!fs.existsSync(userProductsDir)) {
        fs.mkdirSync(userProductsDir);
    }

    fs.writeFile(userProductsFile, JSON.stringify(productsToSave, null, 2), err => {
        if (err) {
            console.error(`User ${userId}: Failed to save user products file:`, err);
        } else {
            console.log(`User ${userId}: Products saved to ${userProductsFile}`);
        }
    });
}

function loadUserProducts(userId, callback) {
    const userProductsFile = path.join(__dirname, 'products', `${userId}.json`);

    fs.readFile(userProductsFile, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.log(`User ${userId}: User products file not found, returning empty list.`);
                callback(null, []); // Return empty array if file doesn't exist
            } else {
                console.error(`User ${userId}: Failed to read user products file:`, err);
                callback(err); // Pass other errors
            }
        } else {
            try {
                const products = JSON.parse(data);
                console.log(`User ${userId}: Products loaded from ${userProductsFile}`);
                callback(null, products);
            } catch (parseErr) {
                console.error(`User ${userId}: Failed to parse user products file:`, parseErr);
                callback(parseErr); // Pass parse errors
            }
        }
    });
}

// Helper function untuk membuat direktori dan file default user
async function createUserDirectories(userId) {
    try {
        // Buat direktori settings
        const settingsDir = path.join(__dirname, 'settings');
        if (!fs.existsSync(settingsDir)) {
            fs.mkdirSync(settingsDir, { recursive: true });
        }

        // Buat file settings default
        const defaultSettings = {
            storeName: 'Toko Saya',
            storeAddress: 'Jl. Contoh No. 123',
            storePhone: '08123456789',
            storeEmail: 'toko@example.com',
            storeFooter: 'Terima kasih telah berbelanja di toko kami!',
            storeLogo: null,
            storeTagline: 'Jual Eceran Harga Grosir',
            whatsappMessageTemplate: 'Halo {{customerName}}, berikut adalah nota transaksi Anda dari {{storeName}}:\n\n{{notaLink}}\n\nTerima kasih!'
        };

        fs.writeFileSync(
            path.join(settingsDir, `${userId}.json`),
            JSON.stringify(defaultSettings, null, 2)
        );

        // Buat direktori products
        const productsDir = path.join(__dirname, 'products');
        if (!fs.existsSync(productsDir)) {
            fs.mkdirSync(productsDir, { recursive: true });
        }

        // Buat file products default
        fs.writeFileSync(
            path.join(productsDir, `${userId}.json`),
            JSON.stringify([], null, 2)
        );

        return true;
    } catch (error) {
        console.error('Error creating user directories:', error);
        return false;
    }
}

// Initialize admin password and start server
initializeAdminPassword().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve invoice view for /invoice/:filename path
app.get('/invoice/:filename', (req, res) => {
    res.sendFile(path.join(__dirname, 'invoice_view.html'));
});

// Improved error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            error: 'Sesi telah berakhir. Silakan login kembali.',
            code: 'SESSION_EXPIRED'
        });
    }
    
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ 
            error: 'Format data tidak valid',
            code: 'INVALID_DATA_FORMAT'
        });
    }
    
    res.status(500).json({ 
        error: 'Terjadi kesalahan pada server',
        code: 'SERVER_ERROR'
    });
});

// Add request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Token verification endpoint
app.get('/api/verify-token', authenticateToken, (req, res) => {
    // If we get here, the token is valid (authenticateToken middleware has verified it)
    res.json({ 
        valid: true,
        user: {
            userId: req.user.userId,
            username: req.user.username,
            role: req.user.role
        }
    });
});

// Add security headers middleware
app.use((req, res, next) => {
    // Handle favicon.ico request
    if (req.url === '/favicon.ico') {
        res.status(204).end(); // No content response for favicon
        return;
    }
    
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Enable XSS filter
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Strict CSP
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com;");
    next();
});

// Add request size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add error handling for JSON parsing
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Invalid JSON format' });
    }
    next(err);
});

// Add rate limiting for login attempts
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const ip = req.ip;

    // Check if IP is locked out
    const attemptData = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    const timeSinceLastAttempt = Date.now() - attemptData.lastAttempt;

    if (attemptData.count >= MAX_LOGIN_ATTEMPTS && timeSinceLastAttempt < LOCKOUT_TIME) {
        return res.status(429).json({ 
            error: 'Too many login attempts. Please try again later.',
            remainingTime: Math.ceil((LOCKOUT_TIME - timeSinceLastAttempt) / 1000 / 60) // minutes
        });
    }

    // Reset attempts if lockout period has passed
    if (timeSinceLastAttempt >= LOCKOUT_TIME) {
        attemptData.count = 0;
    }

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        // Find user by username
        const userEntry = Object.entries(users).find(([_, user]) => user.username === username);
        
        if (!userEntry) {
            // Increment failed attempts
            attemptData.count++;
            attemptData.lastAttempt = Date.now();
            loginAttempts.set(ip, attemptData);
            
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const [userId, user] = userEntry;

        // Compare password with hash
        const validPassword = await bcrypt.compare(password, user.passwordHash);
        
        if (!validPassword) {
            // Increment failed attempts
            attemptData.count++;
            attemptData.lastAttempt = Date.now();
            loginAttempts.set(ip, attemptData);
            
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Reset login attempts on successful login
        loginAttempts.delete(ip);

        // Generate JWT token
        const token = jwt.sign(
            { userId, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            userId,
            username: user.username,
            role: user.role
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error during login' });
    }
});

// Add new API endpoints for user data
app.get('/api/settings', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const userSettingsPath = path.join(__dirname, 'data', userId, 'settings.json');
    
    try {
        if (fs.existsSync(userSettingsPath)) {
            const settings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
            res.json(settings);
        } else {
            // Return default settings
            const defaultSettings = {
                storeName: 'Toko Saya',
                storeAddress: 'Jl. Contoh No. 123',
                storePhone: '08123456789',
                storeEmail: 'toko@example.com',
                storeFooter: 'Terima kasih telah berbelanja di toko kami!',
                storeLogo: null,
                storeTagline: 'Jual Eceran Harga Grosir',
                whatsappMessageTemplate: 'Halo {{customerName}}, berikut adalah nota transaksi Anda dari {{storeName}}:\n\n{{notaLink}}\n\nTerima kasih!'
            };
            
            // Create user directory if it doesn't exist
            const userDir = path.join(__dirname, 'data', userId);
            if (!fs.existsSync(userDir)) {
                fs.mkdirSync(userDir, { recursive: true });
            }
            
            // Save default settings
            fs.writeFileSync(userSettingsPath, JSON.stringify(defaultSettings, null, 2));
            res.json(defaultSettings);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        res.status(500).json({ error: 'Gagal memuat pengaturan' });
    }
});

app.post('/api/settings', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    // Ganti path penyimpanan agar konsisten dengan endpoint GET
    const userSettingsPath = path.join(__dirname, 'settings', `${userId}.json`);
    const settings = req.body;
    
    try {
        // Buat direktori settings jika belum ada (bukan direktori user spesifik di /data)
        const settingsDir = path.join(__dirname, 'settings');
        if (!fs.existsSync(settingsDir)) {
            fs.mkdirSync(settingsDir, { recursive: true });
        }
        
        // Save settings
        fs.writeFileSync(userSettingsPath, JSON.stringify(settings, null, 2));
        console.log(`User ${userId}: Settings saved to ${userSettingsPath}`);
        res.json(settings);
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ error: 'Gagal menyimpan pengaturan' });
    }
});

app.get('/api/products', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const userProductsPath = path.join(__dirname, 'data', userId, 'products.json');
    
    try {
        if (fs.existsSync(userProductsPath)) {
            const products = JSON.parse(fs.readFileSync(userProductsPath, 'utf8'));
            res.json(products);
        } else {
            // Return empty array if no products exist
            res.json([]);
        }
    } catch (error) {
        console.error('Error loading products:', error);
        res.status(500).json({ error: 'Gagal memuat produk' });
    }
});

app.post('/api/products', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const userProductsPath = path.join(__dirname, 'data', userId, 'products.json');
    const products = req.body;
    
    try {
        // Create user directory if it doesn't exist
        const userDir = path.join(__dirname, 'data', userId);
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        
        // Save products
        fs.writeFileSync(userProductsPath, JSON.stringify(products, null, 2));
        res.json(products);
    } catch (error) {
        console.error('Error saving products:', error);
        res.status(500).json({ error: 'Gagal menyimpan produk' });
    }
});

app.delete('/api/products/:id', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const productId = req.params.id;
    const userProductsPath = path.join(__dirname, 'data', userId, 'products.json');
    
    try {
        if (fs.existsSync(userProductsPath)) {
            let products = JSON.parse(fs.readFileSync(userProductsPath, 'utf8'));
            products = products.filter(p => p.id !== productId);
            fs.writeFileSync(userProductsPath, JSON.stringify(products, null, 2));
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Produk tidak ditemukan' });
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Gagal menghapus produk' });
    }
});

app.get('/api/transactions', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const userTransactionsPath = path.join(__dirname, 'data', userId, 'transactions.json');
    
    try {
        if (fs.existsSync(userTransactionsPath)) {
            const transactions = JSON.parse(fs.readFileSync(userTransactionsPath, 'utf8'));
            res.json(transactions);
        } else {
            // Return empty array if no transactions exist
            res.json([]);
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
        res.status(500).json({ error: 'Gagal memuat transaksi' });
    }
});

// Tambahkan fungsi slugify di bagian atas file
function slugify(str) {
    return (str || '')
        .toString()
        .toLowerCase()
        .replace(/\s+/g, '-')           // Ganti spasi dengan -
        .replace(/[^\w\-]+/g, '')       // Hapus karakter non-word
        .replace(/\-\-+/g, '-')         // Ganti -- dengan -
        .replace(/^-+/, '')             // Hapus - di awal
        .replace(/-+$/, '');            // Hapus - di akhir
}

app.post('/api/transactions', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const userTransactionsPath = path.join(__dirname, 'data', userId, 'transactions.json');
    const transaction = req.body;
    try {
        // Create user directory if it doesn't exist
        const userDir = path.join(__dirname, 'data', userId);
        if (!fs.existsSync(userDir)) {
            fs.mkdirSync(userDir, { recursive: true });
        }
        // Load existing transactions or create empty array
        let transactions = [];
        if (fs.existsSync(userTransactionsPath)) {
            transactions = JSON.parse(fs.readFileSync(userTransactionsPath, 'utf8'));
        }
        // Generate unique ID dan filename berbasis nama pelanggan
        const uniqueId = Date.now();
        const customerSlug = slugify(transaction.customerName);
        const filename = `invoice_${customerSlug}_${uniqueId}`; // tanpa .json di link
        // Add new transaction with ID, invoice number, filename, and userId
        const newTransaction = {
            ...transaction,
            id: `tr_${uniqueId}`,
            invoiceNumber: `INV-${transactions.length + 1}`,
            userId,
            filename // simpan filename tanpa .json
        };
        transactions.push(newTransaction);
        // Save transactions
        fs.writeFileSync(userTransactionsPath, JSON.stringify(transactions, null, 2));
        // Juga simpan file nota di folder invoice/userId/filename.json
        const userInvoiceDir = path.join(__dirname, 'invoice', userId);
        if (!fs.existsSync(userInvoiceDir)) {
            fs.mkdirSync(userInvoiceDir, { recursive: true });
        }
        const invoiceFilePath = path.join(userInvoiceDir, `${filename}.json`);
        fs.writeFileSync(invoiceFilePath, JSON.stringify(newTransaction, null, 2));
        res.json(newTransaction);
    } catch (error) {
        console.error('Error saving transaction:', error);
        res.status(500).json({ error: 'Gagal menyimpan transaksi' });
    }
});

app.delete('/api/transactions/:id', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const transactionId = req.params.id;
    const userTransactionsPath = path.join(__dirname, 'data', userId, 'transactions.json');
    
    try {
        if (fs.existsSync(userTransactionsPath)) {
            let transactions = JSON.parse(fs.readFileSync(userTransactionsPath, 'utf8'));
            transactions = transactions.filter(t => t.id !== transactionId);
            fs.writeFileSync(userTransactionsPath, JSON.stringify(transactions, null, 2));
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Transaksi tidak ditemukan' });
        }
    } catch (error) {
        console.error('Error deleting transaction:', error);
        res.status(500).json({ error: 'Gagal menghapus transaksi' });
    }
});

// Fungsi untuk format mata uang (jika belum ada di server di scope ini)
function formatCurrencyServer(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

// ... existing code ...
function generateWhatsAppMessage(customerName, storeName, url) {
    return 'Halo ' + customerName + 
           ', berikut adalah nota transaksi Anda dari ' + storeName + 
           ':%0A%0A' + url + '%0A%0ATerima kasih!';
}

function generateWhatsAppScript(trx, storeSettings) {
    if (!trx.customerPhone) return '';
    
    const buttonData = {
        id: 'wa-share-btn',
        phone: trx.customerPhone,
        customer: trx.customerName,
        store: storeSettings.storeName,
        style: 'margin-top:8px;padding:6px 12px;font-size:12px;background:#25d366;color:#fff;border:none;border-radius:4px;cursor:pointer;'
    };

    const buttonHtml = '<button id="' + buttonData.id + '" ' +
        'data-phone="' + buttonData.phone + '" ' +
        'data-customer="' + buttonData.customer + '" ' +
        'data-store="' + buttonData.store + '" ' +
        'style="' + buttonData.style + '">' +
        '<i class="fab fa-whatsapp"></i> Bagikan ke WhatsApp' +
        '</button>';

    const scriptHtml = '<script>' +
        'window.addEventListener("DOMContentLoaded", function() {' +
        '  var btn = document.getElementById("wa-share-btn");' +
        '  if (btn) {' +
        '    btn.onclick = function() {' +
        '      var phone = btn.dataset.phone.replace(/[^0-9]/g, "");' +
        '      if (phone.startsWith("0")) phone = "62" + phone.substring(1);' +
        '      else if (!phone.startsWith("62")) phone = "62" + phone;' +
        '      var message = "Halo " + btn.dataset.customer + ", berikut adalah nota transaksi Anda dari " + btn.dataset.store + ":%0A%0A" + window.location.href + "%0A%0ATerima kasih!";' +
        '      var waUrl = "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);' +
        '      window.open(waUrl, "_blank");' +
        '    };' +
        '  }' +
        '});' +
        '</script>';

    return buttonHtml + scriptHtml;
}
// ... existing code ...

// ... existing code ...
app.get('/invoice/:userId/:invoiceId', async (req, res) => {
    const { userId, invoiceId } = req.params;
    console.log(`Public invoice request for userId: ${userId}, invoiceId: ${invoiceId}`);

    const userTransactionsPath = path.join(__dirname, 'data', userId, 'transactions.json');
    // Ganti path ini agar membaca dari folder settings
    const userSettingsPath = path.join(__dirname, 'settings', `${userId}.json`);

    try {
        if (!fs.existsSync(userTransactionsPath)) {
            console.log(`Transactions file not found for user ${userId}`);
            return res.status(404).send('<body style="font-family: Arial, sans-serif; text-align: center; padding-top: 50px;"><h1>404 - Data Transaksi Pengguna Tidak Ditemukan</h1><p>Maaf, kami tidak dapat menemukan data transaksi untuk pengguna ini.</p></body>');
        }

        const transactionsData = fs.readFileSync(userTransactionsPath, 'utf8');
        const transactions = JSON.parse(transactionsData);
        // Cari transaksi berdasarkan id atau invoiceNumber
        const trx = transactions.find(t => t.id === invoiceId || t.invoiceNumber === invoiceId);

        if (!trx) {
            console.log(`Invoice ${invoiceId} not found for user ${userId}`);
            return res.status(404).send('<body style="font-family: Arial, sans-serif; text-align: center; padding-top: 50px;"><h1>404 - Invoice Tidak Ditemukan</h1><p>Maaf, kami tidak dapat menemukan invoice yang Anda cari.</p></body>');
        }

        let storeSettings = { 
            storeName: 'Toko Saya', 
            storeAddress: 'Alamat Toko Default', 
            storePhone: 'Telepon Toko Default',
            storeTagline: 'Tagline Default Toko Anda',
            storeFooter: 'Terima kasih telah berbelanja!',
            storeLogo: null
        };
        if (fs.existsSync(userSettingsPath)) {
            const settingsData = fs.readFileSync(userSettingsPath, 'utf8');
            const loadedSettings = JSON.parse(settingsData);
            storeSettings = { ...storeSettings, ...loadedSettings };
        }

        let itemsHtml = '';
        trx.items.forEach(item => {
            itemsHtml += `
                <tr style="border-bottom: 1px solid #e2e8f0;" class="hover:bg-gray-50">
                    <td style="padding: 12px 8px;" class="sm:px-4 text-gray-700">${item.name}</td>
                    <td style="padding: 12px 8px; text-align: center;" class="sm:px-4 text-gray-700">${item.quantity}</td>
                    <td style="padding: 12px 8px; text-align: right;" class="sm:px-4 text-gray-700">${item.price}</td>
                    <td style="padding: 12px 8px; text-align: right;" class="sm:px-4 text-gray-800 font-medium">${item.subtotal}</td>
                </tr>
            `;
        });
        
        const invoiceHtml = `
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Invoice ${trx.invoiceNumber || trx.id}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    html, body, #invoice, .container {
                        height: 100% !important;
                        min-height: 100% !important;
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                    }
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #fff !important;
                        color: #222 !important;
                        /* Default styles for A4 */
                        ${!isThermal ? `font-size: 1rem;` : ''} /* Base font size for A4 */
                    }
                    .container {
                        margin: 0 auto !important;
                        background: #fff !important;
                        /* Base styles for A4 */
                        ${!isThermal ? `
                        max-width: 900px !important; /* Slightly wider for A4 */
                        width: 96% !important; /* Use a percentage for better responsiveness */
                        padding: 2rem !important;
                        border-radius: 0.75rem !important; /* rounded-xl */
                        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important; /* shadow-lg */
                        border: 1px solid #e5e7eb !important; /* border border-gray-200 */
                        ` : ''}
                        /* Styles for Thermal 80mm */
                        ${isThermal ? `
                        width: 80mm !important;
                        max-width: 80mm !important;
                        padding: 0 !important; /* No padding for thermal */
                        font-size: 12px !important; /* Smaller font size */
                        box-shadow: none !important; /* No shadow */
                        border: none !important; /* No border */
                        border-radius: 0 !important; /* No border radius */
                        ` : ''}
                    }
                    @media print {
                        body {
                            background: none !important;
                            font-size: ${isThermal ? '12px' : '1rem'} !important;
                            color: #000 !important;
                        }
                        .container {
                            margin: 0 !important; /* No margin when printing */
                        box-shadow: none !important;
                            border: none !important;
                            padding: ${isThermal ? '0' : '0.5rem'} !important; /* Minimal padding for print */
                            width: auto !important; /* Allow width to be defined by thermal or A4 styles */
                            max-width: auto !important;
                        }
                        /* Hide print button when printing */
                        .no-print {
                            display: none !important;
                        }
                    }
                    @media (max-width: 768px) {
                        .container {
                            margin: 0 auto !important; /* Pastikan terpusat */
                            padding: ${isThermal ? '4px' : '1rem'} !important; /* Padding responsif, sedikit kurangi untuk A4 */
                            width: 100%;
                        }
                    }
                    .header {
                        text-align: center;
                        margin-bottom: ${isThermal ? '1rem' : '3rem'} !important; /* Tingkatkan margin bawah header A4 */
                        border-bottom: 1px solid #e2e8f0;
                        padding-bottom: ${isThermal ? '0.5rem' : '2rem'} !important; /* Tingkatkan padding bawah header A4 */
                    }
                    .header img {
                        max-height: ${isThermal ? '0.5rem' : '80px'} !important; /* Perbesar logo A4 */
                        margin-bottom: ${isThermal ? '0.5rem' : '1.5rem'} !important; /* Tingkatkan margin bawah logo A4 */
                    }
                    .header h1 {
                        font-size: ${isThermal ? '1.2rem' : '2.5rem'} !important; /* Perbesar font judul toko A4 */
                        font-weight: bold;
                        margin: ${isThermal ? '0.2rem' : '0.8rem'} 0 ${isThermal ? '0.1rem' : '0.6rem'} 0 !important; /* Sesuaikan margin judul toko A4 */
                    }
                    .header .tagline {
                        color: #888;
                        font-size: ${isThermal ? '0.8rem' : '1rem'} !important;
                        margin-bottom: ${isThermal ? '0.2rem' : '1rem'} !important; /* Tingkatkan margin bawah tagline A4 */
                    }
                    .header .address {
                        color: #666;
                        font-size: ${isThermal ? '0.8rem' : '0.95rem'} !important;
                    }
                    .detail-row {
                        display: flex;
                        justify-content: space-between;
                        gap: ${isThermal ? '0.5rem' : '4rem'} !important; /* Tingkatkan jarak antar kolom detail A4 */
                        margin-bottom: ${isThermal ? '1rem' : '2.5rem'} !important; /* Tingkatkan margin bawah detail row A4 */
                        flex-wrap: wrap;
                    }
                    .detail-col {
                        flex: 1 1 0;
                        min-width: ${isThermal ? 'unset' : '300px'} !important; /* Perbesar min-width kolom detail A4 */
                    }
                    .detail-label {
                        color: #888;
                        font-size: ${isThermal ? '0.8rem' : '0.9rem'} !important; /* Sedikit perkecil label A4 */
                        min-width: ${isThermal ? 'unset' : '120px'} !important; /* Sesuaikan min-width label A4 */
                        display: block;
                        margin-bottom: ${isThermal ? '1px' : '4px'} !important;
                    }
                    .detail-value {
                        font-weight: 400;
                        font-size: ${isThermal ? '0.8rem' : '1rem'} !important;
                        color: #222;
                        display: block;
                        margin-bottom: ${isThermal ? '4px' : '10px'} !important;
                    }
                    .section-title {
                        font-weight: bold;
                        font-size: ${isThermal ? '0.9rem' : '1.4rem'} !important; /* Perbesar judul section A4 */
                        margin-bottom: ${isThermal ? '0.3rem' : '1.5rem'} !important; /* Tambah margin bawah judul section A4 */
                        color: #222;
                    }
                    .table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: ${isThermal ? '1rem' : '3rem'} !important; /* Tambah margin bawah tabel A4 */
                    }
                    .table th, .table td {
                        border: 1px solid #e2e8f0;
                        padding: ${isThermal ? '4px' : '16px 12px'} !important; /* Perbesar padding sel tabel A4 */
                        text-align: left;
                    }
                    .table th {
                        background: #f8f9fa;
                        font-weight: 600;
                        color: #444;
                    }
                    .table td {
                        color: #333;
                    }
                    .total-row td {
                        font-weight: bold;
                        font-size: ${isThermal ? '0.9rem' : '1.4rem'} !important; /* Perbesar font total A4 */
                        background: #f8f9fa;
                        padding: ${isThermal ? '4px' : '16px 12px'} !important; /* Sesuaikan padding sel total A4 */
                    }
                    .footer {
                        text-align: center;
                        margin-top: ${isThermal ? '1.5rem' : '5rem'} !important; /* Tambah margin atas footer A4 */
                        color: #888;
                        font-size: ${isThermal ? '0.8rem' : '1rem'} !important;
                        border-top: 1px dashed #e2e8f0;
                        padding-top: ${isThermal ? '1rem' : '2.5rem'} !important; /* Tambah padding atas footer A4 */
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    ${store.paperLayout === 'A4' ? `
                    <div class="header" style="margin-bottom: 1.5rem; padding-bottom: 1rem;">
                        ${store.storeLogo ? `<img src="${store.storeLogo}" alt="Logo" style="max-height: 60px; margin-bottom: 0.5rem;">` : ''}
                        <h1 style="margin: 0.3rem 0;">${store.storeName}</h1>
                        ${store.storeTagline ? `<p class="tagline" style="margin: 0.2rem 0;">${store.storeTagline}</p>` : ''}
                        <div class="contact" style="margin-top: 0.5rem;">
                            <p style="margin: 0.1rem 0;">${store.storeAddress}</p>
                            <p style="margin: 0.1rem 0;">Telp: ${store.storePhone}</p>
                            ${store.storeEmail ? `<p style="margin: 0.1rem 0;">Email: ${store.storeEmail}</p>` : ''}
                    </div>
                            </div>
                    <!-- Layout A4 -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 1rem; padding: 0 2rem;">
                        <div style="text-align: left;">
                            <p style="color: #666; font-size: 0.9rem; margin-bottom: 0.1rem;">No. Invoice:</p>
                            <p style="font-weight: 500; margin-bottom: 0.5rem;">${invoice.invoiceNumber}</p>
                            <p style="color: #666; font-size: 0.9rem; margin-bottom: 0.1rem;">Tanggal:</p>
                            <p style="font-weight: 500; margin-bottom: 0.5rem;">${new Date(invoice.date).toLocaleDateString('id-ID', {day: '2-digit', month: '2-digit', year: 'numeric'})}</p>
                            <p style="color: #666; font-size: 0.9rem; margin-bottom: 0.1rem;">Waktu:</p>
                            <p style="font-weight: 500;">${new Date(invoice.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</p>
                            </div>
                        <div style="text-align: right;">
                            <p style="color: #666; font-size: 0.9rem; margin-bottom: 0.1rem;">Nama:</p>
                            <p style="font-weight: 500; margin-bottom: 0.5rem;">${invoice.customerName}</p>
                            <p style="color: #666; font-size: 0.9rem; margin-bottom: 0.1rem;">Telp:</p>
                            <p style="font-weight: 500; margin-bottom: 0.5rem;">${invoice.customerPhone}</p>
                            <p style="color: #666; font-size: 0.9rem; margin-bottom: 0.1rem;">Alamat:</p>
                            <p style="font-weight: 500;">${invoice.customerAddress}</p>
                        </div>
                            </div>
                    <table class="items-table" style="margin-top: 0.5rem;">
                        <thead>
                            <tr>
                                <th style="background: #f8fafc; padding: 1rem; text-align: left; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0;">Produk</th>
                                <th style="background: #f8fafc; padding: 1rem; text-align: center; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0;">Qty</th>
                                <th style="background: #f8fafc; padding: 1rem; text-align: right; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0;">Harga Satuan</th>
                                <th style="background: #f8fafc; padding: 1rem; text-align: right; font-weight: 600; color: #475569; border-bottom: 2px solid #e2e8f0;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(invoice.items || []).map(item => `
                                <tr style="background-color: #f8fafc;">
                                    <td style="padding: 1rem; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${item.name}</td>
                                    <td style="padding: 1rem; text-align: center; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${item.quantity}</td>
                                    <td style="padding: 1rem; text-align: right; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${formatRupiah(item.price)}</td>
                                    <td style="padding: 1rem; text-align: right; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${formatRupiah(item.subtotal)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div style="display: flex; justify-content: flex-end; margin-top: 2rem;">
                        <div style="width: 300px; background: #f8fafc; padding: 1.5rem; border-radius: 0.5rem;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <span style="color: #475569;">Total:</span>
                                <span style="font-weight: 700; color: #0f172a;">${formatRupiah(invoice.total)}</span>
                            </div>
                        </div>
                    </div>
                    ${invoice.notes ? `
                        <div class="notes">
                            <h3>Catatan</h3>
                            <p>${invoice.notes}</p>
                                </div>
                            ` : ''}
                    <div class="footer">
                        <p>${store.storeFooter}</p>
                    </div>
                    ` : `
                    <!-- Layout Thermal 80mm SEDERHANA -->
                    <div style="width: 80mm; margin: 0 auto; font-size: 12px;">
                        <div style="text-align: center; margin-bottom: 4px;">
                            ${store.storeLogo ? `<img src="${store.storeLogo}" alt="Logo" style="max-height: 32px; margin-bottom: 4px;">` : ''}
                            <div style="font-size: 13px; font-weight: bold; margin-bottom: 1px;">${store.storeName}</div>
                            <div style="font-size: 11px; color: #444; margin-bottom: 1px;">${store.storeAddress}</div>
                            <div style="display: flex; justify-content: center; gap: 6px; font-size: 11px; color: #444; margin-bottom: 2px;">
                                <span>Telp: ${store.storePhone}</span>
                                ${store.storeEmail ? `<span>Email: ${store.storeEmail}</span>` : ''}
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <div>
                                <span style='font-size:11px;color:#666;'>No. Invoice:</span><br>
                                <span style='font-weight:500;'>${invoice.invoiceNumber}</span>
                                </div>
                            <div style="text-align: right;">
                                <span style='font-size:11px;color:#666;'>Nama:</span><br>
                                <span style='font-weight:500;'>${invoice.customerName}</span>
                        </div>
                    </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <div>
                                <span style='font-size:11px;color:#666;'>Waktu:</span><br>
                                <span style='font-weight:500;'>${new Date(invoice.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                            <div style="text-align: right;">
                                <span style='font-size:11px;color:#666;'>Telp:</span><br>
                                <span style='font-weight:500;'>${invoice.customerPhone}</span>
                            </div>
                            </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                            <div>
                                <span style='font-size:11px;color:#666;'>Tanggal:</span><br>
                                <span style='font-weight:500;'>${new Date(invoice.date).toLocaleDateString('id-ID', {day: '2-digit', month: '2-digit', year: 'numeric'})}</span>
                        </div>
                            <div style="text-align: right;">
                                <span style='font-size:11px;color:#666;'>Alamat:</span><br>
                                <span style='font-weight:500;'>${invoice.customerAddress}</span>
                    </div>
                        </div>
                        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin: 8px 0;">
                            <div style="display: flex; font-size: 11px; font-weight: bold; margin-bottom: 4px;">
                                <span style="flex:2;">Produk</span>
                                <span style="flex:1;text-align:center;">Qty</span>
                                <span style="flex:1;text-align:right;">Total</span>
                    </div>
                            ${(invoice.items || []).map(item => `
                                <div style="display: flex; font-size: 11px; margin: 2px 0;">
                                    <span style="flex:2;">${item.name}</span>
                                    <span style="flex:1;text-align:center;">${item.quantity}</span>
                                    <span style="flex:1;text-align:right;">${formatRupiah(item.subtotal)}</span>
                        </div>
                            `).join('')}
                </div>
                        <div style="margin-top:8px; font-size:12px; text-align:right;">
                            <span style='font-size:11px;color:#666;'>Total:</span><br>
                            <span style='font-weight:700;'>${formatRupiah(invoice.total)}</span>
                        </div>
                        <div style="text-align: center; font-size: 11px; margin-top: 12px;">${store.storeFooter}</div>
                    </div>
                    `}
                </div>
            </body>
            </html>
        `;
        res.send(invoiceHtml);

    } catch (error) {
        console.error('Error generating public invoice:', error);
        res.status(500).send('<body style="font-family: Arial, sans-serif; text-align: center; padding-top: 50px;"><h1>500 - Terjadi Kesalahan Internal</h1><p>Maaf, kami tidak dapat menampilkan invoice saat ini. Silakan coba lagi nanti.</p></body>');
    }
}); 

// Endpoint untuk update transaksi berdasarkan filename (PUT)
app.put('/api/transactions/:filename', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    const filename = req.params.filename.replace('.json', '');
    const userTransactionsPath = path.join(__dirname, 'data', userId, 'transactions.json');
    const invoiceFilePath = path.join(__dirname, 'invoice', userId, `${filename}.json`);
    const updatedData = req.body;

    try {
        // Update di file array transaksi
        let transactions = [];
        if (fs.existsSync(userTransactionsPath)) {
            transactions = JSON.parse(fs.readFileSync(userTransactionsPath, 'utf8'));
            const idx = transactions.findIndex(t => t.filename === filename);
            if (idx !== -1) {
                transactions[idx] = { ...transactions[idx], ...updatedData };
                fs.writeFileSync(userTransactionsPath, JSON.stringify(transactions, null, 2));
            }
        }
        // Update file nota per transaksi
        if (fs.existsSync(invoiceFilePath)) {
            fs.writeFileSync(invoiceFilePath, JSON.stringify(updatedData, null, 2));
        }
        res.json({ success: true, message: 'Transaksi berhasil diupdate' });
    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({ error: 'Gagal mengupdate transaksi' });
    }
}); 