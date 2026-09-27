import { describe, expect, it } from 'vitest';
import { MIN_DIMENSION_FONT_PT, renderPlanSvg } from '../src/pages/Bom';
import { newPlan } from '../src/state/plans';

describe('导出平面图 SVG', () => {
  it('使用 A4 横向纸面与等比缩放区域，尺寸标注不小于最小可读字号', () => {
    const plan = newPlan('90 缸打印');
    plan.tank.l = 90;
    plan.tank.w = 45;
    const svg = renderPlanSvg(plan);

    expect(svg).toContain('@page');
    expect(svg).toContain('size: A4 landscape');
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(svg).toContain('data-dimension="width"');
    expect(svg).toContain('90 cm');
    expect(svg).toContain('data-dimension="height"');
    expect(svg).toContain('45 cm');
    expect(svg).toContain(`data-min-font-pt="${MIN_DIMENSION_FONT_PT}"`);
    expect(MIN_DIMENSION_FONT_PT).toBe(8);
  });

  it('竖向缸体自动切换 A4 纵向', () => {
    const plan = newPlan('竖缸打印');
    plan.tank.l = 30;
    plan.tank.w = 60;

    expect(renderPlanSvg(plan)).toContain('size: A4 portrait');
  });

  it('方案名中的 XML 特殊字符会被转义', () => {
    const plan = newPlan('A&B <缸> "测试"');
    const svg = renderPlanSvg(plan);

    expect(svg).toContain('A&amp;B &lt;缸&gt; &quot;测试&quot;');
    expect(svg).not.toContain('A&B <缸>');
  });
});
