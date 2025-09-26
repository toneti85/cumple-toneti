import { useEffect, useMemo, useState } from "react";

/* =============================================================
   CUMPLE TONI — Landing (RSVP por nombre + Supabase + Admin)
   ============================================================= */

/* ===================
   CONFIGURACIÓN POR DEFECTO
   =================== */
const EVENT_DEFAULT = {
  title: "¡40 Cumple de Toneti!",
  date: "2025-11-15T12:30:00+01:00",
  locationLabel: "Colla + Sorpresa",
  locationUrl: "https://maps.app.goo.gl/WW4huSdBFsvJZ4Yt7",
  rsvpUrl: "",
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
      "Éramos jóvenes, sin miedo ni ley, en la calle San Roque empezó todo aquello. Un local prestado y menudas fiestas!!! Hasta una traca de 50 metros se tiró dentro.... ¿qué nombre tenía nuestra primera colla?",
    revealAt: "2025-10-01T09:00:00+02:00",
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
const LOCAL_ATTENDEES_KEY = "cumple-toni-attendees-v1";
const LOCAL_CURRENT_NAME = "cumple-toni-current-name";
const GALLERY_UPLOAD_URL =
  "https://app.eventocam.com/galeria/K6qhGNwbCG7S/subir";

// ===================
// SUPABASE (opcional)
// ===================
// Define estas dos variables en el build (Vite):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
const SUPABASE = {
  url: (import.meta?.env?.VITE_SUPABASE_URL) || "",
  key: (import.meta?.env?.VITE_SUPABASE_ANON_KEY) || "",
};
const hasSupa = Boolean(SUPABASE.url && SUPABASE.key);

async function supaFetch(path, { method = "GET", body, headers = {} } = {}) {
  if (!hasSupa) throw new Error("Supabase no configurado");
  const res = await fetch(`${SUPABASE.url}${path}`, {
    method,
    headers: {
      apikey: SUPABASE.key,
      Authorization: `Bearer ${SUPABASE.key}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status}`);
  return await res.json();
}

// REST: /rest/v1/attendees
async function supaAddOrUpdateAttendee({ name, meal, party }) {
  const existing = await supaSelectAttendee(name);
  if (existing) {
    await supaFetch(`/rest/v1/attendees?name=eq.${encodeURIComponent(name)}`, {
      method: "PATCH",
      body: { meal: !!meal, party: !!party },
      headers: { Prefer: "return=representation" },
    });
  } else {
    await supaFetch(`/rest/v1/attendees`, {
      method: "POST",
      body: { name, meal: !!meal, party: !!party },
      headers: { Prefer: "return=representation" },
    });
  }
}
async function supaSelectAttendee(name) {
  const rows = await supaFetch(
    `/rest/v1/attendees?select=name,meal,party&name=eq.${encodeURIComponent(
      name
    )}`
  );
  return rows?.[0] || null;
}
async function supaListAttendees() {
  return await supaFetch(
    `/rest/v1/attendees?select=name,meal,party,created_at&order=created_at.desc`
  );
}

/* ===================
   Fallback localStorage para asistentes
   =================== */
function localListAttendees() {
  return safeLocalGet(LOCAL_ATTENDEES_KEY) ?? [];
}
function localGetAttendee(name) {
  const list = localListAttendees();
  return (
    list.find(
      (a) =>
        a.name.toLowerCase() === String(name).trim().toLowerCase()
    ) || null
  );
}
function localAddOrUpdateAttendee({ name, meal, party }) {
  const list = localListAttendees();
  const idx = list.findIndex(
    (a) => a.name.toLowerCase() === String(name).trim().toLowerCase()
  );
  if (idx >= 0) list[idx] = { ...list[idx], meal: !!meal, party: !!party };
  else
    list.push({
      name: String(name).trim(),
      meal: !!meal,
      party: !!party,
      created_at: new Date().toISOString(),
    });
  safeLocalSet(LOCAL_ATTENDEES_KEY, list);
  return list;
}

/* ===================
   PERSISTENCIA LOCAL UI
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
  const [currentName, setCurrentName] = useState(
    () => safeLocalGet(LOCAL_CURRENT_NAME) ?? ""
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

  function setAndPersistCurrentName(name) {
    setCurrentName(name);
    safeLocalSet(LOCAL_CURRENT_NAME, name);
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
    currentName,
    setAndPersistCurrentName,
  };
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
  } catch { }
}
function safeLocalRemove(key) {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  } catch { }
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

/* ===================
   VALIDADORES (si mantienes quiz por respuestas)
   =================== */
const sanitize = (str = "") =>
  (str || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const ANSWERS = {
  1: (ans) => sanitize(ans) === "perjudik2",
  2: (ans) => ["botellón"].includes(sanitize(ans)),
  3: (ans) => {
    const s = sanitize(ans);
    if (!s) return false;
    if (s.includes("zeppelin")) return false;
    const ok =
      s.includes("sala") ||
      s.includes("conciert") ||
      s.includes("musica") ||
      s.includes("disco");
    return ok;
  },
  4: (ans) => sanitize(ans) === "futbolin",
  5: (ans) => ["batcolla", "la batcolla"].includes(sanitize(ans)),
  6: (ans) => sanitize(ans) === "zeppelin",
};

const ANSWER_PAYLOAD = {
  1: { type: "text", content: "Perjudik2" },
  2: { type: "text", content: "Botellón" },
  3: { type: "text", content: "Sala de música " },
  4: { type: "text", content: "Futbolín" },
  5: { type: "text", content: "La Batcolla" },
  6: {
    type: "image",
    content:
      "https://scontent.fvlc5-1.fna.fbcdn.net/v/t39.30808-6/504143647_24244934781781281_8196324863052406172_n.jpg?_nc_cat=108&ccb=1-7&_nc_sid=a5f93a&_nc_ohc=oZi3sVyqDm0Q7kNvwGkisfa&_nc_oc=Adkn3XWbB3Kwn2d0S-E4WEBm5ydpq5CcFRnVPKSyhS9-yNUIlXgf_aNL2iduTSAwFww&_nc_zt=23&_nc_ht=scontent.fvlc5-1.fna&_nc_gid=LDOgVNYvwucf3BVA5IHPRg&oh=00_AfYqta6JMiRx3QW-tMlp_3oTqAEdLJNgS_c_WBEw7fAhPA&oe=68D8702D",
  },
};

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
    currentName,
    setAndPersistCurrentName,
  } = usePersistentConfig();

  const now = useNow(1000);
  const eventDate = useMemo(() => new Date(eventCfg.date), [eventCfg.date]);
  const msLeft = eventDate.getTime() - now.getTime();
  const t = formatDiff(msLeft);
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const isAdmin = params.get("admin") === "1";

  const revealed = useMemo(
    () => clues.map((c) => ({ ...c, revealed: now >= new Date(c.revealAt) })),
    [now, clues]
  );
  const eventEnded = msLeft <= 0;

  // ¿el nombre actual está confirmado (comida o fiesta)?
  const [isConfirmed, setIsConfirmed] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      if (!currentName) {
        setIsConfirmed(false);
        return;
      }
      if (hasSupa) {
        try {
          const row = await supaSelectAttendee(currentName);
          if (active) setIsConfirmed(!!row && (row.meal || row.party));
        } catch {
          if (active) setIsConfirmed(false);
        }
      } else {
        const row = localGetAttendee(currentName);
        setIsConfirmed(!!row && (row.meal || row.party));
      }
    })();
    return () => {
      active = false;
    };
  }, [currentName]);

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-gradient-to-b from-zinc-900 via-zinc-900 to-black text-zinc-100">

      {/* HERO centrado */}
      <section className="relative w-full flex items-center justify-center py-6 sm:py-10">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-zinc-900 via-zinc-900 to-black" />
        <div className="w-full max-w-screen-md px-3 sm:px-4">
          <h1 className="text-2xl sm:text-3xl leading-tight font-semibold tracking-tight text-center">{eventCfg.title}</h1>
          <p className="mt-2 text-center text-sm sm:text-base text-zinc-400">
            {new Date(eventCfg.date).toLocaleString()} · {eventCfg.locationLabel}
          </p>

          {/* Cuenta atrás */}
          <div className="mt-6">
            {!eventEnded ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <TimeCard label="Días" value={t.d} />
                <TimeCard label="Horas" value={t.h} />
                <TimeCard label="Min" value={t.m} />
                <TimeCard label="Seg" value={t.s} />
              </div>
            ) : (
              <div className="p-3 sm:p-4 rounded-2xl bg-emerald-500/10 border border-emerald-600 text-emerald-300 text-center">
                ¡Es hoy! 🚀
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            {/* Izquierda: RSVP */}
            <RSVPBox
              currentName={currentName}
              setCurrentName={setAndPersistCurrentName}
              onConfirmedChange={setIsConfirmed}
            />

            {/* Derecha: mini reproductor */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
              <h3 className="text-sm text-zinc-300 mb-2">🎵 Playlist</h3>
              <div className="rounded-xl overflow-hidden border border-zinc-800">
                <iframe
                  className="w-full"
                  style={{ height: 152 }}
                  src={miniSpotifyEmbed(eventCfg.spotifyPlaylistUrl)}
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  title="Spotify playlist"
                />
              </div>
            </div>
          </div>

          {/* Fila de CTA: .ics + ubicación con la misma altura */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AddToCalendar
              title={eventCfg.title}
              dateIso={eventCfg.date}
              details={`Nos vemos en ${eventCfg.locationLabel}!`}
              className="h-12 sm:h-[52px] py-0"
            />
            <a
              href={eventCfg.locationUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl px-4 h-12 sm:h-[52px] bg-zinc-800 text-zinc-100 hover:bg-zinc-700 transition w-full"
            >
              Ver ubicación
            </a>
          </div>

        </div>
      </section>

      {/* Contenido */}
      <main className="max-w-screen-2xl mx-auto px-3 sm:px-4 pb-16 sm:pb-20">
        {/* Pistas */}
        <section className="mt-6 sm:mt-8">
          <h2 className="text-lg sm:text-xl font-medium mb-3 sm:mb-4">
            Pistas semanales
          </h2>

          {!isConfirmed ? (
            <div className="rounded-2xl border border-yellow-700 bg-yellow-500/10 p-4 text-yellow-200">
              Para desbloquear las pistas y descubrir donde será la fiesta, introduce tu nombre en “Confirmar” y las pistas se desbloquearán
              cuando llegue la fecha.
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {revealed.map((c, idx) => (
              <div
                key={idx}
                className={cx(
                  "rounded-3xl border p-4 sm:p-5",
                  c.revealed
                    ? "border-emerald-700/60 bg-emerald-500/5"
                    : "border-zinc-800 bg-zinc-900/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-semibold">
                    {c.title}
                  </h3>
                  <span className="text-xl sm:text-2xl">{c.emoji ?? "✨"}</span>
                </div>
                {c.revealed ? (
                  isConfirmed ? (
                    <p className="mt-2 text-zinc-200">{c.body}</p>
                  ) : (
                    <LockedClue revealAt={c.revealAt} now={now} />
                  )
                ) : (
                  <LockedClue revealAt={c.revealAt} now={now} />
                )}
              </div>
            ))}
          </div>
        </section>



        {/* Galería */}
        <section className="mt-10">
          <h2 className="text-lg sm:text-xl font-medium mb-2">📸 Galería</h2>
          {now < new Date(eventCfg.galleryOpensAt) ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-zinc-400">
              🔒 Disponible el{" "}
              {new Date(eventCfg.galleryOpensAt).toLocaleString()}
            </div>
          ) : (
            <>
              {/* QR subir fotos */}
              <div className="rounded-2xl border border-emerald-700/60 bg-emerald-500/5 p-4 mb-4">
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <img
                    src={buildQrUrl(GALLERY_UPLOAD_URL, 320)}
                    alt="QR para subir fotos"
                    className="w-48 h-48 md:w-56 md:h-56 rounded-xl border border-emerald-700/60 bg-black object-contain"
                    loading="lazy"
                  />
                  <div className="text-emerald-200">
                    <p className="font-semibold">
                      ¡Sube tus fotos a la galería!
                    </p>
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
          <section className="mt-10">
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
            <AttendeesAdmin />
          </section>
        )}
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

function miniSpotifyEmbed(url) {
  try {
    if (!url) return url;
    let u = String(url).trim();
    u = u.replace(/open\.spotify\.com\/intl-[a-z]{2}\//i, "open.spotify.com/");
    const parsed = new URL(u);
    const parts = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/");
    if (parts[0] !== "embed") parts.unshift("embed");
    const search = new URLSearchParams(parsed.search);
    search.set("theme", "0"); // oscuro
    search.set("utm_source", "generator");
    return `https://open.spotify.com/${parts.join("/")}?${search.toString()}`;
  } catch { return url; }
}


function LockedClue({ revealAt, now }) {
  const diff = new Date(revealAt).getTime() - now.getTime();
  const { d, h, m } = formatDiff(diff);
  return (
    <div className="mt-2 text-zinc-400 text-sm">
      🔒 Se desbloquea el {new Date(revealAt).toLocaleString()} · Faltan {d}d{" "}
      {h}h {m}m
    </div>
  );
}

function AddToCalendar({ title, dateIso, details, className = "" }) {
  const ics = useMemo(() => buildICS({ title, dateIso, details }), [title, dateIso, details]);
  const dataUrl = `data:text/calendar;charset=utf8,${encodeURIComponent(ics)}`;
  return (
    <a
      href={dataUrl}
      download="evento.ics"
      className={
        "inline-flex items-center justify-center rounded-2xl px-4 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 transition w-full " +
        className
      }
    >
      Añadir al calendario (.ics)
    </a>
  );
}


/* RSVP por nombre + confirmación */
function RSVPBox({ currentName, setCurrentName, onConfirmedChange }) {
  const [name, setName] = useState(currentName || "");
  const [meal, setMeal] = useState(false);
  const [party, setParty] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setName(currentName || "");
  }, [currentName]);

  async function submit() {
    const n = String(name).trim();
    if (!n) {
      setStatus("Pon tu nombre ✍️");
      return;
    }
    setStatus("Guardando…");
    try {
      if (hasSupa) {
        await supaAddOrUpdateAttendee({ name: n, meal, party });
      } else {
        localAddOrUpdateAttendee({ name: n, meal, party });
      }
      setCurrentName(n);
      onConfirmedChange(true);
      setStatus("¡Confirmado!");
    } catch (e) {
      setStatus("Error al guardar");
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
      <label className="text-sm block mb-2">
        Tu nombre
        <input
          className="mt-1 w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-zinc-100"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre y apellidos"
        />
      </label>
      <div className="flex items-center gap-4 text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={meal}
            onChange={(e) => setMeal(e.target.checked)}
          />{" "}
          Comida
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={party}
            onChange={(e) => setParty(e.target.checked)}
          />{" "}
          Fiesta
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold
             bg-emerald-500 text-black
             hover:bg-emerald-400 active:bg-emerald-500/90
             border border-emerald-600/60 shadow-sm
             ring-1 ring-emerald-400/40
             transition-colors"
          style={{ WebkitTapHighlightColor: "transparent" }}
          aria-label="Confirmar asistencia"
        >
          Confirmar
        </button>
      </div>
      <div className="mt-2 text-xs text-zinc-400">
        {status ||
          (hasSupa
            ? "Guardado en la nube (Supabase)"
            : "Guardado en este navegador")}
      </div>
    </div>
  );
}

/* Admin: evento/pistas/galería + asistentes */
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
    <div className="rounded-2xl border border-blue-800 bg-blue-500/10 p-4 text-blue-100 mt-10">
      <p className="font-semibold text-blue-100">🛠️ Panel de administración</p>

      {/* Evento */}
      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        <TextInput
          label="Título"
          value={eventCfg.title}
          onChange={(v) => updateEvent("title", v)}
        />

        <label className="text-sm">
          <span className="block text-blue-200/80 mb-1">
            Fecha/Hora (datetime-local)
          </span>
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
          <span className="block text-blue-200/80 mb-1">
            o Subir portada (archivo)
          </span>
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
          <span className="block text-blue-200/80 mb-1">
            Apertura galería (datetime-local)
          </span>
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

      {/* Persistencia */}
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={onSave}
          className="px-3 py-2 rounded-lg bg-white text-black"
        >
          Guardar
        </button>
        <button
          onClick={onReset}
          className="px-3 py-2 rounded-lg bg-zinc-800"
        >
          Reiniciar a defecto
        </button>
        <button
          onClick={onExport}
          className="px-3 py-2 rounded-lg bg-zinc-800"
        >
          Exportar JSON
        </button>
        <label className="px-3 py-2 rounded-lg bg-zinc-800 cursor-pointer">
          Importar JSON
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={importFromFile}
          />
        </label>
      </div>
    </div>
  );
}

function AttendeesAdmin() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = hasSupa ? await supaListAttendees() : localListAttendees();
      setRows(data || []);
    } catch (e) {
      setError("No se pudo obtener la lista");
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="mt-6 rounded-2xl border border-fuchsia-800 bg-fuchsia-500/10 p-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold">👥 Asistentes</p>
        <button
          onClick={refresh}
          className="text-sm px-3 py-1 rounded-lg bg-white text-black"
        >
          Refrescar
        </button>
      </div>
      {error && <p className="text-sm text-red-300 mt-2">{error}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-300">
            <tr>
              <th className="py-1 pr-3">Nombre</th>
              <th className="py-1 pr-3">Comida</th>
              <th className="py-1 pr-3">Fiesta</th>
              <th className="py-1 pr-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="py-2 text-zinc-400">
                  Sin asistentes aún
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-zinc-800">
                <td className="py-1 pr-3">{r.name}</td>
                <td className="py-1 pr-3">{r.meal ? "✅" : "—"}</td>
                <td className="py-1 pr-3">{r.party ? "✅" : "—"}</td>
                <td className="py-1 pr-3">
                  {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
   ICS BUILDER (fix .join y escape)
   =================== */
function buildICS({ title, dateIso, details = "" }) {
  const dt = new Date(dateIso);
  const pad = (n) => String(n).padStart(2, "0");
  const toUTC = (d) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
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
  ].join("\n"); // 👈 importantísimo
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
  // Escapa comas y puntos y coma, y convierte saltos de línea a \n
  return String(s)
    .replaceAll(/([,;])/g, "\\$1")
    .replaceAll(/\n/g, "\\n");
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
   Helpers datetime-local ↔ ISO
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

/* ===== QR helper ===== */
function buildQrUrl(data, size = 320) {
  const encoded = encodeURIComponent(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&qzone=2&data=${encoded}`;
}
