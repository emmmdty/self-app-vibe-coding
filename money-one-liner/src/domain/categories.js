const CATEGORY_DEFINITIONS = [
  { name: "餐饮", flow: "expense", group: "生活消费" },
  { name: "交通", flow: "expense", group: "生活消费" },
  { name: "日用购物", flow: "expense", group: "生活消费" },
  { name: "服饰美妆", flow: "expense", group: "生活消费" },
  { name: "通讯网费", flow: "expense", group: "生活消费" },
  { name: "住宿", flow: "expense", group: "生活消费" },
  { name: "房租水电", flow: "expense", group: "居住账单" },
  { name: "公共服务", flow: "expense", group: "居住账单" },
  { name: "医疗健康", flow: "expense", group: "成长健康" },
  { name: "学习成长", flow: "expense", group: "成长健康" },
  { name: "娱乐休闲", flow: "expense", group: "娱乐社交" },
  { name: "人情社交", flow: "expense", group: "娱乐社交" },
  { name: "宠物", flow: "expense", group: "娱乐社交" },
  { name: "旅行度假", flow: "expense", group: "娱乐社交" },
  { name: "数码家电", flow: "expense", group: "资产设备" },
  { name: "保险保障", flow: "expense", group: "资产设备" },
  { name: "税费手续费", flow: "expense", group: "资产设备" },
  { name: "捐赠公益", flow: "expense", group: "资产设备" },
  { name: "其他支出", flow: "expense", group: "其他支出" },
  { name: "未分类支出", flow: "expense", group: "未分类" },
  { name: "工资兼职", flow: "income", group: "职业收入" },
  { name: "奖学金补助", flow: "income", group: "职业收入" },
  { name: "投资理财", flow: "income", group: "资产收入" },
  { name: "报销", flow: "income", group: "往来入账" },
  { name: "转账退款", flow: "income", group: "往来入账" },
  { name: "二手闲置", flow: "income", group: "资产收入" },
  { name: "奖励红包", flow: "income", group: "往来入账" },
  { name: "其他收入", flow: "income", group: "其他收入" },
  { name: "未分类收入", flow: "income", group: "未分类" }
];

const CATEGORY_META = new Map(CATEGORY_DEFINITIONS.map((item) => [item.name, item]));

export const FLOWS = ["expense", "income"];
export const FLOW_TYPES = ["expense", "income", "transfer", "debt_principal", "adjustment"];

export const UNCATEGORIZED_EXPENSE_TYPE = "未分类支出";
export const UNCATEGORIZED_INCOME_TYPE = "未分类收入";

export const EXPENSE_TYPES = CATEGORY_DEFINITIONS.filter((item) => item.flow === "expense").map((item) => item.name);
export const INCOME_TYPES = CATEGORY_DEFINITIONS.filter((item) => item.flow === "income").map((item) => item.name);
export const ALL_TYPES = [...EXPENSE_TYPES, ...INCOME_TYPES];

export const CATEGORY_GROUPS = [...new Set(CATEGORY_DEFINITIONS.map((item) => item.group))].sort((a, b) =>
  a.localeCompare(b, "zh-CN")
);

export const DEFAULT_RULE_DEFAULTS = {
  fallbackExpenseType: UNCATEGORIZED_EXPENSE_TYPE,
  fallbackIncomeType: UNCATEGORIZED_INCOME_TYPE
};

export const FLOW_KEYWORDS = {
  income: ["收入", "赚", "到账", "发工资", "工资", "奖金", "兼职", "报销", "退款", "收款", "红包", "奖学金"],
  expense: ["支出", "花", "买", "消费", "付款", "付了", "花了", "交了", "充值", "缴费", "扣费", "打车", "吃了"]
};

export const FLOW_TYPE_KEYWORDS = {
  transfer: ["转账", "转入", "转出", "提现", "充值余额", "还信用卡", "卡内互转", "转到"],
  debt_principal: ["还本金", "借款", "借入", "借出", "贷款本金", "垫付", "归还借款"],
  adjustment: ["调账", "冲正", "更正", "结转", "平账", "期初调整", "期末调整", "差错调整"]
};

export const TYPE_KEYWORDS = {
  餐饮: ["早餐", "早饭", "午饭", "晚饭", "夜宵", "包子", "外卖", "奶茶", "咖啡", "小吃", "餐厅", "吃饭"],
  交通: ["地铁", "公交", "打车", "滴滴", "高铁", "火车", "机票", "油费", "停车"],
  日用购物: ["超市", "日用品", "洗发水", "牙膏", "纸巾", "猫粮", "购物", "网购", "淘宝"],
  服饰美妆: ["衣服", "裤子", "鞋", "美妆", "护肤", "口红"],
  通讯网费: ["话费", "流量", "网费", "宽带", "通信"],
  住宿: ["酒店", "民宿", "旅馆", "住宿"],
  房租水电: ["房租", "电费", "水费", "燃气", "物业"],
  公共服务: ["交通卡", "政务", "证件", "行政费"],
  医疗健康: ["医院", "挂号", "药", "体检", "牙科", "医保"],
  学习成长: ["书", "课程", "培训", "学费", "考试", "证书"],
  娱乐休闲: ["电影", "游戏", "KTV", "演出", "娱乐", "健身"],
  人情社交: ["礼物", "礼金", "请客", "聚餐", "随礼"],
  宠物: ["宠物", "猫", "狗", "宠物医院", "宠物用品"],
  旅行度假: ["旅行", "旅游", "景点", "度假"],
  数码家电: ["手机", "电脑", "耳机", "数码", "家电", "维修"],
  保险保障: ["保险", "保费"],
  税费手续费: ["税", "手续费", "服务费"],
  捐赠公益: ["捐赠", "捐款", "公益"],
  其他支出: ["其他支出", "杂项支出"],
  未分类支出: [],
  工资兼职: ["工资", "薪资", "兼职", "劳务", "提成"],
  奖学金补助: ["奖学金", "助学金", "补贴", "补助"],
  投资理财: ["利息", "理财", "基金", "股票", "分红"],
  报销: ["报销"],
  转账退款: ["退款", "退回", "返现", "返还", "转账给我", "收款"],
  二手闲置: ["闲置", "二手", "转卖"],
  奖励红包: ["红包", "奖励", "奖金", "打赏"],
  其他收入: ["其他收入", "杂项收入"],
  未分类收入: []
};

export const DEFAULT_TYPE_PRIORITY = [
  "餐饮",
  "交通",
  "日用购物",
  "工资兼职",
  "转账退款",
  "投资理财",
  "学习成长",
  "医疗健康",
  "房租水电",
  "娱乐休闲",
  "其他支出",
  "其他收入",
  "未分类支出",
  "未分类收入"
];

export function normalizeFlow(flow) {
  return flow === "income" ? "income" : "expense";
}

export function getFallbackCategory(flow) {
  return normalizeFlow(flow) === "income" ? UNCATEGORIZED_INCOME_TYPE : UNCATEGORIZED_EXPENSE_TYPE;
}

export function normalizeCategory(category, flow = "expense") {
  const nextFlow = normalizeFlow(flow);
  const raw = String(category ?? "").trim();
  const meta = CATEGORY_META.get(raw);
  if (meta && meta.flow === nextFlow) {
    return meta.name;
  }
  return getFallbackCategory(nextFlow);
}

export function getCategoryMeta(category, flow = "expense") {
  const normalizedCategory = normalizeCategory(category, flow);
  return CATEGORY_META.get(normalizedCategory);
}

export function getGroupByCategory(category, flow = "expense") {
  const meta = getCategoryMeta(category, flow);
  return meta?.group ?? "未分类";
}

export function isUncategorizedCategory(category) {
  return category === UNCATEGORIZED_EXPENSE_TYPE || category === UNCATEGORIZED_INCOME_TYPE;
}

export function normalizeFlowType(flowType, fallbackFlow = "expense") {
  const raw = String(flowType ?? "").trim();
  if (FLOW_TYPES.includes(raw)) {
    return raw;
  }
  return normalizeFlow(fallbackFlow);
}

export function isCountableFlowType(flowType) {
  const normalized = normalizeFlowType(flowType, "expense");
  return normalized === "expense" || normalized === "income";
}

function keywordScore(text, keywords) {
  return (keywords ?? []).reduce((score, keyword) => {
    if (String(keyword).trim() && text.includes(keyword)) {
      return score + String(keyword).length;
    }
    return score;
  }, 0);
}

export function inferFlowType(text, { flow = "expense", flowTypeKeywords } = {}) {
  const normalizedText = String(text ?? "");
  const candidates = [
    "debt_principal",
    "transfer",
    "adjustment"
  ];
  let bestFlowType = normalizeFlow(flow);
  let bestScore = 0;

  for (const type of candidates) {
    const keywords = flowTypeKeywords?.[type] ?? FLOW_TYPE_KEYWORDS[type];
    const score = keywordScore(normalizedText, keywords);
    if (score > bestScore) {
      bestScore = score;
      bestFlowType = type;
    }
  }

  return bestFlowType;
}

export function buildClassificationFields({
  flow,
  flowType,
  category,
  source = "rule",
  confidence = 0.8,
  needsCategoryReview
}) {
  const normalizedFlow = normalizeFlow(flow);
  const normalizedFlowType = normalizeFlowType(flowType, normalizedFlow);
  const normalizedCategory = normalizeCategory(category, normalizedFlow);
  const group = getGroupByCategory(normalizedCategory, normalizedFlow);
  const shouldReview = needsCategoryReview ?? isUncategorizedCategory(normalizedCategory);
  const clampedConfidence = Math.max(0, Math.min(1, Number(confidence ?? 0.8)));

  return {
    flow: normalizedFlow,
    flowType: normalizedFlowType,
    type: normalizedCategory,
    category: normalizedCategory,
    group,
    categoryVersion: 1,
    categorizationSource: String(source ?? "rule") || "rule",
    categorizationConfidence: Number(clampedConfidence.toFixed(2)),
    needsCategoryReview: Boolean(shouldReview),
    reviewStatus: shouldReview ? "pending" : "resolved"
  };
}
