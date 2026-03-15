async function loadMess(){
    try {
        const res = await fetch("http://localhost:5000/api/mess");
        if (!res.ok) {
            document.getElementById("mess-container").innerText = "Unable to load messes.";
            return;
        }
        const messes = await res.json();
        const container = document.getElementById("mess-container");
        container.innerHTML = "";
        messes.forEach(mess => {
            const card = document.createElement("div");
            card.className = "mess-card";
            card.innerHTML = `
                <img src="Hostel_Mess_small.jpg" class="mess-img">
                <div class="mess-info">
                    <h2>${mess.name}</h2>
                    <p class="location">📍 ${mess.location}</p>
                    <p class="price">₹${mess.monthly_price} / month</p>
                    <p class="rating">⭐ ${mess.rating} Rating</p>
                    <button onclick="orderFood(${mess.mess_id})"
                        style="background: linear-gradient(135deg, #27ae60, #2ecc71);">
                        Order Food 🍽️
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error("Error loading messes:", error);
        document.getElementById("mess-container").innerText = "Unable to load messes. Make sure backend is running.";
    }
}

function orderFood(id){
    window.location.href = "mess.html?id=" + id;
}

loadMess();