import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import cookieSession from "cookie-session";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase Client Initialization
let supabaseClient: any = null;

function getSupabase() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (url && key) {
    supabaseClient = createClient(url, key);
    console.log('✅ Supabase client initialized');
  }
  return supabaseClient;
}

const db = new Database("confessions.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS confessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    likes INTEGER DEFAULT 0
  )
`);

// Migrations for new columns
const columns = db.prepare("PRAGMA table_info(confessions)").all() as any[];
const columnNames = columns.map(c => c.name);

if (!columnNames.includes('recipient')) {
  db.exec("ALTER TABLE confessions ADD COLUMN recipient TEXT");
}
if (!columnNames.includes('sender')) {
  db.exec("ALTER TABLE confessions ADD COLUMN sender TEXT");
}
if (!columnNames.includes('feeling')) {
  db.exec("ALTER TABLE confessions ADD COLUMN feeling TEXT");
}
if (!columnNames.includes('song')) {
  db.exec("ALTER TABLE confessions ADD COLUMN song TEXT");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieSession({
    name: 'session',
    keys: ['romantic-secret-key'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: true,
    sameSite: 'none'
  }));

  // Spotify OAuth Routes
  app.get('/api/auth/spotify/url', (req, res) => {
    const client_id = process.env.SPOTIFY_CLIENT_ID;
    const redirect_uri = `${process.env.APP_URL}/auth/spotify/callback`;
    const scope = 'user-top-read user-read-private user-read-email';

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: client_id || '',
      scope: scope,
      redirect_uri: redirect_uri,
    });

    res.json({ url: `https://accounts.spotify.com/authorize?${params.toString()}` });
  });

  app.get('/auth/spotify/callback', async (req, res) => {
    const code = req.query.code as string;
    const client_id = process.env.SPOTIFY_CLIENT_ID;
    const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
    const redirect_uri = `${process.env.APP_URL}/auth/spotify/callback`;

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64')
        },
        body: new URLSearchParams({
          code: code,
          redirect_uri: redirect_uri,
          grant_type: 'authorization_code'
        })
      });

      const data = await response.json();
      if (data.access_token) {
        if (req.session) {
          req.session.spotify_token = data.access_token;
        }
        res.send(`
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'SPOTIFY_AUTH_SUCCESS' }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              </script>
              <p>Authentication successful. You can close this window.</p>
            </body>
          </html>
        `);
      } else {
        res.status(400).send('Failed to get access token');
      }
    } catch (error) {
      console.error('Spotify callback error:', error);
      res.status(500).send('Internal Server Error');
    }
  });

  app.get('/api/spotify/me/top-tracks', async (req, res) => {
    const token = req.session?.spotify_token;
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated with Spotify' });
    }

    try {
      const response = await fetch('https://api.spotify.com/v1/me/top/tracks?time_range=long_term&limit=5', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch top tracks' });
    }
  });

  app.get('/api/auth/spotify/status', (req, res) => {
    res.json({ connected: !!req.session?.spotify_token });
  });

  app.get('/api/supabase/status', (req, res) => {
    const supabase = getSupabase();
    res.json({ 
      configured: !!supabase,
      url: process.env.SUPABASE_URL ? 'Set' : 'Missing',
      key: process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing'
    });
  });

  // Supabase Routes for 'Confession' table (Confession, Like)
  app.get(['/api/supabase/messages', '/api/supabase/messages/'], async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase credentials missing in Secrets tab' });
    }
    try {
      const { data, error } = await supabase
        .from('Confession')
        .select('*');
      
      if (error) {
        console.error('Supabase select error:', error);
        return res.status(400).json({ error: error.message, hint: 'Check if table "Confession" exists with columns "Confession" and "Like"' });
      }
      res.json(data || []);
    } catch (error: any) {
      console.error('Supabase route error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/supabase/messages', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
    const { msg } = req.body;
    try {
      const { data, error } = await supabase
        .from('Confession')
        .insert([{ Confession: msg, Like: 0 }])
        .select();
      
      if (error) {
        console.error('Supabase insert error:', error);
        return res.status(400).json({ error: error.message });
      }
      res.status(201).json(data[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/supabase/messages/:id/like', async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) return res.status(503).json({ error: 'Supabase not configured' });
    const { id } = req.params;
    const { currentLikes } = req.body;
    try {
      const { data, error } = await supabase
        .from('Confession')
        .update({ Like: (currentLikes || 0) + 1 })
        .eq('id', id)
        .select();
      
      if (error) {
        console.error('Supabase update error:', error);
        return res.status(400).json({ error: error.message });
      }
      res.json(data[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API Routes
  app.get("/api/confessions", (req, res) => {
    try {
      const confessions = db.prepare("SELECT * FROM confessions ORDER BY timestamp DESC LIMIT 50").all();
      res.json(confessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch confessions" });
    }
  });

  app.post("/api/confessions", (req, res) => {
    const { content, category, recipient, sender, feeling, song } = req.body;
    if (!content || content.length < 5) {
      return res.status(400).json({ error: "Confession too short" });
    }
    try {
      const stmt = db.prepare("INSERT INTO confessions (content, category, recipient, sender, feeling, song) VALUES (?, ?, ?, ?, ?, ?)");
      const result = stmt.run(content, category || "General", recipient || null, sender || null, feeling || null, song || null);
      res.status(201).json({ id: result.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: "Failed to save confession" });
    }
  });

  app.post("/api/confessions/:id/like", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("UPDATE confessions SET likes = likes + 1 WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to like confession" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
