async function loadMess(){
    try {
        const res = await fetch("http://localhost:5000/api/mess");
        if (!res.ok) {
            document.getElementById("messList").innerText = "Unable to load mess list";
            return;
        }
        const data = await res.json();
        const container = document.getElementById("messList");
        container.innerHTML = "";
        data.forEach(mess => {
            const div = document.createElement("div");
            div.innerHTML = `
<b>${mess.name}</b> - ${mess.location} - ₹${mess.monthly_price}
<div style="display: flex; gap: 5px; margin-left: auto;">
<button onclick="openEditModal(${mess.mess_id})" style="width: auto; padding: 8px 12px; font-size: 12px; background: #3498db;">Edit</button>
<button onclick="deleteMess(${mess.mess_id})" style="width: auto; padding: 8px 12px; font-size: 12px; background: #e74c3c;">Delete</button>
</div>
`;
            div.style.display = "flex";
            div.style.alignItems = "center";
            container.appendChild(div);
        });
    } catch (error) {
        console.error("Error loading messes:", error);
        document.getElementById("messList").innerText = "Unable to load messes. Make sure the backend server is running.";
    }
}

// ensure only admin can access
(function(){
    const role = localStorage.getItem("role");
    if (role !== "admin") {
        alert("Access denied. Please log in as admin.");
        window.location.href = "login.html";
    }
})();


/* ADD MESS */

async function addMess(){
    try {
        const name = document.getElementById("name").value;
        const location = document.getElementById("location").value;
        const price = document.getElementById("price").value;
        const veg_type = document.getElementById("veg_type").value;
        const contact_number = document.getElementById("contact_number").value;

        const res = await fetch("http://localhost:5000/api/mess",{
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify({
                name,
                location,
                price,
                veg_type,
                contact_number
            })
        });

        if (res.ok) {
            document.getElementById("name").value = "";
            document.getElementById("location").value = "";
            document.getElementById("price").value = "";
            document.getElementById("veg_type").value = "";
            document.getElementById("contact_number").value = "";
            loadMess();
        } else {
            alert("Failed to add mess");
        }
    } catch (error) {
        console.error("Error adding mess:", error);
        alert("Error adding mess. Make sure backend is running.");
    }
}


/* DELETE MESS */

async function deleteMess(id){
    const res = await fetch(`http://localhost:5000/api/mess/${id}`,{
        method:"DELETE"
    });
    if (!res.ok) {
        alert("Failed to delete mess");
    }
    loadMess();
}

loadMess();

// Edit Modal Functions
async function openEditModal(messId) {
    try {
        const res = await fetch(`http://localhost:5000/api/mess/${messId}`);
        if (!res.ok) {
            alert("Failed to load mess details");
            return;
        }
        const mess = await res.json();
        
        document.getElementById("editMessId").value = messId;
        document.getElementById("editName").value = mess.name;
        document.getElementById("editLocation").value = mess.location;
        document.getElementById("editPrice").value = mess.monthly_price;
        document.getElementById("editVegType").value = mess.veg_type;
        document.getElementById("editContact").value = mess.contact_number;
        document.getElementById("editRating").value = mess.rating;
        
        document.getElementById("editModal").style.display = "block";
    } catch (error) {
        console.error("Error loading mess details:", error);
        alert("Error loading mess details");
    }
}

function closeEditModal() {
    document.getElementById("editModal").style.display = "none";
}

async function saveEditMess() {
    try {
        const messId = document.getElementById("editMessId").value;
        const name = document.getElementById("editName").value;
        const location = document.getElementById("editLocation").value;
        const monthly_price = document.getElementById("editPrice").value;
        const veg_type = document.getElementById("editVegType").value;
        const contact_number = document.getElementById("editContact").value;
        const rating = document.getElementById("editRating").value;

        const res = await fetch(`http://localhost:5000/api/mess/${messId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name,
                location,
                monthly_price,
                veg_type,
                contact_number,
                rating
            })
        });

        if (res.ok) {
            closeEditModal();
            loadMess();
            alert("Mess updated successfully");
        } else {
            alert("Failed to update mess");
        }
    } catch (error) {
        console.error("Error updating mess:", error);
        alert("Error updating mess");
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById("editModal");
    if (event.target === modal) {
        modal.style.display = "none";
    }
}