const params = new URLSearchParams(window.location.search);
const messId = params.get("id");
const cart = {};
let messName = '';

async function loadMenu() {
    try {
        showLoading();

        if (!messId) {
            document.getElementById("menuContainer").innerHTML = "<p style='color:white; text-align: center;'>❌ Invalid mess ID</p>";
            hideLoading();
            showToast('Invalid mess ID', 'error');
            return;
        }

        // load mess name
        const messRes = await fetch(`http://localhost:5000/api/mess/${messId}`);
        if (!messRes.ok) throw new Error("Failed to load mess");
        
        const mess = await messRes.json();
        messName = mess.name;
        document.getElementById("messTitle").innerText = `${mess.name} 🍽️`;

        // load menu items
        const res = await fetch(`http://localhost:5000/api/menu/${messId}`);
        if (!res.ok) throw new Error("Failed to load menu");
        
        const items = await res.json();

        if (items.length === 0) {
            document.getElementById("menuContainer").innerHTML = `
                <div class="dashboard" style="text-align:center;">
                    <p style="color:#7f8c8d;">No menu items available yet.</p>
                    <button style="width: auto; margin-top: 15px; background: #667eea;" onclick="window.history.back()">← Go Back</button>
                </div>`;
            hideLoading();
            return;
        }

        // group by category
        const categories = {};
        items.forEach(item => {
            if (!categories[item.category]) categories[item.category] = [];
            categories[item.category].push(item);
        });

        // render menu
        const container = document.getElementById("menuContainer");
        container.innerHTML = "";

        Object.keys(categories).forEach(category => {
            const section = document.createElement("div");
            section.className = "dashboard";
            section.style.marginBottom = "20px";
            section.innerHTML = `<h2>${category}</h2>`;

            categories[category].forEach(item => {
                const div = document.createElement("div");
                div.style.cssText = `
                    display:flex; justify-content:space-between; align-items:center;
                    padding:12px; margin:8px 0; background:#f8f9fa;
                    border-radius:8px; border-left:4px solid #667eea;
                `;
                div.innerHTML = `
                    <div>
                        <b style="color:#2c3e50;">${item.item_name}</b><br>
                        <span style="color:#27ae60; font-weight:700;">${formatCurrency(item.item_price)}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button onclick="changeQty(${item.item_id}, -1, '${item.item_name.replace(/'/g, "\\'")}', ${item.item_price})"
                            style="width:35px; padding:5px; font-size:18px; background: #e74c3c;">-</button>
                        <span id="qty_${item.item_id}" style="font-weight:700; min-width:20px; text-align:center;">0</span>
                        <button onclick="changeQty(${item.item_id}, 1, '${item.item_name.replace(/'/g, "\\'")}', ${item.item_price})"
                            style="width:35px; padding:5px; font-size:18px; background: #27ae60;">+</button>
                    </div>
                `;
                section.appendChild(div);
            });

            container.appendChild(section);
        });

        hideLoading();
        showToast(`Welcome to ${messName}`, 'info');

    } catch (error) {
        console.error("Error loading menu:", error);
        hideLoading();
        document.getElementById("menuContainer").innerHTML = `
            <div class="dashboard" style="text-align:center;">
                <p style="color:#e74c3c; font-weight: 600;">❌ Unable to load menu</p>
                <p style="color:#7f8c8d; font-size: 14px;">Make sure backend is running on http://localhost:5000</p>
                <button style="width: auto; margin-top: 15px; background: #667eea;" onclick="loadMenu()">Retry</button>
                <button style="width: auto; margin-top: 10px; background: #7f8c8d;" onclick="window.history.back()">← Go Back</button>
            </div>`;
        showToast('Failed to load menu', 'error');
    }
}

function changeQty(itemId, delta, itemName, itemPrice) {
    if (!cart[itemId]) {
        cart[itemId] = { item_id: itemId, name: itemName, price: itemPrice, quantity: 0 };
    }
    cart[itemId].quantity += delta;
    if (cart[itemId].quantity < 0) cart[itemId].quantity = 0;

    document.getElementById(`qty_${itemId}`).innerText = cart[itemId].quantity;
    updateCart();
}

function updateCart() {
    const cartItems = Object.values(cart).filter(item => item.quantity > 0);
    const cartSection = document.getElementById("cartSection");
    const cartItemsDiv = document.getElementById("cartItems");
    const cartTotal = document.getElementById("cartTotal");

    if (cartItems.length === 0) {
        cartSection.style.display = "none";
        return;
    }

    cartSection.style.display = "block";
    cartItemsDiv.innerHTML = cartItems.map(item => `
        <div style="display:flex; justify-content:space-between; padding:10px 0; 
                    border-bottom:1px solid #ecf0f1; font-size: 14px;">
            <span>${item.name} <strong>x${item.quantity}</strong></span>
            <span style="color:#27ae60; font-weight:700;">${formatCurrency(item.price * item.quantity)}</span>
        </div>
    `).join("");

    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cartTotal.innerText = `Total: ${formatCurrency(total)}`;
}

async function placeOrder() {
    const customer_name = document.getElementById("customerName").value.trim();
    const customer_phone = document.getElementById("customerPhone").value.trim();
    const customer_email = document.getElementById("customerEmail")?.value.trim() || '';

    // Validation
    if (!customer_name) {
        showToast('Please enter your name', 'warning');
        return;
    }

    if (!validateName(customer_name)) {
        showToast('Name must be between 2-100 characters', 'warning');
        return;
    }

    if (!customer_phone) {
        showToast('Please enter your phone number', 'warning');
        return;
    }

    if (!validatePhone(customer_phone)) {
        showToast('Please enter a valid 10-digit phone number', 'warning');
        return;
    }

    const cartItems = Object.values(cart)
        .filter(item => item.quantity > 0)
        .map(item => ({
            item_id: item.item_id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
        }));

    if (cartItems.length === 0) {
        showToast('Please add items to your order', 'warning');
        return;
    }

    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Confirmation
    const confirmed = confirm(`Order Summary:\n\nMess: ${messName}\nTotal Amount: ₹${total}\n\nConfirm order?`);
    if (!confirmed) return;

    try {
        showLoading();

        const res = await fetch("http://localhost:5000/api/orders/place", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                mess_id: parseInt(messId),
                customer_name,
                customer_phone,
                customer_email,
                items: cartItems
            })
        });

        hideLoading();

        const data = await res.json();

        if (res.ok) {
            // Save order ID for tracking
            const orderId = data.order_id;
            
            // Save user session with visitor role
            saveUserSession('visitor', null, customer_phone, customer_name);

            // Show success modal
            document.getElementById("orderId").innerText = `#${orderId}`;
            document.getElementById("orderTotal").innerText = `Total Paid: ${formatCurrency(data.total_amount)}`;
            document.getElementById("successModal").style.display = "flex";

            showToast('Order placed successfully! 🎉', 'success');

            // Reset form
            Object.keys(cart).forEach(key => {
                cart[key].quantity = 0;
                const qtyEl = document.getElementById(`qty_${key}`);
                if (qtyEl) qtyEl.innerText = "0";
            });
            updateCart();
            document.getElementById("customerName").value = "";
            document.getElementById("customerPhone").value = "";
            if (document.getElementById("customerEmail")) {
                document.getElementById("customerEmail").value = "";
            }
        } else {
            showToast(data.error || "Failed to place order", 'error');
        }

    } catch (err) {
        console.error("Order placement error:", err);
        hideLoading();
        showToast('Failed to place order. Please try again.', 'error');
    }
}

function closeSuccessModal() {
    document.getElementById("successModal").style.display = "none";
    setTimeout(() => {
        window.location.href = `track-order.html?phone=${encodeURIComponent(document.getElementById("customerPhone").value)}`;
    }, 500);
}

/* ========================
   INITIALIZE PAGE
======================== */

document.addEventListener('DOMContentLoaded', () => {
    loadMenu();

    // Check if email field exists and add to cart update
    const emailField = document.getElementById("customerEmail");
    if (emailField) {
        emailField.addEventListener('blur', (e) => {
            if (e.target.value && !validateEmail(e.target.value)) {
                showToast('Please enter a valid email address', 'warning');
            }
        });
    }
});