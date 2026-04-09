async function loadMess(){
    try {
        const res = await fetch(apiUrl("mess"));
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

    const CHATBOT_INTENTS_KEY = 'campus_bites_chatbot_intents';

    function setIntentEditorMessage(text, isError = false) {
        const msg = document.getElementById('chatbotIntentMessage');
        if (!msg) return;
        msg.textContent = text;
        msg.style.color = isError ? '#c0392b' : '#1e8449';
    }

    async function loadChatbotIntentEditor() {
        const area = document.getElementById('chatbotIntentJson');
        if (!area) return;

        const saved = localStorage.getItem(CHATBOT_INTENTS_KEY);
        if (saved) {
            area.value = saved;
            setIntentEditorMessage('Loaded custom intent JSON from browser storage.');
            return;
        }

        try {
            const res = await fetch('chatbot-intents.json', { cache: 'no-store' });
            if (!res.ok) {
                throw new Error('Unable to load default intent file');
            }

            const config = await res.json();
            area.value = JSON.stringify(config, null, 2);
            setIntentEditorMessage('Loaded default intent JSON file.');
        } catch (error) {
            area.value = '{\n  "fallbackIntent": {\n    "greet": "Hi! I am Campus Bites bot.",\n    "quick": ["How to order?"]\n  },\n  "pageIntents": {},\n  "intentRules": []\n}';
            setIntentEditorMessage('Default file not reachable. Using fallback JSON skeleton.', true);
        }
    }

    function validateIntentConfig(value) {
        return !!(value
            && typeof value === 'object'
            && value.fallbackIntent
            && typeof value.fallbackIntent === 'object'
            && value.pageIntents
            && typeof value.pageIntents === 'object'
            && Array.isArray(value.intentRules));
    }

    function getEditorConfigOrFail() {
        const area = document.getElementById('chatbotIntentJson');
        if (!area) {
            setIntentEditorMessage('Editor not found.', true);
            return null;
        }

        try {
            const parsed = JSON.parse(area.value);
            if (!validateIntentConfig(parsed)) {
                throw new Error('Missing required keys: fallbackIntent, pageIntents, intentRules');
            }
            return parsed;
        } catch (error) {
            setIntentEditorMessage(`Fix JSON first: ${error.message}`, true);
            return null;
        }
    }

    function updateEditorConfig(config, successMessage) {
        const area = document.getElementById('chatbotIntentJson');
        if (!area) return;
        area.value = JSON.stringify(config, null, 2);
        setIntentEditorMessage(successMessage || 'Editor updated.');
    }

    function formatChatbotIntentJson() {
        const config = getEditorConfigOrFail();
        if (!config) return;
        updateEditorConfig(config, 'JSON formatted successfully.');
    }

    function insertIntentRuleTemplate() {
        const config = getEditorConfigOrFail();
        if (!config) return;

        const nextId = `custom_rule_${config.intentRules.length + 1}`;
        config.intentRules.push({
            id: nextId,
            match: ['keyword one', 'keyword two'],
            response: 'Write chatbot response here.',
            action: 'go:track-order.html'
        });

        updateEditorConfig(config, `Inserted rule template: ${nextId}`);
    }

    function insertPageIntentTemplate() {
        const config = getEditorConfigOrFail();
        if (!config) return;

        let idx = 1;
        let key = `new-page-${idx}.html`;
        while (config.pageIntents[key]) {
            idx += 1;
            key = `new-page-${idx}.html`;
        }

        config.pageIntents[key] = {
            greet: 'Add page-specific greeting here.',
            quick: ['Sample quick action 1', 'Sample quick action 2']
        };

        updateEditorConfig(config, `Inserted page intent template: ${key}`);
    }

    function insertOrderStatusRuleTemplate() {
        const config = getEditorConfigOrFail();
        if (!config) return;

        const exists = config.intentRules.some(rule => rule && rule.id === 'live_order_status_hint');
        if (exists) {
            setIntentEditorMessage('Order status helper rule already exists.', true);
            return;
        }

        config.intentRules.unshift({
            id: 'live_order_status_hint',
            match: ['track order #', 'order status', 'status of order'],
            response: 'Send your order ID like: track order #123 and I will fetch live status from backend.'
        });

        updateEditorConfig(config, 'Inserted order status helper rule template.');
    }

    function saveChatbotIntentJson() {
        const area = document.getElementById('chatbotIntentJson');
        if (!area) return;

        try {
            const parsed = JSON.parse(area.value);
            if (!validateIntentConfig(parsed)) {
                throw new Error('Missing required keys: fallbackIntent, pageIntents, intentRules');
            }

            const pretty = JSON.stringify(parsed, null, 2);
            localStorage.setItem(CHATBOT_INTENTS_KEY, pretty);
            area.value = pretty;
            setIntentEditorMessage('Intent JSON saved. Reload any page to apply chatbot changes.');
        } catch (error) {
            setIntentEditorMessage(`Invalid JSON: ${error.message}`, true);
        }
    }

    async function resetChatbotIntentJson() {
        const area = document.getElementById('chatbotIntentJson');
        if (!area) return;

        localStorage.removeItem(CHATBOT_INTENTS_KEY);
        await loadChatbotIntentEditor();
        setIntentEditorMessage('Intent JSON reset to default file values.');
    }

    window.saveChatbotIntentJson = saveChatbotIntentJson;
    window.resetChatbotIntentJson = resetChatbotIntentJson;
    window.insertIntentRuleTemplate = insertIntentRuleTemplate;
    window.insertPageIntentTemplate = insertPageIntentTemplate;
    window.insertOrderStatusRuleTemplate = insertOrderStatusRuleTemplate;
    window.formatChatbotIntentJson = formatChatbotIntentJson;

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

        const res = await fetch(apiUrl("mess"),{
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
    const res = await fetch(apiUrl(`mess/${id}`),{
        method:"DELETE"
    });
    if (!res.ok) {
        alert("Failed to delete mess");
    }
    loadMess();
}

loadMess();
loadChatbotIntentEditor();

// Edit Modal Functions
async function openEditModal(messId) {
    try {
        const res = await fetch(apiUrl(`mess/${messId}`));
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

        const res = await fetch(apiUrl(`mess/${messId}`), {
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