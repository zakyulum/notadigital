// Remove all localStorage related code
const STORAGE_KEYS = {
    PRODUCTS: 'pos_products',
    TRANSACTIONS: 'pos_transactions',
    SETTINGS: 'pos_settings',
    INVOICE_COUNTER: 'pos_invoice_counter'
};

// API Base URL
const API_BASE_URL = 'http://localhost:3002';

// Authentication State
let isLoggedIn = false;
let authToken = null;
let currentUser = null;

// Global settings object
let settings = {};

// Global products and transactions arrays
let products = [];
let transactions = [];
let invoiceCounter = 1; // Tambahkan deklarasi invoiceCounter

// Variable to hold the transaction being edited
let editingTransactionId = null;

// Variable to hold the transaction being viewed (for WhatsApp/Copy link in modal)
let viewingTransaction = null;

// Chart instance for monthly sales
let monthlySalesChartInstance = null;

// Initialize elements
const elements = {
    // Login/Register elements
    loginModal: document.getElementById('login-modal'),
    loginForm: document.getElementById('login-form-modal'),
    registerFormContainer: document.getElementById('register-form-container'),
    registerForm: document.getElementById('register-form-modal'),
    toggleFormsButton: document.getElementById('toggle-forms-btn'),
    loginUsernameInput: document.getElementById('login-username-modal'),
    loginPasswordInput: document.getElementById('login-password-modal'),
    registerUsernameInput: document.getElementById('register-username-modal'),
    registerPasswordInput: document.getElementById('register-password-modal'),
    registerConfirmPasswordInput: document.getElementById('register-confirm-password-modal'),
    loginErrorDisplay: document.getElementById('login-error-modal'),
    registerErrorDisplay: document.getElementById('register-error-modal'),
    initialView: document.getElementById('initial-view'),
    showLoginBtn: document.getElementById('show-login-btn'),
    showRegisterBtn: document.getElementById('show-register-btn'),

    // Settings elements
    storeName: document.getElementById('store-name'),
    storeAddress: document.getElementById('store-address'),
    storePhone: document.getElementById('store-phone'),
    storeEmail: document.getElementById('store-email'),
    storeFooter: document.getElementById('store-footer'),
    storeTagline: document.getElementById('store-tagline'),
    whatsappMessageTemplate: document.getElementById('whatsapp-message-template'),
    storeLogoInput: document.getElementById('store-logo'),
    logoPreview: document.getElementById('logo-preview'),
    logoPlaceholder: document.getElementById('logo-placeholder'),
    storeNameSidebar: document.getElementById('store-name-sidebar'),
    storeAddressSidebar: document.getElementById('store-address-sidebar'),

    // Product elements
    productItems: document.getElementById('product-items'),
    productsEmpty: document.getElementById('products-empty'),
    productSearchInput: document.getElementById('product-search'),
    productSuggestions: document.getElementById('product-suggestions'),
    selectedProductId: document.getElementById('selected-product-id'),
    selectedProductPrice: document.getElementById('selected-product-price'),
    productQuantity: document.getElementById('product-quantity'),
    productPrice: document.getElementById('product-price'),
    productSubtotal: document.getElementById('product-subtotal'),
    addProduct: document.getElementById('add-product'),
    orderItems: document.getElementById('order-items'),
    orderTotal: document.getElementById('order-total'),

    // Transaction elements
    historyItems: document.getElementById('history-items'),
    historyEmpty: document.getElementById('history-empty'),
    invoiceNumber: document.getElementById('invoice-number'),
    customerName: document.getElementById('customer-name'),
    customerPhone: document.getElementById('customer-phone'),
    customerAddress: document.getElementById('customer-address'),
    orderNotes: document.getElementById('order-notes'),
    notaContainer: document.getElementById('nota-container'),
    notaContent: document.getElementById('nota-content'),

    // Toast elements
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message'),

    // Mobile menu elements
    sidebar: document.getElementById('sidebar'),
    overlay: document.getElementById('overlay'),

    // Change password elements
    changePasswordModal: document.getElementById('change-password-modal'),
    changePasswordForm: document.getElementById('change-password-form'),
    currentPasswordInput: document.getElementById('current-password'),
    newPasswordInput: document.getElementById('new-password'),
    confirmNewPasswordInput: document.getElementById('confirm-new-password'),
    changePasswordErrorDisplay: document.getElementById('change-password-error'),
    showChangePasswordModalBtn: document.getElementById('show-change-password-modal'),
    closeChangePasswordModalBtn: document.getElementById('close-change-password-modal'),

    // Edit transaction elements
    editProductSuggestions: document.getElementById('edit-product-suggestions'),
    editSelectedProductId: document.getElementById('edit-selected-product-id'),
    editSelectedProductPrice: document.getElementById('edit-selected-product-price'),
    editProductQuantity: document.getElementById('edit-product-quantity'),
    editProductPrice: document.getElementById('edit-product-price'),
    editProductSubtotal: document.getElementById('edit-product-subtotal'),
    editOrderItems: document.getElementById('edit-order-items'),
    editOrderTotal: document.getElementById('edit-order-total'),
    editCustomerName: document.getElementById('edit-customer-name'),
    editCustomerPhone: document.getElementById('edit-customer-phone'),
    editCustomerAddress: document.getElementById('edit-customer-address'),
    editOrderNotes: document.getElementById('edit-order-notes'),
    transactionModal: document.getElementById('transaction-modal'),
    deleteMessage: document.getElementById('delete-message'),
    confirmDelete: document.getElementById('confirm-delete'),
    deleteModal: document.getElementById('delete-modal'),

    // Edit product search input
    editProductSearchInput: document.getElementById('edit-product-search'),

    // Tambahkan elemen process order button
    processOrderBtn: document.querySelector('#process-order-btn, button[onclick="processOrder()"]'),

    // Order form
    orderForm: document.getElementById('order-form'),
};

// Helper function to format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

// Helper function to generate unique ID
function generateId(prefix = '') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Helper function to parse currency to float
function parseCurrencyToFloat(currencyString) {
    return parseFloat(currencyString.replace(/[^0-9.-]/g, ''));
}

// Helper function to save products to server
async function saveProducts(productData) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/products`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(productData)
        });

        if (!response.ok) {
            throw new Error('Gagal menyimpan produk ke server');
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error saving products:', error);
        throw error;
    }
}

// Helper function to load products from server
async function loadProducts() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/products`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Gagal memuat data produk dari server');
        }

        const data = await response.json();
        products = data;
        updateProductsDisplay();
    } catch (error) {
        console.error('Error loading products:', error);
        showToast('Gagal memuat data produk', 'error');
    }
}

// Helper function to save transactions to localStorage
function saveTransactions() {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
}

// Helper function to save settings to localStorage
function saveSettings() {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

// Helper function to save invoice counter to localStorage
function saveInvoiceCounter() {
    localStorage.setItem(STORAGE_KEYS.INVOICE_COUNTER, invoiceCounter.toString());
}

// Helper function to load transactions from localStorage
function loadTransactions() {
    const storedTransactions = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (storedTransactions) {
        transactions = JSON.parse(storedTransactions);
    }
}

// Helper function to load settings from localStorage
function loadSettings() {
    const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (storedSettings) {
        settings = JSON.parse(storedSettings);
    }
}

// Helper function to load invoice counter from localStorage
function loadInvoiceCounter() {
    const storedInvoiceCounter = localStorage.getItem(STORAGE_KEYS.INVOICE_COUNTER);
    if (storedInvoiceCounter) {
        invoiceCounter = parseInt(storedInvoiceCounter);
    }
}

// Function to add a product to the current order
function addProductToOrder() {
    console.log('Adding product to order...');
    console.log('Selected product ID:', elements.selectedProductId.value);
    console.log('Selected product price:', elements.selectedProductPrice.value);

    // Only proceed if a product is selected and quantity is valid
    if (elements.addProduct.disabled) {
        showToast('Pilih produk terlebih dahulu!', 'warning');
        return;
    }

    const productId = elements.selectedProductId.value;
    // Find the product object to get the correct name and price
    const product = products.find(p => p.id === productId);

    if (!product) {
        console.error('Product not found in products array for ID:', productId);
        showToast('Produk tidak ditemukan dalam daftar.', 'error');
        // Optionally clear selection
        elements.productSearchInput.value = '';
        elements.selectedProductId.value = '';
        elements.selectedProductPrice.value = '';
        elements.productPrice.textContent = formatCurrency(0);
        elements.productSubtotal.textContent = formatCurrency(0);
        elements.addProduct.disabled = true;
        return;
    }

    const productName = product.name;
    const productPrice = parseFloat(elements.selectedProductPrice.value);
    const quantity = parseInt(elements.productQuantity.value);

    if (isNaN(quantity) || quantity <= 0) {
        showToast('Mohon masukkan jumlah yang valid.', 'error');
        elements.productQuantity.value = '1';
        updateProductPrice();
        return;
    }

    // Check stock if available
    if (product.stock !== undefined && product.stock < quantity) {
        showToast(`Stok tidak mencukupi. Tersedia: ${product.stock}`, 'error');
        return;
    }

    const subtotal = productPrice * quantity;

    // Check if product already exists in the order items table
    let existingItemRow = null;
    elements.orderItems.querySelectorAll('tr').forEach(row => {
        if (row.dataset.productId === productId) {
            existingItemRow = row;
        }
    });

    if (existingItemRow) {
        // Update existing item
        const currentQty = parseInt(existingItemRow.cells[1].textContent);
        const newQty = currentQty + quantity;
        
        // Check stock for accumulated quantity
        if (product.stock !== undefined && product.stock < newQty) {
            showToast(`Stok tidak mencukupi untuk menambah jumlah. Tersedia: ${product.stock}`, 'error');
            return;
        }
        
        existingItemRow.cells[1].textContent = newQty;
        existingItemRow.cells[2].textContent = formatCurrency(productPrice * newQty);
        existingItemRow.dataset.productPrice = productPrice;
    } else {
        // Add new item
        const newRow = document.createElement('tr');
        newRow.dataset.productId = productId;
        newRow.dataset.productPrice = productPrice;
        newRow.innerHTML = `
            <td class="px-4 py-2">
                <div class="font-medium">${productName}</div>
                <div class="text-sm text-gray-500">${formatCurrency(productPrice)}</div>
            </td>
            <td class="px-4 py-2 text-center">${quantity}</td>
            <td class="px-4 py-2 text-right">${formatCurrency(subtotal)}</td>
            <td class="px-4 py-2 text-center">
                <button class="text-red-500 hover:text-red-700" onclick="removeOrderItem(this)">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        elements.orderItems.appendChild(newRow);
    }

    // Update total
    updateOrderTotal();

    // Reset product selection but keep suggestions visible if there's input
    const currentSearchValue = elements.productSearchInput.value;
    elements.selectedProductId.value = '';
    elements.selectedProductPrice.value = '';
    elements.productQuantity.value = '1';
    elements.productPrice.textContent = formatCurrency(0);
    elements.productSubtotal.textContent = formatCurrency(0);
    elements.addProduct.disabled = true;
    
    // Clear search input and trigger input event to show suggestions
    elements.productSearchInput.value = '';
    elements.productSearchInput.focus();
    
    showToast('Produk ditambahkan ke pesanan!');
}

// Function to remove an item from the order
function removeOrderItem(buttonElement) {
    const row = buttonElement.closest('tr');
    if (row) {
        console.log('Removing item from order:', row.querySelector('td:first-child div:first-child').textContent);
        row.remove();
        updateOrderTotal();
        showToast('Produk dihapus dari pesanan!');
    }
}

// Function to update the total of the current order
function updateOrderTotal() {
    console.log('Updating order total...');
    let total = 0;
    
    // Ambil semua baris pesanan
    const orderRows = elements.orderItems.querySelectorAll('tr');
    
    orderRows.forEach(row => {
        // Ambil harga per item dari data-product-price
        const price = parseFloat(row.dataset.productPrice) || 0;
        // Ambil quantity dari kolom kedua
        const quantity = parseInt(row.querySelector('td:nth-child(2)').textContent) || 0;
        // Hitung subtotal
        const subtotal = price * quantity;
        
        console.log('Row calculation:', {
            price: price,
            quantity: quantity,
            subtotal: subtotal
        });
        
        total += subtotal;
    });
    
    console.log('Final total:', total);
    elements.orderTotal.textContent = formatCurrency(total);
}

// Function to reset the current order form
function resetOrder() {
    console.log('Resetting order...');
    elements.customerName.value = '';
    elements.customerPhone.value = '';
    elements.customerAddress.value = '';
    elements.orderNotes.value = '';
    elements.orderItems.innerHTML = '';
    updateOrderTotal();
    elements.productSearchInput.value = '';
    elements.selectedProductId.value = '';
    elements.selectedProductPrice.value = '';
    elements.productQuantity.value = '1';
    elements.productPrice.textContent = formatCurrency(0);
    elements.productSubtotal.textContent = formatCurrency(0);
    elements.addProduct.disabled = true;
    elements.productSuggestions.classList.add('hidden');
    showToast('Pesanan direset!', 'info');

    // Sembunyikan juga preview invoice jika ada
    const previewSectionElement = document.getElementById('invoice-preview-section');
    if (previewSectionElement) {
        previewSectionElement.classList.add('hidden');
        const previewContentElement = document.getElementById('invoice-preview-content');
        if (previewContentElement) {
            previewContentElement.innerHTML = '<p class="text-gray-500 text-center py-4">Invoice akan ditampilkan di sini setelah pesanan diproses.</p>';
        }
    }

    // ... existing code ...
    if (elements.invoiceNumber) {
        elements.invoiceNumber.textContent = `No. Invoice: ${getNextInvoiceNumber()}`;
    }
    // ... existing code ...
}

// Function to update product price and subtotal based on quantity
function updateProductPrice() {
    const price = parseFloat(elements.selectedProductPrice.value) || 0;
    const quantity = parseInt(elements.productQuantity.value) || 0;
    const subtotal = price * quantity;

    elements.productPrice.textContent = formatCurrency(price);
    elements.productSubtotal.textContent = formatCurrency(subtotal);
}

// Function to filter products based on search term
function filterProducts(searchTerm, suggestionsElement, selectedIdElement, selectedPriceElement, quantityElement, priceElement, subtotalElement, addButton) {
    console.log('Filtering products with term:', searchTerm);
    
    if (!suggestionsElement) {
        console.warn('Missing suggestionsElement parameter for filterProducts');
        return;
    }

    const ul = suggestionsElement.querySelector('ul');
    if (!ul) {
        console.warn('No ul element found in suggestionsElement');
        return;
    }

    ul.innerHTML = ''; // Clear previous suggestions

    const searchTermLower = searchTerm.toLowerCase().trim();
    if (!searchTermLower) {
        ul.classList.add('hidden');
        suggestionsElement.classList.add('hidden'); // Sembunyikan DIV juga
        return;
    }

    // Show suggestions container and UL
    suggestionsElement.classList.remove('hidden'); // Pastikan DIV terlihat
    ul.classList.remove('hidden');                 // Pastikan UL terlihat
    // Kelas styling lain untuk UL sudah ada dari HTML (e.g., absolute, z-10, dll.)

    const filteredProducts = products.filter(product => 
        product.name.toLowerCase().includes(searchTermLower)
    );

    console.log('Filtered products:', filteredProducts);

    if (filteredProducts.length > 0) {
        filteredProducts.forEach(product => {
            const li = document.createElement('li');
            li.className = 'px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 flex justify-between items-center';
            li.dataset.productName = product.name; // Tambahkan data-name
            const productInfo = document.createElement('div');
            productInfo.className = 'flex flex-col';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'font-medium text-gray-700';
            nameSpan.textContent = product.name;
            const stockSpan = document.createElement('span');
            stockSpan.className = 'text-sm text-gray-500';
            stockSpan.textContent = `Stok: ${product.stock || 0}`;
            productInfo.appendChild(nameSpan);
            productInfo.appendChild(stockSpan);
            const priceSpan = document.createElement('span');
            priceSpan.className = 'text-blue-600 font-medium';
            priceSpan.textContent = formatCurrency(product.price);
            li.appendChild(productInfo);
            li.appendChild(priceSpan);
            li.onclick = () => {
                console.log('Product selected:', product);
                if (selectedIdElement) selectedIdElement.value = product.id;
                if (selectedPriceElement) selectedPriceElement.value = product.price;
                if (quantityElement) quantityElement.value = '1';
                if (priceElement) priceElement.textContent = formatCurrency(product.price);
                if (subtotalElement) subtotalElement.textContent = formatCurrency(product.price);
                if (addButton) addButton.disabled = false;
                // Isi nama produk ke input
                if (selectedIdElement && selectedIdElement.id === 'edit-selected-product-id') {
                    const searchInput = document.getElementById('edit-product-search');
                if (searchInput) searchInput.value = product.name;
                } else {
                    const searchInput = document.querySelector('#product-search');
                    if (searchInput) searchInput.value = product.name;
                }
                ul.innerHTML = '';
                ul.classList.add('hidden');
                suggestionsElement.classList.add('hidden');
            };
            ul.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.className = 'px-4 py-2 text-gray-500 text-center';
        li.textContent = 'Tidak ada produk yang ditemukan';
        ul.appendChild(li);
    }
    // Listener klik di luar sudah ada di setupEventListeners, jadi tidak perlu duplikasi di sini.
}

// Function to update price and subtotal from inputs (used in edit modal)
function updatePriceAndSubtotalFromInputs(selectedIdElement, selectedPriceElement, quantityElement, priceElement, subtotalElement) {
    const price = parseFloat(selectedPriceElement.value) || 0;
    const quantity = parseInt(quantityElement.value) || 0;
    const subtotal = price * quantity;

    priceElement.textContent = formatCurrency(price);
    subtotalElement.textContent = formatCurrency(subtotal);
}

// Add default settings before loading from server
function initDefaultSettings() {
    settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS)) || {
        storeName: 'Toko Saya',
        storeAddress: 'Jl. Contoh No. 123',
        storePhone: '08123456789',
        storeEmail: 'toko@example.com',
        storeFooter: 'Terima kasih telah berbelanja di toko kami!',
        storeLogo: null,
        storeTagline: 'Jual Eceran Harga Grosir',
        whatsappMessageTemplate: 'Halo {{customerName}}, berikut adalah nota transaksi Anda dari {{storeName}}:\n\n{{notaLink}}\n\nTerima kasih!'
    };
    console.log('Initial settings (from localStorage or defaults):', settings);
}

// Add sample products (if none exist)
function addSampleProducts() {
    const sampleProducts = [
        { id: generateId('p'), name: 'Produk Contoh 1', price: 10000, description: 'Deskripsi produk contoh 1' },
        { id: generateId('p'), name: 'Produk Contoh 2', price: 15000, description: 'Deskripsi produk contoh 2' },
        { id: generateId('p'), name: 'Produk Contoh 3', price: 20000, description: 'Deskripsi produk contoh 3' },
    ];
    products = sampleProducts;
    saveProducts(products); // Save sample products to localStorage
    console.log('Sample products added:', products);
}

// Function to handle login
async function handleLogin(event) {
    event.preventDefault();
    console.log('Handle login dipanggil');
    
    // Ambil nilai dari form yang benar (bukan modal)
    console.log('Mencari elemen form login...'); // Tambahkan console log ini
    const usernameInput = document.querySelector('#initial-view input[type="text"]');
    // Ganti selector untuk password agar mencari berdasarkan ID
    const passwordInput = document.querySelector('#login-password'); // Diperbarui untuk mencari berdasarkan ID
    console.log('Hasil pencarian usernameInput:', usernameInput); // Tambahkan console log ini
    console.log('Hasil pencarian passwordInput:', passwordInput); // Tambahkan console log ini
    
    if (!usernameInput || !passwordInput) {
        console.error('Form elements not found');
        showToast('Terjadi kesalahan pada form login', 'error');
        return;
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    try {
        // Validasi input
        if (!username || !password) {
            throw new Error('Username dan password harus diisi');
        }

        console.log('Mencoba login dengan username:', username);
        
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Gagal melakukan login');
        }

        // Save token and user data
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify({
            userId: data.userId,
            username: data.username,
            role: data.role
        }));

        // Update auth state
        isLoggedIn = true;
        authToken = data.token;
        currentUser = {
            userId: data.userId,
            username: data.username,
            role: data.role
        };

        // Hide initial view and show app content
        if (elements.initialView) {
            elements.initialView.style.display = 'none';
        }
        
        const appContent = document.getElementById('app-content');
        if (appContent) {
            appContent.classList.remove('hidden');
            appContent.style.display = 'block';
        }

        // Load user data and show success message
        await loadUserData();
        showToast('Login berhasil!', 'success');

    } catch (error) {
        console.error('Login error:', error);
        showToast(error.message, 'error');
        
        // Reset password field
        if (passwordInput) {
            passwordInput.value = '';
        }
    }
}

// Function to check login status
async function checkLoginStatusAndUpdateUI() {
    console.log('Checking login status...');

    // Sembunyikan tombol menu toggle di awal loading
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.classList.add('hidden');
    }

    try {
        // Get token from localStorage
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('currentUser');

        if (!token) {
            console.log('No token found, showing login view');
            showLoginView();
            return;
        }

        // Verify token with server
        const response = await fetch(`${API_BASE_URL}/api/verify-token`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok || !data.valid) {
            throw new Error('Token invalid');
        }

        // Token is valid, update auth state
        isLoggedIn = true;
        authToken = token;
        currentUser = storedUser ? JSON.parse(storedUser) : data.user;

        // Show app content
        showAppView();
        
        // Load user data
        await loadUserData();

        console.log('Login status: authenticated');

    } catch (error) {
        console.error('Token verification failed:', error);
        // Clear invalid token
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        showLoginView();
        console.log('Login status: unauthenticated');
    }
}

// Helper function to show login view
function showLoginView() {
    if (elements.initialView) {
        elements.initialView.classList.remove('hidden');
        elements.initialView.style.display = 'flex';
    }
    if (document.getElementById('app-content')) {
        document.getElementById('app-content').classList.add('hidden');
    }
    hideLoginModal(); // Hide login modal if it's open
    // Tambahkan class login-active ke body saat tampilan login
    document.body.classList.add('login-active');
}

// Helper function to show app view
function showAppView() {
    if (elements.initialView) {
        elements.initialView.classList.add('hidden');
    }
    const appContent = document.getElementById('app-content');
    if (appContent) {
        appContent.classList.remove('hidden');
        appContent.style.display = 'block';
    }
    hideLoginModal(); // Hide login modal if it's open
    // Hapus class login-active dari body saat tampilan app
    document.body.classList.remove('login-active');
}

// Helper function to show loading indicator
function showLoadingIndicator() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.classList.remove('hidden');
    }
    console.log("Showing loading indicator...");
}

// Helper function to hide loading indicator
function hideLoadingIndicator() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.classList.add('hidden');
    }
    console.log("Hiding loading indicator...");
}

// Function to load user data
async function loadUserData() {
    showLoadingIndicator();
    try {
        console.log('Starting to load user data in parallel...');
        
        // Buat array promises untuk semua request
        const requests = [
            fetch(`${API_BASE_URL}/api/get-settings`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }).then(res => res.ok ? res.json() : Promise.reject(new Error('Failed to load settings'))),
            
            fetch(`${API_BASE_URL}/api/products`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }).then(res => res.ok ? res.json() : Promise.reject(new Error('Failed to load products'))),
            
            fetch(`${API_BASE_URL}/api/list-invoice`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            }).then(res => res.ok ? res.json() : Promise.reject(new Error('Failed to load transactions')))
        ];

        // Jalankan semua request secara paralel
        const [settingsResult, productsResult, transactionsResult] = await Promise.allSettled(requests);

        console.log('API calls settled.');

        // Proses hasil settings
        if (settingsResult.status === 'fulfilled') {
            settings = settingsResult.value;
            updateSettingsDisplay();
            console.log('Settings loaded and UI updated.');
        } else {
            console.error('Error loading settings:', settingsResult.reason);
            showToast('Gagal memuat pengaturan', 'error');
        }

        // Proses hasil products
        if (productsResult.status === 'fulfilled') {
            products = productsResult.value;
            updateProductsDisplay();
            console.log('Products loaded and UI updated.');
        } else {
            console.error('Error loading products:', productsResult.reason);
            showToast('Gagal memuat data produk', 'error');
        }

        // Proses hasil transactions
        if (transactionsResult.status === 'fulfilled') {
            transactions = transactionsResult.value;
            updateTransactionHistory();
            updateMonthlySalesChart();
            console.log('Transactions loaded and UI updated.');
        } else {
            console.error('Error loading transaction history:', transactionsResult.reason);
            showToast('Gagal memuat riwayat transaksi', 'error');
        }

    } catch (error) {
        console.error('Unexpected error loading user data:', error);
        showToast('Gagal memuat semua data pengguna', 'error');
    } finally {
        hideLoadingIndicator();
        console.log('Finished loading user data attempt.');
    }
}

// Function to update settings display
function updateSettingsDisplay() {
    if (settings) {
        elements.storeName.value = settings.storeName || '';
        elements.storeAddress.value = settings.storeAddress || '';
        elements.storePhone.value = settings.storePhone || '';
        elements.storeEmail.value = settings.storeEmail || '';
        elements.storeFooter.value = settings.storeFooter || '';
        elements.storeTagline.value = settings.storeTagline || '';
        elements.whatsappMessageTemplate.value = settings.whatsappMessageTemplate || '';
        
        // Update sidebar
        elements.storeNameSidebar.textContent = settings.storeName || 'Toko Saya';
        elements.storeAddressSidebar.textContent = settings.storeAddress || 'Jl. Contoh No. 123';
        
        // Update logo preview if exists
        if (settings.storeLogo) {
            elements.logoPreview.src = settings.storeLogo;
            elements.logoPreview.classList.remove('hidden');
            elements.logoPlaceholder.classList.add('hidden');
        }
        // Tampilkan pilihan layout kertas jika ada elemen
        const paperLayoutSelect = document.getElementById('paper-layout');
        if (paperLayoutSelect) {
            paperLayoutSelect.value = settings.paperLayout || 'A4';
        }
    }
}

// Helper function to save settings to server
async function saveSettings(settingsData) {
    try {
        // Ambil nilai paperLayout dari select element
        const paperLayoutSelect = document.getElementById('paper-layout');
        if (paperLayoutSelect) {
            settingsData.paperLayout = paperLayoutSelect.value;
            console.log('Saving paper layout:', settingsData.paperLayout);
        }

        const response = await fetch(`${API_BASE_URL}/api/settings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(settingsData)
        });

        if (!response.ok) {
            throw new Error('Gagal menyimpan pengaturan ke server');
        }

        const result = await response.json();
        settings = result;
        updateSettingsDisplay();
        showToast('Pengaturan berhasil disimpan', 'success');
        return result;
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast('Gagal menyimpan pengaturan', 'error');
        throw error;
    }
}

// Helper function to load settings from server
async function loadSettings() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/settings`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Gagal memuat pengaturan dari server');
        }

        const data = await response.json();
        settings = data;
        updateSettingsDisplay();
    } catch (error) {
        console.error('Error loading settings:', error);
        showToast('Gagal memuat pengaturan', 'error');
    }
}

// Helper function to load transactions from server
async function loadTransactionHistory() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/list-invoice`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Gagal memuat riwayat transaksi dari server');
        }

        const data = await response.json();
        transactions = (data || []).filter(t => t && t.id && t.filename); // hanya transaksi valid
        updateTransactionHistory();
        updateMonthlySalesChart(); // Tambahkan ini
    } catch (error) {
        console.error('Error loading transaction history:', error);
        showToast('Gagal memuat riwayat transaksi', 'error');
    }
}

// Function to adjust iframe height (sinkron tinggi section dengan nota, tunggu gambar selesai load)
function adjustIframeHeight(iframe) {
    function setHeight() {
        try {
            const doc = iframe.contentWindow.document;
            const bodyHeight = doc.body.scrollHeight;
            const htmlHeight = doc.documentElement.scrollHeight;
            const height = Math.max(bodyHeight, htmlHeight);
            iframe.style.height = height + 'px';
            iframe.style.minHeight = '600px';
            iframe.style.maxHeight = '90vh';
        } catch (e) {}
    }
    iframe.onload = function() {
        setHeight();
        // Jika ada gambar di dalam nota, tunggu semua gambar selesai load
        try {
            const doc = iframe.contentWindow.document;
            const images = doc.images;
            let loaded = 0;
            if (images.length === 0) setHeight();
            for (let img of images) {
                if (img.complete) {
                    loaded++;
                } else {
                    img.onload = img.onerror = function() {
                        loaded++;
                        if (loaded === images.length) setHeight();
                    };
                }
            }
            if (loaded === images.length) setHeight();
        } catch (e) {}
        let tries = 0;
        const interval = setInterval(() => {
            setHeight();
            tries++;
            if (tries > 20) clearInterval(interval);
        }, 250);
    };
}

// Function to process order
async function processOrder() {
    console.log('Processing order...');
    try {
        if (!elements.customerName.value) {
            showToast('Nama pelanggan harus diisi', 'error');
            return;
        }
        const orderItems = Array.from(elements.orderItems.children).map(row => {
            const productId = row.dataset.productId;
            const price = parseFloat(row.dataset.productPrice);
            const quantity = parseInt(row.querySelector('td:nth-child(2)').textContent);
            const name = row.querySelector('td:first-child div:first-child').textContent;
            return {
                productId,
                name,
                price,
                quantity,
                subtotal: price * quantity
            };
        });
        if (orderItems.length === 0) {
            showToast('Pesanan kosong', 'error');
            return;
        }
        const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
        // Penomoran invoice konsisten
        const paddedNumber = String(invoiceCounter).padStart(4, '0');
        const invoiceNumber = `INV/${paddedNumber}`;
        
        // Update invoice number display
        if (elements.invoiceNumber) {
            elements.invoiceNumber.textContent = `No. Invoice: ${invoiceNumber}`;
        }
        
        const transaction = {
            invoiceNumber: invoiceNumber,
            customerName: elements.customerName.value,
            customerPhone: elements.customerPhone.value || '',
            customerAddress: elements.customerAddress.value || '',
            items: orderItems,
            total: total,
            notes: elements.orderNotes.value || '',
            date: new Date().toISOString(),
            status: 'completed'
        };

        // Send transaction to server
        const response = await fetch(`${API_BASE_URL}/api/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(transaction)
        });

        if (!response.ok) {
            throw new Error('Failed to save transaction');
        }

        const savedTransaction = await response.json();
        transactions.push(savedTransaction);
        
        // Update UI
        updateTransactionHistory();
        updateMonthlySalesChart(); // Tambahkan ini
        resetOrder();
        
        // Increment dan simpan counter
        invoiceCounter++;
        saveInvoiceCounter();

        showToast('Transaksi berhasil disimpan', 'success');
        // Tampilkan preview nota otomatis setelah transaksi baru
        if (savedTransaction.filename) {
            await viewTransaction(savedTransaction.filename);
        }
    } catch (error) {
        console.error('Error processing order:', error);
        showToast('Gagal menyimpan transaksi', 'error');
    }
}

// Function to view transaction
async function viewTransaction(filename) {
    // Cari transaksi berdasarkan filename, id, atau invoiceNumber
    let trx = transactions.find(t => t.filename === filename || t.id === filename || t.invoiceNumber === filename);
    if (!trx) {
        showToast('Transaksi tidak ditemukan', 'error');
        return;
    }
    if (!trx.filename) {
        showToast('Transaksi ini tidak memiliki file nota, tidak bisa dipreview.', 'error');
        return;
    }
    // Tampilkan modal popup dengan iframe langsung ke /invoice/{userId}/{filename}
    const userId = currentUser.userId || 'admin';
    const url = `/invoice/${userId}/${trx.filename}`;
            // Hapus modal preview lama jika ada
            const oldModal = document.getElementById('invoice-preview-modal');
            if (oldModal) oldModal.remove();
    // Buat modal popup
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.id = 'invoice-preview-modal';
            modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl w-[99%] max-w-[1800px] mx-auto relative p-6">
            <div class="p-1 border-b flex justify-between items-center">
                        <h3 class="text-lg font-semibold">Preview Nota</h3>
                <button class="text-gray-500 hover:text-gray-700 text-2xl" id="close-invoice-preview-modal">&times;</button>
                    </div>
            <div class="p-1 border-b flex justify-end space-x-2">
                        <button id="share-whatsapp" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded flex items-center">
                            <i class="fab fa-whatsapp mr-2"></i> Share WhatsApp
                        </button>
                        <button onclick="copyInvoiceLink('${url}')" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center">
                            <i class="fas fa-copy mr-2"></i> Salin Link
                        </button>
                <button id="print-invoice-btn" class="bg-gray-500 hover:bg-gray-700 text-white px-4 py-2 rounded flex items-center">
                    <i class="fas fa-print mr-2"></i> Cetak
                        </button>
                    </div>
            <div class="p-0.5">
                <div style="padding:24px 24px;overflow-x:hidden;">
                    <iframe src="${url}" style="width:120%;margin-left:-10%;border:none;border-radius:8px;background:#fff;min-height:600px;overflow-x:hidden;" onload="adjustIframeHeight(this)"></iframe>
                </div>
            </div>
                </div>
            `;
            document.body.appendChild(modal);
    // Event close modal
    document.getElementById('close-invoice-preview-modal').onclick = function() {
        modal.remove();
    };
    // Event print
    setTimeout(() => {
        const printBtn = document.getElementById('print-invoice-btn');
        if (printBtn) {
            printBtn.onclick = function() {
                const iframe = modal.querySelector('iframe');
                if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
    }
            };
        }
    }, 500);
    // Setelah transaksi berhasil, update viewingTransaction
    window.viewingTransaction = trx;
}

// Function to copy invoice link
async function copyInvoiceLink(url) {
    try {
        await navigator.clipboard.writeText(`${window.location.origin}${url}`);
        showToast('Link nota berhasil disalin!', 'success');
    } catch (err) {
        showToast('Gagal menyalin link nota', 'error');
    }
}

// Function to edit transaction
async function editTransaction(filename) {
    try {
        const transaction = transactions.find(t => t.filename === filename);
        if (!transaction) {
            showToast('Transaksi tidak ditemukan', 'error');
            return;
        }
        editingTransactionId = transaction.filename; // Gunakan filename sebagai id file transaksi
        viewingTransaction = transaction;
        // Isi field pada modal edit transaksi yang benar
        document.getElementById('edit-customer-name').value = transaction.customerName || '';
        document.getElementById('edit-customer-phone').value = transaction.customerPhone || '';
        document.getElementById('edit-customer-address').value = transaction.customerAddress || '';
        document.getElementById('edit-order-notes').value = transaction.notes || '';
        // Render produk ke tabel edit
        renderEditProductsTable(transaction.items);
        updateEditOrderTotal();
        document.getElementById('edit-transaction-modal').classList.remove('hidden');
    } catch (error) {
        console.error('Error editing transaction:', error);
        showToast('Gagal memuat transaksi', 'error');
    }
}
// Render produk ke tabel modal edit
function renderEditProductsTable(items) {
    const tbody = document.getElementById('edit-products-tbody');
    tbody.innerHTML = '';
    (items || []).forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.classList.add('fade-in-item'); // Add fade-in class
        tr.innerHTML = `
          <td class="border px-2 py-1">
            <input type="text" class="edit-product-name w-full bg-gray-100" value="${item.name}" data-idx="${idx}" readonly>
          </td>
          <td class="border px-2 py-1">
            <input type="number" class="edit-product-qty w-16 text-center" min="1" value="${item.quantity}" data-idx="${idx}">
          </td>
          <td class="border px-2 py-1">
            <input type="number" class="edit-product-price w-24 text-right bg-gray-100" min="0" value="${item.price}" data-idx="${idx}" readonly>
          </td>
          <td class="border px-2 py-1 text-right">
            <span class="edit-product-subtotal">${formatCurrency(item.price * item.quantity)}</span>
          </td>
        `;
        tbody.appendChild(tr);
    });
}
// Update total di modal edit
function updateEditOrderTotal() {
    const tbody = document.getElementById('edit-products-tbody');
    let total = 0;
    tbody.querySelectorAll('tr').forEach(tr => {
        const qty = parseInt(tr.querySelector('.edit-product-qty').value) || 0;
        const price = parseFloat(tr.querySelector('.edit-product-price').value) || 0;
        total += qty * price;
        tr.querySelector('.edit-product-subtotal').textContent = formatCurrency(qty * price);
    });
    document.getElementById('edit-order-total').textContent = formatCurrency(total);
}
// Event delegation untuk input qty/harga/nama produk di modal edit
const editProductsTbody = document.getElementById('edit-products-tbody');
if (editProductsTbody) {
    editProductsTbody.addEventListener('input', function(e) {
        if (e.target.classList.contains('edit-product-qty') || e.target.classList.contains('edit-product-price')) {
            updateEditOrderTotal();
        }
    });
    editProductsTbody.addEventListener('click', function(e) {
        if (e.target.closest('.edit-remove-product')) {
            e.target.closest('tr').remove();
            updateEditOrderTotal();
        }
    });
}
// Tambah produk baru di modal edit
const addEditProductBtn = document.getElementById('add-edit-product');
if (addEditProductBtn) {
    addEditProductBtn.addEventListener('click', function() {
        const tbody = document.getElementById('edit-products-tbody');
        const idx = tbody.querySelectorAll('tr').length;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="border px-2 py-1">
            <input type="text" class="edit-product-name w-full" value="" data-idx="${idx}">
                    </td>
          <td class="border px-2 py-1">
            <input type="number" class="edit-product-qty w-16 text-center" min="1" value="1" data-idx="${idx}">
          </td>
          <td class="border px-2 py-1">
            <input type="number" class="edit-product-price w-24 text-right" min="0" value="0" data-idx="${idx}">
          </td>
          <td class="border px-2 py-1 text-right">
            <span class="edit-product-subtotal">Rp 0</span>
          </td>
          <td class="border px-2 py-1 text-center">
            <button type="button" class="text-red-500 hover:text-red-700 edit-remove-product" data-idx="${idx}"><i class="fas fa-trash"></i></button>
          </td>
        `;
        tbody.appendChild(tr);
            updateEditOrderTotal();
    });
}

// Event listener untuk tombol close dan batal pada modal edit transaksi
const closeEditModalBtn = document.getElementById('close-edit-transaction-modal');
if (closeEditModalBtn) {
    closeEditModalBtn.addEventListener('click', function() {
        document.getElementById('edit-transaction-modal').classList.add('hidden');
    });
}
const cancelEditBtn = document.getElementById('cancel-edit-transaction');
if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', function() {
        document.getElementById('edit-transaction-modal').classList.add('hidden');
    });
}

// Function to delete transaction
async function deleteTransaction(filename) {
    // Tampilkan modal konfirmasi custom
    elements.deleteMessage.textContent = 'Apakah Anda yakin ingin menghapus transaksi ini?';
    elements.deleteModal.classList.remove('hidden');

    // Hapus event listener sebelumnya agar tidak dobel
    const newConfirmHandler = async () => {
        elements.confirmDelete.removeEventListener('click', newConfirmHandler);
        elements.deleteModal.classList.add('hidden');
        try {
            // Cari transaksi berdasarkan filename
            const trx = transactions.find(t => t.filename === filename);
            if (!trx) throw new Error('Transaksi tidak ditemukan');
            // Hapus dari transactions.json (berdasarkan id)
            const response1 = await fetch(`${API_BASE_URL}/api/transactions/${trx.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            if (!response1.ok) throw new Error('Gagal menghapus data transaksi utama');
            // Hapus file nota (berdasarkan filename)
            const response2 = await fetch(`${API_BASE_URL}/api/delete-invoice?filename=${filename}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            // Jika file nota tidak ditemukan (404), tetap anggap sukses
            if (!response2.ok && response2.status !== 404) throw new Error('Gagal menghapus file nota');
            // Muat ulang data dari server untuk memastikan sinkronisasi
            await loadTransactionHistory();
            showToast('Transaksi berhasil dihapus', 'success');
        } catch (error) {
            console.error('Error deleting transaction:', error);
            showToast('Gagal menghapus transaksi', 'error');
        }
    };
    elements.confirmDelete.addEventListener('click', newConfirmHandler);
}

// Function to update products display
function updateProductsDisplay(productsToDisplay) {
    const productsContainer = document.getElementById('product-items');
    const productsEmpty = document.getElementById('products-empty');
    if (!productsContainer) return;

    // Use the provided array, or the global products array if none is provided
    const productsArray = productsToDisplay === undefined ? products : productsToDisplay;

    if (!productsArray || productsArray.length === 0) {
        productsContainer.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-4 text-gray-500">
                    Belum ada produk
                </td>
            </tr>
        `;
        if (productsEmpty) productsEmpty.classList.remove('hidden');
    } else {
        productsContainer.innerHTML = productsArray
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(product => `
            <tr class="border-b border-gray-200 fade-in-item">
                <td class="px-6 py-4">${product.name}</td>
                <td class="px-6 py-4 text-right">${formatCurrency(product.price)}</td>
                <td class="px-6 py-4 text-center">${product.stock || 0}</td>
                <td class="px-6 py-4 text-center">
                    <button onclick="editProduct('${product.id}')" class="text-green-600 hover:text-green-800 mx-1">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteProduct('${product.id}')" class="text-red-600 hover:text-red-800 mx-1">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        if (productsEmpty) productsEmpty.classList.add('hidden');
    }
}

// Function to edit product
function editProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) {
        showToast('Produk tidak ditemukan', 'error');
        return;
    }

    // Isi field pada modal edit produk
    const productModal = document.getElementById('product-modal'); // Gunakan ID modal produk yang benar
    if (productModal) {
        // Isi semua field di awal sebelum modal ditampilkan
        document.getElementById('product-id').value = product.id; // Gunakan ID field yang benar
        document.getElementById('product-name').value = product.name;

        // Ambil elemen input harga MENGGUNAKAN querySelector di dalam modal untuk menghindari konflik ID
        const priceInput = productModal.querySelector('#product-price');
        console.log('Price input element (using querySelector inside modal):', priceInput); // Update log

        if (priceInput) {
            // Tambahkan delay 50ms
            setTimeout(() => {
                const priceString = product.price ? product.price.toString() : '0';
                priceInput.value = priceString; // Coba set .value
                console.log('Set price input value using .value (with delay):', priceInput.value);
                // Fallback: Coba juga setAttribute
                priceInput.setAttribute('value', priceString);
                console.log('Set price input value using setAttribute (with delay):', priceInput.getAttribute('value'));
            }, 50); // Delay 50ms
        } else {
            console.error('Element input harga with id \'product-price\' not found INSIDE product modal!'); // Update pesan error
        }

        document.getElementById('product-stock').value = product.stock || 0;
        document.getElementById('product-description').value = product.description || '';

        console.log('Editing product:', product); // Log objek produk

        // Tampilkan modal produk
        productModal.classList.remove('hidden');

    } else {
        console.error('Modal produk (product-modal) tidak ditemukan!');
        showToast('Terjadi kesalahan: Modal edit produk tidak ditemukan.', 'error');
    }
}

// Function to delete product
async function deleteProduct(productId) {
    elements.deleteMessage.textContent = 'Apakah Anda yakin ingin menghapus produk ini?';
    elements.confirmDelete.onclick = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/products/${productId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (!response.ok) {
                throw new Error('Gagal menghapus produk dari server');
            }

            // Muat ulang data dari server
            await loadProducts();
            showToast('Produk berhasil dihapus', 'success');
            elements.deleteModal.classList.add('hidden');
        } catch (error) {
            console.error('Error deleting product:', error);
            showToast('Terjadi kesalahan saat menghapus produk: ' + error.message, 'error');
        }
    };

    elements.deleteModal.classList.remove('hidden');
}

// Fungsi untuk menangani import produk dari Excel
function handleImportExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            if (!jsonData || jsonData.length < 2) {
                throw new Error('File Excel kosong atau tidak memiliki data yang valid');
            }

            // Ambil header (baris pertama)
            const headers = jsonData[0];

            // Tampilkan modal mapping kolom
            const importModal = document.getElementById('import-product-modal');
            const columnMapping = document.getElementById('column-mapping');
            const importPreview = document.getElementById('import-preview');
            const importPreviewBody = document.getElementById('import-preview-body');
            const startImportBtn = document.getElementById('start-import-btn');
            const importStatus = document.getElementById('import-status');

            // Reset dan tampilkan modal
            importModal.classList.remove('hidden');
            columnMapping.classList.remove('hidden');
            importPreview.classList.remove('hidden');
            startImportBtn.disabled = true;
            importStatus.classList.add('hidden');
            importStatus.classList.remove('text-red-500');
            importStatus.textContent = '';

            // Populate dropdown untuk mapping kolom
            const nameSelect = document.getElementById('product-name-column');
            const priceSelect = document.getElementById('product-price-column');
            const stockSelect = document.getElementById('product-stock-column');

            // Reset dropdowns
            nameSelect.innerHTML = '<option value="">-- Pilih Kolom --</option>';
            priceSelect.innerHTML = '<option value="">-- Pilih Kolom --</option>';
            stockSelect.innerHTML = '<option value="">-- Lewati --</option>';

            // Deteksi otomatis kolom
            let autoNameIdx = -1, autoPriceIdx = -1, autoStockIdx = -1;
            headers.forEach((header, index) => {
                const headerText = header ? header.toString().toLowerCase().trim() : '';
                if (autoNameIdx === -1 && (headerText.includes('nama') || headerText.includes('produk') || headerText.includes('barang'))) autoNameIdx = index;
                if (autoPriceIdx === -1 && headerText.includes('harga')) autoPriceIdx = index;
                if (autoStockIdx === -1 && (headerText.includes('stok') || headerText.includes('stock'))) autoStockIdx = index;
                const option = `<option value="${index}">${header ? header.toString().trim() : `Kolom ${index + 1}`}</option>`;
                nameSelect.insertAdjacentHTML('beforeend', option);
                priceSelect.insertAdjacentHTML('beforeend', option);
                stockSelect.insertAdjacentHTML('beforeend', option);
            });
            // Set otomatis jika ditemukan
            if (autoNameIdx !== -1) nameSelect.value = autoNameIdx;
            if (autoPriceIdx !== -1) priceSelect.value = autoPriceIdx;
            if (autoStockIdx !== -1) stockSelect.value = autoStockIdx;

            // Panggil updatePreview agar preview langsung muncul setelah mapping otomatis
            if (typeof updatePreview === 'function') updatePreview();

            // Event listener untuk perubahan mapping
            function updatePreview() {
                const nameIndex = parseInt(nameSelect.value);
                const priceIndex = parseInt(priceSelect.value);
                const stockIndex = parseInt(stockSelect.value);

                // Validasi: cek jika kolom nama produk hanya berisi angka
                let hasNumericName = false;
                if (nameIndex >= 0) {
                     jsonData.slice(1).forEach(row => { // Skip header (index 0)
                         const nameValue = row[nameIndex];
                         if (nameValue !== undefined && nameValue !== null) {
                             const trimmedName = nameValue.toString().trim();
                             // Cek apakah string hanya terdiri dari angka
                             if (/^\d+$/.test(trimmedName)) {
                                 hasNumericName = true;
                                 console.warn('Detected numeric product name:', trimmedName);
                             }
                         }
                     });
                 }

                if (hasNumericName) {
                    showToast('Periksa kembali kolom! Kolom Nama Produk terdeteksi hanya berisi angka.', 'error');
                    startImportBtn.disabled = true;
                    importPreviewBody.innerHTML = `
                        <tr>
                            <td colspan="3" class="border px-2 py-1 text-center text-red-500 font-bold">
                                Import Dibatalkan: Kolom Nama Produk terdeteksi hanya berisi angka.<br>Periksa kembali file Excel Anda.
                            </td>
                        </tr>
                    `;
                    // Sembunyikan mapping dan preview untuk memperjelas pesan error
                     columnMapping.classList.add('hidden');
                     importPreview.classList.add('hidden');
                    return;
                }

                if (nameIndex >= 0 && priceIndex >= 0) {
                    startImportBtn.disabled = false;
                    
                    // Tampilkan preview (5 baris pertama)
                    const previewData = jsonData
                        .slice(1, 6) // Skip header, ambil 5 baris
                        .map(row => {
                            if (!row || row.length === 0) return null;
                            
                            const name = row[nameIndex];
                            const price = parseFloat(row[priceIndex]);
                            const stock = stockIndex >= 0 ? parseInt(row[stockIndex]) : 0;
                            
                            // Skip baris kosong atau tidak valid
                            if (!name || name.toString().trim() === '') return null;
                            if (isNaN(price) || price < 0) return null;
                            
                            return {
                                name: name.toString().trim(),
                                price: price,
                                stock: isNaN(stock) ? 0 : Math.max(0, stock)
                            };
                        })
                        .filter(item => item !== null);

                    importPreviewBody.innerHTML = previewData.length > 0 ? 
                        previewData.map(item => `
                            <tr class="border-b">
                                <td class="border px-2 py-1">${item.name}</td>
                                <td class="border px-2 py-1 text-right">${formatCurrency(item.price)}</td>
                                ${stockIndex >= 0 ? `<td class="border px-2 py-1 text-center">${item.stock}</td>` : ''}
                            </tr>
                        `).join('') :
                        `<tr><td colspan="3" class="border px-2 py-1 text-center text-gray-500">Tidak ada data valid untuk ditampilkan</td></tr>`;
                } else {
                    startImportBtn.disabled = true;
                    importPreviewBody.innerHTML = `
                        <tr>
                            <td colspan="3" class="border px-2 py-1 text-center text-gray-500">
                                Pilih kolom untuk melihat preview
                            </td>
                        </tr>
                    `;
                }
            }

            nameSelect.addEventListener('change', updatePreview);
            priceSelect.addEventListener('change', updatePreview);
            stockSelect.addEventListener('change', updatePreview);

            // Event listener untuk tombol import
            startImportBtn.onclick = async () => {
                const nameIndex = parseInt(nameSelect.value);
                const priceIndex = parseInt(priceSelect.value);
                const stockIndex = parseInt(stockSelect.value);

                 // Lakukan validasi ulang sebelum import sebenarnya
                 if (nameIndex < 0 || priceIndex < 0) {
                     showToast('Pilih kolom Nama Produk dan Harga sebelum memulai import.', 'error');
                     return;
                 }

                 // Cek kembali jika ada nama produk yang hanya berisi angka di seluruh data (bukan hanya preview)
                 let hasNumericNameOnImport = false;
                 jsonData.slice(1).forEach(row => {
                     const nameValue = row[nameIndex];
                     if (nameValue !== undefined && nameValue !== null) {
                         const trimmedName = nameValue.toString().trim();
                         if (/^\d+$/.test(trimmedName)) {
                             hasNumericNameOnImport = true;
                         }
                     }
                 });

                 if (hasNumericNameOnImport) {
                     showToast('Import dibatalkan: Ditemukan Nama Produk yang hanya berisi angka di file Excel.', 'error');
                      importStatus.textContent = 'Import Dibatalkan: Ditemukan Nama Produk yang hanya berisi angka.';
                      importStatus.classList.remove('hidden');
                      importStatus.classList.add('text-red-500');
                     startImportBtn.disabled = true;
                     // Mungkin tutup modal atau biarkan pesan error muncul
                     return;
                 }

                if (nameIndex >= 0 && priceIndex >= 0) {
                    try {
                        importStatus.textContent = 'Memproses data...';
                        importStatus.classList.remove('hidden', 'text-red-500');
                        startImportBtn.disabled = true;

                        // Konversi data Excel ke format produk
                        const importedProducts = jsonData
                            .slice(1) // Skip header
                            .map(row => {
                                if (!row || row.length === 0) return null;
                                const name = row[nameIndex];
                                const price = parseFloat(row[priceIndex]);
                                const stock = stockIndex >= 0 ? parseInt(row[stockIndex]) : 0;
                                if (!name || name.toString().trim() === '') return null;
                                if (isNaN(price) || price < 0) return null;
                                return {
                                    name: name.toString().trim(),
                                    price: price,
                                    stock: isNaN(stock) ? 0 : Math.max(0, stock)
                                };
                            })
                            .filter(item => item !== null);

                        if (importedProducts.length === 0) {
                            throw new Error('Tidak ada data valid untuk diimpor');
                        }

                        // Ambil produk lama
                        let currentProducts = Array.isArray(products) ? [...products] : [];
                        // Proses merge: jika nama sama, akumulasi stock dan update harga
                        importedProducts.forEach(imported => {
                            const idx = currentProducts.findIndex(p => p.name.trim().toLowerCase() === imported.name.trim().toLowerCase());
                            if (idx !== -1) {
                                // Akumulasi stock dan update harga
                                currentProducts[idx].stock = (parseInt(currentProducts[idx].stock) || 0) + (parseInt(imported.stock) || 0);
                                currentProducts[idx].price = imported.price;
                            } else {
                                // Tambah produk baru, generate id
                                currentProducts.push({
                                    id: 'prod_' + Math.random().toString(36).substr(2, 12),
                                    name: imported.name,
                                    price: imported.price,
                                    stock: imported.stock,
                                    description: ''
                                });
                            }
                        });

                        // Simpan ke server
                        importStatus.textContent = 'Menyimpan ke server...';
                        await saveProducts(currentProducts);

                        // Muat ulang data dari server
                        await loadProducts();
                        showToast(`${importedProducts.length} produk berhasil diimpor/diupdate`, 'success');
                        importModal.classList.add('hidden');
                        event.target.value = '';
                    } catch (error) {
                        console.error('Error importing products:', error);
                        importStatus.textContent = 'Gagal mengimpor: ' + error.message;
                        importStatus.classList.add('text-red-500');
                        startImportBtn.disabled = false;
                    }
                }
            };

            // Event listener untuk tombol batal
            document.getElementById('cancel-import-btn').onclick = () => {
                importModal.classList.add('hidden');
                event.target.value = ''; // Reset file input
            };

            // Event listener untuk tombol tutup
            document.getElementById('close-import-product-modal').onclick = () => {
                importModal.classList.add('hidden');
                event.target.value = ''; // Reset file input
            };

        } catch (error) {
            console.error('Error reading Excel file:', error);
            showToast('Gagal membaca file Excel: ' + error.message, 'error');
            event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
}

// Function to show login modal
function showLoginModal() {
    const loginModal = document.getElementById('login-modal');
    if (loginModal) {
        loginModal.classList.remove('hidden');
        // Reset form and error message
        elements.loginForm.reset();
        elements.loginErrorDisplay.textContent = '';
        elements.loginErrorDisplay.classList.add('hidden');
    }
}

// Function to hide login modal
function hideLoginModal() {
    const loginModal = document.getElementById('login-modal');
    if (loginModal) {
        loginModal.classList.add('hidden');
    }
}

// Function to setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');

    // Proses Pesanan button
    const processOrderBtn = document.querySelector('#process-order-btn, button[onclick="processOrder()"]');
    if (processOrderBtn) {
        console.log('Process order button found');
        // Hapus onclick attribute jika ada
        processOrderBtn.removeAttribute('onclick');
        // Tambahkan event listener
        processOrderBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Process order button clicked');
            processOrder();
        });
    } else {
        console.error('Process order button not found');
    }

    // WhatsApp number input handler
    const whatsappInput = document.getElementById('customer-phone');
    if (whatsappInput) {
        whatsappInput.addEventListener('input', function(e) {
            // Hapus semua karakter non-digit
            let value = e.target.value.replace(/\D/g, '');
            
            // Jika dimulai dengan 0, ganti dengan 62
            if (value.startsWith('0')) {
                value = '62' + value.substring(1);
            }
            
            // Jika belum ada 62 di awal dan ada input, tambahkan 62
            if (value && !value.startsWith('62')) {
                value = '62' + value;
            }
            
            // Update nilai input
            e.target.value = value;
        });

        // Mencegah input karakter non-digit
        whatsappInput.addEventListener('keypress', function(e) {
            if (!/^\d$/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                e.preventDefault();
            }
        });

        // Mencegah paste karakter non-digit
        whatsappInput.addEventListener('paste', function(e) {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const numbersOnly = pastedText.replace(/\D/g, '');
            
            let finalValue = numbersOnly;
            if (numbersOnly.startsWith('0')) {
                finalValue = '62' + numbersOnly.substring(1);
            } else if (!numbersOnly.startsWith('62')) {
                finalValue = '62' + numbersOnly;
            }
            
            this.value = finalValue;
        });
    }

    // Login form di initial view
    const loginForm = document.querySelector('#initial-view form');
    if (loginForm) {
        console.log('Login form found, adding event listener');
        loginForm.addEventListener('submit', handleLogin);
    } else {
        console.error('Login form not found in initial view');
    }

    // Tab Navigation
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    console.log('Setting up tab navigation:', tabButtons.length, 'buttons found');

    // Set default active tab (Transaksi Baru)
    const defaultTab = document.querySelector('[data-tab="tab-new-transaction"]');
    if (defaultTab) {
        defaultTab.classList.add('bg-blue-700', 'text-white');
        defaultTab.classList.remove('hover:bg-blue-700');
        const defaultContent = document.getElementById('tab-new-transaction');
        if (defaultContent) {
            defaultContent.classList.remove('hidden');
        }
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = button.getAttribute('data-tab');
            console.log('Tab clicked:', targetId);

            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => {
                btn.classList.remove('bg-blue-700', 'text-white');
                btn.classList.add('text-white', 'hover:bg-blue-700', 'opacity-80');
            });
            tabContents.forEach(content => {
                content.classList.add('hidden');
            });

            // Add active class to clicked button and show content
            button.classList.add('bg-blue-700', 'text-white');
            button.classList.remove('hover:bg-blue-700', 'opacity-80');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.remove('hidden');
            }

            // Tutup sidebar dan overlay di mobile setelah klik tab
            if (window.innerWidth < 768) {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('overlay');
                if (sidebar) {
                    sidebar.classList.remove('translate-x-0');
                    sidebar.classList.add('-translate-x-full');
                }
                if (overlay) {
                    overlay.classList.add('hidden');
                }
            }
        });
    });

    // Mobile menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');

    if (menuToggle && sidebar && overlay) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('translate-x-0');
            sidebar.classList.toggle('translate-x-full');
            overlay.classList.toggle('hidden');
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('translate-x-0');
            sidebar.classList.add('translate-x-full');
            overlay.classList.add('hidden');
        });
    }

    // Logout button
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            // Tampilkan modal konfirmasi logout
            const modalTitle = elements.deleteModal.querySelector('.text-lg.font-semibold');
            if (modalTitle) {
                modalTitle.textContent = 'Peringatan Konfirmasi';
            }
            elements.deleteMessage.textContent = 'Apakah Anda yakin ingin logout?';
            elements.deleteModal.classList.remove('hidden');

            // Hapus event listener confirm delete yang lama
            if (elements.confirmDelete) {
                const confirmDeleteClone = elements.confirmDelete.cloneNode(true);
                elements.confirmDelete.parentNode.replaceChild(confirmDeleteClone, elements.confirmDelete);
                elements.confirmDelete = confirmDeleteClone;
            }

            // Tambahkan event listener baru untuk konfirmasi logout
            if (elements.confirmDelete) {
                elements.confirmDelete.addEventListener('click', async () => {
                    elements.deleteModal.classList.add('hidden');
                    await handleLogout();
                });
            }

            // Event listener untuk tombol batal
            if (elements.cancelDelete) {
                const cancelDeleteClone = elements.cancelDelete.cloneNode(true);
                elements.cancelDelete.parentNode.replaceChild(cancelDeleteClone, elements.cancelDelete);
                elements.cancelDelete = cancelDeleteClone;
                elements.cancelDelete.addEventListener('click', () => {
                    elements.deleteModal.classList.add('hidden');
                });
            }
        });
    }

    // Register form submit
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            console.log('Register form submitted');
            
            const username = document.getElementById('register-username').value;
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-confirm-password').value;
            const errorDisplay = document.getElementById('register-error');
            
            try {
                if (password !== confirmPassword) {
                    throw new Error('Password dan konfirmasi password tidak cocok');
                }

                const response = await fetch(`${API_BASE_URL}/api/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Gagal melakukan registrasi');
                }

                // Save token and user data
                localStorage.setItem('token', data.token);
                localStorage.setItem('currentUser', JSON.stringify({
                    userId: data.userId,
                    username: data.username,
                    role: data.role
                }));

                // Update auth state
                isLoggedIn = true;
                authToken = data.token;
                currentUser = {
                    userId: data.userId,
                    username: data.username,
                    role: data.role
                };

                // Hide login view and show app
                document.getElementById('initial-view').classList.add('hidden');
                document.getElementById('app-content').classList.remove('hidden');
                document.getElementById('app-content').style.display = 'block';

                showToast('Registrasi berhasil!', 'success');
            } catch (error) {
                console.error('Registration error:', error);
                errorDisplay.textContent = error.message;
                errorDisplay.classList.remove('hidden');
            }
        });
    }

    // Toggle between login and register forms
    const showLoginBtn = document.getElementById('show-login-btn');
    const showRegisterBtn = document.getElementById('show-register-btn');
    const loginFormContainer = document.getElementById('initial-view');
    const registerFormContainer = document.getElementById('register-form-container');

    if (showLoginBtn) {
        showLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loginFormContainer.classList.remove('hidden');
            registerFormContainer.classList.add('hidden');
        });
    }

    if (showRegisterBtn) {
        showRegisterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loginFormContainer.classList.add('hidden');
            registerFormContainer.classList.remove('hidden');
        });
    }

    // Product search in New Transaction tab
    const productSearchInput = document.getElementById('product-search');
    const productSuggestionsElement = document.getElementById('product-suggestions');
    const selectedProductIdElement = document.getElementById('selected-product-id');
    const selectedProductPriceElement = document.getElementById('selected-product-price'); // Hidden input for selected product's price
    const productQuantityElement = document.getElementById('product-quantity');
    const productPriceDisplayElement = document.getElementById('product-price'); // Display for unit price
    const productSubtotalDisplayElement = document.getElementById('product-subtotal'); // Display for subtotal
    const addProductButton = document.getElementById('add-product');

    if (productSearchInput && productSuggestionsElement && selectedProductIdElement && selectedProductPriceElement && productQuantityElement && productPriceDisplayElement && productSubtotalDisplayElement && addProductButton) {
        productSearchInput.addEventListener('input', () => {
            const searchTerm = productSearchInput.value;
            // Pastikan suggestions DIV dan UL terlihat saat mulai mengetik
            productSuggestionsElement.classList.remove('hidden'); 
            const ul = productSuggestionsElement.querySelector('ul');
            if (ul) ul.classList.remove('hidden');
            
            filterProducts(
                searchTerm, 
                productSuggestionsElement,
                selectedProductIdElement,
                selectedProductPriceElement, 
                productQuantityElement,
                productPriceDisplayElement,    
                productSubtotalDisplayElement, 
                addProductButton
            );
        });
        
        // Listener untuk menyembunyikan suggestions jika diklik di luar #product-search dan #product-suggestions
        document.addEventListener('click', function(event) {
            if (productSuggestionsElement.contains(event.target) || productSearchInput.contains(event.target)) {
                return; // Jangan sembunyikan jika klik di dalam area search atau suggestions
            }
            const ul = productSuggestionsElement.querySelector('ul');
            if (ul) {
                ul.classList.add('hidden');
            }
        });

        // Product quantity change in New Transaction tab
        productQuantityElement.addEventListener('input', () => {
            const price = parseFloat(selectedProductPriceElement.value) || 0; 
            const quantity = parseInt(productQuantityElement.value) || 0;
            if(productSubtotalDisplayElement){
                productSubtotalDisplayElement.textContent = formatCurrency(price * quantity);
            }
        });

        // Add product button in New Transaction tab
        addProductButton.addEventListener('click', addProductToOrder);
    } else {
        console.warn('One or more elements for product search/add in New Transaction tab are missing.');
    }

    console.log('Event listeners setup completed');

    // Settings form submit
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            console.log('Settings form submitted');

            // Collect settings data from form inputs
            const settingsData = {
                storeName: elements.storeName.value,
                storeTagline: elements.storeTagline.value,
                storeAddress: elements.storeAddress.value,
                storePhone: elements.storePhone.value,
                storeEmail: elements.storeEmail.value,
                storeFooter: elements.storeFooter.value,
                whatsappMessageTemplate: elements.whatsappMessageTemplate.value,
                // Ambil nilai paper-layout
                paperLayout: document.getElementById('paper-layout').value,
            };

            // Handle logo upload separately
            const logoFile = elements.storeLogoInput.files[0];
            let logoUrl = settings.storeLogo; // Default to existing logo URL

            if (logoFile) {
                // Read the file as Data URL
                const reader = new FileReader();
                reader.onload = async (e) => {
                    // Send logo data to server (new endpoint needed for logo upload)
                    // For now, let's assume we have an endpoint /api/upload-logo
                    try {
                        const uploadResponse = await fetch(`${API_BASE_URL}/api/upload-logo`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${authToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ logoData: e.target.result })
                        });

                        if (!uploadResponse.ok) {
                            throw new Error('Gagal mengunggah logo');
                        }
                        const uploadResult = await uploadResponse.json();
                        logoUrl = uploadResult.logoUrl; // Get the new logo URL from server

                        // Now save other settings with the new logo URL
                        settingsData.storeLogo = logoUrl;
                        await saveSettings(settingsData);

                    } catch (uploadError) {
                        console.error('Error uploading logo:', uploadError);
                        showToast('Gagal mengunggah logo', 'error');
                    }
                };
                reader.readAsDataURL(logoFile);
            } else {
                // If no new logo is selected, just save other settings
                settingsData.storeLogo = logoUrl; // Keep the old logo URL or null
                await saveSettings(settingsData);
            }
        });
    } else {
        console.error('Settings form not found.');
    }

    // Event listener tombol Import Excel
    const importBtn = document.getElementById('import-products-btn');
    const excelInput = document.getElementById('excel-file-input');
    if (importBtn && excelInput) {
        importBtn.addEventListener('click', function() {
            excelInput.value = '';
            excelInput.click();
        });
        excelInput.addEventListener('change', handleImportExcel);
    }

    // Event listener tombol Tambah Produk di tab Kelola Produk
    const addNewProductBtn = document.getElementById('add-new-product');
    if (addNewProductBtn) {
        addNewProductBtn.addEventListener('click', function() {
            // Reset field input produk sesuai id yang benar
            document.getElementById('product-id').value = '';
            document.getElementById('product-name').value = '';
            document.getElementById('product-price').value = '';
            document.getElementById('product-stock').value = '';
            document.getElementById('product-description').value = '';
            // Tampilkan modal
            document.getElementById('product-modal').classList.remove('hidden');
        });
    }

    // Event listener untuk pencarian produk di tab Kelola Produk
    const searchProductInput = document.getElementById('search-product');
    if (searchProductInput) {
        console.log('Adding input listener to search-product.');
        searchProductInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const filteredProducts = products.filter(product =>
                product.name.toLowerCase().includes(searchTerm)
            );
            updateProductsDisplay(filteredProducts);
        });
    }

    // Event listener untuk pencarian transaksi di tab Riwayat Transaksi
    const searchHistoryInput = document.getElementById('search-history');
    if (searchHistoryInput) {
        console.log('Adding input listener to search-history.');
        searchHistoryInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const filteredTransactions = transactions.filter(transaction => {
                const customerName = (transaction.customerName || '').toLowerCase();
                const customerPhone = (transaction.customerPhone || '').toLowerCase();
                const customerAddress = (transaction.customerAddress || '').toLowerCase();

                return customerName.includes(searchTerm) ||
                       customerPhone.includes(searchTerm) ||
                       customerAddress.includes(searchTerm);
            });
            updateTransactionHistory(filteredTransactions);
        });
    }

    // Event listener untuk menampilkan modal Ubah Kata Sandi
    if (elements.showChangePasswordModalBtn && elements.changePasswordModal) {
        elements.showChangePasswordModalBtn.addEventListener('click', function() {
            elements.changePasswordModal.classList.remove('hidden');
            // Reset form saat modal dibuka
            if (elements.changePasswordForm) {
                elements.changePasswordForm.reset();
                if (elements.changePasswordErrorDisplay) {
                    elements.changePasswordErrorDisplay.textContent = '';
                    elements.changePasswordErrorDisplay.classList.add('hidden');
                }
            }
        });
    }

    // Event listener untuk menutup modal Ubah Kata Sandi
    if (elements.closeChangePasswordModalBtn && elements.changePasswordModal) {
        elements.closeChangePasswordModalBtn.addEventListener('click', function() {
            elements.changePasswordModal.classList.add('hidden');
            // Reset form saat modal ditutup
            if (elements.changePasswordForm) {
                elements.changePasswordForm.reset();
                if (elements.changePasswordErrorDisplay) {
                    elements.changePasswordErrorDisplay.textContent = '';
                    elements.changePasswordErrorDisplay.classList.add('hidden');
                }
            }
        });
    }

    // Event listener untuk submit form Ubah Kata Sandi
    if (elements.changePasswordForm) {
        elements.changePasswordForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const currentPassword = elements.currentPasswordInput.value.trim();
            const newPassword = elements.newPasswordInput.value.trim();
            const confirmNewPassword = elements.confirmNewPasswordInput.value.trim();
            const errorDisplay = elements.changePasswordErrorDisplay;

            errorDisplay.textContent = '';
            errorDisplay.classList.add('hidden');

            try {
                if (!currentPassword || !newPassword || !confirmNewPassword) {
                    throw new Error('Semua field harus diisi');
                }

                if (newPassword !== confirmNewPassword) {
                    throw new Error('Kata sandi baru dan konfirmasi kata sandi tidak cocok');
                }

                // Kirim permintaan ke server untuk mengubah kata sandi
                const response = await fetch(`${API_BASE_URL}/api/change-password`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ currentPassword, newPassword, confirmPassword: confirmNewPassword }) // Gunakan variabel confirmNewPassword dengan kunci confirmPassword
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Gagal mengubah kata sandi');
                }

                showToast('Kata sandi berhasil diubah!', 'success');
                elements.changePasswordModal.classList.add('hidden'); // Tutup modal
                elements.changePasswordForm.reset(); // Reset form

            } catch (error) {
                console.error('Change password error:', error);
                errorDisplay.textContent = error.message;
                errorDisplay.classList.remove('hidden');
                // Reset password fields on error, keep current password filled
                elements.newPasswordInput.value = '';
                elements.confirmNewPasswordInput.value = '';
            }
        });
    }

    // Function to toggle password visibility
    function togglePasswordVisibility(inputId, iconId) {
        const input = document.getElementById(inputId);
        const icon = document.getElementById(iconId);
        if (input && icon) {
            icon.addEventListener('click', function() {
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);
                // Toggle the eye icon
                icon.classList.toggle('fa-eye');
                icon.classList.toggle('fa-eye-slash');
            });
        }
    }

    // Add toggle functionality to password fields
    togglePasswordVisibility('current-password', 'toggle-current-password');
    togglePasswordVisibility('new-password', 'toggle-new-password');
    togglePasswordVisibility('confirm-new-password', 'toggle-confirm-new-password');

    // Add toggle functionality to login password fields
    togglePasswordVisibility('login-password', 'toggle-login-password');
    togglePasswordVisibility('login-password-modal', 'toggle-login-password-modal');

    // Add toggle functionality to register password fields
    togglePasswordVisibility('register-password', 'toggle-register-password');
    togglePasswordVisibility('register-confirm-password', 'toggle-register-confirm-password');

    // Add toggle password visibility to other password fields
    // ... existing code ...
}

// Function to handle registration
async function handleRegister(event) {
    event.preventDefault();
    
    const username = elements.registerUsernameInput.value;
    const password = elements.registerPasswordInput.value;
    const confirmPassword = elements.registerConfirmPasswordInput.value;
    
    // Reset error display
    elements.registerErrorDisplay.textContent = '';
    elements.registerErrorDisplay.classList.add('hidden');
    
    try {
        // Basic validation
        if (!username || !password || !confirmPassword) {
            throw new Error('Semua field harus diisi');
        }
        
        if (password !== confirmPassword) {
            throw new Error('Password dan konfirmasi password tidak cocok');
        }
        
        const response = await fetch(`${API_BASE_URL}/api/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Gagal melakukan registrasi');
        }

        // Save token and user data
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify({
            userId: data.userId,
            username: data.username,
            role: data.role
        }));

        // Update auth state
        isLoggedIn = true;
        authToken = data.token;
        currentUser = {
            userId: data.userId,
            username: data.username,
            role: data.role
        };

        // Hide login view and show app
        document.getElementById('initial-view').classList.add('hidden');
        document.getElementById('app-content').classList.remove('hidden');
        document.getElementById('app-content').style.display = 'block';

        showToast('Registrasi berhasil!', 'success');
    } catch (error) {
        console.error('Registration error:', error);
        elements.registerErrorDisplay.textContent = error.message;
        elements.registerErrorDisplay.classList.remove('hidden');
    }
}

// Function to handle logout
async function handleLogout() {
    try {
        // Clear local storage
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');

        // Reset auth state
        isLoggedIn = false;
        authToken = null;
        currentUser = null;

        // Show initial view and hide app content
        if (elements.initialView) {
            elements.initialView.style.display = 'flex';
        }
        
        const appContent = document.getElementById('app-content');
        if (appContent) {
            appContent.classList.add('hidden');
        }

        // Sembunyikan tombol menu toggle saat logout
        const menuToggle = document.getElementById('menu-toggle');
        if (menuToggle) {
            menuToggle.classList.add('hidden');
        }

        // Reset form fields
        const usernameInput = document.querySelector('#initial-view input[type="text"]');
        const passwordInput = document.querySelector('#initial-view input[type="password"]');
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';

        showToast('Berhasil logout!', 'success');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Terjadi kesalahan saat logout', 'error');
    }
}

// Function to initialize app
document.addEventListener('DOMContentLoaded', async function() {
    console.log('=== Application Initialization ===');
    console.log('Document ready, initializing app...');
    
    try {
        // Setup event listeners
        setupEventListeners();
        // Panggil loadInvoiceCounter agar counter konsisten
        loadInvoiceCounter();
        // Panggil setupProductEventListeners untuk inisialisasi event produk
        setupProductEventListeners();
        // Check login status and update UI
        await checkLoginStatusAndUpdateUI();
    } catch (error) {
        console.error('Error during app initialization:', error);
        showToast('Terjadi kesalahan saat menginisialisasi aplikasi', 'error');
    }
}); 

// Tambahkan fungsi untuk preview nomor invoice berikutnya tanpa increment
function getNextInvoiceNumber() {
    return `INV/${String(invoiceCounter).padStart(4, '0')}`;
}

// Saat form transaksi baru di-reset/dibuka, update preview nomor invoice
function resetNewTransactionForm() {
    // ... existing code ...
    if (elements.invoiceNumber) {
        elements.invoiceNumber.textContent = `No. Invoice: ${getNextInvoiceNumber()}`;
    }
    // ... existing code ...
}

// Fungsi polling untuk menunggu file nota siap
async function waitForInvoiceReady(url, maxTries = 10, delay = 300) {
    for (let i = 0; i < maxTries; i++) {
        try {
            const res = await fetch(url, { method: 'HEAD' });
            if (res.ok) return true;
        } catch (e) {}
        await new Promise(r => setTimeout(r, delay));
    }
    return false;
}

// Function to share invoice via WhatsApp
async function shareInvoiceViaWhatsApp(transaction) {
    // Ambil template dari settings
    const template = settings.whatsappMessageTemplate || 'Halo {{customerName}}, berikut adalah nota transaksi Anda dari {{storeName}}:\n\n{{notaLink}}\n\nTerima kasih!';
    // Buat link nota
    const notaId = transaction.filename;
    const userId = currentUser ? currentUser.userId : 'defaultUser';
    const notaUrl = `${window.location.origin}/invoice/${userId}/${notaId}`;
    // Ganti placeholder
    const message = template
        .replace(/{{customerName}}/g, transaction.customerName)
        .replace(/{{storeName}}/g, settings.storeName)
        .replace(/{{notaLink}}/g, notaUrl);
    // Salin ke clipboard
    try {
        await navigator.clipboard.writeText(message);
        showToast('Pesan WhatsApp telah disalin ke clipboard!', 'success');
    } catch (err) {
        showToast('Gagal menyalin pesan ke clipboard', 'error');
    }
    // Format nomor telepon
    let phone = transaction.customerPhone || '';
    phone = phone.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);
    else if (!phone.startsWith('62')) phone = '62' + phone;
    // Buka WhatsApp
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

// Function to update transaction history display
function updateTransactionHistory(transactionsToDisplay) {
    const historyContainer = document.getElementById('history-items');
    const historyEmpty = document.getElementById('history-empty');
    if (!historyContainer) return;

    // Use the provided array, or the global transactions array if none is provided
    const transactionsArray = transactionsToDisplay === undefined ? transactions : transactionsToDisplay;

    // Filter ulang agar hanya transaksi valid yang dirender (tetap terapkan filter validitas)
    const validTransactions = (transactionsArray || []).filter(t => t && t.id && t.filename);

    if (!validTransactions || validTransactions.length === 0) {
        historyContainer.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4 text-gray-500">
                    Belum ada transaksi
                </td>
            </tr>
        `;
        if (historyEmpty) historyEmpty.classList.remove('hidden');
        updateMonthlySalesChart(); // Tambahkan ini
        return;
    }

    historyContainer.innerHTML = validTransactions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(transaction => `
            <tr class="hover:bg-gray-50 fade-in-item">
                <td class="px-4 py-2">${new Date(transaction.date).toLocaleDateString('id-ID')}</td>
                <td class="px-4 py-2">${transaction.invoiceNumber || '-'}</td>
                <td class="px-4 py-2">${transaction.customerName}</td>
                <td class="px-4 py-2 text-right">${formatCurrency(transaction.total)}</td>
                <td class="px-4 py-2 text-center">
                    <button onclick="viewTransaction('${transaction.filename}')" class="text-blue-600 hover:text-blue-800 mx-1">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="editTransaction('${transaction.filename}')" class="text-green-600 hover:text-green-800 mx-1">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteTransaction('${transaction.filename}')" class="text-red-600 hover:text-red-800 mx-1">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    if (historyEmpty) historyEmpty.classList.add('hidden');
    updateMonthlySalesChart(); // Tambahkan ini
}

// Event delegation untuk tombol WhatsApp (agar tetap berfungsi meskipun tombol di-render ulang)
document.addEventListener('click', function(e) {
  if (e.target && (e.target.id === 'share-whatsapp' || e.target.closest('#share-whatsapp'))) {
    if (window.viewingTransaction) {
      shareInvoiceViaWhatsApp(window.viewingTransaction);
    } else {
      alert('Data transaksi tidak ditemukan!');
    }
  }
});

// Function to update monthly sales chart
function updateMonthlySalesChart() {
    const ctx = document.getElementById('monthly-sales-chart');
    if (!ctx) return;

    // Get current month's transactions
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthlyTransactions = transactions.filter(transaction => {
        const transactionDate = new Date(transaction.date);
        return transactionDate.getMonth() === currentMonth && 
               transactionDate.getFullYear() === currentYear;
    });

    // Group transactions by date
    const dailySales = {};
    monthlyTransactions.forEach(transaction => {
        const date = new Date(transaction.date).getDate();
        if (!dailySales[date]) {
            dailySales[date] = 0;
        }
        dailySales[date] += transaction.total;
    });

    // Prepare data for chart
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const labels = Array.from({length: daysInMonth}, (_, i) => i + 1);
    const data = labels.map(day => dailySales[day] || 0);

    // Calculate total sales
    const totalSales = monthlyTransactions.reduce((sum, transaction) => sum + transaction.total, 0);
    document.getElementById('monthly-sales-total').textContent = `Total: ${formatCurrency(totalSales)}`;

    // Group sales by product
    const productSales = {};
    monthlyTransactions.forEach(transaction => {
        transaction.items.forEach(item => {
            if (!productSales[item.name]) {
                productSales[item.name] = {
                    quantity: 0,
                    total: 0
                };
            }
            productSales[item.name].quantity += item.quantity;
            productSales[item.name].total += item.subtotal;
        });
    });

    // Update product sales list
    const productList = document.getElementById('monthly-product-sales-items');
    const emptyMessage = document.getElementById('monthly-product-sales-empty');
    
    if (Object.keys(productSales).length === 0) {
        productList.innerHTML = '';
        emptyMessage.classList.remove('hidden');
    } else {
        emptyMessage.classList.add('hidden');
        productList.innerHTML = Object.entries(productSales)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([name, data]) => `
                <li class="flex justify-between items-center">
                    <span>${name}</span>
                    <span class="text-gray-600">
                        ${data.quantity} x ${formatCurrency(data.total / data.quantity)} = ${formatCurrency(data.total)}
                    </span>
                </li>
            `).join('');
    }

    // Destroy existing chart if it exists
    if (monthlySalesChartInstance) {
        monthlySalesChartInstance.destroy();
    }

    // Create new chart
    monthlySalesChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Penjualan Harian',
                data: data,
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatCurrency(context.raw);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

// Function to save edited transaction
async function saveEditedTransaction() {
    try {
        // Ambil data dari form modal edit
        const customerName = document.getElementById('edit-customer-name').value.trim();
        const customerPhone = document.getElementById('edit-customer-phone').value.trim();
        const customerAddress = document.getElementById('edit-customer-address').value.trim();
        const notes = document.getElementById('edit-order-notes').value.trim();
        // Ambil produk
        const items = [];
        document.querySelectorAll('#edit-products-tbody tr').forEach(tr => {
            const name = tr.querySelector('.edit-product-name').value.trim();
            const qty = parseInt(tr.querySelector('.edit-product-qty').value) || 0;
            const price = parseFloat(tr.querySelector('.edit-product-price').value) || 0;
            if (name && qty > 0 && price >= 0) {
                items.push({ name, quantity: qty, price, subtotal: qty * price });
            }
        });
        if (!customerName || items.length === 0) {
            showToast('Nama pelanggan dan minimal 1 produk wajib diisi', 'error');
            return;
        }
        // Hitung total
        const total = items.reduce((sum, item) => sum + item.subtotal, 0);
        // Siapkan data transaksi
        const transaction = {
            ...viewingTransaction,
            customerName,
            customerPhone,
            customerAddress,
            notes,
            items,
            total
        };
        // Kirim ke server
        const response = await fetch(`${API_BASE_URL}/api/transactions/${editingTransactionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(transaction)
        });
        if (!response.ok) throw new Error('Gagal menyimpan perubahan transaksi');
        // Update local array
        const idx = transactions.findIndex(t => t.filename === editingTransactionId);
        if (idx !== -1) transactions[idx] = transaction;
        updateTransactionHistory();
        updateMonthlySalesChart();
        document.getElementById('edit-transaction-modal').classList.add('hidden');
        showToast('Transaksi berhasil diperbarui', 'success');
    } catch (error) {
        showToast('Gagal menyimpan perubahan transaksi', 'error');
    }
}

// ... existing code ...
// Event listener untuk tombol Batal dan tombol close pada modal hapus transaksi
if (elements.deleteModal) {
    // Tombol Batal
    const cancelBtn = document.getElementById('cancel-delete');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            elements.deleteModal.classList.add('hidden');
        });
    }
    // Tombol close (X) jika ada
    const closeBtn = document.getElementById('close-delete-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            elements.deleteModal.classList.add('hidden');
        });
    }
}
// ... existing code ...

// Fungsi untuk menampilkan tab berdasarkan id
function showTab(tabId) {
    // Sembunyikan semua tab content
    document.querySelectorAll('.tab-content').forEach(tabContent => {
        tabContent.classList.add('hidden');
        tabContent.classList.remove('visible');
    });

    // Tampilkan tab content yang dipilih
    const activeTabContent = document.getElementById(tabId);
    if (activeTabContent) {
        activeTabContent.classList.remove('hidden');
        // Tambahkan class visible setelah penundaan singkat
        setTimeout(() => {
            activeTabContent.classList.add('visible');
        }, 50);
    }
}

// ... existing code ...
const editTransactionForm = document.getElementById('edit-transaction-form');
if (editTransactionForm) {
    editTransactionForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        // Ambil data dari form
        const customerName = document.getElementById('edit-customer-name').value.trim();
        const customerPhone = document.getElementById('edit-customer-phone').value.trim();
        const customerAddress = document.getElementById('edit-customer-address').value.trim();
        const notes = document.getElementById('edit-order-notes').value.trim();
        // Ambil produk
        const items = [];
        document.querySelectorAll('#edit-products-tbody tr').forEach(tr => {
            const name = tr.querySelector('.edit-product-name').value.trim();
            const qty = parseInt(tr.querySelector('.edit-product-qty').value) || 0;
            const price = parseFloat(tr.querySelector('.edit-product-price').value) || 0;
            if (name && qty > 0 && price >= 0) {
                items.push({ name, quantity: qty, price, subtotal: qty * price });
            }
        });
        if (!customerName || items.length === 0) {
            showToast('Nama pelanggan dan minimal 1 produk wajib diisi', 'error');
            return;
        }
        // Hitung total
        const total = items.reduce((sum, item) => sum + item.subtotal, 0);
        // Siapkan data transaksi
        const transaction = {
            ...viewingTransaction,
            customerName,
            customerPhone,
            customerAddress,
            notes,
            items,
            total
        };
        // Kirim ke server
        try {
            const response = await fetch(`${API_BASE_URL}/api/transactions/${editingTransactionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(transaction)
            });
            if (!response.ok) throw new Error('Gagal menyimpan perubahan transaksi');
            // Update local array
            const idx = transactions.findIndex(t => t.filename === editingTransactionId);
            if (idx !== -1) transactions[idx] = transaction;
            updateTransactionHistory();
            updateMonthlySalesChart();
            document.getElementById('edit-transaction-modal').classList.add('hidden');
            showToast('Transaksi berhasil diperbarui', 'success');
        } catch (error) {
            showToast('Gagal menyimpan perubahan transaksi', 'error');
        }
    });
}
// ... existing code ...

// ... existing code ...
// Event listener pencarian produk di modal edit transaksi
const editProductSearchInput = document.getElementById('edit-product-search');
const editProductSuggestions = document.getElementById('edit-product-suggestions');
const editSelectedProductId = document.getElementById('edit-selected-product-id');
const editSelectedProductPrice = document.getElementById('edit-selected-product-price');
const editProductQuantity = document.getElementById('edit-product-quantity');
const editProductPrice = document.getElementById('edit-product-price');
const editProductSubtotal = document.getElementById('edit-product-subtotal');
const addProductToEditOrderBtn = document.getElementById('add-product-to-edit-order');

console.log('addProductToEditOrderBtn:', addProductToEditOrderBtn);

if (editProductSearchInput && editProductSuggestions) {
    editProductSearchInput.addEventListener('input', function(e) {
        filterProducts(
            e.target.value,
            editProductSuggestions,
            editSelectedProductId,
            editSelectedProductPrice,
            editProductQuantity,
            editProductPrice,
            editProductSubtotal,
            addProductToEditOrderBtn
        );
        // Validasi tombol tambah produk
        validateAddProductToEditOrderBtn();
    });
    // Saat memilih produk dari suggestion, isi nama produk ke input
    editProductSuggestions.addEventListener('click', function(e) {
        const li = e.target.closest('li');
        if (li && li.dataset && li.dataset.productName) {
            editProductSearchInput.value = li.dataset.productName;
            validateAddProductToEditOrderBtn();
        }
    });
}
if (addProductToEditOrderBtn) {
    console.log('Adding click event listener to addProductToEditOrderBtn');
    addProductToEditOrderBtn.addEventListener('click', function() {
        console.log('addProductToEditOrderBtn clicked');
        const name = editProductSearchInput.value.trim();
        const qty = parseInt(editProductQuantity.value) || 1;
        const price = parseFloat(editSelectedProductPrice.value) || 0;
        if (!name || qty <= 0 || price < 0) return;
        // Cek apakah produk sudah ada di tabel
        const tbody = document.getElementById('edit-products-tbody');
        let existingRow = null;
        tbody.querySelectorAll('tr').forEach(tr => {
            const inputName = tr.querySelector('.edit-product-name').value.trim();
            const inputPrice = parseFloat(tr.querySelector('.edit-product-price').value) || 0;
            if (inputName === name && inputPrice === price) {
                existingRow = tr;
            }
        });
        if (existingRow) {
            // Akumulasi qty
            const qtyInput = existingRow.querySelector('.edit-product-qty');
            qtyInput.value = parseInt(qtyInput.value) + qty;
            // Update subtotal baris
            const priceInput = existingRow.querySelector('.edit-product-price');
            const subtotalSpan = existingRow.querySelector('.edit-product-subtotal');
            if (qtyInput && priceInput && subtotalSpan) {
                subtotalSpan.textContent = formatCurrency(parseInt(qtyInput.value) * parseFloat(priceInput.value));
            }
        } else {
            // Tambahkan baris baru
            const idx = tbody.querySelectorAll('tr').length;
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td class="border px-2 py-1">
                <input type="text" class="edit-product-name w-full" value="${name}" data-idx="${idx}">
              </td>
              <td class="border px-2 py-1">
                <input type="number" class="edit-product-qty w-16 text-center" min="1" value="${qty}" data-idx="${idx}">
              </td>
              <td class="border px-2 py-1">
                <input type="number" class="edit-product-price w-24 text-right" min="0" value="${price}" data-idx="${idx}">
              </td>
              <td class="border px-2 py-1 text-right">
                <span class="edit-product-subtotal">${formatCurrency(price * qty)}</span>
              </td>
              <td class="border px-2 py-1 text-center">
                <button type="button" class="text-red-500 hover:text-red-700 edit-remove-product" data-idx="${idx}"><i class="fas fa-trash"></i></button>
              </td>
            `;
            tbody.appendChild(tr);
        }
        updateEditOrderTotal();
        // Reset input
        editProductSearchInput.value = '';
        editSelectedProductId.value = '';
        editSelectedProductPrice.value = '';
        editProductQuantity.value = 1;
        if (editProductSubtotal) editProductSubtotal.textContent = 'Rp 0';
        addProductToEditOrderBtn.disabled = true;
    });
}
// ... existing code ...

// ... existing code ...
if (editProductQuantity && editProductSubtotal && editSelectedProductPrice) {
    // Update subtotal saat qty berubah
    editProductQuantity.addEventListener('input', function() {
        const price = parseFloat(editSelectedProductPrice.value) || 0;
        const qty = parseInt(editProductQuantity.value) || 0;
        editProductSubtotal.textContent = formatCurrency(price * qty);
    });
    // Update subtotal saat harga produk berubah (misal user pilih produk lain)
    editSelectedProductPrice.addEventListener('input', function() {
        const price = parseFloat(editSelectedProductPrice.value) || 0;
        const qty = parseInt(editProductQuantity.value) || 0;
        editProductSubtotal.textContent = formatCurrency(price * qty);
    });
}
// ... existing code ...

// Tambahkan validasi tombol tambah produk manual di modal edit
function validateAddProductToEditOrderBtn() {
    const name = editProductSearchInput.value.trim();
    const price = parseFloat(editSelectedProductPrice.value) || 0;
    if (name && price > 0) {
        addProductToEditOrderBtn.disabled = false;
    } else {
        addProductToEditOrderBtn.disabled = true;
    }
}
// Aktifkan validasi juga pada input harga dan qty
if (editSelectedProductPrice) {
    editSelectedProductPrice.addEventListener('input', validateAddProductToEditOrderBtn);
}
if (editProductQuantity) {
    editProductQuantity.addEventListener('input', validateAddProductToEditOrderBtn);
}
// ... existing code ...

async function saveProduct(event) {
    event.preventDefault();
    const form = event.target;
    const productId = form.querySelector('#product-id').value;
    const productData = {
        id: productId || 'prod_' + Math.random().toString(36).substr(2, 12), // Pastikan ID tergenerate untuk produk baru
        name: form.querySelector('#product-name').value.trim(), // Trim nama produk
        price: parseFloat(form.querySelector('#product-price').value) || 0,
        description: form.querySelector('#product-description').value.trim() || '', // Trim deskripsi
        stock: parseInt(form.querySelector('#product-stock').value) || 0
    };

    console.log('Saving product:', productData); // Log data produk

    // Validasi data minimal
    if (!productData.name || productData.price < 0 || productData.stock < 0) {
        showToast('Nama produk, harga, dan stok harus valid.', 'error');
        console.error('Invalid product data:', productData);
        return;
    }

    try {
        let currentProducts = Array.isArray(products) ? [...products] : [];
        const index = currentProducts.findIndex(p => p.id === productId);

        if (index !== -1) {
            // Update existing product
            currentProducts[index] = productData;
            console.log('Updating existing product (local array):', currentProducts[index]);
        } else {
            // Add new product
            currentProducts.push(productData);
            console.log('Adding new product (local array):', productData);
        }

        // Simpan seluruh array produk ke server
        console.log('Sending full products array to server:', currentProducts);
        const response = await fetch(`${API_BASE_URL}/api/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(currentProducts)
        });

        console.log('Server response status:', response.status); // Log status response

        if (!response.ok) {
            // Coba baca response body untuk error message dari server
            const errorText = await response.text();
            console.error('Server responded with error:', response.status, errorText); // Log detail error dari server
            throw new Error(`Gagal menyimpan produk: ${response.status} - ${errorText}`);
        }

        // Asumsikan server mengembalikan data produk yang diperbarui, muat ulang saja dari server
        console.log('Product saved successfully on server. Reloading product list.');
        await loadProducts(); // Muat ulang data produk dari server

        document.getElementById('product-modal').classList.add('hidden');
        form.reset();
        showToast(productId ? 'Produk berhasil diperbarui!' : 'Produk berhasil ditambahkan!', 'success');
    } catch (error) {
        console.error('Error saving product:', error); // Log error di catch block
        showToast('Gagal menyimpan produk: ' + error.message, 'error');
    }
}

// Add event listeners for product management
function setupProductEventListeners() {
    console.log('Setting up product event listeners...'); // Tambah log

    // Add new product button
    const addProductBtn = document.getElementById('add-new-product');
    if (addProductBtn) {
        addProductBtn.addEventListener('click', () => {
            console.log('Add New Product button clicked. Resetting form...'); // Tambah log
            const modal = document.getElementById('product-modal');
            if (modal) {
                const productForm = document.getElementById('product-form');
                if (productForm) {
                    productForm.reset(); // Reset form
                    // Pastikan semua field penting dikosongkan manual juga untuk jaga-jaga
                    document.getElementById('product-id').value = '';
                    document.getElementById('product-name').value = '';
                    document.getElementById('product-price').value = '';
                    document.getElementById('product-stock').value = '';
                    document.getElementById('product-description').value = '';
                    console.log('Product form reset complete.'); // Tambah log
                }
                modal.classList.remove('hidden'); // Tampilkan modal
                console.log('Product modal shown.'); // Tambah log
            }
        });
    }

    // Product form submit (pastikan event listener ini terpasang sekali)
    const productForm = document.getElementById('product-form');
    if (productForm) {
        console.log('Adding submit listener to product form.'); // Tambah log
        productForm.removeEventListener('submit', saveProduct); // Hapus listener sebelumnya jika ada
        productForm.addEventListener('submit', saveProduct);
    }

    // Close product modal button
    const closeProductModal = document.getElementById('close-product-modal');
    if (closeProductModal) {
        console.log('Adding click listener to close product modal button.'); // Tambah log
        closeProductModal.removeEventListener('click', closeProductModalHandler); // Hapus listener sebelumnya jika ada
        closeProductModal.addEventListener('click', closeProductModalHandler);
    }
    // Handler untuk menutup modal produk
    function closeProductModalHandler() {
         const modal = document.getElementById('product-modal');
         if (modal) modal.classList.add('hidden');
         console.log('Product modal hidden.'); // Tambah log
    }

}