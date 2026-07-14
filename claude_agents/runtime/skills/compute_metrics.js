export function computeMetrics(rows) {
  const totals = rows.reduce(
    (acc, row) => {
      const revenue = Number(row['orders.total_revenue'] ?? row.total_revenue ?? 0);
      const quantity = Number(row['orders.quantity'] ?? row.quantity ?? 0);
      acc.orderCount += 1;
      acc.totalRevenue += revenue;
      acc.totalQuantity += quantity;
      return acc;
    },
    { orderCount: 0, totalRevenue: 0, totalQuantity: 0 }
  );

  return {
    orderCount: totals.orderCount,
    totalRevenue: Number(totals.totalRevenue.toFixed(2)),
    totalQuantity: totals.totalQuantity,
    averageOrderValue: totals.orderCount > 0 ? Number((totals.totalRevenue / totals.orderCount).toFixed(2)) : 0,
  };
}
