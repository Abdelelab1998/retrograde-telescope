import { useEffect, useState, useRef } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

const SESSION_TIMEOUT = 3 * 60 * 1000; // 3 minutes in milliseconds

export function SessionTimeout() {
    const [showTimeout, setShowTimeout] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout>();
    const lastActivityRef = useRef<number>(Date.now());

    const resetTimer = () => {
        lastActivityRef.current = Date.now();
        setShowTimeout(false);

        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set new timeout
        timeoutRef.current = setTimeout(() => {
            setShowTimeout(true);
        }, SESSION_TIMEOUT);
    };

    const handleRefresh = () => {
        window.location.reload();
    };

    useEffect(() => {
        // Track user activity
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

        const activityHandler = () => {
            if (!showTimeout) {
                resetTimer();
            }
        };

        // Add event listeners
        events.forEach(event => {
            document.addEventListener(event, activityHandler);
        });

        // Start initial timer
        resetTimer();

        // Cleanup
        return () => {
            events.forEach(event => {
                document.removeEventListener(event, activityHandler);
            });
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [showTimeout]);

    if (!showTimeout) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-amber-500/50 rounded-2xl p-8 max-w-md mx-4 shadow-2xl">
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
                        <AlertCircle className="w-8 h-8 text-amber-500" />
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2">Session Timeout</h2>

                    <p className="text-white/60 mb-6">
                        You've been inactive for 3 minutes. To save API resources and improve efficiency,
                        please refresh to start a new session.
                    </p>

                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors"
                    >
                        <RefreshCw className="w-5 h-5" />
                        Refresh Session
                    </button>

                    <p className="text-xs text-white/40 mt-4">
                        This helps reduce API calls and keeps the app running efficiently
                    </p>
                </div>
            </div>
        </div>
    );
}
