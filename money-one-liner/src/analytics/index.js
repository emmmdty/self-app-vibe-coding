import { isCountableFlowType, normalizeFlowType } from "../domain/categories.js";

function round2(value) {
  return Number(value.toFixed(2));
}

export function computeDashboard(entries) {
  const validEntries = (entries ?? []).filter((entry) => !entry.deletedAt);
  const byType = {};
  const byDate = {};
  const expenseByType = {};
  let incomeTotal = 0;
  let expenseTotal = 0;

  for (const entry of validEntries) {
    const amount = Number(entry.amount ?? 0);
    if (!Number.isFinite(amount) || amount < 0) {
      continue;
    }
    const flowType = normalizeFlowType(entry.flowType, entry.flow);
    if (!isCountableFlowType(flowType)) {
      continue;
    }

    byType[entry.type] = round2((byType[entry.type] ?? 0) + amount);

    if (!byDate[entry.date]) {
      byDate[entry.date] = { date: entry.date, income: 0, expense: 0, net: 0 };
    }

    if (entry.flow === "income") {
      incomeTotal += amount;
      byDate[entry.date].income = round2(byDate[entry.date].income + amount);
    } else {
      expenseTotal += amount;
      byDate[entry.date].expense = round2(byDate[entry.date].expense + amount);
      expenseByType[entry.type] = round2((expenseByType[entry.type] ?? 0) + amount);
    }
  }

  const dailyTrend = Object.values(byDate)
    .map((row) => ({
      ...row,
      net: round2(row.income - row.expense)
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const topExpenseTypes = Object.entries(expenseByType)
    .map(([type, amount]) => ({ type, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  const incomeRounded = round2(incomeTotal);
  const expenseRounded = round2(expenseTotal);

  return {
    incomeTotal: incomeRounded,
    expenseTotal: expenseRounded,
    net: round2(incomeRounded - expenseRounded),
    byType,
    dailyTrend,
    topExpenseTypes
  };
}
