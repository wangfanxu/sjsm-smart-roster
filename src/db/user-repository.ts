import { and, eq, isNull } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { UserRepository } from "@/auth/types";
import * as schema from "./schema";
import { users } from "./schema";

const selectedColumns = {
  id: users.id,
  firebaseUid: users.firebaseUid,
  email: users.email,
  displayName: users.displayName,
  systemRole: users.systemRole,
  isActive: users.isActive,
};

export function createUserRepository(
  database: PostgresJsDatabase<typeof schema>,
): UserRepository {
  return {
    async findByFirebaseUid(firebaseUid) {
      const [user] = await database
        .select(selectedColumns)
        .from(users)
        .where(eq(users.firebaseUid, firebaseUid))
        .limit(1);

      return user ?? null;
    },

    async linkPendingUserByEmail(email, firebaseUid) {
      const [linked] = await database
        .update(users)
        .set({ firebaseUid, updatedAt: new Date() })
        .where(and(eq(users.email, email), isNull(users.firebaseUid)))
        .returning(selectedColumns);

      return linked ?? null;
    },
  };
}
