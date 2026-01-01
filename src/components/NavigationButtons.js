import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './NavigationButtons.css';

const NavigationButtons = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  
  // 🆕 Flag per sapere se stiamo navigando con i nostri pulsanti
  const isNavigatingRef = React.useRef(false);

  useEffect(() => {
    console.log('📍 Location cambiata:', location.pathname);
    console.log('🔍 isNavigating:', isNavigatingRef.current);
    
    // Funzione per aggiornare lo stato dei pulsanti
    const updateNavigationState = () => {
      setCanGoBack(window.history.length > 1);
      
      // Controlla sessionStorage per il flag "avanti"
      const forwardFlag = sessionStorage.getItem('nav_can_forward');
      console.log('🔍 nav_can_forward da storage:', forwardFlag);
      setCanGoForward(forwardFlag === 'true');
    };

    updateNavigationState();

    // 🔧 SOLO se NON stiamo navigando con i pulsanti, resetta "avanti"
    if (!isNavigatingRef.current) {
      // Quando la location cambia tramite navigazione normale, disabilita "avanti"
      const currentPath = sessionStorage.getItem('nav_last_path');
      if (currentPath !== location.pathname) {
        console.log('🆕 Navigazione normale - disabilito avanti');
        sessionStorage.setItem('nav_can_forward', 'false');
        sessionStorage.setItem('nav_last_path', location.pathname);
        setCanGoForward(false);
      }
    } else {
      // 🆕 Reset del flag CON DELAY per permettere tutti i render di completarsi
      console.log('✅ Navigazione da pulsanti - mantengo stato avanti');
      setTimeout(() => {
        isNavigatingRef.current = false;
        console.log('🔄 Flag isNavigating resettato');
      }, 100);
    }

    // Listener per popstate (quando usi i pulsanti del browser o i nostri)
    const handlePopState = () => {
      console.log('🔄 PopState event');
      setTimeout(updateNavigationState, 50);
    };

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [location]);

  const handleBack = () => {
    if (canGoBack) {
      console.log('🔙 CLICK INDIETRO');
      
      // 🆕 Segna che stiamo navigando con i pulsanti
      isNavigatingRef.current = true;
      
      // Abilita il pulsante "avanti" per quando torni indietro
      sessionStorage.setItem('nav_can_forward', 'true');
      console.log('✅ Impostato nav_can_forward = true');
      setCanGoForward(true);
      
      // Naviga indietro
      navigate(-1);
    }
  };

  const handleForward = () => {
    console.log('🔜 CLICK AVANTI - canGoForward:', canGoForward);
    
    if (canGoForward) {
      // 🆕 Segna che stiamo navigando con i pulsanti
      isNavigatingRef.current = true;
      
      // Naviga avanti
      navigate(1);
      
      // 🆕 Dopo aver navigato avanti, verifica se sei arrivato alla fine
      setTimeout(() => {
        // Controlla se il path attuale è l'ultimo nella cronologia
        const lastPath = sessionStorage.getItem('nav_last_path');
        const currentPath = window.location.pathname;
        
        // Se sei tornato all'ultima pagina visitata, disabilita "avanti"
        if (currentPath === lastPath) {
          console.log('🏁 Raggiunta ultima pagina - disabilito avanti');
          sessionStorage.setItem('nav_can_forward', 'false');
          setCanGoForward(false);
        } else {
          // Altrimenti controlla il flag
          const stillCanGoForward = sessionStorage.getItem('nav_can_forward') === 'true';
          console.log('🔄 Dopo navigate(1), stillCanGoForward:', stillCanGoForward);
          setCanGoForward(stillCanGoForward);
        }
      }, 100);
    }
  };

  return (
    <div className="navigation-buttons">
      <button
        className={`hero-nav-btn ${!canGoBack ? 'disabled' : ''}`}
        onClick={handleBack}
        disabled={!canGoBack}
        aria-label="Torna indietro"
      >
        ‹
      </button>
      
      <button
        className={`hero-nav-btn ${!canGoForward ? 'disabled' : ''}`}
        onClick={handleForward}
        disabled={!canGoForward}
        aria-label="Vai avanti"
      >
        ›
      </button>
    </div>
  );
};

export default NavigationButtons;