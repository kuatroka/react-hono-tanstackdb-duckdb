import { useEffect, useRef } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, initializeWithFreshnessCheck, checkFreshnessOnFocus } from "@/collections";
import { openDatabase } from "@/lib/dexie-db";
import {
    applyPersistenceArchitectureRuntime,
    readPersistenceArchitectureFromWindow,
} from "@/lib/persistence/architecture";

// Open Dexie and validate freshness on app init.
// Heavy collections now load on-demand from the routes that actually need them.
function CollectionPreloader() {
    const hasInitialized = useRef(false);

    useEffect(() => {
        // Guard against React StrictMode double-execution
        if (hasInitialized.current) {
            return;
        }
        hasInitialized.current = true;

        async function init() {
            // 1. Open Dexie database
            await openDatabase();

            // 2. Check if backend data is fresher than cache, invalidate if stale
            await initializeWithFreshnessCheck();
        }
        void init();
    }, []);

    return null;
}


function PersistenceArchitectureRuntime() {
    useEffect(() => {
        const syncArchitecture = () => {
            const requestedArchitecture = readPersistenceArchitectureFromWindow(window);
            applyPersistenceArchitectureRuntime(window, {
                requested: requestedArchitecture,
                active: "baseline",
            });
        };

        syncArchitecture();
        window.addEventListener('popstate', syncArchitecture);

        return () => window.removeEventListener('popstate', syncArchitecture);
    }, []);

    return null;
}

// Re-check freshness when tab regains focus (for long-running sessions)
function DataFreshnessOnFocus() {
    useEffect(() => {
        const handleFocus = () => {
            void checkFreshnessOnFocus();
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);

    return null;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <PersistenceArchitectureRuntime />
            <CollectionPreloader />
            <DataFreshnessOnFocus />
            {children}
        </QueryClientProvider>
    );
}
