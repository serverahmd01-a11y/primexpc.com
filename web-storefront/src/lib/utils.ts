import type { Product } from '@/types';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/api\/?$/, '');

export function getImageUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_BASE}${path}`;
}

export const formatINR = (n: number) =>
  '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export const formatOrderNo = (n: unknown) =>
  n ? String(n).padStart(4, '0') : '';

export const safeTrackingUrl = (u: unknown) => {
  const s = typeof u === 'string' ? u.trim() : '';
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) return `https://${s}`;
  return s;
};

export const parsePrice = (s: string) => Number(s.replace(/[^\d.]/g, '')) || 0;

export function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export function escapeHtml(str: unknown): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const numberToWords = (num: number): string => {
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const numToWords = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '');
    if (n < 100000) return numToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
    if (n < 10000000) return numToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numToWords(n % 100000) : '');
    return numToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numToWords(n % 10000000) : '');
  };
  return numToWords(Math.round(num));
};

export type InvoiceItem = { name: string; price: number; quantity: number; gstRate?: number };

export type InvoiceData = {
  orderId: string;
  date?: string;
  items: InvoiceItem[];
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  storeName?: string;
  storeAddress?: string;
  storeCity?: string;
  storeState?: string;
  storePincode?: string;
  storePhone?: string;
  storeEmail?: string;
  storeGstin?: string;
};

export function generateInvoice(data: InvoiceData, existingWindow?: Window | null) {
  const date = data.date || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const orderIdShort = String(data.orderId).slice(-16).toUpperCase();
  const hsn = '84733099';
  const companyName = escapeHtml(data.storeName || 'PrimeX Technologies LLP');
  const gstin = escapeHtml(data.storeGstin || '24ABCFP8750F1Z8');
  const pan = (data.storeGstin || '24ABCFP8750F1Z8').slice(2, 12);
  const storeAddr = escapeHtml(data.storeAddress || '1218, PrimeX Tech Park, SG Highway');
  const storeCity = escapeHtml(data.storeCity || 'Ahmedabad');
  const storeState = escapeHtml(data.storeState || 'GUJARAT');
  const storePin = escapeHtml(data.storePincode || '380054');
  const storePhone = escapeHtml(data.storePhone || '90992 55663');
  const storeEmail = escapeHtml(data.storeEmail || 'info@primexpc.com');

  // Calculate per-item GST breakdown (back-calculated from GST-inclusive price)
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalAmount = 0;

  const itemRows = data.items.map((item, idx) => {
    const sellingPrice = item.price;
    const gstRate = item.gstRate || 18;
    const total = sellingPrice * item.quantity;
    const taxable = Math.round(total / (1 + gstRate / 100));
    const gst = total - taxable;
    const cgst = Math.round(gst / 2);
    const sgst = gst - cgst;

    totalTaxable += taxable;
    totalCgst += cgst;
    totalSgst += sgst;
    totalAmount += total;

    return `
      <tr>
        <td data-label="#">${idx + 1}</td>
        <td data-label="Item">${escapeHtml(item.name)}<br><span class="hsn">HSN: ${hsn} | GST: ${gstRate}%</span></td>
        <td data-label="Rate / Item" class="right">${fmt(sellingPrice)}</td>
        <td data-label="Qty" class="right">${item.quantity}</td>
        <td data-label="Taxable Value" class="right">${fmt(taxable)}</td>
        <td data-label="Tax Amount" class="right">${fmt(gst)} (${gstRate}%)</td>
        <td data-label="Amount" class="right">${fmt(total)}</td>
      </tr>`;
  }).join('');

  const totalGst = totalCgst + totalSgst;
  const words = numberToWords(totalAmount);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tax Invoice - ${orderIdShort}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; background: #fff; }
  .page { max-width: 750px; margin: 0 auto; padding: 20px; border: 1px solid #ccc; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
  .tax-invoice-label { color: #1a6eb5; font-weight: bold; font-size: 13px; letter-spacing: 1px; margin-bottom: 3px; }
  .company-name { font-size: 22px; font-weight: 900; margin-bottom: 2px; }
  .gstin-pan { font-size: 11px; font-weight: bold; margin-bottom: 4px; }
  .address { font-size: 11px; line-height: 1.5; color: #333; }
  .header-right { text-align: right; }
  .original-label { font-size: 10px; font-weight: bold; letter-spacing: 0.5px; margin-bottom: 6px; }
  .logo-box { border-radius: 10px; display: inline-block; text-align: center; }
  .logo-box img { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; }
  .logo-box .logo-sub { font-size: 9px; color: #555; letter-spacing: 1px; margin-top: 3px; }
  hr.divider { border: none; border-top: 2px solid #1a6eb5; margin: 8px 0; }
  hr.thin { border: none; border-top: 1px solid #ccc; margin: 6px 0; }
  .invoice-meta { display: flex; gap: 30px; margin-bottom: 8px; font-size: 12px; }
  .invoice-meta span { font-weight: bold; }
  .customer-row { display: flex; gap: 40px; margin-bottom: 8px; }
  .customer-block, .billing-block { font-size: 11px; line-height: 1.6; }
  .block-label { font-weight: bold; font-size: 11px; margin-bottom: 2px; }
  .customer-block .name { font-weight: bold; font-size: 12px; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
  table.items th { background: #1a6eb5; color: white; text-align: left; padding: 5px 7px; font-size: 11px; }
  table.items th.right, table.items td.right { text-align: right; }
  table.items td { padding: 5px 7px; font-size: 11px; border-bottom: 1px solid #eee; }
  table.items .hsn { font-size: 10px; color: #555; }
  table.items tr:nth-child(even) td { background: #f9f9f9; }
  .totals-row { display: flex; justify-content: flex-end; margin-bottom: 5px; }
  .totals-box { font-size: 11px; width: 260px; }
  .totals-box .trow { display: flex; justify-content: space-between; padding: 2px 7px; }
  .totals-box .trow.total-final { font-size: 14px; font-weight: 900; border-top: 2px solid #111; padding-top: 4px; margin-top: 2px; }
  .footer-info { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 6px; }
  table.hsn-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px; }
  table.hsn-table th, table.hsn-table td { border: 1px solid #bbb; padding: 4px 6px; text-align: center; }
  table.hsn-table th { background: #eaf1fb; font-weight: bold; }
  table.hsn-table td:first-child { text-align: left; }
  table.hsn-table tr:last-child td { font-weight: bold; }
  .amount-payable { text-align: right; font-size: 13px; font-weight: bold; margin-bottom: 12px; }
  .sig-section { text-align: right; margin-bottom: 10px; font-size: 11px; }
  .sig-section .for-company { margin-bottom: 25px; }
  .terms { font-size: 10px; line-height: 1.6; color: #333; }
  .terms .terms-title { font-weight: bold; margin-bottom: 3px; }
  .terms ol { padding-left: 16px; }
  .declaration { font-size: 10px; color: #333; margin-top: 6px; margin-bottom: 8px; }
  .footer-link { font-size: 10px; color: #1a6eb5; text-decoration: underline; }
  .footer-bottom { font-size: 10px; font-weight: bold; margin-top: 2px; }
  .hsn-scroll { width: 100%; overflow-x: auto; }
  @media screen and (max-width: 600px) {
    body { font-size: 11px; }
    .page { width: 100%; max-width: 100%; padding: 12px; border: none; }
    .header { flex-direction: column; gap: 10px; }
    .header-right { width: 100%; display: flex; align-items: center; gap: 12px; text-align: left; }
    .invoice-meta { flex-wrap: wrap; gap: 6px 16px; }
    .customer-row { flex-direction: column; gap: 10px; }
    table.items, table.items thead, table.items tbody, table.items tr, table.items td { display: block; width: 100%; }
    table.items thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    table.items tr { margin-bottom: 8px; padding: 6px; border: 1px solid #ddd; border-radius: 6px; }
    table.items td { display: flex; justify-content: space-between; gap: 12px; padding: 4px 2px; border: none; text-align: right !important; white-space: normal; }
    table.items td::before { content: attr(data-label); flex: 0 0 auto; font-weight: bold; color: #555; text-align: left; }
    table.items td:nth-child(2) { display: block; text-align: left !important; }
    table.items td:nth-child(2)::before { display: block; margin-bottom: 2px; }
    .totals-row { justify-content: stretch; }
    .totals-box { width: 100%; }
    .footer-info { flex-direction: column; gap: 4px; }
    .amount-payable { text-align: left; }
    table.hsn-table { min-width: 650px; }
  }
  @media print {
    @page { size: A4; margin: 8mm; }
    .page { max-width: none; border: none; padding: 0; }
  }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="header-left">
      <div class="tax-invoice-label">TAX INVOICE</div>
      <div class="company-name">${companyName}</div>
      <div class="gstin-pan">GSTIN: ${gstin} &nbsp; PAN: ${pan}</div>
      <div class="address">
        ${storeAddr}<br>
        ${storeCity}, ${storeState}, ${storePin}<br>
        <strong>Mobile:</strong> +91 ${storePhone} &nbsp; <strong>Email:</strong> ${storeEmail}
      </div>
    </div>
    <div class="header-right">
      <div class="original-label">ORIGINAL FOR RECIPIENT</div>
      <div class="logo-box">
        <img src="${window.location.origin}/primex-logo.jpeg" alt="PrimeX" />
        <div class="logo-sub">PrimeX</div>
      </div>
    </div>
  </div>

  <hr class="divider">

  <div class="invoice-meta">
    <div>Invoice #: <span>${orderIdShort}</span></div>
    <div>Invoice Date: <span>${date}</span></div>
    <div>Due Date: <span>${date}</span></div>
  </div>

  <hr class="thin">

  <div class="customer-row">
    <div class="customer-block">
      <div class="block-label">Customer Details:</div>
      <div class="name">${escapeHtml(data.customerName || 'Customer')}</div>
      ${data.customerPhone ? '<div>Ph: ' + escapeHtml(data.customerPhone) + '</div>' : ''}
    </div>
    <div class="billing-block">
      <div class="block-label">Billing Address:</div>
      ${data.customerAddress ? '<div>' + escapeHtml(data.customerAddress).replace(/\n/g, '<br>') + '</div>' : ''}
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th>#</th>
        <th>Item</th>
        <th class="right">Rate / Item</th>
        <th class="right">Qty</th>
        <th class="right">Taxable Value</th>
        <th class="right">Tax Amount</th>
        <th class="right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="totals-row">
    <div class="totals-box">
      <div class="trow"><span>Taxable Amount</span><span>₹${fmt(totalTaxable)}</span></div>
      <div class="trow"><span>CGST</span><span>₹${fmt(totalCgst)}</span></div>
      <div class="trow"><span>SGST</span><span>₹${fmt(totalSgst)}</span></div>
      <div class="trow total-final"><span>Total</span><span>₹${fmt(totalAmount)}</span></div>
    </div>
  </div>

  <div class="footer-info">
    <div>Total Items / Qty : ${data.items.length} / ${data.items.reduce((s, i) => s + i.quantity, 0)}</div>
    <div>Total amount (in words): INR ${words} Only.</div>
  </div>

  <hr class="thin">

  <div class="hsn-scroll">
  <table class="hsn-table">
    <thead>
      <tr>
        <th rowspan="2">HSN/SAC</th>
        <th rowspan="2">Taxable Value</th>
        <th colspan="2">Central Tax</th>
        <th colspan="2">State/UT Tax</th>
        <th rowspan="2">Total Tax Amount</th>
      </tr>
      <tr>
        <th>Rate</th>
        <th>Amount</th>
        <th>Rate</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${hsn}</td>
        <td>₹${fmt(totalTaxable)}</td>
        <td>${Math.round(totalTaxable > 0 ? totalCgst / totalTaxable * 100 : 0)}%</td>
        <td>₹${fmt(totalCgst)}</td>
        <td>${Math.round(totalTaxable > 0 ? totalSgst / totalTaxable * 100 : 0)}%</td>
        <td>₹${fmt(totalSgst)}</td>
        <td>₹${fmt(totalGst)}</td>
      </tr>
      <tr>
        <td style="text-align:right">TOTAL</td>
        <td>₹${fmt(totalTaxable)}</td>
        <td></td>
        <td>₹${fmt(totalCgst)}</td>
        <td></td>
        <td>₹${fmt(totalSgst)}</td>
        <td>₹${fmt(totalGst)}</td>
      </tr>
    </tbody>
  </table>
  </div>

  <div class="amount-payable">Amount Payable: &nbsp; ₹${fmt(totalAmount)}</div>

  <div class="sig-section">
    <div class="for-company">For ${companyName}</div>
    <div>Authorized Signatory</div>
  </div>

  <hr class="thin">

  <div class="terms">
    <div class="terms-title">Terms and Conditions:</div>
    <p>Thanks for doing business with us! We cannot spell success without 'U'</p>
    <br>
    <ol>
      <li>All Disputes are Subject to Ahmedabad Jurisdiction Only.</li>
      <li>Any complaint regarding this invoice to be made within 7 days.</li>
      <li>Goods once sold will not be taken back.</li>
      <li>No warranty for physically damaged goods.</li>
      <li>Interest @ 18% will be applicable post 14 days from the due date of the invoice.</li>
    </ol>
  </div>

  <div class="declaration">
    Declaration: We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.
  </div>

  <div><a class="footer-link" href="https://primexpc.com">${companyName}  |  High Performance Computing  |  primexpc.com</a></div>
  <div class="footer-bottom">Page 1 / 1 &nbsp;&bull;&nbsp; This is a computer-generated document.</div>

</div>
<button onclick="window.print()" style="display:block;margin:16px auto;padding:10px 32px;background:#1a6eb5;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:bold;cursor:pointer">Print Invoice</button>
</body>
</html>`;

  const w = existingWindow || window.open('', '_blank', 'width=800,height=900');
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

export function downloadInvoice(data: InvoiceData) {
  const w = window.open('', '_blank', 'width=800,height=900');
  setTimeout(async () => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/settings/public/store-info`);
      if (resp.ok) {
        const store = await resp.json();
        generateInvoice({
          ...data,
          storeName: store.store_name,
          storeAddress: store.store_address,
          storeCity: store.store_city,
          storeState: store.store_state,
          storePincode: store.store_pincode,
          storePhone: store.store_phone,
          storeEmail: store.store_email,
          storeGstin: store.store_gstin,
        }, w);
        return;
      }
    } catch { /* fall back to defaults */ }
    generateInvoice(data, w);
  }, 100);
}
