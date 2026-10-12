import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(__dirname, "../../data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.SQLITE_PATH ?? path.join(DATA_DIR, "fightfind.db");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS fighters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    city TEXT,
    state TEXT,
    latitude REAL DEFAULT 12.9716,
    longitude REAL DEFAULT 77.5946,
    discipline TEXT DEFAULT '[]',
    skill_level TEXT,
    weight_class TEXT,
    age_years INTEGER DEFAULT 0,
    years_experience INTEGER DEFAULT 0,
    height_cm REAL,
    weight_kg REAL,
    total_amateur_fights INTEGER DEFAULT 0,
    total_pro_fights INTEGER DEFAULT 0,
    bio TEXT,
    avatar_url TEXT,
    push_token TEXT,
    gym_id TEXT,
    is_verified INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS gyms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    latitude REAL,
    longitude REAL,
    disciplines TEXT DEFAULT '[]',
    monthly_fee_inr INTEGER,
    has_trial_class INTEGER DEFAULT 0,
    timings TEXT,
    description TEXT,
    photo_urls TEXT DEFAULT '[]',
    is_verified INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sparring_requests (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    discipline TEXT,
    proposed_date TEXT,
    proposed_location TEXT,
    message TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    email TEXT,
    fighter_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS email_otps (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER DEFAULT 0,
    last_sent_at INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseFighter(row: any): any {
  if (!row) return row;
  return { ...row, discipline: parseJson<string[]>(row.discipline, []) };
}

export function parseGym(row: any): any {
  if (!row) return row;
  return {
    ...row,
    disciplines: parseJson<string[]>(row.disciplines, []),
    photo_urls: parseJson<string[]>(row.photo_urls, []),
  };
}

export function seedIfEmpty() {
  const gymCount = db.prepare("SELECT COUNT(*) AS c FROM gyms").get() as { c: number };
  if (gymCount.c === 0) {
    const insert = db.prepare(`
      INSERT INTO gyms (id, name, owner_name, phone, address, city, state, pincode,
        latitude, longitude, disciplines, monthly_fee_inr, has_trial_class, timings,
        description, is_verified)
      VALUES (@id, @name, @owner_name, @phone, @address, @city, @state, @pincode,
        @latitude, @longitude, @disciplines, @monthly_fee_inr, @has_trial_class, @timings,
        @description, @is_verified)
    `);
    const gyms = [
      { name: "Knockout Boxing Club", address: "100 Feet Rd, Indiranagar", city: "Bengaluru", state: "Karnataka", pincode: "560038", disciplines: ["boxing"], fee: 3500, trial: 1, lat: 12.9719, lng: 77.6412, desc: "Premier boxing gym with amateur fight nights." },
      { name: "Iron Fist MMA", address: "5th Block, Koramangala", city: "Bengaluru", state: "Karnataka", pincode: "560095", disciplines: ["mma", "bjj", "wrestling"], fee: 5000, trial: 1, lat: 12.9352, lng: 77.6245, desc: "Full MMA program with UFC veterans." },
      { name: "Champions Muay Thai", address: "27th Main, HSR Layout", city: "Bengaluru", state: "Karnataka", pincode: "560102", disciplines: ["muay_thai", "kickboxing"], fee: 4000, trial: 0, lat: 12.9121, lng: 77.6446, desc: "Authentic Muay Thai from Thai kru." },
      { name: "Combat Zone", address: "Whitefield Main Rd", city: "Bengaluru", state: "Karnataka", pincode: "560066", disciplines: ["mma", "boxing"], fee: 4500, trial: 1, lat: 12.9698, lng: 77.7499, desc: "Strength and conditioning plus combat sports." },
      { name: "Delhi Fight Academy", address: "Hauz Khas Village", city: "New Delhi", state: "Delhi", pincode: "110016", disciplines: ["boxing", "mma"], fee: 3800, trial: 1, lat: 28.5535, lng: 77.1943, desc: "North India's top fight academy." },
    ];
    const insertMany = db.transaction((rows: typeof gyms) => {
      for (const g of rows) {
        insert.run({
          id: crypto.randomUUID(),
          name: g.name,
          owner_name: null,
          phone: null,
          address: g.address,
          city: g.city,
          state: g.state,
          pincode: g.pincode,
          latitude: g.lat,
          longitude: g.lng,
          disciplines: JSON.stringify(g.disciplines),
          monthly_fee_inr: g.fee,
          has_trial_class: g.trial,
          timings: "Mon-Sat 6-9am, 5-9pm",
          description: g.desc,
          is_verified: 1,
        });
      }
    });
    insertMany(gyms);
  }

  const fighterCount = db.prepare("SELECT COUNT(*) AS c FROM fighters").get() as { c: number };
  if (fighterCount.c === 0) {
    const insert = db.prepare(`
      INSERT INTO fighters (id, name, phone, email, city, state, latitude, longitude,
        discipline, skill_level, weight_class, age_years, years_experience, height_cm,
        weight_kg, total_amateur_fights, total_pro_fights, bio)
      VALUES (@id, @name, @phone, @email, @city, @state, @latitude, @longitude,
        @discipline, @skill_level, @weight_class, @age_years, @years_experience, @height_cm,
        @weight_kg, @total_amateur_fights, @total_pro_fights, @bio)
    `);
    const fighters = [
      { name: "Arjun Singh", city: "Bengaluru", state: "Karnataka", disc: ["boxing"], skill: "advanced", wc: "welterweight", age: 26, exp: 7, h: 178, w: 69, am: 14, pro: 2, bio: "Welterweight boxer training for nationals." },
      { name: "Ravi Kumar", city: "Bengaluru", state: "Karnataka", disc: ["mma", "bjj"], skill: "intermediate", wc: "lightweight", age: 24, exp: 4, h: 175, w: 63, am: 6, pro: 0, bio: "BJJ purple belt, looking for MMA sparring." },
      { name: "Neha Verma", city: "New Delhi", state: "Delhi", disc: ["muay_thai", "kickboxing"], skill: "professional", wc: "flyweight", age: 28, exp: 10, h: 165, w: 51, am: 25, pro: 8, bio: "Pro Muay Thai fighter and coach." },
      { name: "Sameer Khan", city: "Bengaluru", state: "Karnataka", disc: ["wrestling"], skill: "beginner", wc: "middleweight", age: 21, exp: 2, h: 180, w: 74, am: 3, pro: 0, bio: "College wrestler picking up MMA." },
      { name: "Vikram Rao", city: "Mumbai", state: "Maharashtra", disc: ["boxing", "mma"], skill: "advanced", wc: "heavyweight", age: 30, exp: 12, h: 188, w: 92, am: 20, pro: 5, bio: "Heavyweight with a background in boxing." },
    ];
    const insertMany = db.transaction((rows: typeof fighters) => {
      for (const f of rows) {
        insert.run({
          id: crypto.randomUUID(),
          name: f.name,
          phone: null,
          email: null,
          city: f.city,
          state: f.state,
          latitude: 12.9716,
          longitude: 77.5946,
          discipline: JSON.stringify(f.disc),
          skill_level: f.skill,
          weight_class: f.wc,
          age_years: f.age,
          years_experience: f.exp,
          height_cm: f.h,
          weight_kg: f.w,
          total_amateur_fights: f.am,
          total_pro_fights: f.pro,
          bio: f.bio,
        });
      }
    });
    insertMany(fighters);
  }
}
