import { describe, it, expect } from 'vitest';
import { renderPlanSvg } from '../src/core/planSvg';
import type { Plan } from '../src/core/types';

function makePlan(overrides: Partial<Plan['tank']> = {}): Plan {
  return {
    id: 'p1',
    name: '60 草缸',
    tank: { id: 't1', name: '60', l: 60, w: 45, h: 45, glassMm: 8, waterLevelMm: 390, openTop: true, ...overrides },
    substrate: { kind: 'ada', densityKgPerL: 1.15, thicknessMm: 50, slopeMm: 60 },
    items: [
      { id: 'i1', kind: 'hardscape', name: '沉木', x: 20, y: 15, scaleCm: 25, rotDeg: 0, displacement: 0.3, shape: 'wood' },
      { id: 'i2', kind: 'plant', name: '红宫廷', x: 30, y: 10, scaleCm: 25, rotDeg: 0, layer: 'back', lightNeed: 'high', growth: 'fast', qty: 20 },
    ],
    fishes: [],
    water: { tapGh: 12, tapKh: 6, targetGh: 8, targetCo2Ppm: 25, roomTempC: 24, targetTempC: 26 },
    updatedAt: 0,
  };
}

describe('平面图 SVG 打印适配', () => {
  it('width/height 100% + viewBox + preserveAspectRatio：打印时整体缩放到纸面不截断', () => {
    const { svg } = renderPlanSvg(makePlan());
    expect(svg).toContain('width="100%" height="100%"');
    expect(svg).toMatch(/viewBox="0 0 [\d.]+ [\d.]+"/);
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
  });

  it('内嵌 A4 @page 规则与 12mm 边距，并按长宽比选横向', () => {
    const r = renderPlanSvg(makePlan({ l: 90, w: 45 }));
    expect(r.orientation).toBe('landscape');
    expect(r.svg).toContain('@page{size: A4 landscape;margin:12mm}');
  });

  it('接近方形的小缸选纵向', () => {
    const r = renderPlanSvg(makePlan({ l: 30, w: 30 }));
    expect(r.orientation).toBe('portrait');
    expect(r.svg).toContain('@page{size: A4 portrait;margin:12mm}');
  });

  it('带长、宽两条尺寸标注（箭头 + cm 数值）', () => {
    const { svg } = renderPlanSvg(makePlan({ l: 60, w: 45 }));
    expect(svg).toContain('marker-start');
    expect(svg).toContain('marker-end');
    expect(svg).toContain('>60 cm<');
    expect(svg).toContain('>45 cm<');
  });

  it('尺寸标注字号按打印可读最小字号 2.8mm（约 8pt）', () => {
    const r = renderPlanSvg(makePlan());
    expect(r.dimFontSizeMm).toBe(2.8);
    // viewBox 单位下字号 = 2.8/scale，落到纸面恒定 2.8mm
    const m = r.svg.match(/font-size="([\d.]+)" fill="#333">60 cm</);
    expect(m).toBeTruthy();
    expect(Number(m![1])).toBeCloseTo(2.8 / r.scale, 1);
  });

  it('标题含方案名、缸尺寸与底砂信息', () => {
    const { svg } = renderPlanSvg(makePlan());
    expect(svg).toContain('60 草缸 平面图 60×45cm');
    expect(svg).toContain('底砂 50+60mm');
  });

  it('方案名含 XML 特殊字符时被转义', () => {
    const { svg } = renderPlanSvg(makePlan());
    const plan = makePlan();
    plan.name = 'A&B <缸>';
    const out = renderPlanSvg(plan).svg;
    expect(out).toContain('A&amp;B &lt;缸&gt;');
    expect(out).not.toContain('A&B');
  });

  it('坐标按 1 用户单位 = 1 实际 mm 换算（cm×10）', () => {
    const plan = makePlan({ l: 60, w: 45 });
    const { svg, scale } = renderPlanSvg(plan);
    // 缸体矩形宽 600mm、高 450mm（viewBox 单位）
    expect(svg).toMatch(/width="600" height="450"/);
    // 素材 25cm → 250mm
    expect(svg).toContain('width="250"');
    expect(scale).toBeGreaterThan(0);
  });
});
