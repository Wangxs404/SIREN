import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";

const ThreeRiserView = lazy(() => import("./ThreeRiserView"));

type CaseType = "uniform_flow" | "oscillating_flow" | "vessel_induced_flow";
type RunStatus = "idle" | "queued" | "running" | "completed" | "failed" | "cancelled";
type Point = [number, number, number];
type AnimationFrame = { time: number; positions: Point[] };
type HistoryPoint = { time: number; x: number; y: number };
type ViewType = "wire" | "3d" | "section";
type ObjectId = "case" | "environment" | "fluid" | "riser" | "section" | "top_boundary" | "bottom_boundary" | "time_domain" | "outputs";

type Config = {
  case_type: CaseType; name: string;
  structure: { length: number; outer_diameter: number; inner_diameter: number; top_tension: number; mass_per_length: number; youngs_modulus: number; poisson_ratio: number; damping_ratio: number; element_count: number };
  environment: { fluid_density: number; velocity: number; strouhal_number: number; cd_average: number; oscillation_amplitude: number; oscillation_frequency: number };
  solver: { end_time: number; time_step: number; output_interval: number; animation_stride: number };
  boundary: { top: "tensioned" | "motion_input"; bottom: "fixed" | "pinned" };
};

const API = import.meta.env.DEV ? "http://127.0.0.1:8000" : "";
const initialConfig: Config = { case_type: "uniform_flow", name: "Case1103-VIV", structure: { length: 9.63, outer_diameter: .02, inner_diameter: .0191, top_tension: 817, mass_per_length: .699, youngs_modulus: 1.025e11, poisson_ratio: .3, damping_ratio: 0, element_count: 18 }, environment: { fluid_density: 1025, velocity: .2, strouhal_number: .14, cd_average: 1.2, oscillation_amplitude: 0, oscillation_frequency: 0 }, solver: { end_time: 35, time_step: .01, output_interval: .05, animation_stride: 1 }, boundary: { top: "tensioned", bottom: "fixed" } };

function Chart({ option, className = "chart" }: { option: echarts.EChartsOption; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  useEffect(() => { if (!ref.current) return; const chart = echarts.init(ref.current); chartRef.current = chart; const resize = () => chart.resize(); window.addEventListener("resize", resize); return () => { window.removeEventListener("resize", resize); chart.dispose(); chartRef.current = null; }; }, []);
  useEffect(() => { chartRef.current?.setOption(option, { notMerge: true, lazyUpdate: true }); }, [option]);
  return <div ref={ref} className={className} />;
}

function ModelGroup({ label, expanded, onToggle, children }: { label: string; expanded: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <div className="tree-group"><button className="tree-group-button" aria-expanded={expanded} onClick={onToggle}><span className="tree-chevron">{expanded ? "⌄" : "›"}</span><span>▤</span><b>{label}</b></button>{expanded && <div className="tree-children">{children}</div>}</div>;
}

function ModelItem({ label, icon, selected, onClick }: { label: string; icon: string; selected: boolean; onClick: () => void }) {
  return <button className={`tree-item${selected ? " selected" : ""}`} aria-current={selected ? "page" : undefined} onClick={onClick}><span>{icon}</span><span>{label}</span></button>;
}

function PropertyEditor({ object, config, update }: { object: ObjectId; config: Config; update: (path: string, value: number | string) => void }) {
  const titles: Record<ObjectId, string> = { case: "工况", environment: "环境", fluid: "流体与尾流模型", riser: "Riser / 立管", section: "截面属性", top_boundary: "顶部边界", bottom_boundary: "底部边界", time_domain: "时域求解", outputs: "输出与后处理" };
  return <aside className="pane properties"><div className="pane-head">对象数据 <small>{titles[object]}</small></div><div className="property-content">
    {object === "case" && <><h3>工况设置</h3><label className="form-row"><span>工况名称</span><div><input value={config.name} onChange={(e) => update("name", e.target.value)} /></div></label><FormRow label="计算类型"><select value={config.case_type} onChange={(e) => update("case_type", e.target.value)}><option value="uniform_flow">均匀流</option><option value="oscillating_flow">振荡流</option><option value="vessel_induced_flow">船舶运动诱导流</option></select></FormRow><div className="property-note">参数将随工况保存，并用于启动计算。</div></>}
    {(object === "environment" || object === "fluid") && <><h3>{object === "environment" ? "流场参数" : "流体与尾流参数"}</h3>{object === "environment" && <><FormRow label="流体密度" value={config.environment.fluid_density} unit="kg/m³" onChange={(v) => update("environment.fluid_density", v)} /><FormRow label="来流速度" value={config.environment.velocity} unit="m/s" onChange={(v) => update("environment.velocity", v)} /><FormRow label="振荡幅值" value={config.environment.oscillation_amplitude} unit="m" onChange={(v) => update("environment.oscillation_amplitude", v)} /><FormRow label="振荡频率" value={config.environment.oscillation_frequency} unit="Hz" onChange={(v) => update("environment.oscillation_frequency", v)} /></>}{object === "fluid" && <><FormRow label="Strouhal 数" value={config.environment.strouhal_number} onChange={(v) => update("environment.strouhal_number", v)} /><FormRow label="平均阻力系数 Cd" value={config.environment.cd_average} onChange={(v) => update("environment.cd_average", v)} /></>}</>}
    {object === "riser" && <><h3>结构 · 基本数据</h3><FormRow label="长度 L" value={config.structure.length} unit="m" onChange={(v) => update("structure.length", v)} /><FormRow label="单位长度质量" value={config.structure.mass_per_length} unit="kg/m" onChange={(v) => update("structure.mass_per_length", v)} /><FormRow label="顶部张力 T₀" value={config.structure.top_tension} unit="N" onChange={(v) => update("structure.top_tension", v)} /></>}
    {object === "section" && <><h3>截面与材料</h3><FormRow label="外径 D" value={config.structure.outer_diameter} unit="m" onChange={(v) => update("structure.outer_diameter", v)} /><FormRow label="内径 d" value={config.structure.inner_diameter} unit="m" onChange={(v) => update("structure.inner_diameter", v)} /><FormRow label="杨氏模量 E" value={config.structure.youngs_modulus} unit="Pa" onChange={(v) => update("structure.youngs_modulus", v)} /><FormRow label="泊松比 ν" value={config.structure.poisson_ratio} onChange={(v) => update("structure.poisson_ratio", v)} /><FormRow label="阻尼比 ζ" value={config.structure.damping_ratio} onChange={(v) => update("structure.damping_ratio", v)} /></>}
    {object === "top_boundary" && <><h3>顶部约束</h3><FormRow label="边界类型"><select value={config.boundary.top} onChange={(e) => update("boundary.top", e.target.value)}><option value="tensioned">约束 + 顶张力</option><option value="motion_input">运动输入</option></select></FormRow><FormRow label="顶张力 T₀" value={config.structure.top_tension} unit="N" onChange={(v) => update("structure.top_tension", v)} />{config.boundary.top === "motion_input" && <div className="property-note">运动输入时程数据接口待配置。</div>}</>}
    {object === "bottom_boundary" && <><h3>底部约束</h3><FormRow label="边界类型"><select value={config.boundary.bottom} onChange={(e) => update("boundary.bottom", e.target.value)}><option value="fixed">固支</option><option value="pinned">铰支</option></select></FormRow></>}
    {object === "time_domain" && <><h3>时域求解参数</h3><FormRow label="单元数 N" value={config.structure.element_count} onChange={(v) => update("structure.element_count", v)} /><FormRow label="总时间 ET" value={config.solver.end_time} unit="s" onChange={(v) => update("solver.end_time", v)} /><FormRow label="时间步长 h" value={config.solver.time_step} unit="s" onChange={(v) => update("solver.time_step", v)} /></>}
    {object === "outputs" && <><h3>输出设置</h3><FormRow label="输出间隔" value={config.solver.output_interval} unit="s" onChange={(v) => update("solver.output_interval", v)} /><FormRow label="动画帧步长" value={config.solver.animation_stride} onChange={(v) => update("solver.animation_stride", v)} /><div className="property-note">时程、RMS、FFT 和动画结果在计算后归档。</div></>}
  </div></aside>;
}

function App() {
  const [config, setConfig] = useState(initialConfig);
  const [status, setStatus] = useState<RunStatus>("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [runId, setRunId] = useState("");
  const [progress, setProgress] = useState(0);
  const [simTime, setSimTime] = useState(0);
  const [frames, setFrames] = useState<Point[]>([]);
  const frameBuffer = useRef<AnimationFrame[]>([]);
  const liveHistoryBuffer = useRef<HistoryPoint[]>([]);
  const [liveHistory, setLiveHistory] = useState<HistoryPoint[]>([]);
  const [fullHistory, setFullHistory] = useState<HistoryPoint[]>([]);
  const [frameSequence, setFrameSequence] = useState<AnimationFrame[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [view, setView] = useState<ViewType>("wire");
  const [selectedObject, setSelectedObject] = useState<ObjectId>("riser");
  const [expandedGroups, setExpandedGroups] = useState({ environment: true, structure: true, boundary: true, analysis: true });
  const [rms, setRms] = useState<number[]>([]);
  const [frequencies, setFrequencies] = useState<number[]>([]);
  const [spectrum, setSpectrum] = useState<number[]>([]);
  const [message, setMessage] = useState("就绪 · 等待运行");

  const update = (path: string, value: number | string) => {
    setConfig((old) => { const next = structuredClone(old) as Config; if (path === "name") next.name = String(value); else if (path === "case_type") next.case_type = value as CaseType; else { const [group, field] = path.split(".") as ["structure" | "environment" | "solver" | "boundary", string]; (next[group] as Record<string, number | string>)[field] = value; } return next; });
  };
  const toggleGroup = (group: keyof typeof expandedGroups) => setExpandedGroups((current) => ({ ...current, [group]: !current[group] }));
  const createNewCase = () => { setConfig(structuredClone(initialConfig)); setSelectedObject("case"); setRunId(""); setProgress(0); setSimTime(0); setStatus("idle"); setFrames([]); setFrameSequence([]); setFrameIndex(0); setIsPlaying(false); setLiveHistory([]); setFullHistory([]); setRms([]); setFrequencies([]); setSpectrum([]); setMessage("新工况已创建"); };
  const saveCase = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${config.name || "SIREN-case"}.json`; anchor.click(); URL.revokeObjectURL(url);
    setMessage("工况配置已保存");
  };
  const openCase = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Partial<Config>;
      if (!parsed.structure || !parsed.environment || !parsed.solver || !parsed.boundary) throw new Error("配置文件缺少必要参数组");
      const loaded: Config = { ...initialConfig, ...parsed, structure: { ...initialConfig.structure, ...parsed.structure }, environment: { ...initialConfig.environment, ...parsed.environment }, solver: { ...initialConfig.solver, ...parsed.solver }, boundary: { ...initialConfig.boundary, ...parsed.boundary } };
      if (typeof loaded.name !== "string" || !["uniform_flow", "oscillating_flow", "vessel_induced_flow"].includes(loaded.case_type)) throw new Error("工况名称或类型无效");
      const numericGroups = [loaded.structure, loaded.environment, loaded.solver];
      if (numericGroups.some((group) => Object.values(group).some((value) => typeof value !== "number" || !Number.isFinite(value)))) throw new Error("参数中包含无效数值");
      setConfig(loaded); setSelectedObject("case"); setMessage(`已打开 ${file.name}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "配置文件读取失败"); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const validation = useMemo(() => { const errors: string[] = []; if (config.structure.inner_diameter >= config.structure.outer_diameter) errors.push("内径必须小于外径"); if (config.solver.output_interval < config.solver.time_step) errors.push("输出间隔必须不小于时间步长"); if (config.structure.element_count < 2) errors.push("单元数至少为 2"); return errors; }, [config]);

  const run = async () => {
    if (validation.length) { setMessage(validation[0]); return; }
    setStatus("queued"); setProgress(0); setLiveHistory([]); setFullHistory([]); liveHistoryBuffer.current = []; setRms([]); setFrequencies([]); setSpectrum([]); setMessage("正在创建计算任务…");
    frameBuffer.current = []; setFrameSequence([]); setFrameIndex(0); setFrames([]); setIsPlaying(false);
    try {
      const response = await fetch(`${API}/api/runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
      if (!response.ok) throw new Error(await response.text());
      const run = await response.json(); setRunId(run.run_id); setStatus("running"); setMessage(`运行中 · ${run.run_id}`);
      const socketProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${socketProtocol}//${window.location.host}/api/runs/${run.run_id}/events`);
      const historyTimer = window.setInterval(() => setLiveHistory([...liveHistoryBuffer.current]), 100);
      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type === "progress") { setProgress(payload.progress); setSimTime(payload.simulation_time); setStatus(payload.status); }
        if (payload.type === "frame") {
          const frame = { time: Number(payload.time), positions: payload.positions as Point[] };
          frameBuffer.current.push(frame);
          const mid = frame.positions[Math.floor(frame.positions.length / 2)];
          if (mid) liveHistoryBuffer.current.push({ time: frame.time, x: mid[0], y: mid[1] });
          setFrames(frame.positions);
        }
      };
      socket.onclose = async () => {
        window.clearInterval(historyTimer);
        setLiveHistory([...liveHistoryBuffer.current]);
        const collected = frameBuffer.current;
        setFrameSequence(collected);
        setFrameIndex(0);
        setIsPlaying(collected.length > 1);
        const summary = await fetch(`${API}/api/runs/${run.run_id}/summary`);
        if (summary.ok) { setStatus("completed"); setMessage(`计算完成 · 收到 ${collected.length} 帧，可回放演化过程`); }
      };
    } catch (error) { setStatus("failed"); setMessage(error instanceof Error ? error.message : "后端连接失败"); }
  };

  useEffect(() => {
    if (!isPlaying || frameSequence.length < 2) return;
    const timer = window.setInterval(() => {
      setFrameIndex((index) => {
        if (index >= frameSequence.length - 1) { setIsPlaying(false); return index; }
        return index + 1;
      });
    }, 100 / playbackSpeed);
    return () => window.clearInterval(timer);
  }, [isPlaying, frameSequence.length, playbackSpeed]);

  const displayedFrame = frameSequence[frameIndex] ?? (frames.length ? { time: simTime, positions: frames } : undefined);
  const displayedPositions = displayedFrame?.positions ?? [];
  const pipePath = useMemo(() => {
    if (displayedPositions.length < 2) return "M320 40 C325 95 370 145 450 185 S600 255 670 310";
    const maxLateral = Math.max(0.001, ...displayedPositions.flatMap(([x, y]) => [Math.abs(x), Math.abs(y)]));
    const scale = Math.min(2500, 45 / maxLateral);
    const coords = displayedPositions.map(([x, y, z]) => {
      const vertical = 318 - (z / config.structure.length) * 278;
      const lateral = view === "section" ? x : y;
      return [400 + lateral * scale, vertical];
    });
    return coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  }, [displayedPositions, config.structure.length, config.structure.outer_diameter, view]);

  const playPause = () => {
    if (!frameSequence.length) { setMessage("请先运行计算，生成可回放的动态帧"); return; }
    if (!isPlaying && frameIndex >= frameSequence.length - 1) setFrameIndex(0);
    setIsPlaying((value) => !value);
  };

  const seekFrame = (value: number) => {
    setFrameIndex(value);
    if (frameSequence[value]) setSimTime(frameSequence[value].time);
  };

  useEffect(() => { if (!runId || status !== "completed") return; fetch(`${API}/api/runs/${runId}/results/time_history`).then((r) => r.json()).then((data) => { const targetNode = Math.floor(config.structure.element_count / 2); const rows = data.csv.trim().split("\n").slice(1).map((line: string) => line.split(",").map(Number)).filter((row: number[]) => row[1] === targetNode); setFullHistory(rows.map((row: number[]) => ({ time: row[0], x: row[3], y: row[4] }))); }); fetch(`${API}/api/runs/${runId}/results/rms_profile`).then((r) => r.json()).then((data) => { const rows = data.csv.trim().split("\n").slice(1).map((line: string) => line.split(",").map(Number)); setRms(rows.map((row: number[]) => row[2])); }); fetch(`${API}/api/runs/${runId}/results/fft`).then((r) => r.json()).then((data) => { const rows = data.csv.trim().split("\n").slice(1).map((line: string) => line.split(",").map(Number)); setFrequencies(rows.map((row: number[]) => row[0])); setSpectrum(rows.map((row: number[]) => row[1])); }); }, [runId, status, config.structure.element_count]);

  const historyForPlot = useMemo(() => {
    const source = fullHistory.length ? fullHistory : liveHistory;
    const cutoff = fullHistory.length && status === "completed" ? (displayedFrame?.time ?? simTime) : Number.POSITIVE_INFINITY;
    let low = 0, high = source.length;
    while (low < high) { const mid = (low + high) >>> 1; if (source[mid].time <= cutoff) low = mid + 1; else high = mid; }
    const end = Math.max(1, low);
    const stride = Math.max(1, Math.ceil(end / 1600));
    const rows = source.slice(0, end).filter((_, index) => index % stride === 0 || index === end - 1);
    const diameter = Math.max(config.structure.outer_diameter, 1e-9);
    return { x: rows.map((p) => [p.time, p.x / diameter]), y: rows.map((p) => [p.time, p.y / diameter]), resultant: rows.map((p) => [p.time, Math.hypot(p.x, p.y) / diameter]) };
  }, [fullHistory, liveHistory, status, displayedFrame?.time, simTime, config.structure.outer_diameter]);
  const timeOption = useMemo((): echarts.EChartsOption => ({ animation: false, grid: { left: 48, right: 16, top: 38, bottom: 34 }, tooltip: { trigger: "axis", axisPointer: { type: "cross" } }, legend: { top: 4, itemWidth: 16, itemHeight: 8, textStyle: { color: "#52616d", fontSize: 10 } }, xAxis: { type: "value", name: "时间 / s", nameLocation: "middle", nameGap: 22, min: 0, axisLabel: { color: "#637080" }, splitLine: { lineStyle: { color: "#edf0f2" } } }, yAxis: { type: "value", name: "位移 / D", nameTextStyle: { color: "#637080" }, axisLabel: { color: "#637080" }, splitLine: { lineStyle: { color: "#e8edf1" } } }, series: [{ name: "X 向位移", type: "line", showSymbol: false, data: historyForPlot.x, lineStyle: { color: "#397fc0", width: 2, type: "solid" } }, { name: "Y 向位移", type: "line", showSymbol: false, data: historyForPlot.y, lineStyle: { color: "#d27a28", width: 2, type: "dashed" } }, { name: "合位移", type: "line", showSymbol: false, data: historyForPlot.resultant, lineStyle: { color: "#188b83", width: 1.8, type: "dotted" } }] }), [historyForPlot]);
  const rmsOption = useMemo((): echarts.EChartsOption => ({ grid: { left: 42, right: 12, top: 10, bottom: 28 }, tooltip: { trigger: "axis" }, xAxis: { type: "category", data: rms.map((_, i) => (i / Math.max(rms.length - 1, 1)).toFixed(2)), name: "z / L", nameLocation: "middle", nameGap: 17, axisLabel: { color: "#637080" } }, yAxis: { type: "value", axisLabel: { color: "#637080" }, splitLine: { lineStyle: { color: "#edf0f2" } } }, series: [{ type: "line", showSymbol: false, data: rms.map((v) => v / config.structure.outer_diameter), lineStyle: { color: "#d27a28", width: 2 } }] }), [rms, config.structure.outer_diameter]);
  const fftOption = useMemo((): echarts.EChartsOption => ({ grid: { left: 42, right: 12, top: 10, bottom: 28 }, tooltip: { trigger: "axis" }, xAxis: { type: "category", data: frequencies.map((v) => v.toFixed(2)), name: "Hz", nameLocation: "middle", nameGap: 17, axisLabel: { color: "#637080" } }, yAxis: { type: "value", axisLabel: { color: "#637080" }, splitLine: { lineStyle: { color: "#edf0f2" } } }, series: [{ type: "line", showSymbol: false, data: spectrum, lineStyle: { color: "#6b5ca5", width: 2 }, areaStyle: { color: "#e8e2f5" } }] }), [frequencies, spectrum]);

  return <div className="app">
    <header className="titlebar"><div className="brand-lockup"><img className="appmark" src="/siren-logo.jpg" alt="SIREN 标志" /><div className="brand-copy"><div className="brand-name"><strong>SIREN</strong><span>— {config.name}</span></div><div className="brand-tagline"><span><b>S</b>lender-structure vortex-<b>I</b>nduced vibration　<b>R</b>esponse <b>E</b>valuation and predictio<b>N</b> software</span></div></div></div><div className="window-actions">—　□　×</div></header>
    <nav className="menubar">文件　 编辑　 视图　 模型　 计算　 结果　 工具　 帮助</nav>
    <div className="toolbar"><button className="primary" title="新建工况" onClick={createNewCase}>▣ 新建</button><button title="打开 JSON 工况文件" onClick={() => fileInputRef.current?.click()}>▤ 打开</button><button title="保存当前工况为 JSON" onClick={saveCase}>▥ 保存</button><input ref={fileInputRef} className="hidden-file-input" type="file" accept=".json,application/json" onChange={(e) => void openCase(e.target.files?.[0])} /><i /> <button title={validation.length ? validation.join("；") : "参数完整，可运行"} onClick={() => setMessage(validation.length ? validation.join("；") : "校验通过")}>✓ 校验</button><button className="primary" title={message} onClick={run}>▶ 运行</button><button title="停止当前运行" onClick={() => runId && fetch(`${API}/api/runs/${runId}/cancel`, { method: "POST" }).then(() => { setStatus("cancelled"); setMessage("任务已取消"); })}>■ 停止</button><i /><span>单位制：</span><select><option>SI (m, N, s)</option></select></div>
    <div className="workspace"><aside className="pane browser"><div className="pane-head">模型浏览器 <small>⋮</small></div><div className="tree">
      <ModelItem label={config.name} icon="▣" selected={selectedObject === "case"} onClick={() => setSelectedObject("case")} />
      <ModelGroup label="环境" expanded={expandedGroups.environment} onToggle={() => toggleGroup("environment")}>
        <ModelItem label={config.case_type === "uniform_flow" ? "均匀流场" : config.case_type === "oscillating_flow" ? "振荡流场" : "船舶运动诱导流"} icon="≈" selected={selectedObject === "environment"} onClick={() => setSelectedObject("environment")} />
        <ModelItem label="流体与尾流模型" icon="⇢" selected={selectedObject === "fluid"} onClick={() => setSelectedObject("fluid")} />
      </ModelGroup>
      <ModelGroup label="结构" expanded={expandedGroups.structure} onToggle={() => toggleGroup("structure")}>
        <ModelItem label="Riser / 立管" icon="╎" selected={selectedObject === "riser"} onClick={() => setSelectedObject("riser")} />
        <ModelItem label="截面属性" icon="▤" selected={selectedObject === "section"} onClick={() => setSelectedObject("section")} />
      </ModelGroup>
      <ModelGroup label="边界与载荷" expanded={expandedGroups.boundary} onToggle={() => toggleGroup("boundary")}>
        <ModelItem label="顶部边界" icon="↕" selected={selectedObject === "top_boundary"} onClick={() => setSelectedObject("top_boundary")} />
        <ModelItem label="底部边界" icon="⌂" selected={selectedObject === "bottom_boundary"} onClick={() => setSelectedObject("bottom_boundary")} />
      </ModelGroup>
      <ModelGroup label="分析设置" expanded={expandedGroups.analysis} onToggle={() => toggleGroup("analysis")}>
        <ModelItem label="时域求解" icon="◌" selected={selectedObject === "time_domain"} onClick={() => setSelectedObject("time_domain")} />
        <ModelItem label="输出与后处理" icon="▦" selected={selectedObject === "outputs"} onClick={() => setSelectedObject("outputs")} />
      </ModelGroup>
    </div></aside>
      <main className="center">
        <section className="model-view pane">
          <div className="tabs">
            <button className={view === "wire" ? "active" : ""} onClick={() => setView("wire")} aria-label="线框视图">线框视图</button>
            <button className={view === "3d" ? "active" : ""} onClick={() => setView("3d")} aria-label="三维视图">三维视图</button>
            <button className={view === "section" ? "active" : ""} onClick={() => setView("section")} aria-label="剖面视图">剖面视图</button>
            <span>当前时刻：{(displayedFrame?.time ?? simTime).toFixed(2)} s · {Math.round(progress * 100)}%</span>
          </div>
          {view === "3d" ? <Suspense fallback={<div className="three-loading">正在载入三维模型…</div>}><ThreeRiserView positions={displayedPositions} length={config.structure.length} diameter={config.structure.outer_diameter} /></Suspense> : <div className={`drawing view-${view}`}>
            <svg viewBox="0 0 800 350" preserveAspectRatio="none" aria-label={`${view} 立管响应图`}>
              <line x1="80" y1="40" x2="720" y2="40" />
              <line x1="80" y1="318" x2="720" y2="318" />
              <path d={pipePath} className="riser" />
              <circle cx="400" cy="40" r="6" className="top-node" />
              <circle cx="400" cy="318" r="6" className="bottom-node" />
              <text x="332" y="35">顶部连接 · T₀ = {config.structure.top_tension} N</text>
              <text x="678" y="316">底部</text>
              <text x="385" y="136" className="blue-label">Riser / 立管</text>
            </svg>
            <div className="legend">— 立管中心线<br/><em>●</em> 选中连接点<br/><small>{view === "section" ? "XZ 纵剖面" : "YZ 正投影"}</small></div>
            <div className="drawing-label">{view === "section" ? "XZ 剖面视图" : "线框视图"} · {status === "running" ? "计算中，完成后可回放" : "动态结果回放"}</div>
          </div>}
          <div className="playback-bar">
            <button className="play-button" onClick={playPause} disabled={frameSequence.length < 2} aria-label={isPlaying ? "暂停动画" : "播放动画"}>{isPlaying ? "Ⅱ 暂停" : "▶ 播放"}</button>
            <input aria-label="动画时间轴" type="range" min="0" max={Math.max(frameSequence.length - 1, 0)} value={Math.min(frameIndex, Math.max(frameSequence.length - 1, 0))} disabled={!frameSequence.length} onChange={(event) => seekFrame(Number(event.target.value))} />
            <span className="frame-counter">{frameSequence.length ? `${frameIndex + 1} / ${frameSequence.length}` : "等待计算帧"}</span>
            <select aria-label="动画播放速度" value={playbackSpeed} onChange={(event) => setPlaybackSpeed(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select>
          </div>
        </section>
        <section className="results pane"><div className="charts"><div className="chart-panel time-panel"><h4>时程响应 · 跨中节点 {Math.floor(config.structure.element_count / 2)} · X / Y / 合位移</h4><Chart option={timeOption} /></div><div className="side-results"><div className="chart-panel"><h4>RMS 沿程 · RMS / D</h4><Chart option={rmsOption} /></div><div className="chart-panel"><h4>频谱 · 跨中节点</h4><Chart option={fftOption} /></div></div></div></section>
      </main>
      <PropertyEditor object={selectedObject} config={config} update={update} />
    </div></div>;
}

function FormRow({ label, value, unit, onChange, children }: { label: string; value?: number | string; unit?: string; onChange?: (value: number) => void; children?: React.ReactNode }) { return <label className="form-row"><span>{label}</span><div>{children ?? <input type="number" value={value} onChange={(e) => onChange?.(Number(e.target.value))} />} {unit && <em>{unit}</em>}</div></label>; }

export default App;
