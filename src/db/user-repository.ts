import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { UserRepository } from "@/auth/types";
import * as schema from "./schema";
import { users } from "./schema";

export function createUserRepository(
  database: PostgresJsDatabase<typeof schema>,
): UserRepository {
  return {
    async findByFirebaseUid(firebaseUid) {
      const [user] = await database
        .select({
          id: users.id,
          firebaseUid: users.firebaseUid,
          email: users.email,
          displayName: users.displayName,
          systemRole: users.systemRole,
          isActive: users.isActive,
        })
        .from(users)
        .where(eq(users.firebaseUid, firebaseUid))
        .limit(1);

      return user ?? null;
    },
  };
}
