/* Printable order receipt. Uses only order data already loaded by the admin. */
(() => {
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
  const amount = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const money = (value) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(amount(value));
  const status = { new: 'Baru', processing: 'Diproses', completed: 'Selesai', cancelled: 'Dibatalkan' };
  const optionOrder = ['temperature', 'size', 'beans', 'milk', 'sugar', 'ice', 'topping', 'addon'];
  const label = (key) => String(key).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (ch) => ch.toUpperCase());
  const quantity = (item) => Math.max(1, amount(item.qty) || 1);
  const itemTotal = (item) => amount(item.price) * quantity(item);

  function buildHtml(order, batches) {
    if (!order || !order.id) throw new Error('Pesanan tidak ditemukan.');
    const groups = Array.isArray(batches) && batches.length ? batches
      : [{ number: 1, items: Array.isArray(order.items) ? order.items : [] }];
    const subtotal = order.subtotal != null ? amount(order.subtotal)
      : groups.reduce((sum, batch) => sum + (batch.sellingTotal != null ? amount(batch.sellingTotal)
        : (batch.items || []).reduce((n, item) => n + itemTotal(item), 0)), 0);
    const fees = amount(order.service_fee) + amount(order.takeaway_plastic_fee);
    const total = order.total != null ? amount(order.total) : subtotal + fees;
    const date = new Date(order.created_at);
    const created = Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta', dateStyle: 'long', timeStyle: 'short',
    }).format(date) + ' WIB';
    const meta = [
      ['Nomor order', order.id], ['Tanggal', created],
      ['Nama pelanggan', order.customer_name || '-'], ['Brand', order.brand || '-'],
      ['Outlet', order.customer_address || '-'], ['Pickup', order.pickup_time || 'Sekarang'],
      ['Plastik take away', amount(order.takeaway_plastic_fee) > 0 ? 'Ya' : 'Tidak'],
      ['Status pesanan', status[order.status] || order.status || '-'],
    ];
    if (order.company_name) meta.splice(3, 0, ['Perusahaan', order.company_name]);
    return `<!doctype html><html lang="id"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <meta name="referrer" content="no-referrer">
      <title>Nota ${escape(order.id)} - kopi.fachrindah</title>
      <style>
        @page { size: A4; margin: 15mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #29221e; background: #eeeae6; font: 12px/1.5 Arial, sans-serif; }
        main { max-width: 790px; margin: 24px auto; padding: 36px; background: white; }
        header { border-bottom: 3px solid #542d1d; padding-bottom: 18px; margin-bottom: 20px; }
        h1 { margin: 0; font-size: 24px; color: #542d1d; } header p { margin: 4px 0 0; }
        .subtitle { font-size: 13px; letter-spacing: 1px; text-transform: uppercase; }
        .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 28px; margin-bottom: 24px; }
        .meta div { min-width: 0; overflow-wrap: anywhere; } .meta span { display: block; color: #73675e; font-size: 11px; }
        .meta strong { font-size: 12px; }
        h2 { font-size: 14px; padding: 8px 10px; background: #f5efea; margin: 20px 0 0; break-after: avoid; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th { color: #73675e; font-weight: normal; text-align: left; border-bottom: 1px solid #b8aea6; padding: 7px 5px; }
        td { padding: 10px 5px; vertical-align: top; border-bottom: 1px solid #e6dfd8; overflow-wrap: anywhere; }
        tr { break-inside: avoid; page-break-inside: avoid; } thead { display: table-header-group; }
        .qty { width: 42px; text-align: center; } .price { width: 95px; text-align: right; white-space: nowrap; }
        .options, .note { color: #62584f; font-size: 10px; margin-top: 4px; }
        .note { white-space: pre-wrap; } .batch-total td { font-weight: bold; padding-bottom: 13px; }
        .totals { width: 300px; max-width: 100%; margin: 24px 0 0 auto; break-inside: avoid; }
        .totals div { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; }
        .grand { border-top: 2px solid #542d1d; color: #542d1d; font-size: 16px; font-weight: bold; margin-top: 6px; }
        footer { margin-top: 28px; border-top: 1px solid #d8cfc7; padding-top: 12px; color: #73675e; font-size: 10px; }
        .toolbar { display: flex; justify-content: center; gap: 12px; padding: 16px; flex-wrap: wrap; }
        button { border: 0; border-radius: 8px; background: #542d1d; color: white; font: bold 14px Arial; padding: 12px 18px; cursor: pointer; }
        .hint { width: 100%; text-align: center; margin: 0; }
        @media (max-width: 600px) { main { margin: 0; padding: 20px 12px; } .meta { grid-template-columns: 1fr; } .price { width: 80px; } }
        @media print { body { background: white; } main { margin: 0; padding: 0; max-width: none; } .toolbar { display: none; } }
      </style></head><body>
      <div class="toolbar"><button type="button" onclick="window.print()">Cetak / Simpan PDF</button>
      <p class="hint">Pilih tujuan <strong>Simpan sebagai PDF</strong> pada dialog cetak.</p></div>
      <main><header><h1>kopi.fachrindah</h1><p class="subtitle">Nota Pesanan</p></header>
      <div class="meta">${meta.map(([key, value]) => `<div><span>${escape(key)}</span><strong>${escape(value)}</strong></div>`).join('')}</div>
      ${groups.map((batch, index) => {
        const items = Array.isArray(batch.items) ? batch.items : [];
        const batchTotal = batch.sellingTotal != null ? amount(batch.sellingTotal) : items.reduce((sum, item) => sum + itemTotal(item), 0);
        return `<section><h2>Batch ${escape(batch.number || index + 1)} dari ${groups.length}</h2>
        <table><thead><tr><th>Menu &amp; pilihan</th><th class="qty">Qty</th><th class="price">Harga satuan</th><th class="price">Jumlah</th></tr></thead><tbody>
        ${items.map((item) => {
          const options = Object.entries(item.options || {}).filter(([, value]) => value)
            .sort(([a], [b]) => (optionOrder.includes(a) ? optionOrder.indexOf(a) : 99) - (optionOrder.includes(b) ? optionOrder.indexOf(b) : 99));
          return `<tr><td><strong>${escape(item.name || '-')}</strong>
            ${options.length ? `<div class="options">${options.map(([key, value]) => `${escape(label(key))}: ${escape(value)}`).join(' / ')}</div>` : ''}
            ${item.note ? `<div class="note">Catatan: ${escape(item.note)}</div>` : ''}</td>
            <td class="qty">${quantity(item)}</td><td class="price">${money(item.price)}</td><td class="price">${money(itemTotal(item))}</td></tr>`;
        }).join('')}
        <tr class="batch-total"><td colspan="3">Total Batch ${escape(batch.number || index + 1)}</td><td class="price">${money(batchTotal)}</td></tr>
        </tbody></table></section>`;
      }).join('')}
      <div class="totals"><div><span>Subtotal menu</span><strong>${money(subtotal)}</strong></div>
      ${amount(order.service_fee) ? `<div><span>Biaya layanan</span><strong>${money(order.service_fee)}</strong></div>` : ''}
      ${amount(order.takeaway_plastic_fee) ? `<div><span>Plastik take away</span><strong>${money(order.takeaway_plastic_fee)}</strong></div>` : ''}
      <div class="grand"><span>Total bayar</span><span>${money(total)}</span></div></div>
      <footer>Terima kasih telah memesan di kopi.fachrindah.<br>Nota ini merinci pesanan dan tidak mengubah status pembayaran.</footer>
      </main></body></html>`;
  }

  function printOrder(order, batches) {
    const html = buildHtml(order, batches);
    // Open synchronously in the click handler so mobile browsers allow the tab.
    const preview = window.open('', '_blank');
    if (!preview) throw new Error('Izinkan pop-up untuk membuka nota, lalu tekan Cetak PDF kembali.');
    preview.opener = null;
    preview.document.open();
    preview.document.write(html);
    preview.document.close();
    preview.focus();
    // Keep the print control visible: on mobile the system dialog may require
    // a direct user tap; the user can print again without recreating the note.
    preview.setTimeout(() => preview.print(), 250);
    return preview;
  }

  window.KopiOrderReceipt = { buildHtml, printOrder };
})();
