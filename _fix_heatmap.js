const fs = require('fs');

// Read the current renderer
let r = fs.readFileSync('src/renderer.js', 'utf-8');

// Replace the heatmap generation part
// Find the section between "let gh = '';" and the end of the heatmap generation
const ghStart = r.indexOf("let gh = \"\";");
const kpiEnd = r.indexOf('"<div class=\"usage-kpis\">"');

// Find the actual heatmap code block
const ghCodeStart = r.indexOf("let gh = \"\";", kpiEnd);
// After this, find the usage-header line that closes the heatmap section
const headerStart = r.indexOf('"<div class=\"usage-header\">"', ghCodeStart);

let oldGhCode = r.substring(ghCodeStart, headerStart);

const newGhCode = 
`      // 生成月历热力图（显示近30天）
      let gh = "";
      var today2 = new Date();
      var dayNames = ["日","一","二","三","四","五","六"];
      // 构建 date->data 映射
      var dataMap = {};
      if (s && s.contributions && s.contributions.length > 0) {
        s.contributions.forEach(function(c) { dataMap[c.date] = c; });
      }
      // 统计30天内最大 tokens
      var maxTk = 1;
      for (var d2 = 0; d2 < 30; d2++) {
        var dt = new Date(today2);
        dt.setDate(dt.getDate() - d2);
        var ys = dt.getFullYear();
        var ms = String(dt.getMonth() + 1).padStart(2, "0");
        var ds2 = String(dt.getDate()).padStart(2, "0");
        var ds = ys + "-" + ms + "-" + ds2;
        if (dataMap[ds] && dataMap[ds].totals) {
          var tk = dataMap[ds].totals.tokens || 0;
          if (tk > maxTk) maxTk = tk;
        }
      }
      // 生成网格 - 5行7列(周日开始)
      var startDate = new Date(today2);
      startDate.setDate(startDate.getDate() - 29);
      startDate.setDate(startDate.getDate() - startDate.getDay());
      for (var row = 0; row < 5; row++) {
        gh += "<div class=\\"usage-grid-row\\">";
        for (var col = 0; col < 7; col++) {
          var cellDate = new Date(startDate);
          cellDate.setDate(cellDate.getDate() + row * 7 + col);
          var y = cellDate.getFullYear();
          var m = String(cellDate.getMonth() + 1).padStart(2, "0");
          var dds = String(cellDate.getDate()).padStart(2, "0");
          var dateStr = y + "-" + m + "-" + dds;
          var isInRange = cellDate > new Date(today2.getTime() - 30 * 86400000) && cellDate <= today2;
          var cd = dataMap[dateStr];
          var tk = cd && cd.totals ? (cd.totals.tokens || 0) : 0;
          var lv = isInRange && tk > 0 ? Math.min(4, Math.ceil(tk / (maxTk / 4))) : 0;
          gh += "<div class=\\"usage-grid-cell" + (lv > 0 ? " lv" + lv : "") + (isInRange && tk === 0 ? " empty" : "") + "\\">";
          if (tk > 0) {
            gh += "<div class=\\"usage-grid-tooltip\\">" + dateStr + ": " + fmtTok(tk) + " tok</div>";
          }
          gh += "<span class=\\"usage-grid-date\\">" + cellDate.getDate() + "</span></div>";
        }
        gh += "</div>";
      }
`;

r = r.substring(0, ghCodeStart) + newGhCode + r.substring(headerStart);

fs.writeFileSync('src/renderer.js', r, 'utf-8');
console.log('renderer.js updated');
