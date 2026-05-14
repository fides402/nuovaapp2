"use client";

export async function exportSlideAsPng(node, filename = "slide.png") {
  const html2canvas = (await import("html2canvas")).default;
  const canvas = await html2canvas(node, {
    backgroundColor: null,
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const blob = await new Promise((res) => canvas.toBlob(res, "image/png", 0.95));
  triggerDownload(blob, filename);
}

export async function exportCarouselAsPdf(nodes, filename = "carousel.pdf") {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");
  // 1080x1350 (4:5) at 2x
  const pdf = new jsPDF({ unit: "px", format: [1080, 1350], orientation: "portrait" });
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const canvas = await html2canvas(node, { backgroundColor: null, scale: 2, useCORS: true, logging: false });
    const img = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) pdf.addPage([1080, 1350], "portrait");
    pdf.addImage(img, "JPEG", 0, 0, 1080, 1350);
  }
  pdf.save(filename);
}

export async function exportCarouselAsZipPng(nodes, baseName = "carousel") {
  const html2canvas = (await import("html2canvas")).default;
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const canvas = await html2canvas(node, { backgroundColor: null, scale: 2, useCORS: true, logging: false });
    const blob = await new Promise((r) => canvas.toBlob(r, "image/png", 0.95));
    const buf = await blob.arrayBuffer();
    zip.file(`${String(i + 1).padStart(2, "0")}.png`, buf);
  }
  const out = await zip.generateAsync({ type: "blob" });
  triggerDownload(out, `${baseName}.zip`);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
