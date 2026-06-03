import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  BedDouble,
  X,
  Trash2,
  Sparkles,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Room } from '../types';
import PasswordVerifyModal from '../components/PasswordVerifyModal';
import AISearchToggle from '../components/AISearchToggle';
import { useAISearch } from '../hooks/useAISearch';

const Rooms = () => {
  const { rooms, fetchRooms, addRoom, updateRoom, deleteRoom } = useStore();
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  
  // Verification states
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<() => void>(() => {});

  // ─── AI: NL Search ───────────────────────────────────────────
  const { aiEnabled, aiLoading, aiResults, aiAmbiguity, aiError, toggleAi, aiSearch } = useAISearch();

  // ─── AI: Pricing Recommendations ─────────────────────────────
  const [showPricing, setShowPricing] = useState(false);
  const [pricingData, setPricingData] = useState<any>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  const fetchPricingRecs = async () => {
    setShowPricing(true);
    setPricingLoading(true);
    try {
      const res = await fetch('/api/ai/price-recs?daysAhead=30');
      const data = await res.json();
      setPricingData(data);
    } catch (err) {
      console.error('Failed to fetch pricing recommendations:', err);
    } finally {
      setPricingLoading(false);
    }
  };

  const handleApprovePrice = async (id: number) => {
    try {
      await fetch(`/api/ai/price-recs/${id}/approve`, { method: 'POST' });
      // Refresh pricing data + rooms
      fetchPricingRecs();
      fetchRooms();
    } catch (err) {
      console.error('Failed to approve:', err);
    }
  };

  const handleRejectPrice = async (id: number) => {
    const reason = prompt('请填写拒绝原因：');
    if (!reason) return;
    try {
      await fetch(`/api/ai/price-recs/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      fetchPricingRecs();
    } catch (err) {
      console.error('Failed to reject:', err);
    }
  };

  const [newRoom, setNewRoom] = useState<Partial<Room>>({
    roomNumber: '',
    type: '标准单人间',
    price: 199,
    status: 'AVAILABLE'
  });

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // AI search: debounce and call API when aiEnabled
  useEffect(() => {
    if (!aiEnabled) return;
    const timer = setTimeout(() => aiSearch(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery, aiEnabled, aiSearch]);

  // When AI returns room results, merge for display
  const aiRoomResults = aiEnabled && aiResults?.table === 'rooms' ? aiResults.results : null;

  const statusColors: any = {
    AVAILABLE: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    OCCUPIED: 'bg-blue-50 text-blue-600 border-blue-100',
    MAINTENANCE: 'bg-orange-50 text-orange-600 border-orange-100',
  };

  const statusLabels: any = {
    AVAILABLE: '空闲',
    OCCUPIED: '入住中',
    MAINTENANCE: '维修中',
  };

  const filteredRooms = rooms
    .filter(room => {
      const matchesFilter = filter === 'ALL' || room.status === filter;
      const matchesSearch = room.roomNumber.includes(searchQuery) || 
                           room.type.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' }));

  // AI-enhanced display: when AI mode active, show only AI-matched rooms
  const displayRooms = aiRoomResults
    ? rooms.filter(r => aiRoomResults.some((ar: any) => ar.id === r.id || ar.room_number === r.roomNumber))
    : filteredRooms;

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    await addRoom(newRoom);
    setIsModalOpen(false);
    setNewRoom({ roomNumber: '', type: '标准单人间', price: 199, status: 'AVAILABLE' });
  };

  const handleEditClick = (room: Room) => {
    setPendingAction(() => () => {
      setEditingRoom({ ...room });
      setIsEditModalOpen(true);
    });
    setIsVerifyOpen(true);
  };

  const handleUpdateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRoom) {
      await updateRoom(editingRoom);
      setIsEditModalOpen(false);
      setEditingRoom(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">客房管理</h1>
          <p className="text-gray-500">查看并管理酒店所有房间的状态和信息。</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          新增房间
        </button>
        {/* AI: 定价建议按钮 */}
        <button
          onClick={fetchPricingRecs}
          className="flex items-center gap-2 bg-purple-50 text-purple-600 border border-purple-200 px-4 py-2 rounded-xl font-medium hover:bg-purple-100 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          AI定价建议
        </button>
      </div>

      <div className="flex gap-4 items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder={aiEnabled ? "AI模式: 试试说「空房」「套房」「维修的房间」..." : "搜索房间号或类型..."} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <AISearchToggle enabled={aiEnabled} onToggle={toggleAi} loading={aiLoading} />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 text-gray-600 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
          >
            <option value="ALL">全部状态</option>
            <option value="AVAILABLE">空闲</option>
            <option value="OCCUPIED">入住中</option>
            <option value="MAINTENANCE">维修中</option>
          </select>
        </div>
      </div>

      {/* AI: 错误提示 */}
      {aiError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          ❌ AI 搜索失败：{aiError}
        </div>
      )}

      {/* AI: 歧义提示 */}
      {aiAmbiguity && aiAmbiguity.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
          🤔 你的搜索可能匹配多个类型：{aiAmbiguity.map((a: any) => a.label).join(' / ')}，请细化关键词。
        </div>
      )}

      {/* AI: 搜索结果提示 */}
      {aiEnabled && aiResults && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-2 text-xs text-purple-600 font-medium flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" />
          AI 识别意图：{aiResults.intent_display || aiResults.matched_category || '未知'}，找到 {aiResults.count || aiResults.results?.length || 0} 条结果
        </div>
      )}

      {/* AI: 搜索中提示 */}
      {aiEnabled && aiLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-purple-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">AI 正在理解你的搜索...</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {displayRooms.map((room) => (
          <div key={room.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 rounded-xl">
                <BedDouble className="w-6 h-6 text-blue-600" />
              </div>
              <button 
                onClick={() => handleEditClick(room)}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="编辑房间"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-1 mb-6">
              <h3 className="text-xl font-bold text-gray-900">房间 {room.roomNumber}</h3>
              <p className="text-sm text-gray-500">{room.type}</p>
            </div>

            <div className="flex items-center justify-between">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColors[room.status]}`}>
                {statusLabels[room.status]}
              </span>
              <p className="font-bold text-blue-600">¥ {room.price} <span className="text-xs text-gray-400 font-normal">/ 晚</span></p>
            </div>
          </div>
        ))}
      </div>

      {/* Add Room Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">新增房间</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddRoom} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">房间号</label>
                <input 
                  required
                  type="text" 
                  value={newRoom.roomNumber}
                  onChange={(e) => setNewRoom({...newRoom, roomNumber: e.target.value})}
                  placeholder="例如: 101"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">房间类型</label>
                <select 
                  value={newRoom.type}
                  onChange={(e) => setNewRoom({...newRoom, type: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="标准单人间">标准单人间</option>
                  <option value="标准双人间">标准双人间</option>
                  <option value="豪华大床房">豪华大床房</option>
                  <option value="商务套房">商务套房</option>
                  <option value="总统套房">总统套房</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">价格 (元/晚)</label>
                <input 
                  required
                  type="number" 
                  value={newRoom.price}
                  onChange={(e) => setNewRoom({...newRoom, price: Number(e.target.value)})}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-sm"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Room Modal */}
      {isEditModalOpen && editingRoom && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">编辑房间</h2>
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={async () => {
                    if (window.confirm('确定要删除这个房间吗？')) {
                      await deleteRoom(editingRoom.id);
                      setIsEditModalOpen(false);
                    }
                  }}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="删除房间"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <form onSubmit={handleUpdateRoom} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">房间号</label>
                <input 
                  required
                  type="text" 
                  value={editingRoom.roomNumber}
                  onChange={(e) => setEditingRoom({...editingRoom, roomNumber: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">房间类型</label>
                <select 
                  value={editingRoom.type}
                  onChange={(e) => setEditingRoom({...editingRoom, type: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="标准单人间">标准单人间</option>
                  <option value="标准双人间">标准双人间</option>
                  <option value="豪华大床房">豪华大床房</option>
                  <option value="商务套房">商务套房</option>
                  <option value="总统套房">总统套房</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">价格 (元/晚)</label>
                <input 
                  required
                  type="number" 
                  value={editingRoom.price}
                  onChange={(e) => setEditingRoom({...editingRoom, price: Number(e.target.value)})}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">房间状态</label>
                <select 
                  value={editingRoom.status}
                  onChange={(e) => setEditingRoom({...editingRoom, status: e.target.value as any})}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="AVAILABLE">空闲</option>
                  <option value="OCCUPIED">入住中</option>
                  <option value="MAINTENANCE">维修中</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-sm"
                >
                  确认修改
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ AI: 定价建议 Modal ═══ */}
      {showPricing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  AI 定价建议
                </h2>
                <p className="text-sm text-gray-500">基于入住率、节假日等多因子分析</p>
              </div>
              <button onClick={() => setShowPricing(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-3">
              {pricingLoading && (
                <div className="flex items-center gap-3 text-purple-600 justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="font-medium">AI 分析中...</span>
                </div>
              )}

              {!pricingLoading && pricingData?.recommendations?.map((rec: any) => (
                <div key={rec.id || rec.room_id} className="bg-gray-50 rounded-xl p-4 flex items-center justify-between gap-4 border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900">{rec.room_number || rec.room_id}</span>
                      <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">{rec.room_type}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">当前 <span className="font-bold text-gray-700">¥{rec.current_price}</span></span>
                      <span>→</span>
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
                    {rec.occupancy_pct != null && (
                      <div className="text-xs text-gray-400 mt-1">入住率: {rec.occupancy_pct}%</div>
                    )}
                  </div>
                  {(rec.status === 'PENDING' || rec.status == null) ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleApprovePrice(rec.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> 同意
                      </button>
                      <button
                        onClick={() => handleRejectPrice(rec.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-600 text-xs font-bold rounded-lg hover:bg-red-200 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> 拒绝
                      </button>
                    </div>
                  ) : (
                    <span className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${
                      rec.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}>
                      {rec.status === 'APPROVED' ? '已采纳' : '已拒绝'}
                    </span>
                  )}
                </div>
              ))}

              {!pricingLoading && (!pricingData?.recommendations || pricingData.recommendations.length === 0) && (
                <div className="text-center text-gray-400 py-12">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>暂无定价建议</p>
                  <p className="text-xs mt-1">当前入住率稳定，所有价格合理</p>
                </div>
              )}

              {pricingData?.pending_count > 0 && (
                <div className="text-xs text-gray-500 text-center pt-2">
                  共 {pricingData.pending_count} 条待审批
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <PasswordVerifyModal
        isOpen={isVerifyOpen}
        onClose={() => setIsVerifyOpen(false)}
        onSuccess={pendingAction}
        title="编辑客房验证"
      />
    </div>
  );
};

export default Rooms;
