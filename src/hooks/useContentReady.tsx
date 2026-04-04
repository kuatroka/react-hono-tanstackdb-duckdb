/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { publishContentReadyBenchmarkSignal } from './content-ready-benchmark';

type ContentReadyContextValue = {
  isReady: boolean;
  onReady: () => void;
};

const ContentReadyContext = createContext<ContentReadyContextValue | null>(null);

export function ContentReadyProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const readyCountRef = useRef(0);

  // Once ready, stay ready - cache loads are fast enough (< 50ms)
  const onReady = useCallback(() => {
    readyCountRef.current += 1;
    publishContentReadyBenchmarkSignal(readyCountRef.current);
    setIsReady(true);
  }, []);

  const value = useMemo(() => ({ isReady, onReady }), [isReady, onReady]);

  return (
    <ContentReadyContext.Provider value={value}>
      {children}
    </ContentReadyContext.Provider>
  );
}

export function useContentReady() {
  const ctx = useContext(ContentReadyContext);
  if (!ctx) {
    throw new Error('useContentReady must be used within ContentReadyProvider');
  }
  return ctx;
}
