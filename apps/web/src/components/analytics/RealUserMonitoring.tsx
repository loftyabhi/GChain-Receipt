'use client';
import { useReportWebVitals } from 'next/web-vitals'; // Next.js built-in hook wrapper
import { useEffect } from 'react';

// [Enterprise] RUM Verification: Log core metrics to console (or analytic endpoint)
// Note: In production, ensure no PII is collected, use sampling (ex 10%), and capture LCP/CLS/INP.
export function RealUserMonitoring() {
    useReportWebVitals((metric) => {
        // In production, send this to an analytics endpoint
        // For now, log to console if performance is poor (Debug)
        if (metric.rating === 'poor' && process.env.NODE_ENV === 'development') {
            console.warn(`[RUM] Poor Metric: ${metric.name}`, metric);
        }
    });

    return null;
}
