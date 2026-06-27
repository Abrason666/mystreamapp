import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './NavigationButtons.css';

const NavigationButtons = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  // Stack custom: tracciamo noi la cronologia invece di affidarci a Electron/browser
  const stackRef = useRef([location.key]);
  const indexRef = useRef(0);
  // 'push' | 'back' | 'forward' — segnalato dai pulsanti prima che scatti l'effect
  const pendingAction = useRef('push');

  useEffect(() => {
    const action = pendingAction.current;
    pendingAction.current = 'push'; // reset per la prossima navigazione

    if (action === 'push') {
      // Navigazione normale: tronca lo stack forward e aggiunge la nuova entry
      stackRef.current = stackRef.current.slice(0, indexRef.current + 1);
      stackRef.current.push(location.key);
      indexRef.current = stackRef.current.length - 1;
    } else if (action === 'back') {
      indexRef.current = Math.max(0, indexRef.current - 1);
    } else if (action === 'forward') {
      indexRef.current = Math.min(stackRef.current.length - 1, indexRef.current + 1);
    }

    setCanGoBack(indexRef.current > 0);
    setCanGoForward(indexRef.current < stackRef.current.length - 1);
  }, [location]);

  const handleBack = () => {
    if (!canGoBack) return;
    pendingAction.current = 'back';
    navigate(-1);
  };

  const handleForward = () => {
    if (!canGoForward) return;
    pendingAction.current = 'forward';
    navigate(1);
  };

  return (
    <div className="navigation-buttons">
      <button
        className={`nav-btn ${!canGoBack ? 'disabled' : ''}`}
        onClick={handleBack}
        disabled={!canGoBack}
        aria-label="Torna indietro"
      >
        <ChevronLeft size={24} />
      </button>

      <button
        className={`nav-btn ${!canGoForward ? 'disabled' : ''}`}
        onClick={handleForward}
        disabled={!canGoForward}
        aria-label="Vai avanti"
      >
        <ChevronRight size={24} />
      </button>
    </div>
  );
};

export default NavigationButtons;
