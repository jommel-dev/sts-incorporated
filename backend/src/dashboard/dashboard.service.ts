import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

type AuditActorContext = {
  userId?: number;
  username?: string;
  roleName?: string;
  branchId?: number;
  ipAddress?: string;
};

type Trend = 'up' | 'down';

type KpiCard = {
  label: string;
  value: string;
  change: string;
  trend: Trend;
};

type OpsLevel = 'normal' | 'warning' | 'critical';

type OpsItem = {
  label: string;
  value: string;
  hint: string;
  level: OpsLevel;
};

type MarginItem = {
  label: string;
  margin: number;
};

type ActivityItem = {
  time: string;
  text: string;
  status: 'received' | 'dispatch' | 'install' | 'payment';
};

type DashboardResponse = {
  success: boolean;
  message?: string;
  item?: {
    generatedAt: string;
    topKpis: KpiCard[];
    operations: OpsItem[];
    salesSummary: KpiCard[];
    topCustomers: Array<{ name: string; orders: number; balance: string }>;
    topCapacities: Array<{ label: string; units: number; sellThrough: number }>;
    marginByBrand: MarginItem[];
    marginByVendor: MarginItem[];
    activityFeed: ActivityItem[];
    todayFocus: string;
  };
};

type DashboardSalesDetailMode = 'sales' | 'unpaid' | 'overdues' | 'cheques';
type DashboardOperationDetailMode = 'receiving' | 'dispatch' | 'installation' | 'stock-alerts';
type DashboardSettlementMode = 'partial' | 'full' | 'cheque' | 'split';
type DashboardReceivableVerificationMode = 'cheque' | 'credit-card';

@Injectable()
export class DashboardService {
  constructor(
    private readonly databaseService: DatabaseService,
  ) {}

  async getPlatformStats(): Promise<{
    success: boolean;
    data?: {
      totalOrgs: number;
      activeOrgs: number;
      totalUsers: number;
      activeUsers: number;
      orgs: Array<{ id: number; name: string; code: string; userCount: number; isActive: boolean }>;
    };
    message?: string;
  }> {
    try {
      const orgsResult = await this.databaseService.query<{
        id: number; name: string; code: string; isActive: boolean; userCount: string;
      }>(
        `SELECT
           o.id,
           o.name,
           o.code,
           o.is_active AS "isActive",
           COUNT(u.id)::text AS "userCount"
         FROM tblorganizations o
         LEFT JOIN tblusers u
           ON u.org_id = o.id
           AND COALESCE(u.is_deleted, false) = false
           AND COALESCE(u.status, 1) != 0
         GROUP BY o.id, o.name, o.code, o.is_active
         ORDER BY o.id ASC`,
      );

      const usersResult = await this.databaseService.query<{ total: string; active: string }>(
        `SELECT
           COUNT(*)::text AS total,
           COUNT(*) FILTER (
             WHERE COALESCE(is_deleted, false) = false AND COALESCE(status, 1) != 0
           )::text AS active
         FROM tblusers`,
      );

      const orgs = orgsResult.rows.map((r) => ({
        id: Number(r.id),
        name: r.name,
        code: r.code,
        isActive: r.isActive,
        userCount: Number(r.userCount),
      }));

      return {
        success: true,
        data: {
          totalOrgs: orgs.length,
          activeOrgs: orgs.filter((o) => o.isActive).length,
          totalUsers: Number(usersResult.rows[0]?.total ?? 0),
          activeUsers: Number(usersResult.rows[0]?.active ?? 0),
          orgs,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load platform stats',
      };
    }
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private formatInteger(value: number): string {
    return Math.round(value).toLocaleString('en-PH');
  }

  private formatCurrency(value: number): string {
    return `PHP ${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
  }

  private formatPercent(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  private formatActivityTime(value: string | null): string {
    if (!value) {
      return '--:--';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return '--:--';
    }

    const hours = String(parsed.getHours()).padStart(2, '0');
    const minutes = String(parsed.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  async getOverview(branchId?: number): Promise<DashboardResponse> {
    return {
      success: true,
      item: {
        generatedAt: new Date().toISOString(),
        topKpis: [],
        operations: [],
        salesSummary: [],
        topCustomers: [],
        topCapacities: [],
        marginByBrand: [],
        marginByVendor: [],
        activityFeed: [],
        todayFocus: 'Dashboard data sources are being migrated',
      },
    };
  }

  async getSalesDetail(mode: DashboardSalesDetailMode, branchId?: number): Promise<{ success: boolean; items: unknown[] }> {
    return { success: true, items: [] };
  }

  async getOperationsDetail(mode: DashboardOperationDetailMode, branchId?: number): Promise<{ success: boolean; items: unknown[] }> {
    return { success: true, items: [] };
  }

  async settleSalesOrder(
    payload: {
      salesOrderId?: number;
      mode?: DashboardSettlementMode;
      amount?: number;
      bankAmount?: number;
      chequeAmount?: number;
      bankName?: string | null;
      checkNo?: string | null;
      postDated?: string | null;
    },
    branchId?: number,
    auditActor?: AuditActorContext,
  ): Promise<{ success: boolean; message: string }> {
    return {
      success: false,
      message: 'Sales settlement is temporarily unavailable during migration',
    };
  }

  async verifySalesReceivable(
    payload: { paymentId?: number; method?: DashboardReceivableVerificationMode },
    branchId?: number,
  ): Promise<{ success: boolean; message: string }> {
    return {
      success: false,
      message: 'Receivable verification is temporarily unavailable during migration',
    };
  }
}
