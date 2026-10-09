/**
 * Development seed data: fighters, gyms, gym owners, memberships, sparring
 * requests and an admin account across several Indian cities.
 *
 * Run with: pnpm db:seed (after pnpm db:migrate)
 */
import { loadEnv } from "../env.js";
import { createDatabase, type Db } from "./client.js";
import {
  fighterDisciplines,
  fighterProfiles,
  gymDisciplines,
  gymMembershipRequests,
  gymMemberships,
  gymOwners,
  gymProfiles,
  messages,
  notifications,
  paymentTransfers,
  payments,
  sparringRequests,
  subscriptions,
  userRoles,
  users,
} from "./schema.js";
import { eq, sql } from "drizzle-orm";

interface SeedFighter {
  name: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  age: number;
  heightCm: number;
  weightKg: number;
  weightClass: string;
  skill: string;
  disciplines: string[];
  years: number;
  amateur: number;
  pro: number;
  bio: string;
  avatar?: string;
}

const FIGHTERS: SeedFighter[] = [
  { name: "Arjun Singh", phone: "+919900000001", email: "arjun@fightfind.test", city: "Bengaluru", state: "Karnataka", lat: 12.9719, lng: 77.6412, age: 26, heightCm: 178, weightKg: 69, weightClass: "welterweight", skill: "advanced", disciplines: ["boxing", "mma"], years: 7, amateur: 14, pro: 2, bio: "Welterweight boxer training for nationals. Looking for sharp southpaw sparring." },
  { name: "Ravi Kumar", phone: "+919900000002", email: "ravi@fightfind.test", city: "Bengaluru", state: "Karnataka", lat: 12.9352, lng: 77.6245, age: 24, heightCm: 175, weightKg: 63, weightClass: "lightweight", skill: "intermediate", disciplines: ["mma", "bjj"], years: 4, amateur: 6, pro: 0, bio: "BJJ purple belt, looking for MMA sparring and wrestling rounds." },
  { name: "Neha Verma", phone: "+919900000003", email: "neha@fightfind.test", city: "New Delhi", state: "Delhi", lat: 28.5535, lng: 77.1943, age: 28, heightCm: 165, weightKg: 51, weightClass: "flyweight", skill: "professional", disciplines: ["muay_thai", "kickboxing"], years: 10, amateur: 25, pro: 8, bio: "Pro Muay Thai fighter and coach. Open to hard technical rounds." },
  { name: "Sameer Khan", phone: "+919900000004", email: "sameer@fightfind.test", city: "Bengaluru", state: "Karnataka", lat: 12.9121, lng: 77.6446, age: 21, heightCm: 180, weightKg: 74, weightClass: "middleweight", skill: "beginner", disciplines: ["wrestling"], years: 2, amateur: 3, pro: 0, bio: "College wrestler picking up MMA. Keen to learn striking." },
  { name: "Vikram Rao", phone: "+919900000005", email: "vikram@fightfind.test", city: "Mumbai", state: "Maharashtra", lat: 19.1136, lng: 72.8697, age: 30, heightCm: 188, weightKg: 92, weightClass: "heavyweight", skill: "advanced", disciplines: ["boxing", "mma"], years: 12, amateur: 20, pro: 5, bio: "Heavyweight with a boxing base. Sparring for an upcoming pro card." },
  { name: "Priya Nair", phone: "+919900000006", email: "priya@fightfind.test", city: "Chennai", state: "Tamil Nadu", lat: 13.0067, lng: 80.2577, age: 25, heightCm: 168, weightKg: 57, weightClass: "featherweight", skill: "intermediate", disciplines: ["boxing", "kickboxing"], years: 5, amateur: 9, pro: 1, bio: "Kickboxer transitioning to boxing. Love clean technical sparring." },
  { name: "Imran Sheikh", phone: "+919900000007", email: "imran@fightfind.test", city: "Hyderabad", state: "Telangana", lat: 17.4401, lng: 78.3489, age: 27, heightCm: 182, weightKg: 77, weightClass: "middleweight", skill: "advanced", disciplines: ["mma", "wrestling"], years: 8, amateur: 12, pro: 3, bio: "MMA fighter with a wrestling base. Camp starts next month." },
  { name: "Karan Mehta", phone: "+919900000008", email: "karan@fightfind.test", city: "Pune", state: "Maharashtra", lat: 18.5074, lng: 73.8077, age: 23, heightCm: 172, weightKg: 61, weightClass: "featherweight", skill: "intermediate", disciplines: ["bjj", "mma"], years: 4, amateur: 5, pro: 0, bio: "Guard player working on takedown defence. No-gi preferred." },
  { name: "Ananya Iyer", phone: "+919900000009", email: "ananya@fightfind.test", city: "Bengaluru", state: "Karnataka", lat: 12.9698, lng: 77.7499, age: 24, heightCm: 163, weightKg: 49, weightClass: "flyweight", skill: "advanced", disciplines: ["muay_thai", "boxing"], years: 6, amateur: 15, pro: 2, bio: "Muay Thai stylist. Looking for clinch and elbow rounds." },
  { name: "Rohit Sharma", phone: "+919900000020", email: "rohit@fightfind.test", city: "Mumbai", state: "Maharashtra", lat: 19.0596, lng: 72.8295, age: 29, heightCm: 176, weightKg: 70, weightClass: "welterweight", skill: "professional", disciplines: ["boxing"], years: 14, amateur: 30, pro: 12, bio: "Professional boxer, 12-2. Sparring only with advanced/pro fighters." },
  { name: "Dev Patel", phone: "+919900000021", email: "dev@fightfind.test", city: "New Delhi", state: "Delhi", lat: 28.5245, lng: 77.2066, age: 22, heightCm: 170, weightKg: 66, weightClass: "lightweight", skill: "beginner", disciplines: ["kickboxing"], years: 2, amateur: 2, pro: 0, bio: "Started kickboxing last year. Cardio and technique focus." },
  { name: "Meera Joshi", phone: "+919900000022", email: "meera@fightfind.test", city: "Bengaluru", state: "Karnataka", lat: 12.9784, lng: 77.6408, age: 27, heightCm: 171, weightKg: 62, weightClass: "lightweight", skill: "advanced", disciplines: ["mma", "bjj", "wrestling"], years: 9, amateur: 11, pro: 4, bio: "Pro MMA flyweight. Need hard rounds before my next bout." },
];

interface SeedGym {
  name: string;
  ownerIndex: number;
  city: string;
  state: string;
  address: string;
  pincode: string;
  lat: number;
  lng: number;
  disciplines: string[];
  feePaise: number;
  trial: boolean;
  timings: string;
  description: string;
  status: "active" | "pending_verification";
  verified: boolean;
}

const GYM_OWNERS = [
  { name: "Suresh Pillai", phone: "+919900000010", email: "owner.ironfist@fightfind.test" },
  { name: "Rachna Gupta", phone: "+919900000011", email: "owner.delhi@fightfind.test" },
  { name: "Anthony Dsouza", phone: "+919900000012", email: "owner.mumbai@fightfind.test" },
];

const GYMS: SeedGym[] = [
  { name: "Iron Fist MMA", ownerIndex: 0, city: "Bengaluru", state: "Karnataka", address: "5th Block, Koramangala", pincode: "560095", lat: 12.9352, lng: 77.6245, disciplines: ["mma", "bjj", "wrestling"], feePaise: 500000, trial: true, timings: "Mon-Sat 6-9am, 5-9pm", description: "Full MMA program with pro coaching, cage and strength floor.", status: "active", verified: true },
  { name: "Knockout Boxing Club", ownerIndex: 0, city: "Bengaluru", state: "Karnataka", address: "100 Feet Rd, Indiranagar", pincode: "560038", lat: 12.9719, lng: 77.6412, disciplines: ["boxing"], feePaise: 350000, trial: true, timings: "Mon-Sat 6-9am, 6-9pm", description: "Premier boxing gym with amateur fight nights every quarter.", status: "active", verified: true },
  { name: "Champions Muay Thai", ownerIndex: 1, city: "Bengaluru", state: "Karnataka", address: "27th Main, HSR Layout", pincode: "560102", lat: 12.9121, lng: 77.6446, disciplines: ["muay_thai", "kickboxing"], feePaise: 400000, trial: false, timings: "Mon-Sat 7-10am, 5-9pm", description: "Authentic Muay Thai from a Thai kru, fight team available.", status: "active", verified: true },
  { name: "Combat Zone", ownerIndex: 1, city: "Bengaluru", state: "Karnataka", address: "Whitefield Main Rd", pincode: "560066", lat: 12.9698, lng: 77.7499, disciplines: ["mma", "boxing"], feePaise: 450000, trial: true, timings: "Mon-Sun 6am-10pm", description: "Strength and conditioning plus combat sports under one roof.", status: "active", verified: true },
  { name: "Delhi Fight Academy", ownerIndex: 1, city: "New Delhi", state: "Delhi", address: "Hauz Khas Village", pincode: "110016", lat: 28.5535, lng: 77.1943, disciplines: ["boxing", "mma"], feePaise: 380000, trial: true, timings: "Mon-Sat 6-10am, 5-10pm", description: "North India's top fight academy with national-level boxers.", status: "active", verified: true },
  { name: "Andheri Combat Club", ownerIndex: 2, city: "Mumbai", state: "Maharashtra", address: "Link Rd, Andheri West", pincode: "400053", lat: 19.1136, lng: 72.8697, disciplines: ["mma", "bjj"], feePaise: 550000, trial: true, timings: "Mon-Sat 6-10am, 6-10pm", description: "Mumbai MMA hub with world-class mats and recovery zone.", status: "active", verified: true },
  { name: "Bandra Boxing Studio", ownerIndex: 2, city: "Mumbai", state: "Maharashtra", address: "Carter Rd, Bandra West", pincode: "400050", lat: 19.0596, lng: 72.8295, disciplines: ["boxing", "kickboxing"], feePaise: 420000, trial: false, timings: "Mon-Sat 6-9am, 6-9pm", description: "Boutique boxing studio with 1:1 coaching and group classes.", status: "active", verified: false },
  { name: "Hyderabad Grappling Lab", ownerIndex: 0, city: "Hyderabad", state: "Telangana", address: "Gachibowli Main Rd", pincode: "500032", lat: 17.4401, lng: 78.3489, disciplines: ["bjj", "wrestling"], feePaise: 300000, trial: true, timings: "Mon-Sat 6-10am, 6-10pm", description: "No-gi and gi grappling classes for all levels.", status: "active", verified: true },
  { name: "Chennai Fight Fit", ownerIndex: 1, city: "Chennai", state: "Tamil Nadu", address: "LB Road, Adyar", pincode: "600020", lat: 13.0067, lng: 80.2577, disciplines: ["boxing", "kickboxing", "mma"], feePaise: 320000, trial: true, timings: "Mon-Sat 6-9am, 5-9pm", description: "Friendly fight-fit community with a strong amateur team.", status: "pending_verification", verified: false },
  { name: "Pune Warriors Gym", ownerIndex: 2, city: "Pune", state: "Maharashtra", address: "Paud Rd, Kothrud", pincode: "411038", lat: 18.5074, lng: 73.8077, disciplines: ["wrestling", "mma"], feePaise: 280000, trial: true, timings: "Mon-Sat 6-9am, 5-9pm", description: "Wrestling-first gym with a growing MMA program.", status: "active", verified: true },
];

export async function seed(db: Db) {
  console.log("Seeding FightFind development data…");

  const [existing] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  if ((existing?.count ?? 0) > 0) {
    console.log("Database already has users — skipping seed. Use db:reset to start over.");
    return;
  }

  const fighterIdByEmail = new Map<string, string>();
  const fighterUserIdByEmail = new Map<string, string>();

  for (const fighter of FIGHTERS) {
    const [user] = await db
      .insert(users)
      .values({ name: fighter.name, phone: fighter.phone, email: fighter.email, lastActiveAt: new Date() })
      .returning();
    if (!user) throw new Error("seed: failed to create fighter user");
    await db.insert(userRoles).values({ userId: user.id, role: "FIGHTER" });

    const [profile] = await db
      .insert(fighterProfiles)
      .values({
        userId: user.id,
        name: fighter.name,
        city: fighter.city,
        state: fighter.state,
        latitude: fighter.lat,
        longitude: fighter.lng,
        ageYears: fighter.age,
        heightCm: fighter.heightCm,
        weightKg: fighter.weightKg,
        weightClass: fighter.weightClass,
        skillLevel: fighter.skill,
        yearsExperience: fighter.years,
        totalAmateurFights: fighter.amateur,
        totalProFights: fighter.pro,
        bio: fighter.bio,
        verificationStatus: fighter.pro > 0 ? "verified" : "unverified",
        lastActiveAt: new Date(Date.now() - Math.random() * 5 * 86_400_000),
      })
      .returning();
    if (!profile) throw new Error("seed: failed to create fighter profile");
    await db.insert(fighterDisciplines).values(
      fighter.disciplines.map((discipline) => ({ fighterId: profile.id, discipline })),
    );
    fighterIdByEmail.set(fighter.email, profile.id);
    fighterUserIdByEmail.set(fighter.email, user.id);
  }

  const ownerUserIds: string[] = [];
  for (const owner of GYM_OWNERS) {
    const [user] = await db
      .insert(users)
      .values({ name: owner.name, phone: owner.phone, email: owner.email })
      .returning();
    if (!user) throw new Error("seed: failed to create owner user");
    await db.insert(userRoles).values([
      { userId: user.id, role: "FIGHTER" },
      { userId: user.id, role: "GYM_OWNER" },
    ]);
    await db.insert(gymOwners).values({
      userId: user.id,
      verificationStatus: "verified",
      businessName: owner.name,
      businessEmail: owner.email,
      businessPhone: owner.phone,
      razorpayLinkedAccountId: `acc_seed_${ownerUserIds.length + 1}`,
      razorpayOnboardingStatus: "activated",
    });
    // Owners also get minimal fighter profiles so they can browse.
    const [profile] = await db
      .insert(fighterProfiles)
      .values({
        userId: user.id,
        name: owner.name,
        city: "Bengaluru",
        state: "Karnataka",
        latitude: 12.9716 + ownerUserIds.length * 0.01,
        longitude: 77.5946,
        weightClass: "middleweight",
        skillLevel: "intermediate",
        bio: "Gym owner on FightFind.",
        lastActiveAt: new Date(),
      })
      .returning();
    await db.insert(fighterDisciplines).values({ fighterId: profile!.id, discipline: "mixed" });
    ownerUserIds.push(user.id);
  }

  const [admin] = await db
    .insert(users)
    .values({ name: "FightFind Admin", phone: "+919900000099", email: "admin@fightfind.test" })
    .returning();
  await db.insert(userRoles).values({ userId: admin!.id, role: "ADMIN" });

  const gymIds: string[] = [];
  for (const gym of GYMS) {
    const ownerUserId = ownerUserIds[gym.ownerIndex]!;
    const [profile] = await db
      .insert(gymProfiles)
      .values({
        ownerUserId,
        name: gym.name,
        ownerName: GYM_OWNERS[gym.ownerIndex]!.name,
        phone: GYM_OWNERS[gym.ownerIndex]!.phone,
        email: GYM_OWNERS[gym.ownerIndex]!.email,
        description: gym.description,
        address: gym.address,
        city: gym.city,
        state: gym.state,
        pincode: gym.pincode,
        latitude: gym.lat,
        longitude: gym.lng,
        timings: gym.timings,
        monthlyFeePaise: gym.feePaise,
        hasTrialClass: gym.trial,
        photoUrls: [],
        status: gym.status,
        verificationStatus: gym.verified ? "verified" : "pending",
        listedAt: gym.verified ? new Date() : null,
        verifiedAt: gym.verified ? new Date() : null,
      })
      .returning();
    if (!profile) throw new Error("seed: failed to create gym");
    await db
      .insert(gymDisciplines)
      .values(gym.disciplines.map((discipline) => ({ gymId: profile.id, discipline })));

    // Listing fee + active platform subscription so dashboards show real data.
    const [listingPayment] = await db
      .insert(payments)
      .values({
        userId: ownerUserId,
        gymId: profile.id,
        type: "GYM_LISTING",
        amountPaise: 99900,
        currency: "INR",
        provider: "razorpay",
        providerOrderId: `order_seed_listing_${gymIds.length + 1}`,
        providerPaymentId: `pay_seed_listing_${gymIds.length + 1}`,
        status: "captured",
        metadata: { gymId: profile.id, seeded: true },
      })
      .returning();
    await db
      .update(gymProfiles)
      .set({ listingFeePaymentId: listingPayment!.id })
      .where(eq(gymProfiles.id, profile.id));

    const now = Date.now();
    await db.insert(subscriptions).values({
      userId: ownerUserId,
      gymId: profile.id,
      type: "GYM_PLATFORM_SUBSCRIPTION",
      providerPlanId: "plan_seed_gym",
      providerSubscriptionId: `sub_seed_gym_${gymIds.length + 1}`,
      status: gym.status === "active" ? "active" : "pending",
      rawProviderStatus: gym.status === "active" ? "active" : "created",
      currentPeriodStart: new Date(now - 12 * 86_400_000),
      currentPeriodEnd: new Date(now + 18 * 86_400_000),
    });

    gymIds.push(profile.id);
  }

  // --- Memberships ---------------------------------------------------------
  const membershipSeeds = [
    { gymIndex: 0, fighterEmail: "ravi@fightfind.test", amount: 500000, status: "active", requestStatus: "approved" },
    { gymIndex: 0, fighterEmail: "sameer@fightfind.test", amount: 500000, status: "active", requestStatus: "approved" },
    { gymIndex: 1, fighterEmail: "arjun@fightfind.test", amount: 350000, status: "active", requestStatus: "approved" },
    { gymIndex: 2, fighterEmail: "ananya@fightfind.test", amount: 400000, status: "paid_pending_approval", requestStatus: "pending" },
    { gymIndex: 3, fighterEmail: "meera@fightfind.test", amount: 450000, status: "paid_pending_approval", requestStatus: "pending" },
  ];

  let paymentCounter = 0;
  for (const seedMembership of membershipSeeds) {
    paymentCounter += 1;
    const gymId = gymIds[seedMembership.gymIndex]!;
    const fighterUserId = fighterUserIdByEmail.get(seedMembership.fighterEmail)!;
    const now = Date.now();

    const [payment] = await db
      .insert(payments)
      .values({
        userId: fighterUserId,
        gymId,
        fighterUserId,
        type: "GYM_MEMBERSHIP",
        amountPaise: seedMembership.amount,
        currency: "INR",
        provider: "razorpay",
        providerOrderId: `order_seed_member_${paymentCounter}`,
        providerPaymentId: `pay_seed_member_${paymentCounter}`,
        status: "captured",
        metadata: { gymId, seeded: true },
      })
      .returning();

    const [membership] = await db
      .insert(gymMemberships)
      .values({
        gymId,
        fighterUserId,
        paymentId: payment!.id,
        providerPaymentId: payment!.providerPaymentId,
        providerOrderId: payment!.providerOrderId,
        amountPaise: seedMembership.amount,
        status: seedMembership.status,
        startedAt: seedMembership.status === "active" ? new Date(now - 10 * 86_400_000) : null,
        expiresAt: seedMembership.status === "active" ? new Date(now + 20 * 86_400_000) : null,
      })
      .returning();

    await db.insert(gymMembershipRequests).values({
      membershipId: membership!.id,
      gymId,
      fighterUserId,
      status: seedMembership.requestStatus,
      respondedAt: seedMembership.requestStatus === "approved" ? new Date(now - 9 * 86_400_000) : null,
    });

    if (seedMembership.status === "active") {
      await db.insert(paymentTransfers).values({
        paymentId: payment!.id,
        providerTransferId: `trf_seed_${paymentCounter}`,
        linkedAccountId: "acc_seed_1",
        amountPaise: seedMembership.amount,
        status: "processed",
      });
    }
  }

  // --- Sparring requests + chat -------------------------------------------
  const arjunId = fighterUserIdByEmail.get("arjun@fightfind.test")!;
  const raviId = fighterUserIdByEmail.get("ravi@fightfind.test")!;
  const nehaId = fighterUserIdByEmail.get("neha@fightfind.test")!;
  const ananyaId = fighterUserIdByEmail.get("ananya@fightfind.test")!;

  const [accepted] = await db
    .insert(sparringRequests)
    .values({
      senderId: arjunId,
      receiverId: raviId,
      discipline: "boxing",
      proposedDate: new Date(Date.now() + 2 * 86_400_000),
      proposedLocation: "Knockout Boxing Club, Indiranagar",
      message: "Looking for 6 rounds of technical boxing. 70kg.",
      status: "accepted",
    })
    .returning();

  await db.insert(messages).values([
    { matchId: accepted!.id, senderId: raviId, content: "Works for me. 7am Saturday?", readAt: new Date() },
    { matchId: accepted!.id, senderId: arjunId, content: "Perfect. I'll bring wraps and gloves.", readAt: null },
  ]);

  await db.insert(sparringRequests).values([
    {
      senderId: arjunId,
      receiverId: nehaId,
      discipline: "boxing",
      proposedDate: new Date(Date.now() + 4 * 86_400_000),
      proposedLocation: "Delhi Fight Academy, Hauz Khas",
      message: "Would love some elite rounds when I'm in Delhi next week.",
      status: "pending",
    },
    {
      senderId: ananyaId,
      receiverId: arjunId,
      discipline: "muay_thai",
      proposedDate: new Date(Date.now() + 3 * 86_400_000),
      proposedLocation: "Champions Muay Thai, HSR Layout",
      message: "Clinch rounds? 5 x 4 minutes.",
      status: "pending",
    },
  ]);

  // --- Notifications -------------------------------------------------------
  await db.insert(notifications).values([
    {
      userId: arjunId,
      type: "SPARRING_REQUEST_ACCEPTED",
      title: "Sparring request accepted",
      body: "Ravi Kumar accepted your sparring request.",
      data: { matchId: accepted!.id },
    },
    {
      userId: arjunId,
      type: "NEW_MESSAGE",
      title: "New message",
      body: "Works for me. 7am Saturday?",
      data: { matchId: accepted!.id },
    },
  ]);

  const counts = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(users),
    db.select({ c: sql<number>`count(*)::int` }).from(gymProfiles),
    db.select({ c: sql<number>`count(*)::int` }).from(gymMemberships),
  ]);

  console.log(
    `Seed complete: ${counts[0]![0]!.c} users, ${counts[1]![0]!.c} gyms, ${counts[2]![0]!.c} memberships.`,
  );
  console.log("Demo accounts (phone OTP, DEV_OTP in dev):");
  console.log("  Fighter: arjun@fightfind.test / +919900000001");
  console.log("  Gym owner: owner.ironfist@fightfind.test / +919900000010");
  console.log("  Admin: admin@fightfind.test / +919900000099");
}

const isMain = process.argv[1] && process.argv[1].endsWith("seed.ts");
if (isMain) {
  const env = loadEnv();
  const database = createDatabase(env.DATABASE_URL, { max: 2 });
  seed(database.db)
    .then(async () => {
      await database.close();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Seed failed:", error);
      await database.close();
      process.exit(1);
    });
}
