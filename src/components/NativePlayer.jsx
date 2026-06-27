// ============================================================================
//  NativePlayer — player Netflix-style (Vidstack, layout composto custom)
//  Alimentato dall'URL .m3u8 risolto da vixsrcResolver. Brand CatStream,
//  icone lucide, barra riorganizzata, menu audio+sottotitoli con impostazioni
//  grafiche, default nessun sottotitolo (sfondo trasparente se attivati).
//  Back/prossimo episodio cablati alle callback passate da VixSrcPlayer
//  (riuso della logica esistente).
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MediaPlayer, MediaProvider,
  Controls, Gesture, Captions, PlayButton, SeekButton, MuteButton,
  VolumeSlider, TimeSlider, Time, Menu,
  useMediaState, useMediaPlayer,
} from '@vidstack/react';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/sliders.css';
import '@vidstack/react/player/styles/default/buttons.css';
import '@vidstack/react/player/styles/default/menus.css';
import '@vidstack/react/player/styles/default/tooltips.css';
import '@vidstack/react/player/styles/default/time.css';
import '@vidstack/react/player/styles/default/captions.css';
import {
  Play, Pause, RotateCcw, RotateCw, Volume2, Volume1, VolumeX,
  Captions as CaptionsIcon, Settings, SkipForward, SkipBack,
  ChevronLeft, Check, MonitorPlay,
} from 'lucide-react';
import './NativePlayer.css';
import storage from '../services/storage';

/* preferenze player (globali): legge+aggiorna in un colpo, senza bisogno di
   tenere un secondo stato in memoria — i cambi sono eventi rari (click utente) */
const updatePlayerPrefs = async (patch) => {
  const prefs = await storage.getPlayerPrefs();
  await storage.savePlayerPrefs({ ...prefs, ...patch });
};

/* ---- icone reattive ---- */
function PlayGlyph() { return useMediaState('paused') ? <Play /> : <Pause />; }
function VolGlyph() {
  const muted = useMediaState('muted'), v = useMediaState('volume');
  if (muted || v === 0) return <VolumeX />;
  return v < 0.5 ? <Volume1 /> : <Volume2 />;
}

/* ---- menu COMBINATO audio + sottotitoli (+ aspetto sottotitoli a lato) ---- */
function AudioSubsMenu() {
  const player = useMediaPlayer();
  const audioTracks = useMediaState('audioTracks');
  const audioTrack = useMediaState('audioTrack');
  const textTracks = useMediaState('textTracks');
  const textTrack = useMediaState('textTrack');

  const [showStyle, setShowStyle] = useState(false);
  const [capSize, setCapSize] = useState('1');
  const [capColor, setCapColor] = useState('white');
  const [capBg, setCapBg] = useState('transparent');
  const submenuBtnRef = useRef(null);
  const [flip, setFlip] = useState({ right: false, bottom: false });
  const didLoadAppearance = useRef(false);

  const setVar = useCallback((name, v) => {
    const el = player?.el || document.querySelector('media-player');
    el?.style.setProperty(name, v);
  }, [player]);

  // Carica l'aspetto sottotitoli salvato (dimensione/colore/sfondo) una sola
  // volta, appena il player esiste — prima si resettava ad ogni apertura.
  // Default (prima di qualunque scelta dell'utente): sfondo trasparente.
  useEffect(() => {
    if (!player || didLoadAppearance.current) return;
    didLoadAppearance.current = true;
    storage.getPlayerPrefs().then((prefs) => {
      const size  = prefs.capSize  ?? '1';
      const color = prefs.capColor ?? 'white';
      const bg    = prefs.capBg    ?? 'transparent';
      setCapSize(size);   setVar('--media-user-font-size', size);
      setCapColor(color); setVar('--media-user-text-color', color);
      setCapBg(bg);       setVar('--media-user-text-bg', bg);
    });
  }, [player, setVar]);

  // Pannello "Aspetto sottotitoli": resta un figlio DOM normale del menu (necessario
  // perché Vidstack riconosce i click "dentro" il menu con un semplice
  // menuEl.contains(target) — un portal lo romperebbe di nuovo). Per restare sempre
  // visibile usiamo position:absolute ancorato al menu stesso (deterministico,
  // a differenza di position:fixed che Vidstack "intrappola" col transform della sua
  // animazione di apertura) + un flip orizzontale/verticale se non c'è spazio.
  useEffect(() => {
    if (!showStyle || !submenuBtnRef.current) return;
    const menuEl = submenuBtnRef.current.closest('[role="menu"]') || submenuBtnRef.current;
    const r = menuEl.getBoundingClientRect();
    const PANEL_W = 230, PANEL_H = 320, MARGIN = 8;
    setFlip({
      right: r.left - PANEL_W - MARGIN < 0,
      bottom: r.top + PANEL_H + MARGIN > window.innerHeight,
    });
  }, [showStyle]);

  const subs = (textTracks || []).filter((t) => t.kind === 'subtitles' || t.kind === 'captions');
  // selezionare audio/sottotitoli salva anche la label scelta come preferenza
  // globale, così il prossimo episodio/contenuto riparte da quella lingua
  // invece di tornare forzatamente sull'italiano di default
  const selAudio = (id) => {
    const t = [...player.audioTracks].find((x) => x.id === id);
    if (t) { t.selected = true; updatePlayerPrefs({ audioLabel: t.label }); }
  };
  const selSub = (id) => {
    [...player.textTracks].forEach((t) => { if (t.mode === 'showing') t.mode = 'disabled'; });
    if (id !== 'off') {
      const t = [...player.textTracks].find((x) => x.id === id);
      if (t) { t.mode = 'showing'; updatePlayerPrefs({ subtitleLabel: t.label }); }
    } else {
      updatePlayerPrefs({ subtitleLabel: 'off' });
    }
  };

  const SIZES = [['0.75', 'Piccolo'], ['1', 'Normale'], ['1.25', 'Grande'], ['1.5', 'Molto grande']];
  const COLORS = [['white', 'Bianco'], ['#ffeb3b', 'Giallo'], ['#4fc3f7', 'Azzurro'], ['#69f0ae', 'Verde']];
  const BGS = [['rgba(0,0,0,0.7)', 'Nero'], ['rgba(0,0,0,0.4)', 'Semitrasparente'], ['transparent', 'Nessuno']];

  const Opt = ({ active, onClick, children }) => (
    <button className={'cs-opt' + (active ? ' active' : '')} onClick={onClick} type="button">
      <Check className="radio-check" />{children}
    </button>
  );

  return (
    <Menu.Root className="vds-menu" onOpen={() => setShowStyle(false)} onClose={() => setShowStyle(false)}>
      <Menu.Button className="ctrl-btn" aria-label="Audio e sottotitoli"><CaptionsIcon /></Menu.Button>
      <Menu.Items className="vds-menu-items cs-menu cs-menu-audiosubs" placement="top end" offset={14}>
        <button ref={submenuBtnRef} className={'cs-submenu-btn' + (showStyle ? ' open' : '')} type="button"
          onClick={() => setShowStyle((s) => !s)}>
          <Settings className="cs-submenu-ico" />
          <span className="cs-submenu-label">Aspetto sottotitoli</span>
          <ChevronLeft className="cs-submenu-arrow" />
        </button>
        <div className="cs-menu-sep" />

        <div className="cs-menu-scroll">
          <div className="menu-title">Audio</div>
          <Menu.RadioGroup className="vds-radio-group" value={audioTrack?.id ?? ''} onChange={selAudio}>
            {(audioTracks || []).map((t) => (
              <Menu.Radio className="vds-radio" value={t.id} key={t.id}>
                <Check className="radio-check" /><span>{t.label}</span>
              </Menu.Radio>
            ))}
          </Menu.RadioGroup>

          <div className="menu-title">Sottotitoli</div>
          <Menu.RadioGroup className="vds-radio-group" value={textTrack?.id ?? 'off'} onChange={selSub}>
            <Menu.Radio className="vds-radio" value="off">
              <Check className="radio-check" /><span>Disattivati</span>
            </Menu.Radio>
            {subs.map((t) => (
              <Menu.Radio className="vds-radio" value={t.id} key={t.id}>
                <Check className="radio-check" /><span>{t.label}</span>
              </Menu.Radio>
            ))}
          </Menu.RadioGroup>
        </div>

        {showStyle && (
          <div className={'cs-side-panel' + (flip.right ? ' cs-side-right' : '') + (flip.bottom ? ' cs-side-bottom' : '')}>
            <div className="menu-title">Dimensione</div>
            {SIZES.map(([v, l]) => (
              <Opt key={v} active={capSize === v} onClick={() => {
                setCapSize(v); setVar('--media-user-font-size', v); updatePlayerPrefs({ capSize: v });
              }}>
                <span>{l}</span>
              </Opt>
            ))}
            <div className="menu-title">Colore testo</div>
            {COLORS.map(([v, l]) => (
              <Opt key={v} active={capColor === v} onClick={() => {
                setCapColor(v); setVar('--media-user-text-color', v); updatePlayerPrefs({ capColor: v });
              }}>
                <span className="cs-swatch" style={{ background: v }} /><span>{l}</span>
              </Opt>
            ))}
            <div className="menu-title">Sfondo</div>
            {BGS.map(([v, l]) => (
              <Opt key={v} active={capBg === v} onClick={() => {
                setCapBg(v); setVar('--media-user-text-bg', v); updatePlayerPrefs({ capBg: v });
              }}>
                <span>{l}</span>
              </Opt>
            ))}
          </div>
        )}
      </Menu.Items>
    </Menu.Root>
  );
}

/* ---- menu IMPOSTAZIONI: qualità + velocità + "player classico" ---- */
function SettingsMenu({ onSwitchClassic }) {
  const player = useMediaPlayer();
  const qualities = useMediaState('qualities');
  const quality = useMediaState('quality');
  const autoQuality = useMediaState('autoQuality');
  const rate = useMediaState('playbackRate');

  const onQuality = (v) => {
    if (v === 'auto') { player.qualities.autoSelect(); return; }
    const q = [...player.qualities].find((x) => String(x.height) === v);
    if (q) q.selected = true;
  };
  const rates = ['0.5', '0.75', '1', '1.25', '1.5', '2'];

  return (
    <Menu.Root className="vds-menu">
      <Menu.Button className="ctrl-btn" aria-label="Impostazioni"><Settings /></Menu.Button>
      <Menu.Items className="vds-menu-items cs-menu" placement="top end" offset={14}>
        <div className="menu-title">Qualità</div>
        <Menu.RadioGroup className="vds-radio-group"
          value={autoQuality ? 'auto' : String(quality?.height ?? 'auto')} onChange={onQuality}>
          <Menu.Radio className="vds-radio" value="auto"><Check className="radio-check" /><span>Auto</span></Menu.Radio>
          {(qualities || []).map((q) => (
            <Menu.Radio className="vds-radio" value={String(q.height)} key={q.height}>
              <Check className="radio-check" /><span>{q.height}p</span>
            </Menu.Radio>
          ))}
        </Menu.RadioGroup>

        <div className="menu-title">Velocità</div>
        <Menu.RadioGroup className="vds-radio-group" value={String(rate)}
          onChange={(v) => { player.playbackRate = parseFloat(v); }}>
          {rates.map((r) => (
            <Menu.Radio className="vds-radio" value={r} key={r}>
              <Check className="radio-check" /><span>{r === '1' ? 'Normale' : r + '×'}</span>
            </Menu.Radio>
          ))}
        </Menu.RadioGroup>

        {onSwitchClassic && (
          <>
            <div className="cs-menu-sep" />
            <button className="cs-submenu-btn" type="button" onClick={onSwitchClassic}>
              <MonitorPlay className="cs-submenu-ico" />
              <span className="cs-submenu-label">Usa player classico</span>
            </button>
          </>
        )}
      </Menu.Items>
    </Menu.Root>
  );
}

/* componente "invisibile": riporta al genitore la posizione reale di playback
   (per salvare il punto esatto di "continua a guardare"), isolato così solo lui
   ri-renderizza ad ogni tick e non l'intero layout dei controlli */
function TimeReporter({ onTimeUpdate }) {
  const currentTime = useMediaState('currentTime');
  const duration = useMediaState('duration');
  useEffect(() => {
    if (onTimeUpdate && duration > 0) onTimeUpdate(currentTime, duration);
  }, [currentTime, duration, onTimeUpdate]);
  return null;
}

/* segnala una volta sola quando il contenuto finisce del tutto — isolato (come
   TimeReporter) così non ri-renderizza l'intero layout. Il genitore decide cosa
   fare (avanzare al prossimo episodio, o pulire "continua a guardare" se non
   c'è un successivo / è un film) perché ha lui lo stato hasNext aggiornato. */
function AutoAdvance({ onEnded }) {
  const ended = useMediaState('ended');
  const didFire = useRef(false);
  useEffect(() => {
    if (ended && !didFire.current) {
      didFire.current = true;
      onEnded?.();
    }
  }, [ended, onEnded]);
  return null;
}

/* ============================ LAYOUT ============================ */
function CustomVideoLayout({
  title, epTag, hasNext, hasPrev, onBack, onNext, onPrev, onSwitchClassic,
  startTime, onTimeUpdate, onEnded,
}) {
  const player = useMediaPlayer();
  const textTracks = useMediaState('textTracks');
  const audioTracks = useMediaState('audioTracks');
  const qualities = useMediaState('qualities');
  const duration = useMediaState('duration');
  const didSubDefault = useRef(false);
  const didAudioDefault = useRef(false);
  const didQualityDefault = useRef(false);
  const didSeek = useRef(false);

  // riprende dal punto esatto lasciato in "continua a guardare" (una sola volta,
  // appena la durata è nota — prima di allora la posizione non è ancora valida)
  useEffect(() => {
    if (!player || didSeek.current || !startTime || startTime < 1 || !duration) return;
    player.currentTime = Math.min(startTime, Math.max(duration - 5, 0));
    didSeek.current = true;
  }, [player, startTime, duration]);

  // default sottotitolo = preferenza salvata dall'utente (AudioSubsMenu la
  // aggiorna ad ogni scelta manuale); se non è mai stata scelta nulla, il
  // default è "nessun sottotitolo"
  useEffect(() => {
    if (!player || didSubDefault.current || !textTracks || textTracks.length === 0) return;
    didSubDefault.current = true;
    storage.getPlayerPrefs().then((prefs) => {
      const label = prefs.subtitleLabel ?? 'off';
      if (label === 'off') return;
      const sub = [...player.textTracks].find((t) => t.label.trim().toLowerCase() === label.toLowerCase());
      if (sub) sub.mode = 'showing';
    });
  }, [player, textTracks]);

  // default audio = preferenza salvata dall'utente; se non ne ha mai scelta
  // una, lascia la selezione di default decisa da HLS/Vidstack (nessun forzato)
  useEffect(() => {
    if (!player || didAudioDefault.current || !audioTracks || audioTracks.length === 0) return;
    didAudioDefault.current = true;
    storage.getPlayerPrefs().then((prefs) => {
      if (!prefs.audioLabel) return;
      const aud = [...player.audioTracks].find((t) => t.label.trim().toLowerCase() === prefs.audioLabel.toLowerCase());
      if (aud) aud.selected = true;
    });
  }, [player, audioTracks]);

  // default qualità = la più alta disponibile (non "auto").
  // La lista "qualities" durante il parsing del manifest HLS può popolarsi in più
  // passaggi (es. arriva prima la 720p, poi la 1080p): non scegliamo al primo
  // aggiornamento utile, ma aspettiamo che la lista smetta di cambiare (debounce)
  // così siamo sicuri di vedere TUTTE le risoluzioni prima di selezionare la massima.
  useEffect(() => {
    if (!player || didQualityDefault.current || !qualities || qualities.length === 0) return;
    const id = setTimeout(() => {
      if (didQualityDefault.current) return;
      try {
        const list = Array.from(player.qualities || []);
        const best = list.filter((q) => typeof q.height === 'number').sort((a, b) => b.height - a.height)[0];
        if (best) { best.selected = true; didQualityDefault.current = true; }
      } catch (e) {
        console.warn('Impostazione qualità di default fallita:', e?.message);
      }
    }, 500);
    return () => clearTimeout(id);
  }, [player, qualities]);

  return (
    <>
      <TimeReporter onTimeUpdate={onTimeUpdate} />
      <AutoAdvance onEnded={onEnded} />
      <Captions className="vds-captions" />

      <Gesture className="vds-gesture" event="pointerup" action="toggle:paused" />
      <Gesture className="vds-gesture" event="dblpointerup" action="toggle:fullscreen" />
      <Gesture className="vds-gesture cs-gz-left" event="dblpointerup" action="seek:-10" />
      <Gesture className="vds-gesture cs-gz-right" event="dblpointerup" action="seek:10" />

      <Controls.Root
        className="vds-controls cs-controls"
        onPointerUp={(e) => {
          // click ovunque sull'overlay (anche fuori dal tasto pausa centrale) = toggle
          // play/pausa, a patto che non arrivi da un bottone/slider/menu interattivo
          if (e.target.closest('button, .vds-slider, .vds-menu')) return;
          if (player) player.paused = !player.paused;
        }}
      >
        <div className="cs-scrim cs-scrim-top" />
        <div className="cs-scrim cs-scrim-bottom" />

        {/* TOP: back a sinistra + titolo */}
        <Controls.Group className="cs-top">
          <button
            className="ctrl-btn cs-back"
            onClickCapture={(e) => { e.stopPropagation(); onBack(); }}
            aria-label="Indietro"
            title="Indietro"
          >
            <ChevronLeft />
          </button>
          <div className="cs-top-title">
            {epTag && <span className="ep-tag">{epTag}</span>}
            <span className="cs-top-name">{title}</span>
          </div>
        </Controls.Group>

        {/* CENTER: -10s, pausa grande, +10s */}
        <Controls.Group className="cs-center">
          <SeekButton className="ctrl-btn cs-bigbtn" seconds={-10} aria-label="Indietro 10s"><RotateCcw /></SeekButton>
          <PlayButton className="ctrl-btn cs-bigplay" aria-label="Play/Pausa"><PlayGlyph /></PlayButton>
          <SeekButton className="ctrl-btn cs-bigbtn" seconds={10} aria-label="Avanti 10s"><RotateCw /></SeekButton>
        </Controls.Group>

        {/* BOTTOM */}
        <Controls.Group className="cs-bottom">
          <TimeSlider.Root className="vds-time-slider vds-slider cs-timeslider">
            <TimeSlider.Track className="vds-slider-track" />
            <TimeSlider.TrackFill className="vds-slider-track-fill vds-slider-track" />
            <TimeSlider.Progress className="vds-slider-progress vds-slider-track" />
            <TimeSlider.Thumb className="vds-slider-thumb" />
            <TimeSlider.Preview className="vds-slider-preview">
              <TimeSlider.Value className="vds-slider-value" />
            </TimeSlider.Preview>
          </TimeSlider.Root>

          <div className="cs-row">
            <div className="cs-left">
              <PlayButton className="ctrl-btn" aria-label="Play/Pausa"><PlayGlyph /></PlayButton>
              <SeekButton className="ctrl-btn" seconds={-10} aria-label="Indietro 10s"><RotateCcw /></SeekButton>
              <SeekButton className="ctrl-btn" seconds={10} aria-label="Avanti 10s"><RotateCw /></SeekButton>
              <div className="cs-volume">
                <MuteButton className="ctrl-btn" aria-label="Muto"><VolGlyph /></MuteButton>
                <VolumeSlider.Root className="vds-volume-slider vds-slider cs-volslider">
                  <VolumeSlider.Track className="vds-slider-track" />
                  <VolumeSlider.TrackFill className="vds-slider-track-fill vds-slider-track" />
                  <VolumeSlider.Thumb className="vds-slider-thumb" />
                </VolumeSlider.Root>
              </div>
              <span className="cs-time">
                <Time className="vds-time" type="current" />
                <span className="cs-time-sep">/</span>
                <Time className="vds-time" type="duration" />
              </span>
            </div>

            <div className="cs-right">
              <button className="ctrl-btn" onClick={onPrev} disabled={!hasPrev}
                aria-label="Episodio precedente" title="Episodio precedente">
                <SkipBack />
              </button>
              <button className="ctrl-btn" onClick={onNext} disabled={!hasNext}
                aria-label="Prossimo episodio" title="Prossimo episodio">
                <SkipForward />
              </button>
              <AudioSubsMenu />
              <SettingsMenu onSwitchClassic={onSwitchClassic} />
            </div>
          </div>
        </Controls.Group>
      </Controls.Root>
    </>
  );
}

export default function NativePlayer({
  src, title, epTag, hasNext, hasPrev, onBack, onNext, onPrev, onSwitchClassic,
  startTime, onTimeUpdate, onEnded,
}) {
  return (
    <MediaPlayer
      className="vds-player cs-player"
      title={title}
      src={src ? { src, type: 'application/x-mpegurl' } : undefined}
      load="eager"
      posterLoad="eager"
      playsInline
      crossOrigin
      streamType="on-demand"
      autoPlay
    >
      <MediaProvider />
      <CustomVideoLayout
        title={title}
        epTag={epTag}
        hasNext={hasNext}
        hasPrev={hasPrev}
        onBack={onBack}
        onNext={onNext}
        onPrev={onPrev}
        onSwitchClassic={onSwitchClassic}
        startTime={startTime}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
      />
    </MediaPlayer>
  );
}
