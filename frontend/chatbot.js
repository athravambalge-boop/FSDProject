(function chatbotBootstrap() {
    if (window.CampusBitesChatbot) {
        return;
    }

    const CHATBOT_INTENTS_KEY = 'campus_bites_chatbot_intents';
    const CHATBOT_NAME = 'Adiva';
    const CHATBOT_DESC = 'your Campus Bites assistant';

    const pageKey = (() => {
        const parts = window.location.pathname.split('/').filter(Boolean);
        const file = parts.length ? parts[parts.length - 1] : '';
        return file.toLowerCase() || 'landing.html';
    })();

    const defaultConfig = {
        fallbackIntent: {
            greet: 'Ask me anything about ordering, payment, and account flow.',
            quick: ['How to order?', 'Track order', 'Contact support']
        },
        pageIntents: {
            'landing.html': {
                greet: 'I can help you quickly sign up, login, or understand what this portal offers.',
                quick: ['Sign up help', 'Login help', 'What can I do here?']
            },
            'index.html': {
                greet: 'Need help finding a mess? Ask about search, location filters, or how to place an order.',
                quick: ['How to filter messes?', 'Open order history', 'Track order #123']
            },
            'mess.html': {
                greet: 'I can guide you through selecting items, using wallet balance, and placing your order.',
                quick: ['How do I place order?', 'Wallet cash use', 'Payment steps']
            },
            'login.html': {
                greet: 'Owner login support is here. I can help with account access and role confusion.',
                quick: ['Owner login steps', 'Forgot credentials', 'Student account question']
            },
            'create-account.html': {
                greet: 'I can help you create a student account with OTP using phone or email.',
                quick: ['OTP not received', 'Phone vs email mode', 'Continue with saved account']
            },
            'order-history.html': {
                greet: 'I can help you read order history, payment status, and jump to tracking.',
                quick: ['Track a past order', 'Payment status meaning', 'No orders shown']
            },
            'track-order.html': {
                greet: 'Ask me about order status steps, refresh, or cancellation rules.',
                quick: ['Status meanings', 'How to cancel order?', 'Refresh tracking']
            },
            'payment-status.html': {
                greet: 'I can help with QR payment, screenshot upload, and WhatsApp share confirmation.',
                quick: ['Upload receipt steps', 'Payment verification', 'Open track order']
            },
            'owner.html': {
                greet: 'Owner support mode active. Ask about adding menu items or managing order statuses.',
                quick: ['Add menu item', 'Update order status', 'Filter orders']
            },
            'admin.html': {
                greet: 'Admin support mode active. I can guide adding, editing, and managing mess records.',
                quick: ['Add new mess', 'Edit mess details', 'Contact number format']
            }
        },
        intentRules: [
            {
                id: 'greeting',
                match: ['hi', 'hello', 'hey', 'namaste'],
                response: '$page.greet'
            },
            {
                id: 'website_info',
                match: ['what can i do here', 'what can i do', 'website info'],
                response: 'You can see the info about our website, explore mess options, place orders, track live status, and manage account/payment flow from here.'
            },
            {
                id: 'filter_messes',
                match: ['how to filter messes', 'filter messes', 'mess filters'],
                response: 'Use the search area on the home page. You can filter by name and location, then click Search to get matching messes.'
            },
            {
                id: 'open_order_history',
                match: ['open order history', 'go to order history', 'show my order history'],
                response: 'Let me open your Track Order page to find your order status.',
                action: 'go:track-order.html'
            },
            {
                id: 'order',
                match: ['place order', 'book food', 'how to order', 'order'],
                response: 'To place an order: open a mess, add items, review cart, fill your details, and click Book Food. If asked, complete payment and upload proof.'
            },
            {
                id: 'track',
                match: ['track', 'where is my order'],
                response: 'Use the Track Order page and search with your order ID. You can refresh status anytime, and some orders can be cancelled before preparation completes.',
                action: 'go:track-order.html'
            },
            {
                id: 'history',
                match: ['history', 'my orders', 'past order'],
                response: 'Open My Orders to view your previous orders, their statuses, and payment details.',
                action: 'go:order-history.html'
            },
            {
                id: 'payment',
                match: ['payment', 'qr', 'receipt', 'screenshot', 'utr', 'proof'],
                response: 'Payment flow: scan QR, pay exact amount, upload a clear screenshot, then share confirmation if prompted. Keep order ID and payment proof visible.'
            },
            {
                id: 'otp',
                match: ['otp', 'not received', 'verification code'],
                response: 'For OTP issues, check phone/email format, wait 30-60 seconds, then use Resend OTP. Verify network and spam folder for email mode.'
            },
            {
                id: 'account_mode',
                match: ['phone vs email mode', 'phone or email mode', 'choose phone or email', 'phone mode', 'email mode'],
                response: 'Choose phone mode if you want the OTP sent to your mobile number, or email mode if you want it sent to your email address. Use the option where you can access the OTP fastest.'
            },
            {
                id: 'saved_account',
                match: ['continue with saved account', 'saved account', 'use existing account', 'already have an account'],
                response: 'If you already have a saved account, continue by signing in instead of creating a new one. Open the Login page to access your existing account.',
                action: 'go:login.html'
            },
            {
                id: 'owner',
                match: ['owner', 'dashboard', 'menu item', 'prepare', 'ready', 'completed'],
                response: 'Owner dashboard lets you add menu items, review incoming orders, and move status from pending to completed.'
            },
            {
                id: 'admin',
                match: ['admin', 'add mess', 'edit mess', 'contact number'],
                response: 'Admin dashboard can add and edit mess records with location, veg type, and contact details.'
            },
            {
                id: 'login',
                match: ['login', 'sign in', 'credentials'],
                response: 'Owners use Login page credentials. Students can create a visitor account with OTP from Create Account page.',
                action: 'go:login.html'
            },
            {
                id: 'signup',
                match: ['sign up', 'create account', 'register'],
                response: 'Open Create Account, choose phone or email mode, request OTP, verify code, and your student account is ready.',
                action: 'go:create-account.html'
            },
            {
                id: 'contact',
                match: ['contact', 'support', 'help line'],
                response: 'For payment receipt sharing, use the numbers visible on payment confirmation screen. For account or order issues, use the page tools first, then contact the mess owner.'
            },
            {
                id: 'wallet',
                match: ['wallet', 'wallet cash', 'wallet balance', 'use wallet', 'wallet payment'],
                response: 'If you have wallet balance available, it will be shown during checkout. You can use it to pay part or full amount for your order. The balance will be deducted automatically after you complete the order.'
            }
        ]
    };

    let chatbotConfig = JSON.parse(JSON.stringify(defaultConfig));

    function isValidIntentConfig(value) {
        return !!(value
            && typeof value === 'object'
            && value.pageIntents
            && typeof value.pageIntents === 'object'
            && Array.isArray(value.intentRules)
            && value.fallbackIntent
            && typeof value.fallbackIntent === 'object');
    }

    async function loadIntentConfig() {
        const saved = localStorage.getItem(CHATBOT_INTENTS_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (isValidIntentConfig(parsed)) {
                    chatbotConfig = parsed;
                    return;
                }
            } catch (error) {
                console.warn('Invalid saved chatbot intent JSON. Falling back to defaults.', error);
            }
        }

        try {
            const response = await fetch('chatbot-intents.json', { cache: 'no-store' });
            if (!response.ok) {
                return;
            }
            const fileConfig = await response.json();
            if (isValidIntentConfig(fileConfig)) {
                chatbotConfig = fileConfig;
            }
        } catch (error) {
            // Ignore missing file or local-file fetch restrictions.
        }
    }

    function pageIntent() {
        return chatbotConfig.pageIntents[pageKey] || chatbotConfig.fallbackIntent;
    }

    function textNorm(value) {
        return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function goToPage(target) {
        const current = window.location.pathname.toLowerCase();
        if (current.endsWith('/' + target) || current.endsWith(target)) {
            return;
        }
        window.location.href = target;
    }

    function actionHandler(action) {
        if (!action || typeof action !== 'string') {
            return null;
        }

        if (action.startsWith('go:')) {
            const target = action.slice(3).trim();
            if (!target) {
                return null;
            }
            return {
                type: 'go',
                target
            };
        }

        return null;
    }

    function compileRule(rule) {
        if (!rule || !Array.isArray(rule.match)) {
            return null;
        }

        return {
            id: rule.id || 'custom',
            match: rule.match.map(token => textNorm(token)).filter(Boolean),
            answer: () => {
                if (rule.response === '$page.greet') {
                    return pageIntent().greet;
                }
                return String(rule.response || 'I can help with orders, payments, and account flow.');
            },
            action: actionHandler(rule.action)
        };
    }

    function compiledRules() {
        return chatbotConfig.intentRules.map(compileRule).filter(Boolean);
    }

    function resolveIntent(userText) {
        const normalized = textNorm(userText);

        for (const rule of compiledRules()) {
            const matched = rule.match.some(token => normalized.includes(token));
            if (matched) {
                return rule;
            }
        }

        return null;
    }

    function initialBotMessage() {
        const intent = pageIntent();
        return `Hi, I am ${CHATBOT_NAME} - ${CHATBOT_DESC}. ${intent.greet}\nYou can ask short questions and I will guide you quickly.`;
    }

    function createLandingIntroBanner() {
        if (pageKey !== 'landing.html') {
            return;
        }

        const intro = document.createElement('div');
        intro.className = 'cb-landing-intro';
        intro.textContent = `${CHATBOT_NAME} here - ${CHATBOT_DESC}. Can I help you with anything today?`;
        document.body.appendChild(intro);

        const dismissIntro = () => {
            if (intro.parentElement) {
                intro.classList.add('hidden');
                setTimeout(() => {
                    if (intro.parentElement) {
                        intro.remove();
                    }
                }, 180);
            }
        };

        // Any click/tap anywhere on page dismisses this intro line.
        document.addEventListener('pointerdown', dismissIntro, { once: true, capture: true });
    }

    function extractOrderIdFromText(text) {
        const normalized = textNorm(text);
        const hasStatusIntent = ['status', 'track', 'order', '#'].some(token => normalized.includes(token));
        if (!hasStatusIntent) {
            return null;
        }

        const match = normalized.match(/(?:order\s*#?\s*|#)(\d{1,10})|\b(\d{1,10})\b/);
        if (!match) {
            return null;
        }

        return match[1] || match[2] || null;
    }

    async function fetchOrderStatus(orderId) {
        const response = await fetch(apiUrl(`orders/status/${encodeURIComponent(orderId)}`));
        if (!response.ok) {
            throw new Error('Order not found. Please check the order ID.');
        }

        const order = await response.json();
        const paymentStatus = String(order.payment_status || 'pending').toUpperCase();
        const status = String(order.status || 'pending').toUpperCase();
        const total = typeof formatCurrency === 'function' ? formatCurrency(order.total_amount || 0) : `₹${order.total_amount || 0}`;

        return [
            `Order #${order.order_id}`,
            `Status: ${status}`,
            `Payment: ${paymentStatus}`,
            `Amount: ${total}`,
            `Customer: ${order.customer_name || '-'}`
        ].join('\n');
    }

    function makeMascotIcon() {
        return [
            '<svg class="cb-mascot" viewBox="0 0 92 116" aria-hidden="true">',
            '  <defs>',
            '    <linearGradient id="cbHeadGrad" x1="18" y1="14" x2="72" y2="62" gradientUnits="userSpaceOnUse">',
            '      <stop offset="0" stop-color="#51adff"></stop>',
            '      <stop offset="1" stop-color="#1d73d0"></stop>',
            '    </linearGradient>',
            '    <linearGradient id="cbBodyGrad" x1="36" y1="62" x2="56" y2="98" gradientUnits="userSpaceOnUse">',
            '      <stop offset="0" stop-color="#ffffff"></stop>',
            '      <stop offset="1" stop-color="#ecf7ff"></stop>',
            '    </linearGradient>',
            '    <linearGradient id="cbTieGrad" x1="40" y1="66" x2="51" y2="102" gradientUnits="userSpaceOnUse">',
            '      <stop offset="0" stop-color="#ffaf56"></stop>',
            '      <stop offset="1" stop-color="#e46f20"></stop>',
            '    </linearGradient>',
            '  </defs>',
            '  <ellipse class="cb-mascot-shadow" cx="46" cy="109" rx="20" ry="5"></ellipse>',
            '  <circle class="cb-mascot-ear" cx="16" cy="40" r="8"></circle>',
            '  <circle class="cb-mascot-ear" cx="76" cy="40" r="8"></circle>',
            '  <ellipse class="cb-mascot-head-highlight" cx="33" cy="22" rx="12" ry="8"></ellipse>',
            '  <circle class="cb-mascot-head" cx="46" cy="38" r="27"></circle>',
            '  <rect class="cb-mascot-face" x="24" y="24" width="44" height="28" rx="14"></rect>',
            '  <rect class="cb-mascot-screen-glow" x="28" y="27" width="36" height="10" rx="5"></rect>',
            '  <circle class="cb-mascot-cheek" cx="33" cy="44" r="2.1"></circle>',
            '  <circle class="cb-mascot-cheek" cx="59" cy="44" r="2.1"></circle>',
            '  <circle class="cb-mascot-eye" cx="38" cy="38" r="3"></circle>',
            '  <circle class="cb-mascot-eye" cx="54" cy="38" r="3"></circle>',
            '  <rect class="cb-mascot-smile" x="39" y="45" width="14" height="4" rx="2"></rect>',
            '  <rect class="cb-mascot-body" x="34" y="62" width="24" height="35" rx="11"></rect>',
            '  <text class="cb-mascot-uniform-text" x="46" y="86" text-anchor="middle">PCCOE</text>',
            '  <ellipse class="cb-mascot-body-shadow" cx="46" cy="95" rx="8" ry="4"></ellipse>',
            '  <path class="cb-mascot-tie" d="M46 66 L52 72 L46 78 L40 72 Z"></path>',
            '  <path class="cb-mascot-tie" d="M46 79 L51 96 L46 102 L41 96 Z"></path>',
            '  <circle class="cb-mascot-tie-pin" cx="46" cy="72" r="1.5"></circle>',
            '  <circle class="cb-mascot-shoulder" cx="34" cy="69" r="4.5"></circle>',
            '  <g class="cb-eat-arm">',
            '    <rect class="cb-mascot-arm" x="23" y="66" width="14" height="7" rx="3.5"></rect>',
            '    <g class="cb-eat-palm">',
            '      <circle class="cb-mascot-hand" cx="20" cy="69" r="7.5"></circle>',
            '      <g class="cb-mascot-food">',
            '        <path class="cb-mascot-food-main" d="M22.2 63.4 L30.2 61.6 L25.5 66.8 Z"></path>',
            '        <path class="cb-mascot-food-fold" d="M24.9 64.2 L27.6 63.5 L25.8 65.7 Z"></path>',
            '      </g>',
            '    </g>',
            '  </g>',
            '  <circle class="cb-mascot-shoulder" cx="58" cy="72" r="4"></circle>',
            '  <rect class="cb-mascot-arm" x="57" y="70" width="13" height="6.5" rx="3.25"></rect>',
            '  <circle class="cb-mascot-hand" cx="72" cy="73" r="6.5"></circle>',
            '  <circle class="cb-mascot-spark" cx="68" cy="22" r="1.4"></circle>',
            '  <circle class="cb-mascot-spark" cx="73" cy="27" r="0.9"></circle>',
            '</svg>'
        ].join('');
    }

    function startEatingLoop(launcher) {
        const eatNow = () => {
            launcher.classList.remove('cb-eating');
            // Force reflow so repeated class toggles retrigger animation.
            void launcher.offsetWidth;
            launcher.classList.add('cb-eating');
            setTimeout(() => {
                launcher.classList.remove('cb-eating');
            }, 1700);
        };

        setTimeout(eatNow, 600);
        setInterval(eatNow, 5000);
    }

    async function createChatbot() {
        await loadIntentConfig();

        const host = document.createElement('div');
        host.className = 'cb-chatbot';

        host.innerHTML = [
            '<button class="cb-launcher" type="button" aria-label="Open chatbot">' + makeMascotIcon() + '</button>',
            '<section class="cb-panel" role="dialog" aria-label="Campus Bites chatbot">',
            '  <div class="cb-thread" id="cbThread"></div>',
            '  <div class="cb-input-wrap">',
            '    <input class="cb-input" type="text" placeholder="Ask about orders, OTP, payment..." maxlength="220">',
            '    <button class="cb-send" type="button">Send</button>',
            '  </div>',
            '</section>'
        ].join('');

        document.body.appendChild(host);

        const launcher = host.querySelector('.cb-launcher');
        startEatingLoop(launcher);
        const panel = host.querySelector('.cb-panel');
        const sendBtn = host.querySelector('.cb-send');
        const input = host.querySelector('.cb-input');
        const thread = host.querySelector('.cb-thread');
        let pendingRedirectTarget = null;
        let openedOnce = false;

        const addMsg = (text, role) => {
            const msg = document.createElement('div');
            msg.className = 'cb-msg ' + role;
            msg.textContent = text;
            thread.appendChild(msg);
            thread.scrollTop = thread.scrollHeight;
        };

        const addQuickActions = () => {
            const row = document.createElement('div');
            row.className = 'cb-quick-row';

            for (const label of pageIntent().quick) {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'cb-quick';
                chip.textContent = label;
                chip.addEventListener('click', () => {
                    input.value = label;
                    void handleSend();
                });
                row.appendChild(chip);
            }

            thread.appendChild(row);
            thread.scrollTop = thread.scrollHeight;
        };

        const pageLabel = (target) => {
            const text = String(target || '')
                .replace('.html', '')
                .replace(/[-_]/g, ' ')
                .trim();
            return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'this page';
        };

        const askRedirectInChat = (target) => {
            pendingRedirectTarget = target;
            addMsg(`Do you want to open ${pageLabel(target)}?`, 'bot');

            const row = document.createElement('div');
            row.className = 'cb-quick-row';

            const yesBtn = document.createElement('button');
            yesBtn.type = 'button';
            yesBtn.className = 'cb-quick';
            yesBtn.textContent = 'Yes, open it';
            yesBtn.addEventListener('click', () => {
                if (pendingRedirectTarget) {
                    goToPage(pendingRedirectTarget);
                }
                pendingRedirectTarget = null;
                row.remove();
            });

            const noBtn = document.createElement('button');
            noBtn.type = 'button';
            noBtn.className = 'cb-quick';
            noBtn.textContent = 'No, stay here';
            noBtn.addEventListener('click', () => {
                pendingRedirectTarget = null;
                addMsg('Okay, staying on this page.', 'bot');
                row.remove();
            });

            row.appendChild(yesBtn);
            row.appendChild(noBtn);
            thread.appendChild(row);
            thread.scrollTop = thread.scrollHeight;
        };

        const handleSend = async () => {
            const raw = input.value;
            const text = textNorm(raw);
            if (!text) {
                return;
            }

            addMsg(raw.trim(), 'user');
            input.value = '';

            const maybeOrderId = extractOrderIdFromText(text);
            if (maybeOrderId) {
                try {
                    const statusMessage = await fetchOrderStatus(maybeOrderId);
                    addMsg(statusMessage, 'bot');
                    return;
                } catch (error) {
                    addMsg(error.message || 'Unable to fetch order status right now.', 'bot');
                    return;
                }
            }

            const intent = resolveIntent(text);
            if (!intent) {
                addMsg('I did not fully get that. Try asking about order, payment, OTP, login, tracking, or support.', 'bot');
                return;
            }

            addMsg(intent.answer(), 'bot');
            if (intent.action && intent.action.type === 'go') {
                setTimeout(() => {
                    askRedirectInChat(intent.action.target);
                }, 300);
            }
        };

        launcher.addEventListener('click', () => {
            const isOpen = host.classList.toggle('open');
            launcher.setAttribute('aria-label', isOpen ? 'Close chatbot' : 'Open chatbot');
            if (isOpen) {
                if (!openedOnce) {
                    addMsg(`Hi, I am ${CHATBOT_NAME}.`, 'bot');
                    addMsg(initialBotMessage(), 'bot');
                    addQuickActions();
                    openedOnce = true;
                }
                input.focus();
            }
        });

        sendBtn.addEventListener('click', () => {
            void handleSend();
        });
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                void handleSend();
            }
        });

        document.addEventListener('pointerdown', (event) => {
            if (!host.classList.contains('open')) {
                return;
            }

            const target = event.target;
            if (panel.contains(target) || launcher.contains(target)) {
                return;
            }

            host.classList.remove('open');
            launcher.setAttribute('aria-label', 'Open chatbot');
        });

        createLandingIntroBanner();
    }

    window.CampusBitesChatbot = {
        init: () => {
            void createChatbot();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            void createChatbot();
        }, { once: true });
    } else {
        void createChatbot();
    }
})();
