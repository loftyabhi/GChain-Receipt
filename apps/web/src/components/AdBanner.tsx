import { useEffect, useState } from 'react';
import axios from 'axios';
// import Image from 'next/image'; // Removed for AdBanner to avoid proxy issues
import { ExternalLink } from 'lucide-react';

interface Ad {
    id: string;
    contentHtml: string;
    clickUrl?: string;
    imageUrl?: string; // [NEW] Added optional field if API supports it, or we extract
}

// Helper to extract src from an img tag string
function extractImgSrc(html: string): string | null {
    const match = html.match(/src=["'](.*?)["']/);
    if (!match) return null;

    let src = match[1];
    // Required: Fix Protocol-Relative URLs (//domain.com) so Next.js server can fetch them
    if (src.startsWith('//')) {
        return `https:${src}`;
    }
    return src;
}

export default function AdBanner() {
    const [ad, setAd] = useState<Ad | null>(null);

    useEffect(() => {
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/ads/random?placement=web`)
            .then(res => {
                if (res.data) setAd(res.data);
            })
            .catch(err => console.error("Failed to fetch ad", err));
    }, []);

    // Fallback: Show a-ads if no ad is returned from backend
    if (!ad) {
        return (
            <div id="frame" style={{ width: '100%', margin: 'auto', position: 'relative', zIndex: 99998 }}>
                <iframe
                    data-aa='2423044'
                    src='//acceptable.a-ads.com/2423044/?size=Adaptive'
                    style={{ border: 0, padding: 0, width: '70%', height: 'auto', overflow: 'hidden', display: 'block', margin: 'auto' }}
                />
            </div>
        );
    }

    // Extract image Source
    const imgSrc = ad.imageUrl || extractImgSrc(ad.contentHtml);

    return (
        <div className="w-full flex justify-center my-8">
            <div className="w-[728px] h-[90px] relative group">
                {/* Label */}
                <div className="absolute -top-3 left-4 px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 backdrop-blur-md rounded text-[10px] font-bold text-purple-300 uppercase tracking-widest z-20">
                    Advertisement
                </div>

                {/* Content Card */}
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm shadow-2xl hover:shadow-purple-500/10 transition-all duration-500 h-full">

                    {/* Clickable Area */}
                    <a href={ad.clickUrl || '#'} target="_blank" rel="noopener noreferrer" className="block relative z-10 h-full w-full">
                        {imgSrc ? (
                            // [Enterprise] Use plain <img> for third-party ads to avoid Next.js Proxy/CORS/400 errors
                            // Strict layout protection (h-full/w-full object-contain) prevents CLS
                            <img
                                src={imgSrc}
                                alt="Sponsored Content"
                                loading="lazy"
                                decoding="async"
                                referrerPolicy="no-referrer"
                                className="h-full w-full object-contain"
                            />
                        ) : (
                            // [Enterprise] Fallback: Isolate HTML content in iframe to prevent style leakage/XSS risk
                            <div className="h-full w-full bg-black/60 flex items-center justify-center">
                                {/* If the ad is purely HTML/Text, sandbox it properly. 
                                   Using iframe for strict isolation. */}
                                <iframe
                                    srcDoc={`<style>body{margin:0;overflow:hidden;background:transparent;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;}</style>${ad.contentHtml}`}
                                    title="Ad Content"
                                    className="w-full h-full border-none pointer-events-none"
                                    sandbox="allow-scripts"
                                    loading="lazy"
                                />
                            </div>
                        )}
                    </a>

                    {/* Hover Overlay Effect */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                    {/* Visit Button (shows on hover) */}
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-20">
                        <span className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg transition-colors">
                            Visit Site <ExternalLink size={12} />
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
