interface ShareData {
  workerName: string;
  workTypeName: string;
  hourlyRate: number | null;
  totalHours: number;
  totalMinutes: number;
  totalPayment: number | null;
  entries: Array<{
    date: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    note?: string | null;
  }>;
}

export async function shareWorkLog(data: ShareData, t: (key: string, values?: any) => string) {
  const { workerName, workTypeName, hourlyRate, totalHours, totalMinutes, totalPayment, entries } = data;

  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // 1. Generate text fallback
  let shareText = `${workerName} - ${workTypeName}\n`;
  shareText += `${t('entry.shareGenerated', { date: dateStr })}\n\n`;
  
  entries.forEach((e) => {
    const formattedDate = new Date(e.date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    
    // Format times into 12-hour AM/PM format
    const format12h = (time24: string) => {
      const [h, m] = time24.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 || 12;
      const displayM = m.toString().padStart(2, '0');
      return `${displayH}:${displayM} ${ampm}`;
    };

    const start12 = format12h(e.startTime);
    const end12 = format12h(e.endTime);
    const durationH = Math.floor(e.durationMinutes / 60);
    const durationM = e.durationMinutes % 60;
    
    shareText += `${formattedDate}\n  ${start12} - ${end12} = ${durationH}h ${durationM}m\n`;
    if (e.note) shareText += `  Note: ${e.note}\n`;
  });

  shareText += `\n${t('entry.grandTotal')}: ${totalHours}h ${totalMinutes}m`;
  if (hourlyRate !== null && totalPayment !== null) {
    shareText += `\n${t('worker.hourlyRate')}: ₹${hourlyRate}`;
    shareText += `\n${t('entry.totalPayment')}: ₹${totalPayment}`;
  }

  // 2. Try drawing a canvas to share as image
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context');

    // Design layout sizes
    const width = 600;
    const padding = 40;
    const rowHeight = 40;
    const headerHeight = 120;
    const footerHeight = (hourlyRate !== null) ? 140 : 80;
    
    const height = headerHeight + padding * 2 + entries.length * rowHeight + footerHeight;
    canvas.width = width;
    canvas.height = height;

    // Draw background
    ctx.fillStyle = '#FFF8F0'; // Cream background
    ctx.fillRect(0, 0, width, height);

    // Draw header panel
    ctx.fillStyle = '#1B4332'; // Forest Green
    ctx.fillRect(0, 0, width, headerHeight);

    // Header text
    ctx.fillStyle = '#FFF8F0';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    ctx.font = 'bold 24px var(--font-inter), sans-serif';
    ctx.fillText(`${workerName}`, padding, 40);

    ctx.fillStyle = '#E9A319'; // Warm Amber
    ctx.font = 'bold 20px var(--font-inter), sans-serif';
    ctx.fillText(workTypeName, padding, 75);

    ctx.fillStyle = 'rgba(255,248,240,0.7)';
    ctx.font = '14px var(--font-inter), sans-serif';
    ctx.fillText(t('entry.shareGenerated', { date: dateStr }), padding, 100);

    // Table Content
    let currentY = headerHeight + padding;

    // Table Headers
    ctx.fillStyle = '#4A4A5A';
    ctx.font = 'bold 16px var(--font-inter), sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(t('entry.date'), padding, currentY);
    ctx.fillText('Time Range', padding + 120, currentY);
    ctx.textAlign = 'right';
    ctx.fillText('Hours', width - padding, currentY);

    // Divider line
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padding, currentY + 15);
    ctx.lineTo(width - padding, currentY + 15);
    ctx.stroke();

    currentY += 30;

    // Table Rows
    ctx.fillStyle = '#1A1A2E';
    ctx.font = '16px var(--font-inter), sans-serif';
    
    entries.forEach((e) => {
      ctx.textAlign = 'left';
      const formattedDate = new Date(e.date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      ctx.fillText(formattedDate, padding, currentY);

      // Time conversion
      const format12h = (time24: string) => {
        const [h, m] = time24.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const displayH = h % 12 || 12;
        const displayM = m.toString().padStart(2, '0');
        return `${displayH}:${displayM} ${ampm}`;
      };

      const timesStr = `${format12h(e.startTime)} - ${format12h(e.endTime)}`;
      ctx.fillText(timesStr, padding + 120, currentY);

      // Duration
      ctx.textAlign = 'right';
      const durationH = Math.floor(e.durationMinutes / 60);
      const durationM = e.durationMinutes % 60;
      ctx.fillText(`${durationH}h ${durationM}m`, width - padding, currentY);

      currentY += rowHeight;
    });

    // Footer section
    ctx.strokeStyle = '#1B4332';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(padding, currentY + 10);
    ctx.lineTo(width - padding, currentY + 10);
    ctx.stroke();

    currentY += 40;

    // Totals text
    ctx.fillStyle = '#1B4332';
    ctx.font = 'bold 18px var(--font-inter), sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${t('entry.grandTotal')}:`, padding, currentY);

    ctx.textAlign = 'right';
    ctx.fillText(`${totalHours}h ${totalMinutes}m`, width - padding, currentY);

    if (hourlyRate !== null && totalPayment !== null) {
      currentY += 35;
      ctx.fillStyle = '#4A4A5A';
      ctx.font = '16px var(--font-inter), sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${t('worker.hourlyRate')}:`, padding, currentY);
      ctx.textAlign = 'right';
      ctx.fillText(`₹${hourlyRate}`, width - padding, currentY);

      currentY += 35;
      ctx.fillStyle = '#D4920B'; // Dark Amber
      ctx.font = 'bold 20px var(--font-inter), sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${t('entry.totalPayment')}:`, padding, currentY);
      ctx.textAlign = 'right';
      ctx.fillText(`₹${totalPayment}`, width - padding, currentY);
    }

    // Convert canvas to Blob
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Blob conversion failed');

    const file = new File([blob], `${workerName}_${workTypeName}.png`, { type: 'image/png' });

    // Check if navigator.canShare is available
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: `${workerName} - ${workTypeName}`,
        text: shareText,
        files: [file],
      });
      return;
    }
  } catch (err) {
    console.error('Image share failed, trying text-only share:', err);
  }

  // Text-only Web Share fallback
  if (navigator.share) {
    try {
      await navigator.share({
        title: `${workerName} - ${workTypeName}`,
        text: shareText,
      });
      return;
    } catch (err) {
      console.error('Web Share failed:', err);
    }
  }

  // Desktop/Clipboard / File Download fallback
  try {
    await navigator.clipboard.writeText(shareText);
    alert('Log copied to clipboard! You can paste it into WhatsApp.');
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    // Ultimate fallback: display in prompt
    alert(shareText);
  }
}
