import { PageHead } from "../components/ui";
import { Icon } from "../components/fx";
import ictModels from "../algorithms/ict-models-strategy.pine?raw";
import quarterly from "../algorithms/dayes-quarterly-theory.pine?raw";
import liquidity from "../algorithms/liquidity-model.pine?raw";

interface Algo { id: string; name: string; desc: string; file: string; code: string; }

const ALGOS: Algo[] = [
  { id: "ict-models", name: "ICT Models Strategy", desc: "Core ICT setups — order blocks, FVGs, liquidity sweeps and model entries — as a TradingView Pine strategy.", file: "ict-models-strategy.pine", code: ictModels },
  { id: "quarterly", name: "Daye's Quarterly Theory", desc: "Quarterly theory time-and-price framework for session and dealing-range analysis.", file: "dayes-quarterly-theory.pine", code: quarterly },
  { id: "liquidity", name: "Liquidity Model", desc: "Liquidity-driven draw-on-liquidity model with displacement and MSS confirmation.", file: "liquidity-model.pine", code: liquidity },
];

function download(name: string, code: string) {
  const blob = new Blob([code], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function Algorithms() {
  return (
    <>
      <PageHead eyebrow="Pro tools" title="Trading algorithms" lede="Download these ICT strategies as TradingView Pine scripts, then paste them into Pine Editor to backtest and alert." />
      <div className="grid g2">
        {ALGOS.map((a) => (
          <div className="card" key={a.id}>
            <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon name="candlestick-chart" size={18} /> {a.name}</h3>
            <p className="muted" style={{ marginTop: 4 }}>{a.desc}</p>
            <div className="row" style={{ marginTop: 12 }}>
              <button type="button" className="btn" onClick={() => download(a.file, a.code)}><Icon name="upload" size={15} /> Download .pine</button>
              <span className="muted" style={{ fontFamily: "var(--f-mono)", fontSize: 12, alignSelf: "center" }}>{(a.code.length / 1024).toFixed(1)} KB</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
