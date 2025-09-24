import { useEffect, useMemo, useState } from "react";

/* =============================================================
   CUMPLE TONI — Landing (RSVP + Quiz + Galería con QR)
   Versión JS/JSX (sin TypeScript)
   ============================================================= */

/* ===================
   CONFIGURACIÓN POR DEFECTO
   =================== */
const EVENT_DEFAULT = {
  title: "¡40 Cumple de Toneti!",
  date: "2025-11-15T12:30:00+01:00",
  locationLabel: "Colla + Sorpresa",
  locationUrl: "https://maps.app.goo.gl/WW4huSdBFsvJZ4Yt7",
  rsvpUrl: "https://tally.so/r/xxxxxxxx",
  coverImage:
    "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=1600&auto=format&fit=crop",
  hashtag: "#CumpleToni",
  galleryOpensAt: "2025-11-16T10:00:00+01:00",
  spotifyPlaylistUrl:
    "https://open.spotify.com/playlist/6ZWecI4EIljbX4Tt76Kp5Z?si=93a8afcbbe6745a7",
};

const CLUES_DEFAULT = [
  {
    title: "Pista #1",
    body:
      "Éramos jóvenes, sin miedo ni ley, en la calle San Roque empezó todo aquello. Un local prestado y menudas fiestas!!! Hasta una traca de 50 metros se tiró dentro.... ¿qué nombre tenía nuestra primera colla amiga?",
    revealAt: "2025-09-24T09:00:00+02:00",
    emoji: "🕵️‍♂️",
  },
  {
    title: "Pista #2",
    body:
      "De padres distintos y madres también, amigos de amigos y algunos hermanos, pero nos juntamos todos con algo en común. Entre pachanga y punk nos hicimos colegas, ¿qué era lo que a todos nos unía?",
    revealAt: "2025-10-08T09:00:00+02:00",
    emoji: "🎶",
  },
  {
    title: "Pista #3",
    body:
      "De la colla al parque, tocó emigrar, hasta que alguien trajo un rumor especial: ‘reabre un templo donde sonó rock de verdad’. ¿Qué tipo de lugar era…?",
    revealAt: "2025-10-15T09:00:00+02:00",
    emoji: "🏛️",
  },
  {
    title: "Pista #4",
    body:
      "Arriba unos, abajo otros, cada uno en su espacio, pero en el nuestro además de la música había un sonido especial. Entre cubatas y risas locas, ¿qué juego marcó aquella colla hasta altas horas de la madrugada?",
    revealAt: "2025-10-22T09:00:00+02:00",
    emoji: "🏓",
  },
  {
    title: "Pista #5",
    body:
      "De l’Esvaró nos llegó más gente, y nació un antro de fiesta.... Punkis, el Gran Puzzle y hasta DJs legendarios, ¿cómo se llamábamos a aquella colla?",
    revealAt: "2025-10-29T09:00:00+02:00",
    emoji: "🧩",
  },
  {
    title: "Pista Final",
    body:
      "Crecimos, cambiamos y el mapa giró, pero hay un lugar que a todos nos juntó. Templo querido, latido inmortal… ¿Qué sitio habrá elegido nuestro querido Toneti para celebrar sus 40? :)",
    revealAt: "2025-11-06T09:00:00+02:00",
    emoji: "🎯",
  },
];

const GALLERY_DEFAULT = [
  {
    src:
      "https://images.unsplash.com/photo-1542353436-312f0b0923b1?q=80&w=1200&auto=format&fit=crop",
    alt: "Foto 1",
  },
  {
    src:
      "https://images.unsplash.com/photo-1541976590-713941681591?q=80&w=1200&auto=format&fit=crop",
    alt: "Foto 2",
  },
];

const CONFIG_KEY = "cumple-toni-config-v1";
/* Nuevas claves para usuario y progreso por usuario */
const USER_KEY = "cumple-toni-user-v1"; // {name,email}
const PROGRESS_KEY = "cumple-toni-progress-v2";
// URL para subir fotos a la galería (QR)
const GALLERY_UPLOAD_URL = "https://app.eventocam.com/galeria/K6qhGNwbCG7S/subir";

/* ===================
   PERSISTENCIA LOCAL
   =================== */
function usePersistentConfig() {
  const [eventCfg, setEventCfg] = useState(
    () => safeLocalGet(CONFIG_KEY)?.event ?? EVENT_DEFAULT
  );
  const [clues, setClues] = useState(
    () => safeLocalGet(CONFIG_KEY)?.clues ?? CLUES_DEFAULT
  );
  const [gallery, setGallery] = useState(
    () => safeLocalGet(CONFIG_KEY)?.gallery ?? GALLERY_DEFAULT
  );

  function save() {
    safeLocalSet(CONFIG_KEY, { event: eventCfg, clues, gallery });
  }
  function reset() {
    setEventCfg(EVENT_DEFAULT);
    setClues(CLUES_DEFAULT);
    setGallery(GALLERY_DEFAULT);
    safeLocalSet(CONFIG_KEY, {
      event: EVENT_DEFAULT,
      clues: CLUES_DEFAULT,
      gallery: GALLERY_DEFAULT,
    });
  }
  function exportJson() {
    const data = { event: eventCfg, clues, gallery };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, "cumple-toni-config.json");
    URL.revokeObjectURL(url);
  }
  function importJson(obj) {
    if (!obj || typeof obj !== "object") return;
    if (obj.event) setEventCfg(obj.event);
    if (Array.isArray(obj.clues)) setClues(obj.clues);
    if (Array.isArray(obj.gallery)) setGallery(obj.gallery);
    safeLocalSet(CONFIG_KEY, {
      event: obj.event ?? eventCfg,
      clues: obj.clues ?? clues,
      gallery: obj.gallery ?? gallery,
    });
  }

  return {
    eventCfg,
    setEventCfg,
    clues,
    setClues,
    gallery,
    setGallery,
    save,
    reset,
    exportJson,
    importJson,
  };
}

/* ===================
   USUARIO + PROGRESO POR EMAIL
   =================== */
function useUserProfile() {
  const [user, setUser] = useState(() => safeLocalGet(USER_KEY));

  function login(name, email) {
    const clean = (s) => String(s || "").trim();
    const u = { name: clean(name) || "Invitado", email: clean(email).toLowerCase() };
    if (!u.email) return null;
    safeLocalSet(USER_KEY, u);
    setUser(u);
    return u;
  }
  function logout() {
    safeLocalRemove(USER_KEY);
    setUser(null);
  }

  return { user, login, logout };
}

function useProgress(userEmail) {
  const [map, setMap] = useState(() => safeLocalGet(PROGRESS_KEY) ?? {});
  const userState = userEmail ? map[userEmail] ?? {} : {};
  const progress = userState;

  function write(nextUserState) {
    if (!userEmail) return;
    const nextMap = { ...map, [userEmail]: nextUserState };
    setMap(nextMap);
    safeLocalSet(PROGRESS_KEY, nextMap);
  }

  function incAttempt(id) {
    if (!userEmail) return 0;
    const cur = userState[id] ?? { solved: false, attempts: 0 };
    const after = (cur.attempts ?? 0) + 1;
    const next = { ...userState, [id]: { ...cur, attempts: after } };
    write(next);
    return after;
  }

  function markSolved(id, payload) {
    if (!userEmail) return;
    const cur = userState[id] ?? { solved: false, attempts: 0 };
    const next = {
      ...userState,
      [id]: { ...cur, solved: true, payload: payload ?? ANSWER_PAYLOAD[id] },
    };
    write(next);
  }

  return { progress, incAttempt, markSolved };
}

/* ===================
   UTILIDADES
   =================== */
function safeLocalGet(key) {
  try {
    return typeof window === "undefined"
      ? null
      : JSON.parse(window.localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}
function safeLocalSet(key, value) {
  try {
    if (typeof window !== "undefined")
      window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function safeLocalRemove(key) {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  } catch {}
}
function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function useNow(tickMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  return now;
}
function formatDiff(ms) {
  if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0 };
  const s = Math.floor(ms / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}
function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}
function sanitize(str = "") {
  return (str || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* ===================
   VALIDADORES DE RESPUESTA (1..7)
   =================== */
const ANSWERS = {
  1: (ans) => sanitize(ans) === "perjudik2",
  2: (ans) => ["estiercocolla", "botellodromo"].includes(sanitize(ans)),
  3: (ans) => {
    const s = sanitize(ans);
    return s === "musica" || s === "la musica";
  },
  // genérico; no aceptar nombres propios (p.ej., zeppelin)
  4: (ans) => {
    const s = sanitize(ans);
    if (!s) return false;
    if (s.includes("zeppelin")) return false;
    const ok =
      (s.includes("sala") &&
        (s.includes("conciert") || s.includes("musical"))) ||
      s.includes("templo musical") ||
      s.includes("templo de la musica") ||
      s.includes("antigua sala") ||
      s.includes("sitio de conciertos") ||
      s.includes("sala mitica");
    return ok;
  },
  5: (ans) => sanitize(ans) === "futbolin",
  6: (ans) => ["batcolla", "la batcolla"].includes(sanitize(ans)),
  7: (ans) => sanitize(ans) === "zeppelin",
};

/* Respuestas “oficiales” para auto-desbloqueo/mostrar solución */
const ANSWER_PAYLOAD = {
  1: { type: "text", content: "Perjudik2" },
  2: { type: "text", content: "Estiercocolla (también válido: Botellódromo)" },
  3: { type: "text", content: "La música" },
  4: { type: "text", content: "Una sala de conciertos (templo musical mítico)" },
  5: { type: "text", content: "Futbolín" },
  6: { type: "text", content: "La Batcolla" },
  7: {
    type: "image",
    content:
      "https://scontent.fvlc5-1.fna.fbcdn.net/v/t39.30808-6/504143647_24244934781781281_8196324863052406172_n.jpg?_nc_cat=108&ccb=1-7&_nc_sid=a5f93a&_nc_ohc=oZi3sVyqDm0Q7kNvwGkisfa&_nc_oc=Adkn3XWbB3Kwn2d0S-E4WEBm5ydpq5CcFRnVPKSyhS9-yNUIlXgf_aNL2iduTSAwFww&_nc_zt=23&_nc_ht=scontent.fvlc5-1.fna&_nc_gid=LDOgVNYvwucf3BVA5IHPRg&oh=00_AfYqta6JMiRx3QW-tMlp_3oTqAEdLJNgS_c_WBEw7fAhPA&oe=68D8702D",
  },
};

/* ===== QR helper ===== */
function buildQrUrl(data, size = 320) {
  const encoded = encodeURIComponent(data);
  // Servicio público para generar QR: puedes cambiarlo si prefieres otro
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&qzone=2&data=${encoded}`;
}

/* ===================
   APP
   =================== */
export default function App() {
  const {
    eventCfg,
    setEventCfg,
    clues,
    setClues,
    gallery,
    setGallery,
    save,
    reset,
    exportJson,
    importJson,
  } = usePersistentConfig();

  const now = useNow(1000);
  const eventDate = useMemo(() => new Date(eventCfg.date), [eventCfg.date]);
  const msLeft = eventDate.getTime() - now.getTime();
  const t = formatDiff(msLeft);
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const isAdmin = params.get("admin") === "1";
  const showTests = params.get("tests") === "1" || isAdmin;

  const revealed = useMemo(
    () => clues.map((c) => ({ ...c, revealed: now >= new Date(c.revealAt) })),
    [now, clues]
  );
  const eventEnded = msLeft <= 0;

  /* Usuario activo (RSVP in-app) + progreso */
  const { user, login, logout } = useUserProfile();

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-gradient-to-b from-zinc-900 via-zinc-900 to-black text-zinc-100">
      <header className="max-w-screen-2xl mx-auto px-3 sm:px-4 pt-8 sm:pt-10 pb-4 sm:pb-6">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          {eventCfg.title}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400">
          {new Date(eventCfg.date).toLocaleString()} · {eventCfg.locationLabel}
        </p>
      </header>

      <main className="max-w-screen-2xl mx-auto px-3 sm:px-4 pb-16 sm:pb-20">
        {/* Cuenta atrás */}
        <section>
          <h2 className="text-lg sm:text-xl font-medium mb-2">Cuenta atrás</h2>
          {!eventEnded ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <TimeCard label="Días" value={t.d} />
              <TimeCard label="Horas" value={t.h} />
              <TimeCard label="Min" value={t.m} />
              <TimeCard label="Seg" value={t.s} />
            </div>
          ) : (
            <div className="p-3 sm:p-4 rounded-2xl bg-emerald-500/10 border border-emerald-600 text-emerald-300">
              ¡Es hoy! 🚀
            </div>
          )}

          {/* CTA: RSVP externo + Añadir Calendario */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* RSVP interno que gobierna el quiz */}
            <div className="col-span-1 md:col-span-2">
              <RsvpCard
                user={user}
                onLogin={(n, e) => login(n, e)}
                onLogout={logout}
                externalUrl={eventCfg.rsvpUrl}
              />
            </div>

            <AddToCalendar
              title={eventCfg.title}
              dateIso={eventCfg.date}
              details={`Nos vemos en ${eventCfg.locationLabel}!`}
            />
          </div>
        </section>

        {/* Pistas + Quiz con validación por usuario */}
        <section className="mt-8 sm:mt-10">
          <h2 className="text-lg sm:text-xl font-medium mb-3 sm:mb-4">
            Pistas semanales para adivinar la sorpresa!
          </h2>
          
          <RiddlesQuiz
            clues={revealed}
            enabled={!!user}
            email={user?.email ?? ""}
          />
        </section>

        {/* Playlist */}
        <section className="mt-8 sm:mt-10">
          <h2 className="text-lg sm:text-xl font-medium mb-2">🎵 Playlist</h2>
          <div className="rounded-3xl overflow-hidden border border-zinc-800">
            <iframe
              className="w-full h-64 md:h-80 lg:h-[352px]"
              src={normalizeSpotifyEmbed(eventCfg.spotifyPlaylistUrl)}
              width="100%"
              height="352"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          </div>
        </section>

        {/* Galería */}
        <section className="mt-8 sm:mt-10">
          <h2 className="text-lg sm:text-xl font-medium mb-2">📸 Galería</h2>
          {now < new Date(eventCfg.galleryOpensAt) ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-zinc-400">
              🔒 Disponible el {new Date(eventCfg.galleryOpensAt).toLocaleString()}
            </div>
          ) : (
            <>
              {/* Bloque QR para subir fotos */}
              <div className="rounded-2xl border border-emerald-700/60 bg-emerald-500/5 p-4 mb-4">
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <img
                    src={buildQrUrl(GALLERY_UPLOAD_URL, 320)}
                    alt="QR para subir fotos"
                    className="w-48 h-48 md:w-56 md:h-56 rounded-xl border border-emerald-700/60 bg-black object-contain"
                    loading="lazy"
                  />
                  <div className="text-emerald-200">
                    <p className="font-semibold">¡Sube tus fotos a la galería!</p>
                    <p className="text-sm opacity-80 mt-1">
                      Escanea el QR con tu móvil o pulsa el botón:
                    </p>
                    <a
                      href={GALLERY_UPLOAD_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center mt-3 rounded-xl px-3 py-2 bg-white text-black text-sm"
                    >
                      Abrir enlace para subir fotos
                    </a>
                  </div>
                </div>
              </div>

              {/* Rejilla de fotos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {gallery.map((g, i) => (
                  <img
                    key={i}
                    src={g.src}
                    alt={g.alt ?? `Foto ${i + 1}`}
                    className="rounded-2xl border border-zinc-800"
                  />
                ))}
              </div>
            </>
          )}
        </section>

        {/* Admin */}
        {isAdmin && (
          <section className="mt-8 sm:mt-10">
            <AdminPanel
              eventCfg={eventCfg}
              setEventCfg={setEventCfg}
              clues={clues}
              setClues={setClues}
              gallery={gallery}
              setGallery={setGallery}
              onSave={save}
              onReset={reset}
              onExport={exportJson}
              onImport={importJson}
            />
          </section>
        )}

        {/* Tests */}
        {showTests && <section className="mt-8 sm:mt-10">{/* <SelfTests /> */}</section>}
      </main>

      <footer className="max-w-screen-2xl mx-auto px-3 sm:px-4 pb-10 text-center text-zinc-500 text-xs sm:text-sm">
        Hecho con ❤️ por Toneti · {new Date().getFullYear()}
      </footer>
    </div>
  );
}

/* ===================
   COMPONENTES AUXILIARES
   =================== */
function TimeCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-3 sm:p-4">
      <div className="text-2xl sm:text-3xl font-bold tabular-nums">
        {String(value).padStart(2, "0")}
      </div>
      <div className="text-[11px] sm:text-xs text-zinc-400 mt-1">{label}</div>
    </div>
  );
}

function LockedClue({ revealAt, now }) {
  const diff = new Date(revealAt).getTime() - now.getTime();
  const { d, h, m } = formatDiff(diff);
  return (
    <div className="mt-2 text-zinc-400 text-sm">
      🔒 Se desbloquea el {new Date(revealAt).toLocaleString()} · Faltan {d}d {h}h {m}m
    </div>
  );
}

function AddToCalendar({ title, dateIso, details }) {
  const ics = useMemo(() => buildICS({ title, dateIso, details }), [
    title,
    dateIso,
    details,
  ]);
  const dataUrl = `data:text/calendar;charset=utf8,${encodeURIComponent(ics)}`;
  return (
    <a
      href={dataUrl}
      download="evento.ics"
      className="inline-flex items-center justify-center rounded-2xl px-4 py-3 sm:py-3.5 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 transition w-full"
    >
      Añadir al calendario (.ics)
    </a>
  );
}

/* RSVP in-app */
function RsvpCard({ user, onLogin, onLogout, externalUrl }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  if (user) {
    return (
      <div className="rounded-2xl border border-emerald-800 bg-emerald-500/10 p-4">
        <p className="text-emerald-300 text-sm">
          ✅ Asistencia confirmada para <b>{user.name}</b> · {user.email}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <p className="text-sm text-zinc-300">
        Confirma tu asistencia para desbloquear el juego de adivinanzas.
      </p>
      <div className="mt-3 grid sm:grid-cols-2 gap-2">
        <input
          className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100"
          placeholder="Nombre o apodo"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => onLogin(name, email)}
          className="inline-flex items-center rounded-xl px-3 py-2 bg-white text-black text-sm"
        >
          Confirmar asistencia y jugar
        </button>
        <a
          href={externalUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-xl px-3 py-2 bg-zinc-800 text-zinc-100 text-sm"
        >
        </a>
      </div>
    </div>
  );
}

/* Quiz + validación por usuario + auto-desbloqueo a 3 intentos */
function RiddlesQuiz({ clues, enabled, email }) {
  const now = useNow(1000);
  const { progress, incAttempt, markSolved } = useProgress(email);

  const solvedCount = Object.values(progress).filter((x) => x?.solved).length;

  return (
    <div>
      {/* resumen progreso */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-zinc-400">
          Progreso: <b>{solvedCount}</b>/7
        </div>
        <div
          className="h-2 w-48 rounded-full bg-zinc-800 overflow-hidden"
          aria-hidden
        >
          <div
            className="h-2 bg-emerald-500 transition-all"
            style={{ width: `${(solvedCount / 7) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {clues.map((c, idx) => {
          const id = idx + 1; // 1..7
          const r = c;
          const isRevealed = r.revealed;
          const state = progress[id] ?? { solved: false, attempts: 0 };
          const isSolved = !!state.solved;

          return (
            <div
              key={idx}
              className={cx(
                "rounded-3xl border p-4 sm:p-5",
                isRevealed
                  ? "border-emerald-700/60 bg-emerald-500/5"
                  : "border-zinc-800 bg-zinc-900/40"
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-semibold">{r.title}</h3>
                <span className="text-xl sm:text-2xl">{r.emoji ?? "✨"}</span>
              </div>

              {/* Bloqueos por fecha / RSVP */}
              {!isRevealed && (
                <div className="mt-2 text-zinc-400 text-sm">
                  <LockedClue revealAt={r.revealAt} now={now} />
                </div>
              )}
              {isRevealed && !enabled && (
                <div className="mt-2 text-zinc-400 text-sm">
                  🔒 Confirma asistencia para responder.
                </div>
              )}

              {/* Enunciado */}
              {isRevealed && <p className="mt-2 text-zinc-200">{r.body}</p>}

              {/* Input de respuesta */}
              {isRevealed && enabled && (
                <RiddleAnswer
                  id={id}
                  state={state}
                  onAttempt={() => incAttempt(id)}
                  onSolved={(payload) => markSolved(id, payload)}
                  requirePrev={
                    id === 7 ? [1, 2, 3, 4, 5, 6].every((k) => progress[k]?.solved) : true
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RiddleAnswer({ id, state, onAttempt, onSolved, requirePrev }) {
  const [val, setVal] = useState("");
  const [msg, setMsg] = useState("");
  const solved = !!state?.solved;
  const attempts = state?.attempts ?? 0;
  const payload = state?.payload; // {type, content}

  useEffect(() => {
    if (solved) setMsg("✅ ¡Correcto!");
  }, [solved]);

  function check() {
    if (id === 7 && !requirePrev) {
      setMsg("⛔ Primero resuelve las 6 anteriores.");
      return;
    }
    if (solved) return;

    const okFn = ANSWERS[id];
    const ok = okFn ? okFn(val) : false;

    if (ok) {
      onSolved(ANSWER_PAYLOAD[id]);
      setMsg("✅ ¡Correcto!");
      return;
    }

    // fallo → incrementa intento
    const after = onAttempt(); // devuelve intentos acumulados
    const nextAttempts = typeof after === "number" ? after : attempts + 1;
    setMsg("❌ Sigue intentando…");

    // al 3er fallo, auto-desbloqueo con payload oficial
    if (nextAttempts >= 3) {
      onSolved(ANSWER_PAYLOAD[id]);
      setMsg("✅ Desbloqueada automáticamente tras 3 intentos.");
    }
  }

  return (
    <div className="mt-3">
      {/* Input + botón (bloqueados si solved) */}
      <div className="flex gap-2">
        <input
          disabled={solved}
          className={cx(
            "flex-1 rounded-xl bg-zinc-900 border px-3 py-2 text-zinc-100",
            solved ? "border-emerald-700/60" : "border-zinc-700"
          )}
          placeholder="Escribe tu respuesta"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && check()}
        />
        <button
          disabled={solved}
          onClick={check}
          className={cx(
            "rounded-xl px-3 py-2 text-sm",
            solved
              ? "bg-emerald-600/20 text-emerald-300 cursor-default"
              : "bg-white text-black"
          )}
        >
          {solved ? "Resuelto" : "Comprobar"}
        </button>
      </div>

      {/* Mensaje + pista especial para #4 */}
      {msg && (
        <div
          className={cx(
            "mt-2 text-sm",
            msg.startsWith("✅") ? "text-emerald-300" : "text-red-400"
          )}
        >
          {msg} {!solved && attempts > 0 && attempts < 3 ? `· Intentos: ${attempts}` : ""}
        </div>
      )}
      {id === 4 && !solved && (
        <details className="mt-2 text-sm text-zinc-400">
          <summary className="cursor-pointer">💡 Pista</summary>
          Responde de forma genérica (p. ej., “sala de conciertos”). Aquí no aceptamos el nombre propio.
        </details>
      )}

      {/* Cuando esté resuelta (acierto o auto-unlock) mostramos la “respuesta oficial”
          - texto para 1..6
          - imagen para la #7 */}
      {solved && payload && (
        <div className="mt-3">
          {payload.type === "text" ? (
            <div className="text-sm text-emerald-300">
              ✅ Respuesta: <b>{payload.content}</b>
            </div>
          ) : payload.type === "image" ? (
            <div className="rounded-2xl overflow-hidden border border-emerald-700/60 bg-emerald-500/5">
              <img
                src={payload.content}
                alt="Respuesta final"
                className="w-full h-auto block"
                loading="lazy"
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ===================
   ICS BUILDER
   =================== */
function buildICS({ title, dateIso, details = "" }) {
  const dt = new Date(dateIso);
  const pad = (n) => String(n).padStart(2, "0");
  const toUTC = (d) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(
      d.getUTCDate()
    )}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  const startUtc = toUTC(dt);
  const endUtc = toUTC(new Date(dt.getTime() + 3 * 60 * 60 * 1000));
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cumple Toni//ES",
    "BEGIN:VEVENT",
    `UID:${cryptoRandom()}`,
    `DTSTAMP:${startUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${escapeICS(title)}`,
    `DESCRIPTION:${escapeICS(details)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\n");
}

function cryptoRandom() {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(8);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(16).slice(2);
}
function escapeICS(s) {
  return String(s).replaceAll(/([,;])/g, "\\$1").replaceAll(/\n/g, "\\n");
}

/* Spotify embed */
function normalizeSpotifyEmbed(url) {
  try {
    if (!url) return url;
    let u = String(url).trim();
    u = u.replace(/open\.spotify\.com\/intl-[a-z]{2}\//i, "open.spotify.com/");
    if (/spotify\.link\//i.test(u)) return u;

    const parsed = new URL(u);
    const parts = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (parts[0] !== "embed") parts.unshift("embed");
    return `https://open.spotify.com/${parts.join("/")}${parsed.search}`;
  } catch {
    return url;
  }
}

/* ===================
   ADMIN (sin cambios funcionales de UI)
   =================== */
function AdminPanel({
  eventCfg,
  setEventCfg,
  clues,
  setClues,
  gallery,
  setGallery,
  onSave,
  onReset,
  onExport,
  onImport,
}) {
  function updateEvent(field, value) {
    setEventCfg({ ...eventCfg, [field]: value });
  }
  function updateClue(idx, field, value) {
    const next = clues.slice();
    next[idx] = { ...next[idx], [field]: value };
    setClues(next);
  }
  function addClue() {
    setClues([
      ...clues,
      {
        title: "Nueva pista",
        body: "Texto…",
        revealAt: new Date().toISOString(),
        emoji: "✨",
      },
    ]);
  }
  function removeClue(idx) {
    setClues(clues.filter((_, i) => i !== idx));
  }
  function updatePhoto(idx, field, value) {
    const next = gallery.slice();
    next[idx] = { ...next[idx], [field]: value };
    setGallery(next);
  }
  function addPhoto() {
    setGallery([...gallery, { src: "https://", alt: "Nueva" }]);
  }
  function removePhoto(idx) {
    setGallery(gallery.filter((_, i) => i !== idx));
  }
  function importFromFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onImport(JSON.parse(String(reader.result)));
      } catch {
        alert("JSON inválido");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }
  function onCoverUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateEvent("coverImage", String(reader.result));
    reader.readAsDataURL(file);
    e.target.value = "";
  }
  function onGalleryUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setGallery([...gallery, { src: String(reader.result), alt: "Subida" }]);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const localDateValue = toDatetimeLocalValue(eventCfg.date);
  function onDateLocalChange(v) {
    const iso = isoFromDatetimeLocal(v);
    if (iso) updateEvent("date", iso);
  }

  return (
    <div className="rounded-2xl border border-blue-800 bg-blue-500/10 p-4 text-blue-100">
      <p className="font-semibold text-blue-100">🛠️ Panel de administración</p>

      {/* Evento */}
      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        <TextInput
          label="Título"
          value={eventCfg.title}
          onChange={(v) => updateEvent("title", v)}
        />

        <label className="text-sm">
          <span className="block text-blue-200/80 mb-1">Fecha/Hora (datetime-local)</span>
          <input
            type="datetime-local"
            value={localDateValue}
            onChange={(e) => onDateLocalChange(e.target.value)}
            className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100"
          />
          <span className="block text-xs text-blue-200/70 mt-1">
            ISO actual: {eventCfg.date}
          </span>
        </label>

        <TextInput
          label="Ubicación (texto)"
          value={eventCfg.locationLabel}
          onChange={(v) => updateEvent("locationLabel", v)}
        />
        <TextInput
          label="URL ubicación"
          value={eventCfg.locationUrl}
          onChange={(v) => updateEvent("locationUrl", v)}
        />
        <TextInput
          label="URL RSVP"
          value={eventCfg.rsvpUrl}
          onChange={(v) => updateEvent("rsvpUrl", v)}
        />
        <TextInput
          label="Hashtag"
          value={eventCfg.hashtag}
          onChange={(v) => updateEvent("hashtag", v)}
        />

        <TextInput
          label="Imagen portada (URL)"
          value={eventCfg.coverImage}
          onChange={(v) => updateEvent("coverImage", v)}
        />
        <label className="text-sm">
          <span className="block text-blue-200/80 mb-1">o Subir portada (archivo)</span>
          <input
            type="file"
            accept="image/*"
            onChange={onCoverUpload}
            className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100"
          />
        </label>

        <TextInput
          label="Playlist Spotify (URL o embed)"
          value={eventCfg.spotifyPlaylistUrl}
          onChange={(v) =>
            updateEvent("spotifyPlaylistUrl", normalizeSpotifyEmbed(v))
          }
        />

        <label className="text-sm">
          <span className="block text-blue-200/80 mb-1">Apertura galería (datetime-local)</span>
          <input
            type="datetime-local"
            value={toDatetimeLocalValue(eventCfg.galleryOpensAt)}
            onChange={(e) =>
              updateEvent("galleryOpensAt", isoFromDatetimeLocal(e.target.value))
            }
            className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100"
          />
          <span className="block text-xs text-blue-200/70 mt-1">
            ISO actual: {eventCfg.galleryOpensAt}
          </span>
        </label>
      </div>

      {/* Pistas */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <p className="font-medium">Pistas</p>
          <button
            onClick={addClue}
            className="text-sm px-3 py-1 rounded-lg bg-white text-black"
          >
            Añadir pista
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {clues.map((c, idx) => (
            <div key={idx} className="rounded-xl border border-blue-800/60 bg-blue-500/5 p-3">
              <div className="grid sm:grid-cols-2 gap-2">
                <TextInput
                  label="Título"
                  value={c.title}
                  onChange={(v) => updateClue(idx, "title", v)}
                />
                <TextInput
                  label="Emoji"
                  value={c.emoji ?? ""}
                  onChange={(v) => updateClue(idx, "emoji", v)}
                />
                <label className="text-sm">
                  <span className="block text-blue-200/80 mb-1">Revelar en</span>
                  <input
                    type="datetime-local"
                    value={toDatetimeLocalValue(c.revealAt)}
                    onChange={(e) =>
                      updateClue(idx, "revealAt", isoFromDatetimeLocal(e.target.value))
                    }
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100"
                  />
                </label>
                <TextInput
                  label="Texto"
                  value={c.body}
                  onChange={(v) => updateClue(idx, "body", v)}
                />
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => removeClue(idx)}
                  className="text-xs px-2 py-1 rounded bg-red-700"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Galería */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <p className="font-medium">Galería</p>
          <div className="flex gap-2">
            <button
              onClick={addPhoto}
              className="text-sm px-3 py-1 rounded-lg bg-white text-black"
            >
              Añadir foto (URL)
            </button>
            <label className="text-sm px-3 py-1 rounded-lg bg-white text-black cursor-pointer">
              Subir foto
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onGalleryUpload}
              />
            </label>
          </div>
        </div>
        <div className="mt-3 space-y-3">
          {gallery.map((g, idx) => (
            <div key={idx} className="rounded-xl border border-blue-800/60 bg-blue-500/5 p-3">
              <div className="grid sm:grid-cols-2 gap-2">
                <TextInput
                  label="URL imagen"
                  value={g.src}
                  onChange={(v) => updatePhoto(idx, "src", v)}
                />
                <TextInput
                  label="Alt"
                  value={g.alt ?? ""}
                  onChange={(v) => updatePhoto(idx, "alt", v)}
                />
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => removePhoto(idx)}
                  className="text-xs px-2 py-1 rounded bg-red-700"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Persistencia */}
      <div className="mt-6 flex flex-wrap gap-2">
        <button onClick={onSave} className="px-3 py-2 rounded-lg bg-white text-black">
          Guardar
        </button>
        <button onClick={onReset} className="px-3 py-2 rounded-lg bg-zinc-800">
          Reiniciar a defecto
        </button>
        <button onClick={onExport} className="px-3 py-2 rounded-lg bg-zinc-800">
          Exportar JSON
        </button>
        <label className="px-3 py-2 rounded-lg bg-zinc-800 cursor-pointer">
          Importar JSON
          <input type="file" accept="application/json" className="hidden" onChange={importFromFile} />
        </label>
      </div>
    </div>
  );
}

function TextInput({ label, value, onChange }) {
  return (
    <label className="text-sm">
      <span className="block text-blue-200/80 mb-1">{label}</span>
      <input
        className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/* ===================
   Helpers datetime-local ↔ ISO (sin libs)
   =================== */
function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
function isoFromDatetimeLocal(localStr) {
  if (!localStr) return "";
  const [date, time] = localStr.split("T");
  const [y, m, d] = date.split("-").map((n) => parseInt(n, 10));
  const [hh, mi] = time.split(":").map((n) => parseInt(n, 10));
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mi || 0, 0);
  return dt.toISOString();
}
