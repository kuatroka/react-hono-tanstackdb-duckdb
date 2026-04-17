import {
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react';

const ContentReadyStateContext = createContext<boolean | null>(null);
const ContentReadyActionContext = createContext<(() => void) | null>(null);

export function ContentReadyProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  // Once ready, stay ready - cache loads are fast enough (< 50ms)
  const onReady = useCallback(() => {
    setIsReady(true);
  }, []);

  return (
    <ContentReadyActionContext.Provider value={onReady}>
      <ContentReadyStateContext.Provider value={isReady}>
        {children}
      </ContentReadyStateContext.Provider>
    </ContentReadyActionContext.Provider>
  );
}

export function useContentReadyState() {
  const isReady = useContext(ContentReadyStateContext);
  if (isReady == null) {
    throw new Error('useContentReadyState must be used within ContentReadyProvider');
  }

  return isReady;
}

export function useMarkContentReady() {
  const onReady = useContext(ContentReadyActionContext);
  if (!onReady) {
    throw new Error('useMarkContentReady must be used within ContentReadyProvider');
  }

  return onReady;
}

export function useContentReady() {
  return {
    isReady: useContentReadyState(),
    onReady: useMarkContentReady(),
  };
}
