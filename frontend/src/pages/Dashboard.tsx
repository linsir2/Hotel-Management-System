import React, { useEffect, useState } from 'react';
import {
  Users,
  BedDouble,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Bell,
  AlertTriangle,
  DollarSign,
  Loader2,
  X,
  CheckCircle2,
  XCircle,
  ChevronRight,
  BarChart3,
} from 'lucide-react';
import { useStore } from '../store/useStore';

const StatCard = ({ icon: Icon, label, value, color }: any) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
    <div className={`p-4 rounded-xl ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
    </div>
  </div>
);

/** small reusable modal shell */
const Modal = ({ title, icon: Icon, onClose, children }: any) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
    <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
      <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 text-purple-500" />}
          {title}
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
      </div>
      <div className="overflow-y-auto p-6">{children}</div>
    </div>
  </div>
);

const Dashboard = () => {
  const { rooms, bookings, fetchRooms, fetchBookings } = useStore();

  useEffect(() => {
    fetchRooms();
    fetchBookings();
  }, [fetchRooms, fetchBookings]);

  // ─── AI summary data (lightweight, loaded on mount) ────────────
  const [aiData, setAiData] = useState<any>({});
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const fetchAiData = async () => {
      setAiLoading(true);
      try {
        const [anomaliesRes, pricingRes, forecastRes, lossesRes] = await Promise.allSettled([
          fetch('/api/ai/anomalies'),
          fetch('/api/ai/price-recs/pending'),
          fetch('/api/ai/forecast?weeks=4'),
          fetch('/api/reports/losses?period=' + new Date().toISOString().slice(0, 7)),
        ]);
        const data: any = {};
        if (anomaliesRes.status === 'fulfilled' && anomaliesRes.value.ok)
          data.anomalies = await anomaliesRes.value.json();
        if (pricingRes.status === 'fulfilled' && pricingRes.value.ok)
          data.pricing = await pricingRes.value.json();
        if (forecastRes.status === 'fulfilled' && forecastRes.value.ok)
          data.forecast = await forecastRes.value.json();
        if (lossesRes.status === 'fulfilled' && lossesRes.value.ok)
          data.losses = await lossesRes.value.json();
        setAiData(data);
      } catch (err) {
        console.error('Failed to fetch AI dashboard data:', err);
      } finally {
        setAiLoading(false);
      }
    };
    fetchAiData();
  }, []);

  const anomalyCount = (aiData.anomalies?.summary?.critical || 0)
    + (aiData.anomalies?.summary?.warning || 0)
    + (aiData.anomalies?.summary?.info || 0);
  const pricingPending = aiData.pricing?.count ?? 0;
  const nextWeekForecast = aiData.forecast?.forecast?.[0];
  const monthlyLoss = aiData.losses?.total_loss ?? 0;

  // ─── Modal states ──────────────────────────────────────────────
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalData, setModalData] = useState<any>(null);

  const openModal = async (key: string, fetchFn?: () => Promise<any>) => {
    setActiveModal(key);
    if (fetchFn) {
      setModalLoading(true);
      try { setModalData(await fetchFn()); } catch (err) { console.error(err); }
      finally { setModalLoading(false); }
    }
  };

  const closeModal = () => { setActiveModal(null); setModalData(null); };

  // ─── Card detail fetchers ──────────────────────────────────────
  const fetchAnomalyDetail = async () => {
    const res = await fetch('/api/ai/anomalies');
    return res.json();
  };

  const fetchPricingDetail = async () => {
    const res = await fetch('/api/ai/price-recs?daysAhead=30');
    return res.json();
  };

  const fetchForecastDetail = async () => {
    const res = await fetch('/api/ai/forecast?weeks=12');
    return res.json();
  };

  const fetchLossDetail = async () => {
    const res = await fetch('/api/reports/losses?period=' + new Date().toISOString().slice(0, 7));
    return res.json();
  };

  const handleApprovePrice = async (id: number) => {
    await fetch(`/api/ai/price-recs/${id}/approve`, { method: 'POST' });
    const data = await fetchPricingDetail();
    setModalData(data);
    const pRes = await fetch('/api/ai/price-recs/pending');
    if (pRes.ok) {
      const pricing = await pRes.json();
      setAiData((prev: any) => ({ ...prev, pricing }));
    }
  };

  const handleRejectPrice = async (id: number) => {
    const reason = prompt('请填写拒绝原因：');
    if (!reason) return;
    await fetch(`/api/ai/price-recs/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const data = await fetchPricingDetail();
    setModalData(data);
    const pRes = await fetch('/api/ai/price-recs/pending');
    if (pRes.ok) {
      const pricing = await pRes.json();
      setAiData((prev: any) => ({ ...prev, pricing }));
    }
  };

  // ─── Core metrics ──────────────────────────────────────────────
  const occupiedRooms = rooms.filter(r => r.status === 'OCCUPIED').length;
  const totalRooms = rooms.length;
  const pendingBookings = bookings.filter(b => b.status === 'PENDING').length;
  const totalRevenue = bookings
    .filter(b => b.status === 'COMPLETED' || b.status === 'CONFIRMED')
    .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  const statusMap: any = {
    CONFIRMED: { label: '入住中', color: 'bg-emerald-50 text-emerald-600' },
    PENDING: { label: '待处理', color: 'bg-blue-50 text-blue-600' },
    COMPLETED: { label: '已退房', color: 'bg-gray-50 text-gray-500' },
    CANCELLED: { label: '已取消', color: 'bg-red-50 text-red-600' },
  };

  const recentBookings = [...bookings].reverse().slice(0, 4);

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">数据概览</h1>
        <p className="text-gray-500">欢迎回来，以下是今日的运营状况。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard icon={BedDouble} label="已入住" value={`${occupiedRooms} / ${totalRooms}`} color="bg-blue-600" />
        <StatCard icon={Users} label="待处理预订" value={pendingBookings} color="bg-emerald-500" />
        <StatCard icon={TrendingUp} label="累计营收" value={`¥ ${totalRevenue.toLocaleString()}`} color="bg-violet-500" />
      </div>

      {/* ═══ AI 智能辅助卡片 ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <h2 className="text-sm font-bold text-purple-600 uppercase tracking-wider">AI 智能辅助</h2>
          {aiLoading && <Loader2 className="w-3 h-3 animate-spin text-purple-400" />}
          <span className="text-[10px] text-gray-400 ml-auto">点击卡片查看详情</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          {/* 1. 异常检测 */}
          <button
            onClick={() => openModal('anomalies', fetchAnomalyDetail)}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-red-200 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${anomalyCount > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                <Bell className={`w-4 h-4 ${anomalyCount > 0 ? 'text-red-500' : 'text-gray-400'}`} />
              </div>
              <div className="flex items-center gap-1">
                {anomalyCount > 0 && (
                  <span className="text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">{anomalyCount}</span>
                )}
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-purple-400 transition-colors" />
              </div>
            </div>
            <p className="text-sm font-bold text-gray-700">异常检测</p>
            <p className="text-xs text-gray-400 mt-1">
              {anomalyCount > 0 ? `${anomalyCount} 条待处理` : '一切正常'}
            </p>
          </button>

          {/* 2. 定价建议 */}
          <button
            onClick={() => openModal('pricing', fetchPricingDetail)}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-purple-200 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${pricingPending > 0 ? 'bg-purple-50' : 'bg-gray-50'}`}>
                <DollarSign className={`w-4 h-4 ${pricingPending > 0 ? 'text-purple-500' : 'text-gray-400'}`} />
              </div>
              <div className="flex items-center gap-1">
                {pricingPending > 0 && (
                  <span className="text-xs font-bold bg-purple-500 text-white px-2 py-0.5 rounded-full">{pricingPending}</span>
                )}
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-purple-400 transition-colors" />
              </div>
            </div>
            <p className="text-sm font-bold text-gray-700">定价建议</p>
            <p className="text-xs text-gray-400 mt-1">
              {pricingPending > 0 ? `${pricingPending} 条待审批` : '暂无建议'}
            </p>
          </button>

          {/* 3. 营收预测 */}
          <button
            onClick={() => openModal('forecast', fetchForecastDetail)}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-blue-50">
                <BarChart3 className="w-4 h-4 text-blue-500" />
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-purple-400 transition-colors" />
            </div>
            <p className="text-sm font-bold text-gray-700">营收预测</p>
            <p className="text-xs text-gray-400 mt-1">
              {nextWeekForecast
                ? `下周预计 ¥${nextWeekForecast.predicted.toLocaleString()}`
                : '加载中...'}
            </p>
          </button>

          {/* 4. 经营损耗 */}
          <button
            onClick={() => openModal('losses', fetchLossDetail)}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-orange-200 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${monthlyLoss > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
                <AlertTriangle className={`w-4 h-4 ${monthlyLoss > 0 ? 'text-orange-500' : 'text-gray-400'}`} />
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-purple-400 transition-colors" />
            </div>
            <p className="text-sm font-bold text-gray-700">经营损耗</p>
            <p className="text-xs text-gray-400 mt-1">
              {monthlyLoss > 0 ? `本月 ¥${monthlyLoss.toLocaleString()}` : '暂无数据'}
            </p>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-4">最近订单</h3>
          <div className="space-y-4">
            {recentBookings.map((booking) => (
              <div key={booking.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    {(booking.guest?.name || '客').charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium">{booking.guest?.name || booking.guestName || '未知住客'}</p>
                    <p className="text-xs text-gray-500">{booking.room?.roomNumber || booking.roomNumber} {booking.room?.type || ''}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                  statusMap[booking.status]?.color || 'bg-gray-50 text-gray-500'
                }`}>
                  {statusMap[booking.status]?.label || '未知'}
                </span>
              </div>
            ))}
            {recentBookings.length === 0 && (
              <div className="text-center text-gray-500 py-8">暂无数据</div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-4">客房状态分布</h3>
          <div className="flex items-center justify-around h-48">
             <div className="flex flex-col items-center gap-2">
               <div className="w-16 h-32 bg-blue-100 rounded-t-lg relative overflow-hidden">
                 <div className="absolute bottom-0 w-full bg-blue-600" style={{ height: `${(rooms.filter(r => r.status === 'AVAILABLE').length / (totalRooms || 1)) * 100}%` }}></div>
               </div>
               <span className="text-xs font-medium">空闲 ({rooms.filter(r => r.status === 'AVAILABLE').length})</span>
             </div>
             <div className="flex flex-col items-center gap-2">
               <div className="w-16 h-32 bg-emerald-100 rounded-t-lg relative overflow-hidden">
                 <div className="absolute bottom-0 w-full bg-emerald-500" style={{ height: `${(rooms.filter(r => r.status === 'OCCUPIED').length / (totalRooms || 1)) * 100}%` }}></div>
               </div>
               <span className="text-xs font-medium">占用 ({rooms.filter(r => r.status === 'OCCUPIED').length})</span>
             </div>
             <div className="flex flex-col items-center gap-2">
               <div className="w-16 h-32 bg-orange-100 rounded-t-lg relative overflow-hidden">
                 <div className="absolute bottom-0 w-full bg-orange-400" style={{ height: `${(rooms.filter(r => r.status === 'MAINTENANCE').length / (totalRooms || 1)) * 100}%` }}></div>
               </div>
               <span className="text-xs font-medium">维修 ({rooms.filter(r => r.status === 'MAINTENANCE').length})</span>
             </div>
          </div>
        </div>
      </div>

      {/* ═══════════════ MODALS ═══════════════ */}

      {/* ── Modal: 异常检测列表 ── */}
      {activeModal === 'anomalies' && (
        <Modal title="异常检测" icon={Bell} onClose={closeModal}>
          {modalLoading ? (
            <div className="flex items-center justify-center py-12 text-purple-600 gap-2">
              <Loader2 className="w-6 h-6 animate-spin" /><span>加载中...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {modalData?.summary && (
                <div className="flex gap-3 text-sm">
                  <span className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold">🔴 严重 {modalData.summary.critical || 0}</span>
                  <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-bold">🟡 警告 {modalData.summary.warning || 0}</span>
                  <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold">🔵 信息 {modalData.summary.info || 0}</span>
                </div>
              )}
              {modalData?.anomalies?.map((a: any) => (
                <div key={a.rule_key} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-800">{a.rule_name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      a.severity === 'critical' ? 'bg-red-100 text-red-600' :
                      a.severity === 'warning' ? 'bg-amber-100 text-amber-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>{a.severity}</span>
                  </div>
                  <p className="text-xs text-gray-500">共 {a.count} 条</p>
                  {a.items?.slice(0, 5).map((item: any, i: number) => {
                    const priceDeviation = item.type_avg_price && item.price
                      ? ((item.price - item.type_avg_price) / item.type_avg_price * 100)
                      : null;
                    return (
                    <div key={i} className="mt-2 text-sm text-gray-600 bg-white rounded-lg p-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {item.room_number && <span className="font-medium">房间 {item.room_number}</span>}
                      {item.type && <span className="text-gray-400 text-xs">{item.type}</span>}
                      {item.guest_name && <span>住客 {item.guest_name}</span>}
                      {item.price && (
                        <span className="font-mono">¥{typeof item.price === 'number' ? item.price.toFixed(2) : item.price}</span>
                      )}
                      {priceDeviation != null && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                          priceDeviation > 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'
                        }`}>
                          {priceDeviation > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {priceDeviation > 0 ? '+' : ''}{priceDeviation.toFixed(1)}%
                          <span className="font-normal text-gray-400 ml-0.5">vs 均价 ¥{Number(item.type_avg_price).toFixed(0)}</span>
                        </span>
                      )}
                      {item.check_in && <span className="text-gray-400 text-xs">{item.check_in?.slice(0,10)}</span>}
                      {item.status && <span className="text-xs">{item.status}</span>}
                    </div>
                    );
                  })}
                </div>
              ))}
              {(!modalData?.anomalies || modalData.anomalies.length === 0) && (
                <div className="text-center text-gray-400 py-8">🎉 未发现任何异常</div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* ── Modal: 定价审批 ── */}
      {activeModal === 'pricing' && (
        <Modal title="AI 定价建议" icon={DollarSign} onClose={closeModal}>
          {modalLoading ? (
            <div className="flex items-center justify-center py-12 text-purple-600 gap-2">
              <Loader2 className="w-6 h-6 animate-spin" /><span>AI 分析中...</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-gray-500 mb-3">
                入住率 {((modalData?.occupancy_rate ?? 0) * 100).toFixed(1)}% · 基于 {modalData?.total_rooms ?? 0} 间房 · 未来 {modalData?.days_ahead ?? 30} 天
              </div>
              {modalData?.recommendations?.map((rec: any) => (
                <div key={rec.id || rec.room_id} className="bg-gray-50 rounded-xl p-4 flex items-center justify-between gap-4 border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900">{rec.room_number || rec.room_id}</span>
                      <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">{rec.room_type}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-500">¥{rec.current_price}</span>
                      <span className="text-gray-300">→</span>
                      <span className="text-purple-600 font-bold">¥{rec.suggested_price}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        (rec.change_pct ?? rec.final_change_pct ?? 0) >= 0
                          ? 'text-red-600 bg-red-50'
                          : 'text-green-600 bg-green-50'
                      }`}>
                        {(rec.change_pct ?? rec.final_change_pct ?? 0) >= 0 ? <TrendingUp className="w-3 h-3 inline" /> : <TrendingDown className="w-3 h-3 inline" />}
                        {' '}{rec.change_pct ?? rec.final_change_pct ?? 0}%
                      </span>
                    </div>
                  </div>
                  {(rec.status === 'PENDING' || rec.status == null) ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => handleApprovePrice(rec.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 同意
                      </button>
                      <button onClick={() => handleRejectPrice(rec.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-600 text-xs font-bold rounded-lg hover:bg-red-200">
                        <XCircle className="w-3.5 h-3.5" /> 拒绝
                      </button>
                    </div>
                  ) : (
                    <span className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${
                      rec.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}>{rec.status === 'APPROVED' ? '已采纳' : '已拒绝'}</span>
                  )}
                </div>
              ))}
              {(!modalData?.recommendations || modalData.recommendations.length === 0) && (
                <div className="text-center text-gray-400 py-8">暂无定价建议</div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* ── Modal: 营收预测 ── */}
      {activeModal === 'forecast' && (
        <Modal title="营收预测" icon={BarChart3} onClose={closeModal}>
          {modalLoading ? (
            <div className="flex items-center justify-center py-12 text-purple-600 gap-2">
              <Loader2 className="w-6 h-6 animate-spin" /><span>预测计算中...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* summary line */}
              <div className="flex gap-4 text-sm flex-wrap">
                <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-bold">
                  模型: {modalData?.model || 'N/A'}
                </span>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                  历史数据: {modalData?.data_weeks || 0} 周
                </span>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                  MAPE: {modalData?.mape != null ? (modalData.mape * 100).toFixed(1) + '%' : 'N/A'}
                </span>
              </div>

              {/* simple bar chart */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-bold text-gray-500 mb-3 uppercase">周营收趋势</p>
                <div className="flex items-end gap-1 h-32">
                  {/* historical bars */}
                  {modalData?.historical?.map((h: any, i: number) => (
                    <div key={'h'+i} className="flex-1 flex flex-col items-center" title={`${h.week_start}: ¥${h.revenue.toLocaleString()}`}>
                      <div className="w-full bg-blue-500 rounded-t" style={{ height: `${Math.max(4, (h.revenue / (modalData?.historical?.[0]?.revenue || 1)) * 80)}%` }}></div>
                      <span className="text-[8px] text-gray-400 mt-1 truncate w-full text-center">{h.week_start.slice(5)}</span>
                    </div>
                  ))}
                  {/* separator */}
                  {modalData?.historical?.length > 0 && <div className="w-0.5 h-full bg-gray-300 mx-1"></div>}
                  {/* forecast bars */}
                  {modalData?.forecast?.map((f: any, i: number) => (
                    <div key={'f'+i} className="flex-1 flex flex-col items-center" title={`${f.week_start}: ¥${f.predicted.toLocaleString()} (80% CI: ¥${f.lower_bound.toLocaleString()}-¥${f.upper_bound.toLocaleString()})`}>
                      <div className="w-full bg-purple-300 rounded-t border border-purple-400 border-dashed" style={{ height: `${Math.max(4, (f.predicted / (modalData?.historical?.[0]?.revenue || 1)) * 80)}%` }}></div>
                      <span className="text-[8px] text-gray-400 mt-1 truncate w-full text-center">{f.week_start.slice(5)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-4 text-xs text-gray-400 justify-center">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded"></span> 历史</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-purple-300 border border-dashed border-purple-400 rounded"></span> 预测</span>
                </div>
              </div>

              {/* table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b">
                      <th className="pb-2">周</th>
                      <th className="pb-2 text-right">预测</th>
                      <th className="pb-2 text-right">下限 (80%)</th>
                      <th className="pb-2 text-right">上限 (80%)</th>
                      <th className="pb-2 text-center">置信度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData?.forecast?.map((f: any) => (
                      <tr key={f.week_start} className="border-b border-gray-50 hover:bg-purple-50/30">
                        <td className="py-2 font-medium">{f.week_start}</td>
                        <td className="py-2 text-right font-bold text-purple-600">¥{f.predicted.toLocaleString()}</td>
                        <td className="py-2 text-right text-gray-400">¥{f.lower_bound.toLocaleString()}</td>
                        <td className="py-2 text-right text-gray-400">¥{f.upper_bound.toLocaleString()}</td>
                        <td className="py-2 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            f.confidence === 'low' ? 'bg-red-50 text-red-500' :
                            f.confidence === 'medium' ? 'bg-amber-50 text-amber-500' :
                            'bg-emerald-50 text-emerald-500'
                          }`}>{f.confidence === 'low' ? '低' : f.confidence === 'medium' ? '中' : '高'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {modalData?.notable_events?.length > 0 && (
                <div className="text-xs text-gray-500 bg-amber-50 rounded-lg p-3">
                  ⚡ 预测期内有 {modalData.notable_events.length} 个特殊事件可能影响营收
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* ── Modal: 经营损耗 ── */}
      {activeModal === 'losses' && (
        <Modal title="经营损耗盘点" icon={AlertTriangle} onClose={closeModal}>
          {modalLoading ? (
            <div className="flex items-center justify-center py-12 text-purple-600 gap-2">
              <Loader2 className="w-6 h-6 animate-spin" /><span>加载中...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-2xl font-bold text-red-600 text-center py-2">
                ¥{modalData?.total_loss?.toLocaleString() ?? 0}
                <p className="text-xs font-normal text-gray-400 mt-1">
                  {modalData?.period || ''} 总损耗
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-red-50 rounded-xl p-4">
                  <p className="text-lg font-bold text-red-600">¥{(modalData?.breakdown?.price_mismatch?.amount || 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">错价损耗</p>
                  <p className="text-[10px] text-gray-400">{modalData?.breakdown?.price_mismatch?.pct || 0}%</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-4">
                  <p className="text-lg font-bold text-amber-600">¥{(modalData?.breakdown?.vacancy?.amount || 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">空房损耗</p>
                  <p className="text-[10px] text-gray-400">{modalData?.breakdown?.vacancy?.pct || 0}%</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4">
                  <p className="text-lg font-bold text-orange-600">¥{(modalData?.breakdown?.anomaly_order?.amount || 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">异常订单</p>
                  <p className="text-[10px] text-gray-400">{modalData?.breakdown?.anomaly_order?.pct || 0}%</p>
                </div>
              </div>

              {/* vacancy details */}
              {modalData?.breakdown?.vacancy?.room_details && (
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-2">空房明细</p>
                  <div className="text-xs text-gray-500 mb-2">
                    {modalData.breakdown.vacancy.occupied_nights} 间夜已入住 / {modalData.breakdown.vacancy.total_room_nights} 总间夜 · 均价 ¥{modalData.breakdown.vacancy.avg_price?.toLocaleString()}
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {modalData.breakdown.vacancy.room_details.map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                        <span className="font-medium">{r.room_number} <span className="text-gray-400">{r.type}</span></span>
                        <span className="text-xs text-gray-500">
                          <span className="text-emerald-500">{r.occupied}晚占用</span> / <span className="text-red-400">{r.vacant}晚空置</span> · ¥{r.price}/晚
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* anomaly orders */}
              {modalData?.breakdown?.anomaly_order?.orders?.length > 0 && (
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-2">异常订单</p>
                  {modalData.breakdown.anomaly_order.orders.map((o: any) => (
                    <div key={o.id} className="bg-gray-50 rounded-lg px-3 py-2 text-sm flex items-center justify-between">
                      <span>{o.guest_name} · 房间{o.room_number}</span>
                      <span className="text-red-500 font-bold">¥{o.total_amount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

export default Dashboard;
