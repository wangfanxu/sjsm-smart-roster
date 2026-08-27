export type HealthPayload = Readonly<{
  service: "sjsm-smart-roster";
  status: "ok";
}>;

export function createHealthPayload(): HealthPayload {
  return {
    service: "sjsm-smart-roster",
    status: "ok",
  };
}
