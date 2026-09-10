import { Box, Typography } from "@mui/material";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import * as echarts from "echarts/core";
import { RadarChart } from "echarts/charts";
import { LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([RadarChart, TooltipComponent, LegendComponent, CanvasRenderer]);

export type RadarData = {
  indicators: { key: string; name: string; max: number }[];
  values: number[];
};

export default function PersonaRadar({ data }: { data?: RadarData | null }) {
  const indicators = (data?.indicators || []).filter((x) => x && x.name);
  const values = Array.isArray(data?.values) ? data!.values.map((n) => Number(n) || 0) : [];
  if (!indicators.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        暂无雷达数据
      </Typography>
    );
  }
  const option: EChartsOption = {
    color: ["#C2410C"],
    tooltip: { trigger: "item" },
    radar: {
      indicator: indicators.map((x) => ({ name: x.name, max: x.max || 5 })),
      splitNumber: 5,
      axisName: { color: "rgba(0,0,0,0.65)", fontSize: 12 },
      splitArea: {
        areaStyle: { color: ["#fff7ed", "#fff", "#fff7ed", "#fff", "#fff7ed"] },
      },
      splitLine: { lineStyle: { color: "#fed7aa" } },
      axisLine: { lineStyle: { color: "#fdba74" } },
    },
    series: [
      {
        type: "radar",
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 2, color: "#C2410C" },
        areaStyle: { color: "rgba(194,65,12,0.22)" },
        data: [{ value: values, name: "画像" }],
      },
    ],
  };
  return (
    <Box sx={{ width: "100%", height: 280 }}>
      <ReactECharts echarts={echarts} option={option} style={{ height: "100%", width: "100%" }} opts={{ renderer: "canvas" }} />
    </Box>
  );
}
