import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const USERS = [
  {
    email: "admin@bqms.lk",
    password: "Admin@123",
    role: "head_office_admin",
    name: "Admin User",
  },
  {
    email: "manager@bqms.lk",
    password: "Manager@123",
    role: "branch_manager",
    name: "Branch Manager",
  },
  {
    email: "teller@bqms.lk",
    password: "Teller@123",
    role: "teller",
    name: "Teller User",
  },
];

async function main() {
  console.log("👤 Seeding auth users...\n");

  for (const u of USERS) {
    const existing = await supabase.auth.admin.listUsers();
    const found = existing.data?.users.find((x) => x.email === u.email);

    if (found) {
      console.log(`⚠️  ${u.email} already exists — updating metadata`);
      const { error } = await supabase.auth.admin.updateUserById(found.id, {
        app_metadata: { role: u.role, name: u.name },
      });
      if (error) console.error(`  ❌ ${error.message}`);
      else console.log(`  ✅ role updated to "${u.role}"`);
      continue;
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      app_metadata: { role: u.role, name: u.name },
    });

    if (error) {
      console.error(`  ❌ ${u.email}: ${error.message}`);
    } else {
      console.log(`  ✅ ${u.email} created (role: ${u.role}) — uid: ${data.user.id}`);
    }
  }

  console.log("\n👤 Auth seeding completed!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Auth seeding failed:", err);
  process.exit(1);
});
