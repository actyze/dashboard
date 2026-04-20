import { useState, useCallback } from 'react';
import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Hook for exporting dashboard and tiles as PNG/PDF
 */
export const useDashboardExport = (isDark) => {
  const [isExportingDashboard, setIsExportingDashboard] = useState(false);
  const [exportingTileId, setExportingTileId] = useState(null);

  const backgroundColor = isDark ? '#1c1d1f' : '#ffffff';
  const dashboardBgColor = isDark ? '#101012' : '#ffffff';

  /**
   * Export a single tile as PNG using html-to-image
   */
  const exportTileAsPNG = useCallback(async (tileId, tileTitle, containerRef) => {
    if (!containerRef?.current) return;

    setExportingTileId(tileId);

    try {
      const tileCard = containerRef.current.querySelector(`[data-tile-id="${tileId}"]`);
      if (!tileCard) {
        throw new Error('Tile element not found');
      }

      // Hide action buttons temporarily
      const buttons = tileCard.querySelectorAll('.MuiIconButton-root');
      buttons.forEach(btn => btn.style.visibility = 'hidden');

      // Small delay for DOM update
      await new Promise(resolve => setTimeout(resolve, 50));

      // Use html-to-image for capture
      const dataUrl = await toPng(tileCard, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor,
        filter: (node) => {
          if (node.tagName === 'LINK' && node.rel === 'stylesheet' && node.href && !node.href.startsWith(window.location.origin)) {
            return false;
          }
          return true;
        },
      });

      // Restore buttons
      buttons.forEach(btn => btn.style.visibility = '');

      // Download
      const link = document.createElement('a');
      link.download = `${tileTitle || 'tile'}_${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();

    } catch (error) {
      console.error('Error exporting tile as PNG:', error);
      alert('Failed to export tile as PNG');
    } finally {
      setExportingTileId(null);
    }
  }, [backgroundColor]);

  /**
   * Export entire dashboard as multi-page PDF
   * Uses html-to-image for accurate capture
   */
  const exportDashboardAsPDF = useCallback(async (dashboardTitle, containerRef) => {
    if (!containerRef?.current) return;

    setIsExportingDashboard(true);

    try {
      const dashboardElement = containerRef.current;

      // Store elements we'll modify
      const elementsToRestore = [];

      // Hide action buttons
      const buttons = dashboardElement.querySelectorAll('.MuiIconButton-root');
      buttons.forEach(btn => {
        elementsToRestore.push({ el: btn, style: 'visibility', value: btn.style.visibility });
        btn.style.visibility = 'hidden';
      });

      // Remove overflow-hidden from all elements
      const allElements = [dashboardElement, ...dashboardElement.querySelectorAll('*')];
      allElements.forEach(el => {
        if (el.classList?.contains('overflow-hidden')) {
          elementsToRestore.push({ el, class: 'overflow-hidden' });
          el.classList.remove('overflow-hidden');
        }
        if (el.classList?.contains('overflow-auto')) {
          elementsToRestore.push({ el, class: 'overflow-auto' });
          el.classList.remove('overflow-auto');
        }
      });

      // Wait for DOM update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Use html-to-image for capture
      // skipAutoScale avoids re-fetching external CSS (Inter font) which causes
      // non-fatal insertRule errors for @font-feature-values rules.
      const dataUrl = await toPng(dashboardElement, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: dashboardBgColor,
        fetchRequestInit: { mode: 'no-cors' },
        filter: (node) => {
          // Skip external link[rel=stylesheet] elements to avoid CSS parse errors
          if (node.tagName === 'LINK' && node.rel === 'stylesheet' && node.href && !node.href.startsWith(window.location.origin)) {
            return false;
          }
          return true;
        },
      });

      // Restore everything
      elementsToRestore.forEach(item => {
        if (item.class) {
          item.el.classList.add(item.class);
        } else if (item.style) {
          item.el.style[item.style] = item.value;
        }
      });

      // Convert data URL to image for PDF
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataUrl;
      });

      const imgWidth = img.width;
      const imgHeight = img.height;

      // A4 dimensions in points
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 20;

      const contentWidth = pageWidth - margin * 2;
      const scaleFactor = contentWidth / imgWidth;
      const scaledHeight = imgHeight * scaleFactor;
      const availableHeight = pageHeight - margin * 2;

      const totalPages = Math.ceil(scaledHeight / availableHeight);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      // Create a canvas to slice the image
      const canvas = document.createElement('canvas');
      canvas.width = imgWidth;
      canvas.height = imgHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();

        const sourceY = (page * availableHeight) / scaleFactor;
        const sourceHeight = Math.min(availableHeight / scaleFactor, imgHeight - sourceY);
        const destHeight = sourceHeight * scaleFactor;

        // Create page canvas
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgWidth;
        pageCanvas.height = sourceHeight;
        const pageCtx = pageCanvas.getContext('2d');

        pageCtx.drawImage(canvas, 0, sourceY, imgWidth, sourceHeight, 0, 0, imgWidth, sourceHeight);

        const pageImgData = pageCanvas.toDataURL('image/png');
        pdf.addImage(pageImgData, 'PNG', margin, margin, contentWidth, destHeight);
      }

      const filename = `${dashboardTitle || 'dashboard'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);

    } catch (error) {
      console.error('Error exporting dashboard as PDF:', error);
      alert('Failed to export dashboard as PDF');
    } finally {
      setIsExportingDashboard(false);
    }
  }, [dashboardBgColor]);

  return {
    isExportingDashboard,
    exportingTileId,
    exportTileAsPNG,
    exportDashboardAsPDF,
  };
};

export default useDashboardExport;
