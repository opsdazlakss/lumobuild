import { useState } from 'react';
import { MdAdd } from 'react-icons/md';
import { cn } from '../../utils/helpers';
import { ServerContextMenu } from '../server/ServerContextMenu';
import lumoLogo from '../../assets/lumo-logo.png';

export const ServerSwitcher = ({ servers, currentServerId, onServerChange, onCreateServer, onJoinServer, userRole, userId, unreadMentions = {} }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  const handleContextMenu = (e, server) => {
    e.preventDefault();
    setContextMenu({
      server,
      position: { x: e.clientX, y: e.clientY }
    });
  };

  return (
    <div className="w-20 bg-dark-bg h-full flex flex-col items-center">
      {/* Lumo Logo - Independent Section */}
      <div className="flex flex-col items-center">
        <img 
          src={lumoLogo} 
          alt="Lumo" 
          className="w-20 h-20 object-contain cursor-pointer"
        />
      </div>

      {/* Separator */}
      <div className="w-8 h-0.5 bg-dark-hover my-2" />

      {/* Server List - Independent Section with own spacing */}
      <div className="flex flex-col items-center gap-2 flex-1 overflow-y-auto">
        {servers.map((server) => (
          <div key={server.id} className="relative">
            <button
              onClick={() => onServerChange(server.id)}
              onContextMenu={(e) => handleContextMenu(e, server)}
              className={cn(
                'w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200',
                'hover:rounded-xl',
                currentServerId === server.id
                  ? 'bg-brand-primary text-white rounded-xl'
                  : 'bg-dark-sidebar text-dark-text hover:bg-brand-primary hover:text-white'
              )}
              title={server.name}
            >
              {server.icon ? (
                <img src={server.icon} alt={server.name} className="w-full h-full rounded-2xl object-cover" />
              ) : (
                <span className="text-xl font-bold">
                  {server.name.charAt(0).toUpperCase()}
                </span>
              )}
            </button>
            
            {/* Unread Mention Badge */}
            {unreadMentions[server.id]?.count > 0 && (
              <div className="absolute -top-1 -right-1 min-w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-dark-bg pointer-events-none">
                <span className="text-white text-xs font-bold px-1">
                  {unreadMentions[server.id].count > 99 ? '99+' : unreadMentions[server.id].count}
                </span>
              </div>
            )}
          </div>
        ))}

        {/* Separator */}
        <div className="w-8 h-0.5 bg-dark-hover my-1" />

        {/* Add Server Button */}
        <div className="relative pb-2">
          <button
            id="add-server-btn"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              document.documentElement.style.setProperty('--btn-top', `${rect.top}px`);
              setShowMenu(!showMenu);
            }}
            className="w-12 h-12 rounded-2xl bg-dark-sidebar text-green-500 flex items-center justify-center hover:bg-green-500 hover:text-white hover:rounded-xl transition-all duration-200"
            title="Add Server"
          >
            <MdAdd size={28} />
          </button>

          {/* Dropdown Menu - Fixed Position to escape overflow */}
          {showMenu && (
            <>
              <div className="fixed inset-0 z-50" onClick={() => setShowMenu(false)} />
              <div 
                className="fixed left-[80px] bg-dark-sidebar border border-dark-hover rounded-lg shadow-lg py-2 z-50 w-48"
                style={{ top: 'var(--btn-top)' }}
              >
                <button
                  onClick={() => {
                    onCreateServer();
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-dark-text hover:bg-dark-hover transition-colors"
                >
                  Create Server
                </button>
                <button
                  onClick={() => {
                    onJoinServer();
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-dark-text hover:bg-dark-hover transition-colors"
                >
                  Join Server
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ServerContextMenu
          server={contextMenu.server}
          position={contextMenu.position}
          userRole={userRole}
          userId={userId}
          onClose={() => setContextMenu(null)}
          onDelete={() => {
            // Reload will happen via real-time listener
            setContextMenu(null);
          }}
        />
      )}
    </div>
  );
};
