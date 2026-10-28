import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { LatenessClassroom } from '@/lib/utils/latenessStats';
import { LATE_TERMS, type CountTerms } from './LatenessHeatmap';

interface LatenessRankingProps {
  classrooms: LatenessClassroom[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  limit?: number;
  terms?: CountTerms;
}

function RankingTooltip({ active, payload, terms }: TooltipProps<number, string> & { terms: CountTerms }) {
  const c = payload?.[0]?.payload as LatenessClassroom | undefined;
  if (!active || !c) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 text-sm font-semibold">{c.label}</p>
      <p>
        <span className="font-semibold tabular-nums">{c.lateCount}</span>{' '}
        <span className="text-muted-foreground">{terms.many}</span>
      </p>
      <p>
        <span className="font-semibold tabular-nums">{c.studentsLate}</span>
        {c.enrolled > 0 && <span className="text-muted-foreground"> de {c.enrolled}</span>}{' '}
        <span className="text-muted-foreground">alumnos</span>
      </p>
    </div>
  );
}

/** Aulas con más tardanzas (barras horizontales de un solo tono). */
export function LatenessRanking({ classrooms, selectedKey, onSelect, limit = 10, terms = LATE_TERMS }: LatenessRankingProps) {
  const data = classrooms
    .filter((c) => c.lateCount > 0)
    .sort((a, b) => b.lateCount - a.lateCount || a.label.localeCompare(b.label))
    .slice(0, limit);

  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        Ninguna aula con {terms.many} en el período
      </div>
    );
  }

  const height = Math.max(180, data.length * 38 + 16);

  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 4 }} barCategoryGap={8}>
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis
            type="category"
            dataKey="label"
            width={92}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <Tooltip content={<RankingTooltip terms={terms} />} cursor={{ fill: 'hsl(var(--muted) / 0.6)' }} />
          <Bar
            dataKey="lateCount"
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
            onClick={(entry: LatenessClassroom) => onSelect(selectedKey === entry.key ? null : entry.key)}
            className="cursor-pointer"
            isAnimationActive={false}
          >
            {data.map((c) => (
              <Cell
                key={c.key}
                fill={`hsl(var(--${terms.ramp}-4))`}
                fillOpacity={selectedKey && selectedKey !== c.key ? 0.3 : 1}
              />
            ))}
            <LabelList
              dataKey="lateCount"
              position="right"
              className="tabular-nums"
              style={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
