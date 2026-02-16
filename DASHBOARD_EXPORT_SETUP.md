# Dashboard Export Feature Setup

## 📸 Feature: Export Dashboard as PNG or PDF

Added export functionality to dashboards for creating reports and presentations.

---

## 🚀 Setup Instructions

### 1. Install Required Dependencies

```bash
cd frontend
npm install html2canvas jspdf
```

### 2. Restart Development Server

```bash
npm start
```

---

## ✅ Features

### **Export as PNG 📷**
- High resolution (2x scale for crisp quality)
- Auto-generated filename: `dashboard-name_2026-02-16.png`
- Preserves dark/light mode theme
- Perfect for: Slack, emails, documentation

### **Export as PDF 📄**
- Auto-oriented (landscape/portrait based on dashboard layout)
- Auto-generated filename: `dashboard-name_2026-02-16.pdf`
- Full dashboard capture in single page
- Perfect for: Reports, presentations, printing

---

## 🎯 How It Works

1. **Open any dashboard** (e.g., "University Metrics")
2. **Look for export buttons** in the header (next to Share button)
3. **Click PNG icon** (📷) to download as image
4. **Click PDF icon** (📄) to download as PDF

**Note:** Tile action buttons (•••) are automatically hidden during export for clean captures.

---

## 🛠️ Technical Details

- **Library**: `html2canvas` for screenshot capture
- **Library**: `jsPDF` for PDF generation
- **Quality**: 2x scale (high DPI for retina displays)
- **Background**: Preserves dark/light mode colors
- **Format**: PNG for images, PDF for documents

---

## 🐛 Troubleshooting

### **Export button not working?**
1. Check browser console for errors
2. Ensure dependencies are installed: `npm list html2canvas jspdf`
3. Try refreshing the page

### **Export quality issues?**
- Exports are 2x scale by default
- For higher quality, increase `scale: 3` in code

### **Missing dependencies error?**
```bash
cd frontend
npm install --save html2canvas jspdf
npm start
```

---

## 📝 Files Modified

- `frontend/src/components/Dashboard/Dashboard.js`
  - Added `handleExportPNG()` function
  - Added `handleExportPDF()` function
  - Added export buttons to header
  - Added imports for html2canvas and jsPDF

---

## 🎨 UI Location

Dashboard Header (top right):
```
[Dashboard Title]  [public badge]  [📷 PNG]  [📄 PDF]  [🔗 Share]
```

---

## 🚀 Next Steps

After installing dependencies:
1. Test PNG export on a dashboard with charts
2. Test PDF export on a dashboard with multiple tiles
3. Verify dark mode export works correctly
4. Check filename generation is working

---

**Enjoy exporting beautiful dashboard reports!** 📊
