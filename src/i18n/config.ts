export const locales = ["en", "zh"] as const;

export type Locale = (typeof locales)[number];

type Messages = {
  languageNavigationLabel: string;
  switchLanguage: string;
  eyebrow: string;
  title: string;
  description: string;
  principleTitle: string;
  principleDescription: string;
  status: string;
  foundationTitle: string;
  foundationDescription: string;
  foundationItems: string[];
  signInCta: string;
  signInTitle: string;
  signInDescription: string;
  signInButton: string;
  signInLoading: string;
  signInError: string;
  notRegisteredTitle: string;
  notRegisteredDescription: string;
  signOut: string;
  navDashboard: string;
  navProfile: string;
  navAssistant: string;
  navAdmin: string;
  loading: string;
  comingSoon: string;
};

const messages: Record<Locale, Messages> = {
  en: {
    languageNavigationLabel: "Language selection",
    switchLanguage: "中文",
    eyebrow: "Explainable scheduling, human decisions",
    title: "Serving together, planned fairly.",
    description:
      "SmartRoster helps church coordinators build conflict-free volunteer rosters while keeping people—not algorithms—in control.",
    principleTitle: "The algorithm suggests. People decide.",
    principleDescription:
      "Every suggestion is reviewable, every trade-off is explainable, and no roster is published without an authorized human.",
    status: "What's built",
    foundationTitle: "From availability to a published roster.",
    foundationDescription:
      "SmartRoster now covers the full cycle: collecting availability, generating a fair draft roster with an explainable scheduling engine, reviewing and adjusting it by hand, publishing it with automatic notifications, and letting volunteers ask a bilingual AI assistant about their own schedule.",
    foundationItems: [
      "Explainable fair-scheduling engine (role fit, availability, workload balance)",
      "Manual review, locking, and reassignment before publishing",
      "Self-service availability and schedule for volunteers",
      "AI conversational assistant for your own schedule (English/Chinese)",
    ],
    signInCta: "Sign in",
    signInTitle: "Sign in to SmartRoster",
    signInDescription: "Use your Google account to continue.",
    signInButton: "Continue with Google",
    signInLoading: "Signing you in…",
    signInError: "Sign-in failed. Please try again.",
    notRegisteredTitle: "Account not yet set up",
    notRegisteredDescription:
      "Your Google account isn't linked to a SmartRoster profile yet. Please contact your administrator to be added.",
    signOut: "Sign out",
    navDashboard: "My schedule",
    navProfile: "Profile",
    navAssistant: "Assistant",
    navAdmin: "Administration",
    loading: "Loading…",
    comingSoon: "This screen is coming soon.",
  },
  zh: {
    languageNavigationLabel: "语言选择",
    switchLanguage: "English",
    eyebrow: "可解释的排班，由人做最终决定",
    title: "一起服侍，公平安排。",
    description:
      "SmartRoster 帮助教会负责人建立无冲突的服侍表，同时确保最终决定始终掌握在人手中。",
    principleTitle: "系统提供建议，由人做决定。",
    principleDescription:
      "每个建议都可以审核，每项取舍都可以解释；未经授权负责人确认，系统不会发布排班。",
    status: "已实现功能",
    foundationTitle: "从可用时间到正式发布排班表，一站完成。",
    foundationDescription:
      "SmartRoster 现已覆盖完整流程：收集可用时间、通过可解释的排班引擎生成公平的排班草案、人工审核调整、正式发布并自动通知，志愿者还可以用中英文双语 AI 助理查询自己的排班。",
    foundationItems: [
      "可解释的公平排班引擎（角色匹配、可用时间、工作量均衡）",
      "发布前可人工审核、锁定、手动调整",
      "志愿者可自助设置可用时间、查看排班",
      "中英文双语 AI 助理，可查询自己的排班",
    ],
    signInCta: "登录",
    signInTitle: "登录 SmartRoster",
    signInDescription: "使用你的 Google 帐号继续。",
    signInButton: "使用 Google 继续",
    signInLoading: "正在登录……",
    signInError: "登录失败，请重试。",
    notRegisteredTitle: "帐号尚未设置",
    notRegisteredDescription: "你的 Google 帐号尚未关联 SmartRoster 个人资料，请联系管理员为你添加。",
    signOut: "登出",
    navDashboard: "我的排班",
    navProfile: "个人资料",
    navAssistant: "助理",
    navAdmin: "管理",
    loading: "加载中……",
    comingSoon: "此页面即将推出。",
  },
};

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function getMessages(locale: Locale): Messages {
  return messages[locale];
}
