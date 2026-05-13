import { JobOrder } from '../../shared/services/job-orders.service';

export function generateJobOrderInvoiceHtml(jo: JobOrder): string {
  const services = (jo.supplies ?? []).filter((s: any) => s.supplyType === 'service' || s.serviceName);
  const parts = (jo.supplies ?? []).filter((s: any) => s.supplyType === 'part' || (!s.serviceName && s.description));

  // Combine services + parts into one list for the table
  const allItems: Array<{ description: string; quantity: number; amount: number }> = [];

  for (const s of services) {
    allItems.push({
      description: (s as any).serviceName || (s as any).description || '',
      quantity: 1,
      amount: Number((s as any).fee) || Number((s as any).billingPrice) || 0,
    });
  }
  for (const p of parts) {
    allItems.push({
      description: (p as any).description || (p as any).inventoryName || '',
      quantity: Number((p as any).quantity) || 1,
      amount: (Number((p as any).billingPrice) || 0) * (Number((p as any).quantity) || 1),
    });
  }

  const itemsTotal = allItems.reduce((sum, item) => sum + item.amount, 0);
  const laborFee = Number(jo.laborFee) || 0;
  const discount = Number(jo.discount) || 0;
  const grandTotal = Number(jo.totalAmount) || (itemsTotal + laborFee - discount);

  const joDate = jo.createdAt ? new Date(jo.createdAt).toLocaleDateString('en-PH', { month: 'numeric', day: 'numeric', year: 'numeric' }) : '';
  const joNumber = jo.joNumber?.replace(/\D/g, '') || jo.joNumber || '';

  // Build rows — pad to at least 10 rows
  const minRows = 10;
  const rowCount = Math.max(allItems.length, minRows);
  let partsRows = '';
  for (let i = 0; i < rowCount; i++) {
    const item = allItems[i];
    partsRows += `<tr style="height:22px;">
      <td class="c-cell">${item ? (i + 1) : ''}</td>
      <td class="c-cell left">${item ? item.description : ''}</td>
      <td class="c-cell center">${item ? item.quantity : ''}</td>
      <td class="c-cell right">${item ? item.amount.toFixed(2) : ''}</td>
    </tr>`;
  }

  return `
<div class="jo-print-receipt">
  <style>
    .jo-print-receipt {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #000;
      width: 100%;
      border: 2px solid #000;
      padding: 0;
      background: #fff;
    }
    .jo-print-receipt * { box-sizing: border-box; margin: 0; padding: 0; }

    /* Header */
    .r-header { text-align: center; padding: 14px 20px 10px; }
    .r-header h1 { font-size: 20px; font-weight: 900; letter-spacing: 0.5px; }
    .r-header .addr { font-size: 11px; font-style: italic; margin-top: 2px; }
    .r-header .phone { font-size: 11px; margin-top: 2px; }

    /* Title bar */
    .r-title-bar {
      background: #1a2e4a;
      color: #fff;
      display: flex;
      align-items: center;
      padding: 6px 20px;
    }
    .r-title-bar h2 { flex: 1; text-align: center; font-size: 16px; font-weight: 800; letter-spacing: 2px; }
    .r-title-bar .r-no { font-size: 14px; font-weight: 800; }

    /* Info section */
    .r-info { display: flex; padding: 10px 20px; border-bottom: 1px solid #ccc; }
    .r-info-left { flex: 1; }
    .r-info-right { flex: 1; }
    .r-info p { font-size: 11px; margin: 2px 0; }
    .r-info strong { font-weight: 700; }

    /* Body: left (table) + right (warranty/sigs) */
    .r-body { display: flex; border-top: 1px solid #000; }
    .r-body-left { flex: 6; border-right: 2px solid #000; }
    .r-body-right { flex: 4; padding: 10px 12px; font-size: 9.5px; }

    /* Parts table header */
    .r-parts-header {
      background: #1a2e4a;
      color: #fff;
      text-align: center;
      padding: 5px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    /* Parts table */
    .r-parts-table { width: 100%; border-collapse: collapse; }
    .r-parts-table th {
      border: 1px solid #000;
      padding: 4px 6px;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      background: #f5f5f5;
      text-align: center;
    }
    .c-cell {
      border: 1px solid #bbb;
      padding: 2px 6px;
      font-size: 10px;
    }
    .c-cell.left { text-align: left; }
    .c-cell.center { text-align: center; }
    .c-cell.right { text-align: right; }

    /* Totals */
    .r-totals { border-top: 2px solid #000; }
    .r-totals table { width: 100%; border-collapse: collapse; }
    .r-totals td {
      border: 1px solid #000;
      padding: 4px 8px;
      font-size: 11px;
    }
    .r-totals .lbl { font-weight: 800; text-transform: uppercase; width: 60%; }
    .r-totals .amt { text-align: right; width: 40%; }

    /* Right panel */
    .r-warranty { border: 1px solid #000; padding: 8px; margin-bottom: 10px; line-height: 1.5; }
    .r-warranty .w-title { font-weight: 800; font-size: 10px; text-transform: uppercase; margin-bottom: 4px; }
    .r-sig-block { margin-top: 10px; }
    .r-sig-block p { margin: 2px 0; line-height: 1.4; }
    .r-sig-block .sig-area {
      border-bottom: 1px solid #000;
      height: 35px;
      margin: 4px 0 2px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }
    .r-sig-block .sig-area img { max-height: 32px; }
    .r-sig-label { text-align: center; font-style: italic; font-size: 9px; font-weight: 600; }
    .r-time { margin-top: 12px; font-size: 9.5px; }
    .r-time p { margin: 2px 0; }
    .r-note { font-size: 8px; font-style: italic; text-align: center; margin-top: 6px; }

    @media print {
      .jo-print-receipt { border: 2px solid #000; }
      @page { margin: 8mm; size: A4 landscape; }
      .r-title-bar, .r-parts-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
    }
    }
  </style>

  <!-- Header -->
  <div class="r-header">
    <h1>CAR EXPERT AUTO CARE CENTER CORP.</h1>
    <p class="addr">PTT Talavera, Brgy. La Torre, Maharlika Highway, Talavera, Nueva Ecija</p>
    <p class="phone">Contact Number: 09178884958</p>
  </div>

  <!-- Title Bar -->
  <div class="r-title-bar">
    <h2>JOB ORDER</h2>
    <span class="r-no">NO.${joNumber}</span>
  </div>

  <!-- Info -->
  <div class="r-info">
    <div class="r-info-left">
      <p><strong>Customer's Name:</strong> ${jo.customerName || ''}</p>
      <p><strong>Address:</strong> ${jo.address || ''}</p>
      <p><strong>Mobile Number:</strong> ${jo.contact || ''}</p>
      <p><strong>Mode of Payment:</strong> Cash</p>
    </div>
    <div class="r-info-right">
      <p><strong>Date:</strong> ${joDate}</p>
      <p><strong>Vehicle Model:</strong> ${jo.make || ''} ${jo.model || ''}</p>
      <p><strong>Plate Number:</strong> ${jo.plateNumber || ''}</p>
      <p><strong>Kilometer Reading:</strong> ${jo.odometerReading || '-'}</p>
    </div>
  </div>

  <!-- Body -->
  <div class="r-body">
    <!-- Left: Parts Table -->
    <div class="r-body-left">
      <div class="r-parts-header">PARTS, TIRES AND SUPPLIES</div>
      <table class="r-parts-table">
        <thead>
          <tr>
            <th style="width:70px;">ITEM CODE</th>
            <th>PARTS DESCRIPTION</th>
            <th style="width:80px;">QUANTITY</th>
            <th style="width:90px;">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          ${partsRows}
        </tbody>
      </table>

      <!-- Totals -->
      <div class="r-totals">
        <table>
          <tr><td class="lbl">TOTAL</td><td class="amt">${itemsTotal.toFixed(2)}</td></tr>
          <tr><td class="lbl">LABOR</td><td class="amt">${laborFee.toFixed(2)}</td></tr>
          <tr><td class="lbl">GRAND TOTAL</td><td class="amt" style="font-weight:900;">${grandTotal.toFixed(2)}</td></tr>
          <tr><td class="lbl">REMARKS</td><td class="amt" style="text-align:left;font-weight:normal;">${jo.description || ''}</td></tr>
        </table>
      </div>
    </div>

    <!-- Right: Warranty + Signatures -->
    <div class="r-body-right">
      <div class="r-warranty">
        <p class="w-title">WARRANTY</p>
        <p>15 days or 500km (whichever comes first). No warranty will be given for parts supplied by customer.</p>
        <p style="margin-top:6px;"><strong>PARTS SUPPLIED BY:</strong></p>
        <p>(X) CAR EXPERT</p>
        <p>( ) CUSTOMER</p>
      </div>

      <div class="r-sig-block">
        <p>I authorized and agree to pay for repair and work to be done on my vehicle including all parts and materials necessary to perform them.</p>
        <p class="r-sig-label">Customer's Signature</p>
        <div class="sig-area">
          ${jo.customerSignatureData ? `<img src="${jo.customerSignatureData}" />` : ''}
        </div>
      </div>

      <div class="r-time">
        <p><strong>TIME IN:</strong> ___________&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>TIME OUT:</strong> ___________</p>
        <p><strong>RELEASED BY:</strong> - ( ) DCT</p>
      </div>

      <p class="r-note">NOTE: This job is based on our inspection but does not include defects not evident at the time of our inspection.</p>

      <div class="r-sig-block">
        <p class="r-sig-label">Mechanic Signature</p>
        <div class="sig-area"></div>
      </div>

      <div class="r-sig-block" style="margin-top:8px;">
        <p>I hereby received above vehicle in good order and condition. I hereby certify that the repairs have been made to my entire satisfaction.</p>
        <p class="r-sig-label">Customer's Signature</p>
        <div class="sig-area">
          ${jo.customerSignatureData ? `<img src="${jo.customerSignatureData}" />` : ''}
        </div>
      </div>
    </div>
  </div>
</div>`;
}
