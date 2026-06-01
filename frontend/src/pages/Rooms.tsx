import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter,
  MoreVertical,
  BedDouble,
  X,
  Trash2
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Room } from '../types';
import PasswordVerifyModal from '../components/PasswordVerifyModal';

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

  const [newRoom, setNewRoom] = useState<Partial<Room>>({
    roomNumber: '',
    type: '标准单人间',
    price: 199,
    status: 'AVAILABLE'
  });

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

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
      </div>

      <div className="flex gap-4 items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="搜索房间号或类型..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredRooms.map((room) => (
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
