import { useMemo, useState } from 'react';
import type { Plan } from '../core/types';
import { buildBom, type BomLine } from '../core/bom';
import { FISHES, PLANTS } from '../data/db';
import { Link } from '../router';

type PrintScope = 'all' | 'list' | 'care';

type BomGroup = {
  category: string;
  lines: BomLine[];
};

export default function Bom({ plan }: { plan: Plan }) {
  const fishMap = useMemo(() => new Map(FISHES.map((f) => [f.id, f])), []);
  const plantMap = useMemo(
    () => new Map(PLANTS.map((p) => [p.id, { name: p.name, lightNeed: p.lightNeed }])),
    [],
  );
  const bom = useMemo(() => buildBom(plan, fishMap, plantMap), [plan, fishMap, plantMap]);
  const groups = useMemo(() => groupBomLines(bom.lines), [bom.lines]);
  const printDate = useMemo(
    () =>
      new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date()),
    [],
  );
  const [printScope, setPrintScope] = useState<PrintScope | null>(null);

  function print(scope: PrintScope) {
    setPrintScope(scope);
    const reset = () => setPrintScope(null);
    window.addEventListener('afterprint', reset, { once: true });
    window.setTimeout(() => {
      window.print();
      reset();
      window.removeEventListener('afterprint', reset);
    }, 0);
  }

  function downloadSvg() {
    const svg = renderPlanSvg(plan);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${plan.name}-平面图.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page bom-page" data-print-scope={printScope ?? 'screen'} data-testid="bom-page">
      <nav className="row tabs no-print">
        <Link to={`/plan/${plan.id}`} className="tab">
          ← 造景编辑
        </Link>
        <Link to={`/plan/${plan.id}/water`} className="tab">
          水质与设备
        </Link>
        <Link to={`/plan/${plan.id}/stocking`} className="tab">
          生物兼容
        </Link>
        <span className="tab active">物料清单</span>
      </nav>
      <h1 className="bom-page-title no-print">物料清单与养护参数卡（{plan.name}）</h1>

      <div className="row no-print bom-actions">
        <button className="btn primary" data-testid="print-all" onClick={() => print('all')}>
          打印全部（清单 + 参数卡）
        </button>
        <button className="btn" data-testid="print-list" onClick={() => print('list')}>
          只打印清单
        </button>
        <button className="btn" data-testid="print-care" onClick={() => print('care')}>
          只打印参数卡
        </button>
        <button className="btn" data-testid="export-svg" onClick={downloadSvg}>
          导出平面图 SVG
        </button>
      </div>

      <section className="bom-list" data-testid="bom-list">
        <header className="print-only bom-print-header">
          <h2>物料清单</h2>
          <div>
            <span>方案名称：{plan.name}</span>
            <span>打印日期：{printDate}</span>
          </div>
        </header>

        <table className="table bom-table" data-testid="bom-table">
          <thead>
            <tr>
              <th>类别</th>
              <th>名称</th>
              <th>规格</th>
              <th>数量</th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody className="bom-category-group" key={group.category} data-testid={`bom-group-${group.category}`}>
              {group.lines.map((l, rowIndex) => (
                <tr key={`${l.name}-${rowIndex}`} data-testid={`bom-line-${l.category}`}>
                  {rowIndex === 0 && <td rowSpan={group.lines.length}>{l.category}</td>}
                  <td>{l.name}</td>
                  <td className="muted small">{l.spec}</td>
                  <td>
                    <b>{l.qty}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </section>

      <section className="card2 care-card" data-testid="care-card">
        <header className="care-card-head">
          <h3>养护参数卡（贴缸）</h3>
          <dl>
            <div>
              <dt>方案名称</dt>
              <dd data-testid="care-plan-name">{plan.name}</dd>
            </div>
            <div>
              <dt>打印日期</dt>
              <dd data-testid="print-date">{printDate}</dd>
            </div>
          </dl>
        </header>
        <ul>
          <li>
            换水：每周 <b>{bom.care.waterChangePct}%</b>
          </li>
          <li>
            光照：<b>{bom.care.lightHours}</b>
          </li>
          <li>
            CO₂ 日程：<b>{bom.care.co2Schedule}</b>
          </li>
          <li>
            喂食：<b>{bom.care.feedingTimes}</b>
          </li>
        </ul>
        <p className="muted small">
          缸体 {plan.tank.l}×{plan.tank.w}×{plan.tank.h}cm · 玻璃 {plan.tank.glassMm}mm ·{' '}
          {plan.tank.openTop ? '开放缸' : '封闭缸'}
        </p>
      </section>
    </div>
  );
}

function groupBomLines(lines: BomLine[]): BomGroup[] {
  const groups: BomGroup[] = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (last?.category === line.category) {
      last.lines.push(line);
    } else {
      groups.push({ category: line.category, lines: [line] });
    }
  }
  return groups;
}

/** 尺寸标注使用打印后仍可读的最小 8pt，字号随 SVG 缩放反向换算 */
export const MIN_DIMENSION_FONT_PT = 8;
const MM_PER_PT = 25.4 / 72;
const MM_PER_CM = 10;
const PRINT_MARGIN_MM = 12;
const PRINT_ANNOTATION_SPACE_MM = 12;

/** 导出带尺寸标注、可直接按 A4 纸面缩放打印的平面图 SVG */
export function renderPlanSvg(plan: Plan): string {
  const { tank } = plan;
  const landscape = tank.l >= tank.w;
  const pageWidthMm = landscape ? 297 : 210;
  const pageHeightMm = landscape ? 210 : 297;
  const printableWidthMm = pageWidthMm - PRINT_MARGIN_MM * 2;
  const printableHeightMm = pageHeightMm - PRINT_MARGIN_MM * 2;
  const tankWidthMm = tank.l * MM_PER_CM;
  const tankHeightMm = tank.w * MM_PER_CM;

  // 预留标注区后等比 fit；标注线宽和字号按 fit 反向放大，保证物理尺寸固定。
  let fit = 1;
  for (let i = 0; i < 4; i += 1) {
    const annotationMm = PRINT_ANNOTATION_SPACE_MM / fit;
    fit = Math.min(
      printableWidthMm / (tankWidthMm + annotationMm * 2),
      printableHeightMm / (tankHeightMm + annotationMm * 2),
    );
  }
  const annotationMm = PRINT_ANNOTATION_SPACE_MM / fit;
  const left = annotationMm;
  const top = annotationMm;
  const width = tankWidthMm + annotationMm * 2;
  const height = tankHeightMm + annotationMm * 2;
  const dimOffset = 7 / fit;
  const extension = 2 / fit;
  const arrowLength = 2.5 / fit;
  const arrowWidth = 1 / fit;
  const dimensionFontMm = (MIN_DIMENSION_FONT_PT * MM_PER_PT) / fit;
  const titleFontMm = (9 * MM_PER_PT) / fit;
  const tankStrokeMm = 0.8 / fit;
  const dimStrokeMm = 0.25 / fit;

  const horizontalY = top + tankHeightMm + dimOffset;
  const verticalX = left - dimOffset;
  const title = `${escapeXml(plan.name)} 平面图 ${tank.l}×${tank.w}cm（底砂 ${plan.substrate.thicknessMm}+${plan.substrate.slopeMm}mm）`;

  const shapes = plan.items
    .map((it) => {
      const s = it.scaleCm * MM_PER_CM;
      const color =
        it.kind === 'plant'
          ? it.layer === 'front'
            ? '#d9534f'
            : it.layer === 'mid'
              ? '#f0ad4e'
              : '#4285f4'
          : '#a08050';
      const label = escapeXml(`${it.name} ${it.scaleCm}cm`);
      const strokeWidth = 0.6 / fit;
      return it.kind === 'hardscape'
        ? `<rect x="${(it.x - it.scaleCm / 2) * MM_PER_CM}" y="${(it.y - it.scaleCm / 2) * MM_PER_CM}" width="${s}" height="${s * 0.7}" rx="${s * 0.15}" fill="#a08050" stroke="#6b4f2a" stroke-width="${strokeWidth}"><title>${label}</title></rect>`
        : `<circle cx="${it.x * MM_PER_CM}" cy="${it.y * MM_PER_CM}" r="${s / 2}" fill="#7dbb6c" stroke="${color}" stroke-width="${strokeWidth}" opacity="0.8"><title>${label}</title></circle>`;
    })
    .join('\n  ');

  const line = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#333" stroke-width="${dimStrokeMm}"/>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${title}">
  <title>${title}</title>
  <style><![CDATA[
    @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: ${PRINT_MARGIN_MM}mm; }
    @media screen { svg { width: min(960px, 96vw); height: auto; } }
    @media print {
      html, body { width: ${printableWidthMm}mm; height: ${printableHeightMm}mm; margin: 0; }
      svg { display: block; width: 100%; height: 100%; }
    }
    svg { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  ]]></style>
  <text x="${left}" y="${top - 4.5 / fit}" font-size="${titleFontMm}" fill="#333">${title}</text>

  <g transform="translate(${left} ${top})">
    <rect x="0" y="0" width="${tankWidthMm}" height="${tankHeightMm}" fill="#eaf3f6" stroke="#333" stroke-width="${tankStrokeMm}"/>
    ${shapes}
  </g>

  ${line(left, top + tankHeightMm - extension, left, horizontalY + extension)}
  ${line(left + tankWidthMm, top + tankHeightMm - extension, left + tankWidthMm, horizontalY + extension)}
  ${line(left, horizontalY, left + tankWidthMm, horizontalY)}
  <polygon points="${left},${horizontalY} ${left + arrowLength},${horizontalY - arrowWidth} ${left + arrowLength},${horizontalY + arrowWidth}" fill="#333"/>
  <polygon points="${left + tankWidthMm},${horizontalY} ${left + tankWidthMm - arrowLength},${horizontalY - arrowWidth} ${left + tankWidthMm - arrowLength},${horizontalY + arrowWidth}" fill="#333"/>
  <text x="${left + tankWidthMm / 2}" y="${horizontalY + 1 / fit}" text-anchor="middle" font-size="${dimensionFontMm}" fill="#333" data-dimension="width" data-min-font-pt="${MIN_DIMENSION_FONT_PT}">${tank.l} cm</text>

  ${line(left - extension, top, verticalX - extension, top)}
  ${line(left - extension, top + tankHeightMm, verticalX - extension, top + tankHeightMm)}
  ${line(verticalX, top, verticalX, top + tankHeightMm)}
  <polygon points="${verticalX},${top} ${verticalX - arrowWidth},${top + arrowLength} ${verticalX + arrowWidth},${top + arrowLength}" fill="#333"/>
  <polygon points="${verticalX},${top + tankHeightMm} ${verticalX - arrowWidth},${top + tankHeightMm - arrowLength} ${verticalX + arrowWidth},${top + tankHeightMm - arrowLength}" fill="#333"/>
  <text x="${verticalX - 2.5 / fit}" y="${top + tankHeightMm / 2}" text-anchor="middle" font-size="${dimensionFontMm}" fill="#333" transform="rotate(-90 ${verticalX - 2.5 / fit} ${top + tankHeightMm / 2})" data-dimension="height" data-min-font-pt="${MIN_DIMENSION_FONT_PT}">${tank.w} cm</text>
</svg>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
