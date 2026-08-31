import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Participant } from '../types';

export const generateBadgePdf = async (badgeElementId: string, participant: Participant): Promise<Blob> => {
  const element = document.getElementById(badgeElementId);

  if (element) {
    try {
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0c0a09'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a6' // standard badge size ~ 105 x 148 mm
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Center the badge nicely on A6 page
      const margin = 5;
      const printWidth = pdfWidth - margin * 2;
      const printHeight = (canvas.height * printWidth) / canvas.width;

      pdf.setFillColor(15, 23, 42); // dark background
      pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');

      pdf.addImage(imgData, 'PNG', margin, (pdfHeight - printHeight) / 2, printWidth, printHeight);

      // Add footer text in PDF
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(200, 200, 200);
      pdf.text('IndabaX Bénin 2026 • 18-20 Septembre 2026 • Cotonou, Bénin', pdfWidth / 2, pdfHeight - 4, { align: 'center' });

      return pdf.output('blob');
    } catch (err) {
      console.warn('html2canvas failed, falling back to programmatic PDF:', err);
    }
  }

  // Fallback programmatic clean PDF generation
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a6'
  });

  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  // Dark background
  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, width, height, 'F');

  // Amber top header
  doc.setFillColor(217, 119, 6);
  doc.rect(0, 0, width, 18, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('INDABAX BÉNIN 2026', width / 2, 10, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(254, 243, 199);
  doc.text('PASS OFFICIEL DE CONFÉRENCE', width / 2, 15, { align: 'center' });

  // Role tag
  doc.setFillColor(5, 150, 105);
  doc.roundedRect(width / 2 - 20, 23, 40, 8, 2, 2, 'F');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(participant.role.toUpperCase(), width / 2, 28.5, { align: 'center' });

  // Name & Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(participant.name, width / 2, 42, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(251, 191, 36);
  doc.text(participant.position || 'Participant', width / 2, 48, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(209, 213, 219);
  doc.text(participant.institution || 'IndabaX Bénin', width / 2, 53, { align: 'center' });

  // Ticket number
  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(245, 158, 11);
  doc.text(participant.ticketNumber, width / 2, 128, { align: 'center' });

  // Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text('Présentez ce badge à chaque entrée de session.', width / 2, 138, { align: 'center' });
  doc.text('18-20 Septembre 2026 • Cotonou, Bénin', width / 2, 142, { align: 'center' });

  return doc.output('blob');
};

export const downloadBadgePdf = async (badgeElementId: string, participant: Participant) => {
  const blob = await generateBadgePdf(badgeElementId, participant);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = participant.name.replace(/[^a-zA-Z0-9]/g, '_');
  link.href = url;
  link.download = `IndabaX_Benin_2026_Badge_${safeName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
