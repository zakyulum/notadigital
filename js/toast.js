// Helper function to show toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    
    if (!toast || !toastMessage) {
        console.error('Toast elements not found');
        return;
    }

    // Clear any existing timeouts
    if (window.toastTimeout) {
        clearTimeout(window.toastTimeout);
    }

    // Set message
    toastMessage.textContent = message;
    
    // Set background color based on type
    toast.className = 'fixed bottom-4 right-4 p-4 rounded-lg shadow-lg min-w-[300px] max-w-[90%] z-[9999]';
    switch (type) {
        case 'success':
            toast.classList.add('bg-green-500');
            break;
        case 'error':
            toast.classList.add('bg-red-500');
            break;
        case 'warning':
            toast.classList.add('bg-yellow-500');
            break;
        case 'info':
            toast.classList.add('bg-blue-500');
            break;
    }

    // Show toast
    toast.classList.remove('hidden');
    
    // Hide after 3 seconds
    window.toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
} 