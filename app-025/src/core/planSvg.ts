import type { Plan } from './types';

/**
 * 导出带尺寸标注的平面图 SVG（独立文件，浏览器打开后可直接打印）。
 *
 * 打印适配：
 * - 1 用户单位 = 1 实际 mm；width/height 100% + preserveAspectRatio，
 *   浏览器打印时整体等比缩放到 A4 可打印区域，不会被纸面截断
 * - 根据缸体长宽比在 A4 纵向/横向中选缩放更大的方向，内嵌 @page 声明
 * - 尺寸标注字号按打印可读最小字号 2.8mm（约 8pt）给，纸面上不随缸大小变小
 */

// A4 可打印区域：210×297mm 减去 @page 12mm 边距
const A4_PORTRAIT = { width: 186, height: 273, css: 'size: A4 portrait' };
const A4_LANDSCAPE = { width: 273, height: 186, css: 'size: A4 landscape' };

// 尺寸标注占用的留白（mm）
const PAD_X = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 16;
// 打印可读的最小字号（mm，约 8pt）
const MIN_DIM_FONT_MM = 2.8;

export type RenderedPlanSvg = {
  svg: string;
  orientation: 'portrait' | 'landscape';
  /** mm → 用户单位的缩放系数（1 用户单位 = 1 实际 mm，故恒为 1，保留语义） */
  scale: number;
  dimFontSizeMm: number;
};

export function renderPlanSvg(plan: Plan): RenderedPlanSvg {
  const { tank } = plan;
  const tankW = tank.l * 10; // cm → mm
  const tankH = tank.w * 10;

  // 选 A4 方向：缸体等比放进内容区，取缩放更大者；相等时取纵向
  const fit = (page: { width: number; height: number }) =>
    Math.min((page.width - 2 * PAD_X) / tankW, (page.height - PAD_TOP - PAD_BOTTOM) / tankH);
  const sPortrait = fit(A4_PORTRAIT);
  const sLandscape = fit(A4_LANDSCAPE);
  const landscape = sLandscape > sPortrait;
  const page = landscape ? A4_LANDSCAPE : A4_PORTRAIT;
  const scale = Math.min(sPortrait, sLandscape) > 0 ? (landscape ? sLandscape : sPortrait) : 1;

  // viewBox 与内容区等比，缸体在内容区居中
  const vbW = page.width / scale;
  const vbH = page.height / scale;
  const ox = (vbW - tankW) / 2;
  const oy = PAD_TOP / scale + Math.max(0, (vbH - PAD_TOP / scale - PAD_BOTTOM / scale - tankH) / 2);

  // 标注字号：纸面上恒为可读最小字号，换算回 viewBox 用户单位
  const dimFont = MIN_DIM_FONT_MM / scale;
  const titleFont = 4 / scale;

  const shapes = plan.items
    .map((it) => {
      const s = it.scaleCm * 10; // cm → mm
      const color =
        it.kind === 'plant'
          ? it.layer === 'front'
            ? '#d9534f'
            : it.layer === 'mid'
              ? '#f0ad4e'
              : '#4285f4'
          : '#6b4f2a';
      const fill = it.kind === 'plant' ? '#7dbb6c' : '#a08050';
      const label = xmlEscape(`${it.name} 约 ${it.scaleCm}cm`);
      const cx = ox + it.x * 10;
      const cy = oy + it.y * 10;
      const sw = 0.3 / scale;
      return it.kind === 'hardscape'
        ? `<rect x="${r1(cx - s / 2)}" y="${r1(cy - s / 2)}" width="${r1(s)}" height="${r1(s * 0.7)}" rx="${r1(s * 0.15)}" fill="${fill}" stroke="${color}" stroke-width="${r2(sw)}"><title>${label}</title></rect>`
        : `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(s / 2)}" fill="${fill}" stroke="${color}" stroke-width="${r2(sw)}" opacity="0.8"><title>${label}</title></circle>`;
    })
    .join('\n  ');

  // 底部宽向尺寸线 + 左侧深向尺寸线
  const dim = dimensionMarkup(ox, oy, tankW, tankH, scale, dimFont);

  const title = xmlEscape(
    `${plan.name} 平面图 ${tank.l}×${tank.w}cm（底砂 ${plan.substrate.thicknessMm}+${plan.substrate.slopeMm}mm）`,
  );
  const stroke = r2(0.4 / scale);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${r1(vbW)} ${r1(vbH)}" preserveAspectRatio="xMidYMid meet">
  <style>@page{${page.css};margin:12mm}text{font-family:'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC',sans-serif}</style>
  <rect x="0" y="0" width="${r1(vbW)}" height="${r1(vbH)}" fill="#ffffff"/>
  <text x="${r1(PAD_X / scale)}" y="${r1(Math.max(titleFont, PAD_TOP / 2) / scale)}" font-size="${r2(titleFont)}" fill="#333">${title}</text>
  ${dim}
  <rect x="${r1(ox)}" y="${r1(oy)}" width="${r1(tankW)}" height="${r1(tankH)}" fill="#eaf3f6" stroke="#333" stroke-width="${stroke}"/>
  ${shapes}
</svg>`;

  return { svg, orientation: landscape ? 'landscape' : 'portrait', scale, dimFontSizeMm: MIN_DIM_FONT_MM };
}

function dimensionMarkup(
  ox: number,
  oy: number,
  tankW: number,
  tankH: number,
  scale: number,
  font: number,
) {
  const gap = 4 / scale; // 尺寸线与缸体的间距
  const ext = 2 / scale; // 尺寸界线出头
  const sw = 0.25 / scale;
  const by = oy + tankH + gap;
  const lx = ox - gap;
  const marker = `url(#dim-arrow-${scaleId(scale)})`;
  const widthLabel = `${r1(tankW / 10)} cm`;
  const depthLabel = `${r1(tankH / 10)} cm`;
  return `<defs><marker id="dim-arrow-${scaleId(scale)}" markerWidth="${r2(2 / scale)}" markerHeight="${r2(2 / scale)}" refX="1" refY="1" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
    <path d="M0,0 L2,1 L0,2 z" fill="#333"/>
  </marker></defs>
  <line x1="${r1(ox)}" y1="${r1(oy + tankH)}" x2="${r1(ox)}" y2="${r1(by + ext)}" stroke="#333" stroke-width="${r2(sw)}"/>
  <line x1="${r1(ox + tankW)}" y1="${r1(oy + tankH)}" x2="${r1(ox + tankW)}" y2="${r1(by + ext)}" stroke="#333" stroke-width="${r2(sw)}"/>
  <line x1="${r1(ox)}" y1="${r1(by)}" x2="${r1(ox + tankW)}" y2="${r1(by)}" stroke="#333" stroke-width="${r2(sw)}" marker-start="${marker}" marker-end="${marker}"/>
  <text x="${r1(ox + tankW / 2)}" y="${r1(by + font * 1.6)}" text-anchor="middle" font-size="${r2(font)}" fill="#333">${widthLabel}</text>
  <line x1="${r1(ox)}" y1="${r1(oy)}" x2="${r1(lx - ext)}" y2="${r1(oy)}" stroke="#333" stroke-width="${r2(sw)}"/>
  <line x1="${r1(ox)}" y1="${r1(oy + tankH)}" x2="${r1(lx - ext)}" y2="${r1(oy + tankH)}" stroke="#333" stroke-width="${r2(sw)}"/>
  <line x1="${r1(lx)}" y1="${r1(oy)}" x2="${r1(lx)}" y2="${r1(oy + tankH)}" stroke="#333" stroke-width="${r2(sw)}" marker-start="${marker}" marker-end="${marker}"/>
  <text x="${r1(lx - font * 0.8)}" y="${r1(oy + tankH / 2)}" text-anchor="middle" font-size="${r2(font)}" fill="#333" transform="rotate(-90 ${r1(lx - font * 0.8)} ${r1(oy + tankH / 2)})">${depthLabel}</text>`;
}

function scaleId(scale: number) {
  return Math.round(scale * 1e6).toString(36);
}

function r1(n: number) {
  return Math.round(n * 10) / 10;
}
function r2(n: number) {
  return Math.round(n * 100) / 100;
}
function xmlEscape(s: string) {
  return s.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '"':
        return '&quot;';
      default:
        return '&apos;';
    }
  });
}
