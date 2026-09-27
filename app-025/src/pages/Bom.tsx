import { useEffect, useMemo, useState } from 'react';
import type { Plan } from '../core/types';
import { buildBom } from '../core/bom';
import { renderPlanSvg } from '../core/planSvg';
import { FISHES, PLANTS } from '../data/db';
import { Link } from '../router';

type PrintMode = 'all' | 'list' | 'care';

export default function Bom({ plan }: { plan: Plan }) {
  const fishMap = useMemo(() => new Map(FISHES.map((f) => [f.id, f])), []);
  const plantMap = useMemo(
    () => new Map(PLANTS.map((p) => [p.id, { name: p.name, lightNeed: p.lightNeed }])),
    [],
  );
  const bom = useMemo(() => buildBom(plan, fishMap, plantMap), [plan, fishMap, plantMap]);

  // 清单按类别分组：整组 break-inside: avoid，跨页时整组挪到下一页、不被拆开
  const groups = useMemo(() => groupByCategory(bom.lines), [bom.lines]);

  // 打印模式：全部 / 只打清单 / 只打参数卡；仅在打印样式表中生效
  const [printMode, setPrintMode] = useState<PrintMode | null>(null);
  const [printDate, setPrintDate] = useState(() => formatDate(new Date()));

  // 进入打印对话框前刷新一次日期，保证“打印日期”是真实打印日
  useEffect(() => {
    const refresh = () => setPrintDate(formatDate(new Date()));
    window.addEventListener('beforeprint', refresh);
    return () => window.removeEventListener('beforeprint', refresh);
  }, []);

  // 打印结束（afterprint）清除模式类，屏幕态恢复原样
  useEffect(() => {
    const reset = () => setPrintMode(null);
    window.addEventListener('afterprint', reset);
    return () => window.removeEventListener('afterprint', reset);
  }, []);

  function print(mode: PrintMode) {
    setPrintDate(formatDate(new Date()));
    setPrintMode(mode);
    // 等模式类应用到 DOM 后再唤起打印（React 状态更新是异步的）
    setTimeout(() => window.print(), 0);
  }

  function downloadSvg() {
    const { svg } = renderPlanSvg(plan);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${plan.name}-平面图.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className={`page bom-page${printMode ? ` print-mode-${printMode}` : ''}`}
      data-testid="bom-page"
      data-print-mode={printMode ?? ''}
    >
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
      <h1 className="screen-only">物料清单与养护参数卡（{plan.name}）</h1>

      <div className="row no-print">
        <button className="btn primary" data-testid="print-btn" onClick={() => print('all')}>
          打印全部（清单 + 参数卡）
        </button>
        <button className="btn" data-testid="print-list" onClick={() => print('list')}>
          只打物料清单
        </button>
        <button className="btn" data-testid="print-care" onClick={() => print('care')}>
          只打养护参数卡
        </button>
        <button className="btn" data-testid="export-svg" onClick={downloadSvg}>
          导出平面图 SVG
        </button>
      </div>

      <section className="print-section print-section-list" data-testid="bom-list-section">
        <h2 className="print-only">
          物料清单 · {plan.name}
          <span className="print-date">打印日期：{printDate}</span>
        </h2>
        <table className="table bom-table" data-testid="bom-table">
          <thead>
            <tr>
              <th>类别</th>
              <th>名称</th>
              <th>规格</th>
              <th>数量</th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.category} className="bom-group" data-testid={`bom-group-${g.category}`}>
              {g.lines.map((l, i) => (
                <tr key={`${i}-${l.name}`} data-testid={`bom-line-${l.name}`}>
                  {i === 0 && (
                    <th className="bom-cat" scope="rowgroup" rowSpan={g.lines.length}>
                      {g.category}
                    </th>
                  )}
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

      <section className="card2 care-card print-section print-section-care" data-testid="care-card">
        <h3 className="screen-only">养护参数卡（贴缸）</h3>
        <h3 className="print-only care-title">养护参数卡（贴缸）· {plan.name}</h3>
        <p className="print-only care-date" data-testid="care-print-date">
          打印日期：{printDate}
        </p>
        <ul className="care-list">
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
        <p className="muted small care-meta">
          缸体 {plan.tank.l}×{plan.tank.w}×{plan.tank.h}cm · 玻璃 {plan.tank.glassMm}mm ·{' '}
          {plan.tank.openTop ? '开放缸' : '封闭缸'}
        </p>
      </section>
    </div>
  );
}

type BomGroup = { category: string; lines: ReturnType<typeof buildBom>['lines'] };

/** 保持 buildBom 原顺序，按类别聚合成组 */
function groupByCategory(lines: ReturnType<typeof buildBom>['lines']): BomGroup[] {
  const map = new Map<string, BomGroup>();
  for (const l of lines) {
    let g = map.get(l.category);
    if (!g) {
      g = { category: l.category, lines: [] };
      map.set(l.category, g);
    }
    g.lines.push(l);
  }
  return [...map.values()];
}

function formatDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
