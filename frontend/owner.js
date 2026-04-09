const messId = localStorage.getItem("mess_id");
const messName = localStorage.getItem("mess_name") || "My Mess";

/* ========================
   GUARD - CHECK OWNER ROLE
======================== */

(function() {
    const session = getUserSession();
    if (session.role !== "owner" || !messId) {
        showToast('Access denied. Please log in as owner.', 'error');
        setTimeout(() => {
            window.location.href = "login.html";
        }, 1000);
        return;
    }

    document.getElementById('messName').textContent = messName;
})();

/* ========================
   LOAD DASHBOARD STATS
======================== */
async function loadStats() {
    try {
        const res = await fetch(apiUrl(`orders/${messId}/stats/overview`));
        if (!res.ok) throw new Error('Failed to load stats');

        const stats = await res.json();

        document.getElementById('pendingCount').textContent = stats.pending_orders || 0;
        document.getElementById('readyCount').textContent = stats.completed_orders || 0;
        document.getElementById('completedCount').textContent = stats.completed_orders || 0;
        document.getElementById('revenueAmount').textContent = formatCurrency(stats.total_revenue || 0);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

/* ========================
   ADD MENU ITEM
======================== */

async function addItem() {
    const item_name = document.getElementById("itemName").value.trim();
    const item_price = document.getElementById("itemPrice").value;
    const category = document.getElementById("itemCategory").value;
    const messageDiv = document.getElementById("message");

    if (!item_name || !item_price) {
        messageDiv.textContent = "Please fill all fields";
        messageDiv.className = 'error';
        messageDiv.style.display = 'block';
        showToast('Please fill all fields', 'warning');
        return;
    }

    if (parseFloat(item_price) <= 0) {
        messageDiv.textContent = "Price must be greater than 0";
        messageDiv.className = 'error';
        messageDiv.style.display = 'block';
        showToast('Price must be greater than 0', 'warning');
        return;
    }

    try {
        showLoading();

        const res = await fetch(apiUrl(`menu/${messId}`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ item_name, item_price: parseFloat(item_price), category })
        });

        const data = await res.json();
        hideLoading();

        if (res.ok) {
            messageDiv.textContent = "Item added successfully! ✓";
            messageDiv.className = 'success';
            messageDiv.style.display = 'block';
            showToast('Item added successfully', 'success');
            
            document.getElementById("itemName").value = "";
            document.getElementById("itemPrice").value = "";
            loadMenu();

            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 3000);
        } else {
            throw new Error(data.error || 'Failed to add item');
        }
    } catch (error) {
        hideLoading();
        console.error('Error adding item:', error);
        messageDiv.textContent = error.message;
        messageDiv.className = 'error';
        messageDiv.style.display = 'block';
        showToast('Failed to add item', 'error');
    }
}

/* ========================
   LOAD MENU ITEMS
======================== */

async function loadMenu() {
    try {
        const res = await fetch(apiUrl(`menu/${messId}?include_unavailable=1`));
        if (!res.ok) throw new Error('Failed to load menu');
        
        const items = await res.json();
        const container = document.getElementById("menuList");

        if (!items || items.length === 0) {
            container.innerHTML = "<p style='color:#7f8c8d; text-align: center;'>No menu items yet. Add some!</p>";
            return;
        }

        container.innerHTML = items.map(item => `
            <div style="display:flex; justify-content:space-between; align-items:center;
                        background:#f8f9fa; padding:12px; margin:8px 0;
                        border-radius:8px; border-left:4px solid ${item.is_available ? '#27ae60' : '#95a5a6'};">
                <div>
                    <b style="color:#2c3e50;">${item.item_name}</b>
                    <span style="color:#7f8c8d; font-size:12px; margin-left:8px;">${item.category || 'Uncategorized'}</span><br>
                    <span style="color:#27ae60; font-weight:700;">${formatCurrency(item.item_price)}</span>
                    <span style="margin-left:10px; font-size:12px; font-weight:700; color:${item.is_available ? '#27ae60' : '#e67e22'};">
                        ${item.is_available ? 'Available' : 'Unavailable'}
                    </span>
                </div>
                <div style="display:flex; gap:8px;">
                    <button onclick="toggleItemAvailability(${item.item_id}, ${item.is_available ? 1 : 0})"
                        style="width:auto; padding:6px 12px; background:${item.is_available ? '#f39c12' : '#27ae60'}; font-size:12px;">
                        ${item.is_available ? 'Mark Unavailable' : 'Mark Available'}
                    </button>
                    <button onclick="deleteItem(${item.item_id})"
                        style="width:auto; padding:6px 12px; background:#e74c3c; font-size:12px;">
                        Delete
                    </button>
                </div>
            </div>
        `).join("");
    } catch (error) {
        console.error('Error loading menu:', error);
        document.getElementById("menuList").innerHTML = "<p style='color:#e74c3c;'>Error loading menu. Try refreshing the page.</p>";
        showToast('Failed to load menu', 'error');
    }
}

/* ========================
   TOGGLE ITEM AVAILABILITY
======================== */

async function toggleItemAvailability(itemId, currentAvailability) {
    const nextAvailability = currentAvailability ? 0 : 1;

    try {
        const res = await fetch(apiUrl(`menu/item/${itemId}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_available: nextAvailability })
        });

        const data = await res.json();

        if (res.ok) {
            showToast(nextAvailability ? 'Item marked available' : 'Item marked unavailable', 'success');
            loadMenu();
        } else {
            throw new Error(data.error || 'Failed to update availability');
        }
    } catch (error) {
        console.error('Error updating availability:', error);
        showToast(error.message, 'error');
    }
}

/* ========================
   DELETE MENU ITEM
======================== */

async function deleteItem(itemId) {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
        const res = await fetch(apiUrl(`menu/item/${itemId}`), {
            method: "DELETE"
        });
        const data = await res.json();
        
        if (res.ok) {
            showToast('Item deleted successfully', 'success');
            loadMenu();
        } else {
            throw new Error(data.error || 'Failed to delete item');
        }
    } catch (error) {
        console.error('Error deleting item:', error);
        showToast(error.message, 'error');
    }
}

/* ========================
   LOAD ORDERS
======================== */

async function loadOrders() {
    try {
        showLoading();

        const filter = document.getElementById('orderFilter')?.value || '';
        let url = apiUrl(`orders/${messId}`);
        if (filter) {
            url += `?status=${filter}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load orders');
        
        const orders = await res.json();
        hideLoading();

        const container = document.getElementById("ordersList");

        if (!orders || orders.length === 0) {
            container.innerHTML = "<p style='color:#7f8c8d; text-align: center;'>No orders yet.</p>";
            loadStats();
            return;
        }

        container.innerHTML = orders.map(order => {
            const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
            const statusClass = order.status.toLowerCase();
            
            return `
                <div class="order-item">
                    <div class="order-header">
                        <div>
                            <span class="order-id">Order #${order.order_id}</span>
                            <span style="color:#7f8c8d; font-size: 12px; margin-left: 10px;">${formatDate(order.created_at)}</span>
                        </div>
                        <span class="status-badge ${statusClass}">${order.status.toUpperCase()}</span>
                    </div>
                    
                    <div class="order-meta">
                        <div>
                            <strong>Customer:</strong><br>
                            ${order.customer_name}
                        </div>
                        <div>
                            <strong>Amount:</strong><br>
                            ${formatCurrency(order.total_amount)}
                        </div>
                    </div>

                    <div style="font-size: 12px; margin: 4px 0; color: #2c3e50;">
                        <strong>Payment:</strong> ${(order.payment_method || 'cash').toUpperCase()} | ${(order.payment_status || 'pending').toUpperCase()}
                    </div>

                    <div style="font-size: 12px; margin: 10px 0;">
                        <strong>📞 ${order.customer_phone}</strong>
                    </div>

                    <div style="margin: 10px 0;">
                        <p style="font-size: 13px; margin-bottom: 5px;"><strong>Items:</strong></p>
                        ${items.map(item => `
                            <span style="display:inline-block; background:#667eea; color:white;
                                        padding:4px 10px; border-radius:12px; font-size:12px; margin:2px;">
                                ${item.name} <strong>x${item.quantity}</strong>
                            </span>
                        `).join("")}
                    </div>

                    <div style="margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <select id="status_${order.order_id}" onchange="updateOrderStatus(${order.order_id})" 
                            style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
                            <option value="">Change Status...</option>
                            <option value="pending" ${order.status === 'pending' ? 'disabled' : ''}>Pending</option>
                            <option value="confirmed" ${order.status === 'confirmed' ? 'disabled' : ''}>Confirmed</option>
                            <option value="preparing" ${order.status === 'preparing' ? 'disabled' : ''}>Preparing</option>
                            <option value="ready" ${order.status === 'ready' ? 'disabled' : ''}>Ready</option>
                            <option value="completed" ${order.status === 'completed' ? 'disabled' : ''}>Completed</option>
                            <option value="cancelled" ${order.status === 'cancelled' ? 'disabled' : ''}>Cancelled</option>
                        </select>
                        ${order.status !== 'cancelled' && order.status !== 'completed' ? `
                            <button onclick="cancelOrder(${order.order_id}, '${order.customer_phone}')" 
                                style="background: #e74c3c; font-size: 12px;">
                                Cancel Order
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join("");

        loadStats();

    } catch (error) {
        console.error('Error loading orders:', error);
        hideLoading();
        document.getElementById("ordersList").innerHTML = "<p style='color:#e74c3c;'>Error loading orders</p>";
        showToast('Failed to load orders', 'error');
    }
}

/* ========================
   UPDATE ORDER STATUS
======================== */

async function updateOrderStatus(orderId) {
    const statusSelect = document.getElementById(`status_${orderId}`);
    const newStatus = statusSelect.value;

    if (!newStatus) return;

    try {
        showLoading();

        const res = await fetch(apiUrl(`orders/${orderId}/status`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus, mess_id: messId })
        });

        hideLoading();

        if (!res.ok) {
            try {
                const error = await res.json();
                throw new Error(error.error || `Failed to update order (${res.status})`);
            } catch (parseError) {
                throw new Error(`Server error: ${res.status} ${res.statusText}`);
            }
        }

        const data = await res.json();
        showToast(`Order status updated to ${newStatus}`, 'success');
        loadOrders();

    } catch (error) {
        console.error('Error updating order:', error);
        hideLoading();
        showToast(error.message || 'Failed to update order', 'error');
        statusSelect.value = '';
    }
}

/* ========================
   CANCEL ORDER
======================== */

async function cancelOrder(orderId, customerPhone) {
    if (!confirm('Cancel this order? (Customer will be notified)')) return;

    try {
        showLoading();

        const res = await fetch(apiUrl(`orders/${orderId}/cancel`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customer_phone: customerPhone })
        });

        hideLoading();

        if (!res.ok) {
            try {
                const error = await res.json();
                throw new Error(error.error || `Failed to cancel order (${res.status})`);
            } catch (parseError) {
                throw new Error(`Server error: ${res.status} ${res.statusText}`);
            }
        }

        const data = await res.json();
        showToast('Order cancelled successfully', 'success');
        loadOrders();

    } catch (error) {
        console.error('Error cancelling order:', error);
        hideLoading();
        showToast(error.message || 'Failed to cancel order', 'error');
    }
}

/* ========================
   DELETE ALL ORDERS
======================== */

async function deleteAllOrders() {
    const confirmation = prompt('Type DELETE to permanently remove all orders for your mess.');
    if (confirmation !== 'DELETE') {
        if (confirmation !== null) {
            showToast('Deletion cancelled. Confirmation text did not match.', 'warning');
        }
        return;
    }

    const session = getUserSession();
    const ownerContact = session.customer_contact;

    if (!ownerContact) {
        showToast('Session expired. Please log in again as owner.', 'error');
        return;
    }

    try {
        showLoading();

        const res = await fetch(apiUrl(`orders/${messId}/all`), {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ owner_contact: ownerContact })
        });

        hideLoading();

        if (!res.ok) {
            try {
                const error = await res.json();
                throw new Error(error.error || `Failed to delete orders (${res.status})`);
            } catch (parseError) {
                throw new Error(`Server error: ${res.status} ${res.statusText}`);
            }
        }

        const data = await res.json();
        const deletedCount = data.deleted_count || 0;
        showToast(`Deleted ${deletedCount} order${deletedCount === 1 ? '' : 's'} successfully`, 'success');
        loadOrders();
        loadStats();
    } catch (error) {
        console.error('Error deleting all orders:', error);
        hideLoading();
        showToast(error.message || 'Failed to delete all orders', 'error');
    }
}

/* ========================
   INITIALIZE PAGE
======================== */

document.addEventListener('DOMContentLoaded', () => {
    loadMenu();
    loadOrders();
    
    // Auto-refresh orders every 10 seconds
    setInterval(loadOrders, 10000);
});