import React from 'react';

interface SidebarProps {
  activeTab: 'inicio' | 'explorar' | 'favoritos' | 'buscar';
  focusedIndex: number | null; // 0-3 if sidebar is focused
  isSidebarActive: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, focusedIndex, isSidebarActive }) => {
  const menuItems = [
    {
      id: 'buscar',
      label: 'Buscar',
      iconName: 'search'
    },
    {
      id: 'inicio',
      label: 'Inicio',
      iconName: 'home'
    },
    {
      id: 'explorar',
      label: 'Explorar',
      iconName: 'explore'
    },
    {
      id: 'favoritos',
      label: 'Favoritos',
      iconName: 'favorite'
    }
  ];

  return (
    <aside className={`sidebar ${isSidebarActive ? 'expanded' : ''}`.trim()}>
      <div className="sidebar-logo">
        <img
          src="/assets/brand/logo.png"
          alt="Cine 3 Estrellas Logo"
          className="brand-logo-img"
        />
        <img
          src="/assets/brand/brand-text.png"
          alt="Cine 3 Estrellas Texto"
          className={`brand-text-img ${isSidebarActive ? 'visible' : ''}`.trim()}
        />
      </div>

      <div className="sidebar-menu">
        {menuItems.map((item, index) => {
          const isActive = activeTab === item.id;
          return (
            <div
              key={item.id}
              className={`sidebar-item ${isActive ? 'active' : ''} ${focusedIndex === index ? 'focused' : ''}`.replace(/\s+/g, ' ').trim()}
            >
              <div className="item-icon">
                <span 
                  className="material-symbols-outlined"
                  style={{ 
                    fontSize: '26px',
                    fontVariationSettings: `'FILL' ${isActive ? 1 : 0}, 'wght' 100, 'GRAD' 0, 'opsz' 24`
                  }}
                >
                  {item.iconName}
                </span>
              </div>
              <span className="item-label">{item.label}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default Sidebar;
