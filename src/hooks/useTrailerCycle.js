import { useState, useEffect, useRef } from 'react';
import { getMovieVideos, getTVVideos } from '../services/tmdbApi';

const IMAGE_PHASE    = 1000;  // ms di immagine fissa prima del trailer
const TRAILER_HIDDEN = 4500;  // ms nascosto (controlli YouTube spariscono)
const TRAILER_SHOWN  = 25000; // ms di trailer visibile
const FADE_OUT       = 1000;  // ms di fade-out prima di tornare all'immagine

export function useTrailerCycle(itemId, type) {
  const [showIframe, setShowIframe]         = useState(false);
  const [trailerVisible, setTrailerVisible] = useState(false);
  const [trailerKey, setTrailerKey]         = useState(null);
  const [isMuted, setIsMuted]               = useState(true);

  const iframeRef = useRef(null);
  const timerRef  = useRef(null);

  useEffect(() => {
    if (!itemId) return;

    let cancelled = false;
    const keyHolder = { current: null };

    const runCycle = () => {
      if (cancelled) return;

      // Fase 1: immagine fissa visibile, iframe smontato
      setTrailerVisible(false);
      setShowIframe(false);
      setTrailerKey(null);

      timerRef.current = setTimeout(() => {
        if (cancelled) return;

        // Fase 2: monta iframe (nascosto, YouTube carica in background)
        setTrailerKey(keyHolder.current);
        setShowIframe(true);
        setIsMuted(true);

        // Fase 3: mostra trailer (controlli YouTube già spariti)
        timerRef.current = setTimeout(() => {
          if (cancelled) return;
          setTrailerVisible(true);

          // Fase 4: nascondi trailer (fade-out)
          timerRef.current = setTimeout(() => {
            if (cancelled) return;
            setTrailerVisible(false);

            // Fase 5: dopo il fade-out, ricomincia il ciclo
            timerRef.current = setTimeout(runCycle, FADE_OUT);
          }, TRAILER_SHOWN);
        }, TRAILER_HIDDEN);
      }, IMAGE_PHASE);
    };

    (async () => {
      try {
        const data = type === 'movie'
          ? await getMovieVideos(itemId)
          : await getTVVideos(itemId);
        const trailer = data.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        if (!trailer || cancelled) return;
        keyHolder.current = trailer.key;
        runCycle();
      } catch {}
    })();

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  }, [itemId, type]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: next ? 'mute' : 'unMute', args: [] }), '*'
    );
    if (!next) {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'setVolume', args: [80] }), '*'
      );
    }
  };

  const trailerSrc = trailerKey
    ? `https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&loop=1&playlist=${trailerKey}&enablejsapi=1&modestbranding=1&rel=0&iv_load_policy=3`
    : null;

  return { showIframe, trailerVisible, trailerSrc, isMuted, iframeRef, toggleMute };
}
