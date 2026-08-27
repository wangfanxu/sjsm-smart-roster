import type { AuthDependencies } from "@/auth/authorize";
import { getServerAuthDependencies } from "@/auth/server";
import { getDatabaseConnection } from "@/db/client";
import { createDomainRepository } from "@/db/domain-repository";
import { SmartRosterService } from "@/domain/smart-roster-service";

export type ApiDependencies = Readonly<{
  auth: AuthDependencies;
  service: SmartRosterService;
}>;

let apiDependencies: ApiDependencies | undefined;

export function getServerApiDependencies(): ApiDependencies {
  if (!apiDependencies) {
    const { db } = getDatabaseConnection();
    apiDependencies = {
      auth: getServerAuthDependencies(),
      service: new SmartRosterService(createDomainRepository(db)),
    };
  }
  return apiDependencies;
}
