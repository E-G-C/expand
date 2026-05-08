// content/export.js — PNG export, clipboard copy, SVG/image download, table conversion
(function () {
  'use strict';

  function prepareSvgClone(svgElement) {
    var clone = svgElement.cloneNode(true);

    // Set xmlns if missing
    if (!clone.getAttribute('xmlns')) {
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    if (!clone.getAttribute('xmlns:xlink')) {
      clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    }

    // Set explicit width/height from viewBox if missing
    var vb = clone.getAttribute('viewBox');
    if (vb && (!clone.getAttribute('width') || !clone.getAttribute('height'))) {
      var parts = vb.split(/[\s,]+/).map(Number);
      if (parts.length === 4) {
        clone.setAttribute('width', parts[2]);
        clone.setAttribute('height', parts[3]);
      }
    }

    // Inline styles from internal <style> blocks
    var styleBlocks = clone.querySelectorAll('style');
    if (styleBlocks.length > 0) {
      // Keep style blocks in the clone — they'll be serialized
    }

    return clone;
  }

  function svgToCanvas(svgClone, maxDimension, scale) {
    maxDimension = maxDimension || 4096;
    scale = scale || 1;

    // Scale SVG dimensions while keeping viewBox — renders crisply at any size
    if (scale !== 1) {
      var origW = parseFloat(svgClone.getAttribute('width')) || 300;
      var origH = parseFloat(svgClone.getAttribute('height')) || 150;
      svgClone.setAttribute('width', Math.round(origW * scale));
      svgClone.setAttribute('height', Math.round(origH * scale));
    }

    return new Promise(function (resolve, reject) {
      var serializer = new XMLSerializer();
      var svgString = serializer.serializeToString(svgClone);
      var dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;

        // Scale down if exceeding max dimension
        if (w > maxDimension || h > maxDimension) {
          var ratio = Math.min(maxDimension / w, maxDimension / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas);
      };
      img.onerror = function () {
        reject(new Error('Failed to load SVG as image'));
      };
      img.src = dataUrl;
    });
  }

  function imgToCanvas(imgElement, maxDimension, scale) {
    maxDimension = maxDimension || 4096;
    scale = scale || 1;
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        var w = Math.round((img.naturalWidth || img.width) * scale);
        var h = Math.round((img.naturalHeight || img.height) * scale);
        if (w > maxDimension || h > maxDimension) {
          var ratio = Math.min(maxDimension / w, maxDimension / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas);
      };
      img.onerror = function () {
        reject(new Error('Failed to load image for export'));
      };
      img.src = imgElement.currentSrc || imgElement.src;
    });
  }

  function inlineComputedStyles(source, clone) {
    var computed = window.getComputedStyle(source);
    for (var i = 0; i < computed.length; i++) {
      var prop = computed[i];
      clone.style.setProperty(prop, computed.getPropertyValue(prop));
    }
    var sourceChildren = source.children;
    var cloneChildren = clone.children;
    for (var j = 0; j < sourceChildren.length && j < cloneChildren.length; j++) {
      inlineComputedStyles(sourceChildren[j], cloneChildren[j]);
    }
  }

  function tableToCanvas(tableElement, maxDimension, scale) {
    maxDimension = maxDimension || 4096;
    scale = scale || 1;

    var clone = tableElement.cloneNode(true);
    inlineComputedStyles(tableElement, clone);

    var rect = tableElement.getBoundingClientRect();
    var w = Math.ceil(rect.width);
    var h = Math.ceil(rect.height);

    var svgNS = 'http://www.w3.org/2000/svg';
    var xhtmlNS = 'http://www.w3.org/1999/xhtml';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('xmlns', svgNS);
    // viewBox at original size; width/height scaled — renders crisply like SVG
    svg.setAttribute('width', String(Math.round(w * scale)));
    svg.setAttribute('height', String(Math.round(h * scale)));
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);

    var fo = document.createElementNS(svgNS, 'foreignObject');
    fo.setAttribute('width', '100%');
    fo.setAttribute('height', '100%');

    var body = document.createElementNS(xhtmlNS, 'body');
    body.setAttribute('xmlns', xhtmlNS);
    body.style.margin = '0';
    body.style.padding = '0';
    body.appendChild(clone);
    fo.appendChild(body);
    svg.appendChild(fo);

    var serializer = new XMLSerializer();
    var svgString = serializer.serializeToString(svg);
    var dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var cw = img.naturalWidth || w;
        var ch = img.naturalHeight || h;
        if (cw > maxDimension || ch > maxDimension) {
          var ratio = Math.min(maxDimension / cw, maxDimension / ch);
          cw = Math.round(cw * ratio);
          ch = Math.round(ch * ratio);
        }
        var canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, cw, ch);
        resolve(canvas);
      };
      img.onerror = function () {
        reject(new Error('Failed to render table as image'));
      };
      img.src = dataUrl;
    });
  }

  function tableToJson(tableElement) {
    var rows = [];

    // Detect header row: prefer <thead>, then first <tr> with <th> cells
    var thead = tableElement.querySelector('thead');
    var headerRow = thead ? thead.querySelector('tr') : null;
    if (!headerRow) {
      var firstRow = tableElement.querySelector('tr');
      if (firstRow && firstRow.querySelector('th')) {
        headerRow = firstRow;
      }
    }

    if (!headerRow) {
      // No headers — output as 2D array
      var allRows = tableElement.querySelectorAll('tr');
      for (var i = 0; i < allRows.length; i++) {
        var cells = allRows[i].querySelectorAll('td, th');
        var row = [];
        for (var j = 0; j < cells.length; j++) {
          row.push((cells[j].textContent || '').trim());
        }
        rows.push(row);
      }
      return JSON.stringify(rows, null, 2);
    }

    // Has headers — output as array of objects
    var headers = [];
    var headerCells = headerRow.querySelectorAll('th, td');
    for (var h = 0; h < headerCells.length; h++) {
      var text = (headerCells[h].textContent || '').trim();
      headers.push(text || ('Column ' + (h + 1)));
    }

    var allRows = tableElement.querySelectorAll('tr');
    var startIdx = 0;
    for (var r = 0; r < allRows.length; r++) {
      if (allRows[r] === headerRow) {
        startIdx = r + 1;
        break;
      }
    }
    for (var r2 = startIdx; r2 < allRows.length; r2++) {
      var cells = allRows[r2].querySelectorAll('td, th');
      var obj = {};
      for (var c = 0; c < cells.length && c < headers.length; c++) {
        obj[headers[c]] = (cells[c].textContent || '').trim();
      }
      rows.push(obj);
    }

    return JSON.stringify(rows, null, 2);
  }

  function copyPngToClipboard(element, scale) {
    var canvasPromise;
    var tagName = element.tagName && element.tagName.toLowerCase();
    if (tagName === 'img') {
      canvasPromise = imgToCanvas(element, undefined, scale);
    } else if (tagName === 'table') {
      canvasPromise = tableToCanvas(element, undefined, scale);
    } else {
      var clone = prepareSvgClone(element);
      canvasPromise = svgToCanvas(clone, undefined, scale);
    }
    return canvasPromise.then(function (canvas) {
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (!blob) return reject(new Error('Canvas toBlob returned null'));
          navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]).then(resolve).catch(reject);
        }, 'image/png');
      });
    });
  }

  function downloadPng(svgElement, filename, scale) {
    filename = filename || 'diagram.png';
    var clone = prepareSvgClone(svgElement);
    return svgToCanvas(clone, undefined, scale).then(function (canvas) {
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (!blob) return reject(new Error('Canvas toBlob returned null'));
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          resolve();
        }, 'image/png');
      });
    });
  }

  function downloadSvg(svgElement, filename) {
    filename = filename || 'diagram.svg';
    var clone = prepareSvgClone(svgElement);
    var serializer = new XMLSerializer();
    var svgString = serializer.serializeToString(clone);
    var blob = new Blob([svgString], { type: 'image/svg+xml' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return Promise.resolve();
  }

  function downloadImage(imgElement, filename) {
    var src = imgElement.currentSrc || imgElement.src;
    if (!filename) {
      var urlPath = src.split('?')[0].split('#')[0];
      filename = urlPath.split('/').pop() || 'image.png';
    }
    return fetch(src).then(function (response) {
      if (!response.ok) throw new Error('Failed to fetch image');
      return response.blob();
    }).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  function copyHtmlToClipboard(tableElement) {
    var html = tableElement.outerHTML;
    var blob = new Blob([html], { type: 'text/html' });
    var textBlob = new Blob([tableElement.textContent || ''], { type: 'text/plain' });
    return navigator.clipboard.write([
      new ClipboardItem({
        'text/html': blob,
        'text/plain': textBlob
      })
    ]);
  }

  function copyJsonToClipboard(tableElement) {
    var json = tableToJson(tableElement);
    return navigator.clipboard.writeText(json);
  }

  function tableToJsonFlat(tableElement) {
    var rows = [];
    var allRows = tableElement.querySelectorAll('tr');
    for (var i = 0; i < allRows.length; i++) {
      var cells = allRows[i].querySelectorAll('td, th');
      var row = [];
      for (var j = 0; j < cells.length; j++) {
        row.push((cells[j].textContent || '').trim());
      }
      rows.push(row);
    }
    return JSON.stringify(rows, null, 2);
  }

  function copyJsonFlatToClipboard(tableElement) {
    var json = tableToJsonFlat(tableElement);
    return navigator.clipboard.writeText(json);
  }

  function downloadTablePng(tableElement, filename, scale) {
    filename = filename || 'table.png';
    return tableToCanvas(tableElement, undefined, scale).then(function (canvas) {
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (!blob) return reject(new Error('Canvas toBlob returned null'));
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          resolve();
        }, 'image/png');
      });
    });
  }

  var exports = {
    copyPngToClipboard: copyPngToClipboard,
    downloadPng: downloadPng,
    downloadSvg: downloadSvg,
    downloadImage: downloadImage,
    inlineComputedStyles: inlineComputedStyles,
    copyHtmlToClipboard: copyHtmlToClipboard,
    copyJsonToClipboard: copyJsonToClipboard,
    copyJsonFlatToClipboard: copyJsonFlatToClipboard,
    downloadTablePng: downloadTablePng,
    tableToJson: tableToJson,
    tableToJsonFlat: tableToJsonFlat
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof window !== 'undefined') {
    window.ExpandExport = exports;
  }
})();
