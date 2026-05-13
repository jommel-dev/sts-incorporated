import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { ButtonComponent } from '../../shared/components/ui/button/button.component';
import { SignaturePadComponent } from '../../shared/components/form/signature-pad/signature-pad.component';
import { CanDirective } from '../../shared/directives/can.directive';
import { JobOrder, JobOrderPart, JobOrdersService, Technician } from '../../shared/services/job-orders.service';
import { InventoryItem, InventoryService } from '../../shared/services/inventory.service';
import { NotificationService } from '../../shared/services/notification.service';
import { generateJobOrderInvoiceHtml } from './job-order-invoice';

const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  'in-progress':'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  'for-payment':'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400',
  released:    'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400',
  cancelled:   'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400',
};

@Component({
  selector: 'app-job-orders',
  imports: [CommonModule, FormsModule, PageBreadcrumbComponent, ButtonComponent, SignaturePadComponent, CanDirective],
  templateUrl: './job-orders.component.html',
})
export class JobOrdersComponent implements OnInit {
  jobOrders: JobOrder[] = [];
  technicians: Technician[] = [];
  filterStatus = '';
  search = '';
  isLoading = false;
  isDrawerOpen = false;
  isSaving = false;
  editingId: number | null = null;

  // Detail drawer
  isDetailOpen = false;
  detailJO: JobOrder | null = null;
  isLoadingDetail = false;
  showJobDoneModal = false;
  jobDoneRemarks = '';

  // Invoice modal
  showInvoiceModal = false;
  invoiceHtml: SafeHtml = '';

  form = this.emptyForm();

  // Smart search state
  plateSearchText = '';
  plateSearchResults: any[] = [];
  showPlateDropdown = false;
  plateSearchTimer: ReturnType<typeof setTimeout> | null = null;

  // Vehicle history tab (create drawer)
  createDrawerTab: 'form' | 'history' = 'form';
  vehicleHistory: any[] = [];
  isLoadingHistory = false;

  // Detail drawer tab
  detailDrawerTab: 'details' | 'history' = 'details';
  detailVehicleHistory: any[] = [];
  isLoadingDetailHistory = false;

  customerSearchText = '';
  customerSearchResults: any[] = [];
  showCustomerDropdown = false;
  customerSearchTimer: ReturnType<typeof setTimeout> | null = null;

  techSearchText = '';
  techSearchResults: Technician[] = [];
  showTechDropdown = false;
  techSearchTimer: ReturnType<typeof setTimeout> | null = null;

  // Services
  services: Array<{ _uid: number; serviceName: string; description: string; fee: number }> = [];
  private serviceUid = 0;

  // Miscellaneous parts
  miscParts: Array<JobOrderPart & { _uid: number }> = [];
  private partUid = 0;

  // Parts smart search
  partSearchResults: InventoryItem[][] = [];
  showPartDropdown: boolean[] = [];

  readonly statuses = ['pending', 'in-progress', 'for-payment', 'released', 'cancelled'];

  // Computed subtotals
  get servicesSubtotal(): number { return this.services.reduce((sum, s) => sum + (Number(s.fee) || 0), 0); }
  get partsSubtotal(): number { return this.miscParts.reduce((sum, p) => sum + ((Number(p.billingPrice) || 0) * (p.quantity || 1)), 0); }
  get grandTotal(): number { return this.servicesSubtotal + this.partsSubtotal + (Number(this.form.laborFee) || 0) - (Number(this.form.discount) || 0); }

  constructor(
    private readonly svc: JobOrdersService,
    private readonly inventorySvc: InventoryService,
    private readonly notify: NotificationService,
    private readonly sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    void this.load();
    void this.loadTechnicians();
  }

  async load(): Promise<void> {
    this.isLoading = true;
    try {
      const r = await this.svc.getAll(this.filterStatus || undefined, this.search || undefined);
      this.jobOrders = r.data ?? [];
    } catch { this.jobOrders = []; }
    finally { this.isLoading = false; }
  }

  private async loadTechnicians(): Promise<void> {
    try { const r = await this.svc.getTechnicians(); this.technicians = r.data ?? []; }
    catch { this.technicians = []; }
  }

  statusClass(status: string): string {
    return STATUS_COLORS[status] ?? STATUS_COLORS['pending'];
  }

  openCreate(): void {
    this.form = this.emptyForm();
    this.editingId = null;
    this.plateSearchText = '';
    this.customerSearchText = '';
    this.techSearchText = '';
    this.plateSearchResults = [];
    this.customerSearchResults = [];
    this.techSearchResults = [];
    this.services = [this.emptyService()];
    this.miscParts = [this.emptyPart()];
    this.partSearchResults = [[]];
    this.showPartDropdown = [false];
    this.createDrawerTab = 'form';
    this.vehicleHistory = [];
    this.isDrawerOpen = true;
  }

  closeDrawer(): void { if (!this.isSaving) this.isDrawerOpen = false; }

  // ── Plate Number Smart Search ─────────────────────────────────────────

  onPlateInput(): void {
    this.form.vehicleId = null;
    this.form.customerId = null;
    if (this.plateSearchTimer) clearTimeout(this.plateSearchTimer);
    const q = this.plateSearchText.trim();
    if (q.length < 2) { this.plateSearchResults = []; this.showPlateDropdown = false; return; }
    this.plateSearchTimer = setTimeout(() => void this.doPlateSearch(q), 300);
  }

  private async doPlateSearch(q: string): Promise<void> {
    try {
      const r = await this.svc.searchVehicles(q);
      this.plateSearchResults = r.data ?? [];
      this.showPlateDropdown = this.plateSearchResults.length > 0;
    } catch { this.plateSearchResults = []; this.showPlateDropdown = false; }
  }

  selectVehicle(v: any): void {
    this.plateSearchText = v.plateNumber;
    this.form.plateNumber = v.plateNumber;
    this.form.make = v.make ?? '';
    this.form.model = v.model ?? '';
    this.form.yearModel = v.yearModel ?? null;
    this.form.engineType = v.engineType ?? '';
    this.form.fuelType = v.fuelType ?? '';
    this.form.odometerReading = v.odometerReading ?? null;
    this.form.color = v.color ?? '';
    this.form.transmission = v.transmission ?? '';
    this.form.vehicleId = v.id;
    // Auto-fill customer
    if (v.customerId) {
      this.form.customerId = v.customerId;
      this.form.customerName = v.customerName ?? '';
      this.form.contact = v.contact ?? '';
      this.form.email = v.email ?? '';
      this.form.address = v.address ?? '';
      this.customerSearchText = v.customerName ?? '';
    }
    this.showPlateDropdown = false;
    // Load vehicle history
    void this.loadVehicleHistory(v.id);
  }

  private async loadVehicleHistory(vehicleId: number): Promise<void> {
    this.isLoadingHistory = true;
    try {
      const r = await this.svc.getVehicleHistory(vehicleId);
      this.vehicleHistory = r.data ?? [];
    } catch { this.vehicleHistory = []; }
    finally { this.isLoadingHistory = false; }
  }

  hidePlateDropdown(): void { setTimeout(() => { this.showPlateDropdown = false; }, 200); }

  // ── Customer Smart Search ─────────────────────────────────────────────

  onCustomerInput(): void {
    this.form.customerId = null;
    if (this.customerSearchTimer) clearTimeout(this.customerSearchTimer);
    const q = this.customerSearchText.trim();
    if (q.length < 2) { this.customerSearchResults = []; this.showCustomerDropdown = false; return; }
    this.customerSearchTimer = setTimeout(() => void this.doCustomerSearch(q), 300);
  }

  private async doCustomerSearch(q: string): Promise<void> {
    try {
      const r = await this.svc.searchCustomers(q);
      this.customerSearchResults = r.data ?? [];
      this.showCustomerDropdown = this.customerSearchResults.length > 0;
    } catch { this.customerSearchResults = []; this.showCustomerDropdown = false; }
  }

  selectCustomer(c: any): void {
    this.customerSearchText = c.name;
    this.form.customerId = c.id;
    this.form.customerName = c.name;
    this.form.contact = c.contact ?? '';
    this.form.email = c.email ?? '';
    this.form.address = c.address ?? '';
    this.showCustomerDropdown = false;
  }

  hideCustomerDropdown(): void { setTimeout(() => { this.showCustomerDropdown = false; }, 200); }

  // ── Technician Smart Search ───────────────────────────────────────────

  onTechInput(): void {
    this.form.technicianId = null;
    if (this.techSearchTimer) clearTimeout(this.techSearchTimer);
    const q = this.techSearchText.trim();
    if (q.length < 1) { this.techSearchResults = []; this.showTechDropdown = false; return; }
    this.techSearchTimer = setTimeout(() => void this.doTechSearch(q), 300);
  }

  private async doTechSearch(q: string): Promise<void> {
    try {
      const r = await this.svc.searchTechnicians(q);
      this.techSearchResults = r.data ?? [];
      this.showTechDropdown = this.techSearchResults.length > 0;
    } catch { this.techSearchResults = []; this.showTechDropdown = false; }
  }

  selectTech(t: Technician): void {
    this.techSearchText = t.name;
    this.form.technicianId = t.id;
    this.showTechDropdown = false;
  }

  hideTechDropdown(): void { setTimeout(() => { this.showTechDropdown = false; }, 200); }

  // ── Services ───────────────────────────────────────────────────────────

  addService(): void { this.services.push(this.emptyService()); }
  removeService(i: number): void { if (this.services.length > 1) this.services.splice(i, 1); }

  // ── Miscellaneous Parts ───────────────────────────────────────────────

  addPart(): void {
    this.miscParts.push(this.emptyPart());
    this.partSearchResults.push([]);
    this.showPartDropdown.push(false);
  }

  removePart(i: number): void {
    if (this.miscParts.length > 1) {
      this.miscParts.splice(i, 1);
      this.partSearchResults.splice(i, 1);
      this.showPartDropdown.splice(i, 1);
    }
  }

  onPartDescInput(index: number): void {
    this.miscParts[index].inventoryId = null;
    this.miscParts[index].source = 'manual';
    const q = this.miscParts[index].description.trim();
    if (q.length < 2) { this.partSearchResults[index] = []; this.showPartDropdown[index] = false; return; }
    setTimeout(() => void this.doPartSearch(index, q), 300);
  }

  private async doPartSearch(index: number, q: string): Promise<void> {
    try {
      const r = await this.inventorySvc.search(q);
      this.partSearchResults[index] = r.data ?? [];
      this.showPartDropdown[index] = (this.partSearchResults[index]?.length ?? 0) > 0;
    } catch { this.partSearchResults[index] = []; this.showPartDropdown[index] = false; }
  }

  selectPart(index: number, product: InventoryItem): void {
    this.miscParts[index].inventoryId = product.id;
    this.miscParts[index].description = product.partName;
    this.miscParts[index].costPrice = product.costPrice ?? 0;
    this.miscParts[index].billingPrice = product.sellingPrice ?? 0;
    this.miscParts[index].source = 'inventory';
    this.miscParts[index].inventoryName = product.partName;
    this.showPartDropdown[index] = false;
  }

  hidePartDropdown(index: number): void { setTimeout(() => { this.showPartDropdown[index] = false; }, 200); }

  // ── Save ──────────────────────────────────────────────────────────────

  async save(): Promise<void> {
    if (!this.plateSearchText.trim() && !this.form.plateNumber.trim()) {
      this.notify.warning('Required', 'Plate number is required.'); return;
    }
    // Use typed plate text if no vehicle was selected
    if (!this.form.plateNumber) this.form.plateNumber = this.plateSearchText.trim();
    if (!this.form.customerName) this.form.customerName = this.customerSearchText.trim();

    this.isSaving = true;
    try {
      // Auto-create technician if typed but not selected from search
      if (!this.form.technicianId && this.techSearchText.trim()) {
        const tr = await this.svc.createTechnician(this.techSearchText.trim());
        if (tr.success && tr.data) {
          this.form.technicianId = tr.data.id;
        }
      }

      // Build services array (filter out empty rows)
      const servicesList = this.services
        .filter(s => s.serviceName.trim())
        .map(s => ({
          serviceName: s.serviceName,
          description: s.description || undefined,
          fee: Number(s.fee) || 0,
        }));

      // Build parts array (filter out empty rows)
      const parts = this.miscParts
        .filter(p => p.description.trim())
        .map(p => ({
          inventoryId: p.inventoryId ?? null,
          description: p.description,
          quantity: Math.max(1, Math.round(p.quantity)),
          costPrice: Number(p.costPrice) || 0,
          billingPrice: Number(p.billingPrice) || 0,
          source: p.source ?? 'manual',
        }));

      // Set totalAmount to grandTotal
      this.form.totalAmount = this.grandTotal;

      // Determine initial status: signed = in-progress (approved), unsigned = for-approval
      const initialStatus = this.form.customerSignatureData ? 'in-progress' : 'pending';

      const r = await this.svc.create({ ...this.form, services: servicesList, parts, status: initialStatus });
      if (!r.success) { this.notify.error('Failed', r.message ?? 'Operation failed.'); return; }
      const statusMsg = initialStatus === 'in-progress'
        ? 'Job order created and approved (In Progress).'
        : 'Job order created (Pending Approval).';
      this.notify.success('Created', statusMsg);
      this.isDrawerOpen = false;
      await this.load();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      this.notify.error('Error', Array.isArray(msg) ? msg[0] : (msg ?? 'Unexpected error.'));
    }
    finally { this.isSaving = false; }
  }

  // ── Detail ────────────────────────────────────────────────────────────

  async openDetail(jo: JobOrder): Promise<void> {
    this.isDetailOpen = true;
    this.isLoadingDetail = true;
    this.detailDrawerTab = 'details';
    this.detailVehicleHistory = [];
    try {
      const r = await this.svc.getOne(jo.id);
      this.detailJO = r.data ?? null;
    } catch { this.detailJO = jo; }
    finally { this.isLoadingDetail = false; }
  }

  async loadDetailHistory(): Promise<void> {
    if (!this.detailJO) return;
    // We need the vehicle_id — get it from the backend response or use a lookup
    this.isLoadingDetailHistory = true;
    try {
      // Use the plate number to search for the vehicle and get its ID
      const r = await this.svc.searchVehicles(this.detailJO.plateNumber);
      const vehicle = (r.data ?? []).find((v: any) => v.plateNumber === this.detailJO?.plateNumber);
      if (vehicle) {
        const hr = await this.svc.getVehicleHistory(vehicle.id);
        this.detailVehicleHistory = hr.data ?? [];
      }
    } catch { this.detailVehicleHistory = []; }
    finally { this.isLoadingDetailHistory = false; }
  }

  closeDetail(): void { this.isDetailOpen = false; this.detailJO = null; }

  async updateStatus(id: number, status: string): Promise<void> {
    try {
      await this.svc.updateStatus(id, status);
      this.notify.success('Updated', `Status changed to ${status}.`);
      if (this.detailJO?.id === id) {
        const r = await this.svc.getOne(id);
        this.detailJO = r.data ?? this.detailJO;
      }
      await this.load();
    } catch { this.notify.error('Error', 'Failed to update status.'); }
  }

  async confirmJobDone(): Promise<void> {
    if (!this.detailJO) return;
    this.showJobDoneModal = false;
    try {
      await this.svc.updateStatus(this.detailJO.id, 'for-payment', { serviceRemarks: this.jobDoneRemarks.trim() || undefined });
      this.notify.success('Updated', 'Job order moved to For Payment.');
      const r = await this.svc.getOne(this.detailJO.id);
      this.detailJO = r.data ?? this.detailJO;
      await this.load();
    } catch { this.notify.error('Error', 'Failed to update status.'); }
    this.jobDoneRemarks = '';
  }

  printInvoice(): void {
    if (!this.detailJO) return;
    const rawHtml = generateJobOrderInvoiceHtml(this.detailJO);
    this.invoiceHtml = this.sanitizer.bypassSecurityTrustHtml(rawHtml);
    this.showInvoiceModal = true;
  }

  printFromModal(): void {
    const el = document.getElementById('invoice-print-area');
    if (!el) return;
    const content = el.innerHTML;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '1100px';
    iframe.style.height = '800px';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open();
    doc.write(`<html><head><title>Job Order</title><style>@page { margin: 8mm; size: A4 landscape; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }</style></head><body>${content}</body></html>`);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 500);
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private emptyForm() {
    return {
      plateNumber: '', make: '', model: '', yearModel: null as number | null,
      engineType: '', fuelType: '', odometerReading: null as number | null,
      color: '', transmission: '',
      customerName: '', contact: '', email: '', address: '',
      customerId: null as number | null, vehicleId: null as number | null,
      technicianId: null as number | null,
      description: '', laborFee: 0, discount: 0, totalAmount: 0,
      customerSignatureData: null as string | null,
    };
  }

  private emptyPart(): JobOrderPart & { _uid: number } {
    return { _uid: ++this.partUid, description: '', quantity: 1, costPrice: 0, billingPrice: 0, inventoryId: null, source: 'manual' };
  }

  private emptyService() {
    return { _uid: ++this.serviceUid, serviceName: '', description: '', fee: 0 };
  }
}
