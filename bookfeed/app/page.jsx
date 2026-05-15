"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Uploader from "../components/Uploader";
import Settings from "../components/Settings";
import Feed from "../components/Feed";
import BookPanel from "../components/BookPanel";
import CarouselViewer from "../components/CarouselViewer";
import { extractFromFile, hashFile } from "../lib/extract";
import {
  DEFAULT_SETTINGS,
  SettingsStore,
  saveBook,
  listBooks,
  listCarousels,
  deleteBook,
  deleteCarousel,
  getBook,
} from "../lib/storage";

export default function Home() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [books, setBooks] = useState([]);
  const [carousels, setCarousels] = useState([]);
  const [activeBook, setActiveBook] = useState(null);
  const [bookPanelOpen, setBookPanelOpen] = useState(false);
  const [genStatus, setGenStatus] = useState(null); // {current,total,bookTitle,done}
  const [openCarousel, setOpenCarousel] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const [bs, cs] = await Promise.all([listBooks(), listCarousels()]);
    setBooks(bs);
    setCarousels(cs);
  }, []);

  useEffect(() => {
    setSettings(SettingsStore.load());
    refresh();
  }, [refresh]);

  async function handleFile(file) {
    setError("");
    setUploading(true);
    setUploadProgress({ phase: "extract", current: 0, total: 1 });
    try {
      const id = await hashFile(file);
      const existing = await getBook(id);
      if (existing) {
        // Already imported — open its panel right away
        setActiveBook(existing);
        return;
      }
      const { text, meta } = await extractFromFile(file, (p) => setUploadProgress(p));
      if (!text || text.length < 500) {
        throw new Error("Testo estratto troppo breve. Il file è scansionato o protetto?");
      }
      const book = {
        id,
        title: meta.title,
        author: meta.author,
        format: meta.format,
        totalChars: meta.totalChars,
        addedAt: Date.now(),
        text, // kept in IndexedDB for re-mining without re-upload
      };
      await saveBook(book);
      await refresh();
      setActiveBook(book);
      setBookPanelOpen(true);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  function openBook(b) {
    // Need text for mining — make sure it's loaded
    (async () => {
      const fresh = await getBook(b.id);
      setActiveBook(fresh || b);
      setBookPanelOpen(true);
      setGenStatus(null);
    })();
  }

  // Auto-dismiss status pill 4s after generation completes
  useEffect(() => {
    if (!genStatus?.done || bookPanelOpen) return;
    const t = setTimeout(() => {
      setActiveBook(null);
      setGenStatus(null);
    }, 4000);
    return () => clearTimeout(t);
  }, [genStatus?.done, bookPanelOpen]);

  async function handleDeleteBook(b) {
    await deleteBook(b.id);
    await refresh();
  }

  async function handleDeleteCarousel(c) {
    await deleteCarousel(c.bookId, c.id);
    await refresh();
    setOpenCarousel(null);
  }

  const hasKey = (settings.apiKeys || []).some(Boolean);

  return (
    <main className="min-h-dvh">
      {/* Top bar */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-paper/70 border-b border-line">
        <div className="max-w-3xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-serif text-lg leading-none">BookFeed</span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted ml-1">private</span>
          </div>
          <div className="flex items-center gap-2">
            {!hasKey && (
              <span className="hidden sm:inline-block text-[11px] uppercase tracking-[0.22em] text-muted">No key</span>
            )}
            <button onClick={() => setSettingsOpen(true)} className="btn btn-ghost px-3 py-1.5 text-sm">
              Impostazioni
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-7 space-y-7">
        {/* Hero */}
        <section className="rise">
          <h1 className="font-serif text-3xl sm:text-4xl leading-[1.05] tracking-tightish">
            Trasforma un libro nel tuo feed personale di concetti.
          </h1>
          <p className="text-muted mt-3 max-w-[58ch]">
            Carica un PDF o un EPUB. BookFeed scandaglia tutto il libro in locale, individua le idee più potenti
            e — solo quando glielo chiedi — genera caroselli da 10 slide pronti da leggere e salvare.
          </p>
        </section>

        {/* Uploader */}
        <Uploader onFile={handleFile} busy={uploading} />

        {uploading && (
          <div className="card p-4 rise">
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="loading-dot">●</span>
              <span className="loading-dot" style={{ animationDelay: ".15s" }}>●</span>
              <span className="loading-dot" style={{ animationDelay: ".3s" }}>●</span>
              <span className="ml-2">
                {uploadProgress?.phase === "extract"
                  ? `Estrazione testo — pagina ${uploadProgress.current}/${uploadProgress.total}`
                  : "Lettura in corso…"}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="card p-4 text-sm text-red-300 rise">{error}</div>
        )}

        {/* Feed */}
        {books.length > 0 ? (
          <div className="pt-2">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-serif text-2xl">Il tuo feed</h2>
              <div className="text-[11px] uppercase tracking-[0.22em] text-muted">
                {carousels.length} caroselli · {books.length} libri
              </div>
            </div>
            <Feed
              books={books}
              carousels={carousels}
              onOpenCarousel={(c, b) => setOpenCarousel({ carousel: c, book: b })}
              onOpenBook={openBook}
              onDeleteBook={handleDeleteBook}
            />
          </div>
        ) : (
          <EmptyHint hasKey={hasKey} onOpenSettings={() => setSettingsOpen(true)} />
        )}

        <footer className="pt-12 pb-8 text-center text-[11px] uppercase tracking-[0.22em] text-muted">
          BookFeed · personale · tutto resta nel tuo browser
        </footer>
      </div>

      <Settings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={(s) => setSettings(s)}
      />

      {activeBook && (
        <BookPanel
          book={activeBook}
          settings={settings}
          open={bookPanelOpen}
          onClose={() => { setActiveBook(null); setBookPanelOpen(false); setGenStatus(null); refresh(); }}
          onMinimize={() => setBookPanelOpen(false)}
          onCarouselReady={() => refresh()}
          onGenerationProgress={(s) => setGenStatus(s)}
        />
      )}

      {/* Floating generation pill — shown when BookPanel is hidden but still generating */}
      {activeBook && !bookPanelOpen && genStatus && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 rise">
          <button
            onClick={() => setBookPanelOpen(true)}
            className="flex items-center gap-3 bg-ink text-paper pl-4 pr-5 py-3 rounded-full shadow-2xl text-sm tracking-wide border border-white/10"
          >
            {genStatus.done ? (
              <>
                <span className="text-[10px] opacity-60 uppercase tracking-[0.18em]">✓</span>
                <span>{genStatus.current} carosell{genStatus.current !== 1 ? "i" : "o"} pronti</span>
                <span className="opacity-45 text-[11px]">· apri</span>
              </>
            ) : (
              <>
                <span className="loading-dot text-[10px]">●</span>
                <span>{genStatus.current}/{genStatus.total} carosell{genStatus.total !== 1 ? "i" : "o"}</span>
                <span className="opacity-45 text-[11px]">· apri</span>
              </>
            )}
          </button>
        </div>
      )}

      {openCarousel && (
        <CarouselViewer
          carousel={openCarousel.carousel}
          book={openCarousel.book}
          onClose={() => setOpenCarousel(null)}
          onDelete={() => handleDeleteCarousel(openCarousel.carousel)}
        />
      )}
    </main>
  );
}

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="#f5f5f0" strokeWidth="1.5" />
      <path d="M7 8h10M7 12h10M7 16h6" stroke="#f5f5f0" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EmptyHint({ hasKey, onOpenSettings }) {
  return (
    <div className="card p-6 sm:p-8 text-center rise">
      <div className="text-[11px] uppercase tracking-[0.22em] text-muted">Inizia</div>
      <h3 className="font-serif text-xl mt-2">{hasKey ? "Carica il tuo primo libro" : "Aggiungi prima la tua API key"}</h3>
      <p className="text-muted mt-2 max-w-[44ch] mx-auto text-sm">
        {hasKey
          ? "L'analisi locale è gratuita e privata. Genererai caroselli solo quando premi il pulsante."
          : "Senza una chiave Gemini non posso generare i caroselli. L'API key resta solo sul tuo dispositivo."}
      </p>
      {!hasKey && (
        <button onClick={onOpenSettings} className="btn mt-5">Apri Impostazioni</button>
      )}
    </div>
  );
}
