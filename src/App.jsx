import { useEffect, useMemo, useState } from "react";

/* =============================================================
   Cumple — App 100% Supabase (sin localStorage) con panel de admin
   ============================================================= */

const GALLERY_UPLOAD_URL =
  "https://app.eventocam.com/galeria/K6qhGNwbCG7S/subir";

/* ===================
   CONFIG. SUPABASE
   =================== */
// VARIABLES DE ENTORNO (Vite)
const SUPABASE = {
  url: (import.meta?.env?.VITE_SUPABASE_URL || "").replace(/\/+$/, ""),
  key: (import.meta?.env?.VITE_SUPABASE_ANON_KEY || "").trim(),
};
const hasSupa = Boolean(SUPABASE.url && SUPABASE.key);

// Fetch genérico con logs y corrección de rutas
async function supaFetch(path, { method = "GET", body, headers = {} } = {}) {
  if (!hasSupa) throw new Error("Supabase no configurado");
  const cleanPath = String(path || "").replace(/^\/+/, "");
  const url = `${SUPABASE.url}/${cleanPath}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE.key,
      Authorization: `Bearer ${SUPABASE.key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get("content-type") || "";
  const payload = ct.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => "");
  if (!res.ok) {
    console.error(`[Supabase ${method}] ${url} → ${res.status}`, payload || "(sin body)");
    throw new Error(`Supabase ${res.status}`);
  }
  return payload ?? null;
}

/* ===================
   HELPERS DE FECHA Y UTILIDADES
   =================== */
// Convierte "YYYY-MM-DD HH:mm:ss+00" en "YYYY-MM-DDTHH:mm:ss+00"
const toIsoT = (s) => (typeof s === "string" && !s.includes("T") ? s.replace(" ", "T") : s);
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
function cx(...classes) { return classes.filter(Boolean).join(" "); }
function getAdminFlagFromUrl() {
  if (typeof window === "undefined") return false;
  const qs = new URLSearchParams(window.location.search);
  if (qs.get("admin") === "1" || qs.get("admin") === "true") return true;
  const hash = window.location.hash || "";
  const hashQuery = hash.includes("?") ? hash.split("?")[1] : hash.replace(/^#/, "");
  if (hashQuery) {
    const hq = new URLSearchParams(hashQuery);
    if (hq.get("admin") === "1" || hq.get("admin") === "true") return true;
  }
  return false;
}
function toDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function isoFromDatetimeLocal(localStr) {
  if (!localStr) return "";
  const [date, time] = localStr.split("T");
  const [y, m, d] = date.split("-").map((n) => parseInt(n, 10));
  const [hh, mi] = time.split(":").map((n) => parseInt(n, 10));
  const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mi || 0, 0);
  return dt.toISOString();
}
function buildICS({ title, dateIso, details = "" }) {
  const dt = new Date(dateIso || Date.now());
  const pad = (n) => String(n).padStart(2, "0");
  const toUTC = (d) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  const startUtc = toUTC(dt);
  const endUtc = toUTC(new Date(dt.getTime() + 3 * 60 * 60 * 1000));
  const esc = (s) => String(s).replaceAll(/([,;])/g, "\\$1").replaceAll(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cumple//ES",
    "BEGIN:VEVENT",
    `UID:${Math.random().toString(16).slice(2)}`,
    `DTSTAMP:${startUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(details)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\n");
}
function buildQrUrl(data, size = 320) {
  const encoded = encodeURIComponent(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&qzone=2&data=${encoded}`;
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
    search.set("theme", "0");
    search.set("utm_source", "generator");
    return `https://open.spotify.com/${parts.join("/")}?${search.toString()}`;
  } catch { return url; }
}
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
  } catch { return url; }
}

/* ===================
   ENDPOINTS ESPECÍFICOS
   =================== */
async function supaGetSettings() {
  const rows = await supaFetch(`rest/v1/settings?select=*&limit=1`);
  const s = rows?.[0];
  if (!s) return null;
  const pick = (o, ...keys) => keys.find((k) => o?.[k] != null) && o[keys.find((k) => o?.[k] != null)];
  return {
    title: s.title,
    date: toIsoT(pick(s, "date_iso", "date")),
    locationLabel: pick(s, "location_label", "locationLabel"),
    locationUrl: pick(s, "location_url", "locationUrl"),
    spotifyPlaylistUrl: pick(s, "spotify_url", "spotifyUrl"),
    galleryOpensAt: toIsoT(pick(s, "gallery_opens_at", "galleryOpensAt")),
  };
}
async function supaUpsertSettings(s) {
  const row = {
    id: 1,
    title: s.title,
    date_iso: s.date,
    location_label: s.locationLabel,
    location_url: s.locationUrl,
    spotify_url: s.spotifyPlaylistUrl,
    gallery_opens_at: s.galleryOpensAt,
    updated_at: new Date().toISOString(),
  };
  return await supaFetch(`rest/v1/settings`, {
    method: "POST",
    body: row,
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
  });
}
async function supaListClues() {
  const rows = await supaFetch(
    `rest/v1/clues?select=id,title,body,reveal_at,created_at&order=reveal_at.asc&limit=1000`
  );
  const list = Array.isArray(rows) ? rows : [];
  return list.map((x) => ({
    id: x.id,
    title: x.title ?? "",
    body: x.body ?? "",
    revealAt: toIsoT(x.reveal_at),
    createdAt: toIsoT(x.created_at),
  }));
}
async function supaInsertClue({ title, body, revealAt }) {
  return await supaFetch(`rest/v1/clues`, {
    method: "POST",
    body: { title, body, reveal_at: revealAt },
    headers: { Prefer: "return=representation" },
  });
}
async function supaUpdateClue(id, { title, body, revealAt }) {
  return await supaFetch(`rest/v1/clues?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { title, body, reveal_at: revealAt },
    headers: { Prefer: "return=representation" },
  });
}
async function supaDeleteClue(id) {
  return await supaFetch(`rest/v1/clues?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
async function supaAddOrUpdateAttendee({ name, meal, party }) {
  const existing = await supaSelectAttendee(name);
  if (existing) {
    await supaFetch(`rest/v1/attendees?name=eq.${encodeURIComponent(name)}`, {
      method: "PATCH",
      body: { meal: !!meal, party: !!party },
      headers: { Prefer: "return=representation" },
    });
  } else {
    await supaFetch(`rest/v1/attendees`, {
      method: "POST",
      body: { name, meal: !!meal, party: !!party },
      headers: { Prefer: "return=representation" },
    });
  }
}
async function supaSelectAttendee(name) {
  const rows = await supaFetch(
    `rest/v1/attendees?select=name,meal,party,created_at&name=eq.${encodeURIComponent(name)}`
  );
  return rows?.[0] || null;
}
async function supaListAttendees() {
  return await supaFetch(
    `rest/v1/attendees?select=name,meal,party,created_at&order=created_at.desc`
  );
}

/* ===================
   Hook para cargar de BBDD
   =================== */
function useDbData() {
  const [settings, setSettings] = useState(null);
  const [clues, setClues] = useState([]);
  const [currentName, setCurrentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAll() {
    if (!hasSupa) {
      setError("Supabase no configurado");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [s, c] = await Promise.all([supaGetSettings(), supaListClues()]);
      setSettings(s || null);
      setClues(c || []);
    } catch (e) {
      console.error(e);
      setError("No se pudieron cargar datos");
    }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  return {
    settings,
    setSettings,
    clues,
    setClues,
    currentName,
    setCurrentName,
    loading,
    error,
    reload: loadAll,
  };
}

/* ===================
   MAIN APP
   =================== */
export default function App() {
  const {
    settings,
    setSettings,
    clues,
    setClues,
    currentName,
    setCurrentName,
    loading,
    error,
    reload,
  } = useDbData();

  const isAdmin = getAdminFlagFromUrl();
  const now = useNow(1000);

  const eventDate = useMemo(() => (settings?.date ? new Date(settings.date) : null), [settings?.date]);
  const msLeft = eventDate ? eventDate.getTime() - now.getTime() : 0;
  const t = formatDiff(msLeft);
  const eventEnded = eventDate ? msLeft <= 0 : false;

  const revealed = useMemo(
    () =>
      clues.map((c) => ({
        ...c,
        revealed: isAdmin || now >= new Date(c.revealAt),
      })),
    [now, clues, isAdmin]
  );
  const galleryOpen =
    settings?.galleryOpensAt &&
    (isAdmin || now >= new Date(settings.galleryOpensAt));

  // Confirmación por nombre en BBDD
  const [isConfirmed, setIsConfirmed] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      if (!currentName || !hasSupa) {
        setIsConfirmed(false);
        return;
      }
      try {
        const row = await supaSelectAttendee(currentName);
        if (active) setIsConfirmed(!!row && (row.meal || row.party));
      } catch {
        if (active) setIsConfirmed(false);
      }
    })();
    return () => { active = false; };
  }, [currentName]);

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-gradient-to-b from-zinc-900 via-zinc-900 to-black text-zinc-100">

      {/* HERO */}
      <section className="relative w-full flex items-center justify-center py-6 sm:py-10">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-zinc-900 via-zinc-900 to-black" />
        <div className="w-full max-w-screen-md px-3 sm:px-4">
          <h1 className="text-2xl sm:text-3xl leading-tight font-semibold tracking-tight text-center">
            {settings?.title ?? "Configura el evento en Admin"}
          </h1>

          <p className="mt-2 text-center text-sm sm:text-base text-zinc-400">
            {settings?.date ? new Date(settings.date).toLocaleString() : "—"} ·{" "}
            <LocationLabel label={settings?.locationLabel ?? "—"} />
          </p>

          {error && (
            <p className="mt-3 text-center text-sm text-red-300">{error}</p>
          )}

          {/* Cuenta atrás / bloques especiales */}
          <div className="mt-6">
            {isAdmin ? (
              <div className="p-3 sm:p-4 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-600 text-fuchsia-300 text-center">
                <p className="font-semibold text-lg mb-3">
                  Os espero a partir de las 17:00 de la tarde en...
                </p>
                <img
                  src="https://scontent.fvlc5-1.fna.fbcdn.net/v/t39.30808-6/504143647_24244934781781281_8196324863052406172_n.jpg?_nc_cat=108&ccb=1-7&_nc_sid=a5f93a&_nc_ohc=6-jk2hytCS0Q7kNvwEaYuxO&_nc_oc=Adm1415Ca0IZ_UztI28KRUUyLOR71tcPN914_69SQ3buVABomYTQn3Q5fzIE1M8ZU-Y&_nc_zt=23&_nc_ht=scontent.fvlc5-1.fna&_nc_gid=ZZw5MvbeyJs_Ch21M-DUJw&oh=00_AfY4CxpClYP3ETNWwLmBp71IUZIu7IYhPORZFjk6WqREoQ&oe=68DC64AD"
                  alt="Ubicación secreta"
                  className="mx-auto rounded-2xl border border-fuchsia-600 max-h-[400px] object-contain"
                />
              </div>
            ) : eventDate && !eventEnded ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <TimeCard label="Días" value={t.d} />
                <TimeCard label="Horas" value={t.h} />
                <TimeCard label="Min" value={t.m} />
                <TimeCard label="Seg" value={t.s} />
              </div>
            ) : eventDate &&
              now < new Date(eventDate.getTime() + 24 * 60 * 60 * 1000) ? (
              <div className="p-3 sm:p-4 rounded-2xl bg-emerald-500/10 border border-emerald-600 text-emerald-300 text-center">
                ¡Es hoy! 🚀
              </div>
            ) : (
              <div className="p-3 sm:p-4 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-600 text-fuchsia-300 text-center">
                <p className="font-semibold text-lg mb-3">
                  Os espero a partir de las 17:00 de la tarde en...
                </p>
                <img
                  src="https://scontent.fvlc5-1.fna.fbcdn.net/v/t39.30808-6/504143647_24244934781781281_8196324863052406172_n.jpg?_nc_cat=108&ccb=1-7&_nc_sid=a5f93a&_nc_ohc=6-jk2hytCS0Q7kNvwEaYuxO&_nc_oc=Adm1415Ca0IZ_UztI28KRUUyLOR71tcPN914_69SQ3buVABomYTQn3Q5fzIE1M8ZU-Y&_nc_zt=23&_nc_ht=scontent.fvlc5-1.fna&_nc_gid=ZZw5MvbeyJs_Ch21M-DUJw&oh=00_AfY4CxpClYP3ETNWwLmBp71IUZIu7IYhPORZFjk6WqREoQ&oe=68DC64AD"
                  alt="Ubicación secreta"
                  className="mx-auto rounded-2xl border border-fuchsia-600 max-h-[400px] object-contain"
                />
              </div>
            )}
          </div>

          {/* Fila RSVP + Playlist */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <RSVPBox
              currentName={currentName}
              setCurrentName={setCurrentName}
              onConfirmedChange={setIsConfirmed}
            />
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
              <h3 className="text-sm text-zinc-300 mb-2">🎵 Playlist</h3>
              <div className="rounded-xl overflow-hidden border border-zinc-800">
                <iframe
                  className="w-full"
                  style={{ height: 152 }}
                  src={miniSpotifyEmbed(settings?.spotifyPlaylistUrl || "")}
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  title="Spotify playlist"
                />
              </div>
            </div>
          </div>

          {/* Fila botones */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AddToCalendar
              title={settings?.title ?? "Evento"}
              dateIso={settings?.date ?? new Date().toISOString()}
              details={
                settings?.locationLabel
                  ? `Nos vemos en ${settings.locationLabel}!`
                  : ""
              }
              className="h-12 sm:h-[52px] py-0"
            />
            <a
              href={settings?.locationUrl || "#"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl px-4 h-12 sm:h-[52px] bg-zinc-800 text-zinc-100 hover:bg-zinc-700 transition w-full"
            >
              Ver ubicación
            </a>
          </div>
        </div>
      </section>

      {/* CONTENIDO */}
      <main className="max-w-screen-2xl mx-auto px-3 sm:px-4 pb-16 sm:pb-20">
        {/* Pistas */}
        <section className="mt-6 sm:mt-8">
          <h2 className="text-lg sm:text-xl font-medium mb-3 sm:mb-4">
            Pistas semanales <span className="ml-2 text-xs text-zinc-500">({clues.length})</span>
          </h2>

          {!isConfirmed && !isAdmin ? (
            <div className="rounded-2xl border border-yellow-700 bg-yellow-500/10 p-4 text-yellow-200">
              Para desbloquear las pistas y descubrir la sorpresa preparada por Toneti introduce arriba tu nombre, dale a “Confirmar” y las pistas se irán desbloqueando cuando llegue la fecha.
            </div>
          ) : null}

          {loading && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-zinc-400">
              Cargando…
            </div>
          )}

          {!loading && clues.length === 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-zinc-400">
              No hay pistas en la BBDD. Añádelas en el panel de administración.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {revealed.map((c) => (
              <div
                key={c.id}
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
                  <span className="text-xl sm:text-2xl">✨</span>
                </div>
                {c.revealed ? (
                  (isConfirmed || isAdmin) ? (
                    <p className="mt-2 text-zinc-200 whitespace-pre-line">{c.body}</p>
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
          {!settings?.galleryOpensAt || !galleryOpen ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-zinc-400">
              🔒 Disponible el{" "}
              {settings?.galleryOpensAt
                ? new Date(settings.galleryOpensAt).toLocaleString()
                : "—"}
            </div>
          ) : (
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
          )}
        </section>

         <AttendeesAdmin />

        {/* Admin */}
        {isAdmin && (
          <section className="mt-10">
            <AdminPanelSettings
              settings={settings}
              setSettings={setSettings}
              onSaved={reload}
            />
            <AdminPanelClues clues={clues} setClues={setClues} />
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
   SUBCOMPONENTES AUXILIARES
   =================== */
function LocationLabel({ label }) {
  const TARGET = "¿Qué nos habrá preparado nuestro querido Toneti....?";
  if (typeof label === "string" && label.includes(TARGET)) {
    const [before, after] = label.split(TARGET);
    return (
      <>
        {before}
        <span className="text-red-600 font-semibold">{TARGET}</span>
        {after}
      </>
    );
  }
  return <>{label}</>;
}
function AddToCalendar({ title, dateIso, details, className = "" }) {
  const ics = useMemo(
    () => buildICS({ title, dateIso, details }),
    [title, dateIso, details]
  );
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
function RSVPBox({ currentName, setCurrentName, onConfirmedChange }) {
  const [name, setName] = useState(currentName || "");
  const [meal, setMeal] = useState(true);
  const [party, setParty] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => { setName(currentName || ""); }, [currentName]);

  async function submit() {
    const n = String(name).trim();
    if (!n) return setStatus("Pon tu nombre ✍️");
    if (!hasSupa) return setStatus("Supabase no configurado ❌");
    setStatus("Guardando…");
    try {
      await supaAddOrUpdateAttendee({ name: n, meal, party });
      setCurrentName(n);
      onConfirmedChange(true);
      setStatus("¡Confirmado!");
    } catch {
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
          <input type="checkbox" checked={meal} onChange={(e) => setMeal(e.target.checked)} /> Comida
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={party} onChange={(e) => setParty(e.target.checked)} /> Fiesta
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-zinc-900 text-red-500 hover:bg-zinc-800 active:bg-zinc-950 border border-red-600/60 shadow-sm ring-1 ring-red-400/40 transition-colors"
          aria-label="Confirmar asistencia"
        >
          Confirmar
        </button>
      </div>
      <div className="mt-2 text-xs text-zinc-400">{status}</div>
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
function AdminPanelClues({ clues, setClues }) {
  const [status, setStatus] = useState("");

  async function addClue() {
    if (!hasSupa) return setStatus("Supabase no configurado ❌");
    const draft = { title: "Nueva pista", body: "Texto…", revealAt: new Date().toISOString() };
    try {
      const rows = await supaInsertClue(draft);
      const inserted = rows?.[0]
        ? { id: rows[0].id, title: rows[0].title, body: rows[0].body, revealAt: toIsoT(rows[0].reveal_at) }
        : null;
      if (inserted) setClues([...clues, inserted]);
      setStatus("Pista añadida ✅");
    } catch { setStatus("Error al añadir pista"); }
  }

  async function updateClue(idx, field, value) {
    const next = clues.slice();
    const row = { ...next[idx], [field]: value };
    next[idx] = row;
    setClues(next);
    try {
      if (hasSupa && row.id) {
        await supaUpdateClue(row.id, { title: row.title, body: row.body, revealAt: row.revealAt });
        setStatus("Pista guardada ✅");
      } else setStatus("Supabase no configurado ❌");
    } catch { setStatus("Error al guardar pista"); }
  }

  async function removeClue(idx) {
    const row = clues[idx];
    const next = clues.filter((_, i) => i !== idx);
    setClues(next);
    try {
      if (hasSupa && row?.id) await supaDeleteClue(row.id);
      setStatus("Pista eliminada ✅");
    } catch { setStatus("Error al eliminar pista"); }
  }

  return (
    <div className="mt-6 rounded-2xl border border-blue-800 bg-blue-500/10 p-4 text-blue-100">
      <p className="font-semibold">🧩 Pistas</p>
      <div className="space-y-3 mt-3">
        {clues.map((c, idx) => (
          <div key={c.id} className="rounded-xl border border-blue-900/60 p-3">
            <div className="grid sm:grid-cols-2 gap-2">
              <TextInput label="Título" value={c.title} onChange={(v) => updateClue(idx, "title", v)} />
              <label className="text-sm">
                <span className="block text-blue-200/80 mb-1">Fecha/Hora</span>
                <input
                  type="datetime-local"
                  value={toDatetimeLocalValue(c.revealAt)}
                  onChange={(e) => updateClue(idx, "revealAt", isoFromDatetimeLocal(e.target.value))}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="block text-blue-200/80 mb-1">Texto</span>
                <textarea
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100"
                  rows={3}
                  value={c.body}
                  onChange={(e) => updateClue(idx, "body", e.target.value)}
                />
              </label>
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={() => removeClue(idx)} className="px-3 py-1.5 rounded-lg bg-zinc-800">Eliminar</button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={addClue} className="px-3 py-2 rounded-lg bg-white text-black">Añadir pista</button>
        <p className="text-sm opacity-80 self-center">{status}</p>
      </div>
    </div>
  );
}
function AdminPanelSettings({ settings, setSettings, onSaved }) {
  const [form, setForm] = useState(() => ({
    title: settings?.title || "",
    date: settings?.date || "",
    locationLabel: settings?.locationLabel || "",
    locationUrl: settings?.locationUrl || "",
    spotifyPlaylistUrl: settings?.spotifyPlaylistUrl || "",
    galleryOpensAt: settings?.galleryOpensAt || "",
  }));
  const [status, setStatus] = useState("");

  useEffect(() => {
    setForm({
      title: settings?.title || "",
      date: settings?.date || "",
      locationLabel: settings?.locationLabel || "",
      locationUrl: settings?.locationUrl || "",
      spotifyPlaylistUrl: settings?.spotifyPlaylistUrl || "",
      galleryOpensAt: settings?.galleryOpensAt || "",
    });
  }, [settings]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function save() {
    if (!hasSupa) return setStatus("Supabase no configurado ❌");
    setStatus("Guardando…");
    try {
      await supaUpsertSettings(form);
      setSettings({ ...form });
      setStatus("Ajustes guardados ✅");
      onSaved?.();
    } catch {
      setStatus("Error al guardar ajustes");
    }
  }

  return (
    <div className="rounded-2xl border border-blue-800 bg-blue-500/10 p-4 text-blue-100">
      <p className="font-semibold">🛠️ Panel de administración — Ajustes</p>
      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        <TextInput label="Título" value={form.title} onChange={(v) => update("title", v)} />
        <label className="text-sm">
          <span className="block text-blue-200/80 mb-1">Fecha/Hora</span>
          <input
            type="datetime-local"
            value={toDatetimeLocalValue(form.date)}
            onChange={(e) => update("date", isoFromDatetimeLocal(e.target.value))}
            className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100"
          />
          <span className="block text-xs text-blue-200/70 mt-1">ISO: {form.date || "—"}</span>
        </label>
        <TextInput label="Ubicación (texto)" value={form.locationLabel} onChange={(v) => update("locationLabel", v)} />
        <TextInput label="URL ubicación" value={form.locationUrl} onChange={(v) => update("locationUrl", v)} />
        <TextInput label="Playlist Spotify" value={form.spotifyPlaylistUrl} onChange={(v) => update("spotifyPlaylistUrl", normalizeSpotifyEmbed(v))} />
        <label className="text-sm">
          <span className="block text-blue-200/80 mb-1">Apertura galería</span>
          <input
            type="datetime-local"
            value={toDatetimeLocalValue(form.galleryOpensAt)}
            onChange={(e) => update("galleryOpensAt", isoFromDatetimeLocal(e.target.value))}
            className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100"
          />
          <span className="block text-xs text-blue-200/70 mt-1">ISO: {form.galleryOpensAt || "—"}</span>
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={save} className="px-3 py-2 rounded-lg bg-white text-black">Guardar ajustes</button>
        <button onClick={onSaved} className="px-3 py-2 rounded-lg bg-zinc-800">Recargar</button>
        <p className="text-sm opacity-80 self-center">{status}</p>
      </div>
    </div>
  );
}
function AttendeesAdmin() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    if (!hasSupa) return setError("Supabase no configurado ❌");
    setLoading(true);
    setError("");
    try {
      const data = await supaListAttendees();
      setRows(data || []);
    } catch { setError("No se pudo obtener la lista"); }
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  return (
    <div className="mt-6 rounded-2xl border border-fuchsia-800 bg-fuchsia-500/10 p-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold">👥 Asistentes</p>
        <button onClick={refresh} className="text-sm px-3 py-1 rounded-lg bg-white text-black">Refrescar</button>
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
