async function loadMess(){
    try {
        const res = await fetch("http://localhost:5000/api/mess");
        if (!res.ok) {
            console.error("Failed to fetch mess list");
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
<p class="price">₹${mess.price} / month</p>
<p class="rating">⭐ 4.2 Rating</p>
<button onclick="viewMenu(${mess.mess_id})">
View Menu
</button>
</div>
`;
            container.appendChild(card);
        });
    } catch (error) {
        console.error("Error loading messes:", error);
        document.getElementById("mess-container").innerText = "Unable to load messes. Make sure the backend server is running on http://localhost:5000";
    }
}

function viewMenu(id){

window.location.href = "mess.html?id=" + id;

}

loadMess();