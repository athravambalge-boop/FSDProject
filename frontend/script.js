/* ========================
   LOAD MESSES WITH FILTERS
======================== */

async function loadMess(search = '', location = '', minPrice = '', maxPrice = '', minRating = '') {
    try {
        showLoading();

        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (location) params.append('location', location);
        if (minPrice) params.append('minPrice', minPrice);
        if (maxPrice) params.append('maxPrice', maxPrice);
        if (minRating) params.append('minRating', minRating);

        const url = params.toString() 
            ? `http://localhost:5000/api/mess?${params.toString()}`
            : `http://localhost:5000/api/mess`;

        const res = await fetch(url);
        if (!res.ok) {
            throw new Error("Unable to load messes");
        }

        const messes = await res.json();
        const container = document.getElementById("mess-container");
        
        // Fade out old content
        container.style.opacity = '0';
        container.style.transition = 'opacity 0.3s ease-out';
        
        // Wait for fade out, then update content
        await new Promise(resolve => setTimeout(resolve, 300));
        container.innerHTML = "";

        if (messes.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: white; grid-column: 1/-1; padding: 40px;"><p>No messes found. Try adjusting your filters.</p></div>';
            container.style.opacity = '1';
            hideLoading();
            return;
        }

        messes.forEach((mess, index) => {
            const card = document.createElement("div");
            card.className = "mess-card";
            card.style.opacity = '0';
            card.style.animation = `fadeIn 0.4s ease-out ${index * 0.05}s forwards`;
            card.innerHTML = `
                <img src="Hostel_Mess_small.jpg" class="mess-img" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22200%22%3E%3Crect fill=%22%23667eea%22 width=%22300%22 height=%22200%22/%3E%3Ctext fill=%22white%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3EMess Image%3C/text%3E%3C/svg%3E'">
                <div class="mess-info">
                    <h2>${mess.name}</h2>
                    <p class="location">📍 ${mess.location}</p>
                    <p class="price">₹${mess.monthly_price} / month</p>
                    <p class="rating">⭐ ${mess.rating || 'N/A'}</p>
                    <button onclick="orderFood(${mess.mess_id})" style="background: linear-gradient(135deg, #27ae60, #2ecc71); margin-top: 10px;">
                        Order Food 🍽️
                    </button>
                  </div>
            `;
            container.appendChild(card);
        });

        // Fade in new content
        container.style.opacity = '1';
        hideLoadingSmoothly();
    } catch (error) {
        console.error("Error loading messes:", error);
        const container = document.getElementById("mess-container");
        container.style.opacity = '0';
        container.style.transition = 'opacity 0.3s ease-out';
        
        await new Promise(resolve => setTimeout(resolve, 300));
        container.innerHTML = `
            <div style="text-align: center; color: white; grid-column: 1/-1; padding: 40px;">
                <p>❌ Unable to load messes. Make sure backend is running.</p>
                <button style="background: white; color: #667eea; margin-top: 10px;" onclick="loadMess()">Retry</button>
            </div>`;
        container.style.opacity = '1';
        hideLoadingSmoothly();
        showToast('Failed to load messes', 'error');
    }
}

/* ========================
   APPLY FILTERS
======================== */

function applyFilters() {
    const search = document.getElementById('searchInput').value;
    const location = document.getElementById('locationFilter').value;
    const minPrice = document.getElementById('minPrice').value;
    const maxPrice = document.getElementById('maxPrice').value;
    const minRating = document.getElementById('ratingFilter').value;

    loadMess(search, location, minPrice, maxPrice, minRating);
}

/* ========================
   NAVIGATE TO ORDER PAGE
======================== */

function orderFood(id) {
    window.location.href = `mess.html?id=${id}`;
}

/* ========================
   USER SESSION MANAGEMENT
======================== */

function initializeUserBar() {
    const session = getUserSession();
    const userInfo = document.getElementById('userInfo');
    const userLinks = document.getElementById('userLinks');
    const loginLink = document.getElementById('loginLink');
    const logoutBtn = document.getElementById('logoutBtn');

    if (session.role && session.customer_name) {
        userInfo.style.display = 'flex';
        logoutBtn.style.display = 'block';
        loginLink.style.display = 'none';
        userLinks.style.display = 'block';

        document.getElementById('userName').textContent = `Hi ${session.customer_name}!`;
        document.getElementById('userPhone').textContent = session.customer_phone || '';
    }
}

/* ========================
   INITIALIZE PAGE
======================== */

// Debounce function to avoid too many API calls
let debounceTimer;
function debounceSearch() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        applyFilters();
    }, 500);
}

document.addEventListener('DOMContentLoaded', () => {
    initializeUserBar();
    loadMess();

    // Add live search for all filter fields
    const searchInput = document.getElementById('searchInput');
    const locationFilter = document.getElementById('locationFilter');
    const minPrice = document.getElementById('minPrice');
    const maxPrice = document.getElementById('maxPrice');
    const ratingFilter = document.getElementById('ratingFilter');

    searchInput.addEventListener('keyup', debounceSearch);
    locationFilter.addEventListener('keyup', debounceSearch);
    minPrice.addEventListener('change', applyFilters);
    maxPrice.addEventListener('change', applyFilters);
    ratingFilter.addEventListener('change', applyFilters);
});