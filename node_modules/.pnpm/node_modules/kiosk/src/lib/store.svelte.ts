import { goto } from '$app/navigation';

export interface Member {
    id: string;
    full_name: string;
    cached_balance: number;
}

export interface Drink {
    id: string;
    name_nl: string;
    category_id: string;
    image_path: string;
    sale_price_incl_vat: number;
}

export interface CartItem {
    drink: Drink;
    quantity: number;
}

function createKioskState() {
    let member = $state<Member | null>(null);
    let cart = $state<CartItem[]>([]);
    
    let idleTimerId: ReturnType<typeof setTimeout> | null = null;
    let warningTimerId: ReturnType<typeof setTimeout> | null = null;
    let showIdleWarning = $state(false);

    function resetIdleTimer() {
        if (!member) return;
        
        clearIdleTimer();
        showIdleWarning = false;

        warningTimerId = setTimeout(() => {
            showIdleWarning = true;
        }, 60000);

        idleTimerId = setTimeout(() => {
            clearSession();
        }, 100000);
    }

    function clearIdleTimer() {
        if (warningTimerId) clearTimeout(warningTimerId);
        if (idleTimerId) clearTimeout(idleTimerId);
    }

    function clearSession() {
        member = null;
        cart = [];
        showIdleWarning = false;
        clearIdleTimer();
        goto('/');
    }

    if (typeof window !== 'undefined') {
        window.addEventListener('touchstart', resetIdleTimer);
        window.addEventListener('click', resetIdleTimer);
        window.addEventListener('scroll', resetIdleTimer);
    }

    return {
        get member() { return member; },
        set member(val) { 
            member = val; 
            if (val) resetIdleTimer(); 
            else clearSession();
        },
        get cart() { return cart; },
        set cart(val) { cart = val; },
        get cartTotal() { 
            return cart.reduce((total, item) => total + (item.drink.sale_price_incl_vat * item.quantity), 0);
        },
        get showIdleWarning() { return showIdleWarning; },
        addToCart(drink: Drink) {
            const existing = cart.find(i => i.drink.id === drink.id);
            if (existing) {
                existing.quantity += 1;
            } else {
                cart.push({ drink, quantity: 1 });
            }
            resetIdleTimer();
        },
        updateQuantity(drinkId: string, delta: number) {
            const item = cart.find(i => i.drink.id === drinkId);
            if (item) {
                item.quantity += delta;
                if (item.quantity <= 0) {
                    cart = cart.filter(i => i.drink.id !== drinkId);
                }
            }
            resetIdleTimer();
        },
        clearSession,
        resetIdleTimer
    };
}

export const kioskState = createKioskState();
