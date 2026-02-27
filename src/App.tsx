/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Heart, 
  MessageSquare, 
  Sparkles, 
  Filter, 
  Clock, 
  TrendingUp,
  ShieldCheck,
  Ghost,
  Music,
  User,
  UserPlus,
  Smile
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// Types
interface Confession {
  id: number;
  content: string;
  category: string;
  recipient?: string;
  sender?: string;
  feeling?: string;
  song?: string;
  timestamp: string;
  likes: number;
}

const CATEGORIES = ['General', 'Love', 'Rant', 'Academic', 'Secret', 'Funny'];
const FEELINGS = ['😊 Happy', '😢 Sad', '❤️ In Love', '😡 Angry', '🤔 Confused', '😴 Tired', '✨ Inspired'];

const SPECIAL_WORDS: Record<string, string> = {
  'love': 'text-pink-500 font-bold drop-shadow-sm',
  'crush': 'text-rose-400 font-bold italic',
  'heart': 'text-red-500 animate-pulse',
  'forever': 'text-indigo-400 italic underline decoration-wavy',
  'miss': 'text-blue-400',
  'beautiful': 'text-amber-500 font-serif italic',
  'cute': 'text-pink-300',
  'smile': 'text-yellow-500',
  'asiet': 'text-romantic-gold font-bold tracking-widest uppercase',
  'secret': 'bg-romantic-ink text-white px-1 rounded',
  'dream': 'text-purple-400 italic',
};

const HighlightedText = ({ text }: { text: string }) => {
  const words = text.split(/(\s+)/);
  return (
    <>
      {words.map((word, i) => {
        const cleanWord = word.toLowerCase().replace(/[.,!?;:]/g, '');
        if (SPECIAL_WORDS[cleanWord]) {
          return (
            <span key={i} className={SPECIAL_WORDS[cleanWord]}>
              {word}
            </span>
          );
        }
        return <span key={i}>{word}</span>;
      })}
    </>
  );
};

const SpotifyPlayer = ({ song }: { song: string }) => {
  // Check if it's a Spotify URL
  const spotifyRegex = /https:\/\/open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/;
  const match = song.match(spotifyRegex);

  if (match) {
    const type = match[1];
    const id = match[2];
    return (
      <div className="mt-6 rounded-3xl overflow-hidden shadow-lg border border-romantic-soft/20">
        <iframe
          src={`https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`}
          width="100%"
          height="152"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        ></iframe>
      </div>
    );
  }

  // If not a URL, provide a search link
  return (
    <div className="mb-12 p-6 bg-romantic-bg/40 rounded-[2rem] flex items-center justify-between gap-5 border border-romantic-soft/10 group/song hover:bg-white/60 transition-colors">
      <div className="flex items-center gap-5">
        <div className="w-12 h-12 bg-romantic-accent rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-romantic-accent/20 group-hover/song:rotate-12 transition-transform">
          <Music size={20} />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.2em] font-black opacity-30">Resonating with</span>
          <span className="text-lg font-bold italic text-romantic-accent">{song}</span>
        </div>
      </div>
      <a 
        href={`https://open.spotify.com/search/${encodeURIComponent(song)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="px-4 py-2 bg-romantic-accent/10 text-romantic-accent rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-romantic-accent hover:text-white transition-all"
      >
        Search on Spotify
      </a>
    </div>
  );
};

export default function App() {
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [newConfession, setNewConfession] = useState('');
  const [recipient, setRecipient] = useState('');
  const [sender, setSender] = useState('');
  const [feeling, setFeeling] = useState('😊 Happy');
  const [song, setSong] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('General');
  const [filter, setFilter] = useState('All');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [campusMood, setCampusMood] = useState<string | null>(null);
  const [isAnalyzingMood, setIsAnalyzingMood] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [topTracks, setTopTracks] = useState<any[]>([]);
  const [supabaseMessages, setSupabaseMessages] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'local' | 'supabase'>('local');
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  const fetchConfessions = async () => {
    try {
      const res = await fetch('/api/confessions');
      const data = await res.json();
      setConfessions(data);
    } catch (error) {
      console.error('Failed to fetch confessions:', error);
    }
  };

  const fetchSupabaseStatus = async () => {
    try {
      const res = await fetch('/api/supabase/status');
      const data = await res.json();
      setSupabaseConfigured(data.configured);
    } catch (error) {
      console.error('Failed to fetch Supabase status:', error);
    }
  };

  const fetchSupabaseMessages = async () => {
    setSupabaseError(null);
    try {
      const res = await fetch('/api/supabase/messages');
      const contentType = res.headers.get("content-type");
      
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setSupabaseMessages(data);
      } else {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        setSupabaseError(data.error || 'Failed to fetch messages');
        console.error('Supabase fetch failed:', res.status, data);
      }
    } catch (error) {
      setSupabaseError('Network error connecting to server');
      console.error('Failed to fetch Supabase messages:', error);
    }
  };

  const fetchSpotifyStatus = async () => {
    try {
      const res = await fetch('/api/auth/spotify/status');
      const data = await res.json();
      setSpotifyConnected(data.connected);
      if (data.connected) {
        fetchTopTracks();
      }
    } catch (error) {
      console.error('Failed to fetch Spotify status:', error);
    }
  };

  const fetchTopTracks = async () => {
    try {
      const res = await fetch('/api/spotify/me/top-tracks');
      const data = await res.json();
      if (data.items) {
        setTopTracks(data.items);
        console.log(
          data.items.map(
            (track: any) =>
              `${track.name} by ${track.artists.map((artist: any) => artist.name).join(', ')}`
          )
        );
      }
    } catch (error) {
      console.error('Failed to fetch top tracks:', error);
    }
  };

  useEffect(() => {
    fetchConfessions();
    fetchSupabaseMessages();
    fetchSpotifyStatus();
    fetchSupabaseStatus();

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SPOTIFY_AUTH_SUCCESS') {
        fetchSpotifyStatus();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleSpotifyConnect = async () => {
    try {
      const res = await fetch('/api/auth/spotify/url');
      const { url } = await res.json();
      window.open(url, 'spotify_auth', 'width=600,height=700');
    } catch (error) {
      console.error('Failed to start Spotify auth:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConfession.trim() || newConfession.length < 5) return;

    setIsSubmitting(true);
    try {
      if (viewMode === 'supabase') {
        const res = await fetch('/api/supabase/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ msg: newConfession }),
        });
        if (res.ok) {
          setNewConfession('');
          fetchSupabaseMessages();
        }
      } else {
        const res = await fetch('/api/confessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            content: newConfession, 
            category: selectedCategory,
            recipient,
            sender,
            feeling,
            song
          }),
        });
        if (res.ok) {
          setNewConfession('');
          setRecipient('');
          setSender('');
          setSong('');
          fetchConfessions();
        }
      }
    } catch (error) {
      console.error('Failed to submit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSupabaseLike = async (id: any, currentLikes: number) => {
    try {
      const res = await fetch(`/api/supabase/messages/${id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentLikes }),
      });
      if (res.ok) {
        fetchSupabaseMessages();
      }
    } catch (error) {
      console.error('Failed to like Supabase message:', error);
    }
  };

  const handleLike = async (id: number) => {
    try {
      const res = await fetch(`/api/confessions/${id}/like`, { method: 'POST' });
      if (res.ok) {
        setConfessions(prev => prev.map(c => c.id === id ? { ...c, likes: c.likes + 1 } : c));
      }
    } catch (error) {
      console.error('Failed to like:', error);
    }
  };

  const analyzeMood = async () => {
    if (confessions.length === 0) return;
    setIsAnalyzingMood(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Based on these anonymous confessions from students at ASIET, summarize the current "Campus Mood" in 2-3 sentences. Be empathetic and insightful. 
        
        Confessions:
        ${confessions.slice(0, 10).map(c => `- [${c.category}] ${c.content}`).join('\n')}`,
      });
      setCampusMood(response.text || "The campus is quiet today.");
    } catch (error) {
      console.error('Mood analysis failed:', error);
      setCampusMood("Unable to sense the mood right now.");
    } finally {
      setIsAnalyzingMood(false);
    }
  };

  const filteredConfessions = filter === 'All' 
    ? confessions 
    : confessions.filter(c => c.category === filter);

  return (
    <div className="min-h-screen bg-romantic-bg text-romantic-ink font-sans selection:bg-romantic-accent selection:text-white relative overflow-hidden">
      {/* Aesthetic Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-romantic-soft/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-romantic-accent/10 rounded-full blur-[150px]" />
        <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-romantic-gold/10 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/40 backdrop-blur-xl border-b border-romantic-accent/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div 
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="w-12 h-12 bg-gradient-to-br from-romantic-accent to-romantic-soft rounded-2xl flex items-center justify-center text-white shadow-lg shadow-romantic-accent/20"
            >
              <Heart size={24} fill="currentColor" />
            </motion.div>
            <div>
              <h1 className="font-serif text-2xl font-bold italic text-romantic-ink">ASIET Hearts</h1>
              <p className="text-[10px] uppercase tracking-[0.3em] text-romantic-accent font-bold">Anonymous Love & Secrets</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleSpotifyConnect}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all font-bold text-[10px] uppercase tracking-widest ${
                spotifyConnected 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' 
                  : 'bg-black/5 border-black/10 text-romantic-ink hover:bg-black/10'
              }`}
            >
              <Music size={12} className={spotifyConnected ? 'text-emerald-500' : 'text-romantic-accent'} />
              {spotifyConnected ? 'Spotify Connected' : 'Connect Spotify'}
            </button>
            <div className="hidden sm:flex items-center gap-4">
              <ShieldCheck size={20} className="text-romantic-accent" />
              <span className="text-xs font-bold opacity-60 uppercase tracking-tighter">Safe Space</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 relative z-10 space-y-20">
        {/* Hero Section: The Whisperbox */}
        <section className="min-h-[70vh] flex flex-col justify-center">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/60 backdrop-blur-2xl rounded-[3.5rem] p-8 md:p-16 shadow-2xl shadow-romantic-accent/10 border border-white/60 relative overflow-hidden"
          >
            {/* Decorative background for the box */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-romantic-soft/10 rounded-full -mr-32 -mt-32 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-romantic-accent/5 rounded-full -ml-32 -mb-32 blur-3xl" />

            <div className="relative z-10 max-w-3xl mx-auto">
              <div className="text-center mb-12">
                <motion.h2 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="font-serif text-4xl md:text-6xl mb-4 italic text-romantic-ink"
                >
                  Whisper to the Heart <Sparkles size={32} className="inline text-romantic-gold animate-pulse" />
                </motion.h2>
                <p className="text-xs md:text-sm font-black uppercase tracking-[0.4em] text-romantic-accent/60">
                  Your secrets are safe in the silence of ASIET
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative group">
                    <UserPlus size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-romantic-accent/40 group-focus-within:text-romantic-accent transition-colors" />
                    <input
                      type="text"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="To someone special..."
                      className="w-full pl-14 pr-6 py-5 bg-white/40 rounded-[2rem] border border-romantic-soft/20 focus:ring-4 focus:ring-romantic-soft/20 focus:bg-white/80 transition-all text-sm font-medium"
                    />
                  </div>
                  <div className="relative group">
                    <User size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-romantic-accent/40 group-focus-within:text-romantic-accent transition-colors" />
                    <input
                      type="text"
                      value={sender}
                      onChange={(e) => setSender(e.target.value)}
                      placeholder="From (or leave blank)..."
                      className="w-full pl-14 pr-6 py-5 bg-white/40 rounded-[2rem] border border-romantic-soft/20 focus:ring-4 focus:ring-romantic-soft/20 focus:bg-white/80 transition-all text-sm font-medium"
                    />
                  </div>
                </div>

                <div className="relative group">
                  <textarea
                    value={newConfession}
                    onChange={(e) => setNewConfession(e.target.value)}
                    placeholder="Pour your heart out here..."
                    className="w-full h-64 md:h-80 p-8 bg-white/40 rounded-[3rem] border border-romantic-soft/20 focus:ring-8 focus:ring-romantic-soft/10 focus:bg-white/80 transition-all resize-none text-lg md:text-xl font-serif italic placeholder:text-romantic-ink/20 leading-relaxed shadow-inner"
                  />
                  <div className="absolute bottom-8 right-8 opacity-5 group-focus-within:opacity-20 transition-opacity">
                    <Heart size={80} fill="currentColor" className="text-romantic-accent" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-black text-romantic-accent flex items-center gap-2 px-2">
                      <Smile size={14} /> How are you feeling?
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {FEELINGS.map(f => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFeeling(f)}
                          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
                            feeling === f 
                              ? 'bg-romantic-accent text-white shadow-lg shadow-romantic-accent/30 scale-105' 
                              : 'bg-white/40 text-romantic-ink/60 hover:bg-white/80 border border-romantic-accent/5'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                <div className="relative group">
                  <Music size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-romantic-accent/40 group-focus-within:text-romantic-accent transition-colors" />
                  <input
                    type="text"
                    value={song}
                    onChange={(e) => setSong(e.target.value)}
                    placeholder="Paste a Spotify link or song name..."
                    className="w-full pl-14 pr-6 py-5 bg-white/40 rounded-[2rem] border border-romantic-soft/20 focus:ring-4 focus:ring-romantic-soft/20 focus:bg-white/80 transition-all text-sm font-medium"
                  />
                </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6 items-center pt-4">
                  <div className="flex flex-wrap justify-center gap-2 flex-1">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-6 py-2 rounded-full text-[10px] uppercase tracking-widest font-black transition-all ${
                          selectedCategory === cat 
                            ? 'bg-romantic-ink text-white shadow-xl scale-110' 
                            : 'bg-white/40 text-romantic-ink/40 hover:bg-white/80 border border-romantic-accent/5'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <button
                    disabled={isSubmitting || newConfession.length < 5}
                    className="w-full md:w-auto px-12 bg-gradient-to-r from-romantic-accent to-romantic-soft text-white py-6 rounded-[2.5rem] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 hover:scale-[1.05] active:scale-[0.95] transition-all disabled:opacity-50 shadow-2xl shadow-romantic-accent/30 text-sm"
                  >
                    {isSubmitting ? 'Whispering...' : <><Send size={20} /> Release Whisper</>}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </section>

        {/* Spotify Top Tracks Section */}
        {spotifyConnected && topTracks.length > 0 && (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white/40 backdrop-blur-2xl rounded-[3rem] p-12 border border-white/40 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-12 opacity-5">
              <Music size={200} fill="currentColor" className="text-romantic-accent" />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                  <Music size={24} />
                </div>
                <div>
                  <h3 className="font-serif italic text-2xl text-romantic-ink">Your Romantic Soundtrack</h3>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-600 font-black">Your Top Tracks on Spotify</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                {topTracks.map((track, index) => (
                  <motion.div 
                    key={track.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="group/track"
                  >
                    <div className="relative aspect-square rounded-2xl overflow-hidden mb-4 shadow-lg group-hover/track:scale-105 transition-transform duration-500">
                      <img 
                        src={track.album.images[0]?.url} 
                        alt={track.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/track:opacity-100 transition-opacity flex items-center justify-center">
                        <a 
                          href={track.external_urls.spotify}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white"
                        >
                          <Music size={16} />
                        </a>
                      </div>
                    </div>
                    <h4 className="font-bold text-sm text-romantic-ink truncate">{track.name}</h4>
                    <p className="text-[10px] text-romantic-accent font-medium truncate">
                      {track.artists.map((a: any) => a.name).join(', ')}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.section>
        )}

        {/* Secondary Section: Mood & Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Mood Column */}
          <div className="lg:col-span-4">
            <section className="bg-romantic-ink text-white rounded-[3rem] p-10 shadow-2xl overflow-hidden relative group sticky top-28">
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 5, 0]
                }}
                transition={{ duration: 10, repeat: Infinity }}
                className="absolute top-[-20%] right-[-20%] p-4 opacity-10 text-romantic-soft"
              >
                <Heart size={200} fill="currentColor" />
              </motion.div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-serif italic text-2xl">Campus Heartbeat</h3>
                  <button 
                    onClick={analyzeMood}
                    disabled={isAnalyzingMood || confessions.length === 0}
                    className="p-4 bg-white/10 hover:bg-white/20 rounded-full transition-all disabled:opacity-30"
                  >
                    <Sparkles size={20} className={isAnalyzingMood ? 'animate-spin' : 'animate-pulse text-romantic-gold'} />
                  </button>
                </div>
                {campusMood ? (
                  <div className="space-y-6">
                    <p className="text-lg leading-relaxed text-romantic-soft font-medium italic">
                      "{campusMood}"
                    </p>
                    <div className="w-16 h-1.5 bg-romantic-accent rounded-full" />
                  </div>
                ) : (
                  <p className="text-base opacity-50 italic leading-relaxed">The campus is whispering... Tap the sparkles to listen to its heart.</p>
                )}
                <div className="mt-12 pt-12 border-t border-white/10 flex items-center justify-between">
                  <div className="flex -space-x-3">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-white/20 to-white/5 border-2 border-romantic-ink backdrop-blur-sm" />
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]" />
                    <span className="text-[10px] uppercase tracking-[0.3em] font-black opacity-40">Active Whispers</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Feed Column */}
          <div className="lg:col-span-8 space-y-12">
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-center gap-4 bg-white/30 backdrop-blur-xl p-2 rounded-full border border-white/40 self-center">
                <button
                  onClick={() => setViewMode('local')}
                  className={`px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                    viewMode === 'local' 
                      ? 'bg-romantic-accent text-white shadow-xl' 
                      : 'text-romantic-ink/40 hover:bg-white/50'
                  }`}
                >
                  Local Whispers
                </button>
                <button
                  onClick={() => setViewMode('supabase')}
                  className={`px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all ${
                    viewMode === 'supabase' 
                      ? 'bg-romantic-accent text-white shadow-xl' 
                      : 'text-romantic-ink/40 hover:bg-white/50'
                  }`}
                >
                  Global Whispers
                </button>
              </div>

              {viewMode === 'supabase' && (!supabaseConfigured || supabaseError) && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-romantic-gold/10 border border-romantic-gold/20 rounded-[2rem] p-8 text-center"
                >
                  <div className="flex items-center justify-center gap-4 mb-4 text-romantic-gold">
                    <Sparkles size={24} />
                    <h4 className="font-bold uppercase tracking-widest text-xs">
                      {supabaseError ? 'Supabase Error' : 'Configuration Required'}
                    </h4>
                  </div>
                  
                  {supabaseError ? (
                    <div className="space-y-4">
                      <p className="text-sm text-red-500 font-medium">
                        {supabaseError}
                      </p>
                      <button 
                        onClick={fetchSupabaseMessages}
                        className="px-6 py-2 bg-romantic-gold/20 hover:bg-romantic-gold/30 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-romantic-ink/60 mb-6">
                        To use Global Whispers, please add your Supabase credentials to the <b>Secrets</b> tab in the sidebar.
                      </p>
                      <div className="flex flex-col gap-2 text-[10px] font-black uppercase tracking-widest text-romantic-ink/40">
                        <div className="flex items-center justify-center gap-2">
                          <span className="w-1.5 h-1.5 bg-romantic-gold rounded-full" />
                          SUPABASE_URL
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <span className="w-1.5 h-1.5 bg-romantic-gold rounded-full" />
                          SUPABASE_ANON_KEY
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {viewMode === 'local' && (
                <div className="flex items-center justify-between bg-white/40 backdrop-blur-xl p-3 rounded-[2rem] border border-white/60 shadow-lg shadow-romantic-accent/5">
                  <div className="flex items-center gap-3 px-6">
                    <Filter size={20} className="text-romantic-accent" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-romantic-ink/40">Filter Whispers</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pr-2">
                    {['All', ...CATEGORIES].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setFilter(cat)}
                        className={`whitespace-nowrap px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          filter === cat 
                            ? 'bg-romantic-accent text-white shadow-xl shadow-romantic-accent/20' 
                            : 'text-romantic-ink/60 hover:bg-white/60'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-10">
              <AnimatePresence mode="popLayout">
                {viewMode === 'local' ? (
                  filteredConfessions.map((confession) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={confession.id}
                    className="bg-white/70 backdrop-blur-2xl rounded-[3.5rem] p-12 shadow-2xl shadow-romantic-accent/5 border border-white/80 group hover:shadow-romantic-accent/10 transition-all relative overflow-hidden"
                  >
                    {/* Decorative corner */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-romantic-soft/5 rounded-bl-[6rem] -mr-12 -mt-12 transition-all group-hover:scale-150" />
                    
                    <div className="flex items-center justify-between mb-10">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] uppercase tracking-[0.3em] font-black text-romantic-accent bg-romantic-accent/10 px-6 py-2 rounded-full border border-romantic-accent/10">
                            {confession.category}
                          </span>
                          {confession.feeling && (
                            <span className="text-[10px] font-black uppercase tracking-widest text-romantic-ink/40 bg-white/50 px-4 py-2 rounded-full">
                              Feeling {confession.feeling}
                            </span>
                          )}
                        </div>
                        {(confession.recipient || confession.sender) && (
                          <div className="flex items-center gap-4 mt-3">
                            {confession.recipient && (
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black uppercase tracking-widest opacity-30">To</span>
                                <span className="text-xs font-black text-romantic-accent italic underline decoration-romantic-accent/20 underline-offset-4">
                                  {confession.recipient}
                                </span>
                              </div>
                            )}
                            {confession.sender && (
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-black uppercase tracking-widest opacity-30">From</span>
                                <span className="text-xs font-black text-romantic-ink/60 italic">
                                  {confession.sender}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-black opacity-20 uppercase tracking-[0.2em]">
                        <Clock size={14} />
                        {new Date(confession.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="text-2xl md:text-3xl leading-[1.7] mb-12 font-medium text-romantic-ink/90 font-serif italic">
                      <HighlightedText text={confession.content} />
                    </div>

                    {confession.song && <SpotifyPlayer song={confession.song} />}

                    <div className="flex items-center justify-between pt-10 border-t border-romantic-accent/10">
                      <button 
                        onClick={() => handleLike(confession.id)}
                        className="flex items-center gap-4 group/like"
                      >
                        <motion.div 
                          whileTap={{ scale: 1.6 }}
                          className={`p-4 rounded-2xl transition-all ${confession.likes > 0 ? 'bg-romantic-accent text-white shadow-xl shadow-romantic-accent/30' : 'bg-romantic-bg text-romantic-ink/20 group-hover/like:bg-romantic-accent/10 group-hover/like:text-romantic-accent'}`}
                        >
                          <Heart size={26} className={confession.likes > 0 ? 'fill-current' : ''} />
                        </motion.div>
                        <div className="flex flex-col">
                          <span className={`text-lg font-black leading-none ${confession.likes > 0 ? 'text-romantic-accent' : 'opacity-20'}`}>{confession.likes}</span>
                          <span className="text-[10px] uppercase tracking-[0.2em] font-black opacity-20">Hearts</span>
                        </div>
                      </button>
                      
                      <div className="flex items-center gap-8 opacity-10 group-hover:opacity-40 transition-all">
                        <motion.div whileHover={{ scale: 1.2, rotate: -10 }} className="cursor-pointer"><MessageSquare size={24} /></motion.div>
                        <motion.div whileHover={{ scale: 1.2, rotate: 10 }} className="cursor-pointer"><Sparkles size={24} className="text-romantic-gold" /></motion.div>
                      </div>
                    </div>
                  </motion.div>
                ))
                ) : (
                  supabaseMessages.map((msg) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      key={msg.id}
                      className="bg-white/70 backdrop-blur-2xl rounded-[3.5rem] p-12 shadow-2xl shadow-romantic-accent/5 border border-white/80 group hover:shadow-romantic-accent/10 transition-all relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-8">
                        <span className="text-[10px] uppercase tracking-[0.3em] font-black text-emerald-600 bg-emerald-500/10 px-6 py-2 rounded-full border border-emerald-500/10">
                          Global Whisper (Supabase)
                        </span>
                        <div className="flex items-center gap-3 text-[10px] font-black opacity-20 uppercase tracking-[0.2em]">
                          <Clock size={14} />
                          {msg.created_at ? new Date(msg.created_at).toLocaleDateString() : 'Recently'}
                        </div>
                      </div>
                      
                      <div className="text-2xl md:text-3xl leading-[1.7] mb-12 font-medium text-romantic-ink/90 font-serif italic">
                        <HighlightedText text={msg.Confession} />
                      </div>

                      <div className="flex items-center justify-between pt-10 border-t border-romantic-accent/10">
                        <button 
                          onClick={() => handleSupabaseLike(msg.id, msg.Like)}
                          className="flex items-center gap-4 group/like"
                        >
                          <motion.div 
                            whileTap={{ scale: 1.6 }}
                            className={`p-4 rounded-2xl transition-all ${msg.Like > 0 ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/30' : 'bg-romantic-bg text-romantic-ink/20 group-hover/like:bg-emerald-500/10 group-hover/like:text-emerald-500'}`}
                          >
                            <Heart size={26} className={msg.Like > 0 ? 'fill-current' : ''} />
                          </motion.div>
                          <div className="flex flex-col">
                            <span className={`text-lg font-black leading-none ${msg.Like > 0 ? 'text-emerald-500' : 'opacity-20'}`}>{msg.Like || 0}</span>
                            <span className="text-[10px] uppercase tracking-[0.2em] font-black opacity-20">Hearts</span>
                          </div>
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>

              {((viewMode === 'local' && filteredConfessions.length === 0) || (viewMode === 'supabase' && supabaseMessages.length === 0)) && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-40"
                >
                  <div className="w-32 h-32 bg-white/40 rounded-full flex items-center justify-center mx-auto mb-10 border border-white/60 shadow-inner">
                    <Ghost size={50} className="text-romantic-accent/10" />
                  </div>
                  <p className="font-serif italic text-3xl text-romantic-ink/30">The silence is heavy...</p>
                  <p className="text-xs font-black uppercase tracking-[0.4em] text-romantic-accent/20 mt-6">Be the first to break it</p>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-4xl mx-auto px-6 py-20 text-center relative z-10">
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="h-px w-12 bg-romantic-accent/20" />
          <Heart size={16} className="text-romantic-accent/40" />
          <div className="h-px w-12 bg-romantic-accent/20" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-romantic-accent font-black opacity-40">
          ASIET HEARTS • ANONYMOUS & ETERNAL
        </p>
        <p className="text-[8px] uppercase tracking-[0.2em] text-romantic-ink/20 mt-4">
          Built with love for the Adi Shankara Community
        </p>
      </footer>
    </div>
  );
}
