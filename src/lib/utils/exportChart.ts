// src/lib/utils/exportChart.ts
// Stellar — チャートエクスポートユーティリティ
// SVG / PNG ダウンロード（スタイルインライン化対応）

/**
 * SVG要素の計算済みスタイルをインラインにコピー
 * （外部CSS依存を排除して正しくエクスポートするため）
 */
function inlineStyles(svgElement: SVGSVGElement): SVGSVGElement {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  const originalElements = svgElement.querySelectorAll("*");
  const clonedElements = clone.querySelectorAll("*");

  // インライン化対象のプロパティ
  const properties = [
    "fill",
    "stroke",
    "stroke-width",
    "stroke-dasharray",
    "stroke-linecap",
    "stroke-linejoin",
    "opacity",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "text-anchor",
    "dominant-baseline",
    "text-decoration",
    "letter-spacing",
    "visibility",
    "display",
    "cursor",
  ];

  for (let i = 0; i < originalElements.length; i++) {
    const orig = originalElements[i]!;
    const cloned = clonedElements[i]!;
    const computed = getComputedStyle(orig);

    for (const prop of properties) {
      const value = computed.getPropertyValue(prop);
      if (value) {
        (cloned as SVGElement).style.setProperty(prop, value);
      }
    }
  }

  // SVGルートにも背景色を設定
  const bgColor =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--color-bg-primary")
      .trim() || "#ffffff";
  clone.style.backgroundColor = bgColor;

  return clone;
}

/**
 * SVGをBlobに変換
 */
function svgToBlob(svgElement: SVGSVGElement): Blob {
  const inlined = inlineStyles(svgElement);
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(inlined);

  // XML宣言を追加
  if (!svgString.startsWith("<?xml")) {
    svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
  }

  // xmlns属性を確認
  if (!svgString.includes("xmlns=")) {
    svgString = svgString.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  return new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
}

/**
 * SVG形式でダウンロード
 */
export function downloadSVG(svgElement: SVGSVGElement, filename = "chart.svg"): void {
  const blob = svgToBlob(svgElement);
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".svg") ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * PNG形式でダウンロード（Canvas経由、高解像度対応）
 */
export async function downloadPNG(
  svgElement: SVGSVGElement,
  filename = "chart.png",
  scale = 2,
): Promise<void> {
  const inlined = inlineStyles(svgElement);
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(inlined);

  if (!svgString.includes("xmlns=")) {
    svgString = svgString.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  return new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const w = svgElement.clientWidth || svgElement.getBoundingClientRect().width || 600;
      const h = svgElement.clientHeight || svgElement.getBoundingClientRect().height || 400;

      canvas.width = w * scale;
      canvas.height = h * scale;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas 2D context not available"));
        return;
      }

      // 背景色
      const bgColor =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--color-bg-primary")
          .trim() || "#ffffff";
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) {
            reject(new Error("PNG blob creation failed"));
            return;
          }
          const pngUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = pngUrl;
          a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(pngUrl);
          resolve();
        },
        "image/png",
        1.0,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG image loading failed"));
    };

    img.src = url;
  });
}

/**
 * SVG要素を含むコンテナからSVGを検出してエクスポート
 */
export function exportChartFromContainer(
  container: HTMLElement,
  format: "svg" | "png",
  filename?: string,
): void {
  const svgEl = container.querySelector("svg");
  if (!svgEl) {
    console.warn("exportChartFromContainer: SVG element not found in container");
    return;
  }

  const name = filename ?? `chart_${Date.now()}`;
  if (format === "svg") {
    downloadSVG(svgEl, name);
  } else {
    downloadPNG(svgEl, name).catch((err) => {
      console.error("PNG export failed:", err);
    });
  }
}
