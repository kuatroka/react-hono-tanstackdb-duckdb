import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

type ContentReadyContextValue = {
  isReady: boolean;
  onReady: () => void;
};

const ContentReadyContext = createContext<ContentReadyContextValue | null>(null);

export function ContentReadyProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  // Once ready, stay ready - cache loads are fast enough (< 50ms)
  const onReady = useCallback(() => {
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
