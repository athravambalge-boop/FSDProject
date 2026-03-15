const params = new URLSearchParams(window.location.search);
const messId = params.get("id");
const cart = {};

async function loadMenu() {
    try {
        if (!messId) {
            document.getElementById("menuContainer").innerHTML = "<p style='color:white;'>Invalid mess ID</p>";
            return;
        }

        // load mess name
        const messRes = await fetch(`http://localhost:5000/api/mess/${messId}`);
        const mess = await messRes.json();
        document.getElementById("messTitle").innerText = `${mess.name} 🍽️`;

        // load menu items
        const res = await fetch(`http://localhost:5000/api/menu/${messId}`);
        const items = await res.json();

        if (items.length === 0) {
            document.getElementById("menuContainer").innerHTML = `
                <div class="dashboard" style="text-align:center;">
                    <p style="color:#7f8c8d;">No menu items available yet.</p>
                </div>`;
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
                        <span style="color:#27ae60; font-weight:700;">₹${item.item_price}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button onclick="changeQty(${item.item_id}, -1, '${item.item_name}', ${item.item_price})"
                            style="width:35px; padding:5px; font-size:18px;">-</button>
                        <span id="qty_${item.item_id}" style="font-weight:700; min-width:20px; text-align:center;">0</span>
                        <button onclick="changeQty(${item.item_id}, 1, '${item.item_name}', ${item.item_price})"
                            style="width:35px; padding:5px; font-size:18px;">+</button>
                    </div>
                `;
                section.appendChild(div);
            });

            container.appendChild(section);
        });

    } catch (error) {
        console.error("Error loading menu:", error);
        document.getElementById("menuContainer").innerHTML = 
            "<p style='color:white;'>Unable to load menu. Make sure backend is running.</p>";
    }
}

function changeQty(itemId, delta, itemName, itemPrice) {
    if (!cart[itemId]) {
        cart[itemId] = { name: itemName, price: itemPrice, quantity: 0 };
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
        <div style="display:flex; justify-content:space-between; padding:8px 0; 
                    border-bottom:1px solid #ecf0f1;">
            <span>${item.name} x${item.quantity}</span>
            <span style="color:#27ae60; font-weight:700;">₹${item.price * item.quantity}</span>
        </div>
    `).join("");

    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cartTotal.innerText = `Total: ₹${total}`;
}

async function placeOrder() {
    const customer_name = document.getElementById("customerName").value.trim();
    const customer_phone = document.getElementById("customerPhone").value.trim();

    if (!customer_name || !customer_phone) {
        alert("Please enter your name and phone number");
        return;
    }

    if (customer_phone.length < 10) {
        alert("Please enter a valid phone number");
        return;
    }

    const cartItems = Object.entries(cart)
        .filter(([_, item]) => item.quantity > 0)
        .map(([id, item]) => ({
            item_id: id,
            name: item.name,
            price: item.price,
            quantity: item.quantity
        }));

    if (cartItems.length === 0) {
        alert("Please add items to your order");
        return;
    }

    try {
        const res = await fetch("http://localhost:5000/api/orders/place", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                mess_id: messId,
                customer_name,
                customer_phone,
                items: cartItems
            })
        });

        const data = await res.json();

        if (res.ok) {
            // show success modal
            document.getElementById("orderId").innerText = data.order_id;
            document.getElementById("orderTotal").innerText = `Total Paid: ₹${data.total_amount}`;
            document.getElementById("successModal").style.display = "flex";

            // reset cart
            Object.keys(cart).forEach(key => {
                cart[key].quantity = 0;
                const qtyEl = document.getElementById(`qty_${key}`);
                if (qtyEl) qtyEl.innerText = "0";
            });
            updateCart();
            document.getElementById("customerName").value = "";
            document.getElementById("customerPhone").value = "";
        } else {
            alert(data.error || "Failed to place order");
        }

    } catch (err) {
        console.error(err);
        alert("Something went wrong. Please try again.");
    }
}

function closeSuccessModal() {
    document.getElementById("successModal").style.display = "none";
}

loadMenu();