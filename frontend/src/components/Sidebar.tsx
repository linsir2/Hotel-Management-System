import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BedDouble, 
  CalendarCheck, 
  Users, 
  LogOut,
  Hotel
} from 'lucide-react';
import { useStore } from '../store/useStore';

const Sidebar = () => {
  const { user, logout } = useStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: '控制面板', path: '/' },
    { icon: BedDouble, label: '客房管理', path: '/rooms' },
    { icon: CalendarCheck, label: '预订管理', path: '/bookings' },
    { icon: Users, label: '住客管理', path: '/guests' },
  ];

  return (
    <div className="w-64 h-screen bg-blue-900 text-white flex flex-col shrink-0 shadow-2xl">
      <div className="p-6 flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-xl">
          <Hotel className="w-6 h-6" />
        </div>
        <span className="text-xl font-bold tracking-tight">酒店管理系统</span>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
              ${isActive 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                : 'text-blue-100 hover:bg-blue-800 hover:text-white'}
            `}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-blue-800 bg-blue-950/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold shadow-inner">
              {user?.realName?.charAt(0) || '管'}
            </div>
            <div>
              <p className="text-sm font-bold truncate max-w-[100px]">{user?.realName || '管理员'}</p>
              <p className="text-[10px] text-blue-300 uppercase tracking-widest">{user?.role || '在线'}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors group"
            title="退出登录"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
