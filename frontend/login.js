async function login(){
    try {
        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;

        const res = await fetch("http://localhost:5000/api/auth/login",{
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify({ username, password })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            document.getElementById("error").innerText = err.error || "Login failed";
            return;
        }

        const data = await res.json();

        // persist user info so later pages know the mess id / role
        localStorage.setItem("role", data.role);
        if (data.mess_id !== undefined) {
            localStorage.setItem("mess_id", data.mess_id);
        }

        switch (data.role) {
            case "owner":
                window.location.href = "owner.html";
                break;
            case "visitor":
                window.location.href = "index.html";
                break;
            case "admin":
                window.location.href = "admin.html";
                break;
            default:
                document.getElementById("error").innerText = "Login failed";
        }
    } catch (error) {
        console.error("Login error:", error);
        document.getElementById("error").innerText = "Unable to connect to server. Make sure backend is running on http://localhost:5000";
    }
}