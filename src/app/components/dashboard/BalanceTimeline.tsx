"use client";

import { useMemo, useRef, useState } from "react";
import { formatMXN } from "./ui";

interface Point {
  date: string;
  balancePesos: number;
}

interface Props {
  series: Point[];
  today: string;
  selectedDate: string | null;
  onSelect: (date: string | null) => void;
}

// Interactive balance timeline: custom SVG, no chart library (project
// precedent). Default view shows [today-10, today+30]; horizontal drag pans
// across the full fetched series. touch-action: pan-y keeps vertical page
// scroll working; a small movement threshold separates tap from drag.
const VIEW_DAYS = 41;
const DAY_W = 12;
const H = 180;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;
const W = VIEW_DAYS * DAY_W;
const DRAG_THRESHOLD_PX = 6;

function shortDay(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(d)}/${Number(m)}`;
}

export function BalanceTimeline({ series, today, selectedDate, onSelect }: Props) {
  const todayIdx = series.findIndex((p) => p.date === today);
  const maxOffset = Math.max(series.length - VIEW_DAYS, 0);
  const initialOffset = Math.min(Math.max(todayIdx - 10, 0), maxOffset);

  const [offset, setOffset] = useState(initialOffset); // fractional days panned
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ startX: number; startOffset: number; moved: boolean } | null>(null);

  const { yOf, min, max } = useMemo(() => {
    const values = series.map((p) => p.balancePesos);
    let lo = Math.min(...values, 0);
    let hi = Math.max(...values, 0);
    if (hi === lo) hi = lo + 1;
    const span = hi - lo;
    lo -= span * 0.08;
    hi += span * 0.08;
    const usable = H - PAD_TOP - PAD_BOTTOM;
    return {
      min: lo,
      max: hi,
      yOf: (v: number) => PAD_TOP + usable - ((v - lo) / (hi - lo)) * usable,
    };
  }, [series]);

  const xOf = (idx: number) => idx * DAY_W + DAY_W / 2;

  const pastPath = useMemo(() => {
    const pts = series.slice(0, todayIdx + 1);
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i)},${yOf(p.balancePesos)}`).join(" ");
  }, [series, todayIdx, yOf]);

  const futurePath = useMemo(() => {
    const pts = series.slice(todayIdx);
    return pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(todayIdx + i)},${yOf(p.balancePesos)}`)
      .join(" ");
  }, [series, todayIdx, yOf]);

  // client px → svg units (the svg is scaled to container width)
  function svgX(clientX: number): number {
    const rect = svgRef.current!.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * W;
  }

  function idxAt(clientX: number): number {
    const idx = Math.round((svgX(clientX) + offset * DAY_W - DAY_W / 2) / DAY_W);
    return Math.min(Math.max(idx, 0), series.length - 1);
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { startX: e.clientX, startOffset: offset, moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (drag.current) {
      const dxPx = e.clientX - drag.current.startX;
      if (Math.abs(dxPx) > DRAG_THRESHOLD_PX) drag.current.moved = true;
      if (drag.current.moved) {
        const rect = svgRef.current!.getBoundingClientRect();
        const dxDays = (dxPx / rect.width) * VIEW_DAYS;
        setOffset(Math.min(Math.max(drag.current.startOffset - dxDays, 0), maxOffset));
        setHoverIdx(null);
        return;
      }
    }
    setHoverIdx(idxAt(e.clientX));
  }

  function onPointerUp(e: React.PointerEvent) {
    const wasTap = drag.current && !drag.current.moved;
    drag.current = null;
    if (wasTap) {
      const idx = idxAt(e.clientX);
      const date = series[idx]?.date ?? null;
      onSelect(date === selectedDate ? null : date);
    }
  }

  const hover = hoverIdx !== null ? series[hoverIdx] : null;
  const selectedIdx = selectedDate ? series.findIndex((p) => p.date === selectedDate) : -1;

  // Week tick labels (every 7 days from the series start).
  const ticks = useMemo(
    () => series.map((p, i) => ({ ...p, i })).filter(({ i }) => i % 7 === 0),
    [series]
  );

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair select-none rounded-lg border"
        style={{ touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          setHoverIdx(null);
          drag.current = null;
        }}
      >
        <g transform={`translate(${-offset * DAY_W} 0)`}>
          {/* zero line */}
          {min < 0 && max > 0 && (
            <line
              x1={0}
              x2={series.length * DAY_W}
              y1={yOf(0)}
              y2={yOf(0)}
              className="stroke-secondary-300 dark:stroke-secondary-700"
              strokeDasharray="2 4"
            />
          )}

          {/* history: solid; projection: dashed */}
          <path d={pastPath} fill="none" strokeWidth={2.5} className="stroke-primary-500" />
          <path
            d={futurePath}
            fill="none"
            strokeWidth={2}
            strokeDasharray="5 4"
            className="stroke-primary-400 opacity-80"
          />

          {/* today marker */}
          {todayIdx >= 0 && (
            <>
              <line
                x1={xOf(todayIdx)}
                x2={xOf(todayIdx)}
                y1={PAD_TOP - 4}
                y2={H - PAD_BOTTOM + 4}
                className="stroke-mustard-400"
                strokeWidth={1}
              />
              <circle
                cx={xOf(todayIdx)}
                cy={yOf(series[todayIdx].balancePesos)}
                r={5}
                className="fill-mustard-400 stroke-surface"
                strokeWidth={2}
              />
            </>
          )}

          {/* selected day */}
          {selectedIdx >= 0 && (
            <circle
              cx={xOf(selectedIdx)}
              cy={yOf(series[selectedIdx].balancePesos)}
              r={4.5}
              className="fill-primary-600 stroke-surface"
              strokeWidth={2}
            />
          )}

          {/* hover indicator */}
          {hover && hoverIdx !== null && (
            <>
              <line
                x1={xOf(hoverIdx)}
                x2={xOf(hoverIdx)}
                y1={PAD_TOP}
                y2={H - PAD_BOTTOM}
                className="stroke-secondary-400"
                strokeWidth={0.75}
              />
              <circle cx={xOf(hoverIdx)} cy={yOf(hover.balancePesos)} r={3.5} className="fill-primary-700" />
            </>
          )}

          {/* week ticks */}
          {ticks.map(({ date, i }) => (
            <text
              key={date}
              x={xOf(i)}
              y={H - 6}
              textAnchor="middle"
              className="fill-secondary-600 text-[10px] dark:fill-secondary-300"
            >
              {shortDay(date)}
            </text>
          ))}
        </g>
      </svg>

      {/* tooltip */}
      {hover && hoverIdx !== null && (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-surface px-2.5 py-1.5 text-xs shadow-md"
          style={{
            left: `${(((hoverIdx - offset) * DAY_W + DAY_W / 2) / W) * 100}%`,
          }}
        >
          <p className="font-medium">{shortDay(hover.date)}</p>
          <p className={hover.balancePesos < 0 ? "text-red-600" : "text-primary-700 dark:text-primary-400"}>
            {formatMXN(hover.balancePesos)}
          </p>
        </div>
      )}

      <p className="mt-1 text-center text-[11px] text-secondary-600 dark:text-secondary-300">
        Arrastra para recorrer · toca un día para ver su detalle
      </p>
    </div>
  );
}
