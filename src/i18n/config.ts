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
};

const messages: Record<Locale, Messages> = {
  en: {
    languageNavigationLabel: "Language selection",
    switchLanguage: "中文",
    eyebrow: "Explainable scheduling, human decisions",
    title: "Serving together, planned fairly.",
    description:
      "SmartRoster helps church coordinators build conflict-free volunteer rosters while keeping people—not algorithms—in control.",
    principleTitle: "AI assists. People decide.",
    principleDescription:
      "Every suggestion is reviewable, every trade-off is explainable, and no roster is published without an authorized human.",
    status: "Sprint 1",
    foundationTitle: "The foundation is ready.",
    foundationDescription:
      "This first increment establishes the deployable application, bilingual experience, health endpoint, automated tests, and CI quality gates.",
    foundationItems: [
      "Next.js App Router",
      "English and Chinese",
      "Automated quality checks",
      "Deployment health endpoint",
    ],
  },
  zh: {
    languageNavigationLabel: "语言选择",
    switchLanguage: "English",
    eyebrow: "可解释的排班，由人做最终决定",
    title: "一起服侍，公平安排。",
    description:
      "SmartRoster 帮助教会负责人建立无冲突的服侍表，同时确保最终决定始终掌握在人手中。",
    principleTitle: "AI 提供协助，由人做决定。",
    principleDescription:
      "每个建议都可以审核，每项取舍都可以解释；未经授权负责人确认，系统不会发布排班。",
    status: "Sprint 1",
    foundationTitle: "项目基础已经就绪。",
    foundationDescription:
      "第一个增量建立了可部署的应用、中英文体验、健康检查、自动化测试以及 CI 质量关卡。",
    foundationItems: [
      "Next.js App Router",
      "中英文支持",
      "自动化质量检查",
      "部署健康检查",
    ],
  },
};

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function getMessages(locale: Locale): Messages {
  return messages[locale];
}
