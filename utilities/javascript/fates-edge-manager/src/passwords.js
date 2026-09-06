import argon2 from 'argon2';
import bcrypt from 'bcryptjs';

export async function verifyPassword(hash,password) {
  try {
    // Preserve the existing socket-account password during an explicit import.
    if (/^\$2[aby]\$/.test(hash)) return await bcrypt.compare(password,hash);
    return await argon2.verify(hash,password);
  } catch { return false; }
}
