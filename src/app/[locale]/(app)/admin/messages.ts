import type { Locale } from "@/i18n/config";

export type AdminMessages = {
  loading: string;
  retry: string;
  genericError: string;
  backToPeriods: string;
  backToPeriod: string;

  // Periods list
  periodsHeading: string;
  periodsIntro: string;
  periodsEmpty: string;
  periodsLoadError: string;
  periodColumnName: string;
  periodColumnDates: string;
  periodColumnActions: string;
  openPeriod: string;
  createPeriodHeading: string;
  fieldName: string;
  fieldStartsOn: string;
  fieldEndsOn: string;
  createPeriodSubmit: string;
  creatingPeriod: string;
  periodCreated: string;
  nameRequired: string;
  nameTooLong: string;
  datesRequired: string;
  endsBeforeStarts: string;

  // Period detail
  periodDetailHeading: string;
  periodRange: string;
  periodNotFound: string;

  servicesHeading: string;
  servicesEmpty: string;
  servicesLoadError: string;
  serviceColumnTitle: string;
  serviceColumnStart: string;
  serviceColumnNotes: string;
  createServiceHeading: string;
  fieldTitle: string;
  fieldServiceDate: string;
  fieldServiceTime: string;
  fieldNotes: string;
  requirementsHeading: string;
  requirementsHint: string;
  addRequirement: string;
  removeRequirement: string;
  fieldRole: string;
  fieldRequiredCount: string;
  selectRole: string;
  createServiceSubmit: string;
  creatingService: string;
  serviceCreated: string;
  titleRequired: string;
  serviceDateTimeRequired: string;
  requirementsRequired: string;
  duplicateRole: string;
  requiredCountRange: string;
  rolesLoadError: string;
  serviceOutOfRange: string;

  candidatesHeading: string;
  candidatesEmpty: string;
  candidatesLoadError: string;
  candidateColumnVersion: string;
  candidateColumnStatus: string;
  candidateColumnScore: string;
  candidateColumnConstraints: string;
  candidateColumnGenerated: string;
  viewCandidate: string;
  generateCandidateHeading: string;
  generateCandidateIntro: string;
  weightsHeading: string;
  weightsHint: string;
  fieldWeightPrimaryRole: string;
  fieldWeightPreferredAvailability: string;
  fieldWeightLoadBalance: string;
  generateCandidateSubmit: string;
  generatingCandidate: string;
  weightRange: string;

  statusDraft: string;
  statusPublished: string;
  statusSuperseded: string;
  constraintsSatisfied: string;
  constraintsUnsatisfied: string;

  // Candidate review
  candidateHeading: string;
  candidateLoadError: string;
  objectiveScoreLabel: string;
  hardConstraintsLabel: string;

  coverageHeading: string;
  totalRequiredLabel: string;
  totalAssignedLabel: string;
  unfilledCountLabel: string;
  coveragePercentageLabel: string;

  fairnessHeading: string;
  minAssignmentsLabel: string;
  maxAssignmentsLabel: string;
  meanAssignmentsLabel: string;
  spreadLabel: string;
  assignmentCountsHeading: string;

  primaryAssignmentsLabel: string;
  preferredAssignmentsLabel: string;

  unfilledRolesHeading: string;
  unfilledRolesEmpty: string;
  missingCountLabel: string;

  assignmentsHeading: string;
  assignmentsEmpty: string;
  assignmentColumnService: string;
  assignmentColumnRole: string;
  assignmentColumnVolunteer: string;
  assignmentColumnStatus: string;
  assignmentColumnActions: string;
  lockedLabel: string;
  carriedOverLabel: string;
  newlySolvedLabel: string;
  lockButton: string;
  unlockButton: string;
  updatingLock: string;
  lockUpdateError: string;

  regenerateHeading: string;
  regenerateIntro: string;
  regenerateSubmit: string;
  regenerating: string;
  regenerateSuccess: string;

  infeasibleLockHeading: string;
  infeasibleLockIntro: string;
  reasonUnqualified: string;
  reasonInactive: string;
  reasonUnavailable: string;
  reasonRequirementExceeded: string;
  reasonServiceNotFound: string;

  publishHeading: string;
  publishIntro: string;
  publishButton: string;
  publishConfirmTitle: string;
  publishConfirmBody: string;
  publishConfirmConfirm: string;
  publishConfirmCancel: string;
  publishing: string;
  publishSuccess: string;
  publishBlockedInfeasible: string;
  publishNotAvailable: string;

  apiErrorRoleNotFound: string;
  apiErrorValidation: string;
  apiErrorCandidateNotEditable: string;
  apiErrorCandidateNotPublishable: string;
  apiErrorRosterInfeasible: string;
  apiErrorInfeasibleLock: string;
  apiErrorRosterCandidateNotFound: string;
  apiErrorPlanningPeriodNotFound: string;
  apiErrorNoServiceRequirements: string;
  apiErrorNetwork: string;
};

const messages: Record<Locale, AdminMessages> = {
  en: {
    loading: "Loading…",
    retry: "Try again",
    genericError: "Something went wrong. Please try again.",
    backToPeriods: "Back to planning periods",
    backToPeriod: "Back to planning period",

    periodsHeading: "Planning periods",
    periodsIntro: "Create a planning period, then add services and generate a roster candidate.",
    periodsEmpty: "No planning periods yet. Create the first one below.",
    periodsLoadError: "Could not load planning periods.",
    periodColumnName: "Name",
    periodColumnDates: "Dates",
    periodColumnActions: "Actions",
    openPeriod: "Open",
    createPeriodHeading: "Create a planning period",
    fieldName: "Name",
    fieldStartsOn: "Starts on",
    fieldEndsOn: "Ends on",
    createPeriodSubmit: "Create planning period",
    creatingPeriod: "Creating…",
    periodCreated: "Planning period created.",
    nameRequired: "Enter a name up to 120 characters.",
    nameTooLong: "Name must be 120 characters or fewer.",
    datesRequired: "Enter both a start and end date.",
    endsBeforeStarts: "End date must be on or after the start date.",

    periodDetailHeading: "Planning period",
    periodRange: "Runs from {startsOn} to {endsOn}",
    periodNotFound: "This planning period could not be found.",

    servicesHeading: "Services",
    servicesEmpty: "No services yet. Add the first one below.",
    servicesLoadError: "Could not load services.",
    serviceColumnTitle: "Title",
    serviceColumnStart: "Starts at",
    serviceColumnNotes: "Notes",
    createServiceHeading: "Add a service",
    fieldTitle: "Title",
    fieldServiceDate: "Date",
    fieldServiceTime: "Time (Asia/Singapore)",
    fieldNotes: "Notes (optional)",
    requirementsHeading: "Role requirements",
    requirementsHint: "Add at least one role. Each role can appear only once, with a capacity from 1 to 20.",
    addRequirement: "Add role requirement",
    removeRequirement: "Remove",
    fieldRole: "Role",
    fieldRequiredCount: "Required count",
    selectRole: "Select a role",
    createServiceSubmit: "Create service",
    creatingService: "Creating…",
    serviceCreated: "Service created.",
    titleRequired: "Enter a title up to 160 characters.",
    serviceDateTimeRequired: "Enter both a date and a time.",
    requirementsRequired: "Add at least one role requirement.",
    duplicateRole: "Each role can appear only once per service.",
    requiredCountRange: "Required count must be a whole number from 1 to 20.",
    rolesLoadError: "Could not load roles.",
    serviceOutOfRange: "The service time must fall within the planning period's dates.",

    candidatesHeading: "Roster candidates",
    candidatesEmpty: "No candidates generated yet.",
    candidatesLoadError: "Could not load roster candidates.",
    candidateColumnVersion: "Version",
    candidateColumnStatus: "Status",
    candidateColumnScore: "Score",
    candidateColumnConstraints: "Constraints",
    candidateColumnGenerated: "Generated",
    viewCandidate: "Review",
    generateCandidateHeading: "Generate a candidate",
    generateCandidateIntro:
      "Generates a new draft roster candidate from current services, availability, and role capabilities.",
    weightsHeading: "Weights (optional, 0–100)",
    weightsHint: "Leave blank to use the default weights.",
    fieldWeightPrimaryRole: "Primary role",
    fieldWeightPreferredAvailability: "Preferred availability",
    fieldWeightLoadBalance: "Load balance",
    generateCandidateSubmit: "Generate candidate",
    generatingCandidate: "Generating…",
    weightRange: "Weights must be whole numbers from 0 to 100.",

    statusDraft: "Draft",
    statusPublished: "Published",
    statusSuperseded: "Superseded",
    constraintsSatisfied: "All roles filled",
    constraintsUnsatisfied: "Unfilled roles remain",

    candidateHeading: "Candidate version {version}",
    candidateLoadError: "Could not load this roster candidate.",
    objectiveScoreLabel: "Objective score",
    hardConstraintsLabel: "Hard constraints",

    coverageHeading: "Coverage",
    totalRequiredLabel: "Roles required",
    totalAssignedLabel: "Roles assigned",
    unfilledCountLabel: "Roles unfilled",
    coveragePercentageLabel: "Coverage",

    fairnessHeading: "Fairness",
    minAssignmentsLabel: "Fewest assignments",
    maxAssignmentsLabel: "Most assignments",
    meanAssignmentsLabel: "Average assignments",
    spreadLabel: "Spread",
    assignmentCountsHeading: "Assignments per volunteer",

    primaryAssignmentsLabel: "Primary-role assignments",
    preferredAssignmentsLabel: "Preferred-availability assignments",

    unfilledRolesHeading: "Unfilled roles",
    unfilledRolesEmpty: "Every required role is filled.",
    missingCountLabel: "missing",

    assignmentsHeading: "Assignments",
    assignmentsEmpty: "This candidate has no assignments.",
    assignmentColumnService: "Service",
    assignmentColumnRole: "Role",
    assignmentColumnVolunteer: "Volunteer",
    assignmentColumnStatus: "Status",
    assignmentColumnActions: "Actions",
    lockedLabel: "Locked",
    carriedOverLabel: "Carried over (locked)",
    newlySolvedLabel: "Newly solved",
    lockButton: "Lock",
    unlockButton: "Unlock",
    updatingLock: "Updating…",
    lockUpdateError: "Could not update the lock for this assignment.",

    regenerateHeading: "Regenerate",
    regenerateIntro:
      "Creates a new candidate version. Locked assignments carry over unchanged; everything else is recalculated.",
    regenerateSubmit: "Regenerate candidate",
    regenerating: "Regenerating…",
    regenerateSuccess: "Regenerated a new candidate version.",

    infeasibleLockHeading: "Regeneration failed: locked assignments are no longer feasible",
    infeasibleLockIntro: "Unlock or reassign the following before regenerating again:",
    reasonUnqualified: "no longer has this role capability",
    reasonInactive: "is no longer an active member",
    reasonUnavailable: "is unavailable on the service date",
    reasonRequirementExceeded: "exceeds the role's required count",
    reasonServiceNotFound: "no longer refers to an existing service",

    publishHeading: "Publish",
    publishIntro:
      "Publishing makes this the official roster for the period and supersedes any previously published version.",
    publishButton: "Publish roster",
    publishConfirmTitle: "Publish this roster?",
    publishConfirmBody:
      "This will replace any previously published roster for this planning period. Volunteers will see the new assignments immediately. This cannot be undone from this screen.",
    publishConfirmConfirm: "Yes, publish",
    publishConfirmCancel: "Cancel",
    publishing: "Publishing…",
    publishSuccess: "Roster published.",
    publishBlockedInfeasible: "This candidate cannot be published until every required role is filled.",
    publishNotAvailable: "Only a draft candidate can be published.",

    apiErrorRoleNotFound: "One or more selected roles do not exist.",
    apiErrorValidation: "Please fix the highlighted fields.",
    apiErrorCandidateNotEditable: "This candidate can no longer be edited.",
    apiErrorCandidateNotPublishable: "This candidate is no longer a draft and cannot be published.",
    apiErrorRosterInfeasible: "This candidate cannot be published because not every required role is filled.",
    apiErrorInfeasibleLock: "One or more locked assignments are no longer feasible.",
    apiErrorRosterCandidateNotFound: "This roster candidate could not be found.",
    apiErrorPlanningPeriodNotFound: "This planning period could not be found.",
    apiErrorNoServiceRequirements: "Add services with role requirements before generating a candidate.",
    apiErrorNetwork: "Could not reach the server. Check your connection and try again.",
  },
  zh: {
    loading: "加载中……",
    retry: "重试",
    genericError: "出现问题，请重试。",
    backToPeriods: "返回排班周期列表",
    backToPeriod: "返回排班周期",

    periodsHeading: "排班周期",
    periodsIntro: "先创建排班周期，然后添加服务并生成候选排班表。",
    periodsEmpty: "还没有排班周期，请在下方创建第一个。",
    periodsLoadError: "无法加载排班周期。",
    periodColumnName: "名称",
    periodColumnDates: "日期",
    periodColumnActions: "操作",
    openPeriod: "打开",
    createPeriodHeading: "创建排班周期",
    fieldName: "名称",
    fieldStartsOn: "开始日期",
    fieldEndsOn: "结束日期",
    createPeriodSubmit: "创建排班周期",
    creatingPeriod: "创建中……",
    periodCreated: "排班周期已创建。",
    nameRequired: "请输入名称（最多120个字符）。",
    nameTooLong: "名称不能超过120个字符。",
    datesRequired: "请输入开始和结束日期。",
    endsBeforeStarts: "结束日期必须晚于或等于开始日期。",

    periodDetailHeading: "排班周期",
    periodRange: "从 {startsOn} 到 {endsOn}",
    periodNotFound: "找不到此排班周期。",

    servicesHeading: "服务",
    servicesEmpty: "还没有服务，请在下方添加第一个。",
    servicesLoadError: "无法加载服务。",
    serviceColumnTitle: "标题",
    serviceColumnStart: "开始时间",
    serviceColumnNotes: "备注",
    createServiceHeading: "添加服务",
    fieldTitle: "标题",
    fieldServiceDate: "日期",
    fieldServiceTime: "时间（新加坡时区）",
    fieldNotes: "备注（可选）",
    requirementsHeading: "角色需求",
    requirementsHint: "至少添加一个角色。每个角色只能出现一次，人数需求为1到20之间。",
    addRequirement: "添加角色需求",
    removeRequirement: "移除",
    fieldRole: "角色",
    fieldRequiredCount: "所需人数",
    selectRole: "选择角色",
    createServiceSubmit: "创建服务",
    creatingService: "创建中……",
    serviceCreated: "服务已创建。",
    titleRequired: "请输入标题（最多160个字符）。",
    serviceDateTimeRequired: "请输入日期和时间。",
    requirementsRequired: "请至少添加一个角色需求。",
    duplicateRole: "每个角色在同一服务中只能出现一次。",
    requiredCountRange: "所需人数必须是1到20之间的整数。",
    rolesLoadError: "无法加载角色列表。",
    serviceOutOfRange: "服务时间必须在排班周期的日期范围内。",

    candidatesHeading: "候选排班表",
    candidatesEmpty: "还没有生成候选排班表。",
    candidatesLoadError: "无法加载候选排班表。",
    candidateColumnVersion: "版本",
    candidateColumnStatus: "状态",
    candidateColumnScore: "分数",
    candidateColumnConstraints: "约束条件",
    candidateColumnGenerated: "生成时间",
    viewCandidate: "查看",
    generateCandidateHeading: "生成候选排班表",
    generateCandidateIntro: "根据当前的服务、可用时间和角色能力生成新的候选排班表草稿。",
    weightsHeading: "权重（可选，0–100）",
    weightsHint: "留空则使用默认权重。",
    fieldWeightPrimaryRole: "主要角色",
    fieldWeightPreferredAvailability: "优先可用时间",
    fieldWeightLoadBalance: "负载均衡",
    generateCandidateSubmit: "生成候选排班表",
    generatingCandidate: "生成中……",
    weightRange: "权重必须是0到100之间的整数。",

    statusDraft: "草稿",
    statusPublished: "已发布",
    statusSuperseded: "已替换",
    constraintsSatisfied: "所有角色已排满",
    constraintsUnsatisfied: "仍有角色未排满",

    candidateHeading: "候选排班表版本 {version}",
    candidateLoadError: "无法加载此候选排班表。",
    objectiveScoreLabel: "目标分数",
    hardConstraintsLabel: "硬性约束",

    coverageHeading: "覆盖情况",
    totalRequiredLabel: "所需角色数",
    totalAssignedLabel: "已分配角色数",
    unfilledCountLabel: "未分配角色数",
    coveragePercentageLabel: "覆盖率",

    fairnessHeading: "公平性",
    minAssignmentsLabel: "最少分配次数",
    maxAssignmentsLabel: "最多分配次数",
    meanAssignmentsLabel: "平均分配次数",
    spreadLabel: "差值",
    assignmentCountsHeading: "各志愿者分配次数",

    primaryAssignmentsLabel: "主要角色分配数",
    preferredAssignmentsLabel: "优先可用时间分配数",

    unfilledRolesHeading: "未分配角色",
    unfilledRolesEmpty: "所有必需角色均已分配。",
    missingCountLabel: "缺少",

    assignmentsHeading: "分配详情",
    assignmentsEmpty: "此候选排班表没有任何分配。",
    assignmentColumnService: "服务",
    assignmentColumnRole: "角色",
    assignmentColumnVolunteer: "志愿者",
    assignmentColumnStatus: "状态",
    assignmentColumnActions: "操作",
    lockedLabel: "已锁定",
    carriedOverLabel: "沿用（已锁定）",
    newlySolvedLabel: "新计算",
    lockButton: "锁定",
    unlockButton: "解锁",
    updatingLock: "更新中……",
    lockUpdateError: "无法更新此分配的锁定状态。",

    regenerateHeading: "重新生成",
    regenerateIntro: "将创建新的候选排班表版本。已锁定的分配保持不变，其余部分将重新计算。",
    regenerateSubmit: "重新生成候选排班表",
    regenerating: "重新生成中……",
    regenerateSuccess: "已生成新的候选排班表版本。",

    infeasibleLockHeading: "重新生成失败：部分锁定分配已不可行",
    infeasibleLockIntro: "请在再次重新生成之前解锁或调整以下分配：",
    reasonUnqualified: "已不具备该角色能力",
    reasonInactive: "已不是活跃成员",
    reasonUnavailable: "在该服务日期不可用",
    reasonRequirementExceeded: "超出该角色的所需人数",
    reasonServiceNotFound: "对应的服务已不存在",

    publishHeading: "发布",
    publishIntro: "发布后将成为该周期的正式排班表，并替换之前已发布的版本。",
    publishButton: "发布排班表",
    publishConfirmTitle: "确认发布此排班表？",
    publishConfirmBody:
      "这将替换该排班周期之前已发布的排班表。志愿者将立即看到新的分配。此操作在此页面上无法撤销。",
    publishConfirmConfirm: "确认发布",
    publishConfirmCancel: "取消",
    publishing: "发布中……",
    publishSuccess: "排班表已发布。",
    publishBlockedInfeasible: "所有必需角色排满之前，此候选排班表无法发布。",
    publishNotAvailable: "只有草稿状态的候选排班表才能发布。",

    apiErrorRoleNotFound: "一个或多个所选角色不存在。",
    apiErrorValidation: "请修正标记的字段。",
    apiErrorCandidateNotEditable: "此候选排班表已无法编辑。",
    apiErrorCandidateNotPublishable: "此候选排班表已不是草稿，无法发布。",
    apiErrorRosterInfeasible: "此候选排班表尚未排满所有必需角色，无法发布。",
    apiErrorInfeasibleLock: "一个或多个锁定的分配已不可行。",
    apiErrorRosterCandidateNotFound: "找不到此候选排班表。",
    apiErrorPlanningPeriodNotFound: "找不到此排班周期。",
    apiErrorNoServiceRequirements: "请先添加带有角色需求的服务，再生成候选排班表。",
    apiErrorNetwork: "无法连接服务器，请检查网络后重试。",
  },
};

export function getAdminMessages(locale: Locale): AdminMessages {
  return messages[locale];
}

const apiErrorKeyMap: Record<string, keyof AdminMessages> = {
  role_not_found: "apiErrorRoleNotFound",
  validation_error: "apiErrorValidation",
  candidate_not_editable: "apiErrorCandidateNotEditable",
  candidate_not_publishable: "apiErrorCandidateNotPublishable",
  roster_infeasible: "apiErrorRosterInfeasible",
  infeasible_lock: "apiErrorInfeasibleLock",
  roster_candidate_not_found: "apiErrorRosterCandidateNotFound",
  planning_period_not_found: "apiErrorPlanningPeriodNotFound",
  no_service_requirements: "apiErrorNoServiceRequirements",
  service_outside_planning_period: "serviceOutOfRange",
};

export function describeApiErrorCode(code: string, messagesForLocale: AdminMessages): string {
  const key = apiErrorKeyMap[code];
  return key ? messagesForLocale[key] : messagesForLocale.genericError;
}

export function formatMessage(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce<string>(
    (result, [key, value]) => result.split(`{${key}}`).join(String(value)),
    template,
  );
}
