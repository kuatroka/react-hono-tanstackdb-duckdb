import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

type NavigateHandler = (to: string) => void;

let navigateHandler: NavigateHandler | null = null;

export function navigateTo(to: string) {
  if (navigateHandler) {
    navigateHandler(to);
    return;
  }

  window.location.assign(to);
}

export function RouterNavigationBridge() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    navigateHandler = (to: string) => {
      navigateRef.current(to);
    };

    return () => {
      navigateHandler = null;
    };
  }, []);

  return null;
}
