import type { Locale } from "@/i18n/config";
import type { SystemRole } from "./types";

export type ProfileMessages = {
  pageTitle: string;
  pageDescription: string;
  loading: string;
  loadError: string;
  retry: string;

  nameLabel: string;
  nameRequired: string;
  saveName: string;
  saving: string;
  nameSaved: string;
  nameSaveError: string;

  rolesTitle: string;
  rolesDescription: string;
  rolesEmpty: string;
  roleNone: string;
  rolePrimary: string;
  roleSecondary: string;
  saveRoles: string;
  rolesSaved: string;
  rolesSaveError: string;

  systemRoleVolunteer: string;
  systemRoleTeamLeader: string;
  systemRoleAdministrator: string;
};

const messages: Record<Locale, ProfileMessages> = {
  en: {
    pageTitle: "My profile",
    pageDescription: "Update your display name and the roles you can serve in.",
    loading: "Loading your profile…",
    loadError: "We couldn't load your profile.",
    retry: "Try again",

    nameLabel: "Display name",
    nameRequired: "Enter a display name up to 160 characters.",
    saveName: "Save name",
    saving: "Saving…",
    nameSaved: "Name updated.",
    nameSaveError: "We couldn't save your name.",

    rolesTitle: "Role capabilities",
    rolesDescription:
      "Tell the team which roles you can serve in. Set each role to primary, secondary, or not assigned.",
    rolesEmpty: "No roles are defined yet.",
    roleNone: "Not assigned",
    rolePrimary: "Primary",
    roleSecondary: "Secondary",
    saveRoles: "Save role capabilities",
    rolesSaved: "Role capabilities updated.",
    rolesSaveError: "We couldn't save your role capabilities.",

    systemRoleVolunteer: "Volunteer",
    systemRoleTeamLeader: "Team leader",
    systemRoleAdministrator: "Administrator",
  },
  zh: {
    pageTitle: "个人资料",
    pageDescription: "更新你的显示名称，以及你能够服侍的角色。",
    loading: "正在加载你的个人资料……",
    loadError: "无法加载你的个人资料。",
    retry: "重试",

    nameLabel: "显示名称",
    nameRequired: "请输入显示名称（最多160个字符）。",
    saveName: "保存名称",
    saving: "保存中……",
    nameSaved: "名称已更新。",
    nameSaveError: "无法保存你的名称。",

    rolesTitle: "角色能力",
    rolesDescription: "告诉团队你能胜任哪些角色。为每个角色选择主要、次要或不分配。",
    rolesEmpty: "还没有定义任何角色。",
    roleNone: "不分配",
    rolePrimary: "主要",
    roleSecondary: "次要",
    saveRoles: "保存角色能力",
    rolesSaved: "角色能力已更新。",
    rolesSaveError: "无法保存你的角色能力。",

    systemRoleVolunteer: "志愿者",
    systemRoleTeamLeader: "小组负责人",
    systemRoleAdministrator: "管理员",
  },
};

export function getProfileMessages(locale: Locale): ProfileMessages {
  return messages[locale];
}

export function systemRoleLabel(systemRole: SystemRole, messagesForLocale: ProfileMessages): string {
  if (systemRole === "administrator") return messagesForLocale.systemRoleAdministrator;
  if (systemRole === "team_leader") return messagesForLocale.systemRoleTeamLeader;
  return messagesForLocale.systemRoleVolunteer;
}
