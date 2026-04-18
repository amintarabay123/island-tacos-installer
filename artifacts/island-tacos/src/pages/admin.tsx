import { useState } from "react";
import { Link } from "wouter";
import { useGetAdminStats, useGetRecentOrders, useUpdateOrderStatus, getGetAdminStatsQueryKey, getGetRecentOrdersQueryKey, type UpdateOrderStatusBodyStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ShoppingBag, DollarSign, Clock, CheckCircle2, TrendingUp, Settings } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-orange-100 text-orange-800",
  ready: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
};

const NEXT_STATUS: Record<string, UpdateOrderStatusBodyStatus> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "completed",
};

export default function Admin() {
  const queryClient = useQueryClient();
  const { data: stats } = useGetAdminStats();
  const { data: orders, isLoading } = useGetRecentOrders({ limit: 50 });
  const updateStatus = useUpdateOrderStatus();

  const handleStatusChange = (orderId: number, status: UpdateOrderStatusBodyStatus) => {
    updateStatus.mutate(
      { id: orderId, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentOrdersQueryKey() });
        },
      }
    );
  };

  const activeOrders = orders?.filter((o) =>
    ["pending", "confirmed", "preparing", "ready"].includes(o.status)
  ) ?? [];
  const pastOrders = orders?.filter((o) =>
    ["completed", "cancelled"].includes(o.status)
  ) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black text-primary">ISLAND TACOS</span>
            <span className="text-muted-foreground">— Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/menu">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Menu Manager
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm">View Store</Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Today's Orders", value: stats?.todayOrders ?? 0, icon: ShoppingBag, color: "text-blue-600" },
            { label: "Today's Revenue", value: `$${(stats?.todayRevenue ?? 0).toFixed(2)}`, icon: DollarSign, color: "text-green-600" },
            { label: "Pending Orders", value: stats?.pendingOrders ?? 0, icon: Clock, color: "text-orange-600" },
            { label: "Completed", value: stats?.completedOrders ?? 0, icon: CheckCircle2, color: "text-gray-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border bg-card p-4 flex items-center gap-4">
              <div className={`rounded-lg bg-muted p-2 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="text-2xl font-black">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {stats?.popularItems && stats.popularItems.length > 0 && (
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-lg">Top Items Today</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.popularItems.map((item) => (
                <div key={item.name} className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1">
                  <span className="font-medium text-sm">{item.name}</span>
                  <span className="text-primary font-bold text-sm">x{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active orders */}
        <section>
          <h2 className="text-2xl font-black mb-4">
            Active Orders
            {activeOrders.length > 0 && (
              <span className="ml-2 text-base font-normal text-muted-foreground">({activeOrders.length})</span>
            )}
          </h2>

          {isLoading ? (
            <p className="text-muted-foreground">Loading orders...</p>
          ) : activeOrders.length === 0 ? (
            <div className="rounded-xl border bg-muted/30 p-8 text-center text-muted-foreground">
              No active orders right now.
            </div>
          ) : (
            <div className="space-y-4">
              {activeOrders.map((order) => (
                <div key={order.id} className="rounded-xl border bg-card p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-black text-lg text-primary">{order.confirmationCode}</span>
                        <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${STATUS_COLORS[order.status]}`}>
                          {STATUS_LABELS[order.status]}
                        </span>
                        <span className="text-xs bg-muted rounded-full px-2 py-0.5 capitalize">{order.orderType}</span>
                      </div>
                      <p className="font-medium">{order.customerName}</p>
                      <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-black">${order.total.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>

                  <div className="text-sm space-y-1">
                    {order.items?.map((item) => (
                      <div key={item.id} className="flex gap-2 text-muted-foreground">
                        <span className="font-medium text-foreground">{item.quantity}x</span>
                        <span>{item.menuItemName}</span>
                        {item.notes && <span className="italic">— {item.notes}</span>}
                      </div>
                    ))}
                    {order.notes && (
                      <p className="text-muted-foreground italic mt-1">Note: {order.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    {NEXT_STATUS[order.status] && (
                      <Button
                        size="sm"
                        onClick={() => handleStatusChange(order.id, NEXT_STATUS[order.status])}
                        disabled={updateStatus.isPending}
                      >
                        Mark as {STATUS_LABELS[NEXT_STATUS[order.status]]}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleStatusChange(order.id, "cancelled")}
                      disabled={updateStatus.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Past orders */}
        {pastOrders.length > 0 && (
          <section>
            <h2 className="text-2xl font-black mb-4">Recent History</h2>
            <div className="rounded-xl border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left p-3 font-semibold">Code</th>
                    <th className="text-left p-3 font-semibold">Customer</th>
                    <th className="text-left p-3 font-semibold hidden md:table-cell">Items</th>
                    <th className="text-right p-3 font-semibold">Total</th>
                    <th className="text-left p-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pastOrders.slice(0, 20).map((order, idx) => (
                    <tr key={order.id} className={idx % 2 === 0 ? "" : "bg-muted/20"}>
                      <td className="p-3 font-mono font-bold text-primary">{order.confirmationCode}</td>
                      <td className="p-3">
                        <div>{order.customerName}</div>
                        <div className="text-muted-foreground text-xs">{new Date(order.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                      </td>
                      <td className="p-3 hidden md:table-cell text-muted-foreground">
                        {order.items?.map((i) => `${i.quantity}x ${i.menuItemName}`).join(", ")}
                      </td>
                      <td className="p-3 text-right font-bold">${order.total.toFixed(2)}</td>
                      <td className="p-3">
                        <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${STATUS_COLORS[order.status]}`}>
                          {STATUS_LABELS[order.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
