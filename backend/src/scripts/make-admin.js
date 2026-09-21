import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const DB_URL = process.env.DB_URL || "mongodb://localhost:27017/primexpc";
const adminEmail = process.argv[2];
const adminPass = process.argv[3];

if (!adminEmail || !adminPass) {
  console.log("Usage: node src/scripts/make-admin.js <email> <password>");
  process.exit(1);
}

if (adminPass.length < 6) {
  console.log("Password must be at least 6 characters");
  process.exit(1);
}

const userSchema = new mongoose.Schema({ email: String, name: String, password: String, role: String }, { timestamps: true });
const User = mongoose.model("User", userSchema);

async function makeAdmin() {
  await mongoose.connect(DB_URL);
  console.log("Connected to DB");

  const hashed = await bcrypt.hash(adminPass, 10);

  const existing = await User.findOne({ email: adminEmail });
  if (existing) {
    existing.role = "admin";
    existing.password = hashed;
    await existing.save();
    console.log(`User ${adminEmail} updated to admin`);
  } else {
    await User.create({ email: adminEmail, name: "Admin", password: hashed, role: "admin" });
    console.log(`Admin user ${adminEmail} created`);
  }

  await mongoose.disconnect();
}

makeAdmin().catch(console.error);
