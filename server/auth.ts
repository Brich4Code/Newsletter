import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { storage } from "./storage";
import type { User } from "@shared/schema";

// Hash password using SHA-256 with salt
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const useSalt = salt || randomBytes(16).toString("hex");
  const hash = createHash("sha256")
    .update(password + useSalt)
    .digest("hex");
  return { hash, salt: useSalt };
}

// Verify password
export function verifyPassword(password: string, storedHash: string): boolean {
  // storedHash format: "salt:hash"
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;

  const { hash: computedHash } = hashPassword(password, salt);

  // Use timing-safe comparison to prevent timing attacks
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(computedHash));
  } catch {
    return false;
  }
}

// Create password hash for storage (format: "salt:hash")
export function createPasswordHash(password: string): string {
  const { hash, salt } = hashPassword(password);
  return `${salt}:${hash}`;
}

// Authenticate user
export async function authenticateUser(username: string, password: string): Promise<User | null> {
  const user = await storage.getUserByUsername(username);
  if (!user) return null;

  if (verifyPassword(password, user.passwordHash)) {
    return user;
  }

  return null;
}

// Create initial admin user if none exists
export async function ensureAdminUser(username: string, password: string): Promise<User> {
  const existingUser = await storage.getUserByUsername(username);
  if (existingUser) {
    return existingUser;
  }

  const passwordHash = createPasswordHash(password);
  return storage.createUser({ username, passwordHash });
}

// Check if any users exist
export async function hasUsers(): Promise<boolean> {
  const count = await storage.getUserCount();
  return count > 0;
}
