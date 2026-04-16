document.addEventListener('DOMContentLoaded', () => {
    const root = document.documentElement;
    const themeToggle = document.getElementById('themeToggle');
    const filterButtons = Array.from(document.querySelectorAll('[data-filter]'));
    const cards = Array.from(document.querySelectorAll('.gallery-card'));
    const galleryCount = document.getElementById('galleryCount');

    if (window.applyThemePreference) {
        window.applyThemePreference(localStorage.getItem('theme-preference') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
            const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
            if (window.applyThemePreference) {
                window.applyThemePreference(nextTheme, { persist: true });
            } else {
                localStorage.setItem('theme-preference', nextTheme);
                root.setAttribute('data-theme', nextTheme);
            }
        });
    }

    if (!filterButtons.length || !cards.length) {
        return;
    }

    async function resolveMessByQuery(query) {
        const cleanQuery = String(query || '').trim().toLowerCase();
        if (!cleanQuery) {
            return null;
        }

        const response = await fetch(apiUrl(`mess?search=${encodeURIComponent(cleanQuery)}`));
        if (!response.ok) {
            return null;
        }

        const messes = await response.json();
        return messes.find((mess) => {
            const name = String(mess.name || '').toLowerCase();
            const location = String(mess.location || '').toLowerCase();
            return name.includes(cleanQuery) || location.includes(cleanQuery);
        }) || messes[0] || null;
    }

    async function openTargetMess(card) {
        const messQuery = card.dataset.messQuery || '';
        const targetItem = card.dataset.targetItem || '';
        const session = getUserSession();

        if (!session.role) {
            sessionStorage.setItem('pendingMenuTarget', JSON.stringify({
                messQuery,
                item: targetItem
            }));
            window.location.href = 'login.html';
            return;
        }

        const mess = await resolveMessByQuery(messQuery);
        if (!mess) {
            showToast('Unable to find the selected mess.', 'error');
            return;
        }

        const query = new URLSearchParams({
            id: String(mess.mess_id),
            item: targetItem,
            mess: mess.name
        });

        window.location.href = `mess.html?${query.toString()}`;
    }

    const updateGallery = (filter) => {
        let visibleCount = 0;

        cards.forEach((card) => {
            const shouldShow = filter === 'all' || card.dataset.category === filter;
            card.classList.toggle('is-hidden', !shouldShow);

            if (shouldShow) {
                visibleCount += 1;
            }
        });

        if (galleryCount) {
            const activeLabel = filterButtons.find((button) => button.dataset.filter === filter)?.textContent || 'All';
            galleryCount.textContent = filter === 'all'
                ? `Showing all ${visibleCount} items`
                : `Showing ${visibleCount} ${activeLabel.toLowerCase()} item${visibleCount === 1 ? '' : 's'}`;
        }
    };

    const setActiveButton = (activeFilter) => {
        filterButtons.forEach((button) => {
            const isActive = button.dataset.filter === activeFilter;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    };

    filterButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const selectedFilter = button.dataset.filter || 'all';
            setActiveButton(selectedFilter);
            updateGallery(selectedFilter);
        });
    });

    setActiveButton('all');
    updateGallery('all');

    cards.forEach((card) => {
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');

        card.addEventListener('click', () => {
            openTargetMess(card);
        });

        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openTargetMess(card);
            }
        });
    });
});