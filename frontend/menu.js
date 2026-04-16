const params = new URLSearchParams(window.location.search);
const messId = params.get("id");
const targetItemQuery = (params.get("item") || "").trim().toLowerCase();
const targetMessLabel = params.get("mess") || "";
const cart = {};
let messName = "";
let allMenuItems = [];
let lastOrderPhone = "";
let pendingOrderData = null;

function getCustomerDetailsFromSession() {
  const session = getUserSession();
  const savedAccount = getSavedVisitorAccount?.();

  return {
    name: session.customer_name || savedAccount?.name || "",
    phone: session.customer_phone || savedAccount?.phone || savedAccount?.contact || "",
    email: session.customer_email || savedAccount?.email || ""
  };
}

function prefillCustomerDetails() {
  const accountDetails = getCustomerDetailsFromSession();

  const customerNameInput = document.getElementById("customerName");
  const customerPhoneInput = document.getElementById("customerPhone");
  const customerEmailInput = document.getElementById("customerEmail");

  const customerName = accountDetails.name;
  const customerPhone = accountDetails.phone;
  const customerEmail = accountDetails.email;

  if (customerNameInput && customerName) {
    customerNameInput.value = customerName;
  }

  if (customerPhoneInput && customerPhone) {
    customerPhoneInput.value = customerPhone;
  }

  if (customerEmailInput && customerEmail) {
    customerEmailInput.value = customerEmail;
  }
}

function getSelectedPaymentMethod() {
  const selected = document.querySelector('input[name="paymentMethod"]:checked');
  return selected ? selected.value : "online";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getFoodImage(item) {
  const itemName = String(item?.item_name || "").trim().toLowerCase();

  if (itemName.includes("poha")) {
    return "poha.jpg";
  }

  if (itemName.includes("samosa")) {
    return "samosa.avif";
  }

  if (itemName.includes("dosa")) {
    return "dosa.jpg";
  }

  if (itemName.includes("upma")) {
    return "upma.jpg";
  }

  if (itemName.includes("maggi")) {
    return "maggi.webp";
  }

  if (itemName.includes("medu vada") || itemName.includes("medu wada")) {
    return "medu vada.jpg";
  }

  if (itemName.includes("vada pav") || itemName.includes("wada pav")) {
    return "vada pav.png";
  }

  if (itemName.includes("uthappa") || itemName.includes("uttappa")) {
    return "uthappa.avif";
  }

  if (
    itemName.includes("white sauce pasta") ||
    itemName.includes("whitesauce pasta") ||
    itemName.includes("white pasta")
  ) {
    return "whitesaucepasta.jpg";
  }

  if (itemName.includes("paneer puff")) {
    return "PaneerPuff.jpg";
  }

  if (itemName.includes("cold coffee")) {
    return "cold coffee.png";
  }

  const seed = `${item.category || "food"}-${item.item_name || "item"}`;
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/640/360`;
}

function renderMenuItems(itemsToRender) {
  const container = document.getElementById("menuContainer");

  if (!itemsToRender || itemsToRender.length === 0) {
    container.innerHTML = `
      <div class="dashboard" style="text-align:center;">
        <p style="color:#7f8c8d;">No matching items found.</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="order-grid">
      ${itemsToRender.map(item => {
        const safeName = item.item_name.replace(/'/g, "\\'");
        const imageUrl = getFoodImage(item);
        const isTargetItem = targetItemQuery && String(item.item_name || "").toLowerCase().includes(targetItemQuery);
        return `
          <article class="order-card${isTargetItem ? ' target-menu-item' : ''}" id="menu-item-${item.item_id}">
            <img class="order-card-image" src="${imageUrl}" alt="${escapeHtml(item.item_name)}" loading="lazy"
              onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22640%22 height=%22360%22%3E%3Crect fill=%22%232b2f3c%22 width=%22640%22 height=%22360%22/%3E%3Ctext fill=%22white%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2230%22%3EMenu Item%3C/text%3E%3C/svg%3E'">
            <div class="order-card-body">
              <div class="order-card-title-row">
                <h3>${escapeHtml(item.item_name)}</h3>
                <span class="order-card-tag">${escapeHtml(item.category || "Meal")}</span>
              </div>
              <p class="order-card-desc">Freshly prepared at ${escapeHtml(messName)}.</p>
              <div class="order-card-footer">
                <span class="order-card-price">${formatCurrency(item.item_price)}</span>
                <div class="order-qty-controls">
                  <button class="qty-btn qty-minus" onclick="changeQty(${item.item_id}, -1, '${safeName}', ${item.item_price})">-</button>
                  <span id="qty_${item.item_id}" class="qty-value">${cart[item.item_id]?.quantity || 0}</span>
                  <button class="qty-btn qty-plus" onclick="changeQty(${item.item_id}, 1, '${safeName}', ${item.item_price})">+</button>
                </div>
              </div>
            </div>
          </article>`;
      }).join("")}
    </div>`;
}

function filterMenu() {
  const searchInput = document.getElementById("menuSearchInput");
  const query = (searchInput?.value || "").trim().toLowerCase();

  if (!query) {
    renderMenuItems(allMenuItems);
    return;
  }

  const filteredItems = allMenuItems.filter(item => {
    const name = (item.item_name || "").toLowerCase();
    const category = (item.category || "").toLowerCase();
    return name.includes(query) || category.includes(query);
  });

  renderMenuItems(filteredItems);
}

async function loadMenu() {
  try {
    showLoading();

    if (!messId) {
      document.getElementById("menuContainer").innerHTML = "<p style='color:white; text-align: center;'>Invalid mess ID</p>";
      hideLoading();
      showToast("Invalid mess ID", "error");
      return;
    }

    const messRes = await fetch(apiUrl(`mess/${messId}`));
    if (!messRes.ok) throw new Error("Failed to load mess");

    const mess = await messRes.json();
    messName = mess.name;
    document.getElementById("messTitle").innerText = targetMessLabel ? `Choose Order · ${mess.name} · ${targetMessLabel}` : `Choose Order · ${mess.name}`;

    const res = await fetch(apiUrl(`menu/${messId}`));
    if (!res.ok) throw new Error("Failed to load menu");

    const items = await res.json();

    if (items.length === 0) {
      document.getElementById("menuContainer").innerHTML = `
        <div class="dashboard" style="text-align:center;">
          <p style="color:#7f8c8d;">No menu items available yet.</p>
          <button style="width: auto; margin-top: 15px; background: #667eea;" onclick="window.history.back()">Go Back</button>
        </div>`;
      hideLoading();
      return;
    }

    allMenuItems = items;
    renderMenuItems(allMenuItems);

    if (targetItemQuery) {
      const searchInput = document.getElementById("menuSearchInput");
      if (searchInput) {
        searchInput.value = targetItemQuery;
      }

      filterMenu();

      const targetCard = document.querySelector('.target-menu-item');
      if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    hideLoading();
    showToast(`Welcome to ${messName}`, "info");
  } catch (error) {
    console.error("Error loading menu:", error);
    hideLoading();
    document.getElementById("menuContainer").innerHTML = `
      <div class="dashboard" style="text-align:center;">
        <p style="color:#e74c3c; font-weight: 600;">Unable to load menu</p>
        <p style="color:#7f8c8d; font-size: 14px;">Check backend URL: ${API_ORIGIN}</p>
        <button style="width: auto; margin-top: 15px; background: #667eea;" onclick="loadMenu()">Retry</button>
        <button style="width: auto; margin-top: 10px; background: #7f8c8d;" onclick="window.history.back()">Go Back</button>
      </div>`;
    showToast("Failed to load menu", "error");
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
    <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #ecf0f1; font-size: 14px;">
      <span>${item.name} <strong>x${item.quantity}</strong></span>
      <span style="color:#27ae60; font-weight:700;">${formatCurrency(item.price * item.quantity)}</span>
    </div>
  `).join("");

  const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  cartTotal.innerText = `Total: ${formatCurrency(total)}`;
}

function hideOrderSummary() {
  const orderSummarySection = document.getElementById("orderSummarySection");
  if (orderSummarySection) {
    orderSummarySection.style.display = "none";
    orderSummarySection.innerHTML = "";
  }
}

function renderOrderSummary(summary) {
  const orderSummarySection = document.getElementById("orderSummarySection");
  if (!orderSummarySection) {
    return;
  }

  const summaryItems = summary.items || summary.cartItems || [];
  const accountDetails = getCustomerDetailsFromSession();
  const customerName = summary.customerName || summary.customer_name || accountDetails.name;
  const customerPhone = summary.customerPhone || summary.customer_phone || accountDetails.phone;

  orderSummarySection.innerHTML = `
    <div class="dashboard order-summary-card">
      <h2>Order Summary</h2>
      <div class="order-summary-details">
        <div><span>Mess</span><strong>${escapeHtml(summary.messName)}</strong></div>
        <div><span>Customer</span><strong>${escapeHtml(customerName)}</strong></div>
        <div><span>Phone</span><strong>${escapeHtml(customerPhone)}</strong></div>
        <div><span>Payment</span><strong>${escapeHtml(summary.paymentLabel)}</strong></div>
      </div>
      <div class="order-summary-items">
        ${summaryItems.map(item => `
          <div class="order-summary-item">
            <span>${escapeHtml(item.name)} x${item.quantity}</span>
            <strong>${formatCurrency(item.price * item.quantity)}</strong>
          </div>
        `).join("")}
      </div>
      <div class="order-summary-total">
        <span>Total Amount</span>
        <strong>${formatCurrency(summary.total)}</strong>
      </div>
      <p class="order-summary-note">After confirming, you will scan the QR and upload the payment screenshot.</p>
      <div class="order-summary-actions">
        <button type="button" class="secondary-btn" onclick="cancelOrderSummary()">Cancel</button>
        <button type="button" onclick="confirmOrderSummary()">Confirm Order</button>
      </div>
    </div>`;
  orderSummarySection.style.display = "block";
  orderSummarySection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelOrderSummary() {
  pendingOrderData = null;
  hideOrderSummary();
}

async function confirmOrderSummary() {
  if (!pendingOrderData) {
    return;
  }

  const { customer_name, customer_phone, customer_email, items, total, paymentLabel } = pendingOrderData;

  try {
    showLoading();

    const res = await fetch(apiUrl("orders/place"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mess_id: parseInt(messId, 10),
        customer_name,
        customer_phone,
        customer_email,
        items,
        payment_method: "online"
      })
    });

    const data = await res.json();

    if (!res.ok) {
      hideLoading();
      return showToast(data.error || "Failed to place order", "error");
    }

    const orderId = data.order_id;
    lastOrderPhone = customer_phone;
    saveUserSession("visitor", null, customer_phone, customer_name);

    hideOrderSummary();
    pendingOrderData = null;
    showToast("Order created. Continue with QR payment.", "success");
    window.location.href = `payment-status.html?order_id=${encodeURIComponent(orderId)}&phone=${encodeURIComponent(customer_phone)}&amount=${encodeURIComponent(total.toFixed(2))}`;
  } catch (err) {
    console.error("Order placement error:", err);
    hideLoading();
    showToast(err.message || "Failed to place order. Please try again.", "error");
  }
}

async function placeOrder() {
  const customer_name = document.getElementById("customerName").value.trim();
  const customer_phone = document.getElementById("customerPhone").value.trim();
  const customer_email = document.getElementById("customerEmail")?.value.trim() || "";
  const selectedPaymentMethod = getSelectedPaymentMethod();

  if (!customer_name) return showToast("Please enter your name", "warning");
  if (!validateName(customer_name)) return showToast("Name must be between 2-100 characters", "warning");
  if (!customer_phone) return showToast("Please enter your phone number", "warning");
  if (!validatePhone(customer_phone)) return showToast("Please enter a valid 10-digit phone number", "warning");

  const cartItems = Object.values(cart)
    .filter(item => item.quantity > 0)
    .map(item => ({ item_id: item.item_id, name: item.name, price: item.price, quantity: item.quantity }));

  if (cartItems.length === 0) return showToast("Please add items to your order", "warning");

  const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const paymentLabel = "QR Payment + Receipt Upload";

  pendingOrderData = {
    customer_name,
    customer_phone,
    customer_email,
    items: cartItems,
    total,
    paymentLabel,
    messName
  };

  renderOrderSummary(pendingOrderData);
}

function closeSuccessModal() {
  document.getElementById("successModal").style.display = "none";
  setTimeout(() => {
    const phoneForRedirect = lastOrderPhone || document.getElementById("customerPhone").value;
    window.location.href = `track-order.html?phone=${encodeURIComponent(phoneForRedirect)}`;
  }, 500);
}

document.addEventListener("DOMContentLoaded", () => {
  loadMenu();
  prefillCustomerDetails();

  const menuSearchInput = document.getElementById("menuSearchInput");
  if (menuSearchInput) {
    menuSearchInput.addEventListener("input", filterMenu);
  }

  const emailField = document.getElementById("customerEmail");
  if (emailField) {
    emailField.addEventListener("blur", e => {
      if (e.target.value && !validateEmail(e.target.value)) {
        showToast("Please enter a valid email address", "warning");
      }
    });
  }
});
