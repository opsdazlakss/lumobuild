import { useState } from 'react';
import { MdPoll, MdCheck, MdPeople, MdStop } from 'react-icons/md';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../services/firebase';

export const PollDisplay = ({ message, currentUserId, serverId, channelId, users }) => {
  const [voting, setVoting] = useState(false);
  const poll = message.poll;
  
  if (!poll) return null;

  const isCreator = message.userId === currentUserId;
  const isEnded = poll.ended === true;

  // Calculate total votes
  const totalVotes = poll.options.reduce((acc, _, idx) => {
    return acc + (poll.votes?.[`option_${idx}`]?.length || 0);
  }, 0);

  // Check if user has voted
  const userVotedOptions = poll.options
    .map((_, idx) => poll.votes?.[`option_${idx}`]?.includes(currentUserId) ? idx : -1)
    .filter(idx => idx !== -1);

  const hasVoted = userVotedOptions.length > 0;

  const handleVote = async (optionIndex) => {
    if (voting || isEnded) return;
    setVoting(true);

    try {
      const voteKey = `poll.votes.option_${optionIndex}`;
      const messageRef = doc(db, 'servers', serverId, 'channels', channelId, 'messages', message.id);
      
      const alreadyVoted = poll.votes?.[`option_${optionIndex}`]?.includes(currentUserId);
      
      if (alreadyVoted) {
        // Remove vote
        await updateDoc(messageRef, {
          [voteKey]: arrayRemove(currentUserId)
        });
      } else {
        // If not multiple choice, remove previous votes first
        if (!poll.multipleChoice && userVotedOptions.length > 0) {
          for (const prevIdx of userVotedOptions) {
            await updateDoc(messageRef, {
              [`poll.votes.option_${prevIdx}`]: arrayRemove(currentUserId)
            });
          }
        }
        // Add vote
        await updateDoc(messageRef, {
          [voteKey]: arrayUnion(currentUserId)
        });
      }
    } catch (error) {
      console.error('Error voting:', error);
    } finally {
      setVoting(false);
    }
  };

  const handleEndPoll = async () => {
    if (!isCreator || isEnded) return;
    
    try {
      const messageRef = doc(db, 'servers', serverId, 'channels', channelId, 'messages', message.id);
      await updateDoc(messageRef, {
        'poll.ended': true
      });
    } catch (error) {
      console.error('Error ending poll:', error);
    }
  };

  const getVoterNames = (optionIndex) => {
    if (poll.anonymous) return null;
    const voters = poll.votes?.[`option_${optionIndex}`] || [];
    return voters.map(id => users?.find(u => u.id === id)?.displayName || 'Unknown').join(', ');
  };

  return (
    <div className="bg-dark-bg rounded-lg p-4 mt-2 border border-dark-hover max-w-md">
      {/* Poll Header */}
      <div className="flex items-center gap-2 mb-3">
        <MdPoll className="text-brand-primary" size={20} />
        <span className="text-xs text-dark-muted uppercase tracking-wide font-semibold">Poll</span>
        {poll.multipleChoice && (
          <span className="text-xs text-dark-muted bg-dark-hover px-2 py-0.5 rounded">
            Multiple Choice
          </span>
        )}
        {isEnded && (
          <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded">
            Ended
          </span>
        )}
      </div>

      {/* Question */}
      <h3 className="text-dark-text font-semibold mb-4">{poll.question}</h3>

      {/* Options */}
      <div className="space-y-2">
        {poll.options.map((option, idx) => {
          const votes = poll.votes?.[`option_${idx}`]?.length || 0;
          const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const isSelected = userVotedOptions.includes(idx);
          const voterNames = getVoterNames(idx);

          return (
            <button
              key={idx}
              onClick={() => handleVote(idx)}
              disabled={voting || isEnded}
              className={`w-full text-left p-3 rounded-lg relative overflow-hidden transition-all group ${
                isSelected 
                  ? 'bg-brand-primary/20 border-2 border-brand-primary' 
                  : 'bg-dark-sidebar border border-dark-hover hover:border-dark-muted'
              } ${isEnded ? 'cursor-not-allowed opacity-80' : ''}`}
            >
              {/* Progress bar background - shows when there are votes */}
              {totalVotes > 0 && (
                <div 
                  className={`absolute inset-0 transition-all duration-500 ${
                    isSelected ? 'bg-brand-primary/30' : 'bg-dark-hover/50'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              )}
              
              {/* Content */}
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isSelected && (
                    <div className="w-5 h-5 bg-brand-primary rounded-full flex items-center justify-center">
                      <MdCheck className="text-white" size={14} />
                    </div>
                  )}
                  <span className={`text-sm ${isSelected ? 'text-dark-text font-medium' : 'text-dark-muted'}`}>
                    {option}
                  </span>
                </div>
                
                {totalVotes > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-dark-muted">{votes} vote{votes !== 1 ? 's' : ''}</span>
                    <span className="text-sm font-semibold text-dark-text">{percentage}%</span>
                  </div>
                )}
              </div>

              {/* Voter names tooltip */}
              {voterNames && votes > 0 && (
                <div className="text-xs text-dark-muted mt-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                  {voterNames}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-dark-hover">
        <div className="flex items-center gap-1 text-xs text-dark-muted">
          <MdPeople size={14} />
          <span>{totalVotes} total vote{totalVotes !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          {poll.anonymous && (
            <span className="text-xs text-dark-muted">Anonymous</span>
          )}
          {isCreator && !isEnded && (
            <button
              onClick={handleEndPoll}
              className="flex items-center gap-1.5 text-xs font-medium text-red-400 bg-red-400/10 hover:bg-red-400/20 px-3 py-1.5 rounded transition-all border border-red-400/20 hover:border-red-400/30"
            >
              <MdStop size={14} />
              End Poll
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
