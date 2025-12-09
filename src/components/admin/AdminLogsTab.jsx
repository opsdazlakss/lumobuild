import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useData } from '../../context/DataContext';
import { Modal } from '../shared/Modal';
import { formatTimestamp } from '../../utils/helpers';
import { MdDelete, MdEdit } from 'react-icons/md';

export const AdminLogsTab = () => {
  const [logs, setLogs] = useState([]);
  const { channels } = useData();

  useEffect(() => {
    const q = query(
      collection(db, 'adminLogs'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = [];
      snapshot.forEach((doc) => {
        logsData.push({ id: doc.id, ...doc.data() });
      });
      setLogs(logsData);
    });

    return unsubscribe;
  }, []);

  const getChannelName = (channelId) => {
    const channel = channels.find(c => c.id === channelId);
    return channel ? `#${channel.name}` : 'Unknown Channel';
  };

  return (
    <div>
      <h3 className="text-2xl font-bold text-dark-text mb-6">Admin Logs</h3>
      <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
        {logs.length === 0 ? (
          <div className="text-center text-dark-muted py-8">
            No logs yet
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="bg-dark-bg p-5 rounded-xl hover:bg-dark-hover transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {log.type === 'message_delete' ? (
                    <>
                      <MdDelete className="text-admin" size={20} />
                      <span className="font-semibold text-dark-text">Message Deleted</span>
                    </>
                  ) : log.type === 'message_edit' ? (
                    <>
                      <MdEdit className="text-blue-400" size={20} />
                      <span className="font-semibold text-dark-text">Message Edited</span>
                    </>
                  ) : (
                    <span className="font-semibold text-dark-text">{log.type}</span>
                  )}
                </div>
                <span className="text-xs text-dark-muted">
                  {log.timestamp && formatTimestamp(log.timestamp)}
                </span>
              </div>
              
              <div className="space-y-1 text-sm">
                <div className="flex gap-2">
                  <span className="text-dark-muted">Channel:</span>
                  <span className="text-dark-text font-medium">{getChannelName(log.channelId)}</span>
                </div>
                
                {log.type === 'message_delete' && (
                  <>
                    <div className="flex gap-2">
                      <span className="text-dark-muted">Original Author:</span>
                      <span className="text-dark-text">{log.originalAuthorName}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-dark-muted">Message:</span>
                      <span className="text-dark-text italic">"{log.messageText}"</span>
                    </div>
                  </>
                )}
                
                {log.type === 'message_edit' && (
                  <>
                    <div className="flex gap-2">
                      <span className="text-dark-muted">Before:</span>
                      <span className="text-dark-text italic">"{log.originalText}"</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-dark-muted">After:</span>
                      <span className="text-blue-400 italic">"{log.newText}"</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
