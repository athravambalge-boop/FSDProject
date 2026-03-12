async function updateMenu(){
    try {
        const breakfast = document.getElementById("breakfast").value;
        const lunch = document.getElementById("lunch").value;
        const dinner = document.getElementById("dinner").value;

        // get the mess id that was stored at login
        const messId = localStorage.getItem("mess_id");
        if (!messId) {
            document.getElementById("message").innerText = "No mess assigned. Please log in as an owner.";
            return;
        }

        const res = await fetch(`http://localhost:5000/api/mess/${messId}/menu`,{
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify({ breakfast, lunch, dinner })
        });

        const data = await res.json();
        document.getElementById("message").innerText = data.message || (data.error || "Menu updated");
    } catch (error) {
        console.error("Error updating menu:", error);
        document.getElementById("message").innerText = "Error updating menu. Make sure backend is running.";
    }
}

// basic guard: redirect visitors who open this page directly
(function(){
    const role = localStorage.getItem("role");
    if (role !== "owner") {
        alert("Access denied. Please log in as owner.");
        window.location.href = "login.html";
    }
})();