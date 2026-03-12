const params = new URLSearchParams(window.location.search);

const messId = params.get("id");

async function loadMenu(){
    try {
        const res = await fetch(`http://localhost:5000/api/mess/${messId}/menu`);
        const data = await res.json();
        const menu = document.getElementById("menu");

        if(!messId){
            menu.innerHTML = "<li>Invalid mess ID</li>";
            return;
        }

        if(Object.keys(data).length === 0){
            menu.innerHTML="<li>No menu available today</li>";
            return;
        }

        menu.innerHTML = `
<li>Breakfast: ${data.breakfast}</li>
<li>Lunch: ${data.lunch}</li>
<li>Dinner: ${data.dinner}</li>
`;
    } catch (error) {
        console.error("Error loading menu:", error);
        const menu = document.getElementById("menu");
        menu.innerHTML = "<li>Unable to load menu. Make sure backend is running.</li>";
    }
}

loadMenu();