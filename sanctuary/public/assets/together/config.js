/*
 * TOGETHER — where shared sessions connect (Supabase Realtime). See sanctuary/README.md, "Together".
 *
 * Fill in the two values from your own free Supabase project (Project Settings → API):
 *   supabaseUrl      the "Project URL", for example https://abcdefghijkl.supabase.co
 *   supabaseAnonKey  the "anon" "public" key.
 *
 * The anon key is meant to be public: it is allowed to open a room and nothing else, and it is
 * the same key every Supabase web page ships. NEVER put the "service_role" key (or any secret)
 * in this folder: everything in public/ is sent to every visitor.
 *
 * Left empty, the shared sessions say they are not switched on, and "Listen Together on One Device" works as usual.
 */
window.BME_TOGETHER = {
  // Supabase project "body-mind-earth-together" (organisation "body mind earth", Free plan, region eu-north-1).
  supabaseUrl: 'https://betawmekhlpwplefbzvj.supabase.co',
  // The public "anon" key (a JWT with role "anon"). Public by design. The newer "publishable" key of the same project
  // (sb_publishable_…, see Project Settings → API) can replace it if Supabase retires the anon keys.
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJldGF3bWVraGxwd3BsZWZienZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1MTQ3NTcsImV4cCI6MjEwNzA5MDc1N30.BnyRWHXQF-jtCmVdOu4GTonYSRelgchwXfBn0kwyFlA'
};
