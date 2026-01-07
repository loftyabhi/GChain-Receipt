type EventType =
    | 'tx_lookup_started'
    | 'tx_lookup_success'
    | 'tx_lookup_failed'
    | 'pdf_generated'
    | 'confidence_level_viewed'
    | 'secondary_actions_expanded'
    | 'risk_warning_viewed'
    | 'chain_selected'
    | 'page_shared_visit';

type ConfidenceLevel = 'Confirmed' | 'High' | 'Likely' | 'Complex';

interface AnalyticsEventProps {
    chain?: string;
    confidence_level?: ConfidenceLevel;
    primary_action_type?: string;
    execution_type?: string;
    error_type?: string;
    share_source?: string;
    entry_type?: string;
    [key: string]: any;
}

export const GA_MEASUREMENT_ID = 'G-YTN902WXJS';

// Strict admin/internal route definitions
const ADMIN_ROUTES = ['/dashboard', '/admin', '/internal'];

const isAdminRoute = () => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    return ADMIN_ROUTES.some(route => path === route || path.startsWith(`${route}/`));
};

// Privacy-safe event tracking
export const trackEvent = (action: EventType, params: AnalyticsEventProps) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
        // 1. CRITICAL: Security & Privacy Guard
        // Immediately block ANY tracking on admin/internal routes.
        if (isAdminRoute()) return;

        // 2. STRICT PRIVACY: Do not fire events unless consent is explicitly granted
        // This ensures zero telemetry for users who have not accepted or have declined.
        const consent = localStorage.getItem('cookie_consent');
        if (consent !== 'granted') return;

        // SECURITY: Ensure NO raw hashes or addresses are passed
        const safeParams = { ...params };

        // Explicitly delete anything that looks like a hash or address if it accidentally slipped in
        Object.keys(safeParams).forEach(key => {
            if (safeParams[key] === undefined || safeParams[key] === null) {
                delete safeParams[key];
                return;
            }

            const val = String(safeParams[key]);
            if (val.startsWith('0x') && val.length > 10) {
                delete safeParams[key];
            }
        });

        (window as any).gtag('event', action, safeParams);
    }
};

export const trackTxLookup = (chain: string, status: 'started' | 'success' | 'failed', error?: string) => {
    trackEvent(`tx_lookup_${status}` as EventType, {
        chain,
        error_type: error
    });
};

export const trackPdfGeneration = (chain: string, type: string) => {
    trackEvent('pdf_generated', {
        chain,
        primary_action_type: type
    });
};
