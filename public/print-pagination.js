/* ГРОТ: постраничное сохранение графика в PDF, A4 альбомная. */
(function () {
  async function ensurePdfLibraries() {
    if (typeof window.html2canvas !== 'function') throw new Error('Не загружена библиотека html2canvas.');
    if (!window.jspdf || typeof window.jspdf.jsPDF !== 'function') throw new Error('Не загружена библиотека jsPDF.');
  }

  function getGroups(tbody) {
    const rows = Array.from(tbody.rows);
    const groups = [];
    let group = [];
    rows.forEach(row => {
      if (row.classList.contains('leave-print-first') && group.length) {
        groups.push(group);
        group = [];
      }
      group.push(row);
      if (row.classList.contains('leave-print-last')) {
        groups.push(group);
        group = [];
      }
    });
    if (group.length) groups.push(group);
    return groups;
  }

  function newSheet(templateTable, parent) {
    const sheet = document.createElement('section');
    sheet.className = 'grot-pdf-sheet';
    sheet.style.cssText = 'width:277mm;background:white;color:#111;box-sizing:border-box;padding:0;margin:0;';
    const table = templateTable.cloneNode(false);
    table.style.width = '100%';
    const colgroup = templateTable.querySelector('colgroup');
    if (colgroup) table.appendChild(colgroup.cloneNode(true));
    table.appendChild(templateTable.tHead.cloneNode(true));
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    sheet.appendChild(table);
    parent.appendChild(sheet);
    return { sheet, table, tbody };
  }

  window.saveVacationPdf = async function () {
    const button = document.getElementById('save-pdf');
    if (!button || button.disabled) return;
    button.disabled = true;
    button.textContent = 'Сохраняем PDF…';
    let stage;
    try {
      await ensurePdfLibraries();
      const source = document.querySelector('#pdf-content table');
      if (!source || !source.tHead || !source.tBodies.length) throw new Error('Таблица графика не найдена.');
      const groups = getGroups(source.tBodies[0]);
      stage = document.createElement('div');
      stage.style.cssText = 'position:absolute;left:-20000px;top:0;width:277mm;background:white;z-index:-1;';
      document.body.appendChild(stage);
      const sheets = [];
      let current = newSheet(source, stage);
      sheets.push(current);
      // Формат A4 альбомный: ширина области 277 мм, высота 185 мм
      // (свободное пространство под поля и номер страницы).
      const maxHeightPx = 185 * 96 / 25.4;
      for (const group of groups) {
        const clones = group.map(row => row.cloneNode(true));
        clones.forEach(row => current.tbody.appendChild(row));
        if (current.sheet.getBoundingClientRect().height > maxHeightPx &&
            current.tbody.rows.length > clones.length) {
          clones.forEach(row => row.remove());
          current = newSheet(source, stage);
          sheets.push(current);
          clones.forEach(row => current.tbody.appendChild(row));
        }
      }
      const signature = document.querySelector('#pdf-content .sign');
      if (signature) {
        const last = sheets[sheets.length - 1];
        const sign = signature.cloneNode(true);
        last.sheet.appendChild(sign);
        if (last.sheet.getBoundingClientRect().height > maxHeightPx && last.tbody.rows.length) {
          sign.remove();
          const extra = newSheet(source, stage);
          extra.sheet.appendChild(signature.cloneNode(true));
          sheets.push(extra);
        }
      }
      const pdf = new window.jspdf.jsPDF({ orientation:'landscape', unit:'mm', format:'a4', compress:true });
      for (let i = 0; i < sheets.length; i++) {
        if (i > 0) pdf.addPage('a4', 'landscape');
        const canvas = await window.html2canvas(sheets[i].sheet, {
          scale: 1.7, backgroundColor:'#fff', useCORS:true, scrollX:0, scrollY:0,
          windowWidth: Math.max(document.documentElement.clientWidth, 1100)
        });
        const heightMm = canvas.height / canvas.width * 277;
        if (heightMm > 188) throw new Error('Строка сотрудника не помещается на лист A4. Используйте «Печать».');
        pdf.addImage(canvas.toDataURL('image/jpeg',0.94),'JPEG',10,10,277,heightMm,undefined,'FAST');
        pdf.setFont('helvetica','normal');
        pdf.setFontSize(9);
        pdf.text('Стр. '+(i+1)+' из '+sheets.length,287,201,{align:'right'});
      }
      pdf.save('grot-grafik-otpuskov-2027.pdf');
    } catch (err) {
      alert('Не удалось сохранить PDF: ' + (err && err.message ? err.message : String(err)));
    } finally {
      if (stage) stage.remove();
      button.disabled = false;
      button.textContent = 'Сохранить PDF';
    }
  };
})();
