import type { TextRun } from '../lib/richText'

export function TextRunsPreview({ runs, x = 0, y = 0 }: { runs: TextRun[]; x?: number; y?: number }) {
  return <g>{runs.map((run, index) => run.emoji ? <image key={index} href={run.emoji} x={x + run.x} y={y + run.y - run.style.fontSize * .8} width={run.width} height={run.style.fontSize} aria-label={run.text} /> : <text key={index} x={x + run.x} y={y + run.y} fill={run.style.color} textAnchor="start" dominantBaseline="alphabetic" xmlSpace="preserve"
    style={{ fontFamily: run.style.fontFamily, fontSize: run.style.fontSize, fontWeight: run.style.fontWeight, fontStyle: run.style.italic ? 'italic' : 'normal', textDecoration: [run.style.underline ? 'underline' : '', run.style.strike ? 'line-through' : ''].filter(Boolean).join(' ') || undefined }}>{run.text}</text>)}</g>
}
