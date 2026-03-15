const messId = localStorage.getItem("mess_id");

// basic guard
(function(){
    const role = localStorage.getItem("role");
    if (role !== "owner") {
        alert("Access denied. Please log in as owner.");
        window.location.href = "login.html";
    }
})();

/* -------------------------
   ADD MENU ITEM
--------------------------*/
async function addItem() {
    const item_name = document.getElementById("itemName").value.trim();
    const item_price = document.getElementById("itemPrice").value;
    const category = document.getElementById("itemCategory").value;

    if (!item_name || !item_price) {
        document.getElementById("message").innerText = "Please fill all fields";
        return;
    }

    try {
        const res = await fetch(`http://localhost:5000/api/menu/${messId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ item_name, item_price, category })
        });

        const data = await res.json();
        document.getElementById("message").innerText = data.message || data.error;
        document.getElementById("itemName").value = "";
        document.getElementById("itemPrice").value = "";
        loadMenu();
    } catch (err) {
        console.error(err);
        document.getElementById("message").innerText = "Error adding item";
    }
}

/* -------------------------
   LOAD MENU ITEMS
--------------------------*/
async function loadMenu() {
    try {
        const res = await fetch(`http://localhost:5000/api/menu/${messId}`);
        const items = await res.json();
        const container = document.getElementById("menuList");

        if (items.length === 0) {
            container.innerHTML = "<p style='color:#7f8c8d;'>No items yet. Add some!</p>";
            return;
        }

        container.innerHTML = items.map(item => `
            <div style="display:flex; justify-content:space-between; align-items:center;
                        background:#f8f9fa; padding:12px; margin:8px 0;
                        border-radius:8px; border-left:4px solid #667eea;">
                <div>
                    <b style="color:#2c3e50;">${item.item_name}</b>
                    <span style="color:#7f8c8d; font-size:12px; margin-left:8px;">${item.category}</span><br>
                    <span style="color:#27ae60; font-weight:700;">₹${item.item_price}</span>
                </div>
                <button onclick="deleteItem(${item.item_id})"
                    style="width:auto; padding:6px 12px; background:#e74c3c; font-size:12px;">
                    Delete
                </button>
            </div>
        `).join("");
    } catch (err) {
        console.error(err);
        document.getElementById("menuList").innerHTML = "<p style='color:#e74c3c;'>Error loading menu</p>";
    }
}

/* -------------------------
   DELETE MENU ITEM
--------------------------*/
async function deleteItem(itemId) {
    try {
        const res = await fetch(`http://localhost:5000/api/menu/item/${itemId}`, {
            method: "DELETE"
        });
        const data = await res.json();
        if (res.ok) loadMenu();
        else alert(data.error || "Failed to delete item");
    } catch (err) {
        console.error(err);
        alert("Error deleting item");
    }
}

/* -------------------------
   LOAD ORDERS
--------------------------*/
async function loadOrders() {
    try {
        const res = await fetch(`http://localhost:5000/api/orders/${messId}`);
        const orders = await res.json();
        const container = document.getElementById("ordersList");

        if (orders.length === 0) {
            container.innerHTML = "<p style='color:#7f8c8d;'>No orders yet.</p>";
            return;
        }

        container.innerHTML = orders.map(order => {
           const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
            return `
                <div style="background:#f8f9fa; padding:15px; margin:10px 0;
                            border-radius:8px; border-left:4px solid #27ae60;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <b style="color:#2c3e50;">Order #${order.cashfree_order_id}</b>
                        <span style="color:#27ae60; font-weight:700;">₹${order.total_amount}</span>
                    </div>
                    <p style="color:#7f8c8d; font-size:13px; margin:5px 0;">
                        👤 ${order.customer_name} | 📞 ${order.customer_phone}
                    </p>
                    <p style="color:#7f8c8d; font-size:12px; margin:5px 0;">
                        🕒 ${new Date(order.created_at).toLocaleString()}
                    </p>
                    <div style="margin-top:8px;">
                        ${items.map(item => `
                            <span style="display:inline-block; background:#667eea; color:white;
                                        padding:3px 8px; border-radius:12px; font-size:12px; margin:2px;">
                                ${item.name} x${item.quantity}
                            </span>
                        `).join("")}
                    </div>
                </div>
            `;
        }).join("");
    } catch (err) {
        console.error(err);
        document.getElementById("ordersList").innerHTML = "<p style='color:#e74c3c;'>Error loading orders</p>";
    }
}

// load on page open
loadMenu();
loadOrders();